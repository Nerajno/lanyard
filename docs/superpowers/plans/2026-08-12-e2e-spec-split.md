# E2E Spec Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the three e2e spec files (`auth.spec.ts`, `contacts.spec.ts`, `settings.spec.ts`) into six focused files, and extract the repeated login dance into a shared `loginAs` helper.

**Architecture:** One new `tests/e2e/helpers.ts` exports `loginAs(page, goto, credentials?)` — the single home of the email/password/Continue dance that is today copy-pasted across every test. Six new spec files each own one scenario area and call `loginAs`; the three old spec files are deleted. File boundaries move, scenarios and assertions do not.

**Tech Stack:** `@nuxt/test-utils/playwright` (the `test` and `expect` exports, plus the `goto` fixture), Playwright, running against the local Supabase stack via `npm run test:e2e`.

## Global Constraints

- **Worktree:** all work happens in `.worktrees/change-password/` (branch `test/ci-testing`). Run every command from that directory.
- **No behavioral change:** test names, assertions, selectors, seed users, and creds are identical to the current specs. This plan only moves code between files and swaps inline login dances for `loginAs`.
- **No config/seed/infra changes:** `playwright.config.ts`, `supabase/seed.sql`, `.github/workflows/ci.yml`, `tests/component/`, and `tests/unit/` are untouched.
- **Seed users (read-only for this plan):** `e2e@lanyard.test` / `e2epass123` (default); `pw@lanyard.test` / `pwpass123` (password-change spec only, mutates its own password to `pwnew456`).
- **Verification:** `npm run test:e2e` requires a running local Supabase stack (`supabase start` + `supabase db reset`). If the stack isn't up, start it before running the suite.
- **Typecheck gate:** `loginAs` is typechecked via `npx nuxi typecheck`; the exact `goto` type is `(url: string, options?: GotoOptions) => Promise<Response | null>` from `@nuxt/test-utils/playwright`. Use `Parameters<TestOptions['goto']>` style or import types so it typechecks.

---

### Task 1: Add the `loginAs` helper

**Files:**
- Create: `tests/e2e/helpers.ts`

**Interfaces:**
- Consumes: nothing (standalone utility).
- Produces: `loginAs(page, goto, opts?)` where:
  - `page` — Playwright `Page`
  - `goto` — the `@nuxt/test-utils/playwright` `goto` fixture: `(url: string, options?: GotoOptions) => Promise<Response | null>`
  - `opts?` — `{ email?: string; password?: string }`, defaults to `{ email: 'e2e@lanyard.test', password: 'e2epass123' }`
  - Returns `Promise<void>`; asserts nothing at the end (each spec already asserts its own landing URL).

- [ ] **Step 1: Create `tests/e2e/helpers.ts`**

```ts
import type { Page, Response } from 'playwright-core'

type Goto = (url: string, options?: { waitUntil?: string }) => Promise<Response | null>

export const E2E_USER = {
  email: 'e2e@lanyard.test',
  password: 'e2epass123',
} as const

export async function loginAs(
  page: Page,
  goto: Goto,
  { email = E2E_USER.email, password = E2E_USER.password }: { email?: string; password?: string } = {},
): Promise<void> {
  await goto('/login', { waitUntil: 'hydration' as 'hydration' })
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
}
```

Notes:
- The `waitUntil: 'hydration'` cast keeps the runtime value identical to the current specs while avoiding a dependency on the `GotoOptions` union type. If typecheck rejects the cast as a no-op, fall back to `await goto('/login')` — the spec's own URL assertion still gates on hydration via the existing patterns.
- `E2E_USER` is exported so later tasks reuse the default creds without sprinkling string literals.

- [ ] **Step 2: Typecheck**

Run: `npx nuxi typecheck`
Expected: PASS (no new errors in `tests/e2e/helpers.ts`). Pre-existing errors elsewhere in the worktree, if any, are out of scope — compare against `main`-baseline only if present.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/helpers.ts
git commit -m "test(e2e): add shared loginAs helper"
```

---

### Task 2: Split `auth.spec.ts` into `signin`, `magic-link`, `signout`

**Files:**
- Create: `tests/e2e/signin.spec.ts`
- Create: `tests/e2e/magic-link.spec.ts`
- Create: `tests/e2e/signout.spec.ts`
- Delete: `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `loginAs` and `E2E_USER` from `./helpers` (Task 1).
- Produces: three spec files run by Playwright's `testDir` glob `./tests/e2e`.

- [ ] **Step 1: Create `tests/e2e/signin.spec.ts`**

```ts
import { test, expect } from '@nuxt/test-utils/playwright'
import { loginAs } from './helpers'

test('signs in with the seeded user and lands in the app', async ({ page, goto }) => {
  await loginAs(page, goto)
  await expect(page).toHaveURL(/\/app(\/|$)/)
  await expect(page.getByText('Contacts')).toBeVisible()
})

test('flips to the signup prompt on the wrong password', async ({ page, goto }) => {
  await loginAs(page, goto, { password: 'wrong-pass-1' })
  await expect(page.getByText("No account with that password — we'll create one.")).toBeVisible()
})
```

Note: the wrong-password test intentionally overrides `password` but reuses the default `email` (via `loginAs`'s object defaults) — `E2E_USER.email` is used implicitly.

- [ ] **Step 2: Create `tests/e2e/magic-link.spec.ts`**

```ts
import { test, expect } from '@nuxt/test-utils/playwright'
import { E2E_USER } from './helpers'

test('sends a magic link and shows the inbox notice', async ({ page, goto }) => {
  await goto('/login', { waitUntil: 'hydration' })
  await page.getByRole('button', { name: 'Magic link', exact: true }).click()
  await page.locator('#email').fill(E2E_USER.email)
  await page.getByRole('button', { name: 'Send magic link' }).click()
  await expect(page.getByText('Check your inbox for the sign-in link.')).toBeVisible()
})
```

Note: this flow never signs in, so it does **not** call `loginAs` — the original test started at `/login` and tapped Magic link directly. Only the `E2E_USER` constant is shared.

- [ ] **Step 3: Create `tests/e2e/signout.spec.ts`**

```ts
import { test, expect } from '@nuxt/test-utils/playwright'
import { loginAs } from './helpers'

test('signs out and is redirected to the landing page', async ({ page, goto }) => {
  await loginAs(page, goto)
  await expect(page).toHaveURL(/\/app(\/|$)/)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/')
})
```

- [ ] **Step 4: Delete `tests/e2e/auth.spec.ts`**

```bash
git rm tests/e2e/auth.spec.ts
```

- [ ] **Step 5: Run the split specs**

Run: `npm run test:e2e -- tests/e2e/signin.spec.ts tests/e2e/magic-link.spec.ts tests/e2e/signout.spec.ts`
Prereq: local Supabase stack up (`supabase start` + `supabase db reset`) or `E2E_BASE_URL` set to a built+served `.output`.
Expected: 4 tests pass (2 signin + 1 magic-link + 1 signout).

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/signin.spec.ts tests/e2e/magic-link.spec.ts tests/e2e/signout.spec.ts
git commit -m "test(e2e): split auth spec into signin/magic-link/signout"
```

---

### Task 3: Split `contacts.spec.ts` into `add-contact`, `validation`

**Files:**
- Create: `tests/e2e/add-contact.spec.ts`
- Create: `tests/e2e/validation.spec.ts`
- Delete: `tests/e2e/contacts.spec.ts`

**Interfaces:**
- Consumes: `loginAs` from `./helpers` (Task 1).
- Produces: two spec files run by Playwright's `testDir` glob `./tests/e2e`.

- [ ] **Step 1: Create `tests/e2e/add-contact.spec.ts`**

```ts
import { test, expect } from '@nuxt/test-utils/playwright'
import { loginAs } from './helpers'

test('adds a contact from the manual form and sees it in the list', async ({ page, goto }) => {
  await loginAs(page, goto)
  await expect(page).toHaveURL(/\/app(\/|$)/)

  await page.getByRole('navigation').getByRole('link', { name: 'Add', exact: true }).click()
  await page.getByRole('link', { name: 'By hand' }).click()
  await expect(page).toHaveURL('/app/add/manual')

  await page.locator('#name').fill('Ada Lovelace')
  await page.locator('#how_met').fill('CppCon hallway')
  await page.locator('#email').fill('ada@example.com')
  await page.getByRole('button', { name: 'Save contact' }).click()
  await expect(page).toHaveURL(/\/app(\/|$)/)

  await expect(page.getByText('Ada Lovelace')).toBeVisible()
  await expect(page.getByText('CppCon hallway')).toBeVisible()
})
```

- [ ] **Step 2: Create `tests/e2e/validation.spec.ts`**

```ts
import { test, expect } from '@nuxt/test-utils/playwright'
import { loginAs } from './helpers'

test('blocks a contact with no email or phone', async ({ page, goto }) => {
  await loginAs(page, goto)
  await expect(page).toHaveURL(/\/app(\/|$)/)

  await page.getByRole('navigation').getByRole('link', { name: 'Add', exact: true }).click()
  await page.getByRole('link', { name: 'By hand' }).click()
  await expect(page).toHaveURL('/app/add/manual')

  await page.locator('#name').fill('No Channel')
  await page.locator('#how_met').fill('Somewhere')

  await expect(page.getByText('Add an email or a phone number.')).toBeVisible()
})
```

- [ ] **Step 3: Delete `tests/e2e/contacts.spec.ts`**

```bash
git rm tests/e2e/contacts.spec.ts
```

- [ ] **Step 4: Run the split specs**

Run: `npm run test:e2e -- tests/e2e/add-contact.spec.ts tests/e2e/validation.spec.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/add-contact.spec.ts tests/e2e/validation.spec.ts
git commit -m "test(e2e): split contacts spec into add-contact/validation"
```

---

### Task 4: Rename `settings.spec.ts` → `change-password.spec.ts` (uses `loginAs` with the `pw@` user)

**Files:**
- Create: `tests/e2e/change-password.spec.ts`
- Delete: `tests/e2e/settings.spec.ts`

**Interfaces:**
- Consumes: `loginAs` from `./helpers` (Task 1).
- Produces: one spec file that also proves the `loginAs` credentials override path is exercised (Definition of Done in the spec).

- [ ] **Step 1: Create `tests/e2e/change-password.spec.ts`**

Note: this retains the semantics of the original `settings.spec.ts` — the dedicated `pw@` user so the password mutation never affects the `e2e@` sign-in/add-contact flows.

```ts
import { test, expect } from '@nuxt/test-utils/playwright'
import { loginAs } from './helpers'

test('changes the password and signs in with the new one', async ({ page, goto }) => {
  await loginAs(page, goto, { email: 'pw@lanyard.test', password: 'pwpass123' })

  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/app\/settings/)

  await page.locator('#current-password').fill('pwpass123')
  await page.locator('#new-password').fill('pwnew456')
  await page.locator('#confirm-password').fill('pwnew456')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('Password updated.')).toBeVisible()

  // Sign out, then sign back in with the new password.
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/')

  await page.getByRole('link', { name: 'Log in' }).click()
  await page.locator('#email').fill('pw@lanyard.test')
  await page.locator('#password').fill('pwnew456')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/\/app(\/|$)/)
})
```

Note: only the **first** sign-in uses `loginAs`. The re-sign-in after signing out is kept inline (mirrors the original), because the spec asserts the URL flow around it and the original file's sign-out step used the raw `Sign out` button on `/app/settings` — which `loginAs` can't express. Keeping the re-login inline matches the original exactly.

- [ ] **Step 2: Delete `tests/e2e/settings.spec.ts`**

```bash
git rm tests/e2e/settings.spec.ts
```

- [ ] **Step 3: Run the spec**

Run: `npm run test:e2e -- tests/e2e/change-password.spec.ts`
Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/change-password.spec.ts
git commit -m "test(e2e): split settings spec into change-password"
```

---

### Task 5: Full suite gate + typecheck

**Files:**
- (none created/modified)

**Interfaces:**
- Consumes: all six spec files + `helpers.ts` from Tasks 1–4.
- Produces: the full green e2e suite and a clean typecheck — the Definition of Done.

- [ ] **Step 1: Confirm layout**

Run: `ls tests/e2e/`
Expected:
```
add-contact.spec.ts
change-password.spec.ts
helpers.ts
magic-link.spec.ts
signin.spec.ts
signout.spec.ts
validation.spec.ts
```
No `auth.spec.ts`, `contacts.spec.ts`, or `settings.spec.ts` remain.

- [ ] **Step 2: Confirm no inline login dances remain**

Run: `grep -rn "locator('#email')\|Continue" tests/e2e --include='*.spec.ts'`
Expected: the only `#email` references are in `magic-link.spec.ts` (the magic-link flow) and the in-login re-sign-in in `change-password.spec.ts`. No spec file (except `change-password`'s re-login and `magic-link`) fills `#email` + clicks Continue as a login.

- [ ] **Step 3: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: 7 tests pass (2 + 1 + 1 + 1 + 1 + 1).

- [ ] **Step 4: Typecheck**

Run: `npx nuxi typecheck`
Expected: PASS.

- [ ] **Step 5: Commit any stragglers**

```bash
git status
# if anything is uncommitted (shouldn't be), add and commit it
```

- [ ] **Step 6: Push the branch**

```bash
git push origin test/ci-testing
```

---

## Plan Self-Review

**Spec coverage:**
- "Six spec files + helpers.ts" → Tasks 1–4. ✓
- "loginAs used by every spec (no inline login dances remain)" → every spec calls `loginAs` on its sign-in; the two intentionally-non-login dances remain only where the original flow never logged in (magic-link) or re-signs in after sign-out (change-password). Verified in Task 5 Step 2. ✓
- "loginAs credentials override path exercised" → Task 4 uses `loginAs(page, goto, { email: 'pw@...', password: 'pwpass123' })`. ✓
- "`npm run test:e2e` green" → Task 5 Step 3. ✓
- "No changes to playwright.config.ts / seed.sql / ci.yml / component / unit" → none of the tasks touch them. ✓

**Placeholder scan:** every step has concrete file contents or an exact command; no TBD/TODO. ✓

**Type consistency:** `loginAs(page, goto[, opts])` signature is defined once in Task 1 and called identically in Tasks 2, 3, 4. `E2E_USER` used in Tasks 1 and 2 consistently. ✓