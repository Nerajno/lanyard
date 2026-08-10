import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AccountDeletionError,
  GRACE_DAYS,
  gracePurgeAt,
  normalizeEmail,
  requestAccountDeletion,
} from '~/server/utils/accountDeletion'

const NOW = new Date('2026-08-10T12:00:00Z')

/** Thenable fluent mock: any awaited chain resolves to { data, error: null }. */
function mockAdmin() {
  let data: unknown = null
  const builder = {
    then: (resolve: (v: unknown) => void) => resolve({ data, error: null }),
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    onConflict: vi.fn(() => builder),
    ignore: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
    single: vi.fn(async () => ({ data, error: null })),
    setData: (d: unknown) => {
      data = d
    },
  }
  const admin = {
    from: vi.fn(() => builder),
    auth: { admin: { deleteUser: vi.fn(async () => ({ error: null })) } },
  } as unknown as SupabaseClient
  return { admin, builder }
}

describe('gracePurgeAt / normalizeEmail', () => {
  it('grace default is 14 days', () => {
    expect(GRACE_DAYS).toBe(14)
    expect(gracePurgeAt(NOW)).toBe('2026-08-24T12:00:00.000Z')
  })
  it('normalizes email case/whitespace', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com')
  })
})

describe('requestAccountDeletion', () => {
  it('happy path: ledger insert + soft delete', async () => {
    const { admin, builder } = mockAdmin()

    const res = await requestAccountDeletion(
      admin,
      { id: 'u1', email: 'foo@bar.com' },
      'foo@bar.com',
      NOW,
    )

    expect(res.ok).toBe(true)
    expect(res.purgeBy).toBe('2026-08-24T12:00:00.000Z')
    expect(builder.insert).toHaveBeenCalledWith({ user_id: 'u1', email: 'foo@bar.com', purge_at: '2026-08-24T12:00:00.000Z' })
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('u1', true)
  })

  it('writes a suppression when the profile opted out of SMS', async () => {
    const { admin, builder } = mockAdmin()
    // Call 1 = account_deletions pending check (null); call 2 = profiles read.
    builder.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValue({ data: { phone: '+15550000000', sms_opted_out_at: '2026-08-01T00:00:00Z' }, error: null })

    await requestAccountDeletion(admin, { id: 'u1', email: 'foo@bar.com' }, 'foo@bar.com', NOW)

    expect(builder.upsert).toHaveBeenCalledWith(
      {
        phone_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        reason: 'opted_out',
      },
      { onConflict: 'phone_hash' },
    )
  })

  it('rejects mismatched confirm email', async () => {
    const { admin } = mockAdmin()
    await expect(
      requestAccountDeletion(admin, { id: 'u1', email: 'foo@bar.com' }, 'wrong@x.com', NOW),
    ).rejects.toThrow(AccountDeletionError)
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it('idempotent when already pending', async () => {
    const { admin, builder } = mockAdmin()
    builder.setData({ purge_at: '2026-08-24T12:00:00.000Z', purged_at: null, superseded_at: null })
    const res = await requestAccountDeletion(admin, { id: 'u1', email: 'foo@bar.com' }, 'foo@bar.com', NOW)
    expect(res.alreadyPending).toBe(true)
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled()
  })
})