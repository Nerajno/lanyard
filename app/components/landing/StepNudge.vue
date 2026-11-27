<template>
  <div class="flex flex-col items-center gap-8 md:flex-row">
    <div class="relative order-2 flex w-full flex-1 justify-center md:order-1">
      <div class="relative w-full max-w-[320px] rounded-xl border border-line bg-surface p-4 shadow-lg">
        <span class="absolute -right-4 -top-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-on-accent shadow-md motion-safe:animate-bounce" aria-hidden="true">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        </span>
        <div class="mb-4 flex items-center gap-4">
          <span class="text-action flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-press dark:text-accent" aria-hidden="true">PN</span>
          <div>
            <p class="text-action text-ink">Priya Nadkarni</p>
            <p class="text-body-sm text-muted">Met at DevNexus</p>
          </div>
        </div>
        <p class="text-body-sm mb-4 rounded-[14px_14px_14px_4px] bg-bubble px-3 py-2.5 text-bubble-ink">
          Time for coffee #1 with <b class="font-semibold">Priya</b>. How you met: “Talked Nuxt SSR in the hallway after the keynote.”
        </p>
        <div class="text-action w-full rounded-lg bg-accent py-2 text-center text-sm text-on-accent">Follow up now</div>
      </div>
    </div>
    <div class="order-1 flex-1 text-center md:order-2 md:text-left">
      <h3 class="text-headline-lg mb-2 text-ink">Nudge.</h3>
      <p class="text-body-lg mx-auto max-w-[400px] text-ink-2 md:mx-0">
        A reminder arrives when it's time, by text or email, carrying exactly how you met. You're never staring at a name wondering who it was.
      </p>
    </div>
  </div>
</template>
