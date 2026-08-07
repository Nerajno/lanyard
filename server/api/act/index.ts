// The one-tap act path. This URL arrives on a phone WITHOUT a fresh login, so it
// can't rely on a Supabase session — the `t` token is HMAC-signed and self-verifying.
// 1. verify token  2. stamp nudge.opened_at  3. (single contact) mark the touchpoint
// and stamp acted_at  4. 302 to the prefilled sms:/mailto: composer.
// Lanyard never sends the follow-up itself; it opens a composer the user hits send on.
import { verifyActLink } from '~/utils/actLink'
import { advanceTouchpoint } from '~/utils/cadence'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = typeof query.t === 'string' ? query.t : null
  if (!token) {
    return sendRedirect(event, '/', 302)
  }

  const { actLinkSigningSecret, public: { appUrl } } = useRuntimeConfig()
  if (!actLinkSigningSecret) {
    throw createError({ statusCode: 500, statusMessage: 'ACT_LINK_SIGNING_SECRET not configured' })
  }

  let payload
  try {
    payload = verifyActLink(token, actLinkSigningSecret)
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired act-link' })
  }

  const admin = useSupabaseAdmin()
  const { data: nudge } = await admin.from('nudges').select('*').eq('id', payload.nudgeId).single()

  // Stamp opened_at once.
  if (nudge && !nudge.opened_at) {
    await admin.from('nudges').update({ opened_at: new Date().toISOString() }).eq('id', nudge.id)
  }

  // Digest → route to the triage list; the single-contact mark happens on the web too.
  if (payload.digest) {
    return sendRedirect(event, `${appUrl || '/'}contacts`, 302)
  }

  // Direct message: load the contact and open a prefilled composer.
  const { data: contact } = await admin.from('contacts').select('*').eq('id', payload.contactId).single()
  if (!contact) {
    return sendRedirect(event, '/', 302)
  }

  // Mark the touchpoint (advance ladder or graduate) and instrument acted_at.
  const next = advanceTouchpoint(contact.cadence_ladder, contact.touchpoints_done, new Date())
  const patch: Record<string, unknown> = {
    touchpoints_done: (next?.touchpoints_done ?? contact.touchpoints_done + 1),
  }
  if (next) patch.follow_up_by = next.follow_up_by
  else patch.status = 'graduated'

  await admin.from('contacts').update(patch).eq('id', contact.id)
  if (nudge && !nudge.acted_at) {
    await admin.from('nudges').update({ acted_at: new Date().toISOString() }).eq('id', nudge.id)
  }

  return sendRedirect(event, composerUrl(contact, contact.how_met), 302)
})

function composerUrl(contact: { email: string | null; phone: string | null }, howMet: string): string {
  if (contact.email) {
    const subject = encodeURIComponent('Great connecting at the conference')
    const body = encodeURIComponent(`Hi,\n\n${howMet}\n\nBest,\n[Your name]`)
    return `mailto:${contact.email}?subject=${subject}&body=${body}`
  }
  const phone = (contact.phone ?? '').replace(/\D/g, '')
  const body = encodeURIComponent(`Hi! ${howMet} — would love to keep in touch.`)
  return `sms:${phone}?body=${body}`
}