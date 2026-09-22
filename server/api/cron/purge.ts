// Daily hard-purge trigger. Invoked by the Netlify Scheduled Function
// (netlify/functions/purge-cron) with the shared NUXT_CRON_SECRET; a purge
// forces ON DELETE CASCADE on every owned table past the 14-day grace window.
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { purgeDueAccounts } from '~/server/utils/accountDeletion'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.cronSecret as string

  // H3: fail closed. Without a configured CRON_SECRET this route must not run.
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: 'CRON_SECRET not configured' })
  }
  const supplied = (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '') || getHeader(event, 'x-cron-secret') || ''
  if (!supplied || supplied !== secret) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return purgeDueAccounts(useSupabaseAdmin(), new Date())
})