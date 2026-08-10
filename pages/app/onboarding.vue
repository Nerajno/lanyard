<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Almost there</h1>
    <p class="mt-1 text-sm text-muted">Lanyard needs a destination before it can nudge you.</p>
    <div class="mt-6">
      <NudgePrefsForm @saved="onSaved" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useProfile } from '~/composables/useProfile'

definePageMeta({ layout: 'app', middleware: 'app' })

const { save } = useProfile()

async function onSaved() {
  // Record first-run completion explicitly.
  await save({ onboarded_at: new Date().toISOString() })
  await navigateTo('/app')
}
</script>