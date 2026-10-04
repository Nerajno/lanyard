import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UiButton from '~/components/ui/Button.vue'

describe('UiButton', () => {
  it('renders a button with the primary classes by default', async () => {
    const w = await mountSuspended(UiButton, { slots: { default: () => 'Save' } })
    const el = w.find('button')
    expect(el.exists()).toBe(true)
    expect(el.attributes('type')).toBe('button')
    expect(el.classes()).toContain('bg-accent')
    expect(el.classes()).toContain('min-h-11')
    expect(el.text()).toBe('Save')
  })

  it('renders an <a> when given href', async () => {
    const w = await mountSuspended(UiButton, { props: { href: 'mailto:a@b.co' }, slots: { default: () => 'Message' } })
    expect(w.find('a').attributes('href')).toBe('mailto:a@b.co')
  })

  it('renders a NuxtLink when given to', async () => {
    const w = await mountSuspended(UiButton, { props: { to: '/app/add' }, slots: { default: () => 'Add' } })
    expect(w.find('a').attributes('href')).toBe('/app/add')
  })

  it('renders a disabled button instead of a link when disabled', async () => {
    const w = await mountSuspended(UiButton, { props: { href: 'mailto:a@b.co', disabled: true }, slots: { default: () => 'Message' } })
    expect(w.find('a').exists()).toBe(false)
    expect(w.find('button').attributes('disabled')).toBeDefined()
  })

  it('applies danger and block variants', async () => {
    const w = await mountSuspended(UiButton, { props: { variant: 'danger', block: true }, slots: { default: () => 'Delete' } })
    expect(w.find('button').classes()).toEqual(expect.arrayContaining(['text-error', 'w-full']))
  })

  it('forwards click listeners', async () => {
    let clicked = 0
    const w = await mountSuspended(UiButton, { attrs: { onClick: () => { clicked += 1 } }, slots: { default: () => 'Go' } })
    await w.find('button').trigger('click')
    expect(clicked).toBe(1)
  })
})
