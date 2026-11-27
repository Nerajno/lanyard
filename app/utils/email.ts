// Strict enough to keep an address safe inside a mailto: URL — no query/header
// metacharacters, exactly one @, dotted domain. Not a full RFC 5322 parser.
const CONTACT_EMAIL_RE = /^[^\s@?&#,;<>"'%]+@[^\s@?&#,;<>"'%]+\.[^\s@?&#,;<>"'%]+$/

export function isValidContactEmail(email: string | null | undefined): email is string {
  return typeof email === 'string' && CONTACT_EMAIL_RE.test(email)
}
