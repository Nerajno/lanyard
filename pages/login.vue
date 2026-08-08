<template>
  <div class="mx-auto max-w-sm">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Sign in</h1>
    <p class="mt-1 text-sm text-muted">We email you a magic link — no password to remember.</p>

    <form class="mt-6 space-y-4" @submit.prevent="send">
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
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
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