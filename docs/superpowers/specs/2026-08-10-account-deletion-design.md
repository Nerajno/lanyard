# Design — Lanyard Account Deletion

Date: 2026-08-10 · Status: Approved

## Goal

Let a signed-in user permanently delete their account and all personal data from `/app/settings`, in a way that is real deletion (not hiding), legally sound, and safe against accidents. Includes a 14-day grace window, a "download my data" export, an undo path during grace, SMS suppression retention, and a scheduled hard purge.

## Decisions (from brainstorming / user sign-off)

- **Grace period: 14 days** before the scheduled job hard-purges the account.
- **Data export: build now.** A signed-in GET endpoint returns the user's contacts as JSON; surfaced in the delete confirm dialog as "Download my data".
- **Suppression scheme:** SHA-256 of normalized E.164; retained indefinitely; `sms_suppressions` never cascade-deleted. Set = the user's own profile phone *only* when `sms_opted_out_at` is set (contacts are never texted by us in Phase 1 — act-links open the user's own composer).
- **Undo = recreate + reparent (NOT restore).** Verified in GoTrue source: `SoftDeleteUser` obfuscates email/phone, nils the password, clears all tokens, sets `deleted_at`, logs out all sessions, and frees the email for a new account. There is no undelete API. So the undo path creates a new auth user with the same email and reparents the existing `profiles`/`contacts`/`nudges`/`shares` rows to the new uid, then hard-deletes the old soft-deleted user. Net effect to the user: "sign back in within 14 days from the home page and your data comes back."
- **Server-side only.** Nitro routes (this repo has no Supabase Edge Functions; all server logic is Nitro + `useSupabaseAdmin()`), service role never client-side.
- **Confirm step = typed account email** (the prompt's "or type the account email" path). Session auth via the ssr cookie client, not the Bearer-only pattern in `profile/phone.ts` (the UI never sends a Bearer header there).
- **Stripe cancel = guarded no-op stub.** Phase 1 has no billing (Pro is only a marketing future tier). The hook exists so a future billing integration fills it in.
- **Idempotent delete/purge/restore.**

## Key GoTrue facts the design leans on

- `auth.admin.deleteUser(id, { shouldSoftDelete: true })`: obfuscates `auth.users.email`/`phone`, nils password, clears tokens, sets `deleted_at`, logs out sessions, frees the email. Data in `public.*` is NOT touched (cascade fires only on hard delete).
- `auth.admin.deleteUser(id, { shouldSoftDelete: false })` (default): removes the `auth.users` row → FK `ON DELETE CASCADE` removes `profiles`/`contacts`/`nudges`/`shares` (cascades already exist from `0001`/`0005`).
- `auth.admin.createUser({ email })`: works during grace because GoTrue freed the email. The `on_auth_user_created` trigger auto-creates an empty `profiles` row for the new uid.
- No native restore/undelete exists → recreate + reparent.

## Data model additions

### `sms_suppressions` (new table, RLS on, no public policies)

Outlives the purge; never cascade-deleted. Service-role writes (delete flow) and reads (nudge send guard) only — same pattern as `waitlist`.

```
id          bigint generated always as identity primary key
phone_hash  text not null unique     # sha256 of normalized E.164
reason      text not null default 'opted_out'
created_at  timestamptz not null default now()
```

### `account_deletions` (new table, RLS on, no public policies)

Grace-window ledger. Keyed on the **real email** because GoTrue obfuscates `auth.users.email` on soft delete — this is the only place undo/purge can find the account. No FK to `auth.users` on purpose: the row must outlive the purge (audit record).

```
id            uuid primary key default gen_random_uuid()
user_id       uuid not null
email         text not null
requested_at  timestamptz not null default now()
purge_at      timestamptz not null     # requested_at + 14 days
purged_at     timestamptz              # set by the purge job
superseded_at timestamptz              # set by undo; restoration won
```

Partial index on `purge_at where purged_at is null and superseded_at is null`.

## Flows

### Delete (`POST /api/account/delete`, body `{ confirmEmail }`)

1. Session auth via ssr cookie client (`useSupabaseUser()`) → 401 if none.
2. `normalizeEmail(confirmEmail) === normalizeEmail(user.email)` else 400.
3. Idempotent: if a pending `account_deletions` row exists for `user.id`, return `{ ok: true, purgeBy }` early.
4. Insert `account_deletions { user_id, email, purge_at = now() + 14 days }`.
5. Suppression: if `profiles.phone` and `profiles.sms_opted_out_at` → insert `sha256(e164)` into `sms_suppressions`.
6. Side-effect cancels: Twilio — nothing scheduled in P1 (no-op + log); Stripe — guarded no-op stub.
7. `admin.auth.admin.deleteUser(user.id, { shouldSoftDelete: true })`.
8. Return `{ ok: true, purgeBy }`.

### Export (`GET /api/account/export`)

Session auth. Returns `{ contacts: Contact[] }` (the user's contacts) for the Download-my-data button. Read-only, non-destructive, no re-auth.

### Restore / undo (`POST /api/account/restore`, body `{ email }`)

Reachable signed-out (from the post-deletion landing banner).

1. Look up `account_deletions` by normalized email where `purged_at is null and superseded_at is null`. Not found or past `purge_at` → 400 (window closed).
2. `admin.auth.admin.createUser({ email })` → new uid (trigger creates an empty profile).
3. Reparent: copy old `profiles` fields into the new profile, delete the old profile row; update `contacts.user_id`, `nudges.user_id`, `shares.user_id` → new uid.
4. `admin.auth.admin.deleteUser(oldId, { shouldSoftDelete: false })` (safe — data already moved).
5. Mark `superseded_at`; return `{ ok: true }` → client sends a normal magic link to sign in.

### Purge (`POST /api/cron/purge`, cron-secret guarded)

New Netlify scheduled function `purge-cron` (`@daily`) → this route.

- Select `account_deletions` with `purge_at <= now` and `purged_at is null` and `superseded_at is null`.
- For each: `admin.auth.admin.deleteUser(user_id, { shouldSoftDelete: false })` → cascade removes `public.*` rows → set `purged_at`. Idempotent, batch-safe.

## Loop + send changes

- `server/api/cron/nudge.ts`: skip profiles whose `user_id` is in a pending `account_deletions` (a user who deleted must not keep getting nudged during grace).
- `server/services/nudgeSender.ts`: hard-block any SMS to a number whose hash is in `sms_suppressions` (consult in `canSendSms`).

## UI

- `/app/settings`: Account section gains a "Delete account" action (coral, visually distinct from Sign out).
- `components/ConfirmDeleteAccount.vue`: plain-voice consequences (contacts + nudge history removed for good; hashed opted-out numbers kept so they're never texted again; paid invoices retained; 14-day window to change your mind). Actions: "Download my data" (GET export → blob) + a "type your account email" field that unlocks the destructive button.
- `composables/useDeleteAccount.ts`: POST delete → `auth.signOut()` with catch/ignore of "user from sub claim does not exist" → clear `sb-*-auth-token` cookies + null the auth store → `navigateTo('/?deleted=1')`.
- `pages/index.vue`: dismissible banner when `?deleted=1` — "Account scheduled for deletion in 14 days. Changed your mind? [Restore]" → email → POST restore → magic link sent.

## Tests (Vitest, pure logic — no live DB)

- `deleteAccount.test.ts`: happy path via mocked admin (deleteUser called with `{shouldSoftDelete:true}`, suppression row written, ledger inserted with `purge_at = +14d`); no-session → 401; email mismatch → 400; already-pending → idempotent.
- `suppression.test.ts`: `hashE164` normalization (`+1 555 000 0000`, dashed/spaced inputs → stable hex, no raw number stored); write + lookup true/false.
- `accountFlow.test.ts`: purge selector vs fixtures (past-due picked, pending/superseded skipped); restore plan (createUser + reparent all four tables + old-user hard-delete); grace-vs-purge cascade fixtures (data intact during grace, gone after hard delete).

## Definition of done

Types pass (`nuxi typecheck`) · tests pass (`vitest run`) · lint passes · RLS enabled on both new tables with no public policies · service role only under `server/*` · post-delete session clears and `/` redirect with `?deleted=1` works · `decisions.md`, `Architecture.md`, `tasks.md` updated.