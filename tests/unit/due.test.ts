import { describe, it, expect } from 'vitest'

import { computeDue, hasSubDayDue, splitSubDay, shouldDeliverForUser } from '~/utils/due'
import type { DueContact } from '~/utils/due'
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
    const one: DueContact[] = [
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

describe('shouldDeliverForUser — daily-cap bypass', () => {
  it('allows delivery normally', () => {
    expect(shouldDeliverForUser(false, [{ id: 'x', follow_up_by: '2026-08-01T00:00:00Z', status: 'active', unitHint: 'day' }])).toBe(true)
  })
  it('suppresses day deliver after send', () => {
    const day: DueContact[] = [{ id: 'x', follow_up_by: '2026-08-01T00:00:00Z', status: 'active', unitHint: 'day' }]
    expect(shouldDeliverForUser(true, day)).toBe(false)
  })
  it('bypasses cap for sub-day/remind after send', () => {
    const sub: DueContact[] = [{ id: 'x', follow_up_by: '2026-08-01T00:00:00Z', status: 'active', unitHint: 'hour' }]
    expect(shouldDeliverForUser(true, sub)).toBe(true)
    const remind: DueContact[] = [{ id: 'y', follow_up_by: '2026-09-01T00:00:00Z', status: 'active', remind_at: '2026-08-01T00:00:00Z', unitHint: 'day' }]
    expect(shouldDeliverForUser(true, remind)).toBe(true)
  })
})
