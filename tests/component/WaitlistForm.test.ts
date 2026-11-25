import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import WaitlistForm from '~/components/WaitlistForm.vue'

beforeEach(() => {
  registerEndpoint('/api/waitlist', {
    method: 'POST',
    handler: async () => {
      return { ok: true }
    },
  })
})

describe('WaitlistForm', () => {
  it('ignores empty submissions', async () => {
    const w = await mountSuspended(WaitlistForm)
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.text()).not.toContain("You're on the list")
  })

  it('posts the email and confirms sign-up', async () => {
    const w = await mountSuspended(WaitlistForm)
    await w.find('input').setValue('ada@example.com')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain("You're on the list")
  })

  it('surfaces the server error message on duplicate sign-up', async () => {
    registerEndpoint('/api/waitlist', {
      method: 'POST',
      handler: async () => {
        throw createError({ statusCode: 409, statusMessage: "You're already on the list." })
      },
    })
    const w = await mountSuspended(WaitlistForm)
    await w.find('input').setValue('ada@example.com')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain("You're already on the list.")
  })

  it('keeps the honeypot out of reach of people and assistive tech', async () => {
    const w = await mountSuspended(WaitlistForm)
    const trap = w.find('input[name="website"]')
    expect(trap.exists()).toBe(true)
    expect(trap.attributes('tabindex')).toBe('-1')
    expect(trap.attributes('autocomplete')).toBe('off')
    expect(trap.element.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
