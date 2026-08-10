# Lanyard Sitemap Buildout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Nuxt app into the two-state sitemap (public marketing + signed-in `/app`), with guards, redirects, token routes, and the full responsive app shell.

**Architecture:** Public pages stay top-level and use `layouts/default.vue`. The signed-in app moves to `pages/app/` with a new `layouts/app.vue` (top nav ≥md, bottom tab bar on mobile). Token routes `/share/:token` (opaque per-capture DB token) and `/act/:token` (HMAC-signed query moved to path) need no session. New `shares` table + `profiles.onboarded_at` column drive the capture and first-run gates. Old flat URLs 301 to new paths. Magic-link redirect round-trips via a `?redirect=` param.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup lang="ts">`, Pinia, Tailwind, Supabase (RLS + service role in Nitro only), Vitest, `qrcode`.

## Global Constraints

- `definePageMeta({ layout: 'app' })` + `middleware: 'app'` on every `/app/*` page.
- Every new table gets RLS keyed on `auth.uid()` in the same migration.
- Service-role client (`useSupabaseAdmin`) is server-only; never import in client code.
- Share capture contacts get the **default ladder** `LADDER_PRESETS.default` and `follow_up_by = created_at + ladder[0]`.
- `/share/:token` GET leaks only `how_met_default` — never owner identity.
- Nudge/act rules unchanged: never auto-send; direct nudge must include `how_met` verbatim.
- Contact form still requires at least one of email/phone (DB CHECK mirrored).
- `error.vue` lives at project root (not `pages/`).
- Design language: paper/coral, Bricolage Grotesque, rounded cards — reuse existing tokens/utilities.

---

### Task 1: Schema + types — `shares` table, `profiles.onboarded_at`

**Files:**
- Create: `supabase/migrations/0005_shares_onboarded.sql`
- Modify: `types/database.ts`, `types/index.ts`

**Interfaces:**
- Produces: `Share` type (`Share = GeneratedDatabase['public']['Tables']['shares']['Row']`), `Profile.onboarded_at: string | null`, `profiles.onboarded_at` in Insert/Update, `InsertShare`.

- [ ] **Step 1: Write the migration**

```sql
-- Shares: per-capture, one-time, expiring tokens for /share/:token.
-- Claim happens only in server routes with the service-role client (RLS intact).

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

create table if not exists public.shares (
  id               text primary key,                      -- the /share/:token value
  user_id          uuid not null references auth.users (id) on delete cascade,
  how_met_default  text,
  expires_at       timestamptz not null,
  used_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists shares_user on public.shares (user_id);
create index if not exists shares_expires on public.shares (expires_at);

alter table public.shares enable row level security;

create policy "shares_select_own" on public.shares
  for select using (user_id = (select auth.uid()));
create policy "shares_insert_own" on public.shares
  for insert with check (user_id = (select auth.uid()));
create policy "shares_delete_own" on public.shares
  for delete using (user_id = (select auth.uid()));

comment on column public.profiles.onboarded_at is 'Set by onboarding save; null = not onboarded.';
comment on column public.shares.used_at is 'Null until a stranger claims the link (one-time use).';
```

- [ ] **Step 2: Update `types/database.ts`** — add `onboarded_at` to `profiles` Row/Insert, add the `shares` table:

```ts
// within profiles.Row:  onboarded_at: string | null
// within profiles.Insert:  onboarded_at?: string | null
// new table after contacts/nudges:
shares: {
  Row: {
    id: string
    user_id: string
    how_met_default: string | null
    expires_at: string
    used_at: string | null
    created_at: string
  }
  Insert: {
    id: string
    user_id: string
    how_met_default?: string | null
    expires_at: string
    used_at?: string | null
  }
  Update: Partial<Database['public']['Tables']['shares']['Insert']>
}
```

- [ ] **Step 3: Update `types/index.ts`** — add `Share` alias:

```ts
export type Share = GeneratedDatabase['public']['Tables']['shares']['Row']
export type InsertShare = GeneratedDatabase['public']['Tables']['shares']['Insert']
export type UpdateShare = GeneratedDatabase['public']['Tables']['shares']['Update']
```

- [ ] **Step 4: Verify types**

Run: `npx nuxi typecheck`
Expected: passes (no errors about the new columns).

- [ ] **Step 5: Apply migration (local link if configured, else note)**

If `supabase` CLI is linked locally: `supabase db push` (or the project's migration flow). Otherwise apply `0005_shares_onboarded.sql` to the remote project and run `supabase gen types typescript` later — for this pass, the hand-written `types/database.ts` is authoritative.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0005_shares_onboarded.sql types/database.ts types/index.ts
git commit -m "feat(db): shares table + profiles.onboarded_at"
```

---

### Task 2: Act-link path change + nudge infra

**Files:**
- Modify: `utils/actLink.ts:78-81`, `tests/unit/actLink.test.ts`
- Create: `server/routes/act/[token].get.ts`
- Modify: `server/api/act/index.ts` (keep as legacy redirect), `server/services/nudgeSender.ts:86`

**Interfaces:**
- Consumes: `buildNudgeActLink(baseUrl, payload, secret)`, `verifyActLink(token, secret)`, `advanceTouchpoint(ladder, done, now)`, `useSupabaseAdmin()`.
- Produces: `buildNudgeActLink` returns `${baseUrl}/act/<token>` (path, not query). Server route GET `/act/:token` performs the existing redirect logic.

- [ ] **Step 1: Update the builder test (failing first)**

In `tests/unit/actLink.test.ts`, replace the `is a URL with the token in the query` expectation:

```ts
it('is a URL with the token in the path (/act/:token)', () => {
  const link = buildNudgeActLink('https://lanyard.app', { nudgeId: 'n1', contactId: 'c1' }, SECRET)
  expect(link).toMatch(/^https:\/\/lanyard\.app\/act\/[^/]+$/)
  expect(() => verifyActLink(link.split('/act/')[1], SECRET)).not.toThrow()
})

it('builds a digest link when flagged', () => {
  const link = buildNudgeActLink('https://lanyard.app/', { nudgeId: 'n2', contactId: 'c1', digest: true }, SECRET)
  const p = verifyActLink(link.split('/act/')[1], SECRET)
  expect(p.digest).toBe(true)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/actLink.test.ts`
Expected: FAIL on the path-format assertion.

- [ ] **Step 3: Update the builder**

```ts
export function buildNudgeActLink(baseUrl: string, payload: Omit<ActPayload, 'v' | 'exp'>, secret: string): string {
  const token = signActLink(payload, secret)
  return `${baseUrl.replace(/\/$/, '')}/act/${encodeURIComponent(token)}`
}
```

- [ ] **Step 4: Move the act handler to a path route**

Create `server/routes/act/[token].get.ts` with the current `server/api/act/index.ts` body, but read the token from the route param and change the digest redirect to `/app`:

```ts
import { verifyActLink } from '~/utils/actLink'
import { advanceTouchpoint } from '~/utils/cadence'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) return sendRedirect(event, '/', 302)

  const { actLinkSigningSecret, public: { appUrl } } = useRuntimeConfig()
  if (!actLinkSigningSecret) {
    throw createError({ statusCode: 500, statusMessage: 'ACT_LINK_SIGNING_SECRET not configured' })
  }

  let payload
  try {
    payload = verifyActLink(token, actLinkSigningSecret)
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired act-link' })
  }

  const admin = useSupabaseAdmin()
  const { data: nudge } = await admin.from('nudges').select('*').eq('id', payload.nudgeId).single()

  if (nudge && !nudge.opened_at) {
    await admin.from('nudges').update({ opened_at: new Date().toISOString() }).eq('id', nudge.id)
  }

  if (payload.digest) {
    return sendRedirect(event, `${appUrl || '/'}app`, 302)
  }

  const { data: contact } = await admin.from('contacts').select('*').eq('id', payload.contactId).single()
  if (!contact) return sendRedirect(event, '/', 302)

  const next = advanceTouchpoint(contact.cadence_ladder, contact.touchpoints_done, new Date())
  const patch: Record<string, unknown> = { touchpoints_done: next?.touchpoints_done ?? contact.touchpoints_done + 1 }
  if (next) patch.follow_up_by = next.follow_up_by
  else patch.status = 'graduated'

  await admin.from('contacts').update(patch).eq('id', contact.id)
  if (nudge && !nudge.acted_at) {
    await admin.from('nudges').update({ acted_at: new Date().toISOString() }).eq('id', nudge.id)
  }

  return sendRedirect(event, composerUrl(contact, contact.how_met), 302)
})

function composerUrl(contact: { email: string | null; phone: string | null }, howMet: string): string {
  if (contact.email) {
    const subject = encodeURIComponent('Great connecting at the conference')
    const body = encodeURIComponent(`Hi,\n\n${howMet}\n\nBest,\n[Your name]`)
    return `mailto:${contact.email}?subject=${subject}&body=${body}`
  }
  const phone = (contact.phone ?? '').replace(/\D/g, '')
  const body = encodeURIComponent(`Hi! ${howMet} — would love to keep in touch.`)
  return `sms:${phone}?body=${body}`
}
```

Then trim `server/api/act/index.ts` to a legacy redirect that keeps old in-the-wild links alive:

```ts
// Legacy: old nudges embedded ?t= query links. Point them at the new /act/:token path.
export default defineEventHandler(async (event) => {
  const token = getQuery(event).t
  return sendRedirect(event, `/act/${String(token ?? '')}`, 302)
})
```

- [ ] **Step 5: Update the digest triage link in nudgeSender**

In `server/services/nudgeSender.ts` line ~86:

```ts
const triage = `${cfg.appUrl.replace(/\/$/, '')}/app`
```

Also update the comment at the top if it references `/contacts`.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/unit/actLink.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npx nuxi typecheck`
Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add utils/actLink.ts tests/unit/actLink.test.ts server/routes/act/[token].get.ts server/api/act/index.ts server/services/nudgeSender.ts
git commit -m "feat(act): move act-link to /act/:token path; legacy redirect"
```

---

### Task 3: Auth round-trip + guards (auth, onboarding, app)

**Files:**
- Modify: `stores/auth.ts`, `middleware/auth.ts`, `pages/auth/confirm.vue`
- Create: `middleware/onboarding.ts`, `middleware/app.ts`, `utils/onboarding.ts`, `tests/unit/onboarding.test.ts`

**Interfaces:**
- Consumes: `useAuthStore()` (`user`, `ready`, `hydrate`, `signInWithEmail`), `useProfile()` (`profile`, `load`).
- Produces: `isOnboarded(profile)` predicate; `signInWithEmail(email, redirect?)`; middleware `app` that runs `auth` then `onboarding`.

- [ ] **Step 1: Write the failing predicate test**

Create `tests/unit/onboarding.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isOnboarded } from '~/utils/onboarding'

describe('isOnboarded', () => {
  it('is false when profile is null', () => {
    expect(isOnboarded(null)).toBe(false)
  })
  it('is false when onboarded_at is null', () => {
    expect(isOnboarded({ onboarded_at: null } as any)).toBe(false)
  })
  it('is true when onboarded_at is set', () => {
    expect(isOnboarded({ onboarded_at: '2026-08-09T00:00:00Z' } as any)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/onboarding.test.ts`
Expected: FAIL (`isOnboarded` not defined).

- [ ] **Step 3: Write the predicate**

Create `utils/onboarding.ts`:

```ts
import type { Profile } from '~/types'

/** True once the user has completed first-run setup (onboarded_at set). */
export function isOnboarded(profile: Pick<Profile, 'onboarded_at'> | null | undefined): boolean {
  return Boolean(profile?.onboarded_at)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/onboarding.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend the auth store with a redirect param**

In `stores/auth.ts`, change `signInWithEmail` to accept and forward a redirect target. The current implementation builds `emailRedirectTo` — extend it:

```ts
async signInWithEmail(email: string, redirectTo?: string): Promise<boolean> {
  const base = `${useRuntimeConfig().public.appUrl || window.location.origin}/auth/confirm`
  const emailRedirectTo = redirectTo ? `${base}?redirect=${encodeURIComponent(redirectTo)}` : base
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo } })
  if (error) throw error
  return true
}
```

- [ ] **Step 6: Update `middleware/auth.ts` to carry `?redirect=`**

```ts
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.hydrate()
  if (!auth.user) return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
})
```

- [ ] **Step 7: Create `middleware/onboarding.ts`**

```ts
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (!auth.user) return
  if (to.path === '/app/onboarding') return
  const { profile, load } = useProfile()
  await load()
  if (!isOnboarded(profile.value)) return navigateTo('/app/onboarding')
})
```

- [ ] **Step 8: Create `middleware/app.ts`**

```ts
import auth from './auth'
import onboarding from './onboarding'

export default defineNuxtRouteMiddleware(async (to) => {
  const revoked = await auth(to)
  if (revoked) return revoked
  return onboarding(to)
})
```

- [ ] **Step 9: Update `pages/auth/confirm.vue`** — honor the surviving redirect

Replace `await navigateTo('/')` with:

```ts
const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/app'
await navigateTo(redirect)
```

- [ ] **Step 10: Run all tests + typecheck**

Run: `npx vitest run && npx nuxi typecheck`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add stores/auth.ts middleware/auth.ts middleware/onboarding.ts middleware/app.ts utils/onboarding.ts tests/unit/onboarding.test.ts pages/auth/confirm.vue
git commit -m "feat(auth): redirect round-trip + onboarding/app guards"
```

---

### Task 4: App layout + page migration under `/app` + redirects

**Files:**
- Create: `layouts/app.vue`
- Modify: `layouts/default.vue`, `nuxt.config.ts`, `components/ContactCard.vue`
- Move by git: `pages/contacts/index.vue` → `pages/app/index.vue`; `pages/contacts/[id]/edit.vue` → `pages/app/c/[id].vue`; `pages/add.vue` → `pages/app/add/manual.vue`; `pages/settings.vue` → `pages/app/settings.vue`; `pages/stats.vue` → `pages/app/stats.vue`
- Create: `pages/app/add/index.vue`, `server/routes/contacts/[id]/edit.get.ts`

**Interfaces:**
- Consumes: `layouts/app.vue` name `'app'`; existing page bodies (moved verbatim for now; Tasks 5 refines settings).
- Produces: `definePageMeta({ layout: 'app', middleware: 'app' })` pages under `/app/**`; 301 `routeRules`; Nitro redirect `/contacts/:id/edit` → `/app/c/:id`.

- [ ] **Step 1: Create `layouts/app.vue`**

Responsive shell — top nav on `≥md`, fixed bottom tab bar (Due / Add / Settings) on mobile, no nav when path is `/app/onboarding`:

```vue
<template>
  <div class="min-h-screen bg-paper pb-16 text-ink md:pb-0">
    <!-- Top nav (≥ md) -->
    <header v-if="!isOnboarding" class="border-b border-line bg-surface">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <NuxtLink to="/app"><BrandMark /></NuxtLink>
        <nav class="flex items-center gap-6 text-sm">
          <NuxtLink to="/app" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral">Due</NuxtLink>
          <NuxtLink to="/app/add" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition-colors hover:text-coral">Add</NuxtLink>
          <NuxtLink to="/app/settings" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition-colors hover:text-coral">Settings</NuxtLink>
          <NuxtLink to="/app/stats" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition-colors hover:text-coral">Stats</NuxtLink>
          <button
            class="border-line bg-surface text-ink hover:border-coral flex h-8 w-8 items-center justify-center rounded-full border text-sm"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme"
          >{{ isDark ? '☀' : '☾' }}</button>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-8">
      <slot />
    </main>

    <!-- Bottom tab bar (< md) -->
    <nav v-if="!isOnboarding" class="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface md:hidden">
      <div class="mx-auto flex max-w-3xl items-center justify-around">
        <NuxtLink to="/app" class="flex flex-1 flex-col items-center gap-0.5 py-3 font-mono text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral">Due</NuxtLink>
        <NuxtLink to="/app/add" class="flex flex-1 flex-col items-center gap-0.5 py-3 font-mono text-xs uppercase tracking-eyebrow text-coral">Add</NuxtLink>
        <NuxtLink to="/app/settings" class="flex flex-1 flex-col items-center gap-0.5 py-3 font-mono text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral">Settings</NuxtLink>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { isDark, toggle: toggleTheme } = useTheme()
const isOnboarding = computed(() => route.path === '/app/onboarding')
</script>
```

- [ ] **Step 2: Move app pages under `/app` via git (preserve history)**

```bash
mkdir -p pages/app/add pages/app/c
git mv pages/add.vue pages/app/add/manual.vue
git mv pages/settings.vue pages/app/settings.vue
git mv pages/stats.vue pages/app/stats.vue
git mv pages/contacts/index.vue pages/app/index.vue
git mv pages/contacts/[id]/edit.vue pages/app/c/[id].vue
```

- [ ] **Step 3: Point every app page at the `app` layout + `app` middleware**

In each moved page (`pages/app/index.vue`, `pages/app/add/manual.vue`, `pages/app/settings.vue`, `pages/app/stats.vue`, `pages/app/c/[id].vue`), replace the existing `definePageMeta`:

```ts
definePageMeta({ layout: 'app', middleware: 'app' })
```

- [ ] **Step 4: Fix navigations in moved pages**

In `pages/app/index.vue`, `pages/app/add/manual.vue`, `pages/app/c/[id].vue`, every `navigateTo('/')` after add/edit becomes `navigateTo('/app')`. Adjust `pages/app/index.vue` links `/add` → `/app/add`.

- [ ] **Step 5: ContactCard edit link**

In `components/ContactCard.vue` line 50:

```ts
<NuxtLink :to="`/app/c/${contact.id}`" class="...">Edit</NuxtLink>
```

- [ ] **Step 6: Create the `/app/add` chooser**

Create `pages/app/add/index.vue`:

```vue
<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Add a connection</h1>
    <p class="mt-1 text-sm text-muted">Capture them fast — you can enrich later.</p>
    <div class="mt-6 grid gap-4 sm:grid-cols-3">
      <NuxtLink to="/app/add/manual" class="rounded-xl border border-line bg-surface p-5 transition hover:border-coral">
        <div class="text-2xl">✎</div>
        <h2 class="mt-2 font-display text-lg font-bold">By hand</h2>
        <p class="mt-1 text-sm text-muted">Name, where you met, and a way to reach them.</p>
      </NuxtLink>
      <NuxtLink to="/app/add/link" class="rounded-xl border border-line bg-surface p-5 transition hover:border-coral">
        <div class="text-2xl">◇</div>
        <h2 class="mt-2 font-display text-lg font-bold">Share link</h2>
        <p class="mt-1 text-sm text-muted">Send a link; they fill in their own details.</p>
      </NuxtLink>
      <NuxtLink to="/app/add/scan" class="rounded-xl border border-line bg-surface p-5 transition hover:border-coral">
        <div class="text-2xl">▣</div>
        <h2 class="mt-2 font-display text-lg font-bold">Scan</h2>
        <p class="mt-1 text-sm text-muted">Badge / LinkedIn QR — coming soon.</p>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'app' })
</script>
```

- [ ] **Step 7: Configure 301 routeRules**

In `nuxt.config.ts`, add:

```ts
routeRules: {
  '/contacts': { redirect: { to: '/app', statusCode: 301 } },
  '/add': { redirect: { to: '/app/add', statusCode: 301 } },
  '/settings': { redirect: { to: '/app/settings', statusCode: 301 } },
  '/stats': { redirect: { to: '/app/stats', statusCode: 301 } },
},
```

- [ ] **Step 8: Nitro handler for the param route**

Create `server/routes/contacts/[id]/edit.get.ts`:

```ts
export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  return sendRedirect(event, `/app/c/${id}`, 301)
})
```

- [ ] **Step 9: Rework `layouts/default.vue` for public pages**

Replace the app nav (Contacts/Add/Settings/Stats) with a marketing nav that branches on auth:

```vue
<template>
  <div class="min-h-screen bg-paper text-ink">
    <header class="border-b border-line bg-surface">
      <div class="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-4">
        <NuxtLink to="/"><BrandMark /></NuxtLink>
        <nav class="flex items-center gap-6 text-sm">
          <NuxtLink to="/pricing" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral">Pricing</NuxtLink>
          <template v-if="user">
            <NuxtLink to="/app" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral">Open app</NuxtLink>
            <span class="hidden font-mono text-xs text-muted sm:inline">{{ user.email }}</span>
          </template>
          <template v-else>
            <NuxtLink to="/login" class="font-mono text-xs uppercase tracking-eyebrow text-muted transition hover:text-coral">Log in</NuxtLink>
            <NuxtLink to="/early-access" class="rounded-lg bg-coral px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-coral-press">Get early access</NuxtLink>
          </template>
          <button
            class="border-line bg-surface text-ink hover:border-coral flex h-8 w-8 items-center justify-center rounded-full border text-sm"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme"
          >{{ isDark ? '☀' : '☾' }}</button>
        </nav>
      </div>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const { user } = storeToRefs(auth)
const { isDark, toggle: toggleTheme } = useTheme()
</script>
```

> The marketing pages render their own full-width sections/hero/footer (matching `pages/index.vue` today), so the layout's `main` has no max-width.

- [ ] **Step 10: Typecheck + lint**

Run: `npx nuxi typecheck && npm run lint`
Expected: passes.

- [ ] **Step 11: Commit**

```bash
git add layouts/app.vue layouts/default.vue nuxt.config.ts components/ContactCard.vue pages/app pages/contacts pages/add.vue pages/settings.vue pages/stats.vue server/routes/contacts/[id]/edit.get.ts
git commit -m "feat(app): move signed-in routes under /app with app shell + 301s"
```

---

### Task 5: Extract `NudgePrefsForm`, onboarding page, settings sections

**Files:**
- Create: `components/NudgePrefsForm.vue`, `pages/app/onboarding.vue`
- Modify: `pages/app/settings.vue` (use the form + appearance + account sections)

**Interfaces:**
- Consumes: `useProfile()` (`profile`, `save`, `optInSms`), `isOnboarded`, `useTheme`.
- Produces: `NudgePrefsForm` component (channel / SMS opt-in + verify / timezone) emitting `saved`; settings page calls `save({ ...patch, onboarded_at: existing ?? now })`.

- [ ] **Step 1: Extract `NudgePrefsForm.vue`**

Copy the channel + SMS opt-in/verify + timezone logic out of the current `pages/app/settings.vue` form. It exposes the profile methods it needs internally and emits `saved` when preferences save:

```vue
<template>
  <form class="space-y-6" @submit.prevent="onSave">
    <fieldset>
      <legend class="font-mono text-xs uppercase tracking-eyebrow text-ink">Channel</legend>
      <p v-if="profile?.sms_opted_out_at" class="mt-1 text-xs text-coral">You've opted out of SMS. Choose email to receive nudges.</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          v-for="c in channels" :key="c.value" type="button"
          class="rounded-lg border px-3 py-2 text-sm"
          :class="form.nudge_channel === c.value ? 'border-coral bg-coral-soft text-coral' : 'border-line bg-surface text-ink hover:border-muted'"
          @click="form.nudge_channel = c.value"
        >{{ c.label }}</button>
      </div>
    </fieldset>

    <div v-if="!profile?.sms_opted_out_at">
      <label class="flex items-start gap-3 text-sm">
        <input v-model="smsOptInConsent" type="checkbox" class="mt-0.5 accent-coral">
        <span>I agree to receive conference follow-up reminders by text. <span class="text-muted">Reply STOP to opt out, HELP for help. Message &amp; data rates may apply.</span></span>
      </label>
      <div v-if="smsOptInConsent" class="mt-3 flex items-end gap-2">
        <div class="flex-1">
          <label class="text-sm font-medium text-ink" for="phone">Mobile number</label>
          <input id="phone" v-model="form.phone" type="tel" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none" placeholder="+1 555 000 0000">
        </div>
        <button type="button" class="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-paper" :disabled="sendingCode" @click="sendCode">{{ smsOptedIn ? 'Verify' : 'Send code' }}</button>
      </div>
      <div v-if="smsCodeSent" class="mt-2 flex items-end gap-2">
        <div class="flex-1">
          <label class="text-sm font-medium text-ink" for="code">Enter the code we texted you</label>
          <input id="code" v-model="code" inputmode="numeric" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none" placeholder="123456">
        </div>
        <button type="button" class="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-paper" @click="verifyCode">Confirm</button>
      </div>
    </div>

    <div>
      <label class="text-sm font-medium text-ink" for="timezone">Timezone</label>
      <select id="timezone" v-model="form.timezone" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none">
        <option v-for="tz in commonTimezones" :key="tz" :value="tz">{{ tz }}</option>
      </select>
      <p class="mt-1 text-xs text-muted">Nudges are sent during your local daytime (09:00–21:00).</p>
    </div>

    <p v-if="error" class="text-sm text-coral">{{ error }}</p>

    <button
      type="submit" :disabled="saving"
      class="rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:opacity-50"
    >{{ saving ? 'Saving…' : 'Save preferences' }}</button>
  </form>
</template>

<script setup lang="ts">
import { useProfile } from '~/composables/useProfile'

const emit = defineEmits<{ saved: [] }>()
const { profile, save, optInSms } = useProfile()

const channels = [
  { value: 'email' as const, label: 'Email' },
  { value: 'sms' as const, label: 'Text (requires opt-in)' },
  { value: 'both' as const, label: 'Both' },
]
const commonTimezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC', 'Europe/London', 'Europe/Berlin', 'Australia/Sydney', 'Asia/Tokyo']

const detectedTimezone = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC' } catch { return 'UTC' }
})()

const form = reactive({
  nudge_channel: (profile.value?.nudge_channel ?? 'email') as 'sms' | 'email' | 'both',
  phone: profile.value?.phone ?? '',
  timezone: profile.value?.timezone ?? detectedTimezone,
})

const smsOptInConsent = ref(false)
const smsOptedIn = computed(() => Boolean(profile.value?.sms_opt_in_at && !profile.value?.sms_opted_out_at))
const smsCodeSent = ref(false)
const sendingCode = ref(false)
const saving = ref(false)
const code = ref('')
const error = ref<string | null>(null)

async function sendCode() {
  error.value = null
  if (!form.phone) { error.value = 'Add your mobile number first.'; return }
  sendingCode.value = true
  try {
    await $fetch('/api/profile/phone?action=send', { method: 'POST', body: { phone: form.phone } })
    smsCodeSent.value = true
  } catch (e) {
    error.value = (e as any)?.data?.statusText ?? 'Could not send a code.'
  } finally { sendingCode.value = false }
}

async function verifyCode() {
  error.value = null
  if (!form.phone || !code.value) { error.value = 'Enter the code we texted you.'; return }
  try {
    await $fetch('/api/profile/phone?action=verify', { method: 'POST', body: { phone: form.phone, code: code.value } })
    await optInSms(form.phone)
    smsCodeSent.value = false
  } catch (e) {
    error.value = (e as any)?.data?.statusText ?? 'Verification failed.'
  }
}

async function onSave() {
  error.value = null
  saving.value = true
  try {
    await save({ nudge_channel: form.nudge_channel, timezone: form.timezone, phone: form.phone || null })
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally { saving.value = false }
}
</script>
```

- [ ] **Step 2: Create `pages/app/onboarding.vue`**

```vue
<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Almost there</h1>
    <p class="mt-1 text-sm text-muted">Lanyard needs a destination before it can nudge you.</p>
    <div class="mt-6">
      <NudgePrefsForm @saved="onSaved" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useProfile } from '~/composables/useProfile'

definePageMeta({ layout: 'app', middleware: 'app' })

const { save } = useProfile()

async function onSaved() {
  // Record first-run completion explicitly.
  await save({ onboarded_at: new Date().toISOString() })
  await navigateTo('/app')
}
</script>
```

> Note: `NudgePrefsForm` already calls `save(...)` on submit; onboarding then stamps `onboarded_at` via its own `save`. Keep the call order: form save first, then stamp.

- [ ] **Step 3: Rework `pages/app/settings.vue`**

Keep the `NudgePrefsForm` for channel/send preferences; stamp `onboarded_at` in case a user lands here first; add appearance + account sections:

```vue
<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Settings</h1>

    <section class="mt-6">
      <h2 class="font-mono text-xs uppercase tracking-eyebrow text-muted">Nudges</h2>
      <div class="mt-3">
        <NudgePrefsForm @saved="onSaved" />
      </div>
    </section>

    <section class="mt-10">
      <h2 class="font-mono text-xs uppercase tracking-eyebrow text-muted">Appearance</h2>
      <button type="button" class="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-paper" @click="toggleTheme">
        Switch to {{ isDark ? 'light' : 'dark' }}
      </button>
    </section>

    <section class="mt-10">
      <h2 class="font-mono text-xs uppercase tracking-eyebrow text-muted">Account</h2>
      <p v-if="user" class="mt-2 text-sm text-muted">{{ user.email }}</p>
      <button type="button" class="mt-3 text-sm text-coral hover:underline" @click="onSignOut">Sign out</button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useProfile } from '~/composables/useProfile'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'app', middleware: 'app' })

const { profile, save } = useProfile()
const auth = useAuthStore()
const { user } = storeToRefs(auth)
const { isDark, toggle: toggleTheme } = useTheme()

async function onSaved() {
  if (!profile.value?.onboarded_at) {
    await save({ onboarded_at: new Date().toISOString() })
  }
  await navigateTo('/app/settings')
}

async function onSignOut() {
  await auth.signOut()
  await navigateTo('/')
}
</script>
```

- [ ] **Step 4: Typecheck**

Run: `npx nuxi typecheck`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add components/NudgePrefsForm.vue pages/app/onboarding.vue pages/app/settings.vue
git commit -m "feat(onboarding): first-run page + shared prefs form + settings sections"
```

---

### Task 6: Share capture server routes + guard logic

**Files:**
- Create: `utils/share.ts`, `tests/unit/share.test.ts`, `server/api/share/[token].get.ts`, `server/api/share/[token].post.ts`

**Interfaces:**
- Consumes: `useSupabaseAdmin()`, `LADDER_PRESETS.default`, `initialFollowUp(createdAt, ladder)`, `readBody`.
- Produces: `shareIsValid(share, now)` guard; GET `/api/share/:token` → `{ valid, how_met_default }`; POST `/api/share/:token` → created contact or `410`.

- [ ] **Step 1: Write the failing guard tests**

Create `tests/unit/share.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shareIsValid } from '~/utils/share'
import type { Share } from '~/types'

const base: Share = {
  id: 'tok', user_id: 'u1', how_met_default: null,
  expires_at: '2026-09-01T00:00:00Z', used_at: null, created_at: '2026-08-01T00:00:00Z',
}

describe('shareIsValid', () => {
  it('accepts a fresh token', () => {
    expect(shareIsValid(base, new Date('2026-08-15T00:00:00Z'))).toBe(true)
  })
  it('rejects an expired token', () => {
    const expired = { ...base, expires_at: '2026-08-01T00:00:00Z' }
    expect(shareIsValid(expired, new Date('2026-08-15T00:00:00Z'))).toBe(false)
  })
  it('rejects a used token', () => {
    const used = { ...base, used_at: '2026-08-10T00:00:00Z' }
    expect(shareIsValid(used, new Date('2026-08-15T00:00:00Z'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/share.test.ts`
Expected: FAIL (`shareIsValid` not defined).

- [ ] **Step 3: Write the guard**

Create `utils/share.ts`:

```ts
import { asInstant } from '~/utils/cadence'
import type { Share } from '~/types'

/** A share link is usable only when unused and not yet expired. Millisecond-exact. */
export function shareIsValid(share: Pick<Share, 'used_at' | 'expires_at'> | null | undefined, now: Date = new Date()): boolean {
  if (!share) return false
  if (share.used_at) return false
  if (asInstant(share.expires_at) < asInstant(now)) return false
  return true
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/share.test.ts`
Expected: PASS.

- [ ] **Step 5: Create GET `/api/share/:token`**

Create `server/api/share/[token].get.ts`:

```ts
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { shareIsValid } from '~/utils/share'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) return { valid: false }

  const admin = useSupabaseAdmin()
  const { data: share } = await admin.from('shares').select('how_met_default, expires_at, used_at').eq('id', token).maybeSingle()
  if (!share || !shareIsValid(share, new Date())) return { valid: false }

  return { valid: true, how_met_default: share.how_met_default ?? null }
})
```

- [ ] **Step 6: Create POST `/api/share/:token`**

Create `server/api/share/[token].post.ts`:

```ts
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { shareIsValid } from '~/utils/share'
import { LADDER_PRESETS } from '~/types'
import { initialFollowUp } from '~/utils/cadence'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const body = await readBody<{ name?: string; how_met?: string; email?: string | null; phone?: string | null }>(event)
  if (!token) throw createError({ statusCode: 400, statusMessage: 'Missing share token' })

  const admin = useSupabaseAdmin()
  const { data: share } = await admin.from('shares').select('*').eq('id', token).maybeSingle()
  if (!share || !shareIsValid(share, new Date())) {
    throw createError({ statusCode: 410, statusMessage: 'This link has expired or was already used.' })
  }

  const name = (body?.name ?? '').trim()
  const howMet = (body?.how_met ?? '').trim()
  const email = (body?.email ?? '').trim() || null
  const phone = (body?.phone ?? '').trim() || null
  if (!name || !howMet) throw createError({ statusCode: 400, statusMessage: 'Name and how you met are required.' })
  if (!email && !phone) throw createError({ statusCode: 400, statusMessage: 'Add an email or phone number.' })

  const now = new Date()
  const ladder = LADDER_PRESETS.default
  const { data: contact, error: insertError } = await admin
    .from('contacts')
    .insert({
      user_id: share.user_id,
      name, how_met: howMet, email, phone,
      cadence_ladder: ladder,
      follow_up_by: initialFollowUp(now.toISOString(), ladder),
    })
    .select()
    .single()
  if (insertError) throw createError({ statusCode: 500, statusMessage: 'Could not save that. Try again.' })

  await admin.from('shares').update({ used_at: now.toISOString() }).eq('id', share.id)

  return { ok: true, name: contact.name }
})
```

> Edge case: if the contact insert succeeds but stamping `used_at` fails, the token stays usable and a second claim would duplicate the contact. Acceptable for P1; the code path is a single `update` on a row the service role owns. (Noted, not over-engineered.)

- [ ] **Step 7: Run tests + typecheck**

Run: `npx vitest run && npx nuxi typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add utils/share.ts tests/unit/share.test.ts server/api/share/[token].get.ts server/api/share/[token].post.ts
git commit -m "feat(share): public token endpoints + claim guard"
```

---

### Task 7: Add — Link + Scan pages, and the `/share/:token` capture page

**Files:**
- Install: `qrcode` (+ types)
- Create: `pages/app/add/link.vue`, `pages/app/add/scan.vue`, `pages/share/[token].vue`

**Interfaces:**
- Consumes: `auth.user`, RLS insert into `shares`, `GET /api/share/:token`, `POST /api/share/:token`.
- Produces: Add→Link creates a `shares` row and shows `/share/<id>` + QR + copy; `/share/:token` capture form.

- [ ] **Step 1: Install `qrcode`**

```bash
npm install qrcode
npm install -D @types/qrcode
```

- [ ] **Step 2: Create `pages/app/add/link.vue`**

```vue
<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Share link</h1>
    <p class="mt-1 text-sm text-muted">A link anyone can open to add their own details to your list. One-time use.</p>

    <div class="mt-6 rounded-xl border border-line bg-surface p-5">
      <label class="text-sm font-medium text-ink" for="how_met_default">How you met (optional hint)</label>
      <input id="how_met_default" v-model="howMetDefault" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none" placeholder="Met at the hallway track…">
      <button
        type="button" :disabled="creating"
        class="mt-4 rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:opacity-50"
        @click="create"
      >{{ creating ? 'Creating…' : 'Generate link' }}</button>
    </div>

    <div v-if="shareUrl" class="mt-6 rounded-xl border border-line bg-surface p-5 text-center">
      <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code for the share link" class="mx-auto h-40 w-40">
      <p class="mt-3 break-all font-mono text-xs text-muted">{{ shareUrl }}</p>
      <button type="button" class="mt-3 rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink transition-colors hover:bg-paper" @click="copy">Copy link</button>
    </div>
    <p v-if="error" class="mt-4 text-sm text-coral">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import QRCode from 'qrcode'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'
import { useSupabase } from '~/composables/useSupabase'

definePageMeta({ layout: 'app', middleware: 'app' })

const auth = useAuthStore()
const { user } = storeToRefs(auth)
const sb = useSupabase()

const howMetDefault = ref('')
const creating = ref(false)
const shareUrl = ref('')
const qrDataUrl = ref('')
const error = ref<string | null>(null)

async function create() {
  if (creating.value || !user.value) return
  creating.value = true
  error.value = null
  try {
    const id = crypto.randomUUID()
    await sb.from('shares').insert({
      id, user_id: user.value.id,
      how_met_default: howMetDefault.value.trim() || null,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const base = useRuntimeConfig().public.appUrl || window.location.origin
    shareUrl.value = `${base.replace(/\/$/, '')}/share/${id}`
    qrDataUrl.value = await QRCode.toDataURL(shareUrl.value, { width: 320 })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    creating.value = false
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
  } catch { /* clipboard blocked — the URL is visible inline */ }
}
</script>
```

- [ ] **Step 3: Create `pages/app/add/scan.vue`**

```vue
<template>
  <div class="mx-auto max-w-xl text-center">
    <h1 class="font-display text-3xl font-extrabold tracking-[-0.03em]">Scan a badge</h1>
    <p class="mt-4 text-sm text-muted">Badge and LinkedIn QR scanning is coming soon. For now, add the person by hand — it takes about ten seconds.</p>
    <NuxtLink to="/app/add/manual" class="mt-6 inline-block rounded-lg bg-coral px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-coral-press">Add by hand</NuxtLink>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'app' })
</script>
```

- [ ] **Step 4: Create `pages/share/[token].vue`** (no-nav capture)

```vue
<template>
  <div class="flex min-h-screen items-center justify-center bg-paper px-4 py-10 text-ink">
    <div class="w-full max-w-md">
      <div class="text-center">
        <BrandMark class="pointer-events-none" />
        <h1 class="font-display mt-4 text-2xl font-extrabold tracking-[-0.03em]">Let's stay in touch</h1>
        <p class="mt-1 text-sm text-muted">Add the details you're comfortable sharing — it becomes a follow-up for the person who sent this.</p>
      </div>

      <p v-if="error" class="mt-6 rounded-xl border border-line bg-surface p-5 text-sm text-coral">{{ error }}</p>
      <p v-else-if="loading" class="mt-6 rounded-xl border border-line bg-surface p-5 text-center text-sm text-muted">Checking this link…</p>
      <p v-else-if="!valid" class="mt-6 rounded-xl border border-line bg-surface p-5 text-center text-sm text-muted">This link has expired or was already used.</p>
      <p v-else-if="done" class="mt-6 rounded-xl border border-graduated bg-surface p-6 text-center">
        <span class="text-2xl">☕</span>
        <p class="font-display mt-2 text-lg font-bold">Saved — thanks, {{ doneName }}</p>
        <p class="mt-1 text-sm text-muted">They'll be prompted to follow up with you.</p>
      </p>

      <form v-else class="mt-6 space-y-4 rounded-xl border border-line bg-surface p-5" @submit.prevent="submit">
        <div>
          <label class="text-sm font-medium text-ink" for="name">Name *</label>
          <input id="name" v-model="name" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none" placeholder="Ada Lovelace">
        </div>
        <div>
          <label class="text-sm font-medium text-ink" for="how_met">How you met *</label>
          <textarea id="how_met" v-model="howMet" rows="2" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none" :placeholder="howMetDefault || 'Where did you run into each other?'" />
        </div>
        <div class="flex flex-col gap-3 sm:flex-row">
          <div class="flex-1">
            <label class="text-sm font-medium text-ink" for="email">Email</label>
            <input id="email" v-model="email" type="email" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none">
          </div>
          <div class="flex-1">
            <label class="text-sm font-medium text-ink" for="phone">Phone</label>
            <input id="phone" v-model="phone" type="tel" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none" placeholder="+1 555 000 0000">
          </div>
        </div>
        <p v-if="!hasChannel" class="text-sm text-coral">Add an email or a phone number.</p>
        <button
          type="submit" :disabled="submitting || !valid"
          class="w-full rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:cursor-not-allowed disabled:opacity-50"
        >{{ submitting ? 'Saving…' : 'Save it' }}</button>
      </form>

      <p v-else class="mt-6 rounded-xl border border-line bg-surface p-5 text-center text-sm text-muted">Checking this link…</p>

      <div v-if="done" class="mt-6 rounded-xl border border-graduated bg-surface p-6 text-center">
        <p class="text-2xl">☕</p>
        <p class="font-display mt-2 text-lg font-bold">Saved — thanks, {{ doneName }}</p>
        <p class="mt-1 text-sm text-muted">They'll be prompted to follow up with you.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const token = String(route.params.token)

const valid = ref(false)
const loading = ref(true)
const howMetDefault = ref('')
const name = ref('')
const howMet = ref('')
const email = ref('')
const phone = ref('')
const submitting = ref(false)
const submittedError = ref('')
const done = ref(false)
const doneName = ref('')

const hasChannel = computed(() => Boolean(email.value.trim() || phone.value.trim()))
const validForm = computed(() => Boolean(name.value.trim() && howMet.value.trim()) && hasChannel.value)
const error = computed(() => submittedError.value)

onMounted(async () => {
  try {
    const data = await $fetch<{ valid: boolean; how_met_default?: string | null }>(`/api/share/${token}`)
    valid.value = data.valid
    howMetDefault.value = data.how_met_default ?? ''
  } catch {
    valid.value = false
  } finally {
    loading.value = false
  }
})

async function submit() {
  if (submitting.value || !validForm.value) return
  submitting.value = true
  submittedError.value = ''
  try {
    const data = await $fetch<{ ok: boolean; name: string }>(`/api/share/${token}`, {
      method: 'POST',
      body: { name: name.value.trim(), how_met: howMet.value.trim(), email: email.value.trim() || null, phone: phone.value.trim() || null },
    })
    done.value = true
    doneName.value = data.name
  } catch (e: any) {
    submittedError.value = e?.data?.statusMessage ?? 'Could not save that just now.'
  } finally {
    submitting.value = false
  }
}
</script>
```

> `definePageMeta({ layout: false })` renders full-screen without the default marketing nav — matches the spec's "bare" capture.

- [ ] **Step 5: Typecheck + lint**

Run: `npx nuxi typecheck && npm run lint`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add pages/app/add/link.vue pages/app/add/scan.vue pages/share/[token].vue package.json package-lock.json
git commit -m "feat(share): link/scan add pages + public capture page"
```

---

### Task 8: Public pages — pricing, early access, legal, about, 404

**Files:**
- Create: `pages/pricing.vue`, `pages/early-access.vue`, `pages/privacy.vue`, `pages/terms.vue`, `pages/about.vue`, `error.vue` (project root)
- Modify: `pages/index.vue` (rename anchors `#how`→`#how-it-works`, `#coffees`→`#three-coffees`; footer links)

**Interfaces:**
- Consumes: `layouts/default.vue` (public nav), `WaitlistForm.vue`.
- Produces: all public routes render; anchor ids match the sitemap.

- [ ] **Step 1: Rename landing anchors**

In `pages/index.vue`: `id="how"` → `id="how-it-works"`, `id="coffees"` → `id="three-coffees"`. Update the three `scrollToId('how')` calls to `'how-it-works'` (there are two: hero button + footer button). `#features` and `#get` stay.

- [ ] **Step 2: Create `pages/pricing.vue`** (all-free, Pro coming-soon)

```vue
<template>
  <div class="mx-auto max-w-3xl px-6 py-16">
    <p class="font-mono mb-3 text-xs uppercase tracking-[0.12em] text-coral">Pricing</p>
    <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">Free while we're in the hallway.</h1>
    <p class="mt-3 max-w-xl text-ink-2">Lanyard is in early access — the first 100 people get it free, forever. A paid Pro tier is coming later; early users stay on the free plan.</p>

    <div class="mt-10 rounded-3xl border border-line bg-surface p-8">
      <div class="flex items-baseline justify-between">
        <h2 class="font-display text-2xl font-bold">Free</h2>
        <span class="font-display text-3xl font-extrabold">$0</span>
      </div>
      <ul class="mt-6 space-y-3 text-sm text-ink-2">
        <li>✓ Unlimited contacts</li>
        <li>✓ The three-coffee cadence on any schedule</li>
        <li>✓ Email nudges, plus SMS when you opt in</li>
        <li>✓ Share-links so the other person adds their details</li>
      </ul>
    </div>

    <div class="mt-6 rounded-3xl border border-dashed border-line p-8 text-center">
      <p class="font-mono text-xs uppercase tracking-[0.12em] text-muted">Pro</p>
      <p class="mt-2 text-sm text-muted">Coming soon — early-access users will get it at launch pricing.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
```

- [ ] **Step 3: Create `pages/early-access.vue`**

```vue
<template>
  <div class="mx-auto max-w-xl px-6 py-16 text-center">
    <p class="font-mono text-xs uppercase tracking-[0.12em] text-coral">Early access</p>
    <h1 class="font-display mt-3 text-4xl font-extrabold tracking-[-0.03em]">Get in before it's cold.</h1>
    <p class="mt-3 text-ink-2">Leave your email and I'll tell you the moment it's ready to try at your next conference.</p>
    <div class="mt-8"><WaitlistForm /></div>
    <p class="mt-6 text-xs text-muted"><NuxtLink to="/pricing" class="hover:text-coral">Pricing</NuxtLink> · <NuxtLink to="/privacy" class="hover:text-coral">Privacy</NuxtLink> · <NuxtLink to="/terms" class="hover:text-coral">Terms</NuxtLink></p>
  </div>
</template>

<script setup lang="ts">
</script>
```

- [ ] **Step 4: Create `pages/privacy.vue`**

```vue
<template>
  <div class="mx-auto max-w-2xl px-6 py-16">
    <p class="font-mono mb-3 text-xs uppercase tracking-[0.12em] text-coral">Privacy</p>
    <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">Privacy policy</h1>
    <div class="prose-ink mt-8 space-y-6 text-sm leading-relaxed text-ink-2">
      <p><strong>Draft for review.</strong> TL;DR: Lanyard stores what you give it to run the follow-up loop, never sells it, and stops messaging you on request.</p>
      <section>
        <h2 class="font-display text-lg font-bold text-ink">What we store</h2>
        <p>Account details, contacts you add (names, how you met, reachable channels), and nudge delivery records (when a reminder was sent, opened, and acted on). Shared links store only what the person who opens them chooses to enter.</p>
      </section>
      <section>
        <h2 class="font-display text-lg font-bold text-ink">Why we store it</h2>
        <p>To remember you and nudge you on the channel you chose. Delivery records measure the one metric that matters — latency from nudge to action — so we can judge whether the product works.</p>
      </section>
      <section>
        <h2 class="font-display text-lg font-bold text-ink">SMS consent</h2>
        <p>We only text you after you explicitly opt in. Reply STOP to opt out, HELP for help. Message &amp; data rates may apply.</p>
      </section>
      <section>
        <h2 class="font-display text-lg font-bold text-ink">Your rights</h2>
        <p>You can export or delete your data at any time from Settings. Contact us and we'll comply promptly.</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
```

- [ ] **Step 5: Create `pages/terms.vue`**

```vue
<template>
  <div class="mx-auto max-w-2xl px-6 py-16">
    <p class="font-mono mb-3 text-xs uppercase tracking-[0.12em] text-coral">Terms</p>
    <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">Terms & SMS consent</h1>
    <div class="mt-8 space-y-6 text-sm leading-relaxed text-ink-2">
      <p><strong>Draft for review.</strong></p>
      <section>
        <h2 class="font-display text-lg font-bold text-ink">What Lanyard does</h2>
        <p>Lanyard reminds you to follow up with people you met. It never sends a follow-up message on your behalf — you always send it yourself.</p>
      </section>
      <section>
        <h2 class="font-display text-lg font-bold text-ink">SMS messaging terms</h2>
        <p>By providing your phone number and opting in, you consent to receive automated text messages from Lanyard at that number for the purpose of follow-up reminders. Message &amp; data rates may apply. Message frequency varies (at most one per day). Reply STOP to opt out, HELP for help.</p>
      </section>
      <section>
        <h2 class="font-display text-lg font-bold text-ink">Your data</h2>
        <p>You control the contacts you store. Deleting your account deletes them. We don't sell data.</p>
      </section>
      <section>
        <h2 class="font-display text-lg font-bold text-ink">As-is</h2>
        <p>The service is provided as-is during early access, without warranty.</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
```

- [ ] **Step 6: Create `pages/about.vue`** (stub)

```vue
<template>
  <div class="mx-auto max-w-2xl px-6 py-16">
    <p class="font-mono mb-3 text-xs uppercase tracking-[0.12em] text-coral">About</p>
    <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">Built in public.</h1>
    <p class="mt-4 text-ink-2">Lanyard is a conference follow-up nudger, built in public. The idea: trust is built through sustained engagement — three touchpoints, then a connection graduates.</p>
  </div>
</template>

<script setup lang="ts">
</script>
```

- [ ] **Step 7: Create the project-root `error.vue`**

```vue
<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center text-ink">
    <p class="font-mono text-xs uppercase tracking-[0.12em] text-coral">{{ error?.statusCode || 404 }}</p>
    <h1 class="font-display mt-3 text-3xl font-extrabold tracking-[-0.03em]">Page not found.</h1>
    <p class="mt-2 text-sm text-muted">That link doesn't lead anywhere.</p>
    <div class="mt-6 flex gap-3">
      <NuxtLink to="/" class="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-paper">Back home</NuxtLink>
      <NuxtLink to="/login" class="rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-press">Log in</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ error: Partial<{ statusCode: number }> | null }>()
</script>
```

> `error.vue` must be at project root (next to `app.vue`), not under `pages/`. Resources are already preconnected (fonts/theme bootstrap) via `app.head`, and this page may render before plugins, so keep it self-contained. Verify it renders a 404 for unknown routes.

- [ ] **Step 8: Add footer links on the landing page for legal pages**

In `pages/index.vue` footer, extend the footer nav with `/privacy`, `/terms`, `/pricing`, `/about` links (muted small text).

- [ ] **Step 9: Typecheck + lint**

Run: `npx nuxi typecheck && npm run lint`
Expected: passes.

- [ ] **Step 10: Commit**

```bash
git add pages/pricing.vue pages/early-access.vue pages/privacy.vue pages/terms.vue pages/about.vue error.vue pages/index.vue
git commit -m "feat(public): pricing, early access, legal, about, 404"
```

---

### Task 9: Landing nav + full verification sweep

**Files:**
- Modify: `pages/index.vue` (hero nav / signed-in awareness already handled by layout; confirm CTA targets)
- Verify: all routes, guards, tests, typecheck.

**Interfaces:**
- Consumes: everything from Tasks 1-8.

- [ ] **Step 1: Confirm the landing hero CTA paths**

`pages/index.vue` "Get early access" button currently does `scrollToId('get')`. Add a primary CTA that routes signed-out users to `/early-access` (or keeps anchor). Decide: keep the anchor (it scrolls to the inline waitlist form) — no change needed. Verified in review.

- [ ] **Step 2: Add a filter on `/app` (`?filter=graduated`)**

`pages/app/index.vue` currently renders both Active and Graduated. Add a toggle honoring the query param:

```ts
const route = useRoute()
const showGraduated = computed(() => route.query.filter === 'graduated')
```

Render the "Active" section only when `!showGraduated`, and the "Graduated" section only when `showGraduated`. Add two links (`/app` and `/app?filter=graduated`) styled as a small tab row. If you prefer, set as a detail — the essential contract is: default shows due triage, `?filter=graduated` shows graduated.

- [ ] **Step 3: Full test + typecheck + lint**

```bash
npx vitest run
npx nuxi typecheck
npm run lint
```

Expected: all green.

- [ ] **Step 4: Manual smoke run**

```bash
npm run dev
```

Verify (signed-out): `/` loads with new anchor ids; `/pricing`, `/early-access`, `/privacy`, `/terms`, `/about` render with the public nav; an unknown URL → the root `error.vue`; `/contacts` 301s to `/app` (bounced to `/login?redirect=/app`); `/share/bad-token` shows the dead-link state, `/act/bad-token` returns 401.
Verify (signed-in, a seeded account): `/login` → magic link → lands on `/app` (or `/app/onboarding` when `onboarded_at` unset); forms save and return to `/app`; `/app/c/:id` loads any contact; Add → Link generates a URL, copy works; opening the generated `/share/<id>` in a fresh (incognito) tab saves a contact into the sharer's list and the second open shows the dead-link state; `/app/settings` shows appearance + account; bottom tab bar visible below `md`.

- [ ] **Step 5: Commit**

```bash
git add pages/app/index.vue
git commit -m "feat(app): graduated filter + landing verification sweep"
```

---

## Self-review notes

- **Spec coverage:** all routes in the spec map to Tasks 1-9 (public: 8; app/about: 8; share capture: 6-7; act: 2; guards/redirects: 3-4; onboarding: 3, 5; error page: 8; `onboarded_at` + `shares` schema: 1; 301s: 4; stats kept: 4; responsive shell: 4; legal drafts: 8; tests: 2, 3, 6).
- **`definePageMeta({ layout: false })`** on `/share/:token` matches spec ("bare full-screen").
- **Type names:** `Share`, `InsertShare`, `UpdateShare`, `Profile.onboarded_at`, `isOnboarded`, `shareIsValid` are consistent across tasks.
- **Gotcha:** the `nuxt.config.ts` `routeRules` for `/contacts` etc. apply only at request time (hard URLs); the app redirects already covered by `navigateTo('/app')` changes in Task 4 · Step 4.