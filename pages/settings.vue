<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Where should we nudge you?</h1>
    <p class="mt-1 text-sm text-muted">You only get nudged where you ask us to.</p>

    <p v-if="error" class="mt-4 text-sm text-coral">{{ error }}</p>

    <form class="mt-6 space-y-6" @submit.prevent="saveProfile">
      <!-- Channel -->
      <fieldset>
        <legend class="font-mono text-xs uppercase tracking-eyebrow text-ink">Channel</legend>
        <p v-if="profile?.sms_opted_out_at" class="mt-1 text-xs text-coral">You've opted out of SMS. Choose email to receive nudges.</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="c in channels"
            :key="c.value"
            type="button"
            class="rounded-lg border px-3 py-2 text-sm"
            :class="form.nudge_channel === c.value ? 'border-coral bg-coral-soft text-coral' : 'border-line bg-surface text-ink hover:border-muted'"
            @click="form.nudge_channel = c.value"
          >
            {{ c.label }}
          </button>
        </div>
      </fieldset>

      <!-- SMS opt-in + phone -->
      <div v-if="!profile?.sms_opted_out_at">
        <label class="flex items-start gap-3 text-sm">
          <input v-model="smsOptInConsent" type="checkbox" class="mt-0.5 accent-coral" >
          <span>
            I agree to receive conference follow-up reminders by text. <span class="text-muted">Reply STOP to opt out, HELP for help. Message &amp; data rates may apply.</span>
          </span>
        </label>

        <div v-if="smsOptInConsent" class="mt-3 flex items-end gap-2">
          <div class="flex-1">
            <label class="text-sm font-medium text-ink" for="phone">Mobile number</label>
            <input id="phone" v-model="form.phone" type="tel" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none" placeholder="+1 555 000 0000" >
          </div>
          <button type="button" class="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-paper" :disabled="sendingCode" @click="sendCode">
            {{ smsOptedIn ? 'Verify' : 'Send code' }}
          </button>
        </div>

        <div v-if="smsCodeSent" class="mt-2 flex items-end gap-2">
          <div class="flex-1">
            <label class="text-sm font-medium text-ink" for="code">Enter the code we texted you</label>
            <input id="code" v-model="code" inputmode="numeric" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none" placeholder="123456" >
          </div>
          <button type="button" class="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-paper" @click="verifyCode">Confirm</button>
        </div>
      </div>

      <!-- Timezone -->
      <div>
        <label class="text-sm font-medium text-ink" for="timezone">Timezone</label>
        <select id="timezone" v-model="form.timezone" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none">
          <option v-for="tz in commonTimezones" :key="tz" :value="tz">{{ tz }}</option>
        </select>
        <p class="mt-1 text-xs text-muted">Nudges are sent during your local daytime (09:00–21:00).</p>
      </div>

      <button
        type="submit"
        :disabled="saving"
        class="rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-hover disabled:opacity-50"
      >
        {{ saving ? 'Saving…' : 'Save preferences' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { useProfile } from '~/composables/useProfile'

definePageMeta({ middleware: 'auth' })

const { profile, save, optInSms } = useProfile()

const channels = [
  { value: 'email' as const, label: 'Email' },
  { value: 'sms' as const, label: 'Text (requires opt-in)' },
  { value: 'both' as const, label: 'Both' },
]

const commonTimezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC', 'Europe/London', 'Europe/Berlin', 'Australia/Sydney', 'Asia/Tokyo']

const detectedTimezone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
  } catch {
    return 'UTC'
  }
})()

const form = reactive({
  nudge_channel: (profile.value?.nudge_channel ?? 'email') as 'sms' | 'email' | 'both',
  phone: profile.value?.phone ?? '',
  timezone: profile.value?.timezone ?? detectedTimezone,
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
  if (!form.phone) {
    error.value = 'Add your mobile number first.'
    return
  }
  sendingCode.value = true
  try {
    await $fetch('/api/profile/phone?action=send', { method: 'POST', body: { phone: form.phone } })
    smsCodeSent.value = true
  } catch (e) {
    error.value = (e as any)?.data?.statusText ?? 'Could not send a code.'
  } finally {
    sendingCode.value = false
  }
}

async function verifyCode() {
  error.value = null
  if (!form.phone || !code.value) {
    error.value = 'Enter the code we texted you.'
    return
  }
  try {
    await $fetch('/api/profile/phone?action=verify', { method: 'POST', body: { phone: form.phone, code: code.value } })
    await optInSms(form.phone)
    smsCodeSent.value = false
  } catch (e) {
    error.value = (e as any)?.data?.statusText ?? 'Verification failed.'
  }
}

async function saveProfile() {
  error.value = null
  saving.value = true
  try {
    await save({
      nudge_channel: form.nudge_channel,
      timezone: form.timezone,
      phone: form.phone || null,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}
</script>