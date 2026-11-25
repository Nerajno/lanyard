import { describe, it, expect, vi } from 'vitest'

describe('TwilioSmsProvider', () => {
  it('throws on incomplete config (fail-closed)', async () => {
    const { TwilioSmsProvider } = await import('~/server/services/providers/twilio')
    expect(() => new TwilioSmsProvider({ sid: '', token: 't', from: '+1' })).toThrow(/not fully configured/)
    expect(() => new TwilioSmsProvider({ sid: 's', token: '', from: '+1' })).toThrow(/not fully configured/)
    expect(() => new TwilioSmsProvider({ sid: 's', token: 't', from: '' })).toThrow(/not fully configured/)
  })

  it('delegates to the SDK messages.create and returns the SID', async () => {
    vi.resetModules()
    const create = vi.fn(async () => ({ sid: 'SM123' }))
    const twilio = vi.fn(() => ({ messages: { create } }))
    vi.doMock('twilio', () => ({ default: twilio }))
    const { TwilioSmsProvider } = await import('~/server/services/providers/twilio')
    const provider = new TwilioSmsProvider({ sid: 'AC1', token: 'tok', from: '+15000000000' })
    const sid = await provider.send('+15550000000', 'hello')
    expect(sid).toBe('SM123')
    expect(create).toHaveBeenCalledWith({ to: '+15550000000', from: '+15000000000', body: 'hello' })
    vi.doUnmock('twilio')
  })
})

describe('TwilioVerify', () => {
  it('throws on incomplete config (fail-closed)', async () => {
    const { TwilioVerify } = await import('~/server/services/providers/twilio')
    expect(() => new TwilioVerify({ sid: 's', token: '', verifySid: '' })).toThrow(/not fully configured/)
  })

  it('sends a code through the Verify service', async () => {
    vi.resetModules()
    const create = vi.fn(async () => ({}))
    const checks = vi.fn(async () => ({}))
    const twilio = vi.fn(() => ({
      verify: { v2: { services: vi.fn(() => ({ verifications: { create }, verificationChecks: { create: checks } })) } },
    }))
    vi.doMock('twilio', () => ({ default: twilio }))
    const { TwilioVerify } = await import('~/server/services/providers/twilio')
    const verify = new TwilioVerify({ sid: 'AC1', token: 'tok', verifySid: 'VA1' })
    await verify.sendCode('+15550000000')
    expect(create).toHaveBeenCalledWith({ to: '+15550000000', channel: 'sms' })
    vi.doUnmock('twilio')
  })

  it('approves only an approved verification check', async () => {
    vi.resetModules()
    const twilio = vi.fn(() => ({
      verify: { v2: { services: vi.fn(() => ({ verifications: { create: vi.fn() }, verificationChecks: { create: vi.fn(async () => ({ status: 'approved' })) } })) } },
    }))
    vi.doMock('twilio', () => ({ default: twilio }))
    const { TwilioVerify } = await import('~/server/services/providers/twilio')
    const verify = new TwilioVerify({ sid: 'AC1', token: 'tok', verifySid: 'VA1' })
    expect(await verify.checkCode('+15550000000', '123456')).toBe(true)
    vi.doUnmock('twilio')
  })

  it('rejects a pending verification check', async () => {
    vi.resetModules()
    const twilio = vi.fn(() => ({
      verify: { v2: { services: vi.fn(() => ({ verifications: { create: vi.fn() }, verificationChecks: { create: vi.fn(async () => ({ status: 'pending' })) } })) } },
    }))
    vi.doMock('twilio', () => ({ default: twilio }))
    const { TwilioVerify } = await import('~/server/services/providers/twilio')
    const verify = new TwilioVerify({ sid: 'AC1', token: 'tok', verifySid: 'VA1' })
    expect(await verify.checkCode('+15550000000', '000000')).toBe(false)
    vi.doUnmock('twilio')
  })
})

describe('isValidTwilioRequest', () => {
  it('returns false when no auth token or no signature header is present', async () => {
    const { isValidTwilioRequest } = await import('~/server/services/providers/twilio')
    expect(isValidTwilioRequest('', 'https://x/api', 'abc', { From: '+1' })).toBe(false)
    expect(isValidTwilioRequest('token', 'https://x/api', null, { From: '+1' })).toBe(false)
  })

  it('returns true for a signature produced with the same auth token', async () => {
    const { isValidTwilioRequest } = await import('~/server/services/providers/twilio')
    const authToken = 'secret-token'
    const url = 'https://lanyard.app/api/twilio/sms-status'
    const params = { From: '+15550000000', Body: 'STOP' }
    const sorted = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}${v}`)
      .join('')
    const { createHmac } = await import('node:crypto')
    const expected = createHmac('sha1', authToken).update(url + sorted).digest('base64')
    expect(isValidTwilioRequest(authToken, url, expected, params)).toBe(true)
  })

  it('returns false for a signature produced with a different token', async () => {
    const { isValidTwilioRequest } = await import('~/server/services/providers/twilio')
    const url = 'https://lanyard.app/api/twilio/sms-status'
    const params = { From: '+15550000000', Body: 'STOP' }
    const sorted = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}${v}`)
      .join('')
    const { createHmac } = await import('node:crypto')
    const wrong = createHmac('sha1', 'attacker').update(url + sorted).digest('base64')
    expect(isValidTwilioRequest('real-token', url, wrong, params)).toBe(false)
  })
})

describe('ResendEmailProvider', () => {
  it('throws on incomplete config (fail-closed)', async () => {
    const { ResendEmailProvider } = await import('~/server/services/providers/resend')
    expect(() => new ResendEmailProvider({ apiKey: '', from: 'a@b.co' })).toThrow(/not fully configured/)
    expect(() => new ResendEmailProvider({ apiKey: 'k', from: '' })).toThrow(/not fully configured/)
  })

  it('returns the email id on success', async () => {
    vi.resetModules()
    const send = vi.fn(async () => ({ data: { id: 're_123' }, error: null }))
    vi.doMock('resend', () => ({ Resend: vi.fn(function () { return { emails: { send } } }) }))
    const { ResendEmailProvider } = await import('~/server/services/providers/resend')
    const provider = new ResendEmailProvider({ apiKey: 'k', from: 'hi@lanyard.app' })
    const id = await provider.send('to@x.co', 'Subject', '<p>hi</p>')
    expect(id).toBe('re_123')
    expect(send).toHaveBeenCalledWith({ from: 'hi@lanyard.app', to: ['to@x.co'], subject: 'Subject', html: '<p>hi</p>' })
    vi.doUnmock('resend')
  })

  it('throws when the API reports an error', async () => {
    vi.resetModules()
    const send = vi.fn(async () => ({ data: null, error: { message: 'domain not verified' } }))
    vi.doMock('resend', () => ({ Resend: vi.fn(function () { return { emails: { send } } }) }))
    const { ResendEmailProvider } = await import('~/server/services/providers/resend')
    const provider = new ResendEmailProvider({ apiKey: 'k', from: 'hi@lanyard.app' })
    await expect(provider.send('to@x.co', 'S', '<p>hi</p>')).rejects.toThrow('Resend send failed: domain not verified')
    vi.doUnmock('resend')
  })
})