import { describe, it, expect } from 'vitest'
import { isOnboarded } from '~/utils/onboarding'

describe('isOnboarded', () => {
  it('is false when profile is null', () => {
    expect(isOnboarded(null)).toBe(false)
  })
  it('is false when onboarded_at is null', () => {
    expect(isOnboarded({ onboarded_at: null } as any)).toBe(false)
  })
  it('is true when onboarded_at is set', () => {
    expect(isOnboarded({ onboarded_at: '2026-08-09T00:00:00Z' } as any)).toBe(true)
  })
})