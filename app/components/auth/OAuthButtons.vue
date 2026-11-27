<template>
  <div class="space-y-3">
    <UiButton variant="secondary" block :disabled="loading" @click="start('google')">Continue with Google</UiButton>
    <UiButton variant="secondary" block :disabled="loading" @click="start('apple')">Continue with Apple</UiButton>
    <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
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
