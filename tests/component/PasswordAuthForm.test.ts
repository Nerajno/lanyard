import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import PasswordAuthForm from '~/components/auth/PasswordAuthForm.vue'
import { CHECK_INBOX_MESSAGE, DUPLICATE_MESSAGE, SIGNUP_PROMPT } from '~/utils/authSmartForm'

const signInMock = vi.fn()
const signUpMock = vi.fn()
const sendResetMock = vi.fn()

mockNuxtImport('useAuthStore', () => () => ({
  signInWithPassword: signInMock,
  signUp: signUpMock,
  sendPasswordReset: sendResetMock,
  hydrate: vi.fn(),
  ready: true,
  user: null,
}))

beforeEach(() => {
  signInMock.mockReset()
  signUpMock.mockReset()
  sendResetMock.mockReset()
})

function mount() {
  return mountSuspended(PasswordAuthForm, { route: '/login' })
}

describe('PasswordAuthForm', () => {
  it('signs in with email and password', async () => {
    signInMock.mockResolvedValue(undefined)
    const w = await mount()
    await w.find('#email').setValue('ada@example.com')
    await w.find('#password').setValue('coral1234')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(signInMock).toHaveBeenCalledWith('ada@example.com', 'coral1234')
  })

  it('shows the signup prompt when the credentials are unknown', async () => {
    signInMock.mockRejectedValue({ code: 'invalid_credentials' })
    const w = await mount()
    await w.find('#email').setValue('new@example.com')
    await w.find('#password').setValue('coral1234')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(signInMock).toHaveBeenCalled()
    expect(w.text()).toContain(SIGNUP_PROMPT)
    expect(w.text()).toContain('Create account')
  })

  it('shows a friendly message when the email already has an account', async () => {
    signUpMock.mockResolvedValue({ session: false })
    signInMock.mockRejectedValueOnce({ code: 'invalid_credentials' })
    const w = await mount()
    await w.find('#email').setValue('dup@example.com')
    await w.find('#password').setValue('coral1234')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    signUpMock.mockRejectedValue({ code: 'user_already_exists' })
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain(DUPLICATE_MESSAGE)
  })

  it('flips to signup mode: a passing signup with no session awaits email confirmation', async () => {
    signInMock.mockRejectedValue({ code: 'invalid_credentials' })
    signUpMock.mockResolvedValue({ session: false })
    const w = await mount()
    await w.find('#email').setValue('ada@example.com')
    await w.find('#password').setValue('coral1234')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain('Create account')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(signUpMock).toHaveBeenCalledWith('ada@example.com', 'coral1234')
    expect(w.text()).toContain(CHECK_INBOX_MESSAGE)
  })

  it('sends a password reset and shows the inbox notice', async () => {
    sendResetMock.mockResolvedValue(undefined)
    const w = await mount()
    await w.find('#password').trigger('click')
    const forgot = w.findAll('button').find((b) => b.text().includes('Forgot password'))
    await forgot!.trigger('click')
    await vi.dynamicImportSettled()
    expect(sendResetMock).toHaveBeenCalled()
    expect(w.text()).toContain('Check your inbox')
  })
})