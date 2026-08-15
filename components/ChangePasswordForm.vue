<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div>
      <label class="text-sm font-medium text-ink" for="current-password">Current password</label>
      <input
        id="current-password" v-model="currentPassword" type="password"
        autocomplete="current-password"
        class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
        placeholder="••••••••"
      >
      <p class="mt-1 text-xs text-muted">Leave blank if you signed in with Google, Apple, or a magic link.</p>
    </div>

    <div>
      <label class="text-sm font-medium text-ink" for="new-password">New password</label>
      <input
        id="new-password" v-model="newPassword" type="password" required minlength="8"
        autocomplete="new-password"
        class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
        placeholder="at least 8 characters"
      >
    </div>

    <div>
      <label class="text-sm font-medium text-ink" for="confirm-password">Confirm new password</label>
      <input
        id="confirm-password" v-model="confirmPassword" type="password" required
        autocomplete="new-password"
        class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
      >
    </div>

    <p v-if="error" class="text-sm text-coral">{{ error }}</p>
    <p v-if="success" class="text-sm text-graduated">Password updated. You've been signed out on your other devices.</p>

    <button
      type="submit" :disabled="busy"
      class="w-full rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:opacity-50"
    >
      {{ busy ? 'Updating…' : 'Update password' }}
    </button>
  </form>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

async function submit() {
  if (busy.value) return
  error.value = null
  success.value = false
  if (newPassword.value.length < 8) { error.value = 'New password must be at least 8 characters.'; return }
  if (newPassword.value !== confirmPassword.value) { error.value = 'New passwords do not match.'; return }
  if (currentPassword.value && currentPassword.value === newPassword.value) { error.value = 'New password must be different from the current one.'; return }
  busy.value = true
  try {
    await auth.changePassword(currentPassword.value, newPassword.value)
    success.value = true
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e) {
    const code = (e as { code?: string } | null)?.code
    if (code === 'reauthentication_needed') {
      error.value = "Sign in again, then retry — sessions older than 24 hours can't change the password."
    } else {
      const isBadCurrent = code === 'current_password_invalid' || code === 'current_password_required'
      error.value = isBadCurrent ? 'Current password is incorrect.' : (e instanceof Error ? e.message : String(e))
    }
  } finally {
    busy.value = false
  }
}
</script>