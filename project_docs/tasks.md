# TASKS — Lanyard (Phase 1)

Sequenced so you have a working nudge by end of week one. Check off in order.

## 0. Setup
- [x] Scaffold Nuxt 3 + TS + Tailwind + Pinia
- [x] Create Supabase project; add `.env` + `.env.example` *(project `ymmlysznstdguegylbjq` created; linked + migrations pushed)*
- [x] Wire Supabase client + auth (email magic link is fine)
- [x] Subscribe magic link + email/password + Google/Apple OAuth sign-in (smart form)
- [x] In-app change password (Settings) with current-password + revoke other devices
- [x] Email provider account (Resend) + verified sending domain *(done — `NUXT_EMAIL_API_KEY` + `NUXT_EMAIL_FROM` filled in `.env`; wired via `server/services/providers/resend.ts` + smoke script)*
- [ ] **Twilio A2P 10DLC registration** — takes days to weeks to approve and blocks production SMS. Email nudges cover the gap. *(account + Verify hooks are in place: `NUXT_TWILIO_*` filled, wired via `server/services/providers/twilio.ts`)*

> **Status:** the loop is no longer inert — all `NUXT_EMAIL_*` and `NUXT_TWILIO_*` keys are filled and the send path is live (`feature/twilio-resend-sdk`, commit `558ed09`). Email nudges work now; SMS awaits 10DLC approval.

## 1. Schema (see Architecture.md)
- [x] `profiles` table migration (phone, verified_at, nudge_channel, timezone, quiet_hours, opt-in/opt-out) *(applied to remote; `quiet_hours` → `quiet_hours_start`/`quiet_hours_end` smallint — overnight windows can't be an int4range)*
- [x] `contacts` table migration incl. `cadence_ladder int[]`, `touchpoints_done`, CHECK (email or phone)
- [x] `nudges` table migration
- [x] RLS policies (`user_id = auth.uid()`) for all CRUD on all three
- [x] `0003_custom_cadence`: `cadence_ladder` → `jsonb` `{value,unit}` rungs (`min`/`hour`/`day`), `follow_up_by` → `timestamptz`, new one-shot `remind_at`, supporting index — RLS unchanged (covered by existing policies) *(applied to remote)*
- [x] ~~Seed a couple rows for local testing~~ — *dropped. `0002_seed.sql` referenced a fake auth user and broke `db push`. Seed via a real signed-in user, or `supabase/seed.sql` for local only.*

## 2. Add contact
- [x] Add page/form: name, how_met, email, phone, ladder preset chips (warm / default / slow / custom)
- [x] Validate: name + how_met required, at least one of email/phone
- [x] `follow_up_by = created_at + cadence_ladder[1]`
- [x] Insert via Supabase

## 2.5 Onboarding (the nudge needs a destination)
- [x] Capture user phone; verify via one-time code
- [x] Channel preference (sms / email / both) + explicit SMS opt-in with consent copy
- [x] Timezone (detect from browser, let them override) + send window

## 3. List & triage
- [x] List page: active contacts `order by follow_up_by asc`
- [x] Urgency color from days-until-due (fresh / close / due)
- [x] Coffee progress per row (1/3, 2/3, 3/3)
- [x] Graduated section
- [x] Empty state

## 4. Actions
- [x] Mark touchpoint done: `touchpoints_done += 1`, advance `follow_up_by` to the next ladder rung, or set `graduated` on the third
- [x] Snooze 3 days (follow_up_by += 3, ladder position unchanged)
- [x] Manual archive (distinct from graduated)
- [x] Edit / delete contact
- [x] **Vitest: ladder advance logic** — rungs 1→2→3, graduation on 3, custom ladders, snooze doesn't consume a rung
- [x] Custom rung entries in the add/edit form (`{value,unit}` rows, min/hour/day) with preset chips
- [x] Quick nudge ("Nudge me later") → one-shot `remind_at`; never consumes a rung

## 5. The nudge (core — don't skip to polish before this works)

*Send-path work lives on `feature/twilio-resend-sdk` (49 commits ahead of `main`; commit `558ed09` wired real Twilio + Resend SDKs and fixed H2–H5). Review + merge before deploy.*

- [x] "Who is due" query as a testable function (Vitest against fixtures)
- [x] Instant-based due: `computeDue` checks `follow_up_by`/`remind_at` against `now`, covering `min`/`hour`/`day` rungs
- [x] Sub-day nudges bypass the per-day cap (`shouldDeliverForUser` / `splitSubDay`); cron clears `remind_at` after its beat
- [x] Twilio account + from-number; store secrets *(done — `NUXT_TWILIO_SID` / `_TOKEN` / `_FROM` / `_VERIFY_SID` all filled; SDK provider in `server/services/providers/twilio.ts`; delivery gated on 10DLC approval)*
- [x] Email send path (provider SDK)
- [x] Signed act-link tokens (`ACT_LINK_SIGNING_SECRET`) — must work from a phone without a fresh login
- [x] Act route: stamp `opened_at`, open prefilled `sms:`/`mailto:`, mark touchpoint
- [x] Scheduled job (hourly): local send window + quiet hours → due query → 1 vs 2+ branch → channel branch → send
- [x] Insert `nudges` row per send; use it as the double-send guard
- [x] STOP/HELP webhook → set `sms_opted_out_at`, hard block sends

## 6. Dogfood
- [ ] Deploy (Netlify + Supabase) — *Supabase project exists + migrations pushed; Netlify side pending*
  - ⚠️ **Blocked by §9 C1.** The client bundle currently carries a `service_role` key; deploying publishes it. Fix and rotate first. *(C1 still open as of 2026-08-15.)*
- [x] Swap `vercel.json` for `netlify.toml` + `netlify/functions/nudge-cron.mts` (host decision changed; see decisions.md) *(`vercel.json` removed; `netlify.toml` + `nudge-cron.mts` + `purge-cron.mts` in place)*
- [ ] Set `NUXT_PUBLIC_APP_URL` on Netlify — act-links are built from it *(set locally to `http://localhost:3000`; the real origin still needs setting on Netlify or live nudges link to localhost)*
- [ ] Add real people from your next event — *human action*
- [x] Track from `nudges`: median nudge→act latency, % acted on, % reaching all three coffees — *see `/api/stats` + `/stats` page*

## 7. Account deletion
- [x] Migration: `sms_suppressions` + `account_deletions` (RLS on, no public policies); FKs already cascade
- [x] Delete route: typed-email confirm → grace ledger → suppression → soft delete (service role only)
- [x] Export route (`GET /api/account/export`) → "Download my data"
- [x] Restore route: recreate auth user + reparent rows within 14 days
- [x] Daily purge cron (`@daily`) → hard delete past grace
- [x] Nudge loop skips pending deletions; sender hard-blocks suppressed numbers
- [x] Settings UI + confirm dialog + post-delete redirect + home restore banner
- [x] Vitest: delete happy/failure/idempotent, suppression hash, purge/restore plans

## 8. Auth methods — *in flight on `feature/auth-methods`*
Plan: `project_docs/plans/2026-08-10-auth-methods.md`. Spec: `project_docs/specs/2026-08-10-auth-methods-design.md`.
- [x] Pure smart-form phase resolver + tests
- [x] Auth store actions: password sign-in/sign-up, OAuth, password reset
- [x] Smart-form composable + component
- [x] Google + Apple OAuth buttons
- [x] Two-tab login page
- [x] Forgot-password reset page
- [x] Three-way sign-in decision recorded in `decisions.md`
- [x] Final-review fix wave — *committed in the worktree (`3f90256` confirm-email resend + tested error mapping); worktree clean*
- [ ] Plan Task 7: sync docs, run the full gate, commit
- [ ] Merge to `main`, remove the worktree

Branch gate as of 2026-08-10: 61 tests pass, typecheck 0, lint 0.

## 9. Audit remediation — security & architecture (2026-08-10)

From security-auditor + system-design-engineer audits. Ordered by severity; do the Critical before anything else. **Fixed as of `558ed09` (feature/twilio-resend-sdk): H2, H3, H4, H5.** Before merging: `npm audit`, and add integration tests for H2 so the auth-header class of bug can't regress.

### Critical
- [ ] **C1 — Fix Supabase keys: the "anon" key is actually a `service_role` key** — JWT payload in `.env:6` decodes to `role: service_role`, shipped client-side via `NUXT_PUBLIC_*` (`composables/useSupabase.ts:19-26`). Total RLS bypass for every user's data. Generate a real anon key + a *separate* service_role key, update `.env` + Netlify env, and **rotate** the exposed key regardless.

  **Verified 2026-08-11 by decoding both JWT payloads — worse than described.** Both slots hold the *same* token:
  ```
  NUXT_PUBLIC_SUPABASE_ANON_KEY   role=service_role  ref=ymmlysznstdguegylbjq
  NUXT_SUPABASE_SERVICE_ROLE      role=service_role  ref=ymmlysznstdguegylbjq
  identical values: true
  ```
  There is no anon key in `.env` at all. Anyone opening devtools on a built page gets full read/write on every user's `contacts`, `profiles`, and `nudges`.

  **Still open as of 2026-08-15** — `.env` still holds `role: service_role` in the anon slot. This is the last gate on deploy.

  *Blast radius (checked, and it's contained):* `.env` has never been committed — `git log --all -- .env` is empty — the token appears in no tracked file, and Netlify deploy is still pending (§6). Exposure is local dev only, **so long as C1 is fixed before the first deploy.** Deploying first publishes it.

  Steps: Supabase dashboard → Project Settings → API → copy the **anon/public** key into `NUXT_PUBLIC_SUPABASE_ANON_KEY`; keep the service_role key in `NUXT_SUPABASE_SERVICE_ROLE` only; then rotate. Treat the old token as compromised regardless of the clean git history. Re-verify with `scratchpad/check-jwt.mjs` (prints role claims, never key values).

  **This blocks §6 deploy.** Nothing in §6 should start until it's green.

  **Code guard landed (2026-10-03, `fix/audit-c1-h6`):** `server/plugins/supabaseKeyGuard.ts` refuses to boot when the public slot holds a service_role/secret key or equals the service key (`utils/supabaseKeyRole.ts`, tested). The key swap + rotation above is still a human step — until it is done, `npm run dev` will refuse to start.

### High
- [x] **H2 — Fix the 401 auth-header cluster**: `account/delete` (`server/api/account/delete.ts:10`), `account/export` (`export.ts:10`), `profile/phone` (`profile/phone.ts:17`) require `Authorization: Bearer`, but client sends no header (`composables/useDeleteAccount.ts:9`, `components/ConfirmDeleteAccount.vue:64`, `components/NudgePrefsForm.vue:90,101`) → account deletion, data export, and SMS verification are all dead. Add a shared `requireUser(event)` helper (Bearer or `sb-*` session cookie — see `pages/app/stats.vue:54` for the working pattern) + one integration test per route. *(Done: `server/utils/requireUser.ts`; delete/export/phone all reuse it. Add the integration tests before merge.)*
- [x] **H3 — Fail closed on missing secrets**: `server/api/cron/nudge.ts:21-27`, `cron/purge.ts:11-17`, `twilio/sms-status.ts:13` all `if (secret)` and skip auth when the env var is unset → anyone can trigger real sends / forged STOPs. Reject with `createError(500)` when unset. Also remove the query-string secret path (`getQuery(event).token` at `cron/nudge.ts:23`, `cron/purge.ts:13`) — it leaks into logs. *(Done in `558ed09`: fail-closed, query-token path removed.)*
- [x] **H4 — Nudge loop failure isolation**: `server/api/cron/nudge.ts:57-100` has no per-user try/catch — one send failure aborts the entire run. Wrap per-user delivery, record errors in `summary`, continue. *(Done in `558ed09`.)*
- [x] **H5 — Failed sends consume the daily cap**: `server/services/nudgeSender.ts:68-72` inserts the `nudges` row (with `sent_at`) *before* the provider call → a throw persists the row and suppresses re-sends for 26h. Insert after success, or add a `status`/`delivery_error` column and exclude failures from the guard. *(Done in `558ed09` via `delivery_status` `pending→sent/failed`; the guard only counts `sent`.)*
- [x] **H6 — Act-link replay + `mailto:` injection**: `server/routes/act/[token].get.ts:46-56` advances the ladder on every GET (re-clicks/forwarded links = premature graduation); `:61-66` builds `mailto:` from unvalidated contact email (crafted address can inject `?bcc=` → messages blind-copied to attacker). Make the advance first-act-wins per nudge (`nudge.acted_at`), validate email format on the share POST (`server/api/share/[token].post.ts:19-22`), and URI-encode the address in `composerUrl`. *(Done on `fix/audit-c1-h6`: atomic `acted_at` claim gates the advance; `utils/email.ts` validates on share POST + composer; `utils/composer.ts` URI-encodes the address. Tests: `actRoute`, `composer`, `email`.)*

### Medium
- [ ] **M1 — Client state into Pinia**: `useContacts`/`useProfile` are per-instance (`composables/useContacts.ts:24-26`, `useProfile.ts:13-15`) → duplicate fetches, stale reads, SSR+client double-fetch on every `/app` page. Move to stores (mirror `stores/auth.ts`), one loader keyed on `user.id`, `useAsyncData` for SSR.
- [ ] **M2 — SQL-side cron candidate selection**: `cron/nudge.ts:37-38` pulls full `profiles`/`contacts` tables then filters in JS (O(all rows) per hour). Push due/opt-out/pending-deletion predicates into one SQL query (uses the never-used `contacts_user_active_due` index); add a bare `nudges(sent_at)` index.
- [ ] **M3 — Rate-limit + validate the public surface**: `/api/waitlist`, `/api/share/:token`, and `/api/account/restore` (`server/api/account/restore.ts:7-19`) have no limits; restore also needs proof of email control (currently an enumeration oracle that can resurrect a deliberately-deleted account).
- [ ] **M4 — Quiet-hours drift**: `quiet_hours_start/end` columns exist but nothing reads them — `server/utils/localWindow.ts:13-15` hardcodes 09:00–21:00, no UI. Implement or delete the columns + update `decisions.md`.
- [ ] **M5 — Atomic share claim**: `server/api/share/[token].post.ts:12-38` is check-then-set; two concurrent claims both pass → duplicate contacts, one-time-use violated. `update shares set used_at = now() where id = :t and used_at is null returning *`, insert contact only on a returned row.
- [ ] **M6 — Decide the "acted" metric**: `acted_at` stamps on link *click*, not message *sent* (`act/[token].get.ts:53-56`) — inflates the headline nudge→sent metric. Decide semantics now (cheap pre-data), record in `decisions.md`, rename if it's really "composer opened".

### Low / hygiene (batch when convenient)
- [ ] **L — Cleanup batch**: dead exports (`duePerUser`, `useSupabaseUser`, `DEFAULT_QUIET_HOURS`, `ActPayload.digest` + its dead branch in `act/[token].get.ts:35-37`); identical ternary branches at `components/ContactCard.vue:111`; partial unique index on `profiles.phone`; `error.vue` shows "Page not found." for every error incl. 500s; CI never compiles `netlify/functions/*.mts` (add to `.github/workflows/ci.yml`); dev deps in `dependencies` (`package.json:16-31`) → move to `devDependencies`; `qrcode@1.5.4` is from 2018; note the missing `0002` migration in the migrations dir; `NUXT_PUBLIC_APP_URL` not set on Netlify (live act-links would point at `localhost:3000` — release-blocking).

### Done well — keep
RLS on every table (policies + enable in same migration, zero public policies on service tables), SMS opt-in/out + suppression enforced in code not just docs, never auto-sends, service-role client strictly server-side, HMAC-signed act-links with TTL + constant-time compare, no `v-html`/XSS vectors, domain logic centralized in `utils/` shared by server + client.

## Parked (do NOT start in Phase 1)
QR scan · LinkedIn attach · share-link capture · email/calendar · AI opener

## App UI redesign (2026-10-03)

- [x] Shared `components/ui/` primitives, icon tab bar, grouped queue (Due now / Later today / Upcoming) with one-tap Message, capture form with recent chips, editable quiet hours, restyled stats/auth/share. Spec: `project_docs/specs/2026-10-03-app-ui-redesign-design.md`. Plan: `project_docs/plans/2026-10-03-app-ui-redesign.md`.

