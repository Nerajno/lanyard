<template>
  <div class="min-h-screen bg-paper text-ink">
    <header class="border-b border-line bg-surface">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <BrandMark />
        <nav class="flex items-center gap-6 text-sm">
          <NuxtLink to="/contacts" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral">Contacts</NuxtLink>
          <NuxtLink to="/add" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition-colors hover:text-coral">Add</NuxtLink>
          <NuxtLink to="/settings" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition-colors hover:text-coral">Settings</NuxtLink>
          <NuxtLink to="/stats" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition-colors hover:text-coral">Stats</NuxtLink>
          <template v-if="user">
            <span class="hidden font-mono text-xs text-muted sm:inline">{{ user.email }}</span>
            <button class="font-mono text-xs uppercase tracking-eyebrow text-muted hover:text-coral" @click="signOut">Sign out</button>
          </template>
          <NuxtLink v-else to="/login" class="font-mono text-xs uppercase tracking-eyebrow text-muted hover:text-coral">Sign in</NuxtLink>
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-3xl px-4 py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const { user } = storeToRefs(auth)

async function signOut() {
  await auth.signOut()
  await navigateTo('/')
}
</script>