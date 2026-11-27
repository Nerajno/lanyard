<template>
  <div>
    <form class="border-line bg-surface mx-auto flex max-w-xl items-center gap-2 rounded-xl border p-1.5" @submit.prevent="submit">
      <input
        v-model="email"
        type="email"
        required
        autocomplete="email"
        class="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-faint"
        placeholder="you@email.com"
        aria-label="Email address"
      >
      <button
        type="submit"
        :disabled="sending"
        class="shrink-0 rounded-[11px] bg-accent-press px-5 py-2.5 text-sm font-semibold text-on-accent transition-transform hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
      >
        {{ sending ? 'Sending…' : 'Get early access' }}
      </button>
    </form>
    <p class="font-mono mt-2 text-xs text-muted">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
const email = ref('')
const sending = ref(false)
const message = ref('')

async function submit() {
  if (sending.value) return
  if (!email.value.trim()) return
  sending.value = true
  message.value = ''
  try {
    await $fetch('/api/waitlist', { method: 'POST', body: { email: email.value } })
    message.value = "You're on the list — talk soon."
    email.value = ''
  } catch (e) {
    message.value = (e as any)?.data?.statusMessage ?? "Couldn't save that just now. Try again in a moment."
  } finally {
    sending.value = false
  }
}
</script>