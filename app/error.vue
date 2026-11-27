<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center text-ink">
    <p class="text-label-caps uppercase text-accent">{{ error?.statusCode || 404 }}</p>
    <h1 class="font-display mt-3 text-3xl font-bold tracking-[-0.02em]">Page not found.</h1>
    <p class="mt-2 text-sm text-muted">That link doesn't lead anywhere.</p>
    <div class="mt-6 flex gap-3">
      <NuxtLink to="/" class="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-paper">Back home</NuxtLink>
      <NuxtLink to="/login" class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-press">Log in</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ error: Partial<{ statusCode: number }> | null }>()
</script>