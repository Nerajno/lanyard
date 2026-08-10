// SMS suppression: hashed numbers that must never be texted again.
// Retained indefinitely; survives account deletion by design (no FK, no cascade).
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Canonical E.164: strip separators, guarantee the leading +. */
export function normalizeE164(phone: string): string {
  const digits = phone.replace(/[\s\-().]/g, '')
  return digits.startsWith('+') ? digits : `+${digits}`
}

/** One-way hash of the canonical E.164 — the only form ever stored. */
export function hashE164(phone: string): string {
  return createHash('sha256').update(normalizeE164(phone)).digest('hex')
}

/** Record a number as suppressed (idempotent — unique conflict on phone_hash). */
export async function writeSuppression(admin: SupabaseClient, phone: string): Promise<void> {
  await admin
    .from('sms_suppressions')
    .upsert({ phone_hash: hashE164(phone), reason: 'opted_out' }, { onConflict: 'phone_hash' })
}

/** True when the number must never be texted. */
export async function isSmsSuppressed(admin: SupabaseClient, phone: string): Promise<boolean> {
  const { data } = await admin
    .from('sms_suppressions')
    .select('id')
    .eq('phone_hash', hashE164(phone))
    .maybeSingle()
  return Boolean(data)
}