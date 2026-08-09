import { readBody } from 'h3'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { normalizeWaitlistEmail, isValidWaitlistEmail } from '~/server/utils/waitlistEmail'

export default defineEventHandler(async (event) => {
const body = await readBody<{ email?: string }>(event)
  const email = normalizeWaitlistEmail(body?.email)
  if (!isValidWaitlistEmail(email)) {
    throw createError({ statusCode: 400, statusMessage: "That email doesn't look right. Double-check it and try again." })
  }

  const admin = useSupabaseAdmin()
  const { error: e } = await admin.from('waitlist').insert({ email }).single()
  if (e) {
    if (e.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: "You're already on the list." })
    }
    throw createError({ statusCode: 500, statusMessage: 'Could not save that just now. Try again in a moment.' })
  }

  return { ok: true }
})