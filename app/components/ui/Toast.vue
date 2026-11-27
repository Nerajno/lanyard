<template>
  <div
    role="status" aria-live="polite"
    class="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-6"
  >
    <p v-if="message" class="pointer-events-auto rounded-full bg-navy px-4 py-2 text-sm font-medium text-white shadow-lg">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ message: string | null }>()
</script>
