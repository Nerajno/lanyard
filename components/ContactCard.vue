<template>
  <article class="rounded-xl border border-line bg-surface p-4 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate font-display text-base font-bold tracking-[-0.02em] text-ink">{{ contact.name }}</h3>
        <p class="mt-0.5 line-clamp-2 text-sm text-muted">{{ contact.how_met }}</p>
        <p v-if="dueLabel" class="mt-1 font-mono text-xs text-muted">{{ dueLabel }}</p>
      </div>
      <span class="shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-eyebrow" :class="urgencyClasses">
        {{ urgencyLabel }}
      </span>
    </div>

    <div class="mt-3">
      <CoffeeDots :filled="coffee" />
    </div>

    <footer class="mt-3 flex flex-wrap items-center gap-2">
      <template v-if="contact.status === 'active'">
        <button
          class="rounded-lg bg-coral px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-coral-press"
          @click="$emit('follow-up', contact)"
        >
          Follow up
        </button>
        <button class="rounded-lg border border-line px-3 py-1.5 text-xs text-ink transition-colors hover:bg-paper" @click="$emit('snooze', contact)">
          Snooze
        </button>
        <button class="rounded-lg border border-line px-3 py-1.5 text-xs text-ink transition-colors hover:bg-paper" @click="$emit('archive', contact)">
          Set aside
        </button>
        <button class="rounded-lg border border-line px-3 py-1.5 text-xs text-ink transition-colors hover:bg-paper" @click="showRemind = !showRemind">
          Nudge me later
        </button>
        <div v-if="showRemind" class="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-paper p-2">
          <button
            v-for="opt in remindOptions"
            :key="opt.label"
            type="button"
            class="rounded-lg border border-line bg-surface px-3 py-1 text-xs text-ink transition-colors hover:bg-paper"
            @click="onRemindPick(opt.rung)"
          >
            {{ opt.label }}
          </button>
        </div>
      </template>
      <button v-if="contact.status !== 'graduated'" class="rounded-lg px-3 py-1.5 text-xs text-coral transition-colors hover:bg-coral-soft" @click="$emit('delete', contact)">
        Delete
      </button>
      <NuxtLink :to="`/app/c/${contact.id}`" class="rounded-lg px-3 py-1.5 text-xs text-muted transition-colors hover:bg-paper">
        Edit
      </NuxtLink>
      <span v-if="contact.status === 'graduated'" class="font-mono text-xs font-medium text-graduated">Graduated — all 3 coffees</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import type { Contact, LadderRung } from '~/types'
import { coffeeProgress, daysUntil, urgencyOf } from '~/utils/cadence'
import type { Urgency } from '~/utils/cadence'

const props = defineProps<{ contact: Contact }>()
const emit = defineEmits<{
  'follow-up': [contact: Contact]
  snooze: [contact: Contact]
  archive: [contact: Contact]
  delete: [contact: Contact]
  remind: [rung: LadderRung]
}>()

const coffee = computed(() => coffeeProgress(props.contact.cadence_ladder, props.contact.touchpoints_done))
const urgency = computed<Urgency>(() => urgencyOf(props.contact.follow_up_by, props.contact.status))

const dueLabel = computed(() => {
  if (props.contact.status === 'graduated') return ''
  if (!props.contact.follow_up_by) return ''
  const d = daysUntil(props.contact.follow_up_by)
  if (d < 0) return 'Due'
  if (d === 0) return 'Due today'
  return `In ${d}d`
})

const urgencyLabel = computed(() => {
  switch (urgency.value) {
    case 'due': return 'Due'
    case 'close': return 'Soon'
    case 'graduated': return 'Graduated'
    default: return 'Fresh'
  }
})

const isOverdue = computed(() => urgency.value === 'due' && daysUntil(props.contact.follow_up_by) < 0)

const showRemind = ref(false)

const remindOptions: { label: string; rung: LadderRung }[] = [
  { label: '15 min', rung: { value: 15, unit: 'min' } },
  { label: '1 hr', rung: { value: 1, unit: 'hour' } },
  { label: '4 hr', rung: { value: 4, unit: 'hour' } },
  { label: '1 day', rung: { value: 1, unit: 'day' } },
]

function onRemindPick(rung: LadderRung): void {
  showRemind.value = false
  emit('remind', rung)
}

const urgencyClasses = computed(() => {
  switch (urgency.value) {
    case 'due': return isOverdue.value ? 'bg-coral-soft text-coral' : 'bg-coral-soft text-coral'
    case 'close': return 'bg-warm/15 text-warm'
    case 'graduated': return 'bg-graduated/15 text-graduated'
    default: return 'bg-fresh/15 text-fresh'
  }
})
</script>