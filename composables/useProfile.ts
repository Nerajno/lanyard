import { watch } from 'vue'
import type { Ref } from 'vue'
import type { Profile } from '~/types'

/**
 * Read/upsert the user's profile (where the nudge gets delivered).
 * Every query is scoped to auth.uid() via RLS.
 */
export function useProfile() {
  const sb = useSupabase()
  const auth = useAuthStore()

  const profile = ref<Profile | null>(null) as Ref<Profile | null>
  const loading = ref(false)
  const error = ref<string | null>(null)

  watch(
    () => auth.user?.id,
    (id) => {
      if (id) void load()
    },
    { immediate: true },
  )

  async function load() {
    if (!auth.user) return
    loading.value = true
    error.value = null
    const { data, error: e } = await sb
      .from('profiles')
      .select('*')
      .eq('user_id', auth.user.id)
      .maybeSingle()
    if (e && e.code !== 'PGRST116') {
      error.value = e.message
    } else if (data) {
      profile.value = data as Profile
    }
    loading.value = false
  }

  /**
   * Upsert profile preferences. Explicit SMS opt-in passes sms_opt_in_at so the
   * legal gate for sending is recorded at the moment the user consents.
   */
  async function save(patch: Partial<Profile>): Promise<void> {
    if (!auth.user) throw new Error('You must be signed in')
    const isNew = !profile.value
    const payload = { ...patch, user_id: auth.user.id }
    const { data, error: e } = isNew
      ? await sb.from('profiles').insert(payload).select().single()
      : await sb.from('profiles').update(patch).eq('user_id', auth.user.id).select().single()
    if (e) throw new Error(e.message)
    profile.value = (data ?? { ...profile.value, ...patch }) as Profile
  }

  /** Explicit consent for SMS. Sets the legal consent timestamp. */
  async function optInSms(phone: string): Promise<void> {
    if (!auth.user) throw new Error('You must be signed in')
    const { data, error: e } = await sb
      .from('profiles')
      .upsert({ user_id: auth.user.id, phone, sms_opt_in_at: new Date().toISOString(), sms_opted_out_at: null })
      .select()
      .single()
    if (e) throw new Error(e.message)
    profile.value = data as Profile
  }

  return { profile, loading, error, load, save, optInSms }
}