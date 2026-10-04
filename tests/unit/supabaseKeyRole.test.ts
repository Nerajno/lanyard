import { describe, it, expect } from 'vitest'
import { jwtRole, publicKeyProblem } from '~/utils/supabaseKeyRole'

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const fakeJwt = (role: string) => `${b64url({ alg: 'HS256' })}.${b64url({ role, ref: 'x' })}.sig`
const ANON = fakeJwt('anon')
const SERVICE = fakeJwt('service_role')

describe('jwtRole', () => {
  it('reads the role claim', () => {
    expect(jwtRole(ANON)).toBe('anon')
    expect(jwtRole(SERVICE)).toBe('service_role')
  })
  it('returns null for non-JWT and garbage keys', () => {
    expect(jwtRole('sb_publishable_abc123')).toBeNull()
    expect(jwtRole('a.%%%.c')).toBeNull()
    expect(jwtRole('')).toBeNull()
    expect(jwtRole(undefined)).toBeNull()
  })
})

describe('publicKeyProblem', () => {
  it('passes a real anon or publishable key', () => {
    expect(publicKeyProblem(ANON, SERVICE)).toBeNull()
    expect(publicKeyProblem('sb_publishable_abc', 'sb_secret_def')).toBeNull()
  })
  it('flags a service_role or secret key in the public slot', () => {
    expect(publicKeyProblem(SERVICE, '')).toMatch(/service_role/)
    expect(publicKeyProblem('sb_secret_def', '')).toMatch(/service_role\/secret/)
  })
  it('flags identical public and service keys', () => {
    expect(publicKeyProblem('same-key', 'same-key')).toMatch(/equals/)
  })
  it('never echoes the key value', () => {
    expect(publicKeyProblem(SERVICE, SERVICE)).not.toContain(SERVICE)
  })
})
