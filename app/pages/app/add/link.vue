<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Share link</h1>
    <p class="mt-1 text-sm text-muted">A link anyone can open to add their own details to your list. One-time use.</p>

    <div class="mt-6 space-y-4 rounded-xl border border-line bg-surface p-5">
      <UiField label="How you met (optional hint)" input-id="how_met_default">
        <UiInput id="how_met_default" v-model="howMetDefault" placeholder="Met at the hallway track…" />
      </UiField>
      <UiButton :disabled="creating" @click="create">{{ creating ? 'Creating…' : 'Generate link' }}</UiButton>
    </div>

    <div v-if="shareUrl" class="mt-6 rounded-xl border border-line bg-surface p-5 text-center">
      <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code for the share link" class="mx-auto h-40 w-40">
      <p class="mt-3 break-all font-mono text-xs text-muted">{{ shareUrl }}</p>
      <UiButton variant="secondary" class="mt-3" @click="copy">
        <UiIcon v-if="copied" name="check" /> {{ copied ? 'Copied' : 'Copy link' }}
      </UiButton>
    </div>
    <p v-if="error" role="alert" class="mt-4 text-sm text-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import QRCode from 'qrcode'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'
import { useSupabase } from '~/composables/useSupabase'

definePageMeta({ layout: 'app', middleware: 'app' })

const auth = useAuthStore()
const { user } = storeToRefs(auth)
const sb = useSupabase()

const howMetDefault = ref('')
const creating = ref(false)
const shareUrl = ref('')
const qrDataUrl = ref('')
const error = ref<string | null>(null)
const copied = ref(false)

async function create() {
  if (creating.value || !user.value) return
  creating.value = true
  error.value = null
  try {
    const id = crypto.randomUUID()
    await sb.from('shares').insert({
      id, user_id: user.value.id,
      how_met_default: howMetDefault.value.trim() || null,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const base = useRuntimeConfig().public.appUrl || window.location.origin
    shareUrl.value = `${base.replace(/\/$/, '')}/share/${id}`
    qrDataUrl.value = await QRCode.toDataURL(shareUrl.value, { width: 320 })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    creating.value = false
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { /* clipboard blocked — the URL is visible inline */ }
}
</script>