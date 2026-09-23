<template>
  <div class="border-line mx-auto w-[290px] overflow-hidden rounded-[38px] border bg-paper shadow-[0_30px_70px_-28px_rgba(20,22,30,0.45),0_0_0_9px_#1b1d24,0_0_0_10px_#33363f]">
    <div class="flex items-end justify-between px-4 pb-2 pt-6">
      <div>
        <div class="font-display text-base font-bold tracking-[-0.02em]">lanyard<span class="text-accent">.</span></div>
        <div class="text-[9px] text-muted">Follow up before it goes cold</div>
      </div>
      <div class="text-right">
        <div class="font-display text-[22px] leading-none text-accent">2</div>
        <div class="text-[9px] text-muted">due</div>
      </div>
    </div>
    <div class="px-3 pb-4 pt-0.5">
      <div
        v-for="row in rows"
        :key="row.name"
        class="border-line mb-2 flex overflow-hidden rounded-xl border bg-surface"
      >
        <div class="w-[5px] shrink-0" :style="{ backgroundColor: row.color }" />
        <div class="min-w-0 flex-1 px-3 py-2">
          <div class="flex items-baseline justify-between gap-2">
            <span class="truncate text-[12.5px] font-semibold">{{ row.name }}</span>
            <span class="whitespace-nowrap text-[9px] font-semibold" :style="{ color: row.color }">{{ row.when }}</span>
          </div>
          <div class="truncate text-[10px] text-muted">{{ row.met }}</div>
          <div class="mt-1 flex gap-0.5">
            <span
              v-for="i in 3"
              :key="i"
              class="flex h-[11px] w-[11px] items-center justify-center rounded-full text-[6px]"
              :class="i <= row.cups ? 'border-accent bg-accent text-on-accent' : 'border-line'"
              :style="i <= row.cups ? {} : { borderWidth: '1.3px', borderStyle: 'solid' }"
            >
              ☕
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const rows = [
  { name: 'Marcus Bell', when: '2d overdue', met: 'Booth chat · edge functions', cups: 1, color: 'rgb(var(--due))' },
  { name: 'Priya N.', when: 'due today', met: 'Hallway track · Nuxt SSR', cups: 2, color: 'rgb(var(--due))' },
  { name: 'Dana Kirsch', when: 'in 4 days', met: 'Speaker dinner · a11y', cups: 1, color: 'rgb(var(--warm))' },
  { name: 'Sam Okonkwo', when: 'in 41 days', met: 'Coffee line · both from GA', cups: 2, color: 'rgb(var(--fresh))' },
]
</script>