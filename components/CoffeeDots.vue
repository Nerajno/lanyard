<template>
  <div class="flex items-center gap-2">
    <div class="flex gap-1.5" aria-hidden="true">
      <span
        v-for="i in total"
        :key="i"
        class="inline-block h-2.5 w-2.5 rounded-full"
        :class="dotClass(i)"
      />
    </div>
    <span class="font-mono text-xs text-muted">{{ filled }}/{{ total }} coffees</span>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ filled: number; total?: number }>(), { total: 3 })

function dotClass(i: number): string {
  const empty = i > props.filled || props.filled === 0
  if (empty) return 'bg-line'
  if (props.filled >= props.total) return 'bg-graduated'
  const ramp: Record<number, string> = { 1: 'bg-fresh', 2: 'bg-warm', 3: 'bg-due' }
  return ramp[i] ?? 'bg-fresh'
}
</script>