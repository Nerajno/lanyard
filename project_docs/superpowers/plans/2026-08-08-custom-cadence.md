# Custom Cadence (Minutes/Hours/Days) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Lanyard schedule nudges at minute, hour, or day granularity per ladder rung, plus a one-shot quick nudge that fires once and clears itself.

**Architecture:** `contacts.cadence_ladder` becomes a `jsonb` array of `{ value, unit }` rungs and `follow_up_by` becomes a `timestamptz` so due checks are instant-based. The hourly cron splits due contacts into sub-day (min/hour bast / `remind_at`) vs day; sub-day deliveries bypass the per-user daily cap, day deliveries keep it. Quiet hours still gate everything.

**Tech Stack:** Nuxt 3 (Nitro server routes), Supabase (Postgres + RLS), Vitest, Tailwind. No new dependencies — uses the existing `Intl`-based `localWindow` and hand-rolled UTC math.

## Global Constraints

- RLS keyed on `auth.uid()` for all tables; never add a write that assumes a single user.
- Existing `contacts_ladder_positive` CHECK (`cardinality(cadence_ladder) > 0`) must keep validating `jsonb` (`cardinality()` works on `jsonb`).
- `cadence_ladder` default becomes `[{"value":2,"unit":"day"},{"value":14,"unit":"day"},{"value":45,"unit":"day"}]`.
- `follow_up_by` stays NOT NULL; `remind_at` nullable.
- Sub-day units are `'min'` and `'hour'`; day is `'day'`.
- Every delivery still passes `shouldDeliverNow(profile.timezone)`.
- Commands: test `npm run test`, lint `npm run lint`, typecheck `npx nuxi typecheck`, build `npm run build`, push migration `supabase db push`.
- **Do not auto-send** a follow-up: nudge always opens a prefilled composer; the user hits send. Quick nudge only *schedules* a nudge.

---

## Task 1: Ladder types + preset constants

**Files:**
- Modify: `types/index.ts`
- Modify: `types/database.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `LadderUnit`, `LadderRung`, `Ladder` (exported from `types/index.ts`); `LADDER_PRESETS` typed as `Record<'warm'|'default'|'slow', Ladder>`; Contact `Row`/`Insert`/`Update.remind_at`, `follow_up_by: string`, `cadence_ladder: Ladder`.

- [ ] **Step 1: Add ladder types to `types/index.ts`**

```ts
export type LadderUnit = 'min' | 'hour' | 'day'
export type LadderRung = { value: number; unit: LadderUnit }
export type Ladder = LadderRung[]
```

Then change the presets:

```ts
export const LADDER_PRESETS: Record<'warm' | 'default' | 'slow', Ladder> = {
  warm: [{ value: 1, unit: 'day' }, { value: 7, unit: 'day' }, { value: 21, unit: 'day' }],
  default: [{ value: 2, unit: 'day' }, { value: 14, unit: 'day' }, { value: 45, unit: 'day' }],
  slow: [{ value: 7, unit: 'day' }, { value: 30, unit: 'day' }, { value: 90, unit: 'day' }],
}
```

Import the new types:

```ts
import type { Ladder, LadderRung } from '~/types'
```

Ensure `Ladder` etc. are importable. The rest of `index.ts` is unchanged.

- [ ] **Step 2: Update `types/database.ts` Contacts shape**

```ts
contacts: {
  Row: {
    id: string
    user_id: string
    name: string
    how_met: string
    email: string | null
    phone: string | null
    cadence_ladder: Ladder
    touchpoints_done: number
    follow_up_by: string
    remind_at: string | null
    status: 'active' | 'graduated' | 'archived'
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    user_id: string
    name: string
    how_met: string
    email?: string | null
    phone?: string | null
    cadence_ladder?: Ladder
    touchpoints_done?: number
    follow_up_by: string
    remind_at?: string | null
    status?: 'active' | 'graduated' | 'archived'
  }
  Update: Partial<Database['public']['Tables']['contacts']['Insert']>
}
```

Import the type near the top: `import type { Ladder } from './index'`. Grep the repo for any remaining references to `cadence_ladder` as `number[]` (e.g. `types/database.ts` should be the only place) and update them.

- [ ] **Step 3: Run typecheck**

Run: `npx nuxi typecheck`
Expected: PASS (there will be cascading failures until Task 4 rewires `utils/cadence.ts`; if so mark expected and continue — the final commit must be green.)

- [ ] **Step 4: Commit**

```bash
git add types/index.ts types/database.ts
git commit -m "types: model cadence as {value,unit} ladder + remind_at"
```

---

## Task 2: Migration 0003 — jsonb ladder, timestamptz follow_up, remind_at

**Files:**
- Create: `supabase/migrations/0003_custom_cadence.sql`

**Interfaces:**
- Produces: DB columns `contacts.cadence_ladder jsonb`, `contacts.follow_up_by timestamptz`, `contacts.remind_at timestamptz`; existing rows backfilled to day-rung json and `follow_up_by` converted preserving UTC midnight.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_custom_cadence.sql`:

```sql
-- Custom cadence: rungs in minutes/hours/days + one-shot quick nudge.

-- cadence_ladder int[] -> jsonb (rung structs), preserving existing day data.
alter table public.contacts
  alter column cadence_ladder drop default;

alter table public.contacts
  alter column cadence_ladder type jsonb
  using (
    select coalesce(
      (select jsonb_agg(jsonb_build_object('value', v, 'unit', 'day') order by ord)
       from unnest(cadence_ladder) with ordinality as t(v, ord)),
      '[]'::jsonb
    )
  );

alter table public.contacts
  alter column cadence_ladder set default
    '[{"value":2,"unit":"day"},{"value":14,"unit":"day"},{"value":45,"unit":"day"}]'::jsonb;

-- follow_up_by date -> timestamptz, preserving midnight-UTC semantics for old rows.
alter table public.contacts
  alter column follow_up_by type timestamptz
  using (follow_up_by::timestamp at time zone 'UTC');

-- One-shot quick nudge; cleared when it fires. Covered by existing RLS.
alter table public.contacts
  add column if not exists remind_at timestamptz;

create index if not exists contacts_user_active_remind
  on public.contacts (user_id, status, remind_at);

comment on column public.contacts.cadence_ladder is 'Rungs {value,unit} in min|hour|day.';
comment on column public.contacts.remind_at is 'One-shot quick nudge; cleared after it fires.';
```

- [ ] **Step 2: Apply to the linked project**

Run: `supabase db push`
Expected: migration `0003` applies; old rows converted (`cadence_ladder` as `jsonb`, `follow_up_by` as `timestamptz`), `remind_at` column created.

- [ ] **Step 3: Add a migration unit-check (optional but recommended)**

Invoke `supabase db push` output to confirm no errors. No code tests cover the migration; rely on `db push` + an eyeball of `supabase/migration list`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_custom_cadence.sql
git commit -m "feat(schema): store cadence as min/hour/day rungs + remind_at"
```

---

## Task 3: Pure cadence logic

**Files:**
- Modify: `utils/cadence.ts`
- Test: `tests/unit/cadence.test.ts`

**Interfaces:**
- Consumes: `LadderUnit`, `LadderRung`, `Ladder`, `LADDER_PRESETS` from `~/types`.
- Produces (exact signatures):
  - `rungToMs(rung: LadderRung): number`
  - `addToTimestamp(base: Date | string | number, rung: LadderRung): Date`
  - `resolveLadder(preset: LadderPreset | 'custom', custom?: Ladder): Ladder`
  - `initialFollowUp(createdAt: string | Date, ladder: Ladder): string` — full ISO instant, NOT `YYYY-MM-DD`
  - `advanceTouchpoint(ladder: Ladder, current: number, actedAt: string | Date): { touchpoints_done: number; follow_up_by: string } | null`
  - `nextRung(ladder: Ladder, touchpointsDone: number): LadderRung | null`
  - `snooze(followUpBy: string | Date, days = 3): string`
  - `daysUntil(date: string | Date, from?: Date | string): number`
  - `urgencyOf(date: string | Date, status: string, now?: Date | string): Urgency`
  - `coffeeProgress(ladder: Ladder, touchpointsDone: number): number`
  - `presetOf(ladder: Ladder): LadderPreset | 'custom'`
  - `formatRung(rung: LadderRung): string` (e.g. `"2d"`, `"30m"`, `"4h"`)
  - `formatLadder(ladder: Ladder): string` (join with ` / `)

`LadderPreset` = `keyof typeof LADDER_PRESETS`.

- [ ] **Step 1: Write the failing tests first**

Append to `tests/unit/cadence.test.ts` (add `LADDER_PRESETS` to imports from `~/types`):

```ts
import { LADDER_PRESETS } from '~/types'
describe('rungToMs / addToTimestamp', () => {
  it('converts each unit to ms', () => {
    expect(rungToMs({ value: 30, unit: 'min' })).toBe(30 * 60_000)
    expect(rungToMs({ value: 2, unit: 'hour' })).toBe(2 * 3_600_000)
    expect(rungToMs({ value: 14, unit: 'day' })).toBe(14 * 86_400_000)
  })
  it('adds to a base timestamp exactly', () => {
    const base = new Date('2026-08-08T10:00:00Z')
    expect(addToTimestamp(base, { value: 30, unit: 'min' }).toISOString()).toBe('2026-08-08T10:30:00.000Z')
    expect(addToTimestamp(base, { value: 2, unit: 'hour' }).toISOString()).toBe('2026-08-08T12:00:00.000Z')
    expect(addToTimestamp(base, { value: 1, unit: 'day' }).toISOString()).toBe('2026-08-09T10:00:00.000Z')
  })
})

describe('resolveLadder', () => {
  it('expands presets to day-rung structs', () => {
    expect(resolveLadder('warm')).toEqual([{ value: 1, unit: 'day' }, { value: 7, unit: 'day' }, { value: 21, unit: 'day' }])
  })
  it('keeps a valid custom ladder', () => {
    expect(resolveLadder('custom', [{ value: 2, unit: 'hour' }, { value: 1, unit: 'day' }]))
      .toEqual([{ value: 2, unit: 'hour' }, { value: 1, unit: 'day' }])
  })
  it('falls back to default for empty/invalid custom', () => {
    expect(resolveLadder('custom', [])).toEqual(LADDER_PRESETS.default)
    expect(resolveLadder('custom', [{ value: 0, unit: 'day' }])).toEqual(LADDER_PRESETS.default)
  })
  it('created + first rung (30 min)', () => {
    expect(initialFollowUp('2026-08-08T10:00:00Z', [{ value: 30, unit: 'min' }, { value: 1, unit: 'day' }])).toBe('2026-08-08T10:30:00.000Z')
  })
  it('created + first rung (2 hours)', () => {
    expect(initialFollowUp('2026-08-08T10:00:00Z', [{ value: 2, unit: 'hour' }, { value: 1, unit: 'day' }])).toBe('2026-08-08T12:00:00.000Z')
  })
})

describe('advanceTouchpoint — mixed units', () => {
  it('rung 0 -> 1 with an hour rung', () => {
    const ladder = [{ value: 2, unit: 'hour' }, { value: 1, unit: 'day' }, { value: 3, unit: 'day' }]
    const next = advanceTouchpoint(ladder, 0, '2026-08-08T12:00:00Z')!
    expect(next.touchpoints_done).toBe(1)
    expect(next.follow_up_by).toBe('2026-08-09T12:00:00.000Z') // +1 day from acted instant
  })
  it('graduates on exhausting the ladder', () => {
    expect(advanceTouchpoint([{ value: 2, unit: 'hour' }, { value: 1, unit: 'day' }], 1, '2026-08-08T12:00:00Z')).toBeNull()
  })
})

describe('nextRung', () => {
  const ladder = [{ value: 30, unit: 'min' }, { value: 2, unit: 'hour' }, { value: 3, unit: 'day' }]
  it('returns the rung due after the current count', () => {
    expect(nextRung(ladder, 0)).toEqual({ value: 30, unit: 'min' })
    expect(nextRung(ladder, 1)).toEqual({ value: 2, unit: 'hour' })
    expect(nextRung(ladder, 2)).toEqual({ value: 3, unit: 'day' })
    expect(nextRung(ladder, 3)).toBeNull()
  })
})

describe('snooze / daysUntil / urgencyOf on instants', () => {
  it('snoozes an instant 3 days', () => {
    expect(snooze('2026-08-08T10:00:00Z')).toBe('2026-08-11T10:00:00.000Z')
  })
  it('daysUntil handles ISO instants', () => {
    expect(daysUntil('2026-08-08T23:00:00Z', '2026-08-06T00:00:00Z')).toBe(2)
  })
  it('urgencyOf buckets by instant', () => {
    expect(urgencyOf('2026-08-05T00:00:00Z', 'active', '2026-08-06T00:00:00Z')).toBe('due')
  })
})

describe('presetOf / formatLadder', () => {
  it('detects a preset ladder', () => {
    expect(presetOf(LADDER_PRESETS.warm)).toBe('warm')
    expect(presetOf([{ value: 2, unit: 'hour' }])).toBe('custom')
  })
  it('formats rungs', () => {
    expect(formatRung({ value: 30, unit: 'min' })).toBe('30m')
    expect(formatRung({ value: 4, unit: 'hour' })).toBe('4h')
    expect(formatRung({ value: 3, unit: 'day' })).toBe('3d')
    expect(formatLadder([{ value: 1, unit: 'day' }, { value: 7, unit: 'day' }])).toBe('1d / 7d')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm run test`
Expected: FAIL (functions missing / types broken).

- [ ] **Step 3: Implement `utils/cadence.ts`**

Replace the whole file with:

```ts
// Pure cadence logic for the "three cups of coffee" ladder.
// No IO — unit-tested in Vitest (see tests/unit/cadence.test.ts).

import type { Ladder, LadderPreset, LadderRung } from '~/types'
import { LADDER_PRESETS } from '~/types'

export type { Ladder, LadderRung, LadderPreset } from '~/types'

/** Deterministic UTC day number for a Date or date string. */
function utcDayNumber(input: Date | string | number): number {
  return Math.floor(asInstant(input) / 86_400_000)
}

/** Parse any accepted date input to an epoch millisecond. */
export function asInstant(input: Date | string | number): number {
  if (input instanceof Date) return input.getTime()
  if (typeof input === 'number') return input
  const t = Date.parse(input)
  if (Number.isNaN(t)) throw new Error(`Invalid date: ${input}`)
  return t
}

/** Days in milliseconds. */
const DAY_MS = 86_400_000

/** Millisecond equivalent of a rung (value in min/hour/day). */
export function rungToMs(rung: LadderRung): number {
  switch (rung.unit) {
    case 'min': return rung.value * 60_000
    case 'hour': return rung.value * 3_600_000
    case 'day': return rung.value * DAY_MS
  }
}

/** Add a rung's duration to a base time; returns a Date. DST-safe because we operate in absolute UTC ms. */
export function addToTimestamp(base: Date | string | number, rung: LadderRung): Date {
  return new Date(asInstant(base) + rungToMs(rung))
}

export type LadderPreset = keyof typeof LADDER_PRESETS

/** Resolve a preset or raw custom ladder into a normalized Ladder. */
export function resolveLadder(preset: LadderPreset | 'custom', custom?: Ladder): Ladder {
  if (preset !== 'custom') return [...LADDER_PRESETS[preset]]
  if (custom && custom.some((x) => Number.isFinite(x.value) && x.value > 0)) {
    return custom.filter((x) => Number.isFinite(x.value) && x.value > 0)
  }
  return [...LADDER_PRESETS.default]
}

/** follow_up_by for a *new* contact: created instant + first rung. */
export function initialFollowUp(createdAt: Date | string, ladder: Ladder): string {
  return addToTimestamp(createdAt, ladder[0] ?? { value: 2, unit: 'day' }).toISOString()
}

/**
 * Advance after a touchpoint is marked done.
 * Returns the new contact edge values, or null when the contact graduates.
 */
export function advanceTouchpoint(
  ladder: Ladder,
  current: number,
  actedToday: Date | string,
): {
  touchpoints_done: number
  follow_up_by: string
} | null {
  if (ladder.length === 0) return null
  const next = current + 1
  if (next >= ladder.length) return null
  return { touchpoints_done: next, follow_up_by: addToTimestamp(actedToday, ladder[next]).toISOString() }
}

/** The rung due after `touchpointsDone` completed contacts, or null when graduated. */
export function nextRung(ladder: Ladder | undefined, touchpointsDone: number): LadderRung | null {
  if (!ladder?.length) return null
  const rung = ladder[touchpointsDone]
  return rung ?? null
}

/** Snooze: push follow_up_by forward `days` days. Ladder position unchanged. */
export function snooze(followUpBy: string | Date, days = 3): string {
  return new Date(asInstant(followUpBy) + days * DAY_MS).toISOString()
}

/** Whole-day count from `from` to `date` (positive = future). */
export function daysUntil(date: Date | string, from: Date | string = new Date()): number {
  return utcDayNumber(date) - utcDayNumber(from)
}

export type Urgency = 'due' | 'close' | 'fresh' | 'graduated'

export function urgencyOf(date: Date | string, status: string, now: Date | string = new Date()): Urgency {
  if (status === 'graduated') return 'graduated'
  const d = daysUntil(date, now)
  if (d < 0) return 'due'
  if (d <= 2) return 'close'
  return 'fresh'
}

/** Coffee progress out of three. */
export function coffeeProgress(ladder?: Ladder, touchpointsDone = 0): number {
  const total = Math.max(ladder?.length ?? 0, 3)
  return Math.min(Math.max(touchpointsDone, 0), total)
}

/** Detect which preset a ladder is, else 'custom'. */
export function presetOf(ladder: Ladder | undefined): LadderPreset | 'custom' {
  if (!ladder) return 'custom'
  for (const key of Object.keys(LADDER_PRESETS) as LadderPreset[]) {
    if (JSON.stringify(ladder) === JSON.stringify(LADDER_PRESETS[key])) return key
  }
  return 'custom'
}

/** Short rung label, e.g. 2h / 30m / 3d. */
export function formatRung(rung: LadderRung): string {
  const letter = { min: 'm', hour: 'h', day: 'd' }[rung.unit]
  return `${rung.value}${letter}`
}

/** Human ladder string, e.g. "2d / 14d / 45d". */
export function formatLadder(ladder: Ladder): string {
  return ladder.map(formatRung).join(' / ')
}
```

**Tip for the implementer:** keep the file TDD-light — the test file above is the contract. Watch the circular import (`~/types` ↔ `~/utils/cadence`); put `Ladder` types in `types/index.ts` and import them real (`import type` suffices) to avoid runtime cycles. In `coffeeProgress` accept either `Ladder` or legacy `number[]` by using `Array.isArray` plus length.

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: cadence tests pass.

- [ ] **Step 5: Typecheck**

Run: `npx nuxi typecheck` (may still show cascading errors from `due`/UI until Tasks 4-6; confirm this file is clean and record remaining as expected.)

- [ ] **Step 6: Commit**

```bash
git add utils/cadence.ts tests/unit/cadence.test.ts
git commit -m "feat(cadence): support min/hour/day rungs"
```

---

## Task 4: Instant-based due + cap-bypass helpers

**Files:**
- Modify: `utils/due.ts`
- Modify: `tests/fixtures/due.ts`
- Test: `tests/unit/due.test.ts`

**Interfaces:**
- Consumes: none beyond existing; relies on contact objects carrying `remind_at`.
- Produces:
  - `DueContact` extends `{ remind_at?: string | null; unitHint?: 'min' | 'hour' | 'day' }`
  - `computeDue(contacts: DueContact[], now: Date | string): DueResult` — instant-based.
  - `hasSubDayDue(due: DueContact[]): boolean`
  - `splitSubDay(due: DueContact[]): { subDay: DueContact[]; day: DueContact[] }`

- [ ] **Step 1: Update fixtures**

```ts
export const TODAY = '2026-08-06T00:00:00Z'

export const fixtureContacts = [
  { id: 'c-overdue', follow_up_by: '2026-08-03T00:00:00Z', status: 'active', unitHint: 'day' },
  { id: 'c-today', follow_up_by: '2026-08-06T00:00:00Z', status: 'active', unitHint: 'day' },
  { id: 'c-remind', follow_up_by: '2026-09-01T00:00:00Z', status: 'active', remind_at: '2026-08-06T00:00:00Z', unitHint: 'day' },
  { id: 'c-tomorrow', follow_up_by: '2026-08-07T00:00:00Z', status: 'active', unitHint: 'day' },
  { id: 'c-graduated', follow_up_by: '2026-07-01T00:00:00Z', status: 'graduated', unitHint: 'day' },
  { id: 'c-archived', follow_up_by: '2026-07-15T00:00:00Z', status: 'archived', unitHint: 'day' },
  { id: 'c-subhour', follow_up_by: '2026-08-05T12:00:00Z', status: 'active', unitHint: 'hour' },
  { id: 'c-submin', follow_up_by: '2026-08-05T12:30:00Z', status: 'active', unitHint: 'min' },
]
```

- [ ] **Step 2: Write failing tests**

```ts
import { computeDue, hasSubDayDue, splitSubDay } from '~/utils/due'
import { TODAY, fixtureContacts } from '../fixtures/due'

describe('computeDue — instant-based', () => {
  it('picks active contacts with any due instant <= now', () => {
    const { due } = computeDue(fixtureContacts, TODAY)
    const ids = due.map((c) => c.id)
    // due-by-follow_up: c-overdue, c-today, c-subhour, c-submin; due-by-remind_at: c-remind
    expect(ids).toContain('c-overdue')
    expect(ids).toContain('c-today')
    expect(ids).toContain('c-subhour')
    expect(ids).toContain('c-submin')
    expect(ids).toContain('c-remind')
    expect(ids).not.toContain('c-tomorrow')
    expect(ids).not.toContain('c-graduated')
    expect(ids).not.toContain('c-archived')
  })

  it('direct=true for exactly one due', () => {
    const one = [
      { id: 'c-a', follow_up_by: '2026-08-03T00:00:00Z', status: 'active', unitHint: 'day' },
      { id: 'c-b', follow_up_by: '2026-08-07T00:00:00Z', status: 'active', unitHint: 'day' },
    ]
    const r = computeDue(one, '2026-08-06T00:00:00Z')
    expect(r.count).toBe(1)
    expect(r.direct).toBe(true)
  })
})

describe('hasSubDayDue / splitSubDay', () => {
  it('detects sub-day items via unitHint or remind_at', () => {
    expect(hasSubDayDue(fixtureContacts)).toBe(true)
    expect(hasSubDayDue([{ id: 'x', follow_up_by: '2026-08-01T00:00:00Z', status: 'active', unitHint: 'day' }])).toBe(false)
  })
  it('splits into subDay vs day', () => {
    const { subDay, day } = splitSubDay([
      { id: 'a', follow_up_by: '2026-08-01T00:00:00Z', status: 'active', unitHint: 'hour' },
      { id: 'b', follow_up_by: '2026-08-01T00:00:00Z', status: 'active', unitHint: 'day' },
    ])
    expect(subDay.map((c) => c.id)).toEqual(['a'])
    expect(day.map((c) => c.id)).toEqual(['b'])
  })
})
```

- [ ] **Step 3: Implement `utils/due.ts`**

```ts
import type { LadderUnit } from '~/types'

export type DueContact = {
  id: string
  follow_up_by: string
  status: string
  remind_at?: string | null
  unitHint?: LadderUnit
}

export interface DueResult {
  due: DueContact[]
  direct: boolean
  count: number
}

export function computeDue(contacts: DueContact[], now: Date | string): DueResult {
  const base = new Date(now).getTime()
  const due = contacts
    .filter((c) => c.status === 'active')
    .filter((c) => new Date(c.follow_up_by).getTime() <= base || (c.remind_at != null && new Date(c.remind_at).getTime() <= base))
    .sort((a, b) => a.follow_up_by.localeCompare(b.follow_up_by))
  return { due, direct: due.length === 1, count: due.length }
}

/** True when any due contact has a min/hour rung or a pending remind_at. */
export function hasSubDayDue(due: DueContact[]): boolean {
  return due.some((c) => c.remind_at != null || (c.unitHint ?? 'day') !== 'day')
}

/** Split due contacts into sub-day (bypass cap) vs day (respect cap). */
export function splitSubDay(due: DueContact[]): { subDay: DueContact[]; day: DueContact[] } {
  const subDay = due.filter((c) => c.remind_at != null || (c.unitHint ?? 'day') !== 'day')
  const day = due.filter((c) => !subDay.includes(c))
  return { subDay, day }
}

export function duePerUser(
  candidates: { user_id: string; contacts: DueContact[]; inWindow: boolean }[],
  now: Date | string,
): { user_id: string; result: DueResult }[] {
  return candidates
    .filter((c) => c.inWindow)
    .map((c) => ({ user_id: c.user_id, result: computeDue(c.contacts, now) }))
    .filter((r) => r.result.count > 0)
}
```

**Implementer tip:** `new Date(now).getTime()` fails if `now` is an invalid string; the fixture `TODAY` is always ISO, and cron passes `new Date().toISOString()`. Guard with the `asInstant` helper from `utils/cadence.ts` for safety if desired.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: due suite passes.

- [ ] **Step 5: Commit**

```bash
git add utils/due.ts tests/fixtures/due.ts tests/unit/due.test.ts
git commit -m "feat(due): instant-based due + sub-day cap-bypass split"
```

---

## Task 5: Cron + service — honor the cap bypass and clear `remind_at`

**Files:**
- Modify: `server/api/cron/nudge.ts`
- Modify: `server/services/nudgeSender.ts`
- Test: `tests/unit/due.test.ts` (add pure decision helper test here or a new `tests/unit/cronGuard.test.ts`)

**Interfaces:**
- Consumes: `computeDue`, `hasSubDayDue`, `splitSubDay` (Task 4); `nextRung` (Task 3); `shouldDeliverNow` (existing).
- Produces: cron skip decision: `shouldDeliverForUser(alreadySentToday: boolean, due: DueContact[]): boolean` added to `utils/due.ts` (pure, tested).

- [ ] **Step 1: Add the pure guard to `utils/due.ts`**

```ts
/** True only when we must deliver despite the daily cap (sub-day due present). */
export function shouldDeliverForUser(alreadySentToday: boolean, due: DueContact[]): boolean {
  if (!alreadySentToday) return true
  return hasSubDayDue(due)
}
```

Add tests (import `shouldDeliverForUser` from `~/utils/due` at the top of the test file):

```ts
it('allows delivery normally', () => {
  expect(shouldDeliverForUser(false, [{ id: 'x', follow_up_by: '2026-08-01T00:00:00Z', status: 'active', unitHint: 'day' }])).toBe(true)
})
it('suppresses day deliver after send', () => {
  const day = [{ id: 'x', follow_up_by: '2026-08-01T00:00:00Z', status: 'active', unitHint: 'day' }]
  expect(shouldDeliverForUser(true, day)).toBe(false)
})
it('bypasses cap for sub-day/remind after send', () => {
  const sub = [{ id: 'x', follow_up_by: '2026-08-01T00:00:00Z', status: 'active', unitHint: 'hour' }]
  expect(shouldDeliverForUser(true, sub)).toBe(true)
  const remind = [{ id: 'y', follow_up_by: '2026-09-01T00:00:00Z', status: 'active', remind_at: '2026-08-01T00:00:00Z', unitHint: 'day' }]
  expect(shouldDeliverForUser(true, remind)).toBe(true)
})
```

- [ ] **Step 2: Rewire the cron route**

In `server/api/cron/nudge.ts`, replace the per-user loop logic so that:

```ts
const due = computeDue(contacts, today) // today = new Date().toISOString()
if (due.count === 0) continue

const alreadySent = sentToday.has(profile.user_id)
// null-out remind_at for any due contact that triggered via remind_at
if (!shouldDeliverForUser(alreadySent, due.due)) {
  summary[profile.user_id] = { due: due.count, skipped: 'daily-cap' }
  continue
}

// When user already sent today, only sub-day contacts go out.
const deliverable = alreadySent ? splitSubDay(due.due).subDay : due.due
const deliverResult = {
  due: deliverable,
  count: deliverable.length,
  direct: deliverable.length === 1,
}
const { sent, skipped } = await deliverNudges(profile, contactsById, deliverResult)

// Single-shot: clear remind_at for every delivered contact that used it.
const remindFired = deliverable.filter((d) => d.remind_at != null).map((d) => d.id)
if (remindFired.length > 0) {
  await admin.from('contacts').update({ remind_at: null }).in('id', remindFired)
}
```

Pass `today` as ISO string into `computeDue`, and update `nudgeSender.deliverNudges` to accept the same `{ due, count, direct }` shape (it already does — only the timing of `today` changes to instant). Keep the existing `shouldDeliverNow(profile.timezone)` gate **before** the due/deliver logic.

**Implementer note:** `computeDue` takes a `DueResult`-compatible object from the cron. If `contacts` are full `Contact` rows, map them:

```ts
const dueContacts: DueContact[] = contacts.map((c) => ({
  id: c.id,
  follow_up_by: c.follow_up_by,
  status: c.status,
  remind_at: c.remind_at,
  unitHint: nextRung(c.cadence_ladder, c.touchpoints_done)?.unit ?? 'day',
}))
```

Use `contactsById` for message composition as today.

- [ ] **Step 3: Confirm `nudgeSender` clears gracefully**

The single-line change is in how `remind_at` is handled: `deliverNudges` currently inserts a `nudges` row for the whole send; keep that. No message-builder changes (direct inlines `how_met`; digest links to triage).

The cron route is the caller — keep `deliverNudges(profile, contactsById, due)` and pass the filtered deliverable.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: the new guard tests + existing pass.

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx nuxi typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add utils/due.ts server/api/cron/nudge.ts server/services/nudgeSender.ts tests/unit/due.test.ts
git commit -m "feat(cron): deliver sub-day nudges bypassing daily cap; clear remind_at"
```

---

## Task 6: `useContacts` — reminders & updated payloads

**Files:**
- Modify: `composables/useContacts.ts`
- Test: `tests/unit/useContacts.test.ts` (render composable logic via the pure cadence functions only; no Vitest DOM)

**Interfaces:**
- Consumes: `rungToMs`, `addToTimestamp`, `resolveLadder`, `initialFollowUp`, `advanceTouchpoint`, `Ladder`, `LadderRung`, `LadderPreset` from Task 3.
- Produces: `remindContact(id: string, rung: LadderRung): Promise<void>` updates `remind_at` to `now + rungToMs(rung)`.

- [ ] **Step 1: Update `add` to build JSON ladder + instant**

In `composables/useContacts.ts`, replace the ladder/follow-up computation:

```ts
const ladder = resolveLadder(input.ladderPreset, input.customLadder as Ladder)
const payload: InsertContact = {
  user_id: auth.user.id,
  name: input.name.trim(),
  how_met: input.how_met.trim(),
  email: input.email?.trim() || null,
  phone: input.phone?.trim() || null,
  cadence_ladder: ladder,
  follow_up_by: initialFollowUp(new Date().toISOString(), ladder),
}
```

- [ ] **Step 2: Add `remindContact`**

```ts
async function remindContact(id: string, rung: LadderRung): Promise<void> {
  if (!auth.user) throw new Error('You must be signed in')
  const contact = contacts.value.find((c) => c.id === id)
  if (!contact) return
  await update(id, { remind_at: addToTimestamp(new Date(), rung).toISOString() })
}
```

Export it from the returned object. Update the composable return to include `remindContact`.

- [ ] **Step 3: Adjust `markFollowedUp`/`snoozeContact` for instants**

`markFollowedUp` currently calls `advanceTouchpoint(contact.cadence_ladder, contact.touchpoints_done, new Date())` — the ladder is now `Ladder`, which `advanceTouchpoint` accepts. `snoozeContact` passes a `follow_up_by` string that is now an ISO instant — `snooze()` handles Date/string input in Task 3. Verify no `.slice(0,10)` assumptions on `follow_up_by` (list page will need that from Task 8).

- [ ] **Step 4: Export the new API, lint/typecheck**

Run: `npm run lint && npx nuxi typecheck`
Expected: green for these files.

- [ ] **Step 5: Commit**

```bash
git add composables/useContacts.ts
git commit -m "feat(contacts): add remindContact + instant follow-up payloads"
```

---

## Task 7: `ContactForm.vue` — per-rung unit inputs + custom chip

**Files:**
- Modify: `components/ContactForm.vue`

**Interfaces:**
- Consumes: `Ladder`, `LadderRung`, `LadderUnit`, `LADDER_PRESETS`, `presetOf`, `formatLadder`.
- Produces: emits `submit(values: ContactFormValues)` where `customLadder: Ladder`.

- [ ] **Step 1: Extend `ContactFormValues` + reactive defaults**

```ts
import type { Ladder, LadderRung } from '~/types'
// in the interface:
customLadder: Ladder

const form = reactive<ContactFormValues>({
  // ...
  ladderPreset: props.initial?.ladderPreset ?? 'default',
  customLadder: props.initial?.customLadder ?? [
    { value: 1, unit: 'day' },
    { value: 7, unit: 'day' },
    { value: 21, unit: 'day' },
  ],
})
```

`customLadder` no longer accepts `number[]`. Keep the presets list derived from `LADDER_NAMES`.

- [ ] **Step 2: Add a Custom chip + rung rows to the template**

After the preset buttons grid, add:

```html
<button type="button" class="..." :class="..." @click="form.ladderPreset = 'custom'">
  Custom
  <span class="block text-xs ...">{{ customSummary }}</span>
</button>
```

When `form.ladderPreset === 'custom'`, render up to 3 rung rows:

```html
<div v-if="form.ladderPreset === 'custom'" class="mt-3 space-y-2">
  <div v-for="(rung, i) in form.customLadder" :key="i" class="flex items-center gap-2">
    <input
      v-model.number="form.customLadder[i].value"
      type="number"
      min="1"
      class="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
    >
    <select v-model="form.customLadder[i].unit" class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
      <option value="min">min</option>
      <option value="hour">hours</option>
      <option value="day">days</option>
    </select>
    <button type="button" @click="removeRung(i)" class="text-sm text-red-600">Remove</button>
  </div>
  <button v-if="form.customLadder.length < 3" type="button" @click="addRung()" class="text-sm text-slate-500 hover:text-slate-700">
    + Add rung
  </button>
</div>
```

- [ ] **Step 3: Add script helpers**

```ts
const customSummary = computed(() => (form.ladderPreset === 'custom' ? formatLadder(form.customLadder) : ''))

function addRung() {
  if (form.customLadder.length >= 3) return
  form.customLadder.push({ value: 1, unit: 'day' })
}
function removeRung(i: number) {
  if (form.customLadder.length <= 1) return
  form.customLadder.splice(i, 1)
}
```

Validation in `onSubmit` uses `form.customLadder.length > 0` (fallback handled in template via `resolveLadder`).

**Note for the implementer:** the existing `ContactFormValues.ladderPreset` union accepts `'custom'` already. When initializing from a contact, `ladderPreset` can be derived from `presetOf(contact.cadence_ladder)` (consumer passes a fully-formed `initial` object — add `initial.ladderPreset` and `initial.customLadder` from the edit page, see Task 8).

- [ ] **Step 4: Lint/typecheck and commit**

```bash
git add components/ContactForm.vue
git commit -m "feat(contact-form): custom rung rows with value+unit"
```

---

## Task 8: Quick-nudge button + edit page support

**Files:**
- Modify: `components/ContactCard.vue`
- Modify: `pages/contacts/index.vue`
- Modify: `pages/contacts/[id]/edit.vue`
- (Optionally) Modify: `pages/add.vue`

**Interfaces:**
- Consumes: `remindContact` from `useContacts` (Task 6); `formatRung` from Task 3; `presetOf` from Task 3.
- Produces: a `Remind` event from `ContactCard`; handler wires it in index.

- [ ] **Step 1: ContactCard — add a "Nudge me later" control**

In `components/ContactCard.vue`, inside the active actions, add:

```html
<button class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50" @click="showRemind = !showRemind">
  Nudge me later
</button>
```

And a small inline picker when `showRemind`:

```html
<div v-if="showRemind" class="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 p-2">
  <button v-for="opt in remindOptions" :key="opt.label" type="button"
    class="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-200"
    @click="$emit('remind', opt.rung)">
    {{ opt.label }}
  </button>
</div>
```

Script additions:

```ts
const props = defineProps<{ contact: Contact }>()
// add optional remindAt display if you want the set-confirmation. Use formatRung to build reminder text.
const showRemind = ref(false)

const remindOptions = [
  { label: '15 min', rung: { value: 15, unit: 'min' } },
  { label: '1 hr', rung: { value: 1, unit: 'hour' } },
  { label: '4 hr', rung: { value: 4, unit: 'hour' } },
  { label: '1 day', rung: { value: 1, unit: 'day' } },
]
```

Add `remind: [contact: Contact, ...` to defineEmits.

- [ ] **Step 2: Wire in `contacts/index.vue`**

```ts
const { contacts, loading, error, markFollowedUp, snoozeContact, archive, remove, remindContact } = useContacts()

async function onRemind(c: Contact) {
  // prompt: quick picker already in card; here just call composable
}
```

**Simplest robust flow:** the card emits `remind` with a `LadderRung`. The page maps:

```html
@remind="onRemind(contact, $eventDto)"
```

```ts
async function onRemind(c: Contact, rung: LadderRung) {
  await run(remindContact(c.id, rung))
}
```

Import `LadderRung` type from `~/types`.

- [ ] **Step 3: Edit page — initialize from contact**

`pages/contacts/[id]/edit.vue` `initial` computation must now provide `ladderPreset` + `customLadder`:

```ts
const initial = computed<Partial<ContactFormValues> | null>(() => {
  if (!contact.value) return null
  return {
    name: contact.value.name,
    how_met: contact.value.how_met,
    email: contact.value.email,
    phone: contact.value.phone,
    ladderPreset: presetOf(contact.value.cadence_ladder),
    customLadder: contact.value.cadence_ladder,
  }
})
```

And in `onSubmit`, pass `customLadder: values.customLadder` and `cadence_ladder: resolveLadder(values.ladderPreset, values.customLadder)` to `update`.

`remove`/`edit` path unchanged otherwise; verify `resolveLadder` returns what `update` writes.

- [ ] **Step 4: Lint/typecheck**

Run: `npm run lint && npx nuxi typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/ContactCard.vue pages/contacts/index.vue pages/contacts/[id]/edit.vue
git commit -m "feat(ui): quick-nudge button and edit-page rung support"
```

---

## Task 9: Contact list day-bucket display + urgency instant

**Files:**
- Modify: `components/ContactCard.vue` (prune `daysUntil` `.slice` assumptions)
- Modify: `pages/contacts/index.vue` (day-bucket rendering for triage)

**Interfaces:**
- Consumes: `daysUntil`, `urgencyOf` from Task 3; `formatLadder` for the coffee label.

- [ ] **Step 1: Use instants in the list**

`pages/contacts/index.vue` active sort now compares full ISO timestamps — `localeCompare` still works. Keep it.

In `ContactCard`, `urgencyOf(props.contact.follow_up_by, props.contact.status)` now receives an ISO instant — Task 3's `urgencyOf` handles it. `coffeeProgress` unchanged.

- [ ] **Step 2: Show a friendly due string**

Add a computed near the card that renders "Due in Xd" or "Due <instant>", e.g.:

```ts
const dueLabel = computed(() => {
  if (!props.contact.follow_up_by) return ''
  const d = daysUntil(props.contact.follow_up_by)
  if (d < 0) return 'Due'
  if (d === 0) return 'Due today'
  return `In ${d}d`
})
```

Template: after the name/how_met, add small text: `{{ dueLabel }}`.

- [ ] **Step 3: Typecheck + lint + commit**

```bash
git add components/ContactCard.vue pages/contacts/index.vue
git commit -m "feat(ui): list instants for due display"
```

---

## Task 10: Documentation, full verification, final commit

**Files:**
- Modify: `Architecture.md`, `decisions.md`, `tasks.md`, `README.md` (if it documents ladder/presets)

**Interfaces:**
- None new.

- [ ] **Step 1: Update `Architecture.md`**

- `cadence_ladder` row: `jsonb` `{value,unit}` rungs (min/hour/day), presets as day-rungs.
- `follow_up_by` row: `timestamptz`.
- New `remind_at` row: one-shot quick nudge.
- §The reminder loop: note the instant-based due check + sub-day cap bypass.

- [ ] **Step 2: Update `decisions.md`**

Add a decision (newest first): "Cadence is min/hour/day+rungs; sub-day nudges bypass the per-day cap; quick nudge is a one-shot `remind_at` that respects quiet hours and never consumes a rung."

- [ ] **Step 3: Update `tasks.md`**

Tick any completed items; add the new feature row in "Schema" and "Build" sections.

- [ ] **Step 4: Full verification**

```bash
npm run test
npm run lint
npx nuxi typecheck
npm run build
```

Expected: all green. Fix any stragglers.

- [ ] **Step 5: Push the applied migration (if not already)**

```bash
supabase migration list
supabase db push  # already applied Task 2; re-run to confirm clean state
```

- [ ] **Step 6: Commit**

```bash
git add Architecture.md decisions.md tasks.md README.md
git commit -m "docs: custom cadence minutes/hours/days"
```

---

## Self-review notes

- **Instant type drift:** every `follow_up_by` producer/consumer in the codebase (composables, cron, ContactCard, edit page, tests/fixtures) is touched by Tasks 3-9. Check `slice(0,10)` anywhere — only `startOfDay` will remain day-bucket.
- **Cap bypass semantics:** the daily cap only gates *day* rungs; sub-day always delivers (Task 5). The `today` double-send guard (`since = now - 26h`) stays; only `shouldDeliverForUser` decides the exception.
- **remind_at never touches the ladder**: `remindContact` writes `remind_at` only; `nudgeSender` doesn't increment anything; cron clears it after the beat. Graduation is unaffected.