// Analytics for the one metric that matters (nudge→act latency) plus the
// completion funnel. Reads from nudges/contacts via the service-role client but
// scoped to the signed-in user (JWT), so it never leaks another user's rows.
import type { H3Event } from 'h3'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const admin = useSupabaseAdmin()
  const { data: { user } } = await admin.auth.getUser(authToken(event))
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in first' })

  const { data: nudges } = await admin.from('nudges').select('sent_at, acted_at').eq('user_id', user.id)
  const { data: contacts } = await admin.from('contacts').select('status, touchpoints_done, cadence_ladder').eq('user_id', user.id)

  const nudgeRows = (nudges ?? []) as { sent_at: string; acted_at: string | null }[]
  const contactRows = (contacts ?? []) as { status: string; touchpoints_done: number; cadence_ladder: number[] }[]

  const acted = nudgeRows.filter((n) => n.acted_at)

  const latenciesMin = acted
    .map((n) => (new Date(n.acted_at as string).getTime() - new Date(n.sent_at).getTime()) / 60_000)
    .filter((ms) => ms >= 0)
    .sort((a, b) => a - b)

  const nonArchived = contactRows.filter((c) => c.status !== 'archived')
  const graduated = nonArchived.filter((c) => c.status === 'graduated' || c.touchpoints_done >= c.cadence_ladder.length)

  return {
    nudges: {
      total: nudgeRows.length,
      actedOn: acted.length,
      actedOnPercent: pct(acted.length, nudgeRows.length),
      medianLatencyMinutes: median(latenciesMin),
    },
    contacts: {
      total: nonArchived.length,
      graduated: graduated.length,
      graduatedPercent: pct(graduated.length, nonArchived.length),
    },
  }
})

function authToken(event: H3Event): string {
  return (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '')
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100)
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}