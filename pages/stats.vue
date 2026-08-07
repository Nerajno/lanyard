<template>
  <div class="mx-auto max-w-xl">
    <h1 class="text-2xl font-bold">Your loop, so far</h1>
    <p class="mt-1 text-sm text-slate-500">Measured from the <code>nudges</code> table — not self-report.</p>

    <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>

    <div v-if="loading" class="mt-8 text-sm text-slate-500">Crunching numbers…</div>

    <template v-else-if="stats">
      <section class="mt-8">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">The one metric</h2>
        <div class="mt-3 rounded-xl border border-slate-200 bg-white p-5">
          <p class="text-4xl font-bold tracking-tight">{{ formatMinutes(stats.nudges.medianLatencyMinutes) }}</p>
          <p class="mt-1 text-sm text-slate-500">median nudge → act time</p>
        </div>
      </section>

      <section class="mt-8 grid gap-4 sm:grid-cols-2">
        <div class="rounded-xl border border-slate-200 bg-white p-5">
          <p class="text-3xl font-semibold">{{ stats.nudges.actedOnPercent }}%</p>
          <p class="mt-1 text-sm text-slate-500">nudges acted on ({{ stats.nudges.actedOn }} / {{ stats.nudges.total }})</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5">
          <p class="text-3xl font-semibold">{{ stats.contacts.graduatedPercent }}%</p>
          <p class="mt-1 text-sm text-slate-500">contacts reached all three coffees ({{ stats.contacts.graduated }} / {{ stats.contacts.total }})</p>
        </div>
      </section>

      <p v-if="stats.nudges.total === 0" class="mt-6 text-sm text-slate-500">
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