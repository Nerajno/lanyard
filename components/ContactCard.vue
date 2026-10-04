<template>
  <article class="rounded-xl border border-line bg-surface p-4 shadow-sm">
    <div class="flex items-start gap-3">
      <UiAvatar :name="contact.name" />
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <h3 class="truncate font-display text-base font-bold tracking-[-0.02em] text-ink">{{ contact.name }}</h3>
          <span class="shrink-0 rounded-full px-2.5 py-1 text-label-caps uppercase" :class="BADGE_TONES[badge.tone]">{{ badge.label }}</span>
        </div>
        <p class="mt-0.5 line-clamp-2 text-sm text-muted">{{ contact.how_met }}</p>
        <div class="mt-2"><CoffeeDots :filled="coffee" /></div>
      </div>
    </div>

    <footer class="mt-4 flex items-center gap-2">
      <template v-if="contact.status === 'active'">
        <template v-if="!usable">
          <UiButton data-test="message" disabled class="flex-1 sm:flex-none">Message</UiButton>
          <UiButton data-test="edit" variant="secondary" :to="editTo">Edit</UiButton>
        </template>
        <UiButton
          v-else-if="!isUpcoming" data-test="message" :href="composer" class="flex-1 sm:flex-none"
          @click="emit('message', contact)"
        >
          <UiIcon name="message" /> Message
        </UiButton>
        <UiButton v-else data-test="snooze" variant="secondary" class="flex-1 sm:flex-none" @click="emit('snooze', contact)">
          <UiIcon name="clock" /> Snooze
        </UiButton>
      </template>
      <p v-if="contact.status === 'active' && !usable" class="text-xs text-muted">Add a valid email or phone</p>
      <div class="ml-auto"><UiMenu :items="menuItems" :label="`More actions for ${contact.name}`" /></div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import type { Contact, LadderRung } from '~/types'
import type { MenuItem } from '~/components/ui/Menu.vue'
import { coffeeProgress } from '~/utils/cadence'
import { composerUrl, hasUsableChannel } from '~/utils/composer'
import { dueBadge, localDayDiff } from '~/utils/queue'

const props = defineProps<{ contact: Contact; now?: Date }>()
const emit = defineEmits<{
  message: [contact: Contact]
  'mark-done': [contact: Contact]
  snooze: [contact: Contact]
  archive: [contact: Contact]
  delete: [contact: Contact]
  remind: [rung: LadderRung]
}>()

const BADGE_TONES = {
  due: 'bg-due-soft text-due',
  warm: 'bg-warm-soft text-warm',
  muted: 'bg-sunken text-muted',
  graduated: 'bg-accent-soft text-graduated',
} as const

const nowRef = computed(() => props.now ?? new Date())
const coffee = computed(() => coffeeProgress(props.contact.cadence_ladder, props.contact.touchpoints_done))
const badge = computed(() => dueBadge(props.contact, nowRef.value))
const usable = computed(() => hasUsableChannel(props.contact))
const composer = computed(() => composerUrl(props.contact, props.contact.how_met))
const editTo = computed(() => `/app/c/${props.contact.id}`)
const isUpcoming = computed(() => {
  const at = new Date(props.contact.follow_up_by)
  return at.getTime() > nowRef.value.getTime() && localDayDiff(at, nowRef.value) > 0
})

const REMIND: { label: string; rung: LadderRung }[] = [
  { label: '15 min', rung: { value: 15, unit: 'min' } },
  { label: '1 hr', rung: { value: 1, unit: 'hour' } },
  { label: '4 hr', rung: { value: 4, unit: 'hour' } },
  { label: '1 day', rung: { value: 1, unit: 'day' } },
]

function openComposer() {
  emit('message', props.contact)
  window.location.href = composer.value
}

const menuItems = computed<MenuItem[]>(() => {
  const edit: MenuItem = { label: 'Edit', onSelect: () => void navigateTo(editTo.value) }
  if (props.contact.status === 'graduated') return [edit]
  const items: MenuItem[] = []
  if (isUpcoming.value && usable.value) items.push({ label: 'Message', onSelect: openComposer })
  items.push(
    { label: 'Mark done', onSelect: () => emit('mark-done', props.contact) },
    { label: 'Nudge me later', children: REMIND.map((o) => ({ label: o.label, onSelect: () => emit('remind', o.rung) })) },
    { label: 'Set aside', onSelect: () => emit('archive', props.contact) },
    edit,
    { label: 'Delete', danger: true, separatorBefore: true, onSelect: () => emit('delete', props.contact) },
  )
  return items
})
</script>
