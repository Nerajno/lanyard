// Manual smoke test for the Twilio + Resend providers. Requires real keys in
// .env (NUXT_TWILIO_*, NUXT_EMAIL_*) — it intentionally fails loudly when they
// are missing so a half-configured environment is never mistaken for a send.
//
// Usage:
//   npm run smoke:send -- --to +15550000000            # Twilio SMS
//   npm run smoke:send -- --to you@example.com --email  # Resend email
//
// This sends a REAL message. Do not run against numbers you don't own, and do
// not expect SMS delivery until the A2P 10DLC brand/campaign is approved.
import { loadEnv } from 'vite'
import twilio from 'twilio'
import { Resend } from 'resend'

const env = loadEnv(process.cwd(), '.env', '')

function requireEnv(name) {
  const value = env[name]
  if (!value) throw new Error(`Missing ${name} in .env — refusing to send`)
  return value
}

const rawArgs = process.argv.slice(2)
const args = {}
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i]
  if (a.startsWith('--')) {
    const key = a.replace(/^--/, '')
    const eq = key.indexOf('=')
    if (eq !== -1) {
      args[key.slice(0, eq)] = key.slice(eq + 1)
    } else {
      args[key] = rawArgs[i + 1]?.startsWith('--') ? true : rawArgs[i + 1] ?? true
      if (args[key] !== true) i++
    }
  }
}
const to = args.to
if (!to) {
  console.error('usage: node scripts/smoke-send.mjs --to <destination> [--email]')
  process.exit(1)
}

const mode = args.email ? 'email' : 'sms'
console.log(`Smoke send via ${mode.toUpperCase()} → ${to}`)

if (mode === 'sms') {
  const sid = requireEnv('NUXT_TWILIO_SID')
  const token = requireEnv('NUXT_TWILIO_TOKEN')
  const from = requireEnv('NUXT_TWILIO_FROM')
  const client = twilio(sid, token)
  const message = await client.messages.create({ to, from, body: 'Lanyard smoke test — ignore this.' })
  console.log(`OK: ${message.sid}`)
} else {
  const apiKey = requireEnv('NUXT_EMAIL_API_KEY')
  const from = requireEnv('NUXT_EMAIL_FROM')
  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: 'Lanyard smoke test',
    html: '<p>Lanyard smoke test — ignore this.</p>',
  })
  if (error) throw new Error(`Resend error: ${error.message}`)
  console.log(`OK: ${data?.id}`)
}