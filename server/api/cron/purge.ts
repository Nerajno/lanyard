// Daily hard-purge trigger. Invoked by the Netlify Scheduled Function
// (netlify/functions/purge-cron) with the shared NUXT_CRON_SECRET; a purge
// forces ON DELETE CASCADE on every owned table past the 14-day grace window.
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { purgeDueAccounts } from '~/server/utils/accountDeletion'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.cronSecret as string

  if (secret) {
    const bearer = (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '')
    const supplied = getHeader(event, 'x-cron-secret') ?? bearer ?? getQuery(event).token
    if (typeof supplied !== 'string' || supplied !== secret) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  }

  return purgeDueAccounts(useSupabaseAdmin(), new Date())
})