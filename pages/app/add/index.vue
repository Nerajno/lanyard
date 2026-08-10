<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Add a connection</h1>
    <p class="mt-1 text-sm text-muted">Capture them fast — you can enrich later.</p>
    <div class="mt-6 grid gap-4 sm:grid-cols-3">
      <NuxtLink to="/app/add/manual" class="rounded-xl border border-line bg-surface p-5 transition hover:border-coral">
        <div class="text-2xl">✎</div>
        <h2 class="mt-2 font-display text-lg font-bold">By hand</h2>
        <p class="mt-1 text-sm text-muted">Name, where you met, and a way to reach them.</p>
      </NuxtLink>
      <NuxtLink to="/app/add/link" class="rounded-xl border border-line bg-surface p-5 transition hover:border-coral">
        <div class="text-2xl">◇</div>
        <h2 class="mt-2 font-display text-lg font-bold">Share link</h2>
        <p class="mt-1 text-sm text-muted">Send a link; they fill in their own details.</p>
      </NuxtLink>
      <NuxtLink to="/app/add/scan" class="rounded-xl border border-line bg-surface p-5 transition hover:border-coral">
        <div class="text-2xl">▣</div>
        <h2 class="mt-2 font-display text-lg font-bold">Scan</h2>
        <p class="mt-1 text-sm text-muted">Badge / LinkedIn QR — coming soon.</p>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'app' })
</script>