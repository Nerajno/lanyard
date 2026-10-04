// Reads the `role` claim from a legacy Supabase JWT key without verifying it.
// Used only to catch a service_role key sitting in the public (client-shipped) slot.
// New-format keys (sb_publishable_… / sb_secret_…) aren't JWTs → null.
export function jwtRole(key: string | null | undefined): string | null {
  if (!key) return null
  const parts = key.split('.')
  if (parts.length !== 3) return null
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const role = JSON.parse(json)?.role
    return typeof role === 'string' ? role : null
  } catch {
    return null
  }
}

/** Why the public Supabase key is unsafe to ship, or null when it's fine. Never includes key values. */
export function publicKeyProblem(publicKey: string | null | undefined, serviceKey: string | null | undefined): string | null {
  if (!publicKey) return null
  if (jwtRole(publicKey) === 'service_role' || publicKey.startsWith('sb_secret_')) {
    return 'NUXT_PUBLIC_SUPABASE_ANON_KEY holds a service_role/secret key — it would ship to the browser and bypass RLS. Put the anon/publishable key there and rotate the exposed key.'
  }
  if (serviceKey && publicKey === serviceKey) {
    return 'NUXT_PUBLIC_SUPABASE_ANON_KEY equals NUXT_SUPABASE_SERVICE_ROLE — the public slot must hold the anon/publishable key.'
  }
  return null
}
