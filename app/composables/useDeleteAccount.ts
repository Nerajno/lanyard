// Client-side choreography for account deletion. The destructive call is a
// server route (service role); this only sends the confirm, then clears the
// local session — signOut throws "user from sub claim does not exist" because
// the auth user was already removed server-side, so it is caught and ignored.
export function useDeleteAccount() {
  const auth = useAuthStore()

  async function requestDelete(confirmEmail: string): Promise<void> {
    await $fetch('/api/account/delete', { method: 'POST', body: { confirmEmail } })
  }

  async function clearSessionAndRedirect(): Promise<void> {
    try {
      await auth.signOut()
    } catch {
      // Auth user is gone server-side; the session is already dead.
    }
    auth.user = null
    auth.ready = false
    clearAuthCookies()
    await navigateTo('/?deleted=1')
  }

  function clearAuthCookies(): void {
    if (!import.meta.client) return
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0]?.trim()
      if (name && name.startsWith('sb-') && name.endsWith('-auth-token')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
      }
    }
  }

  return { requestDelete, clearSessionAndRedirect }
}