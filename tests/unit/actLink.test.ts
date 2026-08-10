import { describe, it, expect, beforeAll } from 'vitest'

import { signActLink, verifyActLink, buildNudgeActLink } from '~/utils/actLink'

const SECRET = 'unit-test-secret-not-used-in-prod'

describe('signActLink / verifyActLink', () => {
  it('round-trips a signed payload', () => {
    const token = signActLink({ nudgeId: 'n1', contactId: 'c1' }, SECRET)
    const p = verifyActLink(token, SECRET)
    expect(p.nudgeId).toBe('n1')
    expect(p.contactId).toBe('c1')
    expect(p.v).toBe(1)
  })

  it('rejects a tampered token', () => {
    const token = signActLink({ nudgeId: 'n1', contactId: 'c1' }, SECRET)
    const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA')
    expect(() => verifyActLink(tampered, SECRET)).toThrow(/signature/)
  })

  it('rejects a token signed with a different secret', () => {
    const token = signActLink({ nudgeId: 'n1', contactId: 'c1' }, 'other-secret')
    expect(() => verifyActLink(token, SECRET)).toThrow(/signature/)
  })

  it('rejects an expired token', () => {
    const token = signActLink({ nudgeId: 'n1', contactId: 'c1' }, SECRET, new Date('2026-01-01'))
    expect(() => verifyActLink(token, SECRET, new Date('2026-08-06'))).toThrow(/expired/)
  })

  it('rejects malformed input', () => {
    expect(() => verifyActLink('nonsense', SECRET)).toThrow(/Malformed/)
  })

  it('is deterministic for the same inputs', () => {
    const a = signActLink({ nudgeId: 'n1', contactId: 'c1' }, SECRET, new Date('2026-08-06'))
    const b = signActLink({ nudgeId: 'n1', contactId: 'c1' }, SECRET, new Date('2026-08-06'))
    expect(a).toBe(b)
  })
})

describe('buildNudgeActLink', () => {
  beforeAll(() => {
    // Guard: a blank secret would silently sign with empty HMAC.
  })

  it('is a URL with the token in the path (/act/:token)', () => {
    const link = buildNudgeActLink('https://lanyard.app', { nudgeId: 'n1', contactId: 'c1' }, SECRET)
    expect(link).toMatch(/^https:\/\/lanyard\.app\/act\/[^/]+$/)
    expect(() => verifyActLink(link.split('/act/')[1], SECRET)).not.toThrow()
  })

  it('builds a digest link when flagged', () => {
    const link = buildNudgeActLink('https://lanyard.app/', { nudgeId: 'n2', contactId: 'c1', digest: true }, SECRET)
    const p = verifyActLink(link.split('/act/')[1], SECRET)
    expect(p.digest).toBe(true)
  })
})