import { defineStore } from 'pinia'
import type { User } from '@supabase/supabase-js'

function authConfirmUrl(to?: string): string {
  const config = useRuntimeConfig()
  const base = `${config.public.appUrl || window.location.origin}/auth/confirm`
  return to ? `${base}?redirect=${encodeURIComponent(to)}` : base
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    ready: false,
  }),
  actions: {
    async hydrate() {
      const { data } = await useSupabase().auth.getUser()
      this.user = data.user
      this.ready = true
    },
    async signInWithEmail(email: string, redirectTo?: string): Promise<boolean> {
      const { error } = await useSupabase().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: authConfirmUrl(redirectTo) },
      })
      if (error) throw error
      return true
    },
    async signInWithPassword(email: string, password: string): Promise<void> {
      const { error } = await useSupabase().auth.signInWithPassword({ email, password })
      if (error) throw error
      this.user = (await useSupabase().auth.getUser()).data.user ?? null
    },
    async signUp(email: string, password: string): Promise<{ session: boolean }> {
      const { data, error } = await useSupabase().auth.signUp({ email, password })
      if (error) throw error
      return { session: Boolean(data.session) }
    },
    async signInWithProvider(provider: 'google' | 'apple', redirectTo?: string): Promise<void> {
      const { error } = await useSupabase().auth.signInWithOAuth({
        provider,
        options: { redirectTo: authConfirmUrl(redirectTo) },
      })
      if (error) throw error
    },
    async sendPasswordReset(email: string): Promise<void> {
      const config = useRuntimeConfig()
      const base = `${config.public.appUrl || window.location.origin}/auth/reset-password`
      const { error } = await useSupabase().auth.resetPasswordForEmail(email, { redirectTo: base })
      if (error) throw error
    },
    async signOut() {
      this.user = null
      await useSupabase().auth.signOut()
    },
  },
})
