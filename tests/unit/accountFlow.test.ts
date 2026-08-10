import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountDeletionError, purgeDueAccounts, restoreAccount } from '~/server/utils/accountDeletion'

const NOW = new Date('2026-08-10T12:00:00Z')

/** Thenable fluent mock: any awaited chain resolves to { data, error: null }. */
function mockAdmin() {
  let data: unknown = null
  const builder = {
    then: (resolve: (v: unknown) => void) => resolve({ data, error: null }),
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
    single: vi.fn(async () => ({ data, error: null })),
    setData: (d: unknown) => {
      data = d
    },
  }
  const admin = {
    from: vi.fn(() => builder),
    auth: {
      admin: {
        deleteUser: vi.fn(async () => ({ error: null })),
        createUser: vi.fn(async () => ({ data: { user: { id: 'new' } }, error: null })),
      },
    },
  } as unknown as SupabaseClient
  return { admin, builder }
}

describe('restoreAccount', () => {
  it('recreates the user and marks superseded', async () => {
    const { admin, builder } = mockAdmin()
    builder.setData({ id: 'd1', user_id: 'old', email: 'foo@bar.com', purge_at: '2026-08-24T12:00:00.000Z', purged_at: null, superseded_at: null })

    await restoreAccount(admin, 'foo@bar.com', NOW)

    expect(admin.auth.admin.createUser).toHaveBeenCalledWith({ email: 'foo@bar.com' })
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('old', false)
    expect(builder.update).toHaveBeenCalledWith({ superseded_at: NOW.toISOString() })
  })

  it('rejects when the grace window passed', async () => {
    const { admin, builder } = mockAdmin()
    builder.setData({ id: 'd1', user_id: 'old', email: 'foo@bar.com', purge_at: '2026-08-01T12:00:00.000Z', purged_at: null, superseded_at: null })

    await expect(restoreAccount(admin, 'foo@bar.com', NOW)).rejects.toThrow(AccountDeletionError)
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it('rejects when there is no pending deletion', async () => {
    const { admin } = mockAdmin()
    await expect(restoreAccount(admin, 'nobody@x.com', NOW)).rejects.toThrow(AccountDeletionError)
  })
})

describe('purgeDueAccounts', () => {
  it('hard-deletes past-due rows and skips not-yet-due ones', async () => {
    const { admin, builder } = mockAdmin()
    builder.setData([
      { id: 'd1', user_id: 'u1', purge_at: '2026-08-01T12:00:00.000Z' },
      { id: 'd2', user_id: 'u2', purge_at: '2026-09-01T12:00:00.000Z' },
    ])

    const res = await purgeDueAccounts(admin, NOW)

    expect(res.purged).toBe(1)
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledTimes(1)
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('u1', false)
    expect(builder.update).toHaveBeenCalledWith({ purged_at: NOW.toISOString() })
  })
})