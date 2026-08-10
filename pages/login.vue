<template>
  <div class="mx-auto max-w-sm">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Sign in</h1>

    <div class="mt-6 space-y-4">
      <OAuthButtons />

      <div class="flex items-center gap-3 text-muted">
        <span class="h-px flex-1 bg-line"></span>
        <span class="font-mono text-xs uppercase tracking-eyebrow">or</span>
        <span class="h-px flex-1 bg-line"></span>
      </div>

      <div class="flex rounded-lg border border-line bg-surface p-1">
        <button
          type="button"
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="tab === 'password' ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'"
          @click="tab = 'password'"
        >
          Password
        </button>
        <button
          type="button"
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="tab === 'magic' ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'"
          @click="tab = 'magic'"
        >
          Magic link
        </button>
      </div>

      <PasswordAuthForm v-if="tab === 'password'" />

      <form v-else class="space-y-4" @submit.prevent="send">
        <div>
          <label class="text-sm font-medium text-ink" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
            placeholder="you@example.com"
          >
        </div>

        <p v-if="sent" class="text-sm text-graduated">Check your inbox for the sign-in link.</p>
        <p v-if="error" class="text-sm text-coral">{{ error }}</p>

        <button
          type="submit"
          :disabled="sending"
          class="w-full rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:opacity-50"
        >
          {{ sending ? 'Sending…' : 'Send magic link' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const tab = ref<'password' | 'magic'>('password')
const email = ref('')
const sending = ref(false)
const error = ref<string | null>(null)
const sent = ref(false)

async function send() {
  sending.value = true
  error.value = null
  sent.value = false
  try {
    await auth.signInWithEmail(email.value)
    sent.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    sending.value = false
  }
}
</script>
