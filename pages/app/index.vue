<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Contacts</h1>
      <NuxtLink to="/add" class="rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press">
        Add
      </NuxtLink>
    </div>

    <p v-if="error" class="mt-4 text-sm text-coral">{{ error }}</p>

    <!-- Empty state -->
    <div v-if="!loading && contacts.length === 0" class="mt-16 text-center">
      <p class="font-display text-xl font-bold tracking-[-0.02em]">Met someone? Add them.</p>
      <p class="mt-1 text-sm text-muted">We'll nudge you before it cools.</p>
      <NuxtLink to="/add" class="mt-3 inline-block rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press">
        Add your first contact
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Active / triage -->
      <section class="mt-6">
        <h2 class="font-mono text-xs uppercase tracking-eyebrow text-muted">Active</h2>
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
        <p v-else class="mt-3 text-sm text-muted">Nothing on the docket. Add a contact or wait for the next rung.</p>
      </section>

      <!-- Graduated -->
      <div v-if="graduated.length" class="mt-10">
        <h2 class="font-mono text-xs uppercase tracking-eyebrow text-muted">Graduated</h2>
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