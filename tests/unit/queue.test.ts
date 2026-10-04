import { describe, it, expect } from 'vitest'
import type { Contact } from '~/types'
import { dueBadge, followUpToast, groupQueue, localDayDiff } from '~/utils/queue'

const NOW = new Date(2026, 9, 3, 12, 0) // 3 Oct 2026, 12:00 local

function makeContact(over: Partial<Contact>): Contact {
  return {
    id: over.id ?? 'c', user_id: 'u', name: over.name ?? 'Ada', how_met: 'Met at X', email: 'ada@example.com', phone: null,
    cadence_ladder: [{ value: 2, unit: 'day' }, { value: 14, unit: 'day' }, { value: 45, unit: 'day' }],
    touchpoints_done: 0, follow_up_by: NOW.toISOString(), remind_at: null, status: 'active',
    created_at: NOW.toISOString(), updated_at: NOW.toISOString(), ...over,
  } as Contact
}

describe('localDayDiff', () => {
  it('is 0 later the same local day', () => expect(localDayDiff(new Date(2026, 9, 3, 23, 30), NOW)).toBe(0))
  it('is 1 just after local midnight', () => expect(localDayDiff(new Date(2026, 9, 4, 0, 10), NOW)).toBe(1))
  it('is negative for earlier days', () => expect(localDayDiff(new Date(2026, 9, 1, 9, 0), NOW)).toBe(-2))
})

describe('groupQueue', () => {
  it('splits active contacts into due / today / upcoming, soonest first', () => {
    const contacts = [
      makeContact({ id: 'up2', follow_up_by: new Date(2026, 9, 9).toISOString() }),
      makeContact({ id: 'due-old', follow_up_by: new Date(2026, 9, 1, 9).toISOString() }),
      makeContact({ id: 'today', follow_up_by: new Date(2026, 9, 3, 23, 30).toISOString() }),
      makeContact({ id: 'due-now', follow_up_by: new Date(2026, 9, 3, 11, 59).toISOString() }),
      makeContact({ id: 'up1', follow_up_by: new Date(2026, 9, 4, 0, 10).toISOString() }),
    ]
    const g = groupQueue(contacts, NOW)
    expect(g.due.map((c) => c.id)).toEqual(['due-old', 'due-now'])
    expect(g.today.map((c) => c.id)).toEqual(['today'])
    expect(g.upcoming.map((c) => c.id)).toEqual(['up1', 'up2'])
  })

  it('treats exactly-now as due', () => {
    const g = groupQueue([makeContact({ id: 'x', follow_up_by: NOW.toISOString() })], NOW)
    expect(g.due).toHaveLength(1)
  })

  it('handles a sub-day rung later today', () => {
    const g = groupQueue([makeContact({ id: 'x', follow_up_by: new Date(2026, 9, 3, 12, 15).toISOString() })], NOW)
    expect(g.today.map((c) => c.id)).toEqual(['x'])
  })

  it('excludes graduated and archived contacts', () => {
    const g = groupQueue([
      makeContact({ id: 'g', status: 'graduated' }),
      makeContact({ id: 'a', status: 'archived' }),
    ], NOW)
    expect([...g.due, ...g.today, ...g.upcoming]).toHaveLength(0)
  })
})

describe('dueBadge', () => {
  it('counts overdue days for earlier days', () => {
    expect(dueBadge(makeContact({ follow_up_by: new Date(2026, 9, 1, 9).toISOString() }), NOW)).toEqual({ label: 'Overdue · 2d', tone: 'due' })
  })
  it('says Due for earlier today', () => {
    expect(dueBadge(makeContact({ follow_up_by: new Date(2026, 9, 3, 8).toISOString() }), NOW)).toEqual({ label: 'Due', tone: 'due' })
  })
  it('shows the local time for later today', () => {
    const at = new Date(2026, 9, 3, 15, 0)
    const expected = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    expect(dueBadge(makeContact({ follow_up_by: at.toISOString() }), NOW)).toEqual({ label: expected, tone: 'warm' })
  })
  it('shows days for upcoming', () => {
    expect(dueBadge(makeContact({ follow_up_by: new Date(2026, 9, 7, 9).toISOString() }), NOW)).toEqual({ label: 'In 4d', tone: 'muted' })
  })
  it('marks graduated', () => {
    expect(dueBadge(makeContact({ status: 'graduated' }), NOW)).toEqual({ label: 'Graduated · 3 coffees', tone: 'graduated' })
  })
})

describe('followUpToast', () => {
  it('reports progress and the next nudge', () => {
    const r = { outcome: 'advanced' as const, touchpointsDone: 1, followUpBy: new Date(2026, 9, 15, 12).toISOString() }
    expect(followUpToast(r, 3, NOW)).toBe('Coffee 1 of 3 logged · next nudge in 12d')
  })
  it('says later today for a same-day next rung', () => {
    const r = { outcome: 'advanced' as const, touchpointsDone: 1, followUpBy: new Date(2026, 9, 3, 18).toISOString() }
    expect(followUpToast(r, 3, NOW)).toBe('Coffee 1 of 3 logged · next nudge later today')
  })
  it('celebrates graduation', () => {
    expect(followUpToast({ outcome: 'graduated' }, 3, NOW)).toBe('Graduated — all 3 coffees 🎓')
  })
  it('stays quiet when skipped', () => {
    expect(followUpToast({ outcome: 'skipped' }, 3, NOW)).toBeNull()
  })
})
