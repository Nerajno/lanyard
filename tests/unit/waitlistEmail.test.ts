import { describe, it, expect } from 'vitest'

import { normalizeWaitlistEmail, isValidWaitlistEmail } from '~/server/utils/waitlistEmail'

describe('normalizeWaitlistEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeWaitlistEmail('  AlAn@Example.COM ')).toBe('alan@example.com')
  })

  it('coerces non-string input to empty string', () => {
    expect(normalizeWaitlistEmail(undefined)).toBe('')
    expect(normalizeWaitlistEmail(null)).toBe('')
    expect(normalizeWaitlistEmail(42)).toBe('')
  })
})

describe('isValidWaitlistEmail', () => {
  it('accepts a normal email', () => {
    expect(isValidWaitlistEmail('alan@example.com')).toBe(true)
    expect(isValidWaitlistEmail('a.b+tag@sub.example.co')).toBe(true)
  })

  it('rejects input without an @', () => {
    expect(isValidWaitlistEmail('example.com')).toBe(false)
  })

  it('rejects input without a TLD dot', () => {
    expect(isValidWaitlistEmail('alan@example')).toBe(false)
  })

  it('rejects empty / whitespace', () => {
    expect(isValidWaitlistEmail('')).toBe(false)
    expect(isValidWaitlistEmail('   ')).toBe(false)
  })

  it('rejects whitespace inside the address', () => {
    expect(isValidWaitlistEmail('a l@example.com')).toBe(false)
    expect(isValidWaitlistEmail('a@exa mple.com')).toBe(false)
  })
})