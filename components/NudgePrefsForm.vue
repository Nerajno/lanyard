<template>
  <form class="space-y-6" @submit.prevent="onSave">
    <fieldset>
      <legend class="text-label-caps uppercase text-ink">Channel</legend>
      <p v-if="profile?.sms_opted_out_at" class="mt-1 text-xs text-error">You've opted out of SMS. Choose email to receive nudges.</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          v-for="c in channels" :key="c.value" type="button"
          class="rounded-lg border px-3 py-2 text-sm"
          :class="form.nudge_channel === c.value ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-muted'"
          @click="form.nudge_channel = c.value"
        >{{ c.label }}</button>
      </div>
    </fieldset>

    <div v-if="!profile?.sms_opted_out_at">
      <label class="flex items-start gap-3 text-sm">
        <input v-model="smsOptInConsent" type="checkbox" class="mt-0.5 accent-accent">
        <span>I agree to receive conference follow-up reminders by text. <span class="text-muted">Reply STOP to opt out, HELP for help. Message &amp; data rates may apply.</span></span>
      </label>
      <div v-if="smsOptInConsent" class="mt-3 flex items-end gap-2">
        <div class="flex-1">
          <label class="text-sm font-medium text-ink" for="phone">Mobile number</label>
          <input id="phone" v-model="form.phone" type="tel" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-accent focus:outline-none" placeholder="+1 555 000 0000">
        </div>
        <button type="button" class="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-paper" :disabled="sendingCode" @click="sendCode">{{ smsOptedIn ? 'Verify' : 'Send code' }}</button>
      </div>
      <div v-if="smsCodeSent" class="mt-2 flex items-end gap-2">
        <div class="flex-1">
          <label class="text-sm font-medium text-ink" for="code">Enter the code we texted you</label>
          <input id="code" v-model="code" inputmode="numeric" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-accent focus:outline-none" placeholder="123456">
        </div>
        <button type="button" class="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-paper" @click="verifyCode">Confirm</button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="text-sm font-medium text-ink" for="quiet_start">Don't disturb after</label>
        <select id="quiet_start" v-model.number="form.quiet_hours_start" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-accent focus:outline-none">
          <option v-for="h in HOURS" :key="h" :value="h">{{ formatHour(h) }}</option>
        </select>
      </div>
      <div>
        <label class="text-sm font-medium text-ink" for="quiet_end">Resume nudges at</label>
        <select id="quiet_end" v-model.number="form.quiet_hours_end" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-accent focus:outline-none">
          <option v-for="h in HOURS" :key="h" :value="h">{{ formatHour(h) }}</option>
        </select>
      </div>
    </div>
    <p class="mt-3 text-xs text-muted">
      Lanyard won't nudge you between {{ formatHour(form.quiet_hours_start) }} and {{ formatHour(form.quiet_hours_end) }} your time. Anything outside those hours gets through.
    </p>

    <div>
      <label class="text-sm font-medium text-ink" for="timezone">Timezone</label>
      <select id="timezone" v-model="form.timezone" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-accent focus:outline-none">
        <option v-for="tz in commonTimezones" :key="tz" :value="tz">{{ tz }}</option>
      </select>
      <p class="mt-1 text-xs text-muted">Used to send nudges at sensible local times as you travel.</p>
    </div>

    <p v-if="error" class="text-sm text-error">{{ error }}</p>

    <button
      type="submit" :disabled="saving"
      class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-press disabled:opacity-50"
    >{{ saving ? 'Saving…' : 'Save preferences' }}</button>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
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
  nudge_channel: (profile.value?.nudge_channel ?? 'email') as 'sms' | 'email' | 'both',
  phone: profile.value?.phone ?? '',
  timezone: profile.value?.timezone ?? detectedTimezone,
  quiet_hours_start: profile.value?.quiet_hours_start ?? 21,
  quiet_hours_end: profile.value?.quiet_hours_end ?? 9,
})

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
  error.value = validateQuietHours(form.quiet_hours_start, form.quiet_hours_end)
  if (error.value) return
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