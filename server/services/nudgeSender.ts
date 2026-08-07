// Nudge delivery + instrumentation. Used by the hourly cron route.
// Critical rules honored here:
//  - NEVER auto-send the follow-up; the act-link opens a prefilled composer.
//  - No SMS without sms_opt_in_at, or with sms_opted_out_at set.
//  - Insert a nudges row per send; that row is the double-send guard.
import { buildNudgeActLink } from '~/utils/actLink'
import type { Contact, Profile } from '~/types'
import type { DueResult } from '~/utils/due'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export interface DeliverResult {
  sent: number
  skipped: string[]
}

interface SenderConfig {
  appUrl: string
  actLinkSigningSecret: string
  emailApiKey: string
  emailFrom: string
  twilioSid: string
  twilioToken: string
  twilioFrom: string
}

/** Send nudges for one user. Returns a count of sends + channel skip reasons. */
export async function deliverNudges(
  user: Profile,
  contactsById: Record<string, Contact>,
  result: DueResult,
): Promise<DeliverResult> {
  const r = useRuntimeConfig()
  const cfg: SenderConfig = {
    appUrl: r.public.appUrl || 'http://localhost:3000',
    actLinkSigningSecret: r.actLinkSigningSecret || '',
    emailApiKey: r.emailApiKey || '',
    emailFrom: r.emailFrom || '',
    twilioSid: r.twilioSid || '',
    twilioToken: r.twilioToken || '',
    twilioFrom: r.twilioFrom || '',
  }

  const skipped: string[] = []
  let sent = 0
  const multiple = result.count > 1
  const admin = useSupabaseAdmin()
  const now = new Date().toISOString()

  const channels = user.nudge_channel === 'both' ? (['sms', 'email'] as const) : ([user.nudge_channel] as const)

  for (const channel of channels) {
    if (channel === 'sms' && !canSendSms(user)) {
      skipped.push('sms:no-opt-in-or-phone')
      continue
    }
    if (channel === 'sms' && !(cfg.twilioSid && cfg.twilioToken && cfg.twilioFrom)) {
      skipped.push('sms:twilio-not-configured')
      continue
    }
    if (channel === 'email' && !(cfg.emailApiKey && cfg.emailFrom)) {
      skipped.push('email:not-configured')
      continue
    }

    // Insert the nudge row first so the act-link can embed a real nudge id.
    const { data: nudge } = await admin
      .from('nudges')
      .insert({ user_id: user.user_id, contact_ids: result.due.map((d) => d.id), channel, sent_at: now })
      .select()
      .single()
    const nudgeId = nudge?.id

    let providerMessageId: string | null

    if (!multiple && result.due[0]) {
      // Direct: one contact, inline how_met + one-tap act-link.
      const contact = contactsById[result.due[0].id]
      const link = buildNudgeActLink(cfg.appUrl, { nudgeId, contactId: contact.id }, cfg.actLinkSigningSecret)
      if (channel === 'sms') {
        providerMessageId = await sendSms(user.phone!, smsDirect(contact.how_met, link), cfg)
      } else {
        providerMessageId = await sendEmail(user.email!, 'Follow up', emailDirect(contact.how_met, link), cfg)
      }
    } else {
      // Digest: batch link to the triage list.
      const triage = `${cfg.appUrl.replace(/\/$/, '')}/contacts`
      if (channel === 'sms') {
        providerMessageId = await sendSms(user.phone!, smsDigest(result.count, triage), cfg)
      } else {
        providerMessageId = await sendEmail(user.email ?? '', 'Follow-ups due', emailDigest(result.count, triage), cfg)
      }
    }

    if (nudgeId && providerMessageId) {
      await admin.from('nudges').update({ provider_message_id: providerMessageId }).eq('id', nudgeId)
    }
    sent++
  }

  return { sent, skipped }
}

function canSendSms(user: Profile): boolean {
  if (!user.phone || !user.sms_opt_in_at) return false
  if (user.sms_opted_out_at) return false
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

// --- providers --------------------------------------------------------------

async function sendSms(to: string, body: string, cfg: SenderConfig): Promise<string | null> {
  const params = new URLSearchParams({ To: to, From: cfg.twilioFrom, Body: body })
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.twilioSid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${cfg.twilioSid}:${cfg.twilioToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  if (!res.ok) throw new Error(`Twilio send failed: ${res.status}`)
  const data = (await res.json()) as { sid?: string }
  return data.sid ?? null
}

async function sendEmail(to: string, subject: string, html: string, cfg: SenderConfig): Promise<string | null> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.emailApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: cfg.emailFrom, to: [to], subject, html }),
  })
  if (!res.ok) throw new Error(`Email send failed: ${res.status}`)
  const data = (await res.json()) as { id?: string }
  return data.id ?? null
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}