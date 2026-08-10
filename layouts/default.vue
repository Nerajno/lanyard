<template>
  <div class="min-h-screen bg-paper text-ink">
    <header class="border-b border-line bg-surface">
      <div class="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-4">
        <NuxtLink to="/"><BrandMark /></NuxtLink>
        <nav class="flex items-center gap-6 text-sm">
          <NuxtLink to="/pricing" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral">Pricing</NuxtLink>
          <template v-if="user">
            <NuxtLink to="/app" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral">Open app</NuxtLink>
            <span class="hidden font-mono text-xs text-muted sm:inline">{{ user.email }}</span>
          </template>
          <template v-else>
            <NuxtLink to="/login" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral">Log in</NuxtLink>
            <NuxtLink to="/early-access" class="rounded-lg bg-coral px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-coral-press">Get early access</NuxtLink>
          </template>
          <button
            class="border-line bg-surface text-ink hover:border-coral flex h-8 w-8 items-center justify-center rounded-full border text-sm"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme"
          >{{ isDark ? '☀' : '☾' }}</button>
        </nav>
      </div>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const { user } = storeToRefs(auth)
const { isDark, toggle: toggleTheme } = useTheme()
</script>