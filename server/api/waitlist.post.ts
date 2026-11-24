import { readBody, getRequestIP, getRequestHeader, setResponseHeader } from 'h3'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { normalizeWaitlistEmail, isValidWaitlistEmail, isHoneypotFilled } from '~/server/utils/waitlistEmail'
import { createRateLimiter } from '~/server/utils/rateLimit'

// 5 submissions per address per 10 minutes. Real people submit once.
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 })

/** Test hook: clear limiter state between cases. */
export const __resetWaitlistLimiter = () => limiter.reset()

export default defineEventHandler(async (event) => {
  // Netlify sets x-nf-client-connection-ip to the real client; fall back to the socket address locally.
  const ip = getRequestHeader(event, 'x-nf-client-connection-ip') || getRequestIP(event) || 'unknown'
  const rate = limiter.hit(ip)
  if (!rate.allowed) {
    setResponseHeader(event, 'Retry-After', rate.retryAfterSec)
    throw createError({ statusCode: 429, statusMessage: 'Too many tries. Wait a few minutes and try again.' })
  }

  const body = await readBody<{ email?: string; website?: string }>(event)

  // Bots fill every field; humans never see this one. Answer like a success so the bot learns nothing.
  if (isHoneypotFilled(body?.website)) return { ok: true }

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
