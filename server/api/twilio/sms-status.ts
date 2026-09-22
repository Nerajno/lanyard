// Twilio message + delivery webhook.
// - Honor STOP / HELP (legal requirement for SMS to users):
//   STOP → set sms_opted_out_at (+ clear opt-in) so the sender hard-blocks.
// H3: previously, without a configured twilioToken this route accepted ANY
// unsigned POST (signature check was silently skipped). It now fails closed —
// no token → 500; token present but signature bad → 400.
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { isValidTwilioRequest } from '~/server/services/providers/twilio'

export default defineEventHandler(async (event) => {
  const { twilioToken } = useRuntimeConfig()

  if (!twilioToken) {
    throw createError({ statusCode: 500, statusMessage: 'Twilio webhook not configured' })
  }

  const rawBody = (await readRawBody(event)) ?? ''
  const body: Record<string, string> = rawBody ? Object.fromEntries(new URLSearchParams(rawBody)) : {}
  const signature = getHeader(event, 'x-twilio-signature') ?? null

  if (!isValidTwilioRequest(twilioToken, getRequestURL(event).toString(), signature, body)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Twilio signature' })
  }

  const from = (body.From ?? '').trim()
  const messageBody = (body.Body ?? '').toUpperCase()
  if (!from) return { ok: true }

  // STOP-family → opt out; HELP → also record (Twilio replies with our help text).
  const optOut = /^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|QUIT)$/i.test(messageBody)
  const help = messageBody === 'HELP'

  if (optOut || help) {
    const admin = useSupabaseAdmin()
    const { data: profile } = await admin.from('profiles').select('*').eq('phone', from).maybeSingle()
    if (profile) {
      await admin
        .from('profiles')
        .update({ sms_opted_out_at: new Date().toISOString(), sms_opt_in_at: null })
        .eq('user_id', profile.user_id)
    }
  }

  return { ok: true }
})