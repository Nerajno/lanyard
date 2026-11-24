import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

type Event = { body: Record<string, unknown>; ip: string; headers: Record<string, string> }

let inserts: string[]
let insertError: { code: string } | null
const responseHeaders: Record<string, string> = {}

vi.mock('~/server/utils/supabaseAdmin', () => ({
  useSupabaseAdmin: () => ({
    from: () => ({
      insert: (row: { email: string }) => ({
        single: async () => {
          if (!insertError) inserts.push(row.email)
          return { error: insertError }
        },
      }),
    }),
  }),
}))

vi.mock('h3', () => ({
  readBody: async (e: Event) => e.body,
  getRequestIP: (e: Event) => e.ip,
  getRequestHeader: (e: Event, name: string) => e.headers[name.toLowerCase()],
  setResponseHeader: (_e: Event, name: string, value: string) => { responseHeaders[name] = value },
}))

let handler: (event: Event) => Promise<unknown>
let resetLimiter: () => void

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
  vi.stubGlobal('createError', (o: object) => Object.assign(new Error('err'), o))
  const mod = await import('~/server/api/waitlist.post')
  handler = mod.default as never
  resetLimiter = mod.__resetWaitlistLimiter
})

beforeEach(() => {
  inserts = []
  insertError = null
  resetLimiter()
})

const ev = (body: Record<string, unknown>, ip = '1.1.1.1', headers: Record<string, string> = {}): Event => ({ body, ip, headers })

describe('POST /api/waitlist', () => {
  it('saves a valid, normalized email', async () => {
    await expect(handler(ev({ email: ' Ada@Example.com ' }))).resolves.toEqual({ ok: true })
    expect(inserts).toEqual(['ada@example.com'])
  })

  it('rejects an invalid email with 400', async () => {
    await expect(handler(ev({ email: 'nope' }))).rejects.toMatchObject({ statusCode: 400 })
    expect(inserts).toEqual([])
  })

  it('silently drops a filled honeypot: looks like success, writes nothing', async () => {
    await expect(handler(ev({ email: 'bot@example.com', website: 'http://spam' }))).resolves.toEqual({ ok: true })
    expect(inserts).toEqual([])
  })

  it('returns 409 for a duplicate email', async () => {
    insertError = { code: '23505' }
    await expect(handler(ev({ email: 'ada@example.com' }))).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rate-limits one address with 429 + Retry-After, leaving others alone', async () => {
    for (let i = 0; i < 5; i++) await handler(ev({ email: `a${i}@example.com` }))
    await expect(handler(ev({ email: 'a6@example.com' }))).rejects.toMatchObject({ statusCode: 429 })
    expect(Number(responseHeaders['Retry-After'])).toBeGreaterThan(0)
    await expect(handler(ev({ email: 'b@example.com' }, '2.2.2.2'))).resolves.toEqual({ ok: true })
  })

  it('counts honeypot hits toward the limit too', async () => {
    for (let i = 0; i < 5; i++) await handler(ev({ email: `bot${i}@example.com`, website: 'x' }))
    await expect(handler(ev({ email: 'real@example.com' }))).rejects.toMatchObject({ statusCode: 429 })
  })

  it("keys on Netlify's client IP header over the socket address", async () => {
    for (let i = 0; i < 5; i++) await handler(ev({ email: `n${i}@example.com` }, '10.0.0.1', { 'x-nf-client-connection-ip': '9.9.9.9' }))
    // Same real client behind a different proxy hop is still limited.
    await expect(handler(ev({ email: 'n6@example.com' }, '10.0.0.2', { 'x-nf-client-connection-ip': '9.9.9.9' })))
      .rejects.toMatchObject({ statusCode: 429 })
  })
})
