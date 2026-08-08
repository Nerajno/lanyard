import { defineNuxtPlugin } from 'nuxt/app'
import { getSupabaseClient } from '~/composables/useSupabase'

export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  await auth.hydrate()

  const sb = getSupabaseClient()
  // Keep auth store in sync with Supabase auth state changes.
  // `auth` is captured from the plugin scope on purpose: this callback fires
  // asynchronously (token refresh, sign-in) with no active Nuxt instance, so
  // calling useAuthStore() in here would warn and fail to resolve.
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      auth.user = session?.user ?? null
      auth.ready = true
    } else if (event === 'SIGNED_OUT') {
      auth.user = null
      auth.ready = true
    }
  })
})