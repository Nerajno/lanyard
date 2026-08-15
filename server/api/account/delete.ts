// Permanent account deletion: typed-email confirm → 14-day grace ledger →
// suppression → side-effect cancels → GoTrue soft delete. Server-only; the
// service-role key never leaves this route.
// Authorized with the caller's Supabase JWT (Bearer or sb-* cookie).
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireUser } from '~/server/utils/requireUser'
import { AccountDeletionError, requestAccountDeletion } from '~/server/utils/accountDeletion'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in first' })

  const { confirmEmail } = await readBody<{ confirmEmail?: string }>(event)
  if (!confirmEmail || typeof confirmEmail !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Type your email to confirm.' })
  }

  try {
    return await requestAccountDeletion(
      useSupabaseAdmin(),
      { id: user.id, email: user.email ?? '' },
      confirmEmail,
      new Date(),
    )
  } catch (e) {
    if (e instanceof AccountDeletionError) {
      throw createError({ statusCode: 400, statusMessage: e.message })
    }
    throw e
  }
})