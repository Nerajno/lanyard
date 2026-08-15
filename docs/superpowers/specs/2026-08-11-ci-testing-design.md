# CI Testing — Component + E2E Design

## Goal

Make the GitHub Actions `verify` gate meaningful for PRs merging into main:
add **component tests** (Vitest + `vitest-environment-nuxt`) and **end-to-end
tests** (Playwright against the Nuxt server over a **local Supabase stack**),
covering the core flows. Existing `tests/unit/*` (node env, pure logic) stay
exactly as they are.

## Decisions

- **E2E backend:** Supabase CLI local stack in CI (`supabase start` + `supabase
  db reset`), migrations applied, a seeded test user; not a mocked Supabase.
- **Surface:** core flows only — component tests for the risky/new components;
  e2e for signup/sign-in, add-contact, and settings/change-password.
- **Branch:** this work lives on `feature/change-password` so the tests +
  checks run on PR #20 before it merges; main inherits them on merge.

## Stack

- `@nuxt/test-utils` v3.23 already in deps (unused today) — provides
  `mountSuspended`/`mockNuxtImport` (runtime) and the Nuxt Vitest environment.
- New dev deps: `@vue/test-utils` (^2.4), `happy-dom` (Nuxt vitest env needs a
  DOM impl), `@playwright/test` (^1.43+; `@nuxt/test-utils/playwright` drives
  it).
- Node 22 in CI, Chromium-only browser for Playwright.

## Vitest layout

Single `vitest.config.ts` via `test.projects` (Vitest 3):

| project | env | include | purpose |
|---|---|---|---|
| `unit` | `node` | `tests/unit/*.test.ts` | existing 80 unit tests, unchanged |
| `nuxt` | `nuxt` (happy-dom) | `tests/component/*.test.ts` | component tests, auto-imports enabled |

Register the Nuxt project with `defineVitestProject` from
`@nuxt/test-utils/config` so auto-imports, Pinia, and composables resolve.

## Component tests (`tests/component/`)

Mount with `mountSuspended` from `@nuxt/test-utils/runtime`. Supabase calls are
stubbed at the store/composable boundary, not by mocking the client lib:

- `ChangePasswordForm.test.ts` — validation gating (min 8, mismatch, same as
  current), success path (calls `auth.changePassword`, shows confirmation, clears
  inputs), `current_password_invalid`/`reauthentication_needed` error mapping.
- `PasswordAuthForm.test.ts` — sign-in → `signInWithPassword`; wrong creds →
  signup prompt phase; duplicate email → "already in use"; forgot password →
  `sendPasswordReset` + inbox notice.
- `ConfirmDeleteAccount.test.ts` — typed-email match gates the delete call;
  mismatch shows error and never calls the API.
- `NudgePrefsForm.test.ts` — loads `useProfile`, save → `save()` + `@saved`.
- `ContactForm.test.ts` — email-or-phone required (mirrors DB CHECK), name +
  how_met required, submit payload.
- `WaitlistForm.test.ts` — valid email posts, invalid shows inline error.

These components touch `useAuthStore` / `useProfile` / `useContacts`, so each
test uses a `createPinia()` in a fresh test scope and a stubbed store action via
`vi.spyOn` on the store instance (spy on behavior, not the client lib).

## E2E (`tests/e2e/`)

`playwright.config.ts` uses `defineConfig<ConfigOptions>` from
`@nuxt/test-utils/playwright` with `use.nuxt.rootDir` = repo root so test-utils
builds/serves the app; `baseURL` = the served Nuxt URL. Tests live in
`tests/e2e/*.spec.ts`.

Flows (all against the local Supabase stack, seeded user):

1. **auth.spec.ts** — create account (sign up), sign in, sign out; wrong
   password path; forgot-password notice.
2. **contacts.spec.ts** — add a contact via the form, name/how_met surface in
   the list.
3. **settings.spec.ts** — change password with current password, confirm
   success message, signOut others path doesn't error.

Runtime config for e2e comes from a `tests/e2e/.env`-supplied local stack:
`NUXT_PUBLIC_SUPABASE_URL` → `http://127.0.0.1:54321`, anon key from the stack
(`supabase status -o env`), `NUXT_PUBLIC_APP_URL` → Nuxt origin.

## Supabase local stack

- `supabase/seed.sql` — idempotent seed: a known test user (email +
  password) inserted via `auth.admin` path (`supabase db reset` runs it), plus a
  `profiles` row so /app middlewares pass. Guarded so it only seeds the e2e
  fixture identity; no production data.
- Migrations already in `supabase/migrations/`; `supabase db reset` applies
  them in CI.

## CI (`ci.yml`)

- `verify` job: keep as-is (install, lint, unit via `npm test`, typecheck,
  build).
- New `component` job (can fold into verify or separate): runs the `nuxt`
  Vitest project (`npm run test:component` → `vitest run --project nuxt`).
- New `e2e` job:
  1. checkout, setup-node 22, `npm ci`, `npm run postinstall`
  2. `supabase start` (CLI preinstalled via `supabase/setup-cli`)
  3. `supabase db reset` (applies migrations + seed.sql)
  4. `npx playwright install chromium`
  5. `npm run test:e2e` with `BASE_URL` + Supabase env from `supabase status -o env`
- Secrets: none new — local stack needs only the anon key (from the local
  stack), which CI derives at runtime. Service-role never touches the client.

## Definition of done

- `npm test` — all 3 projects green (unit + component) in one run.
- `npm run test:e2e` — green against a locally started Supabase stack.
- `ci.yml` runs all three on PRs; required before merge to main.
- No production code changes (test-only + config); RLS untouched.