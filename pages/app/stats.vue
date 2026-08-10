<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Your loop, so far</h1>
    <p class="mt-1 text-sm text-muted">Measured from the <code class="font-mono">nudges</code> table — not self-report.</p>

    <p v-if="error" class="mt-4 text-sm text-coral">{{ error }}</p>

    <div v-if="loading" class="mt-8 text-sm text-muted">Crunching numbers…</div>

    <template v-else-if="stats">
      <section class="mt-8">
        <h2 class="font-mono text-xs uppercase tracking-eyebrow text-muted">The one metric</h2>
        <div class="mt-3 rounded-xl border border-line bg-surface p-5">
          <p class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ formatMinutes(stats.nudges.medianLatencyMinutes) }}</p>
          <p class="mt-1 font-mono text-xs text-muted">median nudge → act time</p>
        </div>
      </section>

      <section class="mt-8 grid gap-4 sm:grid-cols-2">
        <div class="rounded-xl border border-line bg-surface p-5">
          <p class="font-display text-3xl font-extrabold tracking-[-0.03em]">{{ stats.nudges.actedOnPercent }}%</p>
          <p class="mt-1 font-mono text-xs text-muted">nudges acted on ({{ stats.nudges.actedOn }} / {{ stats.nudges.total }})</p>
        </div>
        <div class="rounded-xl border border-line bg-surface p-5">
          <p class="font-display text-3xl font-extrabold tracking-[-0.03em]">{{ stats.contacts.graduatedPercent }}%</p>
          <p class="mt-1 font-mono text-xs text-muted">contacts reached all three coffees ({{ stats.contacts.graduated }} / {{ stats.contacts.total }})</p>
        </div>
      </section>

      <p v-if="stats.nudges.total === 0" class="mt-6 text-sm text-muted">
        No nudges sent yet. The first hourly pass after your next event fills this in.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

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