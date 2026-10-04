<template>
  <div class="mx-auto max-w-xl space-y-6">
    <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Settings</h1>

    <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="nudges-heading">
      <h2 id="nudges-heading" class="text-label-caps uppercase text-ink">Nudges</h2>
      <div class="mt-4">
        <NudgePrefsForm @saved="onSaved" />
      </div>
    </section>

    <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="appearance-heading">
      <h2 id="appearance-heading" class="text-label-caps uppercase text-ink">Appearance</h2>
      <button type="button" class="mt-3 min-h-11 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink transition-colors hover:bg-paper" @click="toggleTheme">
        Switch to {{ isDark ? 'light' : 'dark' }}
      </button>
    </section>

    <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="account-heading">
      <h2 id="account-heading" class="text-label-caps uppercase text-ink">Account</h2>
      <p v-if="user" class="mt-2 text-sm text-muted">{{ user.email }}</p>
      <div class="mt-4 space-y-2">
        <button type="button" class="block text-sm text-accent hover:underline" @click="onSignOut">Sign out</button>
        <button type="button" class="block text-sm text-error hover:underline" @click="showDeleteConfirm = true">Delete account</button>
      </div>

      <div class="mt-6 rounded-lg border border-line bg-paper p-4" aria-labelledby="password-heading">
        <h3 id="password-heading" class="text-label-caps uppercase text-muted">Password</h3>
        <div class="mt-3">
          <ChangePasswordForm />
        </div>
      </div>
    </section>

    <ConfirmDeleteAccount v-if="showDeleteConfirm" @close="showDeleteConfirm = false" />
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
const showDeleteConfirm = ref(false)

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