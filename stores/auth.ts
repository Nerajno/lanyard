import { defineStore } from 'pinia'
import type { User } from '@supabase/supabase-js'

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
      const config = useRuntimeConfig()
      const base = `${config.public.appUrl || window.location.origin}/auth/confirm`
      const emailRedirectTo = redirectTo ? `${base}?redirect=${encodeURIComponent(redirectTo)}` : base

      const { error } = await useSupabase().auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,
        },
      })
      if (error) throw error
      return true
    },
    async signOut() {
      this.user = null
      await useSupabase().auth.signOut()
    },
  },
})