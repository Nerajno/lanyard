<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Edit contact</h1>
    <p class="mt-1 text-sm text-muted">Update how you reach {{ contact?.name }}.</p>

    <p v-if="error" class="mt-4 text-sm text-coral">{{ error }}</p>
    <p v-else-if="!contact && !loading" class="mt-4 text-sm text-muted">Contact not found.</p>

    <div v-if="contact" class="mt-6 pb-8">
      <ContactForm
        submit-label="Save changes"
        :initial="initial"
        @submit="onSubmit"
      />
      <button
        class="mt-6 text-sm text-coral hover:underline"
        @click="onDelete"
      >
        Delete {{ contact.name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ContactFormValues } from '~/components/ContactForm.vue'
import { presetOf, resolveLadder } from '~/utils/cadence'

definePageMeta({ layout: 'app', middleware: 'app' })

const route = useRoute()
const { contacts, loading, update, remove } = useContacts()

const error = ref<string | null>(null)
const contact = computed(() => contacts.value.find((c) => c.id === route.params.id) ?? null)

const initial = computed<Partial<ContactFormValues> | null>(() => {
  if (!contact.value) return null
  return {
    name: contact.value.name,
    how_met: contact.value.how_met,
    email: contact.value.email,
    phone: contact.value.phone,
    ladderPreset: presetOf(contact.value.cadence_ladder),
    customLadder: contact.value.cadence_ladder,
  }
})

async function onSubmit(values: ContactFormValues) {
  error.value = null
  if (!contact.value) return
  try {
    await update(contact.value.id, {
      name: values.name,
      how_met: values.how_met,
      email: values.email,
      phone: values.phone,
      cadence_ladder: resolveLadder(values.ladderPreset, values.customLadder),
    })
    await navigateTo('/app')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function onDelete() {
  if (!contact.value) return
  if (!confirm(`Delete ${contact.value.name}?`)) return
  try {
    await remove(contact.value.id)
    await navigateTo('/app')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>