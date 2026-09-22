// Phone verification for the nudge destination.
// POST  ?action=send    → sends a one-time code via Twilio Verify
// POST  ?action=verify  → checks the code and records phone_verified_at
// Authorized with the caller's Supabase JWT (Bearer or sb-* cookie). Consent was
// captured in the UI before this endpoint is used. H2: previously this route
// silently did nothing when no token was sent — it now rejects loudly.
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireUser } from '~/server/utils/requireUser'
import { TwilioVerify } from '~/server/services/providers/twilio'

export default defineEventHandler(async (event) => {
  const action = getQuery(event).action
  const body = await readBody<{ phone?: string; code?: string }>(event)

  const { supabaseServiceRole, twilioSid, twilioToken, twilioVerifySid } = useRuntimeConfig()
  if (!supabaseServiceRole) throw createError({ statusCode: 500, statusMessage: 'Supabase not configured' })

  const client = useSupabaseAdmin()
  const user = await requireUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in first' })

  // Fail-closed: without Verify credentials no phone can be verified.
  const verify = new TwilioVerify({ sid: twilioSid as string, token: twilioToken as string, verifySid: twilioVerifySid as string })

  if (action === 'send') {
    if (!body.phone) throw createError({ statusCode: 400, statusMessage: 'phone required' })
    try {
      await verify.sendCode(body.phone)
    } catch {
      throw createError({ statusCode: 502, statusMessage: 'Could not send code' })
    }
    return { ok: true }
  }

  if (action === 'verify') {
    if (!body.phone || !body.code) throw createError({ statusCode: 400, statusMessage: 'phone and code required' })
    let approved: boolean
    try {
      approved = await verify.checkCode(body.phone, body.code)
    } catch {
      approved = false
    }
    if (!approved) throw createError({ statusCode: 400, statusMessage: 'Code incorrect or expired' })
    await client
      .from('profiles')
      .update({ phone: body.phone, phone_verified_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: 'unknown action' })
})