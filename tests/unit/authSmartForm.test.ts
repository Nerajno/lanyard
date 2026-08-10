import { describe, it, expect } from 'vitest'
import {
  nextAuthFormStep,
  actionForPhase,
  submitLabel,
  SIGNUP_PROMPT,
  CHECK_INBOX_MESSAGE,
  DUPLICATE_MESSAGE,
} from '~/utils/authSmartForm'

describe('nextAuthFormStep', () => {
  it('maps a successful sign-in to signed-in', () => {
    expect(nextAuthFormStep('signin', { kind: 'signed-in' })).toEqual({ phase: 'signed-in' })
  })
  it('maps invalid credentials during sign-in to signup mode', () => {
    expect(nextAuthFormStep('signin', { kind: 'need-password' })).toEqual({ phase: 'signup', message: SIGNUP_PROMPT })
  })
  it('maps a sign-up awaiting email confirmation to confirm-email', () => {
    expect(nextAuthFormStep('signup', { kind: 'awaiting-confirmation' })).toEqual({ phase: 'confirm-email' })
  })
  it('maps a duplicate-email sign-up to duplicate', () => {
    expect(nextAuthFormStep('signup', { kind: 'duplicate-email' })).toEqual({ phase: 'duplicate' })
  })
  it('maps a sign-up that returned a session to signed-in', () => {
    expect(nextAuthFormStep('signup', { kind: 'signed-in' })).toEqual({ phase: 'signed-in' })
  })
  it('maps a failed action to an error carrying the message', () => {
    expect(nextAuthFormStep('signin', { kind: 'failed', message: 'Network hiccup' })).toEqual({
      phase: 'error',
      message: 'Network hiccup',
    })
  })
})

describe('submitLabel', () => {
  it('labels the idle/sign-in button Continue', () => {
    expect(submitLabel({ phase: 'idle' }, false)).toBe('Continue')
    expect(submitLabel({ phase: 'signin' }, false)).toBe('Continue')
  })
  it('labels the signup button Create account', () => {
    expect(submitLabel({ phase: 'signup', message: SIGNUP_PROMPT }, false)).toBe('Create account')
  })
  it('labels a busy submit by mode', () => {
    expect(submitLabel({ phase: 'signin' }, true)).toBe('Signing in…')
    expect(submitLabel({ phase: 'signup', message: '' }, true)).toBe('Creating account…')
  })
})

describe('actionForPhase', () => {
  it('returns signup only for the signup phase, signin otherwise', () => {
    expect(actionForPhase({ phase: 'signup', message: '' })).toBe('signup')
    expect(actionForPhase({ phase: 'idle' })).toBe('signin')
    expect(actionForPhase({ phase: 'error', message: '' })).toBe('signin')
  })
})