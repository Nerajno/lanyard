# Architecture — Lanyard

## Stack
- **Frontend:** Nuxt 3 / Vue 3 (`<script setup>`, TS), Pinia, Tailwind.
- **Backend:** Supabase — Postgres, Auth, Row-Level Security, Scheduled Edge Functions (pg_cron).
- **SMS:** Twilio. **Email:** Resend (decided — see decisions.md).
- **Host:** Netlify (frontend + Nitro server routes, `netlify` Nitro preset) + Supabase managed.
- **Scheduler:** Netlify Scheduled Function → hits the Nitro cron route hourly. Hourly is available on Netlify's free tier; Vercel Hobby caps cron at daily, which would break the local-send-window requirement.
- Multi-tenant from day one via RLS.

## Data model (Phase 1)

`profiles` — where the nudge goes. Without this the loop has no recipient.
| col | type | notes |
|---|---|---|
| user_id | uuid pk | FK → auth.users, RLS key |
| phone | text | E.164, nullable until verified |
| phone_verified_at | timestamptz | |
| email | text | mirrored from auth.users |
| nudge_channel | text | `sms` \| `email` \| `both` |
| timezone | text | IANA, e.g. `America/New_York` |
| quiet_hours | int4range | local hours to suppress sends |
| sms_opt_in_at | timestamptz | required before any SMS |
| sms_opted_out_at | timestamptz | set by STOP webhook; hard block on sends |

`contacts`
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | FK → auth.users, RLS key |
| name | text | required |
| how_met | text | used verbatim in the nudge |
| email | text | required unless `phone` set |
| phone | text | required unless `email` set |
| cadence_ladder | int[] | default `{2,14,45}` — the three coffees |
| touchpoints_done | int | default 0; 3 = graduated |
| follow_up_by | date | initial `created_at + ladder[1]`; on advance `today + ladder[touchpoints_done + 1]` |
| status | text | `active` \| `graduated` \| `archived` |
| created_at | timestamptz | default now() |

`CHECK (email is not null or phone is not null)` — every contact must be reachable, or its nudge is dead on arrival.

`nudges` — instrumentation for the one metric that matters.
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | RLS key |
| contact_ids | uuid[] | 1 = direct nudge, >1 = digest |
| channel | text | `sms` \| `email` |
| sent_at | timestamptz | |
| opened_at | timestamptz | act-link clicked |
| acted_at | timestamptz | touchpoint marked done |
| provider_message_id | text | Twilio SID / email id, for delivery debugging |

Latency = `acted_at - sent_at`. Impossible to backfill, so write it from day one. (See decisions.md open item on digest latency attribution when `contact_ids` > 1.)

RLS: `user_id = auth.uid()` on select/insert/update/delete, all three tables.

Later cols (P2/P3, all nullable): `title`, `company`, `event_name`, `socials jsonb` (`{linkedin, github, x, site}`), `photo_url`, `note`, `follow_up_reason` (what to actually do next — the field that makes the nudge actionable), `source` (manual/badge_qr/link), `opener_draft`.

Social handles → `socials jsonb` (or a `contact_socials` child table); one column per platform doesn't scale. Manual capture requires `name` + `how_met` + one of email/phone; everything above is optional and best filled from a badge vCard or the share-link, not typed at a booth.

## The reminder loop (core)
A **Netlify Scheduled Function** (`netlify/functions/nudge-cron`, `schedule = "@hourly"`) calls the Nitro route `/api/cron/nudge` with the shared `NUXT_CRON_SECRET`. Hourly, not daily — it must hit each user's local send window. The Nitro route holds all the logic so it stays testable and reuses the same pure `utils/`; the Netlify function is a thin trigger.

Netlify scheduled functions are not HTTP-invocable in production, which is a feature here: the schedule is the only production trigger, and `NUXT_CRON_SECRET` guards the route against anything else.

Per run:
1. `select` users whose local time is inside their send window and outside `quiet_hours`, not opted out.
2. For each, `select * from contacts where user_id = ? and status='active' and follow_up_by <= today`.
3. Branch on count: **1 due** → direct message with `name` + `how_met` + act-link. **2+ due** → digest ("3 due today") + triage-list link.
4. Branch on `nudge_channel` → Twilio or the email provider.
5. Insert a `nudges` row with `sent_at`, `channel`, `contact_ids`, `provider_message_id`. This row is also the double-send guard: skip anyone with a `nudges` row today.

Fallback if Netlify scheduling is fiddly: any external cron (GitHub Actions, crontab) POSTs the same route with `x-cron-secret`. No code change — only the trigger differs.

## Key flows
- **Add:** form → validate at least one of email/phone → insert row, `follow_up_by = created_at + cadence_ladder[1]`.
- **Nudge:** scheduled fn → Twilio or email (above).
- **Act:** act-link (signed, single-purpose token so it works from a phone without a fresh login) → stamps `nudges.opened_at`, opens `sms:<phone>?&body=…` or `mailto:<email>?subject=…&body=…` prefilled, and marks the touchpoint: `touchpoints_done += 1`, `acted_at` stamped. If `touchpoints_done < 3` → `follow_up_by = today + cadence_ladder[touchpoints_done + 1]`; if `= 3` → `status = 'graduated'`, nudging stops.
- **Snooze:** `follow_up_by += 3d`, ladder position unchanged.
- **Triage list:** active contacts `order by follow_up_by asc`, urgency color from days-until-due; separate graduated section — visible proof the loop worked.

## Later (tagged)
- **P2 capture:** public share-link page (unauth insert via RLS policy or edge fn). QR scanner parses payload and branches: **vCard** → autofill all fields; **URL** (LinkedIn / attendee profile) → store URL, prompt for name; **opaque ID** (paid lead-retrieval badges) → store raw value, manual fallback. Rule: autofill when parseable, always allow manual. No dependency on any event platform API.
- **P3 AI opener:** edge function → LLM with `how_met` → returns draft; store `opener_draft`, feed it into the composer body. Draft-only first (see decisions.md).

## Secrets
Names carry a `NUXT_` prefix because that is the only thing Nuxt maps onto `runtimeConfig` in `nuxt.config.ts`: `NUXT_PUBLIC_*` → `runtimeConfig.public.*` (client-visible), bare `NUXT_*` → server-only. An unprefixed name resolves to `''` at runtime with no error.

Client-visible: `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`, `NUXT_PUBLIC_APP_URL` (origin for act-links; falls back to `http://localhost:3000`).

Server only: `NUXT_SUPABASE_SERVICE_ROLE`, `NUXT_TWILIO_SID`, `NUXT_TWILIO_TOKEN`, `NUXT_TWILIO_FROM`, `NUXT_TWILIO_VERIFY_SID`, `NUXT_EMAIL_API_KEY`, `NUXT_EMAIL_FROM`, `NUXT_ACT_LINK_SIGNING_SECRET`, `NUXT_CRON_SECRET`.

Canonical list + comments in `.env.example`; in production these live in Netlify → Site configuration → Environment variables.
