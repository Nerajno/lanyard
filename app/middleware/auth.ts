// Client-side route guard. Runs on the browser (the session cookie is only
// available there), after the auth store hydrates in a plugin.
// Preserves the destination so the auth round-trip lands back on it.
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.hydrate()
  if (!auth.user) return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
})