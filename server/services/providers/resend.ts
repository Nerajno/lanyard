// Resend adapter — thin SDK wrapper behind the EmailProvider interface.
// Fail-closed: construction throws if any required credential is missing.
import { Resend } from 'resend'
import type { EmailProvider } from './types'

export interface ResendConfig {
  apiKey: string
  from: string
}

export class ResendEmailProvider implements EmailProvider {
  private client: Resend
  private from: string

  constructor(cfg: ResendConfig) {
    if (!cfg.apiKey || !cfg.from) {
      throw new Error('Resend is not fully configured (NUXT_EMAIL_API_KEY/FROM)')
    }
    this.client = new Resend(cfg.apiKey)
    this.from = cfg.from
  }

  /** Returns the email id, or null if the API omitted one. */
  async send(to: string, subject: string, html: string): Promise<string | null> {
    const { data, error } = await this.client.emails.send({ from: this.from, to: [to], subject, html })
    if (error) throw new Error(`Resend send failed: ${error.message}`)
    return data?.id ?? null
  }
}