// Hourly trigger for the nudge loop.
// Invoked by the Netlify Scheduled Function (netlify/functions/nudge-cron), or by
// any external scheduler (crontab, GitHub Actions, CI), with a shared CRON_SECRET.
// Delivers for any user inside their local send window who has something due.
// Double-send guarded by an explicit today-scan.
import { deliverNudges } from '~/server/services/nudgeSender'
import { shouldDeliverNow } from '~/server/utils/localWindow'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { computeDue } from '~/utils/due'
import type { Contact, Profile } from '~/types'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.cronSecret as string

  // Accept the token via header, bearer, or query so any scheduler works:
  // the Netlify scheduled function and curl/CI send `x-cron-secret`; hosts that
  // only support an auth header send `Authorization: Bearer <secret>`.
  if (secret) {
    const bearer = (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '')
    const supplied = getHeader(event, 'x-cron-secret') ?? bearer ?? getQuery(event).token
    if (typeof supplied !== 'string' || supplied !== secret) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  }

  const admin = useSupabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)

  // Double-send guard: users with a nudge row in the last 26h get skipped.
  const since = new Date(Date.now() - 26 * 3_600_000).toISOString()
  const { data: todayRows } = await admin.from('nudges').select('user_id').gte('sent_at', since)
  const sentToday = new Set((todayRows ?? []).map((r) => r.user_id))

  const { data: profiles } = await admin.from('profiles').select('*')
  const { data: allContacts } = await admin.from('contacts').select('*')

  const byUser = new Map<string, Contact[]>()
  for (const c of allContacts ?? []) {
    const list = byUser.get(c.user_id) ?? []
    list.push(c as Contact)
    byUser.set(c.user_id, list)
  }

  const summary: Record<string, unknown> = {}

  for (const profile of (profiles ?? []) as Profile[]) {
    if (sentToday.has(profile.user_id)) {
      summary[profile.user_id] = 'already-delivered-today'
      continue
    }
    if (profile.sms_opted_out_at) continue
    if (!shouldDeliverNow(profile.timezone)) continue

    const contacts = byUser.get(profile.user_id) ?? []
    if (contacts.length === 0) continue

    const due = computeDue(contacts, today)
    if (due.count === 0) continue

    const contactsById = Object.fromEntries(contacts.map((c) => [c.id, c]))
    const { sent, skipped } = await deliverNudges(profile, contactsById, due)
    summary[profile.user_id] = { due: due.count, sent, skipped }
  }

  return { ok: true, summary, usersWithNudgesToday: sentToday.size }
})