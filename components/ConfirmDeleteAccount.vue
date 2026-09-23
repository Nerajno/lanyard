<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
    <div class="w-full max-w-md rounded-2xl border border-line bg-surface p-6">
      <h3 id="delete-title" class="font-display text-xl font-bold">Delete your account?</h3>
      <ul class="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink">
        <li>Your contacts and nudge history are removed for good.</li>
        <li>We keep a one-way hash of numbers that opted out, so they're never texted again.</li>
        <li>Paid invoices, if any, stay on file.</li>
      </ul>
      <p class="mt-4 rounded-lg bg-error-soft px-3 py-2 text-xs text-error">
        You have 14 days to change your mind. Sign back in from the home page and we'll restore everything.
      </p>

      <button type="button" class="mt-4 text-sm text-accent hover:underline disabled:opacity-50" :disabled="downloading" @click="download">
        {{ downloading ? 'Preparing…' : 'Download my data' }}
      </button>

      <div class="mt-2">
        <label class="text-sm font-medium text-ink" for="confirm-email">Type your email to confirm</label>
        <input
          id="confirm-email" v-model="confirm" type="email" autocomplete="email"
          class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-accent focus:outline-none"
          :placeholder="userEmail || 'you@example.com'"
        >
      </div>

      <p v-if="error" class="mt-3 text-sm text-error">{{ error }}</p>

      <div class="mt-5 flex gap-2">
        <button type="button" class="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-paper" @click="$emit('close')">
          Keep my account
        </button>
        <button
          type="button" class="flex-1 rounded-lg bg-error px-3 py-2 text-sm font-medium text-on-error transition-colors hover:bg-error/90 disabled:opacity-50"
          :disabled="!matches || busy" @click="confirmDelete"
        >
          {{ busy ? 'Deleting…' : 'Delete my account' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDeleteAccount } from '~/composables/useDeleteAccount'

defineEmits<{ close: [] }>()

const auth = useAuthStore()
const userEmail = computed(() => auth.user?.email ?? '')

const confirm = ref('')
const matches = computed(() => confirm.value.trim().toLowerCase() === userEmail.value.trim().toLowerCase())
const busy = ref(false)
const downloading = ref(false)
const error = ref<string | null>(null)

const { requestDelete, clearSessionAndRedirect } = useDeleteAccount()

async function download() {
  downloading.value = true
  error.value = null
  try {
    const data = await $fetch('/api/account/export')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lanyard-data.json'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Could not download your data.'
  } finally {
    downloading.value = false
  }
}

async function confirmDelete() {
  busy.value = true
  error.value = null
  try {
    await requestDelete(confirm.value)
    await clearSessionAndRedirect()
  } catch (e) {
    busy.value = false
    error.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Deletion failed. Try again.'
  }
}
</script>