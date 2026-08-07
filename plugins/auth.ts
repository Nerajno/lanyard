import { defineNuxtPlugin } from 'nuxt/app'
import { getSupabaseClient } from '~/composables/useSupabase'

export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  await auth.hydrate()

  const sb = getSupabaseClient()
  // Keep auth store in sync with Supabase auth state changes.
  sb.auth.onAuthStateChange((event, session) => {
    const current = useAuthStore()
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      current.user = session?.user ?? null
      current.ready = true
    } else if (event === 'SIGNED_OUT') {
      current.user = null
      current.ready = true
    }
  })
})