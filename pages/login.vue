<template>
  <div class="mx-auto max-w-sm">
    <h1 class="text-2xl font-bold">Sign in</h1>
    <p class="mt-1 text-sm text-slate-500">We email you a magic link — no password to remember.</p>

    <form class="mt-6 space-y-4" @submit.prevent="send">
      <div>
        <label class="text-sm font-medium" for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="you@example.com"
        >
      </div>

      <p v-if="sent" class="text-sm text-emerald-700">Check your inbox for the sign-in link.</p>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <button
        type="submit"
        :disabled="sending"
        class="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
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