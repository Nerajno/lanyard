<template>
  <div class="mx-auto max-w-xl space-y-6">
    <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Settings</h1>

    <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="s-nudges">
      <h2 id="s-nudges" class="font-display text-lg font-bold">Nudge preferences</h2>
      <p class="mt-1 text-sm text-muted">When and how Lanyard reminds you to follow up.</p>
      <div class="mt-4"><NudgePrefsForm @saved="onSaved" /></div>
    </section>

    <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="s-appearance">
      <h2 id="s-appearance" class="font-display text-lg font-bold">Appearance</h2>
      <UiButton variant="secondary" class="mt-3" @click="toggleTheme">
        <UiIcon :name="isDark ? 'sun' : 'moon'" /> Switch to {{ isDark ? 'light' : 'dark' }}
      </UiButton>
    </section>

    <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="s-account">
      <h2 id="s-account" class="font-display text-lg font-bold">Account</h2>
      <p v-if="user" class="mt-1 text-sm text-muted">{{ user.email }}</p>
      <UiButton variant="secondary" class="mt-3" @click="onSignOut">Sign out</UiButton>
      <div class="mt-6 border-t border-line pt-5">
        <h3 class="text-label-caps uppercase text-muted">Password</h3>
        <div class="mt-3"><ChangePasswordForm /></div>
      </div>
      <div class="mt-6 border-t border-line pt-5">
        <h3 class="text-label-caps uppercase text-error">Danger zone</h3>
        <UiButton variant="danger" class="mt-3" @click="showDeleteConfirm = true">Delete account</UiButton>
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