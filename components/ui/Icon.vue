<template>
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 shrink-0"
    :aria-hidden="label ? undefined : 'true'" :role="label ? 'img' : undefined" :aria-label="label"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>

<script setup lang="ts">
// Stroke icons drawn on a 24px grid. Add a name here before using it.
const PATHS = {
  queue: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  plus: 'M12 5v14M5 12h14',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  stats: 'M12 20V10M18 20V4M6 20v-4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  check: 'M20 6 9 17l-5-5',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
} as const

defineProps<{ name: keyof typeof PATHS; label?: string }>()
</script>
