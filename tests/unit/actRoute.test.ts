import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { signActLink } from '~/utils/actLink'

const SECRET = 'unit-test-secret'
const contact = {
  id: 'c1', how_met: 'Met at the meetup', email: 'ada@example.com', phone: null,
  cadence_ladder: [{ value: 2, unit: 'day' }, { value: 14, unit: 'day' }, { value: 45, unit: 'day' }],
  touchpoints_done: 0,
}

// Fake admin client: tracks the nudge's acted_at so the conditional claim behaves like Postgres.
let actedAt: string | null
let contactUpdates: Record<string, unknown>[]
function fakeAdmin() {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let patch: Record<string, unknown> | null = null
      const q: any = {
        select: () => q,
        update: (p: Record<string, unknown>) => { patch = p; return q },
        eq: (k: string, v: unknown) => { filters[k] = v; return q },
        is: (k: string, v: unknown) => { filters[`is:${k}`] = v; return q },
        single: async () => ({ data: table === 'contacts' ? contact : { id: 'n1', opened_at: 'x', acted_at: actedAt } }),
        maybeSingle: async () => {
          if (table === 'nudges' && patch && 'acted_at' in patch) {
            if (actedAt !== null) return { data: null }
            actedAt = patch.acted_at as string
            return { data: { id: 'n1' } }
          }
          return { data: null }
        },
        then: (res: (v: unknown) => void) => {
          if (table === 'contacts' && patch) contactUpdates.push(patch)
          res({ data: null, error: null })
        },
      }
      return q
    },
  }
}

vi.mock('~/server/utils/supabaseAdmin', () => ({ useSupabaseAdmin: () => fakeAdmin() }))

let handler: (event: { token: string }) => Promise<string>

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
  vi.stubGlobal('getRouterParam', (e: { token: string }) => e.token)
  vi.stubGlobal('useRuntimeConfig', () => ({ actLinkSigningSecret: SECRET, public: { appUrl: 'http://x' } }))
  vi.stubGlobal('sendRedirect', (_e: unknown, url: string) => url)
  vi.stubGlobal('createError', (o: object) => Object.assign(new Error('err'), o))
  handler = (await import('~/server/routes/act/[token].get')).default as never
})

beforeEach(() => {
  actedAt = null
  contactUpdates = []
})

describe('act route', () => {
  const token = () => signActLink({ nudgeId: 'n1', contactId: 'c1' }, SECRET)

  it('advances the ladder on the first act', async () => {
    const url = await handler({ token: token() })
    expect(url.startsWith('mailto:ada@example.com')).toBe(true)
    expect(contactUpdates).toHaveLength(1)
    expect(contactUpdates[0].touchpoints_done).toBe(1)
  })

  it('does not advance again on replay but still opens the composer', async () => {
    await handler({ token: token() })
    const url = await handler({ token: token() })
    expect(url.startsWith('mailto:')).toBe(true)
    expect(contactUpdates).toHaveLength(1)
  })
})
