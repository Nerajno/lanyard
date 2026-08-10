<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Settings</h1>

    <section class="mt-6">
      <h2 class="font-mono text-xs uppercase tracking-eyebrow text-muted">Nudges</h2>
      <div class="mt-3">
        <NudgePrefsForm @saved="onSaved" />
      </div>
    </section>

    <section class="mt-10">
      <h2 class="font-mono text-xs uppercase tracking-eyebrow text-muted">Appearance</h2>
      <button type="button" class="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-paper" @click="toggleTheme">
        Switch to {{ isDark ? 'light' : 'dark' }}
      </button>
    </section>

    <section class="mt-10">
      <h2 class="font-mono text-xs uppercase tracking-eyebrow text-muted">Account</h2>
      <p v-if="user" class="mt-2 text-sm text-muted">{{ user.email }}</p>
      <button type="button" class="mt-3 text-sm text-coral hover:underline" @click="onSignOut">Sign out</button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useProfile } from '~/composables/useProfile'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'app', middleware: 'app' })

const { profile, save } = useProfile()
const auth = useAuthStore()
const { user } = storeToRefs(auth)
const { isDark, toggle: toggleTheme } = useTheme()

async function onSaved() {
  if (!profile.value?.onboarded_at) {
    await save({ onboarded_at: new Date().toISOString() })
  }
  await navigateTo('/app/settings')
}

async function onSignOut() {
  await auth.signOut()
  await navigateTo('/')
}
</script>