import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeE164, hashE164, writeSuppression, isSmsSuppressed } from '~/server/utils/smsSuppression'

function mockAdmin() {
  const q = {
    insert: vi.fn(() => ({ onConflict: vi.fn(() => ({ ignore: q.ignore })) })),
    ignore: vi.fn(async () => ({ error: null })),
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })),
  }
  const admin = {
    from: vi.fn((t: string) => {
      if (t === 'sms_suppressions') return q
      return { select: () => ({}) }
    }),
  } as unknown as SupabaseClient
  return { admin, q }
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
    expect(q.insert).toHaveBeenCalledWith({ phone_hash: hashE164('+15550000000'), reason: 'opted_out' })
  })
  it('reports suppressed for a matching hash', async () => {
    const { admin, q } = mockAdmin()
    q.select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: 1 }, error: null })) })) }))
    expect(await isSmsSuppressed(admin, '+15550000000')).toBe(true)
  })
  it('reports not suppressed when no match', async () => {
    const { admin } = mockAdmin()
    expect(await isSmsSuppressed(admin, '+15550009999')).toBe(false)
  })
})