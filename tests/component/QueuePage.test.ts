import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import QueuePage from '~/pages/app/index.vue'
import type { Contact } from '~/types'

const contacts = ref<Contact[]>([])
const error = ref<string | null>(null)
const markFollowedUp = vi.fn()
// The app middleware redirects signed-out test mounts to /login (dropping the query), so mock the route.
const routeState = vi.hoisted(() => ({ query: {} as Record<string, string> }))
mockNuxtImport('useRoute', () => () => ({ path: '/app', query: routeState.query }))

mockNuxtImport('useContacts', () => () => ({
  contacts, loading: ref(false), error, markFollowedUp,
  snoozeContact: vi.fn(), archive: vi.fn(), remove: vi.fn(), remindContact: vi.fn(),
}))

function makeContact(over: Partial<Contact>): Contact {
  const now = new Date()
  return {
    id: 'c', user_id: 'u', name: 'Ada', how_met: 'Met at X', email: 'ada@example.com', phone: null,
    cadence_ladder: [{ value: 2, unit: 'day' }, { value: 14, unit: 'day' }, { value: 45, unit: 'day' }],
    touchpoints_done: 0, follow_up_by: now.toISOString(), remind_at: null, status: 'active',
    created_at: now.toISOString(), updated_at: now.toISOString(), ...over,
  } as Contact
}

const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  contacts.value = []
  error.value = null
  markFollowedUp.mockReset()
  routeState.query = {}
})

describe('queue page', () => {
  it('shows the first-run empty state with no contacts', async () => {
    const w = await mountSuspended(QueuePage, { route: '/app' })
    expect(w.text()).toContain('Met someone? Add them.')
  })

  it('groups contacts under Due now and Upcoming', async () => {
    contacts.value = [
      makeContact({ id: 'a', name: 'Due Person', follow_up_by: new Date(Date.now() - DAY).toISOString() }),
      makeContact({ id: 'b', name: 'Later Person', follow_up_by: new Date(Date.now() + 5 * DAY).toISOString() }),
    ]
    const w = await mountSuspended(QueuePage, { route: '/app' })
    const headings = w.findAll('h2').map((h) => h.text())
    expect(headings.some((t) => t.startsWith('Due now'))).toBe(true)
    expect(headings.some((t) => t.startsWith('Upcoming'))).toBe(true)
    expect(w.text()).not.toContain('All caught up')
  })

  it('shows All caught up when only upcoming contacts remain', async () => {
    contacts.value = [makeContact({ id: 'b', name: 'Elena', follow_up_by: new Date(Date.now() + 4 * DAY).toISOString() })]
    const w = await mountSuspended(QueuePage, { route: '/app' })
    expect(w.text()).toContain('All caught up')
    expect(w.text()).toContain('Next nudge: Elena, in 4d')
  })

  it('shows a toast after Message advances the ladder', async () => {
    contacts.value = [makeContact({ id: 'a', follow_up_by: new Date(Date.now() - DAY).toISOString() })]
    markFollowedUp.mockResolvedValue({ outcome: 'advanced', touchpointsDone: 1, followUpBy: new Date(Date.now() + 14 * DAY).toISOString() })
    const w = await mountSuspended(QueuePage, { route: '/app' })
    await w.find('a[data-test="message"]').trigger('click')
    await vi.waitFor(() => expect(w.find('[role="status"]').text()).toContain('Coffee 1 of 3 logged'))
  })

  it('keeps a recovery error when the background follow-up fails', async () => {
    contacts.value = [makeContact({ id: 'a', follow_up_by: new Date(Date.now() - DAY).toISOString() })]
    markFollowedUp.mockRejectedValue(new Error('network down'))
    const w = await mountSuspended(QueuePage, { route: '/app' })
    await w.find('a[data-test="message"]').trigger('click')
    await vi.waitFor(() => expect(w.find('[role="alert"]').text()).toContain("Couldn't log that follow-up. Use ⋯ › Mark done."))
  })

  it('lists graduated contacts under the Graduated filter', async () => {
    contacts.value = [makeContact({ id: 'g', name: 'Grad', status: 'graduated', touchpoints_done: 3 })]
    routeState.query = { filter: 'graduated' }
    const w = await mountSuspended(QueuePage, { route: '/app' })
    expect(w.text()).toContain('Grad')
    expect(w.text()).toContain('Graduated · 3 coffees')
  })
})
