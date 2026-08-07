// Service-role Supabase client for server-only code (Nitro routes).
// RLS is bypassed intentionally here; NEVER import this where it can reach the client.
// Loosely typed (any) because the service-role client is exercised across varying
// column shapes; we cast rows to our own Contact/Profile/Nudge types at the call sites.
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

let admin: SupabaseClient | null = null

export function useSupabaseAdmin(): SupabaseClient {
  const { supabaseServiceRole, public: { supabaseUrl } } = useRuntimeConfig()

  if (!supabaseUrl || !supabaseServiceRole) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set server-side (see .env.example)')
  }

  admin ??= createClient(supabaseUrl, supabaseServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return admin
}