import { describe, it, expect, vi, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UiMenu from '~/components/ui/Menu.vue'

const archive = vi.fn()
const remind15 = vi.fn()
const items = [
  { label: 'Set aside', onSelect: archive },
  { label: 'Nudge me later', children: [{ label: '15 min', onSelect: remind15 }] },
  { label: 'Delete', danger: true, separatorBefore: true, onSelect: vi.fn() },
]

async function mount() {
  return mountSuspended(UiMenu, { props: { items, label: 'More actions for Ada' }, attachTo: document.body })
}

afterEach(() => {
  archive.mockReset()
  remind15.mockReset()
  document.body.innerHTML = ''
})

describe('UiMenu', () => {
  it('is closed until the trigger is clicked', async () => {
    const w = await mount()
    const trigger = w.find('button[aria-haspopup="menu"]')
    expect(trigger.attributes('aria-label')).toBe('More actions for Ada')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(w.find('[role="menu"]').exists()).toBe(false)
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(w.findAll('[role="menuitem"]').map((i) => i.text())).toEqual(['Set aside', 'Nudge me later ›', 'Delete'])
  })

  it('focuses the first item on open and wraps with the arrow keys', async () => {
    const w = await mount()
    await w.find('button[aria-haspopup="menu"]').trigger('click')
    const menuItems = () => w.findAll('[role="menuitem"]')
    expect(document.activeElement).toBe(menuItems()[0].element)
    await w.find('[role="menu"]').trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(menuItems()[2].element)
    await w.find('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(menuItems()[0].element)
  })

  it('runs onSelect and closes', async () => {
    const w = await mount()
    await w.find('button[aria-haspopup="menu"]').trigger('click')
    await w.findAll('[role="menuitem"]')[0].trigger('click')
    expect(archive).toHaveBeenCalledOnce()
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const w = await mount()
    const trigger = w.find('button[aria-haspopup="menu"]')
    await trigger.trigger('click')
    await w.find('[role="menu"]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
  })

  it('opens a submenu with a Back item', async () => {
    const w = await mount()
    await w.find('button[aria-haspopup="menu"]').trigger('click')
    await w.findAll('[role="menuitem"]')[1].trigger('click')
    expect(w.findAll('[role="menuitem"]').map((i) => i.text())).toEqual(['‹ Back', '15 min'])
    await w.findAll('[role="menuitem"]')[1].trigger('click')
    expect(remind15).toHaveBeenCalledOnce()
  })

  it('closes on an outside pointerdown', async () => {
    const w = await mount()
    await w.find('button[aria-haspopup="menu"]').trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('styles danger items', async () => {
    const w = await mount()
    await w.find('button[aria-haspopup="menu"]').trigger('click')
    expect(w.findAll('[role="menuitem"]')[2].classes()).toContain('text-error')
  })
})
