import { describe, it, expect, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import AppLayout from '~/layouts/app.vue'

// The app middleware redirects signed-out test mounts to /login, so the layout's
// view of the route is mocked instead of navigated.
const state = vi.hoisted(() => ({ path: '/app' }))
mockNuxtImport('useRoute', () => () => ({ path: state.path }))

async function mount(path: string) {
  state.path = path
  return mountSuspended(AppLayout, { slots: { default: () => 'page' } })
}

describe('app layout', () => {
  it('renders the four destinations in both navs', async () => {
    const w = await mount('/app')
    const navs = w.findAll('nav')
    expect(navs).toHaveLength(2)
    for (const nav of navs) {
      expect(nav.findAll('a').map((a) => a.text())).toEqual(['Queue', 'Add', 'Stats', 'Settings'])
    }
  })

  it('marks the current route', async () => {
    const w = await mount('/app/settings')
    const current = w.findAll('a[aria-current="page"]').map((a) => a.text())
    expect(current).toEqual(['Settings', 'Settings'])
  })

  it('hides navigation during onboarding', async () => {
    const w = await mount('/app/onboarding')
    expect(w.findAll('nav')).toHaveLength(0)
  })

  it('labels the theme toggle', async () => {
    const w = await mount('/app')
    expect(w.find('button[aria-label*="mode"]').exists()).toBe(true)
  })
})
