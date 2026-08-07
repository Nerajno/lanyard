// Pure cadence logic for the "three cups of coffee" ladder.
// No IO — unit-tested in Vitest (see tests/unit/cadence.test.ts).

import { LADDER_PRESETS } from '~/types'

export type LadderPreset = keyof typeof LADDER_PRESETS

/** Day-add without drifting across DST or timezone — operate on absolute UTC day numbers. */
export function addDaysUtc(date: Date, days: number): Date {
  const ms = utcDayNumber(date) * 86_400_000 + days * 86_400_000
  return new Date(ms)
}

function utcDayNumber(input: Date | string): number {
  let t: number
  if (typeof input === 'string') {
    t = Date.parse(`${input}T00:00:00Z`)
  } else {
    t = Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate())
  }
  return Math.floor(t / 86_400_000)
}

export function startOfDay(date: Date): string {
  const d = addDaysUtc(date, 0)
  return d.toISOString().slice(0, 10)
}

/** Resolve a preset or a raw custom ladder into a normalized 3-rung array. */
export function resolveLadder(preset: LadderPreset | 'custom', custom?: number[]): number[] {
  if (preset !== 'custom') return [...LADDER_PRESETS[preset]]
  const c = (custom ?? []).filter((n) => Number.isFinite(n) && n > 0)
  return c.length > 0 ? c : [...LADDER_PRESETS.default]
}

/**
 * follow_up_by for a *new* contact: created date + first rung.
 * Uses 1-based ladder indexing: ladder[0] is the first gap.
 */
export function initialFollowUp(createdAt: Date | string, ladder: number[]): string {
  const base = new Date(createdAt)
  return startOfDay(addDaysUtc(new Date(base), ladder[0] ?? 2))
}

/**
 * Advance after a touchpoint is marked done.
 * Returns the new contact edge values, or null when the contact graduates.
 *
 * @param current touchpoints completed so far (0, 1, 2)
 * @param actedToday date the touchpoint was recorded (usually "today")
 */
export function advanceTouchpoint(
  ladder: number[],
  current: number,
  actedToday: Date | string,
): { touchpoints_done: number; follow_up_by: string } | null {
  if (ladder.length === 0) return null

  const next = current + 1
  if (next >= ladder.length) {
    // Graduated: done with all rungs, stop nudging.
    return null
  }
  // Move to the *next* rung, counted from the day the touchpoint was done.
  const days = ladder[next]
  return { touchpoints_done: next, follow_up_by: startOfDay(addDaysUtc(new Date(actedToday), days)) }
}

/**
 * Snooze: push follow_up_by forward 3 days. Ladder position is unchanged —
 * snoozing must NOT consume a rung.
 */
export function snooze(followUpBy: string, days = 3): string {
  const base = new Date(`${followUpBy}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return followUpBy
  return startOfDay(addDaysUtc(base, days))
}

/** Whole-day count from `from` (a date or now) until `date` (positive = in the future). */
export function daysUntil(date: string, from: Date | string = new Date()): number {
  return utcDayNumber(date) - utcDayNumber(from)
}

/** Urgency bucket for the triage list. */
export type Urgency = 'due' | 'close' | 'fresh' | 'graduated'

export function urgencyOf(date: string, status: string, now: Date | string = new Date()): Urgency {
  if (status === 'graduated') return 'graduated'
  const d = daysUntil(date, now)
  if (d < 0) return 'due'
  if (d <= 2) return 'close'
  return 'fresh'
}

/** Coffee progress out of three, for the row indicator. */
export function coffeeProgress(ladder: number[], touchpointsDone: number): number {
  const total = Math.max(ladder.length, 3)
  return Math.min(Math.max(touchpointsDone, 0), total)
}