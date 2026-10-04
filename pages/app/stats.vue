<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Your loop, so far</h1>
    <p class="mt-1 text-sm text-muted">Measured from the <code class="font-mono">nudges</code> table — not self-report.</p>

    <p v-if="error" role="alert" class="mt-4 rounded-lg bg-error-soft px-3 py-2 text-sm text-error">{{ error }}</p>
    <p v-if="loading" class="mt-8 text-sm text-muted">Crunching numbers…</p>

    <template v-else-if="stats">
      <section class="mt-6 rounded-xl bg-navy p-6 text-white" aria-labelledby="hero-metric">
        <h2 id="hero-metric" class="text-label-caps uppercase text-white/70">The one metric</h2>
        <p class="mt-2 font-display text-5xl font-bold tracking-[-0.02em]">{{ formatMinutes(stats.nudges.medianLatencyMinutes) }}</p>
        <p class="mt-1 text-sm text-white/70">median time from nudge to message</p>
      </section>

      <section class="mt-4 grid grid-cols-2 gap-3">
        <div class="rounded-xl border border-line bg-surface p-4">
          <p class="font-display text-3xl font-bold tracking-[-0.02em]">{{ stats.nudges.actedOnPercent }}%</p>
          <p class="mt-1 text-xs text-muted">nudges acted on ({{ stats.nudges.actedOn }} / {{ stats.nudges.total }})</p>
        </div>
        <div class="rounded-xl border border-line bg-surface p-4">
          <p class="font-display text-3xl font-bold tracking-[-0.02em] text-graduated">{{ stats.contacts.graduatedPercent }}%</p>
          <p class="mt-1 text-xs text-muted">reached all three coffees ({{ stats.contacts.graduated }} / {{ stats.contacts.total }})</p>
        </div>
      </section>

      <UiEmptyState
        v-if="stats.nudges.total === 0" class="mt-6"
        title="No nudges yet" body="The first hourly pass after your next event fills this in."
      />
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'app' })

interface Stats {
  nudges: { total: number; actedOn: number; actedOnPercent: number; medianLatencyMinutes: number | null }
  contacts: { total: number; graduated: number; graduatedPercent: number }
}

const stats = ref<Stats | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const { data } = await useSupabase().auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Not signed in')
    stats.value = await $fetch<Stats>('/api/stats', { headers: { Authorization: `Bearer ${token}` } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

function formatMinutes(min: number | null): string {
  if (min === null) return '—'
  if (min < 60) return `${Math.round(min)} min`
  return `${(min / 60).toFixed(1)} hrs`
}
</script>