import type { DueContact } from '~/utils/due'

export const TODAY = '2026-08-06T00:00:00Z'

export const fixtureContacts: DueContact[] = [
  { id: 'c-overdue', follow_up_by: '2026-08-03T00:00:00Z', status: 'active', unitHint: 'day' },
  { id: 'c-today', follow_up_by: '2026-08-06T00:00:00Z', status: 'active', unitHint: 'day' },
  { id: 'c-remind', follow_up_by: '2026-09-01T00:00:00Z', status: 'active', remind_at: '2026-08-06T00:00:00Z', unitHint: 'day' },
  { id: 'c-tomorrow', follow_up_by: '2026-08-07T00:00:00Z', status: 'active', unitHint: 'day' },
  { id: 'c-graduated', follow_up_by: '2026-07-01T00:00:00Z', status: 'graduated', unitHint: 'day' },
  { id: 'c-archived', follow_up_by: '2026-07-15T00:00:00Z', status: 'archived', unitHint: 'day' },
  { id: 'c-subhour', follow_up_by: '2026-08-05T12:00:00Z', status: 'active', unitHint: 'hour' },
  { id: 'c-submin', follow_up_by: '2026-08-05T12:30:00Z', status: 'active', unitHint: 'min' },
]
