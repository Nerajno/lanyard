export type AuthAction = 'signin' | 'signup'

export type AuthResult =
  | { kind: 'signed-in' }
  | { kind: 'need-password' }
  | { kind: 'awaiting-confirmation' }
  | { kind: 'duplicate-email' }
  | { kind: 'failed'; message: string }

export type AuthFormPhase =
  | { phase: 'idle' }
  | { phase: 'signin' }
  | { phase: 'signup'; message: string }
  | { phase: 'signed-in' }
  | { phase: 'confirm-email' }
  | { phase: 'duplicate' }
  | { phase: 'error'; message: string }

export const SIGNUP_PROMPT = "No account with that password — we'll create one."
export const CHECK_INBOX_MESSAGE = 'Check your inbox to confirm your email.'
export const DUPLICATE_MESSAGE = 'This email is already in use — sign in with your password, or use Google or Apple.'

export function nextAuthFormStep(action: AuthAction, result: AuthResult): AuthFormPhase {
  switch (result.kind) {
    case 'signed-in':
      return { phase: 'signed-in' }
    case 'need-password':
      return { phase: 'signup', message: SIGNUP_PROMPT }
    case 'awaiting-confirmation':
      return { phase: 'confirm-email' }
    case 'duplicate-email':
      return { phase: 'duplicate' }
    case 'failed':
      return { phase: 'error', message: result.message }
  }
}

export function actionForPhase(phase: AuthFormPhase): AuthAction {
  return phase.phase === 'signup' ? 'signup' : 'signin'
}

export function submitLabel(phase: AuthFormPhase, loading: boolean): string {
  if (loading) return phase.phase === 'signup' ? 'Creating account…' : 'Signing in…'
  return phase.phase === 'signup' ? 'Create account' : 'Continue'
}