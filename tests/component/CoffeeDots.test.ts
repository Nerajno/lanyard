import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CoffeeDots from '~/components/CoffeeDots.vue'

describe('CoffeeDots', () => {
  it('renders filled/total coffees', async () => {
    const wrapper = await mountSuspended(CoffeeDots, { props: { filled: 2 } })
    expect(wrapper.text()).toContain('2/3 coffees')
    expect(wrapper.findAll('span.inline-block')).toHaveLength(3)
  })

  it('marks all dots graduated at total', async () => {
    const wrapper = await mountSuspended(CoffeeDots, { props: { filled: 3 } })
    expect(wrapper.text()).toContain('3/3 coffees')
    expect(wrapper.findAll('span.bg-graduated')).toHaveLength(3)
  })

  it('shows empty dots when nothing filled', async () => {
    const wrapper = await mountSuspended(CoffeeDots, { props: { filled: 0 } })
    expect(wrapper.findAll('span.bg-line')).toHaveLength(3)
  })

  it('supports a custom total', async () => {
    const wrapper = await mountSuspended(CoffeeDots, { props: { filled: 1, total: 5 } })
    expect(wrapper.text()).toContain('1/5 coffees')
    expect(wrapper.findAll('span.inline-block')).toHaveLength(5)
  })
})