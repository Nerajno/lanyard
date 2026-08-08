<template>
  <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate font-semibold text-slate-900">{{ contact.name }}</h3>
        <p class="mt-0.5 line-clamp-2 text-sm text-slate-500">{{ contact.how_met }}</p>
        <p v-if="dueLabel" class="mt-1 text-xs text-slate-400">{{ dueLabel }}</p>
      </div>
      <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" :class="urgencyClasses">
        {{ urgencyLabel }}
      </span>
    </div>

    <div class="mt-3 flex items-center gap-2">
      <div class="flex gap-1" aria-hidden="true">
        <span
          v-for="i in 3"
          :key="i"
          class="inline-block h-2.5 w-2.5 rounded-full"
          :class="i <= coffee ? 'bg-slate-800' : 'bg-slate-200'"
        />
      </div>
      <span class="text-xs text-slate-500">{{ coffee }}/3 coffees</span>
    </div>

    <footer class="mt-3 flex flex-wrap items-center gap-2">
      <template v-if="contact.status === 'active'">
        <button
          class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
          @click="$emit('follow-up', contact)"
        >
          Mark done
        </button>
        <button class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50" @click="$emit('snooze', contact)">
          Snooze
        </button>
        <button class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50" @click="$emit('archive', contact)">
          Archive
        </button>
        <button class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50" @click="showRemind = !showRemind">
          Nudge me later
        </button>
        <div v-if="showRemind" class="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 p-2">
          <button
            v-for="opt in remindOptions"
            :key="opt.label"
            type="button"
            class="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-200"
            @click="onRemindPick(opt.rung)"
          >
            {{ opt.label }}
          </button>
        </div>
      </template>
      <button v-if="contact.status !== 'graduated'" class="rounded-lg px-3 py-1.5 text-xs text-red-600 hover:bg-red-50" @click="$emit('delete', contact)">
        Delete
      </button>
      <NuxtLink :to="`/contacts/${contact.id}/edit`" class="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
        Edit
      </NuxtLink>
      <span v-if="contact.status === 'graduated'" class="text-xs font-medium text-emerald-700">Graduated — all 3 coffees 🎉</span>
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
    case 'due': return isOverdue.value ? 'bg-red-100 text-red-700' : 'bg-red-100 text-red-700'
    case 'close': return 'bg-amber-100 text-amber-700'
    case 'graduated': return 'bg-emerald-100 text-emerald-700'
    default: return 'bg-slate-100 text-slate-600'
  }
})
</script>