import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import SharePage from '~/pages/share/[token].vue'

registerEndpoint('/api/share/t1', { method: 'GET', handler: () => ({ valid: true, how_met_default: 'Hallway track' }) })

describe('share page', () => {
  it('renders the form on the new primitives and shows the channel error only after submit', async () => {
    const w = await mountSuspended(SharePage, { route: '/share/t1' })
    await flushPromises()
    await vi.waitFor(() => expect(w.find('#name').exists()).toBe(true))
    expect(w.find('label[for="name"]').text()).toContain('Name')
    expect(w.find('#how_met').attributes('placeholder')).toBe('Hallway track')
    expect(w.text()).not.toContain('Add an email or a phone number.')
    await w.find('#name').setValue('Ada')
    await w.find('#how_met').setValue('Hallway')
    await w.find('form').trigger('submit')
    expect(w.text()).toContain('Add an email or a phone number.')
  })
})
