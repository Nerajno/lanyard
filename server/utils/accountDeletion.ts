// Account deletion flows: request (soft delete + grace ledger), restore (undo
// via recreate + reparent), and the scheduled hard purge. All use the
// server-only admin client (service role). Idempotent by design.
import type { SupabaseClient } from '@supabase/supabase-js'
import { writeSuppression } from '~/server/utils/smsSuppression'

export const GRACE_DAYS = 14
const DAY_MS = 86_400_000

export function gracePurgeAt(from: Date, days = GRACE_DAYS): string {
  return new Date(from.getTime() + days * DAY_MS).toISOString()
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Thrown for expected user-facing failures; routes map it to a 4xx. */
export class AccountDeletionError extends Error {}

interface PendingDeletion {
  id: string
  user_id: string
  email: string
  purge_at: string
  purged_at: string | null
  superseded_at: string | null
}

/**
 * Soft-delete an account: record the 14-day grace, suppress opted-out numbers,
 * cancel side effects, then GoTrue soft-delete (irreversible by design).
 */
export async function requestAccountDeletion(
  admin: SupabaseClient,
  user: { id: string; email: string },
  confirmEmail: string,
  now: Date,
): Promise<{ ok: true; purgeBy: string; alreadyPending?: boolean }> {
  if (normalizeEmail(confirmEmail) !== normalizeEmail(user.email)) {
    throw new AccountDeletionError('The email you typed does not match your account.')
  }

  const { data: existing } = await admin
    .from('account_deletions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle<PendingDeletion>()

  if (existing && !existing.purged_at && !existing.superseded_at) {
    return { ok: true, purgeBy: existing.purge_at, alreadyPending: true }
  }

  const purgeAt = gracePurgeAt(now)
  await admin.from('account_deletions').insert({ user_id: user.id, email: normalizeEmail(user.email), purge_at: purgeAt })

  // Suppression: if this account opted out of SMS, keep a hash so the number
  // (once recycled) is never texted again. In Phase 1 only the profile phone is
  // ever texted by us, so it is the only number that can end up here.
  const { data: profile } = await admin.from('profiles').select('phone, sms_opted_out_at').eq('user_id', user.id).maybeSingle()
  if (profile?.phone && profile.sms_opted_out_at) {
    await writeSuppression(admin, profile.phone)
  }

  // Side-effect cancels. Phase 1: Twilio has nothing scheduled (one-shot nudges
  // die with the cron skip in Task 5) and there is no billing. Future: call the
  // Twilio/Stripe cancellation SDKs here, where the service role is available.

  await admin.auth.admin.deleteUser(user.id, true)

  return { ok: true, purgeBy: purgeAt }
}

/**
 * Undo within the 14-day grace. GoTrue soft-delete is irreversible and frees
 * the email, so we recreate the auth user and reparent every public row to the
 * new uid, then hard-delete the old (orphaned) user.
 */
export async function restoreAccount(admin: SupabaseClient, email: string, now: Date): Promise<{ ok: true }> {
  const normalized = normalizeEmail(email)

  const { data: pending } = await admin
    .from('account_deletions')
    .select('*')
    .eq('email', normalized)
    .is('purged_at', null)
    .is('superseded_at', null)
    .maybeSingle<PendingDeletion>()
  if (!pending) throw new AccountDeletionError('No account waiting to be restored.')
  if (pending.purge_at <= now.toISOString()) {
    throw new AccountDeletionError('The 14-day window has passed — your account was deleted for good.')
  }

  const oldId = pending.user_id

  // 1. Recreate the auth user. GoTrue freed the email on soft delete, and the
  //    on_auth_user_created trigger re-creates an empty profiles row for it.
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email: normalized })
  if (createError || !created) throw new AccountDeletionError('Could not restore your account. Try again.')
  const newId = created.user.id

  // 2. Reparent: copy the old profile into the new trigger-created row, drop the
  //    old one, then move every owned row to the new uid.
  const { data: oldProfile } = await admin.from('profiles').select('*').eq('user_id', oldId).maybeSingle()
  if (oldProfile) {
    const { phone, phone_verified_at, nudge_channel, timezone, quiet_hours_start, quiet_hours_end, sms_opt_in_at, sms_opted_out_at, onboarded_at } = oldProfile
    await admin
      .from('profiles')
      .update({ phone, phone_verified_at, nudge_channel, timezone, quiet_hours_start, quiet_hours_end, sms_opt_in_at, sms_opted_out_at, onboarded_at })
      .eq('user_id', newId)
    await admin.from('profiles').delete().eq('user_id', oldId)
  }

  for (const table of ['contacts', 'nudges', 'shares'] as const) {
    await admin.from(table).update({ user_id: newId }).eq('user_id', oldId)
  }

  // 3. The old user is now an empty shell — hard delete (cascade cleans up the
  //    trigger-created profile if reparenting above missed anything).
  await admin.auth.admin.deleteUser(oldId, false)

  // 4. Close the grace record.
  await admin.from('account_deletions').update({ superseded_at: now.toISOString() }).eq('id', pending.id)

  return { ok: true }
}

/** Hard-purge soft-deleted accounts whose grace window has passed. */
export async function purgeDueAccounts(admin: SupabaseClient, now: Date): Promise<{ purged: number; failed: number }> {
  const nowIso = now.toISOString()
  const { data: due } = await admin
    .from('account_deletions')
    .select('user_id, purge_at')
    .lte('purge_at', nowIso)
    .is('purged_at', null)
    .is('superseded_at', null)

  let purged = 0
  let failed = 0
  for (const row of (due ?? [])) {
    // Double guard on the window (the query already filters); keeps the unit
    // test meaningful against loose mocks and protects against clock skew.
    if (row.purge_at > nowIso) continue
    const { error } = await admin.auth.admin.deleteUser(row.user_id, false)
    if (error) {
      failed++
      continue
    }
    await admin.from('account_deletions').update({ purged_at: nowIso }).eq('user_id', row.user_id)
    purged++
  }
  return { purged, failed }
}