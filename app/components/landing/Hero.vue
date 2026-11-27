<template>
  <section class="mx-auto max-w-[1024px] px-4 py-8 md:py-16">
    <div class="flex flex-col items-center gap-8 md:flex-row">
      <div class="flex-1 text-center md:text-left">
        <p class="text-label-caps mb-4 uppercase text-accent">Building in public · early access</p>
        <h1 class="text-headline-lg md:text-headline-xl mb-4 text-ink">
          Turn brief encounters into lasting connections.
        </h1>
        <p class="text-body-lg mx-auto mb-6 max-w-[500px] text-ink-2 md:mx-0">
          Lanyard collapses the distance between meeting someone worth knowing and following up. It remembers how you met, nudges you at the right moment, and gets you to message-sent in one tap.
        </p>
        <div class="flex flex-col items-center justify-center gap-2 sm:flex-row md:justify-start">
          <NuxtLink
            to="/#get"
            class="text-action inline-flex min-h-[48px] w-full items-center justify-center rounded bg-accent px-8 text-on-accent shadow-sm transition-transform hover:-translate-y-0.5 sm:w-auto"
          >Get early access</NuxtLink>
          <NuxtLink
            to="/#how-it-works"
            class="text-action inline-flex min-h-[48px] w-full items-center justify-center rounded border border-line bg-surface px-8 text-ink transition-colors hover:border-accent sm:w-auto"
          >See how it works</NuxtLink>
        </div>
        <p class="text-body-sm mt-4 text-muted">No spam. Just a note when it's ready.</p>
      </div>

      <div class="relative flex w-full flex-1 justify-center">
        <div class="relative w-full max-w-[400px] py-6">
          <div class="absolute inset-y-0 right-0 w-[85%] rounded-xl border border-line bg-sunken" aria-hidden="true" />
          <div class="relative">
            <LandingHeroPhone />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
