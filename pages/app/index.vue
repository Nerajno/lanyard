<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Contacts</h1>
      <div class="flex items-center gap-2 text-sm">
        <NuxtLink to="/app" class="rounded-lg border px-3 py-1.5 font-mono text-xs uppercase tracking-eyebrow" :class="!showGraduated ? 'border-coral bg-coral-soft text-coral' : 'border-line bg-surface text-muted transition hover:text-coral'">Due</NuxtLink>
        <NuxtLink to="/app?filter=graduated" class="rounded-lg border px-3 py-1.5 font-mono text-xs uppercase tracking-eyebrow" :class="showGraduated ? 'border-coral bg-coral-soft text-coral' : 'border-line bg-surface text-muted transition hover:text-coral'">Graduated</NuxtLink>
        <NuxtLink to="/app/add" class="rounded-lg bg-coral px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-coral-press">
          Add
        </NuxtLink>
      </div>
    </div>

    <p v-if="error" class="mt-4 text-sm text-coral">{{ error }}</p>

    <!-- Empty state -->
    <div v-if="!loading && contacts.length === 0" class="mt-16 text-center">
      <p class="font-display text-xl font-bold tracking-[-0.02em]">Met someone? Add them.</p>
      <p class="mt-1 text-sm text-muted">We'll nudge you before it cools.</p>
      <NuxtLink to="/app/add" class="mt-3 inline-block rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press">
        Add your first contact
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Active / triage -->
      <section v-if="!showGraduated" class="mt-6">
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
      <section v-if="showGraduated" class="mt-6">
        <h2 class="font-mono text-xs uppercase tracking-eyebrow text-muted">Graduated</h2>
        <div v-if="graduated.length" class="mt-3 grid gap-4 sm:grid-cols-2">
          <ContactCard v-for="contact in graduated" :key="contact.id" :contact="contact" @delete="onDelete" />
        </div>
        <p v-else class="mt-3 text-sm text-muted">No one has finished their three coffees yet.</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Contact, LadderRung } from '~/types'

definePageMeta({ layout: 'app', middleware: 'app' })

const { contacts, loading, error, markFollowedUp, snoozeContact, archive, remove, remindContact } = useContacts()
const route = useRoute()

const active = computed(() =>
  [...contacts.value].filter((c) => c.status === 'active').sort((a, b) => a.follow_up_by.localeCompare(b.follow_up_by)),
)
const graduated = computed(() => contacts.value.filter((c) => c.status === 'graduated'))
const showGraduated = computed(() => route.query.filter === 'graduated')

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