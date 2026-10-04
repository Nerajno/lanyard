// The one-tap act path. This URL arrives on a phone WITHOUT a fresh login, so it
// can't rely on a Supabase session — the token is HMAC-signed and self-verifying.
// 1. verify token  2. stamp nudge.opened_at  3. (single contact) claim acted_at and,
// only on the first claim, mark the touchpoint  4. 302 to the prefilled composer.
// Lanyard never sends the follow-up itself; it opens a composer the user hits send on.
import { verifyActLink } from '~/utils/actLink'
import { advanceTouchpoint } from '~/utils/cadence'
import { composerUrl } from '~/utils/composer'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) return sendRedirect(event, '/', 302)

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

  // Digest → route to the app triage list; the single-contact mark happens on the web too.
  if (payload.digest) {
    return sendRedirect(event, `${(appUrl || '/').replace(/\/$/, '')}/app`, 302)
  }

  // Direct message: load the contact and open a prefilled composer.
  const { data: contact } = await admin.from('contacts').select('*').eq('id', payload.contactId).single()
  if (!contact) {
    return sendRedirect(event, '/', 302)
  }

  // First act wins: atomically claim acted_at; only the request that claims it
  // advances the ladder. Re-clicks and forwarded links still open the composer.
  const { data: claimed } = await admin
    .from('nudges')
    .update({ acted_at: new Date().toISOString() })
    .eq('id', payload.nudgeId)
    .is('acted_at', null)
    .select('id')
    .maybeSingle()

  if (claimed) {
    const next = advanceTouchpoint(contact.cadence_ladder, contact.touchpoints_done, new Date())
    const patch: Record<string, unknown> = {
      touchpoints_done: (next?.touchpoints_done ?? contact.touchpoints_done + 1),
    }
    if (next) patch.follow_up_by = next.follow_up_by
    else patch.status = 'graduated'
    await admin.from('contacts').update(patch).eq('id', contact.id)
  }

  return sendRedirect(event, composerUrl(contact, contact.how_met), 302)
})
