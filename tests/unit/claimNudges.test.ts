import { describe, it, expect, beforeEach } from 'vitest'
import { claimOpenNudges } from '~/utils/claimNudges'

type Row = { id: string; user_id: string; contact_ids: string[]; acted_at: string | null }
let rows: Row[]
let failOn: 'select' | 'update' | null

// Minimal fake of the supabase query builder for the two calls the helper makes.
function fakeClient() {
  return {
    from(_table: string) {
      const f: { eq: Record<string, unknown>; isNull: string[]; contains?: string[]; inIds?: string[] } = { eq: {}, isNull: [] }
      let patch: Partial<Row> | null = null
      const q: any = {
        select: () => q,
        update: (p: Partial<Row>) => { patch = p; return q },
        eq: (k: string, v: unknown) => { f.eq[k] = v; return q },
        is: (k: string, v: null) => { if (v === null) f.isNull.push(k); return q },
        contains: (_k: string, v: string[]) => { f.contains = v; return q },
        in: (_k: string, v: string[]) => { f.inIds = v; return q },
        then: (res: (v: unknown) => void) => {
          const match = rows.filter((r) =>
            Object.entries(f.eq).every(([k, v]) => (r as any)[k] === v)
            && f.isNull.every((k) => (r as any)[k] === null)
            && (!f.contains || f.contains.every((c) => r.contact_ids.includes(c)))
            && (!f.inIds || f.inIds.includes(r.id)))
          if (patch) {
            if (failOn === 'update') return res({ data: null, error: { message: 'update failed' } })
            match.forEach((r) => Object.assign(r, patch))
            return res({ data: match.map((r) => ({ id: r.id })), error: null })
          }
          if (failOn === 'select') return res({ data: null, error: { message: 'select failed' } })
          return res({ data: match.map((r) => ({ id: r.id, contact_ids: r.contact_ids })), error: null })
        },
      }
      return q
    },
  }
}

const NOW = new Date('2026-10-03T12:00:00Z')

beforeEach(() => {
  rows = []
  failOn = null
})

describe('claimOpenNudges', () => {
  it('returns none when the contact has no open direct nudge', async () => {
    rows = [{ id: 'n1', user_id: 'u1', contact_ids: ['c1'], acted_at: '2026-10-01T00:00:00Z' }]
    expect(await claimOpenNudges(fakeClient() as never, 'u1', 'c1', NOW)).toBe('none')
  })

  it('claims an open direct nudge and stamps acted_at', async () => {
    rows = [{ id: 'n1', user_id: 'u1', contact_ids: ['c1'], acted_at: null }]
    expect(await claimOpenNudges(fakeClient() as never, 'u1', 'c1', NOW)).toBe('claimed')
    expect(rows[0].acted_at).toBe(NOW.toISOString())
  })

  it('claims every open direct nudge for the contact', async () => {
    rows = [
      { id: 'n1', user_id: 'u1', contact_ids: ['c1'], acted_at: null },
      { id: 'n2', user_id: 'u1', contact_ids: ['c1'], acted_at: null },
    ]
    expect(await claimOpenNudges(fakeClient() as never, 'u1', 'c1', NOW)).toBe('claimed')
    expect(rows.every((r) => r.acted_at === NOW.toISOString())).toBe(true)
  })

  it('ignores digest nudges that include the contact', async () => {
    rows = [{ id: 'd1', user_id: 'u1', contact_ids: ['c1', 'c2'], acted_at: null }]
    expect(await claimOpenNudges(fakeClient() as never, 'u1', 'c1', NOW)).toBe('none')
    expect(rows[0].acted_at).toBeNull()
  })

  it('returns lost when the act-link claimed it between lookup and update', async () => {
    rows = [{ id: 'n1', user_id: 'u1', contact_ids: ['c1'], acted_at: null }]
    const client = fakeClient()
    const realFrom = client.from
    let calls = 0
    client.from = (t: string) => {
      calls += 1
      // Second call is the claim; simulate the act-link winning just before it.
      if (calls === 2) rows[0].acted_at = '2026-10-03T11:59:59Z'
      return realFrom(t)
    }
    expect(await claimOpenNudges(client as never, 'u1', 'c1', NOW)).toBe('lost')
    expect(rows[0].acted_at).toBe('2026-10-03T11:59:59Z')
  })

  it('throws when the lookup fails', async () => {
    failOn = 'select'
    await expect(claimOpenNudges(fakeClient() as never, 'u1', 'c1', NOW)).rejects.toThrow('select failed')
  })

  it('throws when the claim fails', async () => {
    rows = [{ id: 'n1', user_id: 'u1', contact_ids: ['c1'], acted_at: null }]
    failOn = 'update'
    await expect(claimOpenNudges(fakeClient() as never, 'u1', 'c1', NOW)).rejects.toThrow('update failed')
  })
})
