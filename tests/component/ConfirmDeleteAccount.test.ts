import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import ConfirmDeleteAccount from '~/components/ConfirmDeleteAccount.vue'

const signOutMock = vi.fn()
const user = { id: 'u1', email: 'ada@example.com' }

mockNuxtImport('useAuthStore', () => () => ({
  user,
  signOut: signOutMock,
}))

const requestDeleteMock = vi.fn()
const clearSessionMock = vi.fn()

mockNuxtImport('useDeleteAccount', () => () => ({
  requestDelete: requestDeleteMock,
  clearSessionAndRedirect: clearSessionMock,
}))

beforeEach(() => {
  requestDeleteMock.mockReset()
  clearSessionMock.mockReset()
  signOutMock.mockReset()
})

function mount() {
  return mountSuspended(ConfirmDeleteAccount)
}

describe('ConfirmDeleteAccount', () => {
  it('does not fire the delete request while the typed email differs', async () => {
    const w = await mount()
    await w.find('#confirm-email').setValue('someone@else.com')
    const del = w.findAll('button').find((b) => b.text().includes('Delete my account'))!
    await del.trigger('click')
    await vi.dynamicImportSettled()
    expect(requestDeleteMock).not.toHaveBeenCalled()
  })

  it('fires the delete request when the typed email matches', async () => {
    requestDeleteMock.mockResolvedValue(undefined)
    clearSessionMock.mockResolvedValue(undefined)
    const w = await mount()
    await w.find('#confirm-email').setValue('ada@example.com')
    const del = w.findAll('button').find((b) => b.text().includes('Delete my account'))!
    await del.trigger('click')
    await vi.dynamicImportSettled()
    expect(requestDeleteMock).toHaveBeenCalledWith('ada@example.com')
    expect(clearSessionMock).toHaveBeenCalled()
  })

  it('clears the local session after a successful delete', async () => {
    requestDeleteMock.mockResolvedValue(undefined)
    clearSessionMock.mockResolvedValue(undefined)
    const w = await mount()
    await w.find('#confirm-email').setValue('ada@example.com')
    const del = w.findAll('button').find((b) => b.text().includes('Delete my account'))!
    await del.trigger('click')
    await vi.dynamicImportSettled()
    expect(clearSessionMock).toHaveBeenCalled()
  })

  it('shows an error when the delete request fails', async () => {
    requestDeleteMock.mockRejectedValue({ data: { statusMessage: 'Something went wrong' } })
    const w = await mount()
    await w.find('#confirm-email').setValue('ada@example.com')
    const del = w.findAll('button').find((b) => b.text().includes('Delete my account'))!
    await del.trigger('click')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain('Something went wrong')
  })

  it('emits close when the user keeps their account', async () => {
    const w = await mount()
    const keep = w.findAll('button').find((b) => b.text().includes('Keep my account'))!
    await keep.trigger('click')
    await vi.dynamicImportSettled()
    expect(w.emitted('close')).toBeTruthy()
  })
})