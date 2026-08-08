// "Who is due" instant-based decision logic — pure, tested against fixtures (Vitest).

import type { LadderUnit } from '~/types'

export type DueContact = {
  id: string
  follow_up_by: string
  status: string
  remind_at?: string | null
  unitHint?: LadderUnit
}

export interface DueResult {
  due: DueContact[]
  /** true when 1 due → direct message; false when 2+ → digest */
  direct: boolean
  count: number
}

/**
 * Given a user's active contacts and the current instant, return the ones due for a nudge
 * (follow_up_by <= now, or remind_at <= now). Also decides direct vs digest from that count.
 */
export function computeDue(contacts: DueContact[], now: Date | string): DueResult {
  const base = new Date(now).getTime()
  const due = contacts
    .filter((c) => c.status === 'active')
    .filter((c) => new Date(c.follow_up_by).getTime() <= base || (c.remind_at != null && new Date(c.remind_at).getTime() <= base))
    .sort((a, b) => a.follow_up_by.localeCompare(b.follow_up_by))
  return { due, direct: due.length === 1, count: due.length }
}

/** True when any due contact has a min/hour rung or a pending remind_at. */
export function hasSubDayDue(due: DueContact[]): boolean {
  return due.some((c) => c.remind_at != null || (c.unitHint ?? 'day') !== 'day')
}

/** Split due contacts into sub-day (bypass cap) vs day (respect cap). */
export function splitSubDay(due: DueContact[]): { subDay: DueContact[]; day: DueContact[] } {
  const subDay = due.filter((c) => c.remind_at != null || (c.unitHint ?? 'day') !== 'day')
  const day = due.filter((c) => !subDay.includes(c))
  return { subDay, day }
}

/** Who must execute the edge function this pass: users inside their local send window
 * and outside quiet hours and not opted out, who have at least one due contact.
 */
export function duePerUser(
  candidates: { user_id: string; contacts: DueContact[]; inWindow: boolean }[],
  now: Date | string,
): { user_id: string; result: DueResult }[] {
  return candidates
    .filter((c) => c.inWindow)
    .map((c) => ({ user_id: c.user_id, result: computeDue(c.contacts, now) }))
    .filter((r) => r.result.count > 0)
}