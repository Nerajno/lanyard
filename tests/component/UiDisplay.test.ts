import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UiAvatar from '~/components/ui/Avatar.vue'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import UiEmptyState from '~/components/ui/EmptyState.vue'
import UiToast from '~/components/ui/Toast.vue'

describe('display primitives', () => {
  it('UiAvatar shows initials and hides from screen readers', async () => {
    const w = await mountSuspended(UiAvatar, { props: { name: 'Sarah Jenkins' } })
    expect(w.text()).toBe('SJ')
    expect(w.attributes('aria-hidden')).toBe('true')
  })

  it('UiSectionHeader renders the label, count and tone', async () => {
    const w = await mountSuspended(UiSectionHeader, { props: { label: 'Due now', count: 3, tone: 'due' } })
    expect(w.find('h2').text()).toContain('Due now')
    expect(w.text()).toContain('3')
    expect(w.find('h2').classes()).toContain('text-due')
  })

  it('UiEmptyState renders title, body and action slot', async () => {
    const w = await mountSuspended(UiEmptyState, {
      props: { title: 'All caught up', body: 'Next nudge: Elena, in 4d' },
      slots: { action: () => 'Add' },
    })
    expect(w.text()).toContain('All caught up')
    expect(w.text()).toContain('Next nudge: Elena, in 4d')
    expect(w.text()).toContain('Add')
  })

  it('UiToast renders a status only when there is a message', async () => {
    const empty = await mountSuspended(UiToast, { props: { message: null } })
    expect(empty.find('[role="status"]').text()).toBe('')
    const w = await mountSuspended(UiToast, { props: { message: 'Coffee 1 of 3 logged' } })
    expect(w.find('[role="status"]').text()).toBe('Coffee 1 of 3 logged')
  })
})
