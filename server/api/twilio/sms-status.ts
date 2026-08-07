// Twilio message + delivery webhook.
// - Honor STOP / HELP (legal requirement for SMS to users):
//   STOP → set sms_opted_out_at (+ clear opt-in) so the sender hard-blocks.
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const { twilioToken } = useRuntimeConfig()
  const rawBody = (await readRawBody(event)) ?? ''
  const body: Record<string, string> = rawBody ? Object.fromEntries(new URLSearchParams(rawBody)) : {}

  if (twilioToken && !isValidTwilioSignature(event, twilioToken, rawBody)) {
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

/** Twilio signs `url + url-encoded POST body (sorted key/value pairs)` with AuthToken (HMAC-SHA1). */
function isValidTwilioSignature(event: H3Event, authToken: string, rawBody: string): boolean {
  const url = getRequestURL(event).toString()
  const header = getHeader(event, 'x-twilio-signature')
  if (!header) return false

  const sorted = Object.entries(Object.fromEntries(new URLSearchParams(rawBody)))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}${v}`)
    .join('')

  const expected = createHmac('sha1', authToken).update(url + sorted).digest('base64')
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}