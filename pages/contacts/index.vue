<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Contacts</h1>
      <NuxtLink to="/add" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
        Add
      </NuxtLink>
    </div>

    <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>

    <!-- Empty state -->
    <div v-if="!loading && contacts.length === 0" class="mt-16 text-center">
      <p class="text-slate-500">No contacts yet.</p>
      <NuxtLink to="/add" class="inline-block mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
        Add your first contact
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Active / triage -->
      <section class="mt-6">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Active</h2>
        <div v-if="active.length" class="mt-3 grid gap-4 sm:grid-cols-2">
          <ContactCard
            v-for="contact in active"
            :key="contact.id"
            :contact="contact"
            @follow-up="onFollowUp"
            @snooze="onSnooze"
            @archive="onArchive"
            @delete="onDelete"
            @remind="onRemind(contact, $event)"
          />
        </div>
        <p v-else class="mt-3 text-sm text-slate-500">Nothing on the docket. Add a contact or wait for the next rung.</p>
      </section>

      <!-- Graduated -->
      <div v-if="graduated.length" class="mt-10">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Graduated</h2>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          <ContactCard v-for="contact in graduated" :key="contact.id" :contact="contact" @delete="onDelete" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Contact, LadderRung } from '~/types'

definePageMeta({ middleware: 'auth' })

const { contacts, loading, error, markFollowedUp, snoozeContact, archive, remove, remindContact } = useContacts()

const active = computed(() =>
  [...contacts.value].filter((c) => c.status === 'active').sort((a, b) => a.follow_up_by.localeCompare(b.follow_up_by)),
)
const graduated = computed(() => contacts.value.filter((c) => c.status === 'graduated'))

async function onFollowUp(c: Contact) {
  await run(markFollowedUp(c.id))
}
async function onSnooze(c: Contact) {
  await run(snoozeContact(c.id))
}
async function onArchive(c: Contact) {
  await run(archive(c.id))
}
async function onDelete(c: Contact) {
  if (!confirm(`Delete ${c.name}?`)) return
  await run(remove(c.id))
}
async function onRemind(c: Contact, rung: LadderRung) {
  await run(remindContact(c.id, rung))
}

async function run(p: Promise<void>) {
  try {
    await p
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>