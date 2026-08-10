<template>
  <form class="space-y-4" @submit.prevent="submit">
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

    <div>
      <label class="text-sm font-medium text-ink" for="password">Password</label>
      <input
        id="password"
        v-model="password"
        type="password"
        required
        autocomplete="current-password"
        class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
        placeholder="••••••••"
      >
      <button
        v-if="!forgotSent"
        type="button"
        class="mt-2 text-sm text-muted hover:text-ink hover:underline"
        @click="forgotPassword"
      >
        Forgot password?
      </button>
      <p v-else class="mt-2 text-sm text-graduated">Check your inbox — we sent a reset link.</p>
    </div>

    <p v-if="notice" class="text-sm" :class="notice.tone === 'coral' ? 'text-coral' : notice.tone === 'graduated' ? 'text-graduated' : 'text-muted'">
      {{ notice.text }}
    </p>

    <button
      type="submit"
      :disabled="loading"
      class="w-full rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:opacity-50"
    >
      {{ buttonLabel }}
    </button>

    <button
      v-if="phase.phase === 'duplicate'"
      type="button"
      class="w-full text-sm text-muted hover:text-ink hover:underline"
      @click="backToSignIn"
    >
      Back to sign in
    </button>
  </form>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthForm } from '~/composables/useAuthForm'
import { CHECK_INBOX_MESSAGE, DUPLICATE_MESSAGE } from '~/utils/authSmartForm'

const { email, password, loading, phase, buttonLabel, forgotSent, submit, forgotPassword, backToSignIn } = useAuthForm()

const notice = computed(() => {
  const p = phase.value
  switch (p.phase) {
    case 'signup':
      return { tone: 'muted' as const, text: p.message }
    case 'confirm-email':
      return { tone: 'graduated' as const, text: CHECK_INBOX_MESSAGE }
    case 'duplicate':
      return { tone: 'coral' as const, text: DUPLICATE_MESSAGE }
    case 'error':
      return { tone: 'coral' as const, text: p.message }
    default:
      return null
  }
})
</script>
