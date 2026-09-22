// Shared server-side auth: resolve the caller's Supabase user from either the
// Authorization: Bearer <access_token> header (stats.vue, phone.ts, delete.ts)
// or the `sb-*` auth cookie that the browser Supabase client sets. H2 fix —
// routes that silently skipped auth when no token was sent now reject loudly.
import type { H3Event } from 'h3'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

/** Resolve the authenticated user, or null when no usable token is present. */
export async function requireUser(event: H3Event): Promise<{ id: string; email?: string } | null> {
  const token = authToken(event)
  if (!token) return null

  const { data } = await useSupabaseAdmin().auth.getUser(token)
  return data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null
}

function authToken(event: H3Event): string {
  const bearer = (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (bearer) return bearer

  // Browser Supabase client persists the session in an `sb-<ref>-auth-token`
  // cookie. The value is `base64-` + base64url(JSON session) when encoded
  // (cookieEncoding default 'base64url'), or a raw JWT when not.
  for (const [name, value] of Object.entries(parseCookies(event))) {
    if (name.startsWith('sb-') && name.endsWith('-auth-token') && value) {
      return accessTokenFromCookie(value)
    }
  }
  return ''
}

/** Extract the access_token JWT from an ssr auth-token cookie value. */
function accessTokenFromCookie(value: string): string {
  const raw = value.startsWith('base64-') ? value.slice('base64-'.length) : value
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const session = JSON.parse(json) as { access_token?: string }
    if (session.access_token) return session.access_token
  } catch {
    // Not base64url JSON — fall through to treat the value itself as the JWT.
  }
  return raw
}