// Pure cadence logic for the "three cups of coffee" ladder.
// No IO — unit-tested in Vitest (see tests/unit/cadence.test.ts).

import type { Ladder, LadderRung } from '~/types'
import { LADDER_PRESETS } from '~/types'

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