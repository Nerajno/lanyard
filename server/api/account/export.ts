// GDPR-style data export: the signed-in user's contacts as JSON.
// Read-only; feeds the "Download my data" button in the delete dialog.
// Authorized with the caller's Supabase JWT (Bearer or sb-* cookie).
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireUser } from '~/server/utils/requireUser'
import type { Contact } from '~/types'

export default defineEventHandler(async (event) => {
  const admin = useSupabaseAdmin()
  const user = await requireUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in first' })

  const { data } = await admin
    .from('contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('follow_up_by', { ascending: true })

  return { contacts: (data ?? []) as Contact[] }
})