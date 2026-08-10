// Composite guard for all pages inside /app: signed in first, then onboarded.
import auth from './auth'
import onboarding from './onboarding'

export default defineNuxtRouteMiddleware(async (to, from) => {
  const revoked = await auth(to, from)
  if (revoked) return revoked
  return onboarding(to, from)
})