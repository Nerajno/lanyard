// Provider abstractions for the two outbound channels. Thin SDK adapters live
// in ./twilio.ts and ./resend.ts; the sender core only depends on these
// interfaces so it stays unit-testable without mocking SDK internals.

/** Sends a one-off message and returns a provider-side id, or null if none. */
export interface SmsProvider {
  send(to: string, body: string): Promise<string | null>
}

/** Sends a one-off email and returns a provider-side id, or null if none. */
export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<string | null>
}