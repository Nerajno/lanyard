import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { shareIsValid } from '~/utils/share'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) return { valid: false }

  const admin = useSupabaseAdmin()
  const { data: share } = await admin.from('shares').select('how_met_default, expires_at, used_at').eq('id', token).maybeSingle()
  if (!share || !shareIsValid(share, new Date())) return { valid: false }

  return { valid: true, how_met_default: share.how_met_default ?? null }
})