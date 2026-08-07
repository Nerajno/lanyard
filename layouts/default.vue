<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <NuxtLink to="/" class="text-lg font-semibold tracking-tight">Lanyard</NuxtLink>
        <nav class="flex items-center gap-4 text-sm">
          <NuxtLink to="/contacts" class="text-slate-600 hover:text-slate-900">Contacts</NuxtLink>
          <NuxtLink to="/add" class="text-slate-600 hover:text-slate-900">Add</NuxtLink>
          <NuxtLink to="/settings" class="text-slate-600 hover:text-slate-900">Settings</NuxtLink>
          <NuxtLink to="/stats" class="text-slate-600 hover:text-slate-900">Stats</NuxtLink>
          <template v-if="user">
            <span class="text-slate-400">{{ user.email }}</span>
            <button class="text-slate-600 hover:text-slate-900" @click="signOut">Sign out</button>
          </template>
          <NuxtLink v-else to="/login" class="text-slate-600 hover:text-slate-900">Sign in</NuxtLink>
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