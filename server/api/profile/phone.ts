// Phone verification for the nudge destination.
// POST  ?action=send    → sends a one-time code via Twilio Verify
// POST  ?action=verify  → checks the code and records phone_verified_at
// Authorized with the caller's Supabase JWT (Bearer). Consent was captured in
// the UI before this endpoint is used.
import type { H3Event } from 'h3'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const action = getQuery(event).action
  const body = await readBody<{ phone?: string; code?: string }>(event)

  const { supabaseServiceRole } = useRuntimeConfig()
  if (!supabaseServiceRole) throw createError({ statusCode: 500, statusMessage: 'Supabase not configured' })

  const client = useSupabaseAdmin()
  const { data: { user } } = await client.auth.getUser(authToken(event))
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in first' })

  if (action === 'send') {
    if (!body.phone) throw createError({ statusCode: 400, statusMessage: 'phone required' })
    await sendVerifyCode(body.phone)
    return { ok: true }
  }

  if (action === 'verify') {
    if (!body.phone || !body.code) throw createError({ statusCode: 400, statusMessage: 'phone and code required' })
    const approved = await checkVerifyCode(body.phone, body.code)
    if (!approved) throw createError({ statusCode: 400, statusMessage: 'Code incorrect or expired' })
    await client
      .from('profiles')
      .update({ phone: body.phone, phone_verified_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: 'unknown action' })
})

function authToken(event: H3Event): string {
  return (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '')
}

async function sendVerifyCode(phone: string): Promise<void> {
  const { twilioVerifySid } = useRuntimeConfig()
  if (!twilioVerifySid) throw createError({ statusCode: 500, statusMessage: 'TWILIO_VERIFY_SID not configured' })
  const res = await twilio(`/Services/${twilioVerifySid}/Verifications`, `To=${encodeURIComponent(phone)}&Channel=sms`)
  if (!res.ok) throw createError({ statusCode: 502, statusMessage: 'Could not send code' })
}

async function checkVerifyCode(phone: string, code: string): Promise<boolean> {
  const { twilioVerifySid } = useRuntimeConfig()
  if (!twilioVerifySid) return false
  const res = await twilio(`/Services/${twilioVerifySid}/VerificationCheck`, `To=${encodeURIComponent(phone)}&Code=${encodeURIComponent(code)}`)
  if (!res.ok) return false
  const data = (await res.json()) as { status?: string }
  return data.status === 'approved'
}

function twilio(path: string, body: string): Promise<Response> {
  const { twilioSid, twilioToken } = useRuntimeConfig()
  return fetch(`https://verify.twilio.com/v2${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
}