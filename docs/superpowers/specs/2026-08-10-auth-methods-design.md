# Design — Lanyard Sign-in: Email/password + Google/Apple OAuth

Date: 2026-08-10 · Status: Approved

## Goal

Add password sign-in and Google/Apple OAuth to the existing magic-link auth, so a user can sign in (or sign up) three ways. Keep magic link working. Single "smart form" for email+password that auto-detects sign-in vs sign-up. OAuth flows through the existing `/auth/confirm` callback.

## Decisions (from brainstorming / user sign-off)

- **Keep all three options** on the login page: password smart form, magic link, and Google/Apple OAuth.
- **Single smart form** for email/password, not separate sign-in/sign-up views: try password sign-in; on `invalid_credentials` flip to create-account mode and re-submit.
- **Email confirmation is ON** (Supabase Auth dashboard "Confirm email"). A password sign-up is not active until the confirmation link is clicked. OAuth and magic link unaffected.
- **Approach A: two-tab login page.** OAuth buttons on top (Google, Apple), then tabs: Password (smart form) / Magic link. Store gains three methods. `/auth/confirm` is reused as the OAuth + recovery callback with no changes.
- **Google/Apple provider credentials are already configured** in the Supabase dashboard — no provider provisioning steps in this plan, no new env vars.
- **Minimal forgot-password path included**: passwords with no recovery are a trap. `resetPasswordForEmail` + a small `/auth/reset-password` page that exchanges the recovery token and lets the user set a new password.
- No schema changes: `on_auth_user_created` already auto-creates a `profiles` row; `profiles.email` is mirrored from `auth.users`.

## Flows

### 1. Smart form (email + password)

All decisions live in a pure, IO-free resolver `utils/authSmartForm.ts` (unit-tested against fixtures, per repo convention). Reactive state + IO live in the component.

Public API:

```ts
type AuthFormPhase =
  | { phase: 'idle' }
  | { phase: 'signin' }          // attempt password sign-in
  | { phase: 'signup' }          // flipped after invalid_credentials
  | { phase: 'signed-in' }
  | { phase: 'confirm-email' }   // sign-up + confirm-email ON: no session yet
  | { phase: 'duplicate' }       // email exists under another provider
  | { phase: 'error'; message: string }

function nextAuthFormStep(prev: AuthFormPhase, result: AuthResult): AuthFormPhase
```

`AuthResult` is a discriminated union normalized from Supabase's `data`/`error`:

- **sign-in** (`signInWithPassword`):
  - `data.session` present → `signed-in`.
  - error code `invalid_credentials` → `signup` (flip to create mode).
  - other error → `error` with its message.
- **sign-up** (`signUp`):
  - `data.session` present → `signed-in` (confirm-email OFF edge, or confirmed flow).
  - `data.user` present but `identities.length === 0` → `confirm-email` ("Check your inbox to confirm your email.").
  - error code `user_already_exists` / `email_taken` → `duplicate` ("This email is already in use — sign in with your password, or use Google/Apple.").
  - other error → `error`.

The Password tab submit button label follows the phase: `signin` → "Continue", `signup` → "Create account", `confirm-email` → "Resend confirmation?" (re-calls `signUp`, same path).

### 2. Forgot password (`pages/auth/reset-password.vue`, new)

- Password tab shows "Forgot password?" → `sendPasswordReset(email)` → store calls `resetPasswordForEmail(email, { redirectTo: '<appUrl>/auth/reset-password' })`, UI shows "Check your inbox."
- The reset page runs on mount: if `?code=` present → `exchangeCodeForSession`; if `?token_hash=` present → `verifyOtp({ token_hash, type: 'recovery' })` (same pattern as `confirm.vue`). On success, show a "Set new password" form → `updateUser({ password })` → "Password updated — sign in." Link to `/login`.

### 3. OAuth (Google / Apple)

`signInWithProvider(provider: 'google' | 'apple')` → `signInWithOAuth({ provider, options: { redirectTo } })` where `redirectTo` is built exactly like the magic-link `emailRedirectTo` (`<appUrl>/auth/confirm` + optional `?redirect=` target). `pages/auth/confirm.vue` already exchanges the `code` (PKCE) or `token` (implicit) and honors `route.query.redirect` — reused unchanged. `onAuthStateChange` in `plugins/auth.ts` flips the store to signed-in.

### 4. Sign out / state

Unchanged: `stores/auth.ts signOut()` + `plugins/auth.ts` event sync already cover all three methods.

## Store additions (`stores/auth.ts`)

```ts
signInWithPassword(email, password): Promise<void>                               // throws on error
signUp(email, password): Promise<{ session: boolean }>                           // session=false → awaiting email confirmation
signInWithProvider(provider: 'google' | 'apple'): Promise<void>
sendPasswordReset(email): Promise<void>
```

All keyed off the existing `useSupabase()` client; reuse the shared redirect builder currently inline in `signInWithEmail` (extract a small helper since it now has three callers). Errors are thrown with their Supabase error code intact so the resolver can branch on `invalid_credentials` / `user_already_exists` / `email_taken`.

## UI

- `pages/login.vue` — keeps the `mx-auto max-w-sm` shell + "Sign in" heading; becomes two tabs (Password / Magic link) below the OAuth row.
- `components/auth/OAuthButtons.vue` — two bordered buttons, "Continue with Google" / "Continue with Apple"; on click `auth.signInWithProvider('google'|'apple')`. Divider "or" between OAuth and tabs.
- `components/auth/PasswordAuthForm.vue` — smart form: email + password inputs, adaptive submit label, "Forgot password?" link, inline phase message.
- Magic link tab stays the existing single-field form, inline in `login.vue` (unchanged behavior).

## Files

```
modified  stores/auth.ts                 + 4 methods, redirect helper extract
modified  pages/login.vue                tab layout + OAuth row + magic link tab
new       components/auth/OAuthButtons.vue
new       components/auth/PasswordAuthForm.vue
new       utils/authSmartForm.ts         pure resolver (IO-free)
new       tests/unit/authSmartForm.test.ts
new       pages/auth/reset-password.vue  forgot-password exchange + set-new-password
```

## Tests (Vitest, pure logic — no live DB / no OAuth)

- `authSmartForm.test.ts`: sign-in success → `signed-in`; `invalid_credentials` → `signup` flip; sign-up (confirm-email, `identities.length === 0`) → `confirm-email`; `user_already_exists` → `duplicate`; sign-up success with session → `signed-in`; unknown error → `error` with message.
- No unit test for OAuth/reset (network + Supabase) — verified manually.

Manual verification: password sign-in; email-confirm round trip; forgot-password reset round trip; Google + Apple OAuth in the browser (creds configured).

## Definition of done

Types pass (`nuxi typecheck`) · tests pass (`vitest run`) · lint passes · no schema/RLS changes · no new env vars or client-leaked secrets · all three sign-in paths land the user in `/app` with the auth store hydrated · `decisions.md` notes the three-method sign-in.