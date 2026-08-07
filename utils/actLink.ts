// Signed, single-purpose act-link tokens.
//
// The act-link must work from a phone without a fresh login, so it can't rely
// on a Supabase session. Instead we sign the payload with a server-only secret
// (ACT_LINK_SIGNING_SECRET) using HMAC-SHA256. TTL keeps tokens single-purpose.
//
// Pure except for `node:crypto`; unit-tested in Vitest with a fixed secret.
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface ActPayload {
  v: 1
  nudgeId: string
  contactId: string
  /** single contact = direct message; absent => digest (link to triage) */
  digest?: boolean
  /** unix ms */
  exp: number
}

const TTL_MS = 14 * 24 * 60 * 60 * 1000 // 2 weeks

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

function fromB64url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(secret: string, payloadB64: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

/** Seconds-safe compare to avoid timing attacks. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Sign an act-link payload. `secret` comes from ACT_LINK_SIGNING_SECRET.
 * Returns the opaque token to embed in a nudge.
 */
export function signActLink(payload: Omit<ActPayload, 'v' | 'exp'>, secret: string, now: Date = new Date()): string {
  const full: ActPayload = { v: 1, ...payload, exp: now.getTime() + TTL_MS }
  const body = b64url(JSON.stringify(full))
  return `${body}.${sign(secret, body)}`
}

/**
 * Verify and decode an act-link token. Throws on a bad signature, an unknown
 * version, or an expired link. Returns null for empty input.
 */
export function verifyActLink(token: string, secret: string, now: Date = new Date()): ActPayload {
  const [body, sig] = token.split('.')
  if (!body || !sig) throw new Error('Malformed act-link')

  const expected = sign(secret, body)
  if (!safeEqual(sig, expected)) throw new Error('Bad act-link signature')

  let parsed: Partial<ActPayload>
  try {
    parsed = JSON.parse(fromB64url(body)) as Partial<ActPayload>
  } catch {
    throw new Error('Bad act-link payload')
  }
  if (parsed.v !== 1 || !parsed.contactId || !parsed.nudgeId || typeof parsed.exp !== 'number') {
    throw new Error('Invalid act-link payload')
  }
  if (parsed.exp < now.getTime()) {
    throw new Error('Act-link expired')
  }
  return parsed as ActPayload
}

export function buildNudgeActLink(baseUrl: string, payload: Omit<ActPayload, 'v' | 'exp'>, secret: string): string {
  const token = signActLink(payload, secret)
  return `${baseUrl.replace(/\/$/, '')}/api/act?t=${encodeURIComponent(token)}`
}