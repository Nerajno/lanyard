import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import DetailPage from '~/pages/app/c/[id].vue'

mockNuxtImport('useContacts', () => () => ({
  contacts: ref([{
    id: 'c1', name: 'Sarah Jenkins', how_met: 'WebSummit', email: 's@example.com', phone: null,
    cadence_ladder: [{ value: 2, unit: 'day' }, { value: 14, unit: 'day' }, { value: 45, unit: 'day' }],
    touchpoints_done: 2, status: 'active',
  }]),
  loading: ref(false), update: vi.fn(), remove: vi.fn(),
}))

mockNuxtImport('useRoute', () => () => ({
  params: { id: 'c1' },
  query: {},
  path: '/app/c/c1',
}))

describe('contact detail', () => {
  it('shows the header, form and a danger delete', async () => {
    const w = await mountSuspended(DetailPage, { route: '/app/c/c1' })
    expect(w.find('h1').text()).toBe('Sarah Jenkins')
    expect(w.find('[aria-label="2 of 3 coffees"]').exists()).toBe(true)
    expect((w.find('#name').element as HTMLInputElement).value).toBe('Sarah Jenkins')
    const del = w.findAll('button').find((b) => b.text() === 'Delete Sarah Jenkins')!
    expect(del.classes()).toContain('text-error')
  })
})
