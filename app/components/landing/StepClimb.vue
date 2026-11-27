<template>
  <div class="flex flex-col items-center gap-8 md:flex-row">
    <div class="relative order-2 flex w-full flex-1 justify-center md:order-1">
      <div class="w-full max-w-[360px] rounded-xl border border-line bg-surface p-6 shadow-lg">
        <div class="relative flex items-start justify-between">
          <div class="absolute inset-x-[16%] top-5 h-1 rounded-full bg-sunken" aria-hidden="true" />
          <div class="absolute left-[16%] top-5 h-1 w-[34%] rounded-full bg-warm" aria-hidden="true" />
          <div
            v-for="(rung, i) in rungs"
            :key="rung.label"
            class="relative z-10 flex flex-1 flex-col items-center gap-2"
          >
            <span v-if="i === current" class="absolute top-1 h-8 w-8 rounded-full bg-warm opacity-30 motion-safe:animate-ping" aria-hidden="true" />
            <span
              class="relative flex h-10 w-10 items-center justify-center rounded-full"
              :class="i < current ? 'bg-warm text-surface' : i === current ? 'border-2 border-warm bg-surface text-warm' : 'border-2 border-line bg-surface text-faint'"
              aria-hidden="true"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><line x1="6" x2="6" y1="2" y2="4" /><line x1="10" x2="10" y1="2" y2="4" /><line x1="14" x2="14" y1="2" y2="4" /></svg>
            </span>
            <span class="text-label-caps uppercase" :class="i <= current ? 'text-ink' : 'text-muted'">{{ rung.label }}</span>
            <span class="text-body-sm text-muted">{{ rung.when }}</span>
          </div>
        </div>
        <p class="text-body-sm mt-5 rounded-full border border-graduated/40 bg-fresh-soft px-4 py-2 text-center font-semibold text-graduated">
          After the third: graduated, a real connection
        </p>
      </div>
    </div>
    <div class="order-1 flex-1 text-center md:order-2 md:text-left">
      <h3 class="text-headline-lg mb-2 text-ink">Climb.</h3>
      <p class="text-body-lg mx-auto max-w-[400px] text-ink-2 md:mx-0">
        It takes three cups of coffee. {{ ladderCopy }} Then the contact graduates and Lanyard stops nudging. A finish line, not an endless to-do list.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LADDER_PRESETS } from '~/types'

// Copy is derived from the shipped preset so the page can't drift from the ladder the app runs.
const ladder = LADDER_PRESETS.default
const ladderCopy = `Three touchpoints at ${ladder.map(r => `+${r.value}`).join(', ')} days by default; switch presets or write your own.`

const current = 1
const rungs = ladder.map((rung, i) => ({
  label: `Coffee ${i + 1}`,
  when: `+${rung.value} days`,
}))
</script>
