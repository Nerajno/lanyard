<template>
  <div class="mx-auto max-w-xl">
    <h1 class="text-2xl font-bold">Add a contact</h1>
    <p class="mt-1 text-sm text-slate-500">Who you met, where you met, and a way to reach them.</p>

    <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
    <div class="mt-6">
      <ContactForm submit-label="Save contact" @submit="onSubmit" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ContactFormValues } from '~/components/ContactForm.vue'

definePageMeta({ middleware: 'auth' })

const { add } = useContacts()
const submitting = ref(false)
const error = ref<string | null>(null)

async function onSubmit(values: ContactFormValues) {
  if (submitting.value) return
  submitting.value = true
  error.value = null
  try {
    await add({
      name: values.name,
      how_met: values.how_met,
      email: values.email,
      phone: values.phone,
      ladderPreset: values.ladderPreset,
      customLadder: values.customLadder,
    })
    await navigateTo('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}
</script>