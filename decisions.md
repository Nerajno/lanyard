# DECISIONS — Lanyard

ADR-lite. Newest first. When an open question closes, move it up as a decision.

## Decided
- **Cadence is min/hour/day rungs; sub-day nudges bypass the per-day cap; quick nudge is a one-shot `remind_at`.** `cadence_ladder` is `jsonb` `{value, unit}` rungs; presets stay day-rungs. `follow_up_by` is a `timestamptz` instant, so a 30-minute rung lands on an absolute time. The per-day cap (a `nudges` row from the last 26h) only gates *day* rungs: `shouldDeliverForUser` always delivers sub-day due. The "Nudge me later" quick nudge is a one-shot `remind_at` column that flows through the same hourly cron (so quiet hours apply), is cleared after a beat, and never consumes a rung or affects graduation.
- **Host = Netlify.** Frontend + Nitro server routes on Netlify, Supabase managed alongside. Closes the earlier "Vercel/Netlify" hedge. Practical upside: **Netlify Scheduled Functions run hourly on the free tier**, whereas Vercel's Hobby plan caps cron at once per day — and the nudge loop must run hourly to hit each user's local send window. Choosing Vercel would have meant paying for Pro or degrading the core loop.
- **Email sender = Resend.** Chosen for the P1 email path (the fallback channel while 10DLC registration is pending). Closes the earlier Resend-vs-Postmark question.
- **Quiet hours = user-configurable.** Captured at onboarding as a per-profile local send window; `quiet_hours` is a per-user range, not a fixed 9am default. The extra onboarding step is worth not texting people at 3am.
- **Three cups of coffee.** Three touchpoints turn a contact into a connection; then it graduates and stops nudging. Gives the recurrence a stop condition, and it's a rule a user can repeat out loud — which makes the product legible.
- **Cadence = recurring ladder, not a flat repeat.** `cadence_ladder int[]` default `{2,14,45}` days. Three equal gaps waste the early window when they still remember you. Presets: warm `{1,7,21}` / default `{2,14,45}` / slow `{7,30,90}` / custom. Array means per-contact custom needs no schema change.
- **"Followed up" = archive, not delete.** Forced by recurrence — the row has to survive to carry `touchpoints_done`. `status` is `active | graduated | archived`; per-cycle "done" is an increment, not a status.
- **Nudge channel = SMS or email, user preference.** `profiles.nudge_channel`. Email also covers the gap while 10DLC registration is pending.
- **Act = prefilled composer, P1 never auto-sends.** Act-link opens `sms:`/`mailto:` with a draft on the contact's captured channel. Avoids sender-identity and deliverability problems, and keeps the P1 build small.
- **Contact needs one reachable channel.** `name` + `how_met` + (email OR phone), enforced by a DB CHECK. A contact with neither produces a dead nudge, which breaks the core metric.
- **Batching: 1 due → direct, 2+ due → digest.** Direct message inlines `how_met` and keeps the one-tap path on ordinary days; digest caps cost and mute risk after a conference. Straight digest-always was rejected because it adds two taps to the metric the PRD calls *the* metric.
- **Instrument nudge→act latency from day one** via a `nudges` table. The PRD names latency as the one metric; self-report can't see it and it can't be backfilled.
- **Backend = Supabase** (Postgres + Auth + RLS + scheduled functions). One managed platform covers data, auth, and the cron nudge. Frontend stays Nuxt/Vue.
- **SMS = Twilio.** Text is the primary nudge channel per product intent.
- **Multi-tenant (RLS) from day one.** Cheap now, painful to retrofit; keeps Phase 2 open without a rewrite.
- **Nudge, not CRM.** Deliberately narrow scope is the wedge and the sanity guard.
- **Conference-specific wedge first.** General engine underneath, one use case marketed on top. Generalize only after the loop is proven.
- **LinkedIn QR = attach link + confirm name.** Code only carries a URL; scraping violates ToS. Structured data comes from own share-link/vCard path.
- **AI opener = paid differentiator (P3).** Generated from `how_met`; also a degree/portfolio artifact.
- **Free for first 100 (P2)** as an acquisition + feedback hook, with founding-user perks. Validates retention, not willingness to pay.
- **Phasing:** personal/portfolio → free MicroSaaS → paid/retoolable. Gate = behavior retention.
- **Capture fields.** Required at manual capture: `name` (+ `how_met`). Optional rails: title, company, email, phone, socials, event_name, photo, note. Rich data comes from badge vCard / share-link, not booth typing.
- **Badge QR = parse-and-fallback.** Codes vary (vCard / profile URL / opaque lead-retrieval ID). Autofill from vCard or URL; store raw + manual otherwise. No event-platform API dependency.
- **Social handles = `socials jsonb`,** not a column per platform.

## Open (decide before/at the relevant milestone)
- **Digest latency attribution.** A `nudges` row can cover 2+ contacts but carries one `acted_at`, and post-conference digests dominate exactly when latency matters most — so the headline metric goes fuzzy in the highest-volume window. Decide: stamp `acted_at` on first act, or split a digest send into per-contact `nudges` rows for clean per-contact latency. Cheap to fix before there's data, expensive after.
- **Can a graduated contact be re-armed for a fourth coffee?** Manual re-arm is trivial to add but reopens the infinite-queue problem the three-coffees rule exists to close.
- **AI opener → draft-only or draft-and-send?** Draft-only is low-risk; sending touches tone + Twilio permissions.
- **Name.** "Lanyard" is a placeholder.
