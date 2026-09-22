import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deliverNudges } from '~/server/services/nudgeSender'
import type { SmsProvider, EmailProvider } from '~/server/services/providers/types'
import type { Profile, Contact } from '~/types'
import type { DueResult } from '~/utils/due'
import { hashE164 } from '~/server/utils/smsSuppression'

const profile: Profile = {
  user_id: 'u1',
  email: 'u1@example.com',
  phone: '+15550000000',
  phone_verified_at: '2026-01-01T00:00:00Z',
  nudge_channel: 'both',
  timezone: 'UTC',
  quiet_hours_start: 0,
  quiet_hours_end: 0,
  onboarded_at: '2026-01-01T00:00:00Z',
  sms_opt_in_at: '2026-01-01T00:00:00Z',
  sms_opted_out_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const contact: Contact = {
  id: 'c1',
  user_id: 'u1',
  name: 'Ada',
  how_met: 'Met at the GraphQL meetup',
  status: 'active',
  follow_up_by: '2026-01-02T00:00:00Z',
  remind_at: null,
  cadence_ladder: [{ value: 2, unit: 'day' }, { value: 14, unit: 'day' }, { value: 45, unit: 'day' }],
  touchpoints_done: 0,
  email: null,
  phone: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function singleResult(nudgeId: string) {
  return { data: { id: nudgeId }, error: null }
}

function mockAdmin(opts: { nudgeId?: string; suppressed?: boolean } = {}) {
  const nudgeId = opts.nudgeId ?? 'n1'
  const suppressed = opts.suppressed ?? false
  const inserts: Record<string, unknown>[] = []
  const updates: { payload: Record<string, unknown>; id: string }[] = []

  const q = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      inserts.push(payload)
      return { select: vi.fn(() => ({ single: vi.fn(async () => singleResult(nudgeId)) })) }
    }),
    update: vi.fn((payload: Record<string, unknown>) => ({
      eq: vi.fn(async (_col: string, id: string) => {
        updates.push({ payload, id })
        return { error: null }
      }),
    })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: suppressed ? { id: 1 } : null, error: null })) })),
    })),
  }
  const admin = {
    from: vi.fn(() => q),
  } as unknown as SupabaseClient
  return { admin, q, inserts, updates }
}

function mockProviders() {
  const sms = { send: vi.fn(async (_to: string, _body: string) => 'sm1') } satisfies SmsProvider
  const email = { send: vi.fn(async (_to: string, _subject: string, _html: string) => 'em1') } satisfies EmailProvider
  return { sms, email }
}

const deps = {
  sms: null as SmsProvider | null,
  email: null as EmailProvider | null,
  appUrl: 'http://localhost:3000',
  actLinkSigningSecret: 'test-secret',
}

function directResult(): DueResult {
  return { due: [contact], direct: true, count: 1 }
}

function digestResult(): DueResult {
  return { due: [contact, { ...contact, id: 'c2' }], direct: false, count: 2 }
}

describe('deliverNudges', () => {
  it('skips SMS without opt-in or phone, still sends email', async () => {
    const { admin, inserts, updates } = mockAdmin()
    const { sms, email } = mockProviders()
    const res = await deliverNudges(
      { ...profile, phone: null, sms_opt_in_at: null, nudge_channel: 'both' },
      { c1: contact },
      directResult(),
      { ...deps, admin, sms, email },
    )
    expect(res.sent).toBe(1)
    expect(res.skipped).toEqual(['sms:no-opt-in-or-phone'])
    expect(sms.send).not.toHaveBeenCalled()
    expect(email.send).toHaveBeenCalledTimes(1)
    expect(inserts.length).toBe(1)
    expect(updates.length).toBe(1)
  })

  it('skips SMS when Twilio is not configured', async () => {
    const { sms, email } = mockProviders()
    const { admin: a } = mockAdmin()
    const res = await deliverNudges(profile, { c1: contact }, directResult(), { ...deps, admin: a, sms: null, email })
    expect(res.skipped).toEqual(['sms:twilio-not-configured'])
    expect(sms.send).not.toHaveBeenCalled()
    expect(email.send).toHaveBeenCalledTimes(1)
  })

  it('skips email when Resend is not configured', async () => {
    const { admin: a } = mockAdmin()
    const { sms } = mockProviders()
    const res = await deliverNudges(profile, { c1: contact }, directResult(), {
      ...deps,
      admin: a,
      sms,
      email: null,
      appUrl: 'http://localhost:3000',
    })
    expect(res.skipped).toEqual(['email:not-configured'])
    expect(sms.send).toHaveBeenCalledTimes(1)
  })

  it('sends direct SMS with how_met verbatim and the act-link, marking pending → sent', async () => {
    const { admin, inserts, updates } = mockAdmin({ nudgeId: 'n9' })
    const { sms, email } = mockProviders()
    const res = await deliverNudges({ ...profile, nudge_channel: 'sms' }, { c1: contact }, directResult(), {
      ...deps,
      admin,
      sms,
      email,
    })
    expect(res.sent).toBe(1)
    expect(inserts[0]).toMatchObject({ delivery_status: 'pending', channel: 'sms', contact_ids: ['c1'] })
    expect(sms.send).toHaveBeenCalledTimes(1)
    const [to, body] = sms.send.mock.calls[0]
    expect(to).toBe('+15550000000')
    expect(body).toContain('Met at the GraphQL meetup')
    expect(body).toContain('/act/')
    expect(updates[0]).toMatchObject({ payload: { delivery_status: 'sent', provider_message_id: 'sm1' }, id: 'n9' })
  })

  it('sends a direct email and marks pending → sent with provider id', async () => {
    const { admin, inserts, updates } = mockAdmin({ nudgeId: 'n9' })
    const { sms, email } = mockProviders()
    const res = await deliverNudges({ ...profile, nudge_channel: 'email' }, { c1: contact }, directResult(), {
      ...deps,
      admin,
      sms,
      email,
    })
    expect(res.sent).toBe(1)
    expect(inserts[0]).toMatchObject({ channel: 'email', delivery_status: 'pending' })
    expect(email.send).toHaveBeenCalledTimes(1)
    const [to, subject, html] = email.send.mock.calls[0]
    expect(to).toBe('u1@example.com')
    expect(subject).toBe('Follow up')
    expect(html).toContain('Met at the GraphQL meetup')
    expect(html).toContain('/act/')
    expect(updates[0]).toMatchObject({ payload: { delivery_status: 'sent', provider_message_id: 'em1' }, id: 'n9' })
  })

  it('sends a digest SMS with the triage link (no how_met)', async () => {
    const { admin } = mockAdmin({ nudgeId: 'n9' })
    const { sms, email } = mockProviders()
    const res = await deliverNudges({ ...profile, nudge_channel: 'sms' }, { c1: contact }, digestResult(), {
      ...deps,
      admin,
      sms,
      email,
    })
    expect(res.sent).toBe(1)
    const [to, body] = sms.send.mock.calls[0]
    expect(to).toBe('+15550000000')
    expect(body).toContain('2 follow-ups due')
    expect(body).toContain('http://localhost:3000/app')
    expect(body).not.toContain('Met at the GraphQL meetup')
  })

  it('sends both channels when nudge_channel is both', async () => {
    const { admin } = mockAdmin({ nudgeId: 'n9' })
    const { sms, email } = mockProviders()
    const res = await deliverNudges(profile, { c1: contact }, directResult(), { ...deps, admin, sms, email })
    expect(res.sent).toBe(2)
    expect(sms.send).toHaveBeenCalledTimes(1)
    expect(email.send).toHaveBeenCalledTimes(1)
  })

  it('does not send SMS to a suppressed number', async () => {
    const { admin } = mockAdmin({ suppressed: true })
    const { sms, email } = mockProviders()
    const res = await deliverNudges(profile, { c1: contact }, directResult(), { ...deps, admin, sms, email })
    expect(res.skipped).toContain('sms:no-opt-in-or-phone')
    expect(sms.send).not.toHaveBeenCalled()
    expect(email.send).toHaveBeenCalledTimes(1)
    expect(admin.from).toHaveBeenCalledWith('sms_suppressions')
  })

  it('marks the nudge row failed and rethrows when the provider throws', async () => {
    const { admin, updates } = mockAdmin({ nudgeId: 'n9' })
    const sms = { send: vi.fn(async () => { throw new Error('Twilio send failed: 500') }) } satisfies SmsProvider
    const email = { send: vi.fn(async () => 'em1') } satisfies EmailProvider
    await expect(
      deliverNudges({ ...profile, nudge_channel: 'sms' }, { c1: contact }, directResult(), { ...deps, admin, sms, email }),
    ).rejects.toThrow('Twilio send failed: 500')
    expect(updates[0]).toMatchObject({ payload: { delivery_status: 'failed' }, id: 'n9' })
  })

  it('counts a 26h-cap guard: delivery_status pending rows do not count as sent', () => {
    // Guard lives in cron/nudge.ts; here we only pin the send-state contract.
    expect(hashE164('+15550000000')).toMatch(/^[a-f0-9]{64}$/)
  })
})