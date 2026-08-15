import { describe, expect, it } from 'vitest'
import { buildPasswordUpdate } from '~/utils/changePassword'

describe('buildPasswordUpdate', () => {
  it('omits current_password when current password is empty', () => {
    expect(buildPasswordUpdate('', 'newpass123')).toEqual({ password: 'newpass123' })
  })
  it('omits current_password when current password is whitespace', () => {
    expect(buildPasswordUpdate('   ', 'newpass123')).toEqual({ password: 'newpass123' })
  })
  it('includes current_password when provided', () => {
    expect(buildPasswordUpdate('oldpass123', 'newpass123')).toEqual({
      password: 'newpass123',
      current_password: 'oldpass123',
    })
  })
  it('preserves the new password verbatim', () => {
    const p = buildPasswordUpdate('old', 'New Pass 9!')
    expect(p.password).toBe('New Pass 9!')
  })
})