<template>
  <form class="space-y-5" novalidate @submit.prevent="onSubmit">
    <UiField label="Name" input-id="name" required>
      <template #default="{ describedby }">
        <UiInput id="name" ref="nameInput" v-model="form.name" type="text" autocomplete="off" placeholder="Ada Lovelace" :aria-describedby="describedby" />
      </template>
    </UiField>

    <UiField label="How you met" input-id="how_met" hint="Sent verbatim in your follow-up nudge." required>
      <template #default="{ describedby }">
        <UiInput id="how_met" v-model="form.how_met" as="textarea" :rows="2" placeholder="Met at the analytics track after her lightning talk…" :aria-describedby="describedby" />
        <div v-if="suggestions?.length" class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="chip in suggestions" :key="chip" type="button"
            class="min-h-11 rounded-full border border-line bg-sunken px-3 text-xs font-medium text-ink transition-colors hover:border-accent"
            @click="form.how_met = applyHowMetChip(form.how_met, chip)"
          >{{ chip }}</button>
        </div>
      </template>
    </UiField>

    <fieldset class="rounded-xl border border-line bg-surface p-4" :aria-describedby="channelError ? 'channel-error' : undefined">
      <legend class="px-1 text-label-caps uppercase text-ink">Reach them via (at least one) *</legend>
      <div class="space-y-3">
        <UiField label="Email" input-id="email">
          <UiInput id="email" v-model="form.email" type="email" autocomplete="off" placeholder="ada@example.com" :invalid="Boolean(channelError)" @blur="channelTouched = true" />
        </UiField>
        <div class="flex items-center gap-3 text-muted" aria-hidden="true">
          <span class="h-px flex-1 bg-line" /><span class="text-label-caps uppercase">or</span><span class="h-px flex-1 bg-line" />
        </div>
        <UiField label="Phone" input-id="phone">
          <UiInput id="phone" v-model="form.phone" type="tel" autocomplete="off" placeholder="+1 555 000 0000" :invalid="Boolean(channelError)" @blur="channelTouched = true" />
        </UiField>
      </div>
      <p v-if="channelError" id="channel-error" class="mt-2 text-sm text-error">{{ channelError }}</p>
    </fieldset>

    <div>
      <button
        type="button" aria-controls="pace-options" :aria-expanded="paceOpen"
        class="flex min-h-11 w-full items-center justify-between rounded-lg px-1 text-sm text-ink"
        @click="paceOpen = !paceOpen"
      >
        <span><span class="text-muted">Pace:</span> {{ paceSummary }}</span>
        <span aria-hidden="true" class="text-muted">{{ paceOpen ? '▾' : '▸' }}</span>
      </button>

      <fieldset v-if="paceOpen" id="pace-options" class="mt-2">
        <legend class="sr-only">Follow-up pace</legend>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            v-for="preset in presets" :key="preset.key" type="button"
            class="min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition"
            :class="form.ladderPreset === preset.key ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-muted'"
            :aria-pressed="form.ladderPreset === preset.key"
            @click="form.ladderPreset = preset.key"
          >
            {{ preset.label }}
            <span :class="form.ladderPreset === preset.key ? 'text-accent' : 'text-muted'" class="block text-xs">{{ preset.summary }}</span>
          </button>
          <button
            type="button" class="min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition"
            :class="form.ladderPreset === 'custom' ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-muted'"
            :aria-pressed="form.ladderPreset === 'custom'"
            @click="form.ladderPreset = 'custom'"
          >
            Custom
            <span :class="form.ladderPreset === 'custom' ? 'text-accent' : 'text-muted'" class="block text-xs">{{ customSummary }}</span>
          </button>
        </div>

        <div v-if="form.ladderPreset === 'custom'" class="mt-3 space-y-2">
          <div v-for="(rung, i) in form.customLadder" :key="i" class="flex items-center gap-2">
            <input
              v-model.number="form.customLadder[i].value" type="number" min="1" :aria-label="`Rung ${i + 1} amount`"
              class="min-h-11 w-24 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors focus:border-accent focus:outline-none"
            >
            <select
              v-model="form.customLadder[i].unit" :aria-label="`Rung ${i + 1} unit`"
              class="min-h-11 rounded-lg border border-line bg-surface px-2 text-sm text-ink transition-colors focus:border-accent focus:outline-none"
            >
              <option value="min">min</option>
              <option value="hour">hours</option>
              <option value="day">days</option>
            </select>
            <UiButton variant="ghost" size="sm" @click="removeRung(i)">Remove</UiButton>
          </div>
          <UiButton v-if="form.customLadder.length < 3" variant="ghost" size="sm" @click="addRung()">+ Add rung</UiButton>
        </div>
      </fieldset>
    </div>

    <p v-if="formError" role="alert" class="text-sm text-error">{{ formError }}</p>

    <div class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] -mx-4 bg-paper/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0">
      <UiButton type="submit" block :disabled="submitting">
        <UiIcon name="check" /> {{ submitting ? 'Saving…' : submitLabel }}
      </UiButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted } from 'vue'
import type { Ladder, LadderRung } from '~/types'
import type { LadderPreset } from '~/utils/cadence'
import { formatLadder } from '~/utils/cadence'
import { applyHowMetChip, cleanHowMet } from '~/utils/howMet'
import { LADDER_NAMES, LADDER_PRESETS } from '~/types'

export interface ContactFormValues {
  name: string
  how_met: string
  email: string | null
  phone: string | null
  ladderPreset: LadderPreset | 'custom'
  customLadder: Ladder
}

const props = withDefaults(defineProps<{
  submitLabel?: string
  initial?: Partial<ContactFormValues> | null
  suggestions?: string[]
  autofocus?: boolean
}>(), { submitLabel: 'Save contact', initial: null, suggestions: undefined, autofocus: false })

const emit = defineEmits<{ submit: [values: ContactFormValues] }>()

const presets = LADDER_NAMES.map((key) => ({
  key,
  label: key.charAt(0).toUpperCase() + key.slice(1),
  summary: formatLadder(LADDER_PRESETS[key]),
}))

const form = reactive<ContactFormValues>({
  name: props.initial?.name ?? '',
  how_met: props.initial?.how_met ?? '',
  email: props.initial?.email ?? '',
  phone: props.initial?.phone ?? '',
  ladderPreset: props.initial?.ladderPreset ?? 'default',
  customLadder: props.initial?.customLadder ?? [
    { value: 1, unit: 'day' },
    { value: 7, unit: 'day' },
    { value: 21, unit: 'day' },
  ],
})

const submitting = ref(false)
const formError = ref<string | null>(null)
const channelTouched = ref(false)
const paceOpen = ref(false)
const nameInput = ref<{ $el: HTMLInputElement } | null>(null)

const hasChannel = computed(() => Boolean((form.email ?? '').trim() || (form.phone ?? '').trim()))
const channelError = computed(() => channelTouched.value && !hasChannel.value ? 'Add an email or a phone number.' : null)
const customSummary = computed(() => {
  if (form.ladderPreset === 'custom') return formatLadder(form.customLadder)
  return ''
})
const paceSummary = computed(() => {
  if (form.ladderPreset === 'custom') return `Custom (${formatLadder(form.customLadder)})`
  const p = presets.find((x) => x.key === form.ladderPreset)
  return p ? `${p.label} (${p.summary})` : 'Default'
})

onMounted(() => {
  // Desktop only: on phones autofocus throws the keyboard over the form.
  if (props.autofocus && window.matchMedia('(min-width: 768px)').matches) {
    (nameInput.value?.$el as HTMLInputElement | undefined)?.focus()
  }
})

function addRung(): void {
  if (form.customLadder.length >= 3) return
  const rung: LadderRung = { value: 1, unit: 'day' }
  form.customLadder.push(rung)
}

function removeRung(i: number): void {
  if (form.customLadder.length <= 1) return
  form.customLadder.splice(i, 1)
}

async function onSubmit() {
  formError.value = null
  channelTouched.value = true
  const howMet = cleanHowMet(form.how_met)
  if (!form.name.trim() || !howMet.trim()) {
    formError.value = 'Name and how you met are required.'
    return
  }
  if (!hasChannel.value) return
  submitting.value = true
  try {
    emit('submit', { ...form, how_met: howMet, email: (form.email ?? '').trim() || null, phone: (form.phone ?? '').trim() || null })
  } finally {
    submitting.value = false
  }
}
</script>
