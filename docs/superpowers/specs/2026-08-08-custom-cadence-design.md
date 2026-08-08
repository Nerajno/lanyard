# Custom Nudges in Minutes, Hours, and Days — Design

**Status:** Approved (2026-08-08)
**Scope:** Phase 1 extension — per-rung mixed-unit cadence + one-shot quick nudge.
**Out of scope:** Sub-minute scheduling precision; anything that turns Lanyard into a CRM.

## Problem

Today `contacts.cadence_ladder` is an `int[]` of whole days and `follow_up_by` is a `date`.
Users can only schedule day-granular three-coffee rungs. There is no way to say
"nudge me about this contact in 30 minutes" or set a first rung of a few hours.

## Goals

- Ladder rungs can be **minutes, hours, or days** (mixed within one ladder).
- A **one-shot quick nudge** lets the user schedule a single reminder about a
  contact at an explicit offset (min/hour/day).
- Sub-day nudges deliver at the nearest hourly cron beat on/after their due instant
  (accepted latency: up to ~59 min late). The hourly Netlify cron stays as is.
- Sub-day nudges **bypass the per-user daily delivery cap**. Day rungs keep the cap.
- Quiet hours and the local send window gate **every** delivery, sub-day included.

## Decisions (from brainstorming)

1. **Both** finer ladder rungs and a one-shot quick nudge.
2. Sub-day nudges bypass the one-per-user-per-day cap.
3. Quick nudge is set via a **button** on the contact (one-shot: pick, fires once, gone).
4. Custom ladder input = **per-rung value + unit rows**.
5. **Nearest hour, keep hourly cron** — no infra change.
6. Ladder stored as a **value+unit struct array** (`jsonb`).
7. Quick nudges **respect quiet hours** always.
8. `follow_up_by` becomes a **timestamptz**, resolved to an exact instant at write.

## Approach (chosen)

Struct-based rungs (`jsonb` `{ value, unit }`) on the existing `cadence_ladder`
column. Resolve each rung to an exact `follow_up_by` timestamp at write time;
the hourly cron compares instants. Rejected alternatives: Postgres `interval[]`
(poor TS/Supabase ergonomics), and a faster 5-15 min scheduler (requires a paid
Netlify plan).

## Design

### 1. Data model

- `contacts.cadence_ladder` (int[] → jsonb): array of rungs
  `{ value: number, unit: 'min' | 'hour' | 'day' }`. Presets become day-rungs:
  warm `[{1,'day'},{7,'day'},{21,'day'}]`, default `[{2,'day'},{14,'day'},{45,'day'}]`,
  slow `[{7,'day'},{30,'day'},{90,'day'}]`.
- `contacts.follow_up_by` (date → timestamptz): exact next-nudge instant.
- `contacts.remind_at` (new, nullable timestamptz): the one-shot quick nudge.
  Fires once, then nulled. Never consumes a ladder rung and never changes
  `touchpoints_done`.
- Migration `0003_custom_cadence` (0001 already applied). Backfills existing
  `int[]` rows to day-rungs and converts `follow_up_by` dates preserving midnight
  UTC semantics. `remind_at` gets no new RLS (covered by existing contact
  select/update policies).

### 2. Cadence logic (`utils/cadence.ts`)

- `type LadderUnit = 'min' | 'hour' | 'day'`
- `type LadderRung = { value: number; unit: LadderUnit }`
- `type Ladder = LadderRung[]`
- `rungToMs(rung)` → milliseconds (DST-safe via UTC math, like existing
  `addDaysUtc`).
- `addToTimestamp(base, rung)` → exact timestamp.
- `resolveLadder(preset | 'custom', customLadder?)` returns `Ladder`; empty/invalid
  custom falls back to the default preset.
- `initialFollowUp(createdAt, ladder)` → `addToTimestamp(createdAt, ladder[0])`.
- `advanceTouchpoint(ladder, current, actedAt)` — same return shape
  (`{ touchpoints_done, follow_up_by } | null`), next rung = `actedAt + rungToMs(ladder[next])`.
- New `nextRung(ladder, touchpointsDone)` → the rung due after the current count, so
  the cron can test "is the next rung sub-day?" for the cap bypass.
- `snooze(followUpBy, days)` — unchanged (day-based).
- `daysUntil`, `urgencyOf`, `coffeeProgress` — keep signatures; feed them timestamps.

### 3. Cron delivery (`server/api/cron/nudge.ts`, `utils/due.ts`)

- `computeDue` becomes instant-based: due when `follow_up_by <= now` (timestamptz)
  OR `remind_at <= now`. Direct-vs-digest (`count === 1`) unchanged.
- For each user with a due set:
  - Split due contacts into **sub-day** (next rung is min/hour, or `remind_at` set)
    vs **day**.
  - Day contacts respect the existing 26h user-level double-send guard.
  - Sub-day contacts deliver even if the user was already nudged today (cap bypass).
  - Quiet hours / `shouldDeliverNow` gates everything (still `server/utils/localWindow`).
- On delivery of a contact via `remind_at`: null `remind_at` (update the row).
- Message builders (`nudgeSender.ts`) unchanged — direct inlines `how_met` + act-link;
  digest links to triage.
- `nudges` instrumentation row still inserted per send; remains the double-send guard.

### 4. Form & UI

- `components/ContactForm.vue` — Follow-up pace: preset chips remain
  (warm/default/slow). A **Custom** chip exposes three rung-row inputs, each a
  value + unit dropdown (min / hr / day). `customLadder` becomes `Ladder[]`.
  Validation: value ≥ 1, ≥ 1 rung; invalid/empty falls back to default preset.
- `components/ContactCard.vue` (and/or Add) — a **"Nudge me later"** button with a
  picker: 15 min / 1 hr / 4 hr / 1 day / custom. Sets `remind_at`, shows
  "Reminder set for <time>". One-shot.
- `composables/useContacts.ts` — add `remind(id, rung)` → update `remind_at`
  (`= now + rungToMs`).
- `pages/contacts/[id]/edit.vue` — reuses the same form; exposes rung inputs for an
  existing contact.

### 5. Tests

- `tests/unit/cadence.test.ts`: `rungToMs` for min/hour/day; `resolveLadder`
  preset expansion to day-rung structs + custom fallback; `initialFollowUp` /
  `advanceTouchpoint` on mixed-unit ladders; new `nextRung`.
- `tests/unit/due.test.ts` + `tests/fixtures/due.ts`: instant-based due; sub-day
  cap-bypass branching; day-rung cap respected; remind-through doesn't break
  direct/digest.
- Cron skip/branch logic kept in small pure helpers so the cap-bypass decision is
  unit-testable (no Twilio).

## Success criteria

- [ ] Mixed-unit ladders (e.g. `[2h, 1d, 3d]`) produce correct `follow_up_by`
      instants and advance correctly on touchpoint.
- [ ] Quick nudge (min/hr/day) fires once at first cron beat ≥ due, then clears
      `remind_at`, without touching the ladder.
- [ ] Delivering a sub-day nudge to a user already nudged today still goes out;
      day-rung nudges for the same user stay suppressed until the cap resets.
- [ ] No send during quiet hours for any unit.
- [ ] `npm run test`, `npm run lint`, `npx nuxi typecheck`, `npm run build` pass.
- [ ] Migration `0003` applies cleanly and preserves existing day data.

## Out of scope

Sub-minute scheduling, in-app realtime delivery, editable/cancellable quick nudges,
anything outside Phase 1 scope.