<template>
  <div class="mx-auto max-w-md py-6">
    <div class="text-center">
      <BrandMark class="pointer-events-none" />
      <h1 class="mt-4 font-display text-3xl font-bold tracking-[-0.02em]">Almost there</h1>
      <p class="mt-1 text-sm text-muted">Lanyard needs a destination before it can nudge you.</p>
    </div>
    <div class="mt-6 rounded-xl border border-line bg-surface p-5">
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