import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import NudgePrefsForm from '~/components/NudgePrefsForm.vue'

const saveMock = vi.fn()
const optInSmsMock = vi.fn()
let profileRef: { value: ReturnType<typeof makeProfile> | null } = { value: null }

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    user_id: 'u1',
    nudge_channel: 'email',
    phone: null,
    timezone: 'UTC',
    sms_opt_in_at: null,
    sms_opted_out_at: null,
    quiet_hours_start: 21,
    quiet_hours_end: 9,
    ...overrides,
  }
}

mockNuxtImport('useProfile', () => () => ({
  profile: profileRef,
  save: saveMock,
  optInSms: optInSmsMock,
}))

beforeEach(() => {
  saveMock.mockReset().mockResolvedValue(undefined)
  optInSmsMock.mockReset().mockResolvedValue(undefined)
  profileRef = { value: null }
})

function mount() {
  return mountSuspended(NudgePrefsForm)
}

describe('NudgePrefsForm', () => {
  it('defaults to the email channel when no profile exists', async () => {
    const w = await mount()
    const email = w.findAll('button').find((b) => b.text().trim() === 'Email')!
    expect(email.classes()).toContain('bg-accent-soft')
  })

  it('selects the existing SMS channel when the profile prefers it', async () => {
    profileRef.value = makeProfile({ nudge_channel: 'sms', sms_opt_in_at: '2026-01-01T00:00:00Z' })
    const w = await mount()
    const sms = w.findAll('button').find((b) => b.text().includes('Text'))!
    expect(sms.classes()).toContain('bg-accent-soft')
    const email = w.findAll('button').find((b) => b.text().trim() === 'Email')!
    expect(email.classes()).not.toContain('bg-accent-soft')
  })

  it('saves the chosen channel and timezone', async () => {
    const w = await mount()
    const both = w.findAll('button').find((b) => b.text().includes('Both'))!
    await both.trigger('click')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ nudge_channel: 'both', timezone: expect.any(String) }),
    )
  })

  it('requires a phone number before sending a verify code', async () => {
    const w = await mount()
    const consent = w.find('input[type="checkbox"]')
    await consent.setValue(true)
    const send = w.findAll('button').find((b) => b.text().includes('Send code'))!
    await send.trigger('click')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain('Add your mobile number first.')
  })

  it('emits saved after a successful save', async () => {
    const w = await mount()
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.emitted('saved')).toBeTruthy()
  })

  it('surfaces a save error inline', async () => {
    saveMock.mockRejectedValue(new Error('You must be signed in'))
    const w = await mount()
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain('You must be signed in')
  })

  it('saves quiet hours with the channel and timezone', async () => {
    const w = await mount()
    await w.find('#quiet_start').setValue('22')
    await w.find('#quiet_end').setValue('7')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ quiet_hours_start: 22, quiet_hours_end: 7, timezone: expect.any(String) }),
    )
  })

  it('shows a validation error when quiet hours start and end match', async () => {
    const w = await mount()
    await w.find('#quiet_start').setValue('9')
    await w.find('#quiet_end').setValue('9')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain('Quiet hours need different start and end times.')
    expect(saveMock).not.toHaveBeenCalled()
  })
})