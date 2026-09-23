<template>
  <div class="min-h-screen bg-paper pb-16 text-ink md:pb-0">
    <!-- Top nav (≥ md) -->
    <header v-if="!isOnboarding" class="border-b border-line bg-surface">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <NuxtLink to="/app"><BrandMark /></NuxtLink>
        <nav class="flex items-center gap-6 text-sm">
          <NuxtLink to="/app" class="text-label-caps uppercase text-muted transition hover:text-accent">Due</NuxtLink>
          <NuxtLink to="/app/add" class="text-label-caps uppercase text-muted transition-colors hover:text-accent">Add</NuxtLink>
          <NuxtLink to="/app/settings" class="text-label-caps uppercase text-muted transition-colors hover:text-accent">Settings</NuxtLink>
          <NuxtLink to="/app/stats" class="text-label-caps uppercase text-muted transition-colors hover:text-accent">Stats</NuxtLink>
          <button
            class="border-line bg-surface text-ink hover:border-accent flex h-8 w-8 items-center justify-center rounded-full border text-sm"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme"
          >{{ isDark ? '☀' : '☾' }}</button>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-8">
      <slot />
    </main>

    <!-- Bottom tab bar (< md) -->
    <nav v-if="!isOnboarding" class="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface md:hidden">
      <div class="mx-auto flex max-w-3xl items-center justify-around">
        <NuxtLink to="/app" class="flex flex-1 flex-col items-center gap-0.5 py-3 text-label-caps uppercase text-muted transition hover:text-accent">Due</NuxtLink>
        <NuxtLink to="/app/add" class="flex flex-1 flex-col items-center gap-0.5 py-3 text-label-caps uppercase text-accent">Add</NuxtLink>
        <NuxtLink to="/app/settings" class="flex flex-1 flex-col items-center gap-0.5 py-3 text-label-caps uppercase text-muted transition hover:text-accent">Settings</NuxtLink>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { isDark, toggle: toggleTheme } = useTheme()
const isOnboarding = computed(() => route.path === '/app/onboarding')
</script>