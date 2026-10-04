import { describe, it, expect } from 'vitest'
import { isValidContactEmail } from '~/utils/email'

describe('isValidContactEmail', () => {
  it.each(['ada@example.com', 'a.b+tag@sub.example.co'])('accepts %s', (e) => {
    expect(isValidContactEmail(e)).toBe(true)
  })
  it.each([
    'a@b.com?bcc=x@y.z',
    'a?bcc=x@b.com',
    'a@b.com&cc=x',
    'a b@c.com',
    'a@b',
    'a@@b.com',
    'a@b.com#x',
    'a%40b@c.com',
    '',
  ])('rejects %s', (e) => {
    expect(isValidContactEmail(e)).toBe(false)
  })
  it('rejects null/undefined', () => {
    expect(isValidContactEmail(null)).toBe(false)
    expect(isValidContactEmail(undefined)).toBe(false)
  })
})
