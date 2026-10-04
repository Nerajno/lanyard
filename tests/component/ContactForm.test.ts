import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ContactForm, { type ContactFormValues } from '~/components/ContactForm.vue'

function mount(initial?: Partial<ContactFormValues> | null) {
  return mountSuspended(ContactForm, { props: { initial: initial ?? null } })
}

describe('ContactForm', () => {
  it('requires a name and how-you-met before submitting', async () => {
    const w = await mount()
    await w.find('#name').setValue('Ada')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain('Name and how you met are required.')
    expect(w.emitted('submit')).toBeFalsy()
  })

  it('requires at least an email or phone (mirrors the DB CHECK)', async () => {
    const w = await mount()
    await w.find('#name').setValue('Ada')
    await w.find('#how_met').setValue('Workshop')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain('Add an email or a phone number.')
    expect(w.emitted('submit')).toBeFalsy()
  })

  it('emits the values with an email and no phone', async () => {
    const w = await mount()
    await w.find('#name').setValue('Ada')
    await w.find('#how_met').setValue('Workshop')
    await w.find('#email').setValue('ada@example.com')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    const emitted = w.emitted('submit')![0][0] as Record<string, unknown>
    expect(emitted.name).toBe('Ada')
    expect(emitted.how_met).toBe('Workshop')
    expect(emitted.email).toBe('ada@example.com')
    expect(emitted.phone).toBeNull()
  })

  it('emits the values with a phone and no email', async () => {
    const w = await mount()
    await w.find('#name').setValue('Grace')
    await w.find('#how_met').setValue('Conference')
    await w.find('#phone').setValue('+15550000000')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    const emitted = w.emitted('submit')![0][0] as Record<string, unknown>
    expect(emitted.email).toBeNull()
    expect(emitted.phone).toBe('+15550000000')
  })

  it('pre-fills from the initial values', async () => {
    const w = await mount({ name: 'Ada', how_met: 'Workshop', email: 'ada@example.com', phone: null })
    expect((w.find('#name').element as HTMLInputElement).value).toBe('Ada')
    expect((w.find('#email').element as HTMLInputElement).value).toBe('ada@example.com')
  })

  it('does not show the channel error before the user leaves the field or submits', async () => {
    const w = await mount()
    expect(w.text()).not.toContain('Add an email or a phone number.')
    await w.find('#email').trigger('blur')
    expect(w.text()).toContain('Add an email or a phone number.')
  })

  it('inserts a suggestion chip at the start of how you met', async () => {
    const w = await mountSuspended(ContactForm, { props: { initial: null, suggestions: ['WebSummit 2026'] } })
    await w.find('#how_met').setValue('talked Postgres')
    const chip = w.findAll('button').find((b) => b.text() === 'WebSummit 2026')!
    await chip.trigger('click')
    expect((w.find('#how_met').element as HTMLTextAreaElement).value).toBe('WebSummit 2026 · talked Postgres')
  })

  it('keeps the pace picker collapsed until asked', async () => {
    const w = await mount()
    const toggle = w.find('button[aria-controls="pace-options"]')
    expect(toggle.text()).toContain('Pace: Default')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(w.find('#pace-options').exists()).toBe(false)
    await toggle.trigger('click')
    expect(w.find('#pace-options').exists()).toBe(true)
  })

  it('opens the pace picker when editing a custom ladder', async () => {
    const w = await mount({ name: 'Ada', how_met: 'x', email: 'a@b.co', ladderPreset: 'custom', customLadder: [{ value: 3, unit: 'day' }] })
    expect(w.find('#pace-options').exists()).toBe(true)
  })
})