import { describe, it, expect } from 'vitest'

import {
  initialFollowUp,
  advanceTouchpoint,
  snooze,
  daysUntil,
  urgencyOf,
  coffeeProgress,
  resolveLadder,
} from '~/utils/cadence'

const TODAY = '2026-08-06'
const LADDER = [2, 14, 45]

describe('resolveLadder', () => {
  it('expands presets to the documented rungs', () => {
    expect(resolveLadder('warm')).toEqual([1, 7, 21])
    expect(resolveLadder('default')).toEqual([2, 14, 45])
    expect(resolveLadder('slow')).toEqual([7, 30, 90])
  })
  it('falls back to default for empty/invalid custom ladders', () => {
    expect(resolveLadder('custom', [])).toEqual([2, 14, 45])
    expect(resolveLadder('custom')).toEqual([2, 14, 45])
    expect(resolveLadder('custom', [-5, 0])).toEqual([2, 14, 45])
  })
  it('keeps valid custom rungs', () => {
    expect(resolveLadder('custom', [3, 10, 60])).toEqual([3, 10, 60])
  })
})

describe('initialFollowUp', () => {
  it('is created date + first rung', () => {
    expect(initialFollowUp('2026-08-08T10:00Z', LADDER)).toBe('2026-08-10')
  })
  it('is created date + warm first rung', () => {
    expect(initialFollowUp('2026-08-08T10:00Z', [1, 7, 21])).toBe('2026-08-09')
  })
})

describe('advanceTouchpoint — ladder rung advance', () => {
  it('rung 0 → 1: advances to the second gap from today', () => {
    const next = advanceTouchpoint(LADDER, 0, TODAY)
    expect(next).not.toBeNull()
    expect(next!.touchpoints_done).toBe(1)
    // +14 days from the acted day (2026-08-06 + 14 = 2026-08-20)
    expect(next!.follow_up_by).toBe('2026-08-20')
  })
  it('rung 1 → 2: advances to the third gap', () => {
    const next = advanceTouchpoint(LADDER, 1, TODAY)
    expect(next!.touchpoints_done).toBe(2)
    expect(next!.follow_up_by).toBe('2026-09-20')
  })
  it('rung 2 → 3: graduates (returns null', () => {
    expect(advanceTouchpoint(LADDER, 2, TODAY)).toBeNull()
  })
  it('respects custom ladders', () => {
    const custom = [3, 10, 60]
    expect(advanceTouchpoint(custom, 0, TODAY)!.follow_up_by).toBe('2026-08-16')
    expect(advanceTouchpoint(custom, 1, TODAY)!.follow_up_by).toBe('2026-10-05')
  })
  it('graduates on the third rung for any ladder length', () => {
    expect(advanceTouchpoint([2, 14], 1, TODAY)).toBeNull()
  })
})

describe('snooze — does NOT consume a rung', () => {
  it('pushes follow_up_by forward 3 days without touching touchpoints', () => {
    expect(snooze('2026-08-10')).toBe('2026-08-13')
  })
  it('is a pure date shift; ladder position unchanged by design here', () => {
    expect(snooze('2026-08-10', 5)).toBe('2026-08-15')
  })
  it('handles malformed input by returning it unchanged', () => {
    expect(snooze('not-a-date')).toBe('not-a-date')
  })
})

describe('daysUntil / urgencyOf', () => {
  it('is negative when overdue, positive when in the future', () => {
    expect(daysUntil('2026-08-05', TODAY)).toBe(-1)
    expect(daysUntil('2026-08-08', TODAY)).toBe(2)
  })
  it('buckets due / close / fresh', () => {
    expect(urgencyOf('2026-08-05', 'active', TODAY)).toBe('due')
    expect(urgencyOf('2026-08-08', 'active', TODAY)).toBe('close')
    expect(urgencyOf('2026-09-01', 'active', TODAY)).toBe('fresh')
    expect(urgencyOf('2026-09-01', 'graduated', TODAY)).toBe('graduated')
  })
})

describe('coffeeProgress', () => {
  it('shows 0/3 → 3/3', () => {
    expect(coffeeProgress([2, 14, 45], 0)).toBe(0)
    expect(coffeeProgress([2, 14, 45], 2)).toBe(2)
    expect(coffeeProgress([2, 14, 45], 3)).toBe(3)
  })
  it('clamps out-of-range', () => {
    expect(coffeeProgress([2, 14, 45], 99)).toBe(3)
    expect(coffeeProgress([2, 14, 45], -1)).toBe(0)
  })
})