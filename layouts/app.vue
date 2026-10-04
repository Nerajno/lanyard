<template>
  <div class="min-h-screen bg-paper pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-ink md:pb-0">
    <header v-if="!isOnboarding" class="sticky top-0 z-10 hidden border-b border-line bg-surface/95 backdrop-blur md:block">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <NuxtLink to="/app" aria-label="Lanyard home"><BrandMark /></NuxtLink>
        <div class="flex items-center gap-1">
          <nav class="flex items-center gap-1" aria-label="App">
            <NuxtLink
              v-for="link in links" :key="link.to" :to="link.to" :aria-current="isActive(link.to) ? 'page' : undefined"
              class="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors"
              :class="isActive(link.to) ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-paper hover:text-ink'"
            >
              <UiIcon :name="link.icon" />
              <span>{{ link.label }}</span>
            </NuxtLink>
          </nav>
          <button
            type="button"
            class="ml-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-accent"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme"
          >
            <UiIcon :name="isDark ? 'sun' : 'moon'" />
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-6 md:py-8">
      <slot />
    </main>

    <nav
      v-if="!isOnboarding" aria-label="App"
      class="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div class="mx-auto flex max-w-3xl items-stretch justify-around">
        <NuxtLink
          v-for="link in links" :key="link.to" :to="link.to" :aria-current="isActive(link.to) ? 'page' : undefined"
          class="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold"
          :class="isActive(link.to) ? 'text-accent' : 'text-muted'"
        >
          <span
            class="inline-flex h-8 w-12 items-center justify-center rounded-full"
            :class="link.to === '/app/add' ? 'bg-accent text-on-accent' : isActive(link.to) ? 'bg-accent-soft' : ''"
          >
            <UiIcon :name="link.icon" />
          </span>
          <span>{{ link.label }}</span>
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { isDark, toggle: toggleTheme } = useTheme()
const isOnboarding = computed(() => route.path === '/app/onboarding')

const links = [
  { to: '/app', label: 'Queue', icon: 'queue' },
  { to: '/app/add', label: 'Add', icon: 'plus' },
  { to: '/app/stats', label: 'Stats', icon: 'stats' },
  { to: '/app/settings', label: 'Settings', icon: 'settings' },
] as const

function isActive(to: string): boolean {
  if (to === '/app') return route.path === '/app' || route.path.startsWith('/app/c/')
  return route.path.startsWith(to)
}
</script>
