export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeWaitlistEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function isValidWaitlistEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}