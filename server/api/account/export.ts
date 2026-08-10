// GDPR-style data export: the signed-in user's contacts as JSON.
// Read-only; feeds the "Download my data" button in the delete dialog.
// Authorized with the caller's Supabase JWT (Bearer).
import type { H3Event } from 'h3'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import type { Contact } from '~/types'

export default defineEventHandler(async (event) => {
  const admin = useSupabaseAdmin()
  const { data: { user } } = await admin.auth.getUser(authToken(event))
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in first' })

  const { data } = await admin
    .from('contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('follow_up_by', { ascending: true })

  return { contacts: (data ?? []) as Contact[] }
})

function authToken(event: H3Event): string {
  return (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '')
}