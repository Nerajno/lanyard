# Design — Lanyard Sitemap Buildout

Date: 2026-08-09 · Status: Approved

## Goal

Restructure the Nuxt app into the two-state sitemap: **signed-out (public/marketing)** and
**signed-in (the app under `/app`)**. Build every route in the sitemap, with guards, redirects,
token routes, and the full responsive app shell. Extend the existing design language
(paper/coral, Bricolage Grotesque, rounded cards) — no new visual system.

## Decisions (from brainstorming)

- **Scope:** full sitemap, all routes.
- **Design source:** extend current design language; no mockup files to match.
- **Share capture:** fully functional — signed `/share/:token` lets a stranger add their own
  details, which creates a contact for the sharer via a service-role server route (RLS untouched).
- **Share token model:** per-capture, expiring, one-time-use link generated from Add → Link.
- **Pricing:** all-free for now; Pro shown as a future tier.
- **Mobile nav:** full responsive shell — top nav ≥md, bottom tab bar on mobile, account menu in Settings.
- **Legal text:** drafted for review (privacy + terms required for A2P 10DLC).
- **Old flat URLs:** move + 301 redirects.
- **Stats:** kept at `/app/stats`.
- **Add sub-routes:** all three (`/scan` as fallback placeholder, `/link`, `/manual`).
- **Route architecture:** nested `pages/app/` directory.

## Route tree

### Public / marketing (no session)

```
/                    index.vue        landing (anchors renamed: #how-it-works / #three-coffees / #features)
/pricing             pricing.vue      single all-free tier + future Pro
/early-access        early-access.vue WaitlistForm
/login               login.vue        existing magic-link
/privacy             privacy.vue      drafted, reviewable
/terms               terms.vue        drafted, reviewable
/about               about.vue        build-in-public stub
404                  error.vue         at project root (not pages/) — renders home/login CTA
```

### Token routes (no session)

```
/share/:token        share/[token].vue   public capture — stranger adds name/how_met/email-or-phone
/act/:token          server/routes/act/[token].get.ts  pure server redirect (moved from /api/act?t=)
```

### Signed-in app (auth + onboarding guard)

```
/app/                app/index.vue    due/triage home; supports ?filter=graduated
/app/onboarding      app/onboarding.vue  first-run: phone, channel, opt-in, send window
/app/add             app/add/index.vue   3-way chooser (scan / link / manual)
/app/add/manual      app/add/manual.vue  existing ContactForm
/app/add/link        app/add/link.vue    generate per-capture share link + QR + copy
/app/add/scan        app/add/scan.vue    fallback placeholder → "add by hand"
/app/c/:id           app/c/[id].vue      detail: nudge status, edit, actions
/app/settings        app/settings.vue    appearance, channel, send window, account
/app/stats           app/stats.vue       kept
```

## Layouts

- `layouts/default.vue` — top-level public pages. Nav reads auth store: signed-out shows
  **Log in** / **Get early access**; signed-in shows **Open app** + avatar.
- `layouts/app.vue` — `/app/*`. Top nav on `≥md`; fixed bottom tab bar (Due / Add / Settings)
  on `<md`; account menu folded into Settings. Applied per-page via
  `definePageMeta({ layout: 'app' })` on every `/app/*` page.
- Onboarding uses a minimal variant of `app.vue` layout (no nav distractions).
- `/share/:token` uses `definePageMeta({ layout: false })` (full-screen, no marketing nav)
  so a stranger lands on a focused capture form, not a pitch.

## Guards & redirects

- `middleware/auth.ts` (exists, extended) — client-side guard; redirects to `/login?redirect=<path>`
  so post-auth returns to the intended `/app/*` page.
- `middleware/onboarding.ts` (new) — on `/app/*` except `/app/onboarding`: if signed in and
  `!profile.onboarded_at`, navigate to `/app/onboarding`. (Uses the new `onboarded_at` column
  — `nudge_channel`/`timezone` have DB defaults, so they can't signal "onboarded".)
- `middleware/app.ts` (new) — thin wrapper registering both `auth` + `onboarding`; applied to all
  `/app/*` pages via one `definePageMeta`.
- Signed-in user visiting `/` → Home still loads, nav shows Open app + avatar.
- Post-auth confirm → redirect target from the magic link (default `/app`), not `/`.
- Post-add / post-edit → `/app`.
- Sign-out → `/`.
- `/share/:token` and `/act/:token` require no session.

### Auth round-trip (redirect survives the magic link)

- `middleware/auth.ts` captures `?redirect=` when bouncing to `/login`.
- `stores/auth.ts signInWithEmail(email)` gains a `redirect?: string` param; it appends
  `&redirect=...` to `emailRedirectTo` so the magic link carries the target.
- `pages/auth/confirm.vue` reads `route.query.redirect`, defaulting to `/app`.

### Redirect table

| Old | New | Mechanism |
| --- | --- | --- |
| `/contacts` | `/app` | `routeRules` 301 |
| `/add` | `/app/add` | `routeRules` 301 |
| `/settings` | `/app/settings` | `routeRules` 301 |
| `/stats` | `/app/stats` | `routeRules` 301 |
| `/contacts/:id/edit` | `/app/c/:id` | Nitro handler — `routeRules` can't substitute params |

> `server/routes/contacts/[id]/edit.get.ts` — reads `[id]`, `sendRedirect` 301 to
> `/app/c/${id}`. (`routeRules` redirects support wildcards but not `:param` substitution
> into the target, so the parametrized edit path gets a tiny handler instead. It's the only
> one needing it.)

Internal links updated too: `nudgeSender.ts` digest link → `/app`; act-link builder → `/act/:token`.
`server/api/act/index.ts` digest branch redirects `/contacts` → `/app` (moved handler keeps it correct).

## Data model additions

### `profiles` gains `onboarded_at`

The onboarding guard can't use existing columns as the "complete" signal:
`nudge_channel` and `timezone` have DB defaults (`'email'`, `'UTC'`) and the
`handle_new_user` trigger auto-creates the profile row, so
`!nudge_channel || !timezone` is *always* false. Add an explicit flag:

```
profiles.onboarded_at timestamptz null   -- set by onboarding save; null = not onboarded
```

- Onboarding guard: signed-in user with `!profile.onboarded_at` and not on
  `/app/onboarding` → redirect to `/app/onboarding`.
- Settings save also sets `onboarded_at = now()` if it's null.
- Same migration, covered by the existing `profiles` RLS policies (no new policy).

### `shares` table

`shares` table (new migration):

```
id            text primary key          # random token, the /share/:token value
user_id       uuid not null ref auth.users
how_met_default text                    # optional hint prefilled on the capture page
expires_at    timestamptz not null
used_at       timestamptz null
created_at    timestamptz default now()
```

- RLS enabled. Owner (auth.uid()) can select/delete their own rows — same migration.
- Share **creation** (Add → Link) is an owner RLS insert — the authenticated user
  creates their own row, no service role involved.
- Claim happens in a **server route using the service-role client** (RLS intact):
  1. load share by token
  2. fail if `used_at` set or `expires_at < now()`
  3. validate body: email or phone present (mirror DB CHECK)
  4. insert contact for `user_id` with the **default ladder** and
     `follow_up_by = created_at + cadence_ladder[0]` (mirror `add` semantics —
     a share-created contact is a normal contact from the start)
  5. stamp `used_at`
- Default expiry: 30 days.
- Tokens are stored (opaque), not signed — no signing secret needed per token.
  Expiry/one-time semantics enforced in the DB row via server-side claim.

### Share capture endpoints (public, no session)

- `GET /api/share/:token` — public read used by the capture page: returns
  `{ valid, how_met_default }`. Validates existence + not-expired + not-used
  (service role). No user data leaked — only the `how_met_default` hint.
- `POST /api/share/:token` — the claim above. Returns the created contact or a
  `410 Gone` for expired/used tokens.

## Act link change

- Move handler from `server/api/act/index.ts` to `server/routes/act/[token].get.ts`.
- Same logic: `verifyActLink(token, secret)` → stamp `opened_at` on nudge → if digest, 302 to
  `/app`; else load contact, advance touchpoint, mark `acted_at`, 302 to prefilled
  `sms:`/`mailto:` composer.
- `utils/actLink.ts` `buildNudgeActLink` updated to emit `/act/<token>`.
- No page component; pure server redirect.
- Legacy compat: keep `server/api/act/index.ts` (or a thin redirect) so the old
  `/api/act?t=` links in any already-sent nudge still resolve — 302 to `/act/<token>`.

## Pages detail

- **`/app/index`** — existing contacts list, retitled to "Due"; honors `?filter=graduated`;
  header CTA → `/app/add`.
- **`/app/onboarding`** — reuses the Settings channel / SMS-opt-in / timezone form, extracted into
  a shared `NudgePrefsForm` component. On save → `/app`.
- **`/app/settings`** — same `NudgePrefsForm` plus appearance (theme) and account section
  (email, sign-out).
- **`/app/c/:id`** — contact detail: name, how_met, channel(s), ladder status (n/3), next due,
  actions (Follow up / Snooze / Remind / Edit / Archive / Delete). Uses existing `useContacts` hooks.
- **`/app/add/manual`** — existing `ContactForm`.
- **`/app/add/link`** — generates a `/share/<id>` token via owner RLS insert (adds the
  `shares` row with `expires_at = now()+30d`, optional `how_met_default`), shows URL + QR
  (`qrcode` renders client-side to a data URL) + copy button.
- **`/app/add/scan`** — placeholder copy + "Add by hand" link to `/app/add/manual`.
- **`/share/:token`** — minimal public page (bare layout): on mount `GET /api/share/:token` →
  invalid/expired shows a dead-link state; valid prefills `how_met` hint from `how_met_default`
  + fields name + how_met + email or phone (mirror DB CHECK), POSTs to the claim endpoint →
  success state.
- **`/pricing`** — single Free tier and "first 100" framing; Pro section marked coming-soon.
- **`/privacy` / `/terms`** — drafted for review; linked from login, footer, Settings.
- **`/error.vue`** — project-root error page; renders 404 with home/login CTA (and any other status).

## Dependencies

- `qrcode` — QR rendering on Add → Link (client-side to a data URL, no server round-trip).

## Out of scope this pass

- Real badge-QR scanning (Phase 2; `/scan` is a placeholder fallback).
- LinkedIn attach / profile inference (never scraped).
- Billing / real Pro tier.
- Deep `/about` content (stub page only).

## Testing

Vitest additions (pure logic, no browser):
- Share-token claim guard: expired token rejected; used token rejected; valid token passes;
  contact gets default ladder + first-rung `follow_up_by`.
- Act-link builder emits `/act/<token>` format.
- Onboarding-completion predicate: `false` when `onboarded_at` null.
- Keep existing ladder / `computeDue` tests green.

## Definition of done

Types pass, tests pass, RLS present on the `shares` table (`profiles.onboarded_at` covered by
existing profiles policies), no service-role key client-side,
old flat URLs 301 to new paths, 404 page present, `/app/*` guarded,
magic-link redirect round-trips, share capture claims once then dies.