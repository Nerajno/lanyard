<template>
  <div class="flex flex-col items-center gap-8 md:flex-row">
    <div class="flex-1 text-center md:text-left">
      <h3 class="text-headline-lg mb-2 text-ink">Connect.</h3>
      <p class="text-body-lg mx-auto max-w-[400px] text-ink-2 md:mx-0">
        One tap opens a message already drafted on the channel you captured, using the real context of how you met. You read it, tweak it, hit send. Lanyard never sends on your behalf.
      </p>
    </div>
    <div class="relative flex w-full flex-1 justify-center">
      <div class="w-full max-w-[400px] overflow-hidden rounded-xl bg-navy p-6 shadow-xl ring-1 ring-line/40">
        <div class="relative mb-6 rounded-lg border border-line bg-paper p-4">
          <span class="text-label-caps absolute -top-3 left-4 bg-paper px-2 uppercase text-ink">Draft</span>
          <p class="text-body-sm italic text-ink-2">
            “Hi Priya, great talking Nuxt SSR with you at DevNexus. I'd love to keep the thread going. Free for a virtual coffee next week?”
          </p>
        </div>
        <div class="text-action flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-on-accent shadow-sm">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          Open prefilled text
        </div>
        <p class="text-body-sm mt-3 text-center text-white/70">Opens your messages app, prefilled. You hit send.</p>
      </div>
    </div>
  </div>
</template>
