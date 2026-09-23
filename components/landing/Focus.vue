<template>
  <section class="mx-auto max-w-[768px] border-t border-line px-4 py-12 text-center">
    <svg class="mx-auto mb-2 h-9 w-9 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
    <h2 class="text-headline-md mb-2 text-ink">Respecting your focus</h2>
    <p class="text-body-lg mx-auto max-w-[500px] text-ink-2">
      Nudges only go out inside a send window you choose ({{ sendWindowCopy }} to start), on your local time. Outside it, quiet hours. Follow-ups arrive when you're ready to act on them, not in the middle of deep work or at 2am.
    </p>
  </section>
</template>

<script setup lang="ts">
import { DEFAULT_QUIET_HOURS } from '~/types'

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`
const sendWindowCopy = `${pad(DEFAULT_QUIET_HOURS.from)}–${pad(DEFAULT_QUIET_HOURS.to)}`
</script>
