import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getRequestHeader, setCookie } from 'h3'

/**
 * The browser client is a true singleton — one tab, one session.
 */
let browserClient: SupabaseClient | null = null

/**
 * Server clients are per-request, never global: a module-level cache would let
 * one request read and write another request's auth cookies. Keyed on the Nuxt
 * app instance (one per SSR request) and weakly held so it dies with it.
 */
const serverClients = new WeakMap<object, SupabaseClient>()

export function getSupabaseClient(): SupabaseClient {
  const { public: { supabaseUrl, supabaseAnonKey } } = useRuntimeConfig()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_ANON_KEY must be set (see .env.example)')
  }

  if (import.meta.client) {
    browserClient ??= createBrowserClient(supabaseUrl, supabaseAnonKey)
    return browserClient
  }

  const nuxtApp = useNuxtApp()
  const cached = serverClients.get(nuxtApp)
  if (cached) return cached

  // Resolve the event NOW, while a Nuxt instance is guaranteed. Supabase calls
  // the cookie handlers below lazily from deep inside its async session code,
  // where useRequestEvent()/useRequestHeaders() would throw.
  const event = useRequestEvent()

  // Mutable jar seeded from the request. setAll writes back into it so a later
  // getAll sees cookies this request already set, rather than a stale snapshot.
  const jar = new Map<string, string>()
  for (const { name, value } of parseCookieHeader(event ? getRequestHeader(event, 'cookie') ?? null : null)) {
    jar.set(name, value)
  }

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return [...jar].map(([name, value]) => ({ name, value }))
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value, options } of cookiesToSet) {
          jar.set(name, value)
          if (!event) continue
          setCookie(event, name, value, {
            maxAge: options.maxAge,
            httpOnly: options.httpOnly,
            secure: options.secure,
            sameSite: options.sameSite,
          })
        }
      },
    },
  })

  serverClients.set(nuxtApp, client)
  return client
}

export function useSupabase(): SupabaseClient {
  return getSupabaseClient()
}

export async function useSupabaseUser(): Promise<User | null> {
  const { data } = await useSupabase().auth.getUser()
  return data.user ?? null
}

function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  if (!header) return []
  return header.split(';').map((part) => {
    const [name, ...rest] = part.trim().split('=')
    return { name, value: rest.join('=') }
  })
}
