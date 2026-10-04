<template>
  <div class="rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center">
    <p class="font-display text-xl font-bold tracking-[-0.02em] text-ink">{{ title }}</p>
    <p class="mt-1 text-sm text-muted">{{ body }}</p>
    <div v-if="$slots.action" class="mt-4 flex justify-center"><slot name="action" /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; body: string }>()
</script>
