import { describe, it, expect, vi, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ContactCard from '~/components/ContactCard.vue'
import { composerUrl } from '~/utils/composer'
import type { Contact } from '~/types'

const NOW = new Date(2026, 9, 3, 12, 0)

function makeContact(over: Partial<Contact> = {}): Contact {
  return {
    id: 'c1', user_id: 'u', name: 'Sarah Jenkins', how_met: 'WebSummit · talked Postgres', email: 'sarah@example.com', phone: null,
    cadence_ladder: [{ value: 2, unit: 'day' }, { value: 14, unit: 'day' }, { value: 45, unit: 'day' }],
    touchpoints_done: 1, follow_up_by: new Date(2026, 9, 1, 9).toISOString(), remind_at: null, status: 'active',
    created_at: NOW.toISOString(), updated_at: NOW.toISOString(), ...over,
  } as Contact
}

async function mount(contact: Contact) {
  return mountSuspended(ContactCard, { props: { contact, now: NOW }, attachTo: document.body })
}

async function openMenu(w: Awaited<ReturnType<typeof mount>>) {
  await w.find('button[aria-haspopup="menu"]').trigger('click')
  return w.findAll('[role="menuitem"]').map((i) => i.text())
}

afterEach(() => { vi.unstubAllGlobals() })

describe('ContactCard', () => {
  it('shows name, verbatim how_met, badge and coffee progress', async () => {
    const w = await mount(makeContact())
    expect(w.text()).toContain('Sarah Jenkins')
    expect(w.text()).toContain('WebSummit · talked Postgres')
    expect(w.text()).toContain('Overdue · 2d')
    expect(w.find('[aria-label="1 of 3 coffees"]').exists()).toBe(true)
  })

  it('links Message to the prefilled composer and emits message on click', async () => {
    const c = makeContact()
    const w = await mount(c)
    const link = w.find('a[data-test="message"]')
    expect(link.attributes('href')).toBe(composerUrl(c, c.how_met))
    await link.trigger('click')
    expect(w.emitted('message')![0]).toEqual([c])
  })

  it('makes Snooze primary for upcoming contacts and moves Message to the menu', async () => {
    const w = await mount(makeContact({ follow_up_by: new Date(2026, 9, 7).toISOString() }))
    expect(w.find('a[data-test="message"]').exists()).toBe(false)
    await w.find('button[data-test="snooze"]').trigger('click')
    expect(w.emitted('snooze')).toHaveLength(1)
    expect(await openMenu(w)).toContain('Message')
  })

  it('disables Message without a usable channel and promotes Edit', async () => {
    const w = await mount(makeContact({ email: 'bad@x.co?bcc=y@z.co', phone: null }))
    expect(w.find('a[data-test="message"]').exists()).toBe(false)
    expect(w.find('button[data-test="message"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Add a valid email or phone')
    expect(w.find('a[data-test="edit"]').attributes('href')).toBe('/app/c/c1')
    expect(w.find('a[data-test="edit"]').classes()).toContain('bg-accent')
  })

  it('lists the due-contact menu in order', async () => {
    const w = await mount(makeContact())
    expect(await openMenu(w)).toEqual(['Mark done', 'Nudge me later ›', 'Set aside', 'Edit', 'Delete'])
  })

  it('emits mark-done and remind from the menu', async () => {
    const w = await mount(makeContact())
    await openMenu(w)
    await w.findAll('[role="menuitem"]')[0].trigger('click')
    expect(w.emitted('mark-done')).toHaveLength(1)
    await openMenu(w)
    await w.findAll('[role="menuitem"]')[1].trigger('click')
    await w.findAll('[role="menuitem"]')[1].trigger('click') // "15 min"
    expect(w.emitted('remind')![0]).toEqual([{ value: 15, unit: 'min' }])
  })

  it('shows only Edit for graduated contacts', async () => {
    const w = await mount(makeContact({ status: 'graduated', touchpoints_done: 3 }))
    expect(w.text()).toContain('Graduated · 3 coffees')
    expect(w.find('[data-test="message"]').exists()).toBe(false)
    expect(await openMenu(w)).toEqual(['Edit'])
  })

  it('menu Message navigates to the composer without emitting message', async () => {
    const loc = { href: '' }
    vi.stubGlobal('location', loc)
    const c = makeContact({ follow_up_by: new Date(2026, 9, 7).toISOString() })
    const w = await mount(c)
    await openMenu(w)
    const item = w.findAll('[role="menuitem"]').find((i) => i.text() === 'Message')!
    await item.trigger('click')
    expect(loc.href).toBe(composerUrl(c, c.how_met))
    expect(w.emitted('message')).toBeUndefined()
  })
})
