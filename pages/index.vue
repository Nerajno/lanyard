<template>
  <div class="flex flex-col items-center gap-6 py-20 text-center">
    <div class="flex gap-2" aria-hidden="true">
      <span class="h-3 w-3 rounded-full bg-fresh" />
      <span class="h-3 w-3 rounded-full bg-warm" />
      <span class="h-3 w-3 rounded-full bg-due" />
    </div>
    <h1 class="font-display max-w-xl text-5xl font-extrabold leading-[0.95] tracking-[-0.03em] text-ink">
      Follow up before it goes cold.
    </h1>
    <p class="max-w-md text-base text-muted">
      Capture a contact, get a timed nudge, act in one tap. Three coffees — then they graduate.
    </p>
    <div class="flex gap-3">
      <NuxtLink to="/add" class="rounded-lg bg-coral px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-coral-hover">
        Add a contact
      </NuxtLink>
      <NuxtLink to="/login" class="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-muted">
        Sign in
      </NuxtLink>
    </div>
  </div>
</template>