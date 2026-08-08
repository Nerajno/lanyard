<template>
  <div class="bg-paper text-ink">
    <!-- HERO -->
    <header class="pb-10 pt-14">
      <div class="mx-auto grid max-w-[1080px] items-center gap-10 px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span class="border-coral-soft bg-coral-soft text-coral-press mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold">
            ◇ Building in public · early access
          </span>
          <h1 class="font-display text-[clamp(40px,6.5vw,62px)] font-extrabold leading-[0.98] tracking-[-0.03em]">
            Follow up before it goes cold.
          </h1>
          <p class="text-ink-2 mt-4 max-w-lg text-[clamp(17px,2.3vw,20px)]">
            You meet people worth knowing at conferences. Lanyard remembers them, texts you at the right moment, and gets you from "I should reach out" to message-sent in one tap.
          </p>
          <div class="mt-7 flex flex-wrap items-center gap-3">
            <button class="btn solid lg" @click="scrollToId('get')">Get early access</button>
            <button class="btn-surface lg" @click="scrollToId('how')">See how it works</button>
          </div>
          <p class="mt-4 text-[12.5px] text-muted">No spam. Just a note when it's ready.</p>
        </div>

        <div>
          <LandingHeroPhone />
        </div>
      </div>
    </header>

    <!-- PROBLEM -->
    <section class="border-line border-t py-16">
      <div class="mx-auto max-w-[1080px] px-6">
        <p class="kick">The problem</p>
        <h2 class="font-display text-[clamp(1.6rem,4.4vw,2.4rem)] font-bold leading-tight tracking-[-0.025em]">
          The hallway track is where it happens. Then it fades.
        </h2>
        <p class="text-ink-4 max-w-[620px] pt-4 text-[17px]">
          The best part of a conference is the conversations between the talks — the person you met in the coffee line, the one who gave you a real answer in the hallway. You both mean to keep in touch. Then the event ends, the context slips, and the follow-up you meant to send never goes out.
        </p>
      </div>
    </section>

    <!-- HOW -->
    <section id="how" class="border-line border-t py-16">
      <div class="mx-auto max-w-[1080px] px-6">
        <p class="kick">How it works</p>
        <h2 class="font-display font-bold">Three steps, no spreadsheet.</h2>
        <div class="mt-8 grid gap-4 md:grid-cols-3">
          <div
            v-for="(step, i) in steps"
            :key="i"
            class="border-line bg-surface rounded-[18px] border p-6"
          >
<div class="font-mono mb-3 text-xs text-muted">{{ String(i + 1).padStart(2, '0') }}</div>
            <div class="mb-3 text-2xl" aria-hidden="true">{{ step.icon }}</div>
            <h3 class="font-display text-lg font-bold">{{ step.title }}</h3>
            <p class="mt-2 text-sm text-ink-2">{{ step.body }}</p>
            <p v-if="step.bubble" class="bubble mt-3">
              Time to follow up with <b>{{ step.bubbleName }}</b> — {{ step.bubbleMet }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- THREE COFFEES -->
    <section id="coffees" class="border-line border-t py-16">
      <div class="mx-auto max-w-[1080px] px-6">
        <div class="bg-navy mt-2 rounded-3xl px-8 py-12 text-[#eef1f6] md:px-10">
          <p class="font-mono mb-3 text-xs uppercase tracking-[0.12em] text-[#f0a58f]">The idea</p>
          <h2 class="font-display text-2xl font-bold text-white md:text-3xl">It takes three cups of coffee.</h2>
          <p class="mt-2 max-w-[560px] text-base text-[#c8d0dd]">
            Trust isn't built in one follow-up — it's a few. Lanyard runs each new contact through three well-timed touchpoints, from a fresh introduction to a real connection. After the third, they <b class="text-white">graduate</b> — Lanyard stops nudging you about them. A finish line, not an endless to-do list.
          </p>
          <div class="mt-8 flex flex-wrap items-center gap-3.5">
            <div v-for="cup in cups" :key="cup.label" class="flex flex-col items-center gap-2">
              <div
                class="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[22px]"
                :class="cup.colorClass"
                style="border: 2px solid rgba(255,255,255,0.2)"
              >
                ☕
              </div>
              <small class="text-[11px] text-[#8fa1bd]">{{ cup.label }}</small>
            </div>
            <span class="text-lg text-[#5b7196]" aria-hidden="true">→</span>
            <span class="border-graduated text-[#7fd4c8] rounded-full border px-4 py-2 text-sm font-semibold" style="background: rgba(27,145,132,0.18)">
              ✓ Graduated — a real connection
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- FEATURES -->
    <section id="features" class="border-line border-t py-16">
      <div class="mx-auto max-w-[1080px] px-6">
        <p class="kick">What it does</p>
        <h2 class="font-display text-3xl font-bold">Small on purpose.</h2>
        <p class="lead max-w-[620px] pt-4 text-[17px]">
          Lanyard does one thing a CRM is too heavy to do well: get you to actually follow up.
        </p>
        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="(f, i) in features" :key="i" class="border-line bg-surface rounded-[16px] border p-5">
            <div class="mb-3 text-xl" :class="f.iconClass">{{ f.icon }}</div>
            <h3 class="font-display text-[15.5px] font-bold">{{ f.title }}</h3>
            <p class="mt-1.5 text-[13.5px] leading-relaxed text-muted">{{ f.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- PHILOSOPHY -->
    <section class="border-line border-t py-16 text-center">
      <div class="mx-auto max-w-[1080px] px-6">
        <p class="kick">Why it exists</p>
        <h2 class="font-display mx-auto max-w-[760px] font-bold leading-tight tracking-[-0.025em]">
          Your network deserves intentional consistency — not eventual consistency.
        </h2>
        <p class="mt-3 text-sm text-muted">
          Growth doesn't happen by accident. Lanyard makes follow-up a deliberate habit. <span class="opacity-70">(Idea sparked by Vincent Mayers' talk on developer community.)</span>
        </p>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section id="get" class="border-line bg-sunken border-t py-16 text-center">
      <div class="mx-auto max-w-[1080px] px-6">
        <p class="kick">Early access</p>
        <h2 class="font-display text-3xl font-bold leading-tight tracking">Follow up before it goes cold.</h2>
        <p class="lead mx-auto mt-3 max-w-[560px] text-[17px]">
          Lanyard is being built in public. Leave your email and I'll tell you the moment it's ready to try at your next conference.
        </p>
        <div class="mt-6">
          <WaitlistForm />
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="border-line border-t py-10">
      <div class="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 px-6">
        <div class="font-display text-[15px] font-bold">
          lanyard<span class="text-coral">.</span> · Progress over perfection
        </div>
        <div class="flex gap-5 text-sm text-muted">
          <button class="hover:text-coral" @click="scrollToId('how')">How it works</button>
          <button class="hover:text-coral" @click="scrollToId('features')">What it does</button>
          <button class="hover:text-coral" @click="scrollToId('get')">Early access</button>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const steps = [
  {
    icon: '✎',
    title: 'Capture',
    body: 'Add someone in seconds — a name and one way to reach them. No form to fill at a booth.',
  },
  {
    icon: '☾',
    title: 'Get nudged',
    body: 'Lanyard texts you when it’s time, with a reminder of how you met — so you’re not staring at a name wondering who it was.',
    bubble: true,
    bubbleName: 'Priya',
    bubbleMet: 'you talked Nuxt SSR at DevNexus',
  },
  {
    icon: '➤',
    title: 'Follow up',
    body: 'One tap opens a message, already drafted on the channel you captured. You read it, tweak it, hit send. Done.',
  },
]

const cups = [
  { label: '1st · +2 days', colorClass: 'bg-fresh' },
  { label: '2nd · +2 weeks', colorClass: 'bg-warm' },
  { label: '3rd · +6 weeks', colorClass: 'bg-due' },
]

const features = [
  {
    icon: '◐',
    iconClass: 'text-fresh',
    title: 'Triage by warmth',
    body: 'Every contact shows how close its follow-up is to slipping — teal when fresh, red when it’s due. See who’s cooling off at a glance.',
  },
  {
    icon: '✎',
    iconClass: 'text-coral',
    title: 'Capture in seconds',
    body: 'A name and one way to reach them. Rich details are optional — never a form to fill at a booth.',
  },
  {
    icon: '✉',
    iconClass: 'text-warm',
    title: 'Nudged your way',
    body: 'Get reminders by text or email, on your schedule, inside your own quiet hours.',
  },
  {
    icon: '➤',
    iconClass: 'text-coral',
    title: 'One tap to reply',
    body: 'The nudge opens a drafted message on the right channel. You never write from a blank page.',
  },
  {
    icon: '☕',
    iconClass: 'text-warm',
    title: 'A defined finish',
    body: 'Three touchpoints, then a contact graduates and stops nagging you. No infinite queue.',
  },
  {
    icon: '◇',
    iconClass: 'text-fresh',
    title: 'Built for the hallway track',
    body: 'Made for people who meet many and follow up with few — speakers, organizers, serial attendees.',
  },
]

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<style scoped>
.kick {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgb(var(--coral));
  margin-bottom: 14px;
}
.lead {
  color: rgb(var(--ink-2));
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 18px;
  border-radius: 11px;
  cursor: pointer;
  border: 1px solid rgb(var(--line));
  background: rgb(var(--surface));
  color: rgb(var(--ink));
  font-family: inherit;
  transition: transform 0.1s, filter 0.1s;
}
.btn:active {
  transform: scale(0.98);
}
.btn.solid {
  background: rgb(var(--coral-press));
  color: #fff;
  border-color: rgb(var(--coral-press));
}
.btn.solid:hover {
  filter: brightness(0.95);
}
.btn.lg {
  padding: 14px 24px;
  font-size: 15px;
}
.bubble {
  background: rgb(var(--bubble));
  color: rgb(var(--bubble-ink));
  border-radius: 14px 14px 14px 4px;
  padding: 10px 12px;
  font-size: 12.5px;
  line-height: 1.4;
}
.bubble b {
  font-weight: 600;
}
</style>