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
/404                 error.vue        not-found with home/login CTA
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
- `/share/:token` uses a bare full-screen layout (no marketing nav) so a stranger lands on a
  focused capture form, not a pitch.

## Guards & redirects

- `middleware/auth.ts` (exists, extended) — client-side guard; redirects to `/login` carrying a
  `redirect` query so post-auth returns to the intended `/app/*` page.
- `middleware/onboarding.ts` (new) — on `/app/*` except `/app/onboarding`: if signed in and
  profile incomplete (`!nudge_channel` or `!timezone`), navigate to `/app/onboarding`.
- `middleware/app.ts` (new) — thin wrapper registering both `auth` + `onboarding`; applied to all
  `/app/*` pages via one `definePageMeta`.
- Signed-in user visiting `/` → Home still loads, nav shows Open app + avatar.
- Post-auth confirm → `/app` (currently `/`). Post-add / post-edit → `/app`.
- Sign-out → `/`.
- `/share/:token` and `/act/:token` require no session.

### 301 redirects (`routeRules` in `nuxt.config.ts`)

| Old | New |
| --- | --- |
| `/contacts` | `/app` |
| `/add` | `/app/add` |
| `/settings` | `/app/settings` |
| `/stats` | `/app/stats` |
| `/contacts/:id/edit` | `/app/c/:id` |

Internal links updated too: `nudgeSender.ts` digest link → `/app`; act-link builder → `/act/:token`.

## Data model addition

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
- Claim happens exclusively in a server route using the service-role client (RLS intact):
  1. load share by token
  2. fail if `used_at` set or `expires_at < now()`
  3. validate body: email or phone present (mirror DB CHECK)
  4. insert contact for `user_id`
  5. stamp `used_at`
- Default expiry: 30 days.
- Signature: tokens are stored (opaque), not signed — no signing secret needed per token.
  Expiry/one-time semantics enforced in the DB row via server-side claim.

## Act link change

- Move handler from `server/api/act/index.ts` to `server/routes/act/[token].get.ts`.
- Same logic: `verifyActLink(token, secret)` → stamp `opened_at` on nudge → if digest, 302 to
  `/app`; else load contact, advance touchpoint, mark `acted_at`, 302 to prefilled
  `sms:`/`mailto:` composer.
- `utils/actLink.ts` `buildNudgeActLink` updated to emit `/act/<token>`.
- No page component; pure server redirect.

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
- **`/app/add/link`** — server generates token → shows `/share/<id>` URL + QR + copy button.
- **`/app/add/scan`** — placeholder copy + "Add by hand" link to `/app/add/manual`.
- **`/share/:token`** — minimal public page: prefilled how_met hint, fields name + how_met +
  email or phone (mirror DB CHECK), success state after POST.
- **`/pricing`** — single Free tier and "first 100" framing; Pro section marked coming-soon.
- **`/privacy` / `/terms`** — drafted for review; linked from login, footer, Settings.
- **`/error.vue`** — 404 with home/login CTA.

## Dependencies

- `qrcode` — QR rendering on Add → Link (generate data-URL server-side).

## Out of scope this pass

- Real badge-QR scanning (Phase 2; `/scan` is a placeholder fallback).
- LinkedIn attach / profile inference (never scraped).
- Billing / real Pro tier.
- Deep `/about` content (stub page only).

## Testing

Vitest additions (pure logic, no browser):
- Share-token claim guard: expired token rejected; used token rejected; valid token passes.
- Act-link builder emits `/act/<token>` format.
- Onboarding-completion predicate: `false` when no channel or no timezone.
- Keep existing ladder / `computeDue` tests green.

## Definition of done

Types pass, tests pass, RLS present on the `shares` table, no service-role key client-side,
old flat URLs 301 to new paths, 404 page present, `/app/*` guarded.