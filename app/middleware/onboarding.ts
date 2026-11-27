// Client-side guard: a signed-in user who hasn't finished onboarding gets
// redirected to /app/onboarding. Skipped on the onboarding page itself.
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (!auth.user) return
  if (to.path === '/app/onboarding') return
  const { profile, load } = useProfile()
  await load()
  if (!isOnboarded(profile.value)) return navigateTo('/app/onboarding')
})