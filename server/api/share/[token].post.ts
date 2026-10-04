import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { shareIsValid } from '~/utils/share'
import { LADDER_PRESETS } from '~/types'
import { initialFollowUp } from '~/utils/cadence'
import { isValidContactEmail } from '~/utils/email'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const body = await readBody<{ name?: string; how_met?: string; email?: string | null; phone?: string | null }>(event)
  if (!token) throw createError({ statusCode: 400, statusMessage: 'Missing share token' })

  const admin = useSupabaseAdmin()
  const { data: share } = await admin.from('shares').select('*').eq('id', token).maybeSingle()
  if (!share || !shareIsValid(share, new Date())) {
    throw createError({ statusCode: 410, statusMessage: 'This link has expired or was already used.' })
  }

  const name = (body?.name ?? '').trim()
  const howMet = (body?.how_met ?? '').trim()
  const email = (body?.email ?? '').trim() || null
  const phone = (body?.phone ?? '').trim() || null
  if (!name || !howMet) throw createError({ statusCode: 400, statusMessage: 'Name and how you met are required.' })
  if (!email && !phone) throw createError({ statusCode: 400, statusMessage: 'Add an email or phone number.' })
  if (email && !isValidContactEmail(email)) throw createError({ statusCode: 400, statusMessage: 'Enter a valid email.' })

  const now = new Date()
  const ladder = LADDER_PRESETS.default
  const { data: contact, error: insertError } = await admin
    .from('contacts')
    .insert({
      user_id: share.user_id,
      name, how_met: howMet, email, phone,
      cadence_ladder: ladder,
      follow_up_by: initialFollowUp(now.toISOString(), ladder),
    })
    .select()
    .single()
  if (insertError) throw createError({ statusCode: 500, statusMessage: 'Could not save that. Try again.' })

  await admin.from('shares').update({ used_at: now.toISOString() }).eq('id', share.id)

  return { ok: true, name: contact.name }
})