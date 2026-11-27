<template>
  <div>
    <label :for="inputId" class="text-sm font-medium text-ink">
      {{ label }}<span v-if="required" aria-hidden="true" class="text-muted"> *</span>
    </label>
    <div class="mt-1">
      <slot :describedby="describedby" :invalid="Boolean(error)" />
    </div>
    <p v-if="error" :id="`${inputId}-error`" class="mt-1 text-sm text-error">{{ error }}</p>
    <p v-else-if="hint" :id="`${inputId}-hint`" class="mt-1 text-xs text-muted">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ label: string; inputId: string; hint?: string; error?: string | null; required?: boolean }>()

const describedby = computed(() => {
  if (props.error) return `${props.inputId}-error`
  if (props.hint) return `${props.inputId}-hint`
  return undefined
})
</script>
