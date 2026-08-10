<template>
  <div class="mx-auto max-w-sm py-12">
    <template v-if="ready">
      <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Set a new password</h1>

      <form class="mt-6 space-y-4" @submit.prevent="update">
        <div>
          <label class="text-sm font-medium text-ink" for="pw">New password</label>
          <input
            id="pw"
            v-model="password"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
          >
        </div>

        <p v-if="message" class="text-sm text-coral">{{ message }}</p>

        <button
          type="submit"
          :disabled="busy"
          class="w-full rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:opacity-50"
        >
          Update password
        </button>

        <button v-if="updated" type="button" class="w-full text-sm text-muted hover:text-ink hover:underline" @click="navigateTo('/login')">
          Back to sign in
        </button>
      </form>
    </template>

    <p v-else class="text-sm text-muted">{{ message }}</p>
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
  const code = route.query.code as string | undefined
  const token = route.query.token_hash as string | undefined
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