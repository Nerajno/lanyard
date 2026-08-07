// "Who is due" decision logic — pure, tested against fixtures (Vitest).
// Mirrors Architecture.md §The reminder loop, steps 2–3.

/**
 * The minimum shape we need from a contact row to decide nudgability.
 * Keeps the function usable against fixtures without a full Contact.
 */
export type DueContact = {
  id: string
  follow_up_by: string
  status: string
}

export interface DueResult {
  due: DueContact[]
  /** true when 1 due → direct message; false when 2+ → digest */
  direct: boolean
  count: number
}

/**
 * Given a user's active contacts and the current date, return the ones due for a nudge
 * (follow_up_by <= today). Also decides direct vs digest branch from that count.
 */
export function computeDue(contacts: DueContact[], today: Date | string): DueResult {
  const base = new Date(`${asDateStr(today)}T00:00:00Z`).getTime()
  const due = contacts
    .filter((c) => c.status === 'active')
    .filter((c) => new Date(`${c.follow_up_by}T00:00:00Z`).getTime() <= base)
    .sort((a, b) => a.follow_up_by.localeCompare(b.follow_up_by))

  return { due, direct: due.length === 1, count: due.length }
}

/**
 * Who must execute the edge function this pass: users inside their local send window
 * and outside quiet hours and not opted out, who have at least one due contact.
 */
export function duePerUser(
  candidates: { user_id: string; contacts: DueContact[]; inWindow: boolean }[],
  today: Date | string,
): { user_id: string; result: DueResult }[] {
  return candidates
    .filter((c) => c.inWindow)
    .map((c) => ({ user_id: c.user_id, result: computeDue(c.contacts, today) }))
    .filter((r) => r.result.count > 0)
}

function asDateStr(value: Date | string): string {
  if (typeof value === 'string') return value
  return value.toISOString().slice(0, 10)
}