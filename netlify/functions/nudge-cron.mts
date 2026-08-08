// Netlify Scheduled Function — the hourly trigger for the nudge loop.
// Netlify invokes this on the `@hourly` schedule declared in netlify.toml; in
// turn it POSTs to the thin Nitro route /api/cron/nudge with the shared
// NUXT_CRON_SECRET, so all nudge logic stays in one testable place.
// Netlify does not expose scheduled functions over HTTP in production, which is
// intentional — the schedule and the shared secret are the only ways in.

export default async (): Promise<Response> => {
  const origin = process.env.URL ?? process.env.DEPLOY_URL ?? 'http://localhost:8888'
  const secret = process.env.NUXT_CRON_SECRET ?? ''

  if (!secret) {
    return new Response('NUXT_CRON_SECRET not set', { status: 500 })
  }

  const res = await fetch(`${origin}/api/cron/nudge`, {
    method: 'POST',
    headers: {
      'x-cron-secret': secret,
      'content-type': 'application/json',
    },
  })

  if (!res.ok) {
    return new Response(`nudge loop failed: ${res.status}`, { status: 502 })
  }

  return new Response(await res.text(), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}