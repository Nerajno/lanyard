<template>
  <div class="bg-paper text-ink">
    <section v-if="restoreOpen" class="border-b border-line bg-accent-soft/40">
      <div class="mx-auto flex max-w-[1080px] flex-wrap items-center gap-3 px-6 py-4">
        <p class="text-sm text-ink">Your account is scheduled for deletion. Within 14 days we can restore it — everything is still here.</p>
        <input v-model="restoreEmail" type="email" placeholder="account email" class="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm focus:border-accent focus:outline-none">
        <button type="button" class="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-press disabled:opacity-50" :disabled="restoring" @click="restore">
          {{ restoring ? 'Sending…' : 'Restore account' }}
        </button>
        <button type="button" class="text-sm text-muted underline" @click="dismissRestore">Dismiss</button>
      </div>
      <p v-if="restoreMsg" class="mx-auto max-w-[1080px] px-6 pb-3 text-sm text-ink">{{ restoreMsg }}</p>
    </section>

    <LandingHero />

    <!-- STORYBOARD: nudge / connect / climb -->
    <section id="how-it-works" class="mx-auto max-w-[1024px] scroll-mt-16 px-4 py-8 md:py-24">
      <p class="text-label-caps mb-2 text-center uppercase text-accent md:text-left">How it works</p>
      <h2 class="text-headline-lg mb-16 text-center text-ink md:text-left">Three steps, no spreadsheet.</h2>
      <div class="flex flex-col gap-24">
        <LandingStepNudge />
        <LandingStepConnect />
        <LandingStepClimb />
      </div>
    </section>

    <!-- FEATURES -->
    <section id="features" class="scroll-mt-16 border-t border-line bg-sunken py-16">
      <div class="mx-auto max-w-[1024px] px-4">
        <p class="text-label-caps mb-2 uppercase text-accent">What it does</p>
        <h2 class="text-headline-lg text-ink">Small on purpose.</h2>
        <p class="text-body-lg max-w-[620px] pt-2 text-ink-2">
          Lanyard does one thing a CRM is too heavy to do well: get you to actually follow up.
        </p>
        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="f in features" :key="f.title" class="rounded-xl border border-line bg-surface p-5">
            <h3 class="text-action text-ink">{{ f.title }}</h3>
            <p class="text-body-sm mt-1.5 text-ink-2">{{ f.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <LandingFocus />

    <!-- FINAL CTA -->
    <section id="get" class="scroll-mt-16 border-t border-line bg-sunken py-16 text-center">
      <div class="mx-auto max-w-[1024px] px-4">
        <p class="text-label-caps mb-2 uppercase text-accent">Early access</p>
        <h2 class="text-headline-lg text-ink">Follow up before it goes cold.</h2>
        <p class="text-body-lg mx-auto mt-3 max-w-[560px] text-ink-2">
          Lanyard is being built in public. Leave your email and I'll tell you the moment it's ready to try at your next conference.
        </p>
        <div class="mt-6">
          <WaitlistForm />
        </div>
        <p class="text-body-sm mt-8 text-muted">
          Your network deserves intentional consistency, not eventual consistency. <span class="opacity-70">(Idea sparked by Vincent Mayers' talk on developer community.)</span>
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const auth = useAuthStore()

const restoreOpen = ref(Boolean(route.query.deleted))
const restoreEmail = ref('')
const restoreMsg = ref('')
const restoring = ref(false)

function dismissRestore() {
  restoreOpen.value = false
  window.history.replaceState(null, '', '/')
}

async function restore() {
  if (!restoreEmail.value) {
    restoreMsg.value = 'Enter the email of the account you deleted.'
    return
  }
  restoring.value = true
  restoreMsg.value = ''
  try {
    await $fetch('/api/account/restore', { method: 'POST', body: { email: restoreEmail.value } })
    await auth.signInWithEmail(restoreEmail.value)
    restoreMsg.value = 'Account restored — check your inbox for a sign-in link.'
  } catch (e) {
    restoreMsg.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Could not restore the account. It may be past the 14-day window.'
  } finally {
    restoring.value = false
  }
}

const features = [
  { title: 'Triage by warmth', body: 'Every contact shows how close its follow-up is to slipping: green when fresh, amber when it’s due. See who’s cooling off at a glance.' },
  { title: 'Capture in seconds', body: 'A name and one way to reach them. Rich details are optional, never a form to fill at a booth.' },
  { title: 'Nudged your way', body: 'Get reminders by text or email, on your schedule, inside your own send window.' },
  { title: 'One tap to reply', body: 'The nudge opens a drafted message on the right channel. You never write from a blank page, and you always hit send.' },
  { title: 'A defined finish', body: 'Three touchpoints, then a contact graduates and stops nagging you. No infinite queue.' },
  { title: 'Built for the hallway track', body: 'Made for people who meet many and follow up with few: speakers, organizers, serial attendees.' },
]
</script>
