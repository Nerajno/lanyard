<template>
  <div class="space-y-3">
    <button
      type="button"
      :disabled="loading"
      class="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
      @click="start('google')"
    >
      Continue with Google
    </button>
    <button
      type="button"
      :disabled="loading"
      class="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
      @click="start('apple')"
    >
      Continue with Apple
    </button>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const route = useRoute()
const loading = ref(false)
const error = ref<string | null>(null)

async function start(provider: 'google' | 'apple') {
  loading.value = true
  error.value = null
  try {
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : undefined
    await auth.signInWithProvider(provider, redirect)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
</script>
