<template>
  <div class="mx-auto max-w-xl md:grid md:max-w-3xl md:grid-cols-[1fr_14rem] md:gap-8">
    <div>
      <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Add a contact</h1>
      <p class="mt-1 text-sm text-muted">Who you met, where you met, and a way to reach them.</p>
      <p v-if="error" role="alert" class="mt-4 rounded-lg bg-error-soft px-3 py-2 text-sm text-error">{{ error }}</p>
      <div class="mt-6">
        <ContactForm submit-label="Save contact" :suggestions="suggestions" autofocus @submit="onSubmit" />
      </div>
    </div>

    <aside class="mt-8 md:mt-14" aria-labelledby="other-ways">
      <h2 id="other-ways" class="text-label-caps uppercase text-muted">Other ways to add</h2>
      <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-1">
        <NuxtLink to="/app/add/link" class="rounded-xl border border-line bg-surface p-4 transition hover:border-accent">
          <p class="font-display text-sm font-bold">Share link</p>
          <p class="mt-1 text-xs text-muted">Send a link for them to fill in.</p>
        </NuxtLink>
        <NuxtLink to="/app/add/scan" class="rounded-xl border border-line bg-surface p-4 transition hover:border-accent">
          <p class="font-display text-sm font-bold">Scan</p>
          <p class="mt-1 text-xs text-muted">Badge or LinkedIn QR.</p>
        </NuxtLink>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ContactFormValues } from '~/components/ContactForm.vue'
import { recentHowMetPrefixes } from '~/utils/howMet'

definePageMeta({ layout: 'app', middleware: 'app' })

const { add, contacts } = useContacts()
const submitting = ref(false)
const error = ref<string | null>(null)

const suggestions = computed(() => recentHowMetPrefixes(contacts.value))

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
    await navigateTo('/app')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}
</script>
