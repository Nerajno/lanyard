import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import AddPage from '~/pages/app/add/index.vue'

mockNuxtImport('useContacts', () => () => ({
  contacts: ref([{ how_met: 'WebSummit · coffee', created_at: '2026-10-03T00:00:00Z' }]),
  add: vi.fn(),
}))

describe('add page', () => {
  it('renders the capture form with recent chips and other ways to add', async () => {
    const w = await mountSuspended(AddPage, { route: '/app/add' })
    expect(w.find('h1').text()).toBe('Add a contact')
    expect(w.find('#name').exists()).toBe(true)
    expect(w.findAll('button').some((b) => b.text() === 'WebSummit')).toBe(true)
    const links = w.findAll('a').map((a) => a.attributes('href'))
    expect(links).toEqual(expect.arrayContaining(['/app/add/link', '/app/add/scan']))
  })
})
