// Twilio adapter — thin SDK wrapper behind the SmsProvider interface.
// Fail-closed: construction throws if any required credential is missing, so a
// half-configured runtime fails loudly instead of silently skipping sends.
import twilio, { type Twilio } from 'twilio'
import { validateRequest } from 'twilio/lib/webhooks/webhooks.js'
import type { SmsProvider } from './types'

export interface TwilioConfig {
  sid: string
  token: string
  from: string
}

export class TwilioSmsProvider implements SmsProvider {
  private client: Twilio
  private from: string

  constructor(cfg: TwilioConfig) {
    if (!cfg.sid || !cfg.token || !cfg.from) {
      throw new Error('Twilio SMS is not fully configured (NUXT_TWILIO_SID/TOKEN/FROM)')
    }
    this.client = twilio(cfg.sid, cfg.token)
    this.from = cfg.from
  }

  /** Returns the Message SID, or null if the API omitted one. */
  async send(to: string, body: string): Promise<string | null> {
    const message = await this.client.messages.create({ to, from: this.from, body })
    return message.sid ?? null
  }
}

/** Phone-verification surface for profile/phone.ts (Twilio Verify). */
export class TwilioVerify {
  private client: Twilio
  private verifySid: string

  constructor(cfg: { sid: string; token: string; verifySid: string }) {
    if (!cfg.sid || !cfg.token || !cfg.verifySid) {
      throw new Error('Twilio Verify is not fully configured (NUXT_TWILIO_SID/TOKEN/VERIFY_SID)')
    }
    this.client = twilio(cfg.sid, cfg.token)
    this.verifySid = cfg.verifySid
  }

  async sendCode(to: string): Promise<void> {
    await this.client.verify.v2.services(this.verifySid).verifications.create({ to, channel: 'sms' })
  }

  async checkCode(to: string, code: string): Promise<boolean> {
    const check = await this.client.verify.v2.services(this.verifySid).verificationChecks.create({ to, code })
    return check.status === 'approved'
  }
}

/** Twilio webhook signature validation via the official SDK. */
export function isValidTwilioRequest(
  authToken: string,
  url: string,
  header: string | null,
  params: Record<string, string>,
): boolean {
  if (!authToken || !header) return false
  return validateRequest(authToken, header, url, params)
}