<template>
  <div class="flex min-h-screen items-center justify-center bg-paper px-4 py-10 text-ink">
    <div class="w-full max-w-md">
      <div class="text-center">
        <BrandMark class="pointer-events-none" />
        <h1 class="font-display mt-4 text-2xl font-bold tracking-[-0.02em]">Let's stay in touch</h1>
        <p class="mt-1 text-sm text-muted">Add the details you're comfortable sharing — it becomes a follow-up for the person who sent this.</p>
      </div>

      <p v-if="loading" class="mt-6 rounded-xl border border-line bg-surface p-5 text-center text-sm text-muted" role="status">Checking this link…</p>

      <p v-else-if="!valid" class="mt-6 rounded-xl border border-line bg-surface p-5 text-center text-sm text-muted">This link has expired or was already used.</p>

      <div v-else-if="done" class="mt-6 rounded-xl border border-graduated bg-surface p-6 text-center" role="status">
        <span class="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent"><UiIcon name="check" /></span>
        <p class="mt-3 font-display text-lg font-bold">Saved — thanks, {{ doneName }}</p>
        <p class="mt-1 text-sm text-muted">They'll be prompted to follow up with you.</p>
      </div>

      <form v-else class="mt-6 space-y-4 rounded-xl border border-line bg-surface p-5 shadow-sm" novalidate @submit.prevent="submit">
        <p v-if="submitError" role="alert" class="text-sm text-error">{{ submitError }}</p>
        <UiField label="Name" input-id="name" required>
          <UiInput id="name" v-model="name" placeholder="Ada Lovelace" />
        </UiField>
        <UiField label="How you met" input-id="how_met" required>
          <UiInput id="how_met" v-model="howMet" as="textarea" :placeholder="howMetDefault || 'Where did you run into each other?'" />
        </UiField>
        <div class="space-y-3">
          <UiField label="Email" input-id="email">
            <UiInput id="email" v-model="email" type="email" :invalid="!hasChannel && touched" />
          </UiField>
          <UiField label="Phone" input-id="phone">
            <UiInput id="phone" v-model="phone" type="tel" placeholder="+1 555 000 0000" :invalid="!hasChannel && touched" />
          </UiField>
        </div>
        <p v-if="!hasChannel && touched" class="text-sm text-error">Add an email or a phone number.</p>
        <UiButton type="submit" block :disabled="submitting">{{ submitting ? 'Saving…' : 'Save it' }}</UiButton>
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