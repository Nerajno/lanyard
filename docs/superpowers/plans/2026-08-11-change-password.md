# In-App Change Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a signed-in "change password" form to Settings that requires the current password and revokes other devices' sessions while keeping the current one.

**Architecture:** A pure payload-builder (`utils/changePassword.ts`, unit-tested per repo convention) feeds a new `changePassword` action on the existing Pinia auth store (`stores/auth.ts`), which calls `updateUser({ password, current_password })` then `signOut({ scope: 'others' })`. A new `components/ChangePasswordForm.vue` renders in Settings' Account section, mirroring `NudgePrefsForm.vue` / `PasswordAuthForm.vue` styling.

**Tech Stack:** Nuxt 3 / Vue 3 `<script setup lang="ts">`, Pinia, Supabase `@supabase/supabase-js ^2.112.2` (supports `current_password` in `UserAttributes`; `signOut({ scope: 'others' })` revokes other sessions with no `SIGNED_OUT` event on the current device — verified in `node_modules/@supabase/auth-js`).

## Global Constraints

- Branch `feature/change-password` based on `origin/main` (1ec3f3b, includes merged PR #19 auth work), worktree at `.worktrees/change-password`.
- No schema / RLS / migration changes. No new env vars. Service-role key stays server-side.
- No code comments unless asked. `text-coral` errors, `text-graduated` success, `bg-coral`/`hover:bg-coral-press` primary buttons.
- Min password length 8 (input `minlength="8"`), matching `pages/auth/reset-password.vue`.
- `current_password` field is **optional** — omitted from the payload when blank so OAuth/magic-link users can set a first password.
- Network-bound flows get no unit tests — manual verification checklist instead, per repo convention.
- Gate before commit: `npx vitest run`, `npx nuxi typecheck`, `npm run lint` all green.

---

### Task 1: Pure password-update payload builder

**Files:**
- Create: `utils/changePassword.ts`
- Test: `tests/unit/changePassword.test.ts`

**Interfaces:**
- Produces: `buildPasswordUpdate(currentPassword: string, newPassword: string): { password: string; current_password?: string }` — omits `current_password` when blank/whitespace, preserves `newPassword` verbatim.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildPasswordUpdate } from '~/utils/changePassword'

describe('buildPasswordUpdate', () => {
  it('omits current_password when current password is empty', () => {
    expect(buildPasswordUpdate('', 'newpass123')).toEqual({ password: 'newpass123' })
  })
  it('omits current_password when current password is whitespace', () => {
    expect(buildPasswordUpdate('   ', 'newpass123')).toEqual({ password: 'newpass123' })
  })
  it('includes current_password when provided', () => {
    expect(buildPasswordUpdate('oldpass123', 'newpass123')).toEqual({
      password: 'newpass123',
      current_password: 'oldpass123',
    })
  })
  it('preserves the new password verbatim', () => {
    const p = buildPasswordUpdate('old', 'New Pass 9!')
    expect(p.password).toBe('New Pass 9!')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/changePassword.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface PasswordUpdatePayload {
  password: string
  current_password?: string
}

export function buildPasswordUpdate(currentPassword: string, newPassword: string): PasswordUpdatePayload {
  const payload: PasswordUpdatePayload = { password: newPassword }
  if (currentPassword.trim()) payload.current_password = currentPassword
  return payload
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/changePassword.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/unit/changePassword.test.ts utils/changePassword.ts
git commit -m "feat(auth): password-update payload builder"
```

---

### Task 2: `changePassword` store action

**Files:**
- Modify: `stores/auth.ts` (append action after `sendPasswordReset`)

**Interfaces:**
- Consumes: `buildPasswordUpdate` from Task 1.
- Produces: `useAuthStore().changePassword(currentPassword: string, newPassword: string): Promise<void>` — throws on error; on success revokes other sessions via `signOut({ scope: 'others' })`, leaving the current session intact.

- [ ] **Step 1: Write the code** — import the builder at the top, add the action inside `actions` after `sendPasswordReset`:

```ts
// top of file
import { buildPasswordUpdate } from '~/utils/changePassword'
// inside actions:
async changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { error } = await useSupabase().auth.updateUser(buildPasswordUpdate(currentPassword, newPassword))
  if (error) throw error
  await useSupabase().auth.signOut({ scope: 'others' })
},
```

- [ ] **Step 2: Run the gate**

Run: `npx nuxi typecheck` (PASS), `npm run lint` (exit 0). The `scope: 'others'` literal must typecheck against `SignOutScope`.

- [ ] **Step 3: Commit**

```bash
git add stores/auth.ts
git commit -m "feat(auth): changePassword store action with cross-device revoke"
```

---

### Task 3: Change password form + Settings integration

**Files:**
- Create: `components/ChangePasswordForm.vue`
- Modify: `pages/app/settings.vue`

**Interfaces:**
- Consumes: `useAuthStore().changePassword(currentPassword, newPassword)` from Task 2.
- Produces: `ChangePasswordForm` component; a Password subsection inside Settings' Account section.

- [ ] **Step 1: Write the component** — `components/ChangePasswordForm.vue` (mirror `PasswordAuthForm.vue` field styles; `text-coral` errors, `text-graduated` success):

```vue
<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div>
      <label class="text-sm font-medium text-ink" for="current-password">Current password</label>
      <input
        id="current-password" v-model="currentPassword" type="password"
        autocomplete="current-password"
        class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
        placeholder="••••••••"
      >
      <p class="mt-1 text-xs text-muted">Leave blank if you signed in with Google, Apple, or a magic link.</p>
    </div>

    <div>
      <label class="text-sm font-medium text-ink" for="new-password">New password</label>
      <input
        id="new-password" v-model="newPassword" type="password" required minlength="8"
        autocomplete="new-password"
        class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
        placeholder="at least 8 characters"
      >
    </div>

    <div>
      <label class="text-sm font-medium text-ink" for="confirm-password">Confirm new password</label>
      <input
        id="confirm-password" v-model="confirmPassword" type="password" required
        autocomplete="new-password"
        class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
      >
    </div>

    <p v-if="error" class="text-sm text-coral">{{ error }}</p>
    <p v-if="success" class="text-sm text-graduated">Password updated. You've been signed out on your other devices.</p>

    <button
      type="submit" :disabled="busy"
      class="w-full rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:opacity-50"
    >
      {{ busy ? 'Updating…' : 'Update password' }}
    </button>
  </form>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

async function submit() {
  error.value = null
  success.value = false
  if (newPassword.value.length < 8) { error.value = 'New password must be at least 8 characters.'; return }
  if (newPassword.value !== confirmPassword.value) { error.value = 'New passwords do not match.'; return }
  if (currentPassword.value && currentPassword.value === newPassword.value) { error.value = 'New password must be different from the current one.'; return }
  busy.value = true
  try {
    await auth.changePassword(currentPassword.value, newPassword.value)
    success.value = true
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e) {
    const code = (e as { code?: string } | null)?.code
    error.value = code === 'invalid_credentials' ? 'Current password is incorrect.' : (e instanceof Error ? e.message : String(e))
  } finally {
    busy.value = false
  }
}
</script>
```

- [ ] **Step 2: Wire into Settings** — `pages/app/settings.vue`, inside the existing Account `<section>` (after the sign-out button):

```html
<div class="mt-6 rounded-lg border border-line bg-surface p-4">
  <h3 class="font-mono text-xs uppercase tracking-eyebrow text-muted">Password</h3>
  <div class="mt-3">
    <ChangePasswordForm />
  </div>
</div>
```

- [ ] **Step 3: Run the gate**

Run: `npx vitest run` (61 + 4 new = 65), `npx nuxi typecheck` (PASS), `npm run lint` (exit 0).

- [ ] **Step 4: Commit**

```bash
git add components/ChangePasswordForm.vue pages/app/settings.vue
git commit -m "feat(auth): in-app change password form in Settings"
```

---

### Task 4: Docs + branch gate

**Files:**
- Modify: `decisions.md` (add Decided entry), `tasks.md` (add auth entry)

- [ ] **Step 1: Update `decisions.md`** — add to the Decided list:

```md
- **Password change revokes other devices.** In-app password change (Settings) requires the current password, then `signOut({ scope: 'others' })` keeps the current device signed in while revoking all other sessions. Current password is optional so OAuth/magic-link users can set a first password.
```

- [ ] **Step 2: Update `tasks.md`** — in the auth area add:

```md
- [ ] In-app change password (Settings) with current-password + revoke other devices
```

- [ ] **Step 3: Manual verification checklist** (documented in PR body, not automated):
1. Password user: change with correct current → "Password updated", other logged-in device is signed out, this device stays in.
2. Wrong current password → "Current password is incorrect.", no session change.
3. OAuth/magic-link user: blank current password + set first password → succeeds.
4. Confirm-mismatch and <8-length client guards fire without a network call.

- [ ] **Step 4: Final gate + commit**

Run: `npx vitest run`, `npx nuxi typecheck`, `npm run lint`. Then:

```bash
git add decisions.md tasks.md
git commit -m "docs(auth): change-password revoke-others decision"
```