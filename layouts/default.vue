<template>
  <div class="flex min-h-screen flex-col bg-paper text-ink">
    <header class="border-line bg-paper/85 sticky top-0 z-50 border-b backdrop-blur">
      <div class="mx-auto flex h-16 max-w-[1080px] items-center justify-between gap-4 px-6">
        <BrandMark />

        <nav class="hidden items-center gap-6 md:flex" aria-label="Primary">
          <NuxtLink
            v-for="link in sectionLinks"
            :key="link.to"
            :to="link.to"
            class="font-mono text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral"
          >{{ link.label }}</NuxtLink>
        </nav>

        <div class="flex items-center gap-3">
          <template v-if="user">
            <NuxtLink to="/app" class="font-mono hidden text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral sm:inline">Open app</NuxtLink>
            <span class="font-mono hidden text-xs text-muted lg:inline">{{ user.email }}</span>
          </template>
          <template v-else>
            <NuxtLink to="/login" class="font-mono hidden text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral sm:inline">Log in</NuxtLink>
            <NuxtLink to="/early-access" class="rounded-lg bg-coral px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-coral-press">Get early access</NuxtLink>
          </template>

          <button
            class="border-line bg-surface text-ink hover:border-coral flex h-8 w-8 items-center justify-center rounded-full border text-sm"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme"
          >{{ isDark ? '☀' : '☾' }}</button>

          <button
            id="mobile-nav-toggle"
            class="border-line bg-surface text-ink hover:border-coral flex h-8 w-8 items-center justify-center rounded-full border text-sm md:hidden"
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
        class="border-line bg-surface border-t md:hidden"
        aria-label="Primary mobile"
      >
        <div class="mx-auto flex max-w-[1080px] flex-col px-6 py-2">
          <NuxtLink
            v-for="link in mobileLinks"
            :key="link.to"
            :to="link.to"
            class="font-mono border-line border-b py-3 text-xs uppercase tracking-eyebrow text-muted transition last:border-b-0 hover:text-coral"
          >{{ link.label }}</NuxtLink>
        </div>
      </nav>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-line border-t py-10">
      <div class="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 px-6">
        <div class="font-display text-[15px] font-bold">
          lanyard<span class="text-coral">.</span> · Progress over perfection
        </div>
        <div class="flex flex-wrap gap-5 text-sm text-muted">
          <NuxtLink
            v-for="link in footerLinks"
            :key="link.to"
            :to="link.to"
            class="hover:text-coral"
          >{{ link.label }}</NuxtLink>
        </div>
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
  { to: '/#features', label: 'What it does' },
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
  { to: '/#features', label: 'What it does' },
  { to: '/#get', label: 'Early access' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
]

watch(() => route.fullPath, () => {
  menuOpen.value = false
})
</script>
