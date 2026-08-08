# Lanyard — conference follow-up nudger

Three touchpoints — the **three cups of coffee** rule. Capture a contact, get a
timed nudge (SMS or email), act in one tap, then the contact **graduates**. Not a
CRM by design. See `prd.md`, `Architecture.md`, `decisions.md`, `tasks.md`.

---

## Stack

- **Frontend:** Nuxt 3 / Vue 3 (`<script setup lang="ts">`), Pinia, Tailwind
- **Backend/DB:** Supabase (Postgres, Auth, RLS, storage of nudges)
- **SMS:** Twilio · **Email:** Resend
- **Host:** Netlify (frontend + Nitro server routes) · **DB:** Supabase managed
- **Scheduling:** the nudge loop is a Nitro route (`/api/cron/nudge`) triggered
  hourly by a **Netlify Scheduled Function**. All logic lives in the route so it
  reuses the tested pure `utils/` and Node crypto in one layer; the scheduled
  function is a thin trigger. Any external cron can drive the same route.

## Getting started

```bash
npm install
cp .env.example .env   # then fill it in
npm run dev             # http://localhost:3000
```

Commands: `npm run dev` · `npm run test` (Vitest) · `npm run lint` ·
`npx nuxi typecheck` · `npm run build`

---

## Provisioning checklist (do these once)

These are the external accounts and credentials the app needs. **Secrets only
live in environment variables — never in code, never in the client bundle.**

### 1. Supabase (data + auth)
1. Create a project at https://supabase.com.
2. Run the migrations, in order, in the SQL editor:
   - `supabase/migrations/0001_initial_schema.sql` (tables + RLS + trigger)
   - `supabase/migrations/0002_seed.sql` (optional local seed rows)
   - (Or `supabase db push` with a linked project.)
3. Grab **Project URL** and the **anon** key from Project → Settings → API.
4. Regenerate typed tables for the client:
   ```bash
   npx supabase login
   npx supabase gen types typescript --project-id <project-ref> > types/database.ts
   ```
   (The committed `types/database.ts` is hand-maintained to match the schema;
   regenerate and overwrite it once your project exists, then drop the
   hand-written file. The schema is deliberate, so the types won't drift.)

### 2. Email (Resend) — the fallback channel that works today
1. Sign up at https://resend.com, add a verified sending domain.
2. Copy the API key. No A2P approval needed — email nudges work immediately.

### 3. Twilio (SMS + phone verification) — starts slow, start NOW
1. **Start A2P 10DLC brand + campaign registration immediately** — it takes
   days to weeks to approve and blocks real SMS delivery. Email covers the gap.
2. Create a messaging service / from-number → `TWILIO_FROM`.
3. Create a **Verify** service → `TWILIO_VERIFY_SID` (used for the one-time
   code in onboarding).
4. Webhook URL for STOP/HELP → point your Twilio inbound/status webhook at
   `https://<your-site>.netlify.app/api/twilio/sms-status`.

### 4. Generate the secrets
```bash
openssl rand -hex 32   # ACT_LINK_SIGNING_SECRET (HMAC-key for act-links)
openssl rand -hex 32   # CRON_SECRET (protects the scheduled nudge endpoint)
```

### Fill `.env`
Keep the `NUXT_` prefixes. Nuxt maps env vars onto `runtimeConfig` in
`nuxt.config.ts` by that prefix alone — `NUXT_PUBLIC_*` become
`runtimeConfig.public.*` (shipped to the browser), bare `NUXT_*` stay
server-only. An unprefixed name is read by nothing and the value silently
stays `''` at runtime.

```
NUXT_PUBLIC_SUPABASE_URL=
NUXT_PUBLIC_SUPABASE_ANON_KEY=
NUXT_PUBLIC_APP_URL=http://localhost:3000
NUXT_SUPABASE_SERVICE_ROLE=     # server-only; NEVER in the client bundle
NUXT_TWILIO_SID=
NUXT_TWILIO_TOKEN=
NUXT_TWILIO_FROM=
NUXT_TWILIO_VERIFY_SID=
NUXT_EMAIL_API_KEY=             # Resend
NUXT_EMAIL_FROM=
NUXT_ACT_LINK_SIGNING_SECRET=
NUXT_CRON_SECRET=
```

---

## Deploy

### Netlify
1. Push to GitHub, then **Add new site → Import an existing project** on Netlify.
   Nuxt is auto-detected (Nitro builds with the `netlify` preset); build command
   `npm run build`, publish directory `dist`.
2. Set every env var from the list above in **Site configuration → Environment
   variables**, names verbatim. `NUXT_SUPABASE_SERVICE_ROLE`, `NUXT_CRON_SECRET`,
   and `NUXT_ACT_LINK_SIGNING_SECRET` are server-only — never move them under
   `NUXT_PUBLIC_`, which would ship them in the client bundle.
3. Set `NUXT_PUBLIC_APP_URL` to your real site URL. The act-links in every nudge
   are built from it; if it's wrong or missing, links point at `localhost:3000`.
4. The hourly trigger is a **Netlify Scheduled Function** —
   `netlify/functions/nudge-cron.mts`, which POSTs `/api/cron/nudge` with
   `x-cron-secret`. Declare the schedule in `netlify.toml`:
   ```toml
   [functions."nudge-cron"]
     schedule = "@hourly"
   ```
   Hourly, since the loop respects each user's local send window. Scheduled
   functions run on the **free tier** — this is why Netlify over Vercel, whose
   Hobby plan caps cron at once per day.
5. Point the Twilio inbound/status webhook at
   `https://<your-site>/api/twilio/sms-status`.

**Testing the schedule:** Netlify scheduled functions are not HTTP-invocable in
production (by design — `CRON_SECRET` guards the route against everything else).
Locally use `netlify functions:invoke nudge-cron`, or call the route directly:

```bash
curl -f -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/nudge
```

### Fallback: GitHub Actions / crontab
If Netlify scheduling gives trouble, drive the same route from anywhere. No code
change — only the trigger differs:
```bash
curl -f -X POST -H "x-cron-secret: $CRON_SECRET" https://<your-site>/api/cron/nudge
```

---

## How the loop works (Architecture.md §The reminder loop)

1. `/api/cron/nudge` runs hourly: fans out over users whose local time is inside
   their send window, not opted out.
2. For each, computes **"who is due"** (`follow_up_by <= today`, active) via
   `utils/due.ts`.
3. Branches: **1 due → direct** message inlining `how_met` + a one-tap act-link;
   **2+ due → digest** linking to the triage list.
4. Branches on channel (`sms`/`email`/`both`) → Twilio or Resend, scoped by your
   `sms_opt_in_at` / `sms_opted_out_at` settings.
5. Inserts a `nudges` row per send (the double-send guard + latency instrument).
6. **Act**: the signed link calls `/api/act?t=…` on a phone with no fresh login,
   stamps `opened_at`, marks the touchpoint (advance rung or graduate), then
   302s to a prefilled `sms:` / `mailto:` composer. Lanyard never sends the
   follow-up for you.
7. **STOP/HELP** → `/api/twilio/sms-status` sets `sms_opted_out_at` and hard-blocks.

The one metric: **median(nudge → act)** = `nudges.acted_at - nudges.sent_at`,
queryable directly from the `nudges` table. It can't be backfilled, so it's
written from day one.

---

## Testing

- **Vitest**: 30 unit tests covering the ladder rung-advance (1→2→3, graduation
  on 3, custom ladders, snooze doesn't consume a rung), the due query against
  fixtures, and act-link signing/verification. `npm run test`.
- **Lint / type**: `npm run lint` · `npx nuxi typecheck`.
- The pure logic (`utils/`) is deliberately IO-free so the core behavior is
  tested against fixtures before any provider (Twilio/Resend) is wired.

## Structure

```
pages/            routes: add, contacts, settings, login, auth/confirm
components/       UI (ContactCard, ContactForm)
composables/      useContacts, useProfile, useSupabase, useAuth
stores/           Pinia (auth)
utils/            cadence, due, actLink (pure logic, tested)
server/           api/act, api/cron/nudge, api/profile/phone, api/twilio/sms-status
server/services/  nudgeSender (Twilio + Resend)
supabase/         migrations (0001 schema+RLS, 0002 seed)
types/            database.ts + domain aliases
tests/            unit + fixtures
```

## Guardrails (from AGENTS.md)

- Never auto-send a follow-up; the act-link opens a prefilled composer.
- No SMS without `sms_opt_in_at`, or with `sms_opted_out_at` set.
- Every table has RLS keyed on `auth.uid()`; add RLS in the same migration as a
  table.
- Service-role key is server-only, never in the client bundle.
- Not a CRM — reject scope that turns it into one.
- LinkedIn: store the URL, ask for the name; never scrape.
```