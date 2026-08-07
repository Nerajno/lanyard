# TASKS — Lanyard (Phase 1)

Sequenced so you have a working nudge by end of week one. Check off in order.

## 0. Setup
- [x] Scaffold Nuxt 3 + TS + Tailwind + Pinia
- [ ] Create Supabase project; add `.env` + `.env.example` *(code + example done; create the project and paste keys)*
- [x] Wire Supabase client + auth (email magic link is fine)
- [ ] Email provider account (Resend/Postmark) + verified sending domain *(build uses Resend; sign up + add key)*
- [ ] **Start Twilio A2P 10DLC registration now** — it takes days to weeks to approve and blocks all SMS. Email nudges cover the gap. *(build + Verify hooks are in place)*

## 1. Schema (see Architecture.md)
- [x] `profiles` table migration (phone, verified_at, nudge_channel, timezone, quiet_hours, opt-in/opt-out)
- [x] `contacts` table migration incl. `cadence_ladder int[]`, `touchpoints_done`, CHECK (email or phone)
- [x] `nudges` table migration
- [x] RLS policies (`user_id = auth.uid()`) for all CRUD on all three
- [x] Seed a couple rows for local testing

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

## 5. The nudge (core — don't skip to polish before this works)
- [x] "Who is due" query as a testable function (Vitest against fixtures)
- [ ] Twilio account + from-number; store secrets *(provision account; fill TWILIO_* + Verify SID)*
- [x] Email send path (provider SDK)
- [x] Signed act-link tokens (`ACT_LINK_SIGNING_SECRET`) — must work from a phone without a fresh login
- [x] Act route: stamp `opened_at`, open prefilled `sms:`/`mailto:`, mark touchpoint
- [x] Scheduled job (hourly): local send window + quiet hours → due query → 1 vs 2+ branch → channel branch → send
- [x] Insert `nudges` row per send; use it as the double-send guard
- [x] STOP/HELP webhook → set `sms_opted_out_at`, hard block sends

## 6. Dogfood
- [ ] Deploy (Netlify + Supabase) — *needs your Netlify + Supabase accounts*
- [ ] Swap `vercel.json` for `netlify.toml` + `netlify/functions/nudge-cron.mts` (host decision changed; see decisions.md)
- [ ] Set `NUXT_PUBLIC_APP_URL` on Netlify — act-links are built from it
- [ ] Add real people from your next event — *human action*
- [x] Track from `nudges`: median nudge→act latency, % acted on, % reaching all three coffees — *see `/api/stats` + `/stats` page*

## Parked (do NOT start in Phase 1)
QR scan · LinkedIn attach · share-link capture · email/calendar · AI opener

