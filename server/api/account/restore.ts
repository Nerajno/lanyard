// Undo during the 14-day grace. Reachable signed-out (from the home banner).
// Recreates the auth user + reparents owned rows (see restoreAccount).
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { AccountDeletionError, restoreAccount } from '~/server/utils/accountDeletion'

export default defineEventHandler(async (event) => {
  const { email } = await readBody<{ email?: string }>(event)
  if (!email || typeof email !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Enter the account email.' })
  }

  try {
    return await restoreAccount(useSupabaseAdmin(), email, new Date())
  } catch (e) {
    if (e instanceof AccountDeletionError) {
      throw createError({ statusCode: 400, statusMessage: e.message })
    }
    throw e
  }
})