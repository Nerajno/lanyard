# Sign-in methods (Email/password + Google/Apple OAuth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password sign-in (smart sign-in/sign-up form) and Google/Apple OAuth alongside the existing magic-link sign-in, reusing the existing `/auth/confirm` OAuth callback and the existing auth-store/plugin session sync.

**Architecture:** A pure, IO-free resolver (`utils/authSmartForm.ts`) maps Supabase auth outcomes to a UI phase and is unit-tested. A composable (`composables/useAuthForm.ts`) owns reactive form state and calls store methods, which call the existing `useSupabase()` client. `pages/login.vue` becomes a two-tab page (Password / Magic link) with OAuth buttons on top. A new `pages/auth/reset-password.vue` handles forgot-password. No schema, RLS, or env changes.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup lang="ts">`, Pinia, Tailwind, `@supabase/supabase-js` (`signInWithPassword`, `signUp`, `signInWithOAuth`, `resetPasswordForEmail`), Vitest.

## Global Constraints

- Work on branch `feature/auth-methods` created from `main` — never commit implementation to `main` directly (AGENTS.md).
- No schema changes, no RLS changes, no new env vars.
- Supabase error codes branch on `AuthError.code`: `invalid_credentials`, `user_already_exists`, `email_exists` (verified against `@supabase/auth-js` `error-codes.d.ts`).
- Email confirmation is ON for password sign-ups (Supabase dashboard): a fresh `signUp` returns `data.user` with **no `data.session`** and `data.user.identities.length === 0`.
- Keep existing `signInWithEmail` (magic link) signature intact and its lambda behavior unchanged.
- Components go in `components/auth/` (mirrors existing `components/landing/` subfolder pattern).
- Tests: Vitest, `environment: 'node'`, aliases `~`/`@` configured (`vitest.config.ts`); pure logic only, no live DB/OAuth (repo convention).
- OAuth providers (Google, Apple) are **already configured** in the Supabase dashboard — do not change provider settings.

---

### Task 1: Pure smart-form resolver + tests

**Files:**
- Create: `utils/authSmartForm.ts`
- Test: `tests/unit/authSmartForm.test.ts`

**Interfaces:**
- Produces (used by Tasks 2-5):
  - `type AuthAction = 'signin' | 'signup'`
  - `type AuthResult = { kind: 'signed-in' } | { kind: 'need-password' } | { kind: 'awaiting-confirmation' } | { kind: 'duplicate-email' } | { kind: 'failed'; message: string }`
  - `type AuthFormPhase = { phase: 'idle' } | { phase: 'signin' } | { phase: 'signup'; message: string } | { phase: 'signed-in' } | { phase: 'confirm-email' } | { phase: 'duplicate' } | { phase: 'error'; message: string }`
  - `const SIGNUP_PROMPT: string`, `const CHECK_INBOX_MESSAGE: string`, `const DUPLICATE_MESSAGE: string`
  - `function nextAuthFormStep(action: AuthAction, result: AuthResult): AuthFormPhase`
  - `function actionForPhase(phase: AuthFormPhase): AuthAction`
  - `function submitLabel(phase: AuthFormPhase, loading: boolean): string`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/authSmartForm.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  nextAuthFormStep,
  actionForPhase,
  submitLabel,
  SIGNUP_PROMPT,
  CHECK_INBOX_MESSAGE,
  DUPLICATE_MESSAGE,
} from '~/utils/authSmartForm'

describe('nextAuthFormStep', () => {
  it('maps a successful sign-in to signed-in', () => {
    expect(nextAuthFormStep('signin', { kind: 'signed-in' })).toEqual({ phase: 'signed-in' })
  })
  it('maps invalid credentials during sign-in to signup mode', () => {
    expect(nextAuthFormStep('signin', { kind: 'need-password' })).toEqual({ phase: 'signup', message: SIGNUP_PROMPT })
  })
  it('maps a sign-up awaiting email confirmation to confirm-email', () => {
    expect(nextAuthFormStep('signup', { kind: 'awaiting-confirmation' })).toEqual({ phase: 'confirm-email' })
    expect(CHECK_INBOX_MESSAGE).toBe('Check your inbox to confirm your email.')
  })
  it('maps a duplicate-email sign-up to duplicate', () => {
    expect(nextAuthFormStep('signup', { kind: 'duplicate-email' })).toEqual({ phase: 'duplicate' })
    expect(DUPLICATE_MESSAGE).toBe('This email is already in use — sign in with your password, or use Google or Apple.')
  })
  it('maps a sign-up that returned a session to signed-in', () => {
    expect(nextAuthFormStep('signup', { kind: 'signed-in' })).toEqual({ phase: 'signed-in' })
  })
  it('maps a failed action to an error carrying the message', () => {
    expect(nextAuthFormStep('signin', { kind: 'failed', message: 'Network hiccup' })).toEqual({
      phase: 'error',
      message: 'Network hiccup',
    })
  })
})

describe('submitLabel', () => {
  it('labels the idle/sign-in button Continue', () => {
    expect(submitLabel({ phase: 'idle' }, false)).toBe('Continue')
    expect(submitLabel({ phase: 'signin' }, false)).toBe('Continue')
  })
  it('labels the signup button Create account', () => {
    expect(submitLabel({ phase: 'signup', message: SIGNUP_PROMPT }, false)).toBe('Create account')
  })
  it('labels a busy submit by mode', () => {
    expect(submitLabel({ phase: 'signin' }, true)).toBe('Signing in…')
    expect(submitLabel({ phase: 'signup', message: '' }, true)).toBe('Creating account…')
  })
})

describe('actionForPhase', () => {
  it('returns signup only for the signup phase, signin otherwise', () => {
    expect(actionForPhase({ phase: 'signup', message: '' })).toBe('signup')
    expect(actionForPhase({ phase: 'idle' })).toBe('signin')
    expect(actionForPhase({ phase: 'error', message: '' })).toBe('signin')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/authSmartForm.test.ts`

Expected: FAIL — cannot resolve `~/utils/authSmartForm` (module not found).

- [ ] **Step 3: Write the minimal implementation**

Create `utils/authSmartForm.ts`:

```ts
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
```

Note: `action` param is intentionally unused in `nextAuthFormStep` today — it makes the transition table explicit and lets the signature stay stable when sign-in/sign-up ever diverge. Do not remove it (the tests assert the current mapping).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/authSmartForm.test.ts`

Expected: PASS (13 assertions).

- [ ] **Step 5: Commit**

```bash
git add utils/authSmartForm.ts tests/unit/authSmartForm.test.ts
git commit -m "feat(auth): smart-form phase resolver + tests"
```

---

### Task 2: Auth store methods

**Files:**
- Modify: `stores/auth.ts` (add `authConfirmUrl` helper, `signInWithPassword`, `signUp`, `signInWithProvider`, `sendPasswordReset`)

**Interfaces:**
- Consumes: nothing from Task 1 (pure resolver is used by the composable in Task 3).
- Produces (used by Tasks 3, 4, 6):
  - `function authConfirmUrl(to?: string): string` (module-scope in `stores/auth.ts`; reuse in `signInWithEmail`)
  - `signInWithPassword(email: string, password: string): Promise<void>` — throws on error
  - `signUp(email: string, password: string): Promise<{ session: boolean }>` — throws on error; `session:false` means awaiting email confirmation
  - `signInWithProvider(provider: 'google' | 'apple', redirectTo?: string): Promise<void>`
  - `sendPasswordReset(email: string): Promise<void>`

- [ ] **Step 1: Edit the store**

Open `stores/auth.ts` and:

1. Extract the redirect builder from `signInWithEmail` into a shared helper, then rewire `signInWithEmail` to use it (behavior unchanged):

```ts
function authConfirmUrl(to?: string): string {
  const config = useRuntimeConfig()
  const base = `${config.public.appUrl || window.location.origin}/auth/confirm`
  return to ? `${base}?redirect=${encodeURIComponent(to)}` : base
}
```

Replace the body of `signInWithEmail` so it uses the helper:

```ts
    async signInWithEmail(email: string, redirectTo?: string): Promise<boolean> {
      const { error } = await useSupabase().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: authConfirmUrl(redirectTo) },
      })
      if (error) throw error
      return true
    },
```

2. Add these actions after `signInWithEmail`:

```ts
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
      this.user = (await useSupabase().auth.getUser()).data.user ?? null
    },
    async sendPasswordReset(email: string): Promise<void> {
      const config = useRuntimeConfig()
      const base = `${config.public.appUrl || window.location.origin}/auth/reset-password`
      const { error } = await useSupabase().auth.resetPasswordForEmail(email, { redirectTo: base })
      if (error) throw error
    },
```

- [ ] **Step 2: Verify types pass**

Run: `npx nuxi typecheck`

Expected: PASS (no errors in `stores/auth.ts`).

- [ ] **Step 3: Commit**

```bash
git add stores/auth.ts
git commit -m "feat(auth): password, signup, OAuth, and password-reset store actions"
```

---

### Task 3: Smart-form composable + component

**Files:**
- Create: `composables/useAuthForm.ts`
- Create: `components/auth/PasswordAuthForm.vue`

**Interfaces:**
- Consumes: Task 1 (`nextAuthFormStep`, `actionForPhase`, `submitLabel`, `type AuthFormPhase`, `type AuthResult`); Task 2 (`auth.signInWithPassword`, `auth.signUp`, `auth.sendPasswordReset`).
- Produces (used by Task 5):
  - `useAuthForm()` returns `{ email, password, loading, phase, buttonLabel, forgotSent, submit, forgotPassword, backToSignIn }`
  - Phase transitions on submit; `phase.phase === 'signed-in'` triggers `navigateTo(route.query.redirect || '/app')` (matches `confirm.vue` semantics).

- [ ] **Step 1: Create the composable**

Create `composables/useAuthForm.ts`:

```ts
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
```

- [ ] **Step 2: Create the component**

Create `components/auth/PasswordAuthForm.vue`:

```vue
<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div>
      <label class="text-sm font-medium text-ink" for="email">Email</label>
      <input
        id="email"
        v-model="email"
        type="email"
        required
        autocomplete="email"
        class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
        placeholder="you@example.com"
      >
    </div>

    <div>
      <label class="text-sm font-medium text-ink" for="password">Password</label>
      <input
        id="password"
        v-model="password"
        type="password"
        required
        autocomplete="current-password"
        class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
        placeholder="••••••••"
      >
      <button
        v-if="!forgotSent"
        type="button"
        class="mt-2 text-sm text-muted hover:text-ink hover:underline"
        @click="forgotPassword"
      >
        Forgot password?
      </button>
      <p v-else class="mt-2 text-sm text-graduated">Check your inbox — we sent a reset link.</p>
    </div>

    <p v-if="notice" class="text-sm" :class="notice.tone === 'coral' ? 'text-coral' : notice.tone === 'graduated' ? 'text-graduated' : 'text-muted'">
      {{ notice.text }}
    </p>

    <button
      type="submit"
      :disabled="loading"
      class="w-full rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:opacity-50"
    >
      {{ buttonLabel }}
    </button>

    <button
      v-if="phase.phase === 'duplicate'"
      type="button"
      class="w-full text-sm text-muted hover:text-ink hover:underline"
      @click="backToSignIn"
    >
      Back to sign in
    </button>
  </form>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthForm } from '~/composables/useAuthForm'
import { CHECK_INBOX_MESSAGE, DUPLICATE_MESSAGE } from '~/utils/authSmartForm'

const { email, password, loading, phase, buttonLabel, forgotSent, submit, forgotPassword, backToSignIn } = useAuthForm()

const notice = computed(() => {
  const p = phase.value
  switch (p.phase) {
    case 'signup':
      return { tone: 'muted' as const, text: p.message }
    case 'confirm-email':
      return { tone: 'graduated' as const, text: CHECK_INBOX_MESSAGE }
    case 'duplicate':
      return { tone: 'coral' as const, text: DUPLICATE_MESSAGE }
    case 'error':
      return { tone: 'coral' as const, text: p.message }
    default:
      return null
  }
})
</script>
```

- [ ] **Step 3: Verify types pass**

Run: `npx nuxi typecheck`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add composables/useAuthForm.ts components/auth/PasswordAuthForm.vue
git commit -m "feat(auth): smart password sign-in/sign-up form"
```

---

### Task 4: OAuth buttons component

**Files:**
- Create: `components/auth/OAuthButtons.vue`

**Interfaces:**
- Consumes: Task 2 (`auth.signInWithProvider`).
- Produces (used by Task 5): default-exported `<OAuthButtons>` (Nuxt auto-imports by directory), accepts no props, emits nothing.

- [ ] **Step 1: Create the component**

Create `components/auth/OAuthButtons.vue`:

```vue
<template>
  <div class="space-y-3">
    <button
      type="button"
      :disabled="loading"
      class="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
      @click="start('google')"
    >
      Continue with Google
    </button>
    <button
      type="button"
      :disabled="loading"
      class="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
      @click="start('apple')"
    >
      Continue with Apple
    </button>
    <p v-if="error" class="text-sm text-coral">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const route = useRoute()
const loading = ref(false)
const error = ref<string | null>(null)

async function start(provider: 'google' | 'apple') {
  loading.value = true
  error.value = null
  try {
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : undefined
    await auth.signInWithProvider(provider, redirect)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
</script>
```

- [ ] **Step 2: Verify types pass**

Run: `npx nuxi typecheck`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/auth/OAuthButtons.vue
git commit -m "feat(auth): Google + Apple OAuth buttons"
```

---

### Task 5: Two-tab login page

**Files:**
- Modify: `pages/login.vue` (full rewrite)

**Interfaces:**
- Consumes: Task 3 (`PasswordAuthForm`), Task 4 (`OAuthButtons`); existing store `signInWithEmail`.
- Produces: `<template>` with OAuth row, "or" divider, Password/Magic-link tabs; magic link behavior byte-for-byte identical to current page.

- [ ] **Step 1: Rewrite the page**

Replace the contents of `pages/login.vue`:

```vue
<template>
  <div class="mx-auto max-w-sm">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Sign in</h1>

    <div class="mt-6 space-y-4">
      <OAuthButtons />

      <div class="flex items-center gap-3 text-muted">
        <span class="h-px flex-1 bg-line"></span>
        <span class="font-mono text-xs uppercase tracking-eyebrow">or</span>
        <span class="h-px flex-1 bg-line"></span>
      </div>

      <div class="flex rounded-lg border border-line bg-surface p-1">
        <button
          type="button"
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="tab === 'password' ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'"
          @click="tab = 'password'"
        >
          Password
        </button>
        <button
          type="button"
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="tab === 'magic' ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'"
          @click="tab = 'magic'"
        >
          Magic link
        </button>
      </div>

      <PasswordAuthForm v-if="tab === 'password'" />

      <form v-else class="space-y-4" @submit.prevent="send">
        <div>
          <label class="text-sm font-medium text-ink" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
            placeholder="you@example.com"
          >
        </div>

        <p v-if="sent" class="text-sm text-graduated">Check your inbox for the sign-in link.</p>
        <p v-if="error" class="text-sm text-coral">{{ error }}</p>

        <button
          type="submit"
          :disabled="sending"
          class="w-full rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:opacity-50"
        >
          {{ sending ? 'Sending…' : 'Send magic link' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const tab = ref<'password' | 'magic'>('password')
const email = ref('')
const sending = ref(false)
const error = ref<string | null>(null)
const sent = ref(false)

async function send() {
  sending.value = true
  error.value = null
  sent.value = false
  try {
    await auth.signInWithEmail(email.value)
    sent.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    sending.value = false
  }
}
</script>
```

- [ ] **Step 2: Verify types pass**

Run: `npx nuxi typecheck`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add pages/login.vue
git commit -m "feat(auth): two-tab login page with OAuth"
```

---

### Task 6: Forgot-password reset page

**Files:**
- Create: `pages/auth/reset-password.vue`

**Interfaces:**
- Consumes: Task 2 (`signInWithEmail` not used here; uses raw `useSupabase()` for `exchangeCodeForSession` / `verifyOtp` / `updateUser`, matching `pages/auth/confirm.vue` patterns); `stores/auth.ts signOut` for clearing the recovery session.
- Produces: route `/auth/reset-password`; handles `?code=` (PKCE) and `?token_hash=` (implicit recovery) exchange, then a "set new password" form.

- [ ] **Step 1: Create the page**

Create `pages/auth/reset-password.vue`:

```vue
<template>
  <div class="mx-auto max-w-sm py-12">
    <template v-if="ready">
      <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Set a new password</h1>

      <form class="mt-6 space-y-4" @submit.prevent="update">
        <div>
          <label class="text-sm font-medium text-ink" for="pw">New password</label>
          <input
            id="pw"
            v-model="password"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
          >
        </div>

        <p v-if="message" class="text-sm text-coral">{{ message }}</p>

        <button
          type="submit"
          :disabled="busy"
          class="w-full rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:opacity-50"
        >
          Update password
        </button>

        <button v-if="updated" type="button" class="w-full text-sm text-muted hover:text-ink hover:underline" @click="navigateTo('/login')">
          Back to sign in
        </button>
      </form>
    </template>

    <p v-else class="text-sm text-muted">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
const sb = useSupabase()
const auth = useAuthStore()
const route = useRoute()

const ready = ref(false)
const busy = ref(false)
const updated = ref(false)
const message = ref('')
const password = ref('')

onMounted(async () => {
  const code = route.query.code as string | undefined
  const token = route.query.token_hash as string | undefined
  try {
    if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(code)
      if (error) throw error
      ready.value = true
    } else if (token) {
      const { error } = await sb.auth.verifyOtp({ token_hash: token, type: 'recovery' })
      if (error) throw error
      ready.value = true
    } else {
      message.value = 'This password-reset link is invalid or has expired.'
    }
  } catch (e) {
    message.value = e instanceof Error ? e.message : String(e)
  }
})

async function update() {
  busy.value = true
  message.value = ''
  try {
    const { error } = await sb.auth.updateUser({ password: password.value })
    if (error) throw error
    await auth.signOut()
    updated.value = true
    message.value = 'Password updated. Sign in with your new password.'
  } catch (e) {
    message.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>
```

- [ ] **Step 2: Verify types pass**

Run: `npx nuxi typecheck`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add pages/auth/reset-password.vue
git commit -m "feat(auth): forgot-password reset page"
```

---

### Task 7: Docs, full verification

**Files:**
- Modify: `decisions.md` (new Decided entry)
- Modify: `tasks.md` (check off an auth item)

**Interfaces:**
- Consumes: all prior tasks.

- [ ] **Step 1: Update `decisions.md`**

Add a new bullet at the top of the **Decided** section:

```md
- **Sign-in = three ways.** Magic link (original), email/password via a smart form that auto-flips sign-in → sign-up on `invalid_credentials`, and Google/Apple OAuth (creds configured in the Supabase dashboard). Password sign-ups require email confirmation (ON). All three land in `/app` via the same auth store + `/auth/confirm` flow.
```

- [ ] **Step 2: Update `tasks.md`**

In the auth area (next to the existing "- [x] Wire Supabase client + auth (email magic link is fine)" line), add:

```md
- [x] Subscribe magic link + email/password + Google/Apple OAuth sign-in (smart form)
```

- [ ] **Step 3: Run the full gate**

Run: `npx vitest run`

Expected: PASS (all existing 32 + 13 new tests).

Run: `npx nuxi typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add decisions.md tasks.md
git commit -m "docs(auth): record three-way sign-in decision"
```

- [ ] **Step 5: Manual smoke (not required for completion, aids handoff)**

With a linked Supabase project (real anon keys in `.env`) and `NUXT_PUBLIC_APP_URL` set, run `npm run dev` and verify: password Sign in (existing account); smart flip (unknown email → Create account → confirm inbox); forgot-password → reset → new password works; Google + Apple OAuth round-trip lands in `/app`; magic link still works. Provider credentials are already configured — no dashboard changes.