<template>
  <div>
    <div class="flex items-center justify-between gap-3">
      <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Queue</h1>
      <div class="flex rounded-lg border border-line bg-surface p-1 text-sm">
        <NuxtLink
          to="/app" class="inline-flex min-h-9 items-center rounded-md px-3 font-medium"
          :class="!showGraduated ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
          :aria-current="!showGraduated ? 'page' : undefined"
        >Due</NuxtLink>
        <NuxtLink
          to="/app?filter=graduated" class="inline-flex min-h-9 items-center rounded-md px-3 font-medium"
          :class="showGraduated ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
          :aria-current="showGraduated ? 'page' : undefined"
        >Graduated</NuxtLink>
      </div>
    </div>

    <p v-if="error" role="alert" class="mt-4 rounded-lg bg-error-soft px-3 py-2 text-sm text-error">{{ error }}</p>

    <UiEmptyState
      v-if="!loading && contacts.length === 0" class="mt-8"
      title="Met someone? Add them." body="We'll nudge you before it cools."
    >
      <template #action><UiButton to="/app/add">Add your first contact</UiButton></template>
    </UiEmptyState>

    <template v-else-if="!showGraduated">
      <UiEmptyState v-if="caughtUp" class="mt-6" title="All caught up" :body="nextNudgeLine" />

      <section v-for="g in sections" :key="g.key" class="mt-6">
        <UiSectionHeader :label="g.label" :count="g.items.length" :tone="g.tone" />
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <ContactCard
            v-for="c in g.items" :key="c.id" :contact="c"
            @message="onMessage" @mark-done="onMarkDone" @snooze="onSnooze" @archive="onArchive"
            @delete="onDelete" @remind="onRemind(c, $event)"
          />
        </div>
      </section>

      <p v-if="!caughtUp && sections.length === 0" class="mt-6 text-sm text-muted">Nothing on the docket. Add a contact or wait for the next rung.</p>
    </template>

    <section v-else class="mt-6">
      <UiSectionHeader label="Graduated" :count="graduated.length" />
      <div v-if="graduated.length" class="mt-3 grid gap-3 sm:grid-cols-2">
        <ContactCard v-for="c in graduated" :key="c.id" :contact="c" />
      </div>
      <p v-else class="mt-3 text-sm text-muted">No one has finished their three coffees yet.</p>
    </section>

    <UiToast :message="toast" />
  </div>
</template>

<script setup lang="ts">
import type { Contact, LadderRung } from '~/types'
import { followUpToast, groupQueue, localDayDiff } from '~/utils/queue'

definePageMeta({ layout: 'app', middleware: 'app' })

const { contacts, loading, error, markFollowedUp, snoozeContact, archive, remove, remindContact } = useContacts()
const route = useRoute()

const showGraduated = computed(() => route.query.filter === 'graduated')
const groups = computed(() => groupQueue(contacts.value))
const graduated = computed(() => contacts.value.filter((c) => c.status === 'graduated'))

const sections = computed(() => [
  { key: 'due', label: 'Due now', tone: 'due' as const, items: groups.value.due },
  { key: 'today', label: 'Later today', tone: 'warm' as const, items: groups.value.today },
  { key: 'upcoming', label: 'Upcoming', tone: 'muted' as const, items: groups.value.upcoming },
].filter((g) => g.items.length > 0))

const caughtUp = computed(() => groups.value.due.length === 0 && groups.value.today.length === 0 && groups.value.upcoming.length > 0)
const nextNudgeLine = computed(() => {
  const next = groups.value.upcoming[0]
  return next ? `Next nudge: ${next.name}, in ${localDayDiff(next.follow_up_by)}d` : ''
})

const toast = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(message: string | null) {
  if (!message) return
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 4000)
}
onBeforeUnmount(() => clearTimeout(toastTimer))

async function followUp(c: Contact, failureMessage?: string) {
  error.value = null
  try {
    const result = await markFollowedUp(c.id)
    showToast(followUpToast(result, c.cadence_ladder.length))
  } catch (e) {
    error.value = failureMessage ?? (e instanceof Error ? e.message : String(e))
  }
}

// Message is an <a href="sms:/mailto:">; the browser opens the composer and we
// log the touchpoint in the background. The error must survive the trip out.
function onMessage(c: Contact) {
  void followUp(c, "Couldn't log that follow-up. Use ⋯ › Mark done.")
}
function onMarkDone(c: Contact) {
  void followUp(c)
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

async function run(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>
