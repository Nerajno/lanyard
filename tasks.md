# TASKS — Lanyard (Phase 1)

Sequenced so you have a working nudge by end of week one. Check off in order.

## 0. Setup
- [x] Scaffold Nuxt 3 + TS + Tailwind + Pinia
- [x] Create Supabase project; add `.env` + `.env.example` *(project `ymmlysznstdguegylbjq` created; linked + migrations pushed)*
- [x] Wire Supabase client + auth (email magic link is fine)
- [x] Subscribe magic link + email/password + Google/Apple OAuth sign-in (smart form)
- [ ] Email provider account (Resend/Postmark) + verified sending domain *(build uses Resend; sign up + add key)*
- [ ] **Start Twilio A2P 10DLC registration now** — it takes days to weeks to approve and blocks all SMS. Email nudges cover the gap. *(build + Verify hooks are in place)*

## 1. Schema (see Architecture.md)
- [x] `profiles` table migration (phone, verified_at, nudge_channel, timezone, quiet_hours, opt-in/opt-out) *(applied to remote; `quiet_hours` → `quiet_hours_start`/`quiet_hours_end` smallint — overnight windows can't be an int4range)*
- [x] `contacts` table migration incl. `cadence_ladder int[]`, `touchpoints_done`, CHECK (email or phone)
- [x] `nudges` table migration
- [x] RLS policies (`user_id = auth.uid()`) for all CRUD on all three
- [x] `0003_custom_cadence`: `cadence_ladder` → `jsonb` `{value,unit}` rungs (`min`/`hour`/`day`), `follow_up_by` → `timestamptz`, new one-shot `remind_at`, supporting index — RLS unchanged (covered by existing policies) *(applied to remote)*
- [ ] Seed a couple rows for local testing *(removed — `0002_seed.sql` referenced a fake auth user that broke `db push`; seed via a real user or `supabase/seed.sql` for local only)*

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
- [x] "Who is due" query as a testable function (Vitest against fixtures)
- [x] Instant-based due: `computeDue` checks `follow_up_by`/`remind_at` against `now`, covering `min`/`hour`/`day` rungs
- [x] Sub-day nudges bypass the per-day cap (`shouldDeliverForUser` / `splitSubDay`); cron clears `remind_at` after its beat
- [ ] Twilio account + from-number; store secrets *(provision account; fill TWILIO_* + Verify SID)*
- [x] Email send path (provider SDK)
- [x] Signed act-link tokens (`ACT_LINK_SIGNING_SECRET`) — must work from a phone without a fresh login
- [x] Act route: stamp `opened_at`, open prefilled `sms:`/`mailto:`, mark touchpoint
- [x] Scheduled job (hourly): local send window + quiet hours → due query → 1 vs 2+ branch → channel branch → send
- [x] Insert `nudges` row per send; use it as the double-send guard
- [x] STOP/HELP webhook → set `sms_opted_out_at`, hard block sends

## 6. Dogfood
- [ ] Deploy (Netlify + Supabase) — *Supabase project exists + migrations pushed; Netlify side pending*
- [ ] Swap `vercel.json` for `netlify.toml` + `netlify/functions/nudge-cron.mts` (host decision changed; see decisions.md)
- [ ] Set `NUXT_PUBLIC_APP_URL` on Netlify — act-links are built from it
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

## Parked (do NOT start in Phase 1)
QR scan · LinkedIn attach · share-link capture · email/calendar · AI opener

