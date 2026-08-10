<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center text-ink">
    <p class="font-mono text-xs uppercase tracking-[0.12em] text-coral">{{ error?.statusCode || 404 }}</p>
    <h1 class="font-display mt-3 text-3xl font-extrabold tracking-[-0.03em]">Page not found.</h1>
    <p class="mt-2 text-sm text-muted">That link doesn't lead anywhere.</p>
    <div class="mt-6 flex gap-3">
      <NuxtLink to="/" class="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-paper">Back home</NuxtLink>
      <NuxtLink to="/login" class="rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-press">Log in</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ error: Partial<{ statusCode: number }> | null }>()
</script>