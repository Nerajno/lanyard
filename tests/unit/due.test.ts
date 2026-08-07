import { describe, it, expect } from 'vitest'

import { computeDue, duePerUser } from '~/utils/due'
import { TODAY, fixtureContacts } from '../fixtures/due'

describe('computeDue — "who is due" against fixtures', () => {
  it('picks only active contacts with follow_up_by <= today', () => {
    const { due, count, direct } = computeDue(fixtureContacts, TODAY)
    expect(count).toBe(3)
    expect(due.map((c) => c.id)).toEqual(['c-overdue2', 'c-overdue', 'c-today'])
    expect(direct).toBe(false)
  })

  it('returns direct=true when exactly one contact is due', () => {
    const one = [
      { id: 'c-overdue', follow_up_by: '2026-08-03', status: 'active' },
      { id: 'c-tomorrow', follow_up_by: '2026-08-07', status: 'active' },
    ]
    const { due, count, direct } = computeDue(one, TODAY)
    expect(count).toBe(1)
    expect(due[0].id).toBe('c-overdue')
    expect(direct).toBe(true)
  })

  it('returns empty when nothing is due', () => {
    const none = fixtureContacts.filter((c) => c.follow_up_by >= '2026-08-07')
    const { count, due, direct } = computeDue(none, TODAY)
    expect(count).toBe(0)
    expect(due).toEqual([])
    expect(direct).toBe(false)
  })

  it('sorts by due date ascending', () => {
    const { due } = computeDue(fixtureContacts, TODAY)
    expect(due.map((c) => c.follow_up_by)).toEqual(['2026-08-01', '2026-08-03', '2026-08-06'])
  })
})

describe('duePerUser — window gating', () => {
  it('skips users outside their send window', () => {
    const users = [
      { user_id: 'u1', inWindow: false, contacts: fixtureContacts },
      { user_id: 'u2', inWindow: true, contacts: fixtureContacts },
    ]
    const res = duePerUser(users, TODAY)
    expect(res.map((r) => r.user_id)).toEqual(['u2'])
    expect(res[0].result.count).toBe(3)
  })
})