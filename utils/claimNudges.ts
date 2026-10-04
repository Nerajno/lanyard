// Claims a contact's open direct nudges so an in-app follow-up and the
// act-link can't both advance the ladder. Same conditional update as the
// act route: only rows whose acted_at is still null are stamped.
import type { SupabaseClient } from '@supabase/supabase-js'

export type ClaimResult = 'none' | 'claimed' | 'lost'

export async function claimOpenNudges(
  sb: SupabaseClient,
  userId: string,
  contactId: string,
  now: Date = new Date(),
): Promise<ClaimResult> {
  const { data: open, error: findError } = await sb
    .from('nudges')
    .select('id, contact_ids')
    .eq('user_id', userId)
    .is('acted_at', null)
    .contains('contact_ids', [contactId])
  if (findError) throw new Error(findError.message)

  // Direct nudges only — a digest act-link never advances the ladder.
  const ids = (open ?? [] as { id: string; contact_ids: string[] }[]).filter((n) => n.contact_ids.length === 1).map((n) => n.id)
  if (ids.length === 0) return 'none'

  const { data: claimed, error: claimError } = await sb
    .from('nudges')
    .update({ acted_at: now.toISOString() })
    .in('id', ids)
    .is('acted_at', null)
    .select('id')
  if (claimError) throw new Error(claimError.message)

  return (claimed ?? [] as { id: string }[]).length > 0 ? 'claimed' : 'lost'
}
