// Client-side route guard. Runs on the browser (the session cookie is only
// available there), after the auth store hydrates in a plugin.
export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.hydrate()
  if (!auth.user) return navigateTo('/login')
})