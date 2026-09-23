<template>
  <div class="flex min-h-screen items-center justify-center bg-paper px-4 py-10 text-ink">
    <div class="w-full max-w-md">
      <div class="text-center">
        <BrandMark class="pointer-events-none" />
        <h1 class="font-display mt-4 text-2xl font-bold tracking-[-0.02em]">Let's stay in touch</h1>
        <p class="mt-1 text-sm text-muted">Add the details you're comfortable sharing — it becomes a follow-up for the person who sent this.</p>
      </div>

      <p v-if="loading" class="mt-6 rounded-xl border border-line bg-surface p-5 text-center text-sm text-muted">Checking this link…</p>

      <p v-else-if="!valid" class="mt-6 rounded-xl border border-line bg-surface p-5 text-center text-sm text-muted">This link has expired or was already used.</p>

      <div v-else-if="done" class="mt-6 rounded-xl border border-graduated bg-surface p-6 text-center">
        <p class="text-2xl">☕</p>
        <p class="font-display mt-2 text-lg font-bold">Saved — thanks, {{ doneName }}</p>
        <p class="mt-1 text-sm text-muted">They'll be prompted to follow up with you.</p>
      </div>

      <form v-else class="mt-6 space-y-4 rounded-xl border border-line bg-surface p-5" @submit.prevent="submit">
        <p v-if="submitError" class="text-sm text-error">{{ submitError }}</p>
        <div>
          <label class="text-sm font-medium text-ink" for="name">Name *</label>
          <input id="name" v-model="name" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-accent focus:outline-none" placeholder="Ada Lovelace">
        </div>
        <div>
          <label class="text-sm font-medium text-ink" for="how_met">How you met *</label>
          <textarea id="how_met" v-model="howMet" rows="2" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-accent focus:outline-none" :placeholder="howMetDefault || 'Where did you run into each other?'" />
        </div>
        <div class="flex flex-col gap-3 sm:flex-row">
          <div class="flex-1">
            <label class="text-sm font-medium text-ink" for="email">Email</label>
            <input id="email" v-model="email" type="email" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-accent focus:outline-none">
          </div>
          <div class="flex-1">
            <label class="text-sm font-medium text-ink" for="phone">Phone</label>
            <input id="phone" v-model="phone" type="tel" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-accent focus:outline-none" placeholder="+1 555 000 0000">
          </div>
        </div>
        <p v-if="!hasChannel && touched" class="text-sm text-error">Add an email or a phone number.</p>
        <button
          type="submit" :disabled="submitting || !valid"
          class="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-50"
        >{{ submitting ? 'Saving…' : 'Save it' }}</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const token = String(route.params.token)

const valid = ref(false)
const loading = ref(true)
const howMetDefault = ref('')
const name = ref('')
const howMet = ref('')
const email = ref('')
const phone = ref('')
const touched = ref(false)
const submitting = ref(false)
const submitError = ref('')
const done = ref(false)
const doneName = ref('')

const hasChannel = computed(() => Boolean(email.value.trim() || phone.value.trim()))
const validForm = computed(() => Boolean(name.value.trim() && howMet.value.trim()) && hasChannel.value)

onMounted(async () => {
  try {
    const data = await $fetch<{ valid: boolean; how_met_default?: string | null }>(`/api/share/${token}`)
    valid.value = data.valid
    howMetDefault.value = data.how_met_default ?? ''
  } catch {
    valid.value = false
  } finally {
    loading.value = false
  }
})

async function submit() {
  touched.value = true
  if (submitting.value || !validForm.value) return
  submitting.value = true
  submitError.value = ''
  try {
    const data = await $fetch<{ ok: boolean; name: string }>(`/api/share/${token}`, {
      method: 'POST',
      body: { name: name.value.trim(), how_met: howMet.value.trim(), email: email.value.trim() || null, phone: phone.value.trim() || null },
    })
    done.value = true
    doneName.value = data.name
  } catch (e: any) {
    submitError.value = e?.data?.statusMessage ?? 'Could not save that just now.'
  } finally {
    submitting.value = false
  }
}
</script>