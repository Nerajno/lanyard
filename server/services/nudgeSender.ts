// Nudge delivery + instrumentation. Used by the hourly cron route.
// Critical rules honored here:
//  - NEVER auto-send the follow-up; the act-link opens a prefilled composer.
//  - No SMS without sms_opt_in_at, or with sms_opted_out_at set.
//  - Insert a nudges row per send; that row is the double-send guard.
//  - H5: the row starts 'pending'; it becomes 'sent' only after the provider
//    accepts the message, or 'failed' if it throws. The cron's 26h cap guard
//    counts only 'sent' rows, so a failed send is retried next pass instead of
//    suppressing the user for a day.
import { buildNudgeActLink } from '~/utils/actLink'
import type { Contact, Profile } from '~/types'
import type { DueResult } from '~/utils/due'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isSmsSuppressed } from '~/server/utils/smsSuppression'
import type { SmsProvider, EmailProvider } from '~/server/services/providers/types'

export interface DeliverResult {
  sent: number
  skipped: string[]
}

export interface SenderDeps {
  admin: SupabaseClient
  sms: SmsProvider | null
  email: EmailProvider | null
  appUrl: string
  actLinkSigningSecret: string
}

/** Send nudges for one user. Returns a count of sends + channel skip reasons. */
export async function deliverNudges(
  user: Profile,
  contactsById: Record<string, Contact>,
  result: DueResult,
  deps: SenderDeps,
): Promise<DeliverResult> {
  const { admin, sms, email, appUrl, actLinkSigningSecret } = deps

  const skipped: string[] = []
  let sent = 0
  const multiple = result.count > 1
  const now = new Date().toISOString()

  const channels = user.nudge_channel === 'both' ? (['sms', 'email'] as const) : ([user.nudge_channel] as const)

  for (const channel of channels) {
    if (channel === 'sms' && !(await canSendSms(user, admin))) {
      skipped.push('sms:no-opt-in-or-phone')
      continue
    }
    if (channel === 'sms' && !sms) {
      skipped.push('sms:twilio-not-configured')
      continue
    }
    if (channel === 'email' && !email) {
      skipped.push('email:not-configured')
      continue
    }

    // Insert the nudge row first (as 'pending') so the act-link can embed a
    // real nudge id. Mark 'sent'/'failed' after the provider call.
    const { data: nudge } = await admin
      .from('nudges')
      .insert({ user_id: user.user_id, contact_ids: result.due.map((d) => d.id), channel, sent_at: now, delivery_status: 'pending' })
      .select()
      .single()
    const nudgeId = nudge?.id

    let providerMessageId: string | null

    try {
      if (!multiple && result.due[0]) {
        // Direct: one contact, inline how_met + one-tap act-link.
        const contact = contactsById[result.due[0].id]
        const link = buildNudgeActLink(appUrl, { nudgeId, contactId: contact.id }, actLinkSigningSecret)
        if (channel === 'sms') {
          providerMessageId = await sms!.send(user.phone!, smsDirect(contact.how_met, link))
        } else {
          providerMessageId = await email!.send(user.email!, 'Follow up', emailDirect(contact.how_met, link))
        }
      } else {
        // Digest: batch link to the app triage list.
        const triage = `${appUrl.replace(/\/$/, '')}/app`
        if (channel === 'sms') {
          providerMessageId = await sms!.send(user.phone!, smsDigest(result.count, triage))
        } else {
          providerMessageId = await email!.send(user.email ?? '', 'Follow-ups due', emailDigest(result.count, triage))
        }
      }

      if (nudgeId) {
        const update: Record<string, unknown> = providerMessageId
          ? { delivery_status: 'sent', provider_message_id: providerMessageId }
          : { delivery_status: 'sent' }
        await admin.from('nudges').update(update).eq('id', nudgeId)
      }
    } catch (err) {
      // H5: a failed send must not burn the 26h cap. Mark the row 'failed' so
      // the cron's guard (which counts only 'sent') lets the next pass retry.
      if (nudgeId) {
        await admin.from('nudges').update({ delivery_status: 'failed' }).eq('id', nudgeId)
      }
      throw err
    }
    sent++
  }

  return { sent, skipped }
}

async function canSendSms(user: Profile, admin: SupabaseClient): Promise<boolean> {
  if (!user.phone || !user.sms_opt_in_at) return false
  if (user.sms_opted_out_at) return false
  if (await isSmsSuppressed(admin, user.phone)) return false
  return true
}

// --- message builders -------------------------------------------------------

function smsDirect(howMet: string, link: string): string {
  return `It's coffee time: ${howMet}\n\nOpen: ${link}`.slice(0, 320)
}
function emailDirect(howMet: string, link: string): string {
  return `<p>Time to reconnect. You met them here:</p><blockquote>${escapeHtml(howMet)}</blockquote><p><a href="${escapeHtml(link)}">Open composer</a></p>`
}
function smsDigest(count: number, triage: string): string {
  return `${count} follow-up${count === 1 ? '' : 's'} due. Open your list: ${triage}`
}
function emailDigest(count: number, triage: string): string {
  return `<p>${count} follow-up${count === 1 ? '' : 's'} due today.</p><p><a href="${escapeHtml(triage)}">Open your triage list</a></p>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}