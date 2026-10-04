// Boot-time guard for audit C1: refuse to start if the client-shipped Supabase key
// is actually a service-role key. Fails loudly instead of silently bypassing RLS.
import { publicKeyProblem } from '~/utils/supabaseKeyRole'

export default defineNitroPlugin(() => {
  const { supabaseServiceRole, public: { supabaseAnonKey } } = useRuntimeConfig()
  const problem = publicKeyProblem(supabaseAnonKey, supabaseServiceRole)
  if (problem) throw new Error(`[supabase-key-guard] ${problem}`)
})
