export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeWaitlistEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function isValidWaitlistEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}
/** True when the hidden honeypot field carries anything; humans leave it empty. */
export function isHoneypotFilled(value: unknown): boolean {
  return typeof value === 'string' ? value.trim() !== '' : value != null && value !== false
}
