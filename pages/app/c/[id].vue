<template>
  <div class="mx-auto max-w-xl">
    <p v-if="error" role="alert" class="rounded-lg bg-error-soft px-3 py-2 text-sm text-error">{{ error }}</p>
    <p v-else-if="!contact && !loading" class="text-sm text-muted">Contact not found.</p>

    <template v-if="contact">
      <header class="flex items-center gap-3">
        <UiAvatar :name="contact.name" />
        <div class="min-w-0">
          <h1 class="truncate font-display text-2xl font-bold tracking-[-0.02em]">{{ contact.name }}</h1>
          <CoffeeDots :filled="coffeeProgress(contact.cadence_ladder, contact.touchpoints_done)" />
        </div>
      </header>

      <div class="mt-6">
        <ContactForm submit-label="Save changes" :initial="initial" @submit="onSubmit" />
      </div>

      <div class="mt-10 border-t border-line pt-6 pb-8">
        <h2 class="text-label-caps uppercase text-muted">Danger</h2>
        <UiButton variant="danger" class="mt-3" @click="onDelete">Delete {{ contact.name }}</UiButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ContactFormValues } from '~/components/ContactForm.vue'
import { coffeeProgress, presetOf, resolveLadder } from '~/utils/cadence'

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