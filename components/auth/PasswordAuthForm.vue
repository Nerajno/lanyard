<template>
  <form class="space-y-4" @submit.prevent="submit">
    <UiField label="Email" input-id="email">
      <UiInput id="email" v-model="email" type="email" required autocomplete="email" placeholder="you@example.com" />
    </UiField>

    <div>
      <UiField label="Password" input-id="password">
        <UiInput id="password" v-model="password" type="password" required autocomplete="current-password" placeholder="••••••••" />
      </UiField>
      <button v-if="!forgotSent" type="button" class="mt-2 min-h-11 text-sm text-muted hover:text-ink hover:underline" @click="forgotPassword">
        Forgot password?
      </button>
      <p v-else class="mt-2 text-sm text-graduated">Check your inbox — we sent a reset link.</p>
    </div>

    <p v-if="notice" class="text-sm" :role="notice.tone === 'error' ? 'alert' : undefined" :class="notice.tone === 'error' ? 'text-error' : notice.tone === 'graduated' ? 'text-graduated' : 'text-muted'">
      {{ notice.text }}
    </p>

    <UiButton type="submit" block :disabled="loading">{{ buttonLabel }}</UiButton>

    <UiButton v-if="phase.phase === 'duplicate'" variant="ghost" block @click="backToSignIn">Back to sign in</UiButton>
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
      return { tone: 'error' as const, text: DUPLICATE_MESSAGE }
    case 'error':
      return { tone: 'error' as const, text: p.message }
    default:
      return null
  }
})
</script>
