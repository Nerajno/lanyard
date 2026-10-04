<template>
  <h2 class="flex items-center gap-2 text-label-caps uppercase" :class="TONES[tone]">
    <span>{{ label }}</span>
    <span v-if="count !== undefined" class="rounded-full bg-sunken px-2 py-0.5 font-mono text-[11px] text-muted">{{ count }}</span>
  </h2>
</template>

<script setup lang="ts">
const TONES = { due: 'text-due', warm: 'text-warm', muted: 'text-muted' } as const
withDefaults(defineProps<{ label: string; count?: number; tone?: keyof typeof TONES }>(), { tone: 'muted' })
</script>
