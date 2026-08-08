<template>
  <form class="space-y-5" @submit.prevent="onSubmit">
    <div>
      <label class="text-sm font-medium" for="name">Name *</label>
      <input
        id="name"
        v-model="form.name"
        type="text"
        class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
        placeholder="Ada Lovelace"
      >
    </div>

    <div>
      <label class="text-sm font-medium" for="how_met">How you met *</label>
      <textarea
        id="how_met"
        v-model="form.how_met"
        rows="2"
        class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
        placeholder="Met at the analytics track after her lightning talk…"
      />
      <p class="mt-1 text-xs text-slate-500">Sent verbatim in your follow-up nudge.</p>
    </div>

    <div class="text-sm font-medium">Reach them via (at least one) *</div>
    <div class="flex flex-col gap-3 sm:flex-row">
      <div class="flex-1">
        <label class="text-sm font-medium" for="email">Email</label>
        <input id="email" v-model="form.email" type="email" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" >
      </div>
      <div class="flex-1">
        <label class="text-sm font-medium" for="phone">Phone</label>
        <input id="phone" v-model="form.phone" type="tel" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="+1 555 000 0000" >
      </div>
    </div>
    <p v-if="!hasChannel" class="text-sm text-red-600">Add an email or a phone number.</p>

    <fieldset>
      <legend class="text-sm font-medium">Follow-up pace</legend>
      <div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          v-for="preset in presets"
          :key="preset.key"
          type="button"
          class="rounded-lg border px-3 py-2 text-sm transition"
          :class="form.ladderPreset === preset.key
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-300 hover:border-slate-400'"
          @click="form.ladderPreset = preset.key"
        >
          {{ preset.label }}
          <span :class="form.ladderPreset === preset.key ? 'text-slate-300' : 'text-slate-500'" class="block text-xs">
            {{ preset.summary }}
          </span>
        </button>
        <button
          type="button"
          class="rounded-lg border px-3 py-2 text-sm transition"
          :class="form.ladderPreset === 'custom'
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-300 hover:border-slate-400'"
          @click="form.ladderPreset = 'custom'"
        >
          Custom
          <span :class="form.ladderPreset === 'custom' ? 'text-slate-300' : 'text-slate-500'" class="block text-xs">
            {{ customSummary }}
          </span>
        </button>
      </div>

      <div v-if="form.ladderPreset === 'custom'" class="mt-3 space-y-2">
        <div v-for="(rung, i) in form.customLadder" :key="i" class="flex items-center gap-2">
          <input
            v-model.number="form.customLadder[i].value"
            type="number"
            min="1"
            class="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
          <select v-model="form.customLadder[i].unit" class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            <option value="min">min</option>
            <option value="hour">hours</option>
            <option value="day">days</option>
          </select>
          <button type="button" class="text-sm text-red-600" @click="removeRung(i)">Remove</button>
        </div>
        <button v-if="form.customLadder.length < 3" type="button" class="text-sm text-slate-500 hover:text-slate-700" @click="addRung()">
          + Add rung
        </button>
      </div>
    </fieldset>

    <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>

    <button
      type="submit"
      :disabled="submitting || !valid"
      class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {{ submitting ? 'Saving…' : submitLabel }}
    </button>
  </form>
</template>

<script setup lang="ts">
import type { Ladder, LadderRung } from '~/types'
import type { LadderPreset } from '~/utils/cadence'
import { formatLadder } from '~/utils/cadence'
import { LADDER_NAMES, LADDER_PRESETS } from '~/types'

export interface ContactFormValues {
  name: string
  how_met: string
  email: string | null
  phone: string | null
  ladderPreset: LadderPreset | 'custom'
  customLadder: Ladder
}

const props = defineProps<{
  submitLabel?: string
  initial?: Partial<ContactFormValues> | null
}>()

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

const hasChannel = computed(() => Boolean((form.email ?? '').trim() || (form.phone ?? '').trim()))
const valid = computed(() => Boolean(form.name.trim() && form.how_met.trim()) && hasChannel.value)

const customSummary = computed(() => (form.ladderPreset === 'custom' ? formatLadder(form.customLadder) : ''))

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
  if (!form.name.trim() || !form.how_met.trim()) {
    formError.value = 'Name and how you met are required.'
    return
  }
  if (!hasChannel.value) {
    formError.value = 'Add an email or phone number.'
    return
  }
  submitting.value = true
  try {
    emit('submit', { ...form, email: (form.email ?? '').trim() || null, phone: (form.phone ?? '').trim() || null })
  } finally {
    submitting.value = false
  }
}
</script>