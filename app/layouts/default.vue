<template>
  <div class="flex min-h-screen flex-col bg-paper text-ink">
    <header class="sticky top-0 z-50 border-b border-line/60 bg-paper/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-[1024px] items-center justify-between gap-4 px-4">
        <BrandMark />

        <nav class="hidden items-center gap-4 md:flex" aria-label="Primary">
          <NuxtLink
            v-for="link in sectionLinks"
            :key="link.to"
            :to="link.to"
            class="text-body-lg text-ink-2 transition-colors duration-200 hover:text-accent"
          >{{ link.label }}</NuxtLink>
        </nav>

        <div class="flex items-center gap-3">
          <template v-if="user">
            <NuxtLink to="/app" class="text-body-sm hidden text-ink-2 transition-colors hover:text-accent sm:inline">Open app</NuxtLink>
            <span class="text-body-sm hidden text-muted lg:inline">{{ user.email }}</span>
          </template>
          <template v-else>
            <NuxtLink to="/login" class="text-body-sm hidden text-ink-2 transition-colors hover:text-accent sm:inline">Log in</NuxtLink>
            <NuxtLink to="/early-access" class="text-action rounded bg-accent px-4 py-2 text-on-accent transition-opacity hover:opacity-80">Get started</NuxtLink>
          </template>

          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-sm text-ink hover:border-accent"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme"
          >{{ isDark ? '☀' : '☾' }}</button>

          <button
            id="mobile-nav-toggle"
            class="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-sm text-ink hover:border-accent md:hidden"
            :aria-expanded="menuOpen"
            aria-controls="mobile-nav"
            :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
            @click="menuOpen = !menuOpen"
          >{{ menuOpen ? '✕' : '☰' }}</button>
        </div>
      </div>

      <nav
        v-if="menuOpen"
        id="mobile-nav"
        class="border-t border-line bg-surface md:hidden"
        aria-label="Primary mobile"
      >
        <div class="mx-auto flex max-w-[1024px] flex-col px-4 py-2">
          <NuxtLink
            v-for="link in mobileLinks"
            :key="link.to"
            :to="link.to"
            class="text-body-lg border-b border-line py-3 text-ink-2 transition-colors last:border-b-0 hover:text-accent"
          >{{ link.label }}</NuxtLink>
        </div>
      </nav>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="mt-auto border-t border-line bg-surface">
      <div class="mx-auto flex max-w-[1024px] flex-col items-center justify-between gap-4 px-4 py-6 md:flex-row">
        <BrandMark />
        <div class="flex flex-wrap justify-center gap-2 md:gap-4">
          <NuxtLink
            v-for="link in footerLinks"
            :key="link.to"
            :to="link.to"
            class="text-body-sm text-ink-2 transition-colors hover:text-accent"
          >{{ link.label }}</NuxtLink>
        </div>
        <div class="text-body-sm text-muted">© {{ year }} Lanyard · Progress over perfection</div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const { user } = storeToRefs(auth)
const { isDark, toggle: toggleTheme } = useTheme()
const route = useRoute()

const menuOpen = ref(false)

// Anchors are absolute so they resolve from /pricing, /about, etc — not just /.
const sectionLinks = [
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
]

const mobileLinks = computed(() => [
  ...sectionLinks,
  ...(user.value
    ? [{ to: '/app', label: 'Open app' }]
    : [{ to: '/login', label: 'Log in' }]),
])

const footerLinks = [
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#features', label: 'Features' },
  { to: '/#get', label: 'Early access' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
]

const year = new Date().getFullYear()

watch(() => route.fullPath, () => {
  menuOpen.value = false
})
</script>
