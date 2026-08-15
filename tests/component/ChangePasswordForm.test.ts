import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import ChangePasswordForm from '~/components/ChangePasswordForm.vue'

const changePasswordMock = vi.fn()

mockNuxtImport('useAuthStore', () => () => ({
  changePassword: changePasswordMock,
  user: { email: 'ada@example.com' },
}))

function mount() {
  return mountSuspended(ChangePasswordForm)
}

beforeEach(() => {
  changePasswordMock.mockReset()
})

describe('ChangePasswordForm', () => {
  it('renders the three password fields and the submit button', async () => {
    const w = await mount()
    expect(w.find('#current-password').exists()).toBe(true)
    expect(w.find('#new-password').exists()).toBe(true)
    expect(w.find('#confirm-password').exists()).toBe(true)
    expect(w.text()).toContain('Update password')
  })

  it('blocks submit when the new password is shorter than 8 characters', async () => {
    const w = await mount()
    await w.find('#new-password').setValue('short')
    await w.find('form').trigger('submit')
    expect(w.text()).toContain('New password must be at least 8 characters.')
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('blocks submit when the new passwords do not match', async () => {
    const w = await mount()
    await w.find('#new-password').setValue('coral1234')
    await w.find('#confirm-password').setValue('coral5678')
    await w.find('form').trigger('submit')
    expect(w.text()).toContain('New passwords do not match.')
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('blocks reuse of the current password as the new password', async () => {
    const w = await mount()
    await w.find('#current-password').setValue('coral1234')
    await w.find('#new-password').setValue('coral1234')
    await w.find('#confirm-password').setValue('coral1234')
    await w.find('form').trigger('submit')
    expect(w.text()).toContain('New password must be different from the current one.')
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('calls changePassword with the current and new password on a valid submit', async () => {
    changePasswordMock.mockResolvedValue(undefined)
    const w = await mount()
    await w.find('#current-password').setValue('oldpass1')
    await w.find('#new-password').setValue('newpass1')
    await w.find('#confirm-password').setValue('newpass1')
    await w.find('form').trigger('submit')
    expect(changePasswordMock).toHaveBeenCalledWith('oldpass1', 'newpass1')
    expect(w.text()).toContain('Password updated')
  })

  it('maps current_password_invalid to a friendly message', async () => {
    changePasswordMock.mockRejectedValue({ code: 'current_password_invalid' })
    const w = await mount()
    await w.find('#current-password').setValue('wrongpass')
    await w.find('#new-password').setValue('rightpass')
    await w.find('#confirm-password').setValue('rightpass')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain('Current password is incorrect.')
  })

  it('maps reauthentication_needed to the sign-in-again message', async () => {
    changePasswordMock.mockRejectedValue({ code: 'reauthentication_needed' })
    const w = await mount()
    await w.find('#new-password').setValue('finepass1')
    await w.find('#confirm-password').setValue('finepass1')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain('Sign in again, then retry')
  })
})