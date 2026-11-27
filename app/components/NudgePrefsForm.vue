<template>
  <form class="space-y-6" @submit.prevent="onSave">
    <fieldset>
      <legend class="text-label-caps uppercase text-ink">Channel</legend>
      <p v-if="profile?.sms_opted_out_at" class="mt-1 text-xs text-error">You've opted out of SMS. Choose email to receive nudges.</p>
      <div class="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface p-1">
        <button
          v-for="c in channels" :key="c.value" type="button" :aria-pressed="form.nudge_channel === c.value"
          class="min-h-11 rounded-md px-2 text-sm font-medium transition-colors"
          :class="form.nudge_channel === c.value ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
          @click="form.nudge_channel = c.value"
        >{{ c.label }}</button>
      </div>
    </fieldset>

    <div v-if="!profile?.sms_opted_out_at" class="space-y-3">
      <label class="flex items-start gap-3 text-sm">
        <input v-model="smsOptInConsent" type="checkbox" class="mt-0.5 h-5 w-5 accent-accent">
        <span>I agree to receive conference follow-up reminders by text. <span class="text-muted">Reply STOP to opt out, HELP for help. Message &amp; data rates may apply.</span></span>
      </label>
      <div v-if="smsOptInConsent" class="flex items-end gap-2">
        <UiField class="flex-1" label="Mobile number" input-id="phone">
          <UiInput id="phone" v-model="form.phone" type="tel" placeholder="+1 555 000 0000" />
        </UiField>
        <UiButton variant="secondary" :disabled="sendingCode" @click="sendCode">{{ smsOptedIn ? 'Verify' : 'Send code' }}</UiButton>
      </div>
      <div v-if="smsCodeSent" class="flex items-end gap-2">
        <UiField class="flex-1" label="Enter the code we texted you" input-id="code">
          <UiInput id="code" v-model="code" inputmode="numeric" placeholder="123456" />
        </UiField>
        <UiButton variant="secondary" @click="verifyCode">Confirm</UiButton>
      </div>
    </div>

    <UiField label="Timezone" input-id="timezone" hint="Used to send nudges at sensible local times as you travel.">
      <select id="timezone" v-model="form.timezone" class="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink transition-colors focus:border-accent focus:outline-none">
        <option v-for="tz in commonTimezones" :key="tz" :value="tz">{{ tz }}</option>
      </select>
    </UiField>

    <fieldset class="rounded-xl border border-line bg-sunken p-4">
      <legend class="px-1 text-label-caps uppercase text-ink">Quiet hours</legend>
      <div class="grid grid-cols-2 gap-3">
        <UiField label="Don't disturb after" input-id="quiet_start">
          <select id="quiet_start" v-model.number="form.quiet_hours_start" class="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink focus:border-accent focus:outline-none">
            <option v-for="h in HOURS" :key="h" :value="h">{{ formatHour(h) }}</option>
          </select>
        </UiField>
        <UiField label="Resume nudges at" input-id="quiet_end" :error="quietError">
          <select id="quiet_end" v-model.number="form.quiet_hours_end" class="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink focus:border-accent focus:outline-none">
            <option v-for="h in HOURS" :key="h" :value="h">{{ formatHour(h) }}</option>
          </select>
        </UiField>
      </div>
      <p class="mt-3 text-xs text-muted">
        Lanyard won't nudge you between {{ formatHour(form.quiet_hours_start) }} and {{ formatHour(form.quiet_hours_end) }} your time. Anything due then waits until {{ formatHour(form.quiet_hours_end) }}.
      </p>
    </fieldset>

    <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>

    <UiButton type="submit" block :disabled="saving">{{ saving ? 'Saving…' : 'Save preferences' }}</UiButton>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useProfile } from '~/composables/useProfile'
import { HOURS, formatHour, validateQuietHours } from '~/utils/quietHours'

const emit = defineEmits<{ saved: [] }>()
const { profile, save, optInSms } = useProfile()

const channels = [
  { value: 'email' as const, label: 'Email' },
  { value: 'sms' as const, label: 'Text (requires opt-in)' },
  { value: 'both' as const, label: 'Both' },
]
const commonTimezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC', 'Europe/London', 'Europe/Berlin', 'Australia/Sydney', 'Asia/Tokyo']

const detectedTimezone = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC' } catch { return 'UTC' }
})()

const form = reactive({
  nudge_channel: 'email' as 'sms' | 'email' | 'both',
  phone: '',
  timezone: detectedTimezone,
  quiet_hours_start: 21,
  quiet_hours_end: 9,
})

// The profile loads asynchronously; sync the form whenever it arrives.
watch(profile, (p) => {
  if (!p) return
  Object.assign(form, {
    nudge_channel: p.nudge_channel ?? form.nudge_channel,
    phone: p.phone ?? '',
    timezone: p.timezone ?? form.timezone,
    quiet_hours_start: p.quiet_hours_start ?? 21,
    quiet_hours_end: p.quiet_hours_end ?? 9,
  })
}, { immediate: true })

const quietError = computed(() => validateQuietHours(form.quiet_hours_start, form.quiet_hours_end))

const smsOptInConsent = ref(false)
const smsOptedIn = computed(() => Boolean(profile.value?.sms_opt_in_at && !profile.value?.sms_opted_out_at))
const smsCodeSent = ref(false)
const sendingCode = ref(false)
const saving = ref(false)
const code = ref('')
const error = ref<string | null>(null)

async function sendCode() {
  error.value = null
  if (!form.phone) { error.value = 'Add your mobile number first.'; return }
  sendingCode.value = true
  try {
    await $fetch('/api/profile/phone?action=send', { method: 'POST', body: { phone: form.phone } })
    smsCodeSent.value = true
  } catch (e) {
    error.value = (e as any)?.data?.statusText ?? 'Could not send a code.'
  } finally { sendingCode.value = false }
}

async function verifyCode() {
  error.value = null
  if (!form.phone || !code.value) { error.value = 'Enter the code we texted you.'; return }
  try {
    await $fetch('/api/profile/phone?action=verify', { method: 'POST', body: { phone: form.phone, code: code.value } })
    await optInSms(form.phone)
    smsCodeSent.value = false
  } catch (e) {
    error.value = (e as any)?.data?.statusText ?? 'Verification failed.'
  }
}

async function onSave() {
  error.value = null
  if (quietError.value) return
  saving.value = true
  try {
    await save({
      nudge_channel: form.nudge_channel,
      timezone: form.timezone,
      phone: form.phone || null,
      quiet_hours_start: form.quiet_hours_start,
      quiet_hours_end: form.quiet_hours_end,
    })
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally { saving.value = false }
}
</script>