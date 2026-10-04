<template>
  <form class="space-y-5" @submit.prevent="onSubmit">
    <UiField label="Name" input-id="name" :required="true">
      <template #default="{ describedby, invalid }">
        <UiInput
          id="name"
          ref="nameInput"
          v-model="form.name"
          placeholder="Ada Lovelace"
          :invalid="invalid"
          :aria-describedby="describedby"
        />
      </template>
    </UiField>

    <UiField label="How you met" input-id="how_met" hint="Sent verbatim in your follow-up nudge." :required="true">
      <template #default="{ describedby, invalid }">
        <UiInput
          id="how_met"
          v-model="form.how_met"
          as="textarea"
          rows="2"
          placeholder="Met at the analytics track after her lightning talk…"
          :invalid="invalid"
          :aria-describedby="describedby"
        />
      </template>
    </UiField>

    <div>
      <div class="flex items-baseline gap-2">
        <p class="text-label-caps uppercase text-ink">Reach them via (at least one) *</p>
        <p v-if="channelError" role="alert" class="text-sm text-error">{{ channelError }}</p>
      </div>
      <div class="mt-3 flex flex-col gap-3 sm:flex-row">
        <div class="flex-1">
          <UiField input-id="email" label="Email">
            <template #default="{ describedby, invalid }">
              <UiInput
                id="email"
                v-model="form.email"
                type="email"
                :invalid="invalid"
                :aria-describedby="describedby"
                @blur="channelTouched = true"
              />
            </template>
          </UiField>
        </div>
        <div class="flex-1">
          <UiField input-id="phone" label="Phone">
            <template #default="{ describedby, invalid }">
              <UiInput
                id="phone"
                v-model="form.phone"
                type="tel"
                placeholder="+1 555 000 0000"
                :invalid="invalid"
                :aria-describedby="describedby"
                @blur="channelTouched = true"
              />
            </template>
          </UiField>
        </div>
      </div>
      <p v-if="channelTouched && !hasChannel" class="mt-2 text-sm text-error">Add an email or a phone number.</p>
    </div>

    <div>
      <div v-if="suggestions && suggestions.length > 0" class="mb-3 flex flex-wrap gap-2">
        <button
          v-for="chip in suggestions"
          :key="chip"
          type="button"
          class="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink transition hover:border-accent hover:bg-accent-soft"
          @click="form.how_met = applyHowMetChip(form.how_met, chip)"
        >
          {{ chip }}
        </button>
      </div>

      <button
        type="button"
        class="min-h-11 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent"
        aria-controls="pace-options"
        :aria-expanded="pacePickerOpen"
        @click="pacePickerOpen = !pacePickerOpen"
      >
        Pace: {{ paceSummary }}
      </button>

      <div v-if="showPacePicker" id="pace-options" class="mt-3 space-y-3">
        <fieldset class="space-y-2">
          <legend class="text-label-caps text-sm font-medium text-ink uppercase">Follow-up pace</legend>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              v-for="preset in presets"
              :key="preset.key"
              type="button"
              class="min-h-11 rounded-lg border px-3 py-2 text-sm transition"
              :class="form.ladderPreset === preset.key
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line bg-surface text-ink hover:border-muted'"
              @click="form.ladderPreset = preset.key"
            >
              {{ preset.label }}
              <span :class="form.ladderPreset === preset.key ? 'text-accent' : 'text-muted'" class="block text-xs">
                {{ preset.summary }}
              </span>
            </button>
            <button
              type="button"
              class="min-h-11 rounded-lg border px-3 py-2 text-sm transition"
              :class="form.ladderPreset === 'custom'
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line bg-surface text-ink hover:border-muted'"
              @click="form.ladderPreset = 'custom'"
            >
              Custom
              <span :class="form.ladderPreset === 'custom' ? 'text-accent' : 'text-muted'" class="block text-xs">
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
                class="w-24 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink transition-colors focus:border-accent focus:outline-none"
              >
              <select v-model="form.customLadder[i].unit" class="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink transition-colors focus:border-accent focus:outline-none">
                <option value="min">min</option>
                <option value="hour">hours</option>
                <option value="day">days</option>
              </select>
              <button type="button" class="text-sm text-accent" @click="removeRung(i)">Remove</button>
            </div>
            <button v-if="form.customLadder.length < 3" type="button" class="text-sm text-muted hover:text-ink" @click="addRung()">
              + Add rung
            </button>
          </div>
        </fieldset>
      </div>
    </div>

    <p v-if="formError" class="text-sm text-error">{{ formError }}</p>

    <UiButton type="submit" :disabled="submitting || !valid">
      {{ submitting ? 'Saving…' : submitLabel }}
    </UiButton>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted } from 'vue'
import type { Ladder, LadderRung } from '~/types'
import type { LadderPreset } from '~/utils/cadence'
import { formatLadder } from '~/utils/cadence'
import { LADDER_NAMES, LADDER_PRESETS } from '~/types'
import { applyHowMetChip } from '~/utils/howMet'

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
  suggestions?: string[]
  autofocus?: boolean
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
const channelTouched = ref(false)
const pacePickerOpen = ref(false)
const nameInput = ref<InstanceType<typeof import('./ui/UiInput.vue').default> | null>(null)

const hasChannel = computed(() => Boolean((form.email ?? '').trim() || (form.phone ?? '').trim()))
const valid = computed(() => Boolean(form.name.trim() && form.how_met.trim()) && hasChannel.value)
const channelError = computed(() => channelTouched.value && !hasChannel.value ? 'Add an email or a phone number.' : null)
const customSummary = computed(() => {
  if (form.ladderPreset === 'custom') return `Custom (${formatLadder(form.customLadder)})`
  const p = presets.find((x) => x.key === form.ladderPreset)
  return p ? `${p.label} (${p.summary})` : 'Default'
})
const paceSummary = computed(() => {
  if (form.ladderPreset === 'custom') return `Custom (${formatLadder(form.customLadder)})`
  const p = presets.find((x) => x.key === form.ladderPreset)
  return p ? p.label : 'Default'
})
const showPacePicker = computed(() => pacePickerOpen.value || form.ladderPreset === 'custom')
const submitLabel = computed(() => props.submitLabel ?? 'Save')

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
  if (!form.name.trim() || !form.how_met.trim()) {
    formError.value = 'Name and how you met are required.'
    return
  }
  if (!hasChannel.value) return
  submitting.value = true
  try {
    emit('submit', { ...form, email: (form.email ?? '').trim() || null, phone: (form.phone ?? '').trim() || null })
  } finally {
    submitting.value = false
  }
}
</script>
