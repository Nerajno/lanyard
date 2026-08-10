import { describe, it, expect } from 'vitest'
import { shareIsValid } from '~/utils/share'
import type { Share } from '~/types'

const base: Share = {
  id: 'tok', user_id: 'u1', how_met_default: null,
  expires_at: '2026-09-01T00:00:00Z', used_at: null, created_at: '2026-08-01T00:00:00Z',
}

describe('shareIsValid', () => {
  it('accepts a fresh token', () => {
    expect(shareIsValid(base, new Date('2026-08-15T00:00:00Z'))).toBe(true)
  })
  it('rejects an expired token', () => {
    const expired = { ...base, expires_at: '2026-08-01T00:00:00Z' }
    expect(shareIsValid(expired, new Date('2026-08-15T00:00:00Z'))).toBe(false)
  })
  it('rejects a used token', () => {
    const used = { ...base, used_at: '2026-08-10T00:00:00Z' }
    expect(shareIsValid(used, new Date('2026-08-15T00:00:00Z'))).toBe(false)
  })
})