<template>
  <div class="mx-auto max-w-sm px-4 py-12">
    <div class="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <template v-if="ready">
        <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Set a new password</h1>
        <form class="mt-6 space-y-4" @submit.prevent="update">
          <UiField label="New password" input-id="pw" hint="At least 8 characters.">
            <UiInput id="pw" v-model="password" type="password" required minlength="8" autocomplete="new-password" />
          </UiField>
          <p v-if="message" class="text-sm" :role="updated ? undefined : 'alert'" :class="updated ? 'text-graduated' : 'text-error'">{{ message }}</p>
          <UiButton type="submit" block :disabled="busy">Update password</UiButton>
          <UiButton v-if="updated" variant="ghost" block @click="navigateTo('/login')">Back to sign in</UiButton>
        </form>
      </template>
      <p v-else class="text-sm text-muted">{{ message }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const sb = useSupabase()
const auth = useAuthStore()
const route = useRoute()

const ready = ref(false)
const busy = ref(false)
const updated = ref(false)
const message = ref('')
const password = ref('')

onMounted(async () => {
  const code = typeof route.query.code === 'string' ? route.query.code : undefined
  const token = typeof route.query.token_hash === 'string' ? route.query.token_hash : undefined
  try {
    if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(code)
      if (error) throw error
      ready.value = true
    } else if (token) {
      const { error } = await sb.auth.verifyOtp({ token_hash: token, type: 'recovery' })
      if (error) throw error
      ready.value = true
    } else {
      message.value = 'This password-reset link is invalid or has expired.'
    }
  } catch (e) {
    message.value = e instanceof Error ? e.message : String(e)
  }
})

async function update() {
  busy.value = true
  message.value = ''
  try {
    const { error } = await sb.auth.updateUser({ password: password.value })
    if (error) throw error
    await auth.signOut()
    updated.value = true
    message.value = 'Password updated. Sign in with your new password.'
  } catch (e) {
    message.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>
