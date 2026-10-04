<template>
  <span
    aria-hidden="true"
    class="inline-flex shrink-0 items-center justify-center rounded-full bg-navy/10 font-semibold text-ink"
    :class="size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'"
  >{{ initials(name) }}</span>
</template>

<script setup lang="ts">
import { initials } from '~/utils/initials'

withDefaults(defineProps<{ name: string; size?: 'sm' | 'md' }>(), { size: 'md' })
</script>
