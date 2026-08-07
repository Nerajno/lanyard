import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'


let client: SupabaseClient | null = null

/**
 * Singleton Supabase client. Only construct once per runtime (server or browser);
 * @supabase/ssr keeps the session cookie in sync for us.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const { public: { supabaseUrl, supabaseAnonKey } } = useRuntimeConfig()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set (see .env.example)')
  }

  if (import.meta.server) {
    client = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return parseCookieHeader(getCookieHeader())
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          setCookieHeader(cookiesToSet)
        },
      },
    })
  } else {
    client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }

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

function getCookieHeader(): string | null {
  return useRequestHeaders(['cookie']).cookie ?? null
}

function setCookieHeader(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
  const event = useRequestEvent()
  if (!event) return
  for (const cookie of cookiesToSet) {
    setCookie(event, cookie.name, cookie.value, {
      maxAge: cookie.options.maxAge,
      httpOnly: cookie.options.httpOnly,
      secure: cookie.options.secure,
      sameSite: cookie.options.sameSite,
    })
  }
}
