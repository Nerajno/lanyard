# AGENTS.md — Lanyard

Guidance for AI coding agents (Claude Code, Cursor, etc.) working in this repo.

## What this is
A conference follow-up nudger. Capture a contact, get a timed nudge (SMS or email), act in one tap. Three touchpoints — the "three cups of coffee" rule — then the contact graduates. **Not a CRM** — reject scope that turns it into one. See [prd.md](prd.md).

## Stack & conventions
- Nuxt 3 + Vue 3, `<script setup lang="ts">` only. Composition API, no Options API.
- Pinia for state; composables for reusable logic (`useContacts`, `useNudge`).
- Tailwind for styling; no component CSS files.
- Supabase client for data; **every table has RLS** keyed on `auth.uid()`. Never write a query that assumes a single user without RLS.
- Server logic in Nitro routes (`server/api/`) or Supabase edge functions.

## Commands
- Dev: `npm run dev`
- Test: `npm run test` (Vitest)
- Lint/typecheck: `npm run lint` / `npx nuxi typecheck`
- Build: `npm run build`

## Structure
- `pages/` — routes (list, add). `components/` — UI. `composables/` — logic.
- `stores/` — Pinia. `server/api/` — Nitro. `supabase/` — schema.sql, functions, migrations.

## Rules
- Each new plan (feature/fix work) goes on its own branch — never commit directly to `main`. Create a branch per plan, and finish the branch before starting the next plan.
- Before opening or updating a PR, present a concise summary of the changes (what, why, files touched, verification) and wait for the user's explicit approval.
- Phase 1 only unless told otherwise (see PRD scope). Don't build QR/LinkedIn/AI opener/calendar yet.
- **Never scrape LinkedIn** or infer profile data from a LinkedIn URL — store the URL, ask the user for the name.
- A nudge targeting a **single** contact must include `how_met` verbatim. Digests (2+ due) link to triage instead. Keep the received→sent path one tap.
- **Never auto-send a follow-up on the user's behalf.** The act-link opens a prefilled `sms:`/`mailto:` composer; the user hits send.
- Every contact needs at least one of `email`/`phone` — enforced by DB CHECK, mirror it in form validation.
- Never send SMS to a user without `sms_opt_in_at` set, or with `sms_opted_out_at` set.
- Any new table → add RLS in the same migration.
- Secrets via env only; service-role key never ships to the client.

## Testing
- Vitest unit tests for composables, the due-calculation logic, and the ladder advance (rung 1→2→3, graduation on 3, snooze doesn't consume a rung).
- Test the "who is due" query against fixtures before wiring Twilio.

## Definition of done (a task)
Types pass, tests pass, RLS present on new tables, no service-role key client-side.
