import { ref, computed, watch } from 'vue'
import type { AuthFormPhase, AuthResult } from '~/utils/authSmartForm'
import { actionForPhase, nextAuthFormStep, submitLabel } from '~/utils/authSmartForm'

function toErrorResult(error: unknown): AuthResult {
  const code = (error as { code?: string } | null)?.code
  if (code === 'invalid_credentials') return { kind: 'need-password' }
  if (code === 'user_already_exists' || code === 'email_exists') return { kind: 'duplicate-email' }
  return { kind: 'failed', message: error instanceof Error ? error.message : String(error) }
}

export function useAuthForm() {
  const auth = useAuthStore()
  const route = useRoute()

  const email = ref('')
  const password = ref('')
  const loading = ref(false)
  const phase = ref<AuthFormPhase>({ phase: 'idle' })
  const forgotSent = ref(false)

  const action = computed(() => actionForPhase(phase.value))
  const buttonLabel = computed(() => submitLabel(phase.value, loading.value))

  async function submit() {
    loading.value = true
    try {
      const a = action.value
      let result: AuthResult
      try {
        if (a === 'signin') {
          await auth.signInWithPassword(email.value, password.value)
          result = { kind: 'signed-in' }
        } else {
          const { session } = await auth.signUp(email.value, password.value)
          result = session ? { kind: 'signed-in' } : { kind: 'awaiting-confirmation' }
        }
      } catch (e) {
        result = toErrorResult(e)
      }
      phase.value = nextAuthFormStep(a, result)
    } finally {
      loading.value = false
    }
  }

  async function forgotPassword() {
    loading.value = true
    try {
      await auth.sendPasswordReset(email.value)
      forgotSent.value = true
    } catch (e) {
      phase.value = { phase: 'error', message: e instanceof Error ? e.message : String(e) }
    } finally {
      loading.value = false
    }
  }

  function backToSignIn() {
    phase.value = { phase: 'signin' }
  }

  watch(
    () => phase.value.phase,
    (p) => {
      if (p === 'signed-in') {
        const r = route.query.redirect
        void navigateTo(typeof r === 'string' && r.startsWith('/') ? r : '/app')
      }
    },
    { immediate: true },
  )

  return { email, password, loading, action, phase, buttonLabel, forgotSent, submit, forgotPassword, backToSignIn }
}