// The contact patch for one completed touchpoint. Shared by the in-app
// follow-up so it can't drift from the act route's advance.
import type { Contact, UpdateContact } from '~/types'
import { advanceTouchpoint } from '~/utils/cadence'

export type FollowUpResult =
  | { outcome: 'advanced'; touchpointsDone: number; followUpBy: string }
  | { outcome: 'graduated' }
  | { outcome: 'skipped' }

export function followUpPatch(
  contact: Pick<Contact, 'cadence_ladder' | 'touchpoints_done'>,
  now: Date,
): { patch: UpdateContact; result: FollowUpResult } {
  const next = advanceTouchpoint(contact.cadence_ladder, contact.touchpoints_done, now)
  if (!next) {
    return { patch: { touchpoints_done: contact.touchpoints_done + 1, status: 'graduated' }, result: { outcome: 'graduated' } }
  }
  return {
    patch: { touchpoints_done: next.touchpoints_done, follow_up_by: next.follow_up_by },
    result: { outcome: 'advanced', touchpointsDone: next.touchpoints_done, followUpBy: next.follow_up_by },
  }
}
