<template>
  <NuxtLink v-if="to && !disabled" :to="to" :class="classes"><slot /></NuxtLink>
  <a v-else-if="href && !disabled" :href="href" :class="classes"><slot /></a>
  <button v-else :type="type" :disabled="disabled" :class="classes"><slot /></button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  to?: string
  href?: string
  block?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}>(), { variant: 'primary', size: 'md', block: false, disabled: false, type: 'button' })

const VARIANTS = {
  primary: 'bg-accent text-on-accent hover:bg-accent-press',
  secondary: 'border border-line bg-surface text-ink hover:bg-paper',
  ghost: 'text-muted hover:bg-paper hover:text-ink',
  danger: 'border border-error/40 bg-surface text-error hover:bg-error-soft',
} as const

const SIZES = { sm: 'px-3 text-xs', md: 'px-4 text-sm' } as const

const classes = computed(() => [
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  VARIANTS[props.variant],
  SIZES[props.size],
  props.block ? 'w-full' : '',
])
</script>
