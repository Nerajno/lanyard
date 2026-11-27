<template>
  <div class="mx-auto max-w-xl text-center">
    <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Scan a badge</h1>
    <p class="mt-4 text-sm text-muted">Badge and LinkedIn QR scanning is coming soon. For now, add the person by hand — it takes about ten seconds.</p>
    <UiButton to="/app/add" class="mt-6">Add by hand</UiButton>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'app' })
</script>