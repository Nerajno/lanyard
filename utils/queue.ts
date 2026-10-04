// Queue grouping by the viewer's LOCAL calendar day. Don't use cadence.daysUntil
// here — it counts UTC days, which mis-buckets evening contacts west of UTC.
import type { Contact } from '~/types'
import type { FollowUpResult } from '~/utils/followUp'

export type QueueGroups = { due: Contact[]; today: Contact[]; upcoming: Contact[] }
export type Badge = { label: string; tone: 'due' | 'warm' | 'muted' | 'graduated' }

const DAY_MS = 24 * 60 * 60 * 1000

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function localDayDiff(date: Date | string, now: Date = new Date()): number {
  return Math.round((startOfLocalDay(new Date(date)) - startOfLocalDay(now)) / DAY_MS)
}

export function groupQueue(contacts: Contact[], now: Date = new Date()): QueueGroups {
  const groups: QueueGroups = { due: [], today: [], upcoming: [] }
  const active = contacts
    .filter((c) => c.status === 'active')
    .sort((a, b) => a.follow_up_by.localeCompare(b.follow_up_by))
  for (const c of active) {
    if (new Date(c.follow_up_by).getTime() <= now.getTime()) groups.due.push(c)
    else if (localDayDiff(c.follow_up_by, now) === 0) groups.today.push(c)
    else groups.upcoming.push(c)
  }
  return groups
}

export function dueBadge(contact: Pick<Contact, 'status' | 'follow_up_by'>, now: Date = new Date()): Badge {
  if (contact.status === 'graduated') return { label: 'Graduated · 3 coffees', tone: 'graduated' }
  const at = new Date(contact.follow_up_by)
  const days = localDayDiff(at, now)
  if (at.getTime() <= now.getTime()) {
    return days < 0 ? { label: `Overdue · ${-days}d`, tone: 'due' } : { label: 'Due', tone: 'due' }
  }
  if (days === 0) return { label: at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), tone: 'warm' }
  return { label: `In ${days}d`, tone: 'muted' }
}

export function followUpToast(result: FollowUpResult, total: number, now: Date = new Date()): string | null {
  if (result.outcome === 'skipped') return null
  if (result.outcome === 'graduated') return `Graduated — all ${total} coffees 🎓`
  const days = localDayDiff(result.followUpBy, now)
  const when = days <= 0 ? 'later today' : `in ${days}d`
  return `Coffee ${result.touchpointsDone} of ${total} logged · next nudge ${when}`
}
