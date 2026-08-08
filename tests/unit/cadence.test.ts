import { describe, it, expect } from 'vitest'

import { LADDER_PRESETS, type Ladder } from '~/types'

import {
  addToTimestamp,
  advanceTouchpoint,
  coffeeProgress,
  daysUntil,
  formatLadder,
  formatRung,
  initialFollowUp,
  nextRung,
  presetOf,
  resolveLadder,
  rungToMs,
  snooze,
  urgencyOf,
} from '~/utils/cadence'

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
    const ladder: Ladder = [{ value: 2, unit: 'hour' }, { value: 1, unit: 'day' }, { value: 3, unit: 'day' }]
    const next = advanceTouchpoint(ladder, 0, '2026-08-08T12:00:00Z')!
    expect(next.touchpoints_done).toBe(1)
    expect(next.follow_up_by).toBe('2026-08-09T12:00:00.000Z') // +1 day from acted instant
  })
  it('graduates on exhausting the ladder', () => {
    expect(advanceTouchpoint([{ value: 2, unit: 'hour' }, { value: 1, unit: 'day' }], 1, '2026-08-08T12:00:00Z')).toBeNull()
  })
})

describe('nextRung', () => {
  const ladder: Ladder = [{ value: 30, unit: 'min' }, { value: 2, unit: 'hour' }, { value: 3, unit: 'day' }]
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

describe('coffeeProgress', () => {
  it('reports completed touchpoints out of three', () => {
    expect(coffeeProgress(LADDER_PRESETS.default, 0)).toBe(0)
    expect(coffeeProgress(LADDER_PRESETS.default, 2)).toBe(2)
    expect(coffeeProgress(LADDER_PRESETS.default, 3)).toBe(3)
  })
  it('clamps out-of-range values', () => {
    expect(coffeeProgress(LADDER_PRESETS.default, 99)).toBe(3)
    expect(coffeeProgress(LADDER_PRESETS.default, -1)).toBe(0)
  })
})
