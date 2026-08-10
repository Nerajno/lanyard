import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeE164, hashE164, writeSuppression, isSmsSuppressed } from '~/server/utils/smsSuppression'

function mockAdmin() {
  let found: unknown = null
  const maybeSingle = vi.fn(async () => ({ data: found, error: null }))
  const q = {
    insert: vi.fn(() => ({ onConflict: vi.fn(() => ({ ignore: vi.fn(async () => ({ error: null })) })) })),
    upsert: vi.fn(async () => ({ error: null })),
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
  }
  const admin = {
    from: vi.fn(() => q),
  } as unknown as SupabaseClient
  return { admin, q, setFound: (d: unknown) => { found = d } }
}

describe('normalizeE164', () => {
  it('strips separators and adds a leading +', () => {
    expect(normalizeE164('+1 555 000 0000')).toBe('+15550000000')
    expect(normalizeE164('1-555-000-0000')).toBe('+15550000000')
    expect(normalizeE164('+1 (555) 000-0000')).toBe('+15550000000')
  })
})

describe('hashE164', () => {
  it('produces a stable 64-char hex and never contains the number', () => {
    const h = hashE164('+1 555 000 0000')
    expect(h).toMatch(/^[a-f0-9]{64}$/)
    expect(h).not.toContain('15550000000')
    expect(hashE164('+1 555 000 0000')).toBe(hashE164('+15550000000'))
  })
})

describe('writeSuppression / isSmsSuppressed', () => {
  it('stores only the hash', async () => {
    const { admin, q } = mockAdmin()
    await writeSuppression(admin, '+1 555 000 0000')
    expect(q.upsert).toHaveBeenCalledWith({ phone_hash: hashE164('+15550000000'), reason: 'opted_out' }, { onConflict: 'phone_hash' })
  })
  it('reports suppressed for a matching hash', async () => {
    const { admin, setFound } = mockAdmin()
    setFound({ id: 1 })
    expect(await isSmsSuppressed(admin, '+15550000000')).toBe(true)
  })
  it('reports not suppressed when no match', async () => {
    const { admin } = mockAdmin()
    expect(await isSmsSuppressed(admin, '+15550009999')).toBe(false)
  })
})