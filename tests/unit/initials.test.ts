import { describe, it, expect } from 'vitest'
import { initials } from '~/utils/initials'

describe('initials', () => {
  it('uses the first and last word', () => expect(initials('Ada King Lovelace')).toBe('AL'))
  it('uses one letter for one word', () => expect(initials('cher')).toBe('C'))
  it('trims extra whitespace', () => expect(initials('  grace   hopper ')).toBe('GH'))
  it('falls back to ? for blank', () => expect(initials('   ')).toBe('?'))
})
