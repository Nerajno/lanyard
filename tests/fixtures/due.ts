// Fixtures for the "who is due" decision logic. Uses TODAY = 2026-08-06.

export const TODAY = '2026-08-06'

export const fixtureContacts = [
  // overdue — should be selected
  { id: 'c-overdue', follow_up_by: '2026-08-03', status: 'active' },
  // due today — should be selected
  { id: 'c-today', follow_up_by: '2026-08-06', status: 'active' },
  // due tomorrow — NOT selected
  { id: 'c-tomorrow', follow_up_by: '2026-08-07', status: 'active' },
  // graduated — never selected
  { id: 'c-graduated', follow_up_by: '2026-07-01', status: 'graduated' },
  // archived — never selected
  { id: 'c-archived', follow_up_by: '2026-07-15', status: 'archived' },
  // overdue + active — selected
  { id: 'c-overdue2', follow_up_by: '2026-08-01', status: 'active' },
]