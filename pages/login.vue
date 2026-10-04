<template>
  <div class="mx-auto max-w-sm px-4 py-12">
    <div class="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Sign in</h1>

      <div class="mt-6 space-y-4">
        <AuthOAuthButtons />

        <div class="flex items-center gap-3 text-muted">
          <span class="h-px flex-1 bg-line"/>
          <span class="text-label-caps uppercase">or</span>
          <span class="h-px flex-1 bg-line"/>
        </div>

        <div class="grid grid-cols-2 gap-1 rounded-lg border border-line bg-paper p-1" role="tablist" aria-label="Sign-in method">
          <button
            type="button" role="tab" :aria-selected="tab === 'password'"
            class="min-h-9 rounded-md px-3 text-sm font-medium transition-colors"
            :class="tab === 'password' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'"
            @click="tab = 'password'"
          >Password</button>
          <button
            type="button" role="tab" :aria-selected="tab === 'magic'"
            class="min-h-9 rounded-md px-3 text-sm font-medium transition-colors"
            :class="tab === 'magic' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'"
            @click="tab = 'magic'"
          >Magic link</button>
        </div>

        <AuthPasswordAuthForm v-if="tab === 'password'" />

        <form v-else class="space-y-4" @submit.prevent="send">
          <UiField label="Email" input-id="email">
            <UiInput id="email" v-model="email" type="email" required autocomplete="email" placeholder="you@example.com" />
          </UiField>
          <p v-if="sent" class="text-sm text-graduated">Check your inbox for the sign-in link.</p>
          <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
          <UiButton type="submit" block :disabled="sending">{{ sending ? 'Sending…' : 'Send magic link' }}</UiButton>
        </form>
      </div>
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

watch(tab, () => {
  sent.value = false
  error.value = null
})

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
