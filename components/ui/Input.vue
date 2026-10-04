<template>
  <textarea v-if="as === 'textarea'" v-model="model" :rows="rows" :class="classes" v-bind="$attrs" />
  <input v-else v-model="model" :class="classes" v-bind="$attrs">
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const model = defineModel<string | null>({ default: '' })
const props = withDefaults(defineProps<{ as?: 'input' | 'textarea'; rows?: number; invalid?: boolean }>(), {
  as: 'input',
  rows: 2,
  invalid: false,
})

const classes = computed(() => [
  'min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-ink placeholder:text-muted transition-colors focus:border-accent focus:outline-none',
  props.invalid ? 'border-error' : 'border-line',
])
</script>
