<template>
  <div class="mx-auto max-w-xl text-center">
    <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Scan a badge</h1>
    <p class="mt-4 text-sm text-muted">Badge and LinkedIn QR scanning is coming soon. For now, add the person by hand — it takes about ten seconds.</p>
    <NuxtLink to="/app/add/manual" class="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-press">Add by hand</NuxtLink>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'app' })
</script>