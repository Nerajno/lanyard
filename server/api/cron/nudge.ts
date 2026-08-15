// Hourly trigger for the nudge loop.
// Invoked by the Netlify Scheduled Function (netlify/functions/nudge-cron), or by
// any external scheduler (crontab, GitHub Actions, CI), with a shared CRON_SECRET.
// Delivers for any user inside their local send window who has something due.
// Double-send guarded by an explicit today-scan that counts only 'sent' rows.
import { deliverNudges } from '~/server/services/nudgeSender'
import { TwilioSmsProvider } from '~/server/services/providers/twilio'
import { ResendEmailProvider } from '~/server/services/providers/resend'
import { shouldDeliverNow } from '~/server/utils/localWindow'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { nextRung } from '~/utils/cadence'
import { computeDue, shouldDeliverForUser, splitSubDay } from '~/utils/due'
import type { DueContact } from '~/utils/due'
import type { Contact, Profile } from '~/types'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.cronSecret as string

  // H3: fail closed. Without a configured CRON_SECRET this route must not run
  // at all — silently skipping auth would let anyone trigger the loop.
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: 'CRON_SECRET not configured' })
  }
  const supplied = (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '') || getHeader(event, 'x-cron-secret') || ''
  if (!supplied || supplied !== secret) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const admin = useSupabaseAdmin()
  const now = new Date().toISOString()

  // Build the outbound providers once; a missing pair means that channel skips
  // gracefully per user (never a hard failure of the whole loop).
  const sms = config.twilioSid && config.twilioToken && config.twilioFrom
    ? new TwilioSmsProvider({ sid: config.twilioSid, token: config.twilioToken, from: config.twilioFrom })
    : null
  const email = config.emailApiKey && config.emailFrom
    ? new ResendEmailProvider({ apiKey: config.emailApiKey, from: config.emailFrom })
    : null
  const senderDeps = {
    admin,
    sms,
    email,
    appUrl: (config.public.appUrl as string) || 'http://localhost:3000',
    actLinkSigningSecret: config.actLinkSigningSecret as string,
  }

  // Double-send guard: users with a *sent* nudge row in the last 26h get flagged.
  // 'pending'/'failed' rows never count, so failed sends are retried next pass.
  const since = new Date(Date.now() - 26 * 3_600_000).toISOString()
  const { data: todayRows } = await admin
    .from('nudges')
    .select('user_id')
    .gte('sent_at', since)
    .eq('delivery_status', 'sent')
  const sentToday = new Set((todayRows ?? []).map((r) => r.user_id))

  const { data: profiles } = await admin.from('profiles').select('*')
  const { data: allContacts } = await admin.from('contacts').select('*')

  // Users who requested deletion must not keep getting nudged during grace.
  const { data: pendingDeletions } = await admin
    .from('account_deletions')
    .select('user_id')
    .is('purged_at', null)
    .is('superseded_at', null)
  const deleting = new Set((pendingDeletions ?? []).map((r) => r.user_id))

  const byUser = new Map<string, Contact[]>()
  for (const c of allContacts ?? []) {
    const list = byUser.get(c.user_id) ?? []
    list.push(c as Contact)
    byUser.set(c.user_id, list)
  }

  const summary: Record<string, unknown> = {}

  for (const profile of (profiles ?? []) as Profile[]) {
    if (profile.sms_opted_out_at) continue
    if (deleting.has(profile.user_id)) continue
    if (!shouldDeliverNow(profile.timezone)) continue

    const contacts = byUser.get(profile.user_id) ?? []
    if (contacts.length === 0) continue

    const dueContacts: DueContact[] = contacts.map((c) => ({
      id: c.id,
      follow_up_by: c.follow_up_by,
      status: c.status,
      remind_at: c.remind_at,
      unitHint: nextRung(c.cadence_ladder, c.touchpoints_done)?.unit ?? 'day',
    }))

    const due = computeDue(dueContacts, now)
    if (due.count === 0) continue

    const alreadySent = sentToday.has(profile.user_id)
    if (!shouldDeliverForUser(alreadySent, due.due)) {
      summary[profile.user_id] = { due: due.count, skipped: 'daily-cap' }
      continue
    }

    // When user already sent today, only sub-day contacts go out.
    const deliverable = alreadySent ? splitSubDay(due.due).subDay : due.due
    const deliverResult = {
      due: deliverable,
      count: deliverable.length,
      direct: deliverable.length === 1,
    }

    const contactsById = Object.fromEntries(contacts.map((c) => [c.id, c]))

    // H4: one user's provider failure must not kill the loop for everyone else.
    try {
      const { sent, skipped } = await deliverNudges(profile, contactsById, deliverResult, senderDeps)
      summary[profile.user_id] = { due: due.count, sent, skipped }
    } catch (err) {
      summary[profile.user_id] = { due: due.count, error: err instanceof Error ? err.message : String(err) }
      continue
    }

    // Single-shot: clear remind_at for every delivered contact that used it.
    const remindFired = deliverable.filter((d) => d.remind_at != null).map((d) => d.id)
    if (remindFired.length > 0) {
      await admin.from('contacts').update({ remind_at: null }).in('id', remindFired)
    }
  }

  return { ok: true, summary, usersWithNudgesToday: sentToday.size }
})