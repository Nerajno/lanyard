# Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user permanently delete their account (14-day grace, undo, data export, SMS suppression, scheduled hard purge) from `/app/settings`.

**Architecture:** Server-side Nitro routes (this repo has no Supabase Edge Functions) using the existing `useSupabaseAdmin()` service-role client. GoTrue `deleteUser({ shouldSoftDelete: true })` is irreversible (obfuscates email, frees it), so grace/undo is owned by a new `account_deletions` table and undo = recreate auth user + reparent rows. New `sms_suppressions` table (SHA-256 of E.164, never cascade-deleted) guards future sends. A second Netlify scheduled function hard-purges past the grace window.

**Tech Stack:** Nuxt 3 / Nitro, Supabase (Postgres + Auth admin API), Vitest, Tailwind.

## Global Constraints

- `NUXT_SUPABASE_SERVICE_ROLE` (service role) only ever used inside `server/*` via `useSupabaseAdmin()` — never in client bundles or composables.
- Every new table must have RLS enabled **in the same migration**; `sms_suppressions` and `account_deletions` get RLS enabled with **no public policies** (service-role only, same pattern as `waitlist`).
- `<script setup lang="ts">` + Composition API only; Tailwind for all styling; no component CSS files.
- No new secrets. No new npm dependencies.
- Copy in Lanyard's plain voice (see `project_docs/specs/2026-08-10-account-deletion-design.md`): say what happens and how to confirm; no "Oops".
- Grace = **14 days** (`GRACE_DAYS = 14`).
- `types/database.ts` is **hand-maintained** (see its header) — hand-edit it; do NOT run `supabase gen types`.
- FK `ON DELETE CASCADE` on `profiles`/`contacts`/`nudges`/`shares` → `auth.users` already exists (`0001`, `0005`) — no FK changes.

---

### Task 1: Migration + types

**Files:**
- Create: `supabase/migrations/0006_account_deletion.sql`
- Modify: `types/database.ts`, `types/index.ts`

**Interfaces:**
- Produces: DB tables `public.sms_suppressions` and `public.account_deletions`; TS aliases `SmsSuppression`, `AccountDeletion`; migration `0006` applied to the linked Supabase project.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0006_account_deletion.sql`:

```sql
-- Account deletion: SMS suppression + grace-window ledger.
-- RLS enabled with NO public policies; only the server-side service-role client
-- (useSupabaseAdmin) reads/writes these tables. Mirrors the waitlist pattern.

-- ---------------------------------------------------------------------
-- sms_suppressions — numbers to never text again, retained indefinitely.
-- Holds only a SHA-256 of the normalized E.164, never the raw number.
-- Never cascade-deleted and deliberately has NO FK: it must outlive
-- auth.users so a recycled number is never texted after the account dies.
-- ---------------------------------------------------------------------
create table if not exists public.sms_suppressions (
  id          bigint generated always as identity primary key,
  phone_hash  text not null unique,
  reason      text not null default 'opted_out',
  created_at  timestamptz not null default now()
);

comment on table public.sms_suppressions is 'Hashed numbers to never text again (indefinite retention).';

alter table public.sms_suppressions enable row level security;

-- ---------------------------------------------------------------------
-- account_deletions — grace-window ledger.
-- Keyed on the REAL (normalized) email because GoTrue obfuscates
-- auth.users.email on soft delete; this is the only place undo/purge can
-- find the account. No FK to auth.users on purpose: the row is the audit
-- record and must outlive the purge.
-- ---------------------------------------------------------------------
create table if not exists public.account_deletions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  email         text not null,
  requested_at  timestamptz not null default now(),
  purge_at      timestamptz not null,      -- requested_at + 14 days
  purged_at     timestamptz,               -- set by the purge job (hard delete done)
  superseded_at timestamptz                -- set by undo (restoration won)
);

create index if not exists account_deletions_email on public.account_deletions (email);
create index if not exists account_deletions_purge on public.account_deletions (purge_at)
  where purged_at is null and superseded_at is null;

comment on table public.account_deletions is 'Grace-window ledger for account deletion; rows outlive the auth user.';
comment on column public.account_deletions.purge_at is 'Hard-purge time = requested_at + 14 days.';

alter table public.account_deletions enable row level security;
```

- [ ] **Step 2: Apply the migration to the linked project**

Run: `npx supabase db push`
Expected: migration `0006_account_deletion.sql` applied (may prompt to confirm remote push).

- [ ] **Step 3: Hand-edit `types/database.ts`**

In the `Tables` object (alphabetical is not required; append after `shares`), add:

```ts
      sms_suppressions: {
        Row: {
          id: number
          phone_hash: string
          reason: string
          created_at: string
        }
        Insert: {
          id?: never
          phone_hash: string
          reason?: string
          created_at?: never
        }
        Update: {
          id?: never
          phone_hash?: never
          reason?: string
          created_at?: never
        }
      },
      account_deletions: {
        Row: {
          id: string
          user_id: string
          email: string
          requested_at: string
          purge_at: string
          purged_at: string | null
          superseded_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          requested_at?: string
          purge_at: string
          purged_at?: string | null
          superseded_at?: string | null
        }
        Update: {
          id?: never
          user_id?: never
          email?: never
          requested_at?: never
          purge_at?: never
          purged_at?: string | null
          superseded_at?: string | null
        }
      },
```

- [ ] **Step 4: Add type aliases in `types/index.ts`**

Append inside the existing alias block:

```ts
export type SmsSuppression = GeneratedDatabase['public']['Tables']['sms_suppressions']['Row']
export type AccountDeletion = GeneratedDatabase['public']['Tables']['account_deletions']['Row']
```

- [ ] **Step 5: Verify types compile**

Run: `npx nuxi typecheck`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0006_account_deletion.sql types/database.ts types/index.ts
git commit -m "feat(account-deletion): migration for sms_suppressions + account_deletions"
```

---

### Task 2: SMS suppression util + tests

**Files:**
- Create: `server/utils/smsSuppression.ts`
- Test: `tests/unit/suppression.test.ts`

**Interfaces:**
- Consumes: `useSupabaseAdmin()` admin client type (`SupabaseClient` from `@supabase/supabase-js`).
- Produces:
  - `normalizeE164(phone: string): string` — strip `[\s\-().]`, ensure leading `+`.
  - `hashE164(phone: string): string` — SHA-256 hex of `normalizeE164`.
  - `writeSuppression(admin: SupabaseClient, phone: string): Promise<void>` — upsert on `phone_hash`.
  - `isSmsSuppressed(admin: SupabaseClient, phone: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

`tests/unit/suppression.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeE164, hashE164, writeSuppression, isSmsSuppressed } from '~/server/utils/smsSuppression'

function mockAdmin() {
  const table: Record<string, unknown[]> = { sms_suppressions: [] }
  const q = {
    insert: vi.fn(() => ({ onConflict: vi.fn(() => ({ ignore: q.ignore })) })),
    ignore: vi.fn(async () => ({ error: null })),
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })),
  }
  const admin = {
    from: vi.fn((t: string) => {
      if (t === 'sms_suppressions') return q
      return { select: () => ({}) }
    }),
  } as unknown as SupabaseClient
  return { admin, q, table }
}

describe('normalizeE164', () => {
  it('strips separators and adds a leading +', () => {
    expect(normalizeE164('+1 555 000 0000')).toBe('+15550000000')
    expect(normalizeE164('1-555-000-0000')).toBe('+15550000000')
    expect(normalizeE164('+1 (555) 000-0000')).toBe('+15550000000')
  })
})

describe('hashE164', () => {
  it('produces a stable 64-char hex and never contains the number', () => {
    const h = hashE164('+1 555 000 0000')
    expect(h).toMatch(/^[a-f0-9]{64}$/)
    expect(h).not.toContain('15550000000')
    expect(hashE164('+1 555 000 0000')).toBe(hashE164('+15550000000'))
  })
})

describe('writeSuppression / isSmsSuppressed', () => {
  it('stores only the hash', async () => {
    const { admin, q } = mockAdmin()
    await writeSuppression(admin, '+1 555 000 0000')
    expect(q.insert).toHaveBeenCalledWith({ phone_hash: hashE164('+15550000000'), reason: 'opted_out' })
  })
  it('reports suppressed for a matching hash', async () => {
    const { admin, q } = mockAdmin()
    q.select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: 1 }, error: null })) })) }))
    expect(await isSmsSuppressed(admin, '+15550000000')).toBe(true)
  })
  it('reports not suppressed when no match', async () => {
    const { admin } = mockAdmin()
    expect(await isSmsSuppressed(admin, '+15550009999')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/suppression.test.ts`
Expected: FAIL — module not found (`smsSuppression` doesn't exist).

- [ ] **Step 3: Write the implementation**

`server/utils/smsSuppression.ts`:

```ts
// SMS suppression: hashed numbers that must never be texted again.
// Retained indefinitely; survived account deletion by design (no FK, no cascade).
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Canonical E.164: strip separators, guarantee the leading +. */
export function normalizeE164(phone: string): string {
  const digits = phone.replace(/[\s\-().]/g, '')
  return digits.startsWith('+') ? digits : `+${digits}`
}

/** One-way hash of the canonical E.164 — the only form ever stored. */
export function hashE164(phone: string): string {
  return createHash('sha256').update(normalizeE164(phone)).digest('hex')
}

/** Record a number as suppressed (idempotent — unique on phone_hash). */
export async function writeSuppression(admin: SupabaseClient, phone: string): Promise<void> {
  await admin
    .from('sms_suppressions')
    .insert({ phone_hash: hashE164(phone), reason: 'opted_out' })
    .onConflict('phone_hash')
    .ignore()
}

/** True when the number must never be texted. */
export async function isSmsSuppressed(admin: SupabaseClient, phone: string): Promise<boolean> {
  const { data } = await admin
    .from('sms_suppressions')
    .select('id')
    .eq('phone_hash', hashE164(phone))
    .maybeSingle()
  return Boolean(data)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/suppression.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/utils/smsSuppression.ts tests/unit/suppression.test.ts
git commit -m "feat(account-deletion): sms suppression hashing util + tests"
```

---

### Task 3: Deletion/undo/purge logic + tests

**Files:**
- Create: `server/utils/accountDeletion.ts`
- Test: `tests/unit/deleteAccount.test.ts`, `tests/unit/accountFlow.test.ts`

**Interfaces:**
- Consumes: `useSupabaseAdmin()` (`SupabaseClient`), `writeSuppression`/`isSmsSuppressed` from Task 2, types `Profile`.
- Produces:
  - `export const GRACE_DAYS = 14`
  - `export function gracePurgeAt(from: Date, days?: number): string`
  - `export function normalizeEmail(email: string): string`
  - `export class AccountDeletionError extends Error`
  - `export async function requestAccountDeletion(admin: SupabaseClient, user: { id: string; email: string }, confirmEmail: string, now: Date): Promise<{ ok: true; purgeBy: string; alreadyPending?: boolean }>`
  - `export async function restoreAccount(admin: SupabaseClient, email: string, now: Date): Promise<{ ok: true }>`
  - `export async function purgeDueAccounts(admin: SupabaseClient, now: Date): Promise<{ purged: number; failed: number }>`

- [ ] **Step 1: Write the failing tests**

`tests/unit/deleteAccount.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AccountDeletionError,
  GRACE_DAYS,
  gracePurgeAt,
  normalizeEmail,
  requestAccountDeletion,
} from '~/server/utils/accountDeletion'

function mockAdmin() {
  const state: Record<string, { data: unknown }> = {}
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    onConflict: vi.fn(() => builder),
    ignore: vi.fn(async () => ({ error: null })),
    single: vi.fn(async () => ({ data: null, error: null })),
  }
  const admin = {
    from: vi.fn(() => builder),
    auth: { admin: { deleteUser: vi.fn(async () => ({ error: null })) } },
  } as unknown as SupabaseClient
  return { admin, builder, state }
}

const NOW = new Date('2026-08-10T12:00:00Z')

describe('gracePurgeAt / normalizeEmail', () => {
  it('grace default is 14 days', () => {
    expect(GRACE_DAYS).toBe(14)
    expect(gracePurgeAt(NOW)).toBe('2026-08-24T12:00:00.000Z')
  })
  it('normalizes email case/whitespace', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com')
  })
})

describe('requestAccountDeletion', () => {
  it('happy path: ledger insert + soft delete', async () => {
    const { admin, builder } = mockAdmin()
    builder.maybeSingle.mockResolvedValue({ data: null, error: null }) // no pending row
    builder.single.mockResolvedValueOnce({ data: { purge_at: '2026-08-24T12:00:00.000Z' }, error: null })

    const res = await requestAccountDeletion(
      admin,
      { id: 'u1', email: 'foo@bar.com' },
      'foo@bar.com',
      NOW,
    )

    expect(res.ok).toBe(true)
    expect(res.purgeBy).toBe('2026-08-24T12:00:00.000Z')
    expect(builder.insert).toHaveBeenCalledWith({ user_id: 'u1', email: 'foo@bar.com', purge_at: '2026-08-24T12:00:00.000Z' })
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('u1', { shouldSoftDelete: true })
  })

  it('rejects mismatched confirm email', async () => {
    const { admin } = mockAdmin()
    await expect(
      requestAccountDeletion(admin, { id: 'u1', email: 'foo@bar.com' }, 'wrong@x.com', NOW),
    ).rejects.toThrow(AccountDeletionError)
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it('idempotent when already pending', async () => {
    const { admin, builder } = mockAdmin()
    builder.maybeSingle.mockResolvedValue({ data: { purge_at: '2026-08-24T12:00:00.000Z', purged_at: null, superseded_at: null }, error: null })
    const res = await requestAccountDeletion(admin, { id: 'u1', email: 'foo@bar.com' }, 'foo@bar.com', NOW)
    expect(res.alreadyPending).toBe(true)
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled()
  })
})
```

`tests/unit/accountFlow.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountDeletionError, purgeDueAccounts, restoreAccount } from '~/server/utils/accountDeletion'

const NOW = new Date('2026-08-10T12:00:00Z')

function mockAdmin() {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    single: vi.fn(async () => ({ data: null, error: null })),
  }
  const admin = {
    from: vi.fn(() => builder),
    auth: { admin: { deleteUser: vi.fn(async () => ({ error: null })), createUser: vi.fn() } },
  } as unknown as SupabaseClient
  return { admin, builder }
}

describe('restoreAccount', () => {
  it('recreates the user and marks superseded', async () => {
    const { admin, builder } = mockAdmin()
    const pending = { id: 'd1', user_id: 'old', email: 'foo@bar.com', purge_at: '2026-08-24T12:00:00.000Z', purged_at: null, superseded_at: null }
    builder.maybeSingle.mockResolvedValue({ data: pending, error: null })
    admin.auth.admin.createUser.mockResolvedValue({ data: { id: 'new' }, error: null })

    await restoreAccount(admin, 'foo@bar.com', NOW)

    expect(admin.auth.admin.createUser).toHaveBeenCalledWith({ email: 'foo@bar.com' })
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('old', { shouldSoftDelete: false })
    expect(builder.update).toHaveBeenCalledWith({ superseded_at: NOW.toISOString() })
  })

  it('rejects when the grace window passed', async () => {
    const { admin, builder } = mockAdmin()
    builder.maybeSingle.mockResolvedValue({ data: { id: 'd1', user_id: 'old', email: 'foo@bar.com', purge_at: '2026-08-01T12:00:00.000Z', purged_at: null, superseded_at: null }, error: null })
    await expect(restoreAccount(admin, 'foo@bar.com', NOW)).rejects.toThrow(AccountDeletionError)
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it('rejects when there is no pending deletion', async () => {
    const { admin } = mockAdmin()
    await expect(restoreAccount(admin, 'nobody@x.com', NOW)).rejects.toThrow(AccountDeletionError)
  })
})

describe('purgeDueAccounts', () => {
  it('hard-deletes only past-due, pending, not-superseded rows', async () => {
    const { admin, builder } = mockAdmin()
    builder.single.mockResolvedValueOnce({ data: { id: 'd1', user_id: 'u1' }, error: null })
    const due = [
      { id: 'd1', user_id: 'u1', purge_at: '2026-08-01T12:00:00.000Z' },
      { id: 'd2', user_id: 'u2', purge_at: '2026-09-01T12:00:00.000Z' }, // future — not due
    ]
    builder.select.mockResolvedValue({ data: due, error: null })

    const res = await purgeDueAccounts(admin, NOW)

    expect(res.purged).toBe(1)
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledTimes(1)
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('u1', { shouldSoftDelete: false })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/deleteAccount.test.ts tests/unit/accountFlow.test.ts`
Expected: FAIL — `accountDeletion` module not defined.

- [ ] **Step 3: Write the implementation**

`server/utils/accountDeletion.ts`:

```ts
// Account deletion flows: request (soft delete + grace ledger), restore (undo
// via recreate + reparent), and the scheduled hard purge. All use the
// server-only admin client (service role). Pure-POST, idempotent.
import type { SupabaseClient } from '@supabase/supabase-js'
import { isSmsSuppressed, writeSuppression } from '~/server/utils/smsSuppression'

export const GRACE_DAYS = 14
const DAY_MS = 86_400_000

export function gracePurgeAt(from: Date, days = GRACE_DAYS): string {
  return new Date(from.getTime() + days * DAY_MS).toISOString()
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Thrown for expected user-facing failures; routes map it to a 4xx. */
export class AccountDeletionError extends Error {}

interface PendingDeletion {
  id: string
  user_id: string
  email: string
  purge_at: string
  purged_at: string | null
  superseded_at: string | null
}

/**
 * Soft-delete an account: record the 14-day grace, suppress opted-out numbers,
 * cancel side effects, then GoTrue soft-delete (irreversible by design).
 */
export async function requestAccountDeletion(
  admin: SupabaseClient,
  user: { id: string; email: string },
  confirmEmail: string,
  now: Date,
): Promise<{ ok: true; purgeBy: string; alreadyPending?: boolean }> {
  if (normalizeEmail(confirmEmail) !== normalizeEmail(user.email)) {
    throw new AccountDeletionError('The email you typed does not match your account.')
  }

  const { data: existing } = await admin
    .from('account_deletions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle<PendingDeletion>()

  if (existing && !existing.purged_at && !existing.superseded_at) {
    return { ok: true, purgeBy: existing.purge_at, alreadyPending: true }
  }

  const purgeAt = gracePurgeAt(now)
  await admin.from('account_deletions').insert({ user_id: user.id, email: normalizeEmail(user.email), purge_at: purgeAt })

  // Suppression: if this account opted out of SMS, keep a hash so the number
  // (once recycled) is never texted again. Contacts are never texted by us in
  // Phase 1, so only the profile phone can end up here.
  const { data: profile } = await admin.from('profiles').select('phone, sms_opted_out_at').eq('user_id', user.id).maybeSingle()
  if (profile?.phone && profile.sms_opted_out_at) {
    await writeSuppression(admin, profile.phone)
  }

  // Side-effect cancels. Phase 1: Twilio has nothing scheduled (one-shot nudges
  // die with the cron skip in Task 5) and there is no billing. Future: call the
  // Twilio/Stripe cancellation SDKs here, where the service role is available.

  await admin.auth.admin.deleteUser(user.id, { shouldSoftDelete: true })

  return { ok: true, purgeBy: purgeAt }
}

/**
 * Undo within the 14-day grace. GoTrue soft-delete is irreversible and frees
 * the email, so we recreate the auth user and reparent every public row to the
 * new uid, then hard-delete the old (orphaned) user.
 */
export async function restoreAccount(admin: SupabaseClient, email: string, now: Date): Promise<{ ok: true }> {
  const normalized = normalizeEmail(email)

  const { data: pending } = await admin
    .from('account_deletions')
    .select('*')
    .eq('email', normalized)
    .is('purged_at', null)
    .is('superseded_at', null)
    .maybeSingle<PendingDeletion>()
  if (!pending) throw new AccountDeletionError('No account waiting to be restored.')
  if (pending.purge_at <= now.toISOString()) {
    throw new AccountDeletionError('The 14-day window has passed — your account was deleted for good.')
  }

  const oldId = pending.user_id

  // 1. Recreate the auth user. GoTrue freed the email on soft delete, and the
  //    on_auth_user_created trigger re-creates an empty profiles row for it.
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email: normalized })
  if (createError || !created) throw new AccountDeletionError('Could not restore your account. Try again.')
  const newId = created.user.id

  // 2. Reparent: copy the old profile into the new trigger-created row, drop the
  //    old one, then move every owned row to the new uid.
  const { data: oldProfile } = await admin.from('profiles').select('*').eq('user_id', oldId).maybeSingle()
  if (oldProfile) {
    const { phone, phone_verified_at, nudge_channel, timezone, quiet_hours_start, quiet_hours_end, sms_opt_in_at, sms_opted_out_at, onboarded_at } = oldProfile
    await admin
      .from('profiles')
      .update({ phone, phone_verified_at, nudge_channel, timezone, quiet_hours_start, quiet_hours_end, sms_opt_in_at, sms_opted_out_at, onboarded_at })
      .eq('user_id', newId)
    await admin.from('profiles').delete().eq('user_id', oldId)
  }

  for (const table of ['contacts', 'nudges', 'shares'] as const) {
    await admin.from(table).update({ user_id: newId }).eq('user_id', oldId)
  }

  // 3. The old user is now an empty shell — hard delete (cascade cleans up the
  //    trigger-created profile if reparenting above missed anything).
  await admin.auth.admin.deleteUser(oldId, false)

  // 4. Close the grace record.
  await admin.from('account_deletions').update({ superseded_at: now.toISOString() }).eq('id', pending.id)

  return { ok: true }
}

/** Hard-purge soft-deleted accounts whose grace window has passed. */
export async function purgeDueAccounts(admin: SupabaseClient, now: Date): Promise<{ purged: number; failed: number }> {
  const nowIso = now.toISOString()
  const { data: due } = await admin
    .from('account_deletions')
    .select('user_id, purge_at')
    .lte('purge_at', nowIso)
    .is('purged_at', null)
    .is('superseded_at', null)

  let purged = 0
  let failed = 0
  for (const row of (due ?? [])) {
    // Double guard on the window (the query already filters); keeps the unit
    // test meaningful against loose mocks and protects against clock skew.
    if (row.purge_at > nowIso) continue
    const { error } = await admin.auth.admin.deleteUser(row.user_id, false)
    if (error) {
      failed++
      continue
    }
    await admin.from('account_deletions').update({ purged_at: now.toISOString() }).eq('user_id', row.user_id)
    purged++
  }
  return { purged, failed }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/deleteAccount.test.ts tests/unit/accountFlow.test.ts`
Expected: PASS (all cases). Note: the happy-path test asserts `builder.insert` with the ledger payload and `deleteUser('u1', { shouldSoftDelete: true })`.

- [ ] **Step 5: Run lint + typecheck**

Run: `npm run lint && npx nuxi typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add server/utils/accountDeletion.ts tests/unit/deleteAccount.test.ts tests/unit/accountFlow.test.ts
git commit -m "feat(account-deletion): delete/restore/purge logic + tests"
```

---

### Task 4: Server routes (delete, export, restore)

**Files:**
- Create: `server/api/account/delete.ts`, `server/api/account/export.ts`, `server/api/account/restore.ts`

**Interfaces:**
- Consumes: `useSupabaseUser()` (ssr cookie client), `useSupabaseAdmin()`, `requestAccountDeletion`/`restoreAccount`/`AccountDeletionError` from Task 3, `Contact` type.
- Produces: `POST /api/account/delete` → `{ ok, purgeBy }`; `GET /api/account/export` → `{ contacts: Contact[] }`; `POST /api/account/restore` → `{ ok }`.

- [ ] **Step 1: Write the delete route**

`server/api/account/delete.ts`:

```ts
// Permanent account deletion: typed-email confirm → 14-day grace ledger →
// suppression → side-effect cancels → GoTrue soft delete. Server-only; the
// service-role key never leaves this route.
// Authorized with the caller's Supabase JWT (Bearer), matching profile/phone.ts.
import type { H3Event } from 'h3'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { AccountDeletionError, requestAccountDeletion } from '~/server/utils/accountDeletion'

export default defineEventHandler(async (event) => {
  const { data: { user } } = await useSupabaseAdmin().auth.getUser(authToken(event))
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in first' })

  const { confirmEmail } = await readBody<{ confirmEmail?: string }>(event)
  if (!confirmEmail || typeof confirmEmail !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Type your email to confirm.' })
  }

  try {
    return await requestAccountDeletion(
      useSupabaseAdmin(),
      { id: user.id, email: user.email ?? '' },
      confirmEmail,
      new Date(),
    )
  } catch (e) {
    if (e instanceof AccountDeletionError) {
      throw createError({ statusCode: 400, statusMessage: e.message })
    }
    throw e
  }
})
```

- [ ] **Step 2: Write the export route**

`server/api/account/export.ts`:

```ts
// GDPR-style data export: the signed-in user's contacts as JSON.
// Read-only; feeds the "Download my data" button in the delete dialog.
// Authorized with the caller's Supabase JWT (Bearer).
import type { H3Event } from 'h3'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import type { Contact } from '~/types'

export default defineEventHandler(async (event) => {
  const admin = useSupabaseAdmin()
  const { data: { user } } = await admin.auth.getUser(authToken(event))
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in first' })

  const { data } = await admin
    .from('contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('follow_up_by', { ascending: true })

  return { contacts: (data ?? []) as Contact[] }
})

function authToken(event: H3Event): string {
  return (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '')
}
```

- [ ] **Step 3: Write the restore route**

`server/api/account/restore.ts`:

```ts
// Undo during the 14-day grace. Reachable signed-out (from the home banner).
// Recreates the auth user + reparents owned rows (see restoreAccount).
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { AccountDeletionError, restoreAccount } from '~/server/utils/accountDeletion'

export default defineEventHandler(async (event) => {
  const { email } = await readBody<{ email?: string }>(event)
  if (!email || typeof email !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Enter the account email.' })
  }

  try {
    return await restoreAccount(useSupabaseAdmin(), email, new Date())
  } catch (e) {
    if (e instanceof AccountDeletionError) {
      throw createError({ statusCode: 400, statusMessage: e.message })
    }
    throw e
  }
})
```

- [ ] **Step 4: Verify**

Run: `npx nuxi typecheck && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add server/api/account/delete.ts server/api/account/export.ts server/api/account/restore.ts
git commit -m "feat(account-deletion): delete/export/restore server routes"
```

---

### Task 5: Purge cron + loop/send guards

**Files:**
- Create: `server/api/cron/purge.ts`, `netlify/functions/purge-cron.mts`
- Modify: `netlify.toml`, `server/api/cron/nudge.ts`, `server/services/nudgeSender.ts`, `.env.example` (comment only)

**Interfaces:**
- Consumes: `purgeDueAccounts` (Task 3), `isSmsSuppressed` (Task 2), existing cron-guard pattern from `server/api/cron/nudge.ts`.
- Produces: `POST /api/cron/purge` → `{ ok, purged, failed }`; Netlify `@daily` trigger `purge-cron`.

- [ ] **Step 1: Write the purge route (mirror the nudge cron-guard)**

`server/api/cron/purge.ts`:

```ts
// Daily hard-purge trigger. Invoked by the Netlify Scheduled Function
// (netlify/functions/purge-cron) with the shared NUXT_CRON_SECRET; a purge
// forces ON DELETE CASCADE on every owned table past the 14-day grace window.
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { purgeDueAccounts } from '~/server/utils/accountDeletion'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.cronSecret as string

  if (secret) {
    const bearer = (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '')
    const supplied = getHeader(event, 'x-cron-secret') ?? bearer ?? getQuery(event).token
    if (typeof supplied !== 'string' || supplied !== secret) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  }

  return purgeDueAccounts(useSupabaseAdmin(), new Date())
})
```

- [ ] **Step 2: Write the Netlify scheduled function**

`netlify/functions/purge-cron.mts` (copy of `nudge-cron.mts`, different path):

```ts
// Netlify Scheduled Function — daily trigger for the account hard-purge.
export default async (): Promise<Response> => {
  const origin = process.env.URL ?? process.env.DEPLOY_URL ?? 'http://localhost:8888'
  const secret = process.env.NUXT_CRON_SECRET ?? ''

  if (!secret) {
    return new Response('NUXT_CRON_SECRET not set', { status: 500 })
  }

  const res = await fetch(`${origin}/api/cron/purge`, {
    method: 'POST',
    headers: {
      'x-cron-secret': secret,
      'content-type': 'application/json',
    },
  })

  if (!res.ok) {
    return new Response(`purge failed: ${res.status}`, { status: 502 })
  }

  return new Response(await res.text(), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
```

- [ ] **Step 3: Register the schedule in `netlify.toml`**

Append:

```toml
# Daily trigger for hard-deleting accounts past the 14-day grace window.
[functions."purge-cron"]
  schedule = "@daily"
```

- [ ] **Step 4: Skip pending-deletion users in the nudge loop**

In `server/api/cron/nudge.ts`, after `const { data: profiles } = await admin.from('profiles').select('*')` add:

```ts
  // Users who requested deletion must not keep getting nudged during grace.
  const { data: pendingDeletions } = await admin
    .from('account_deletions')
    .select('user_id')
    .is('purged_at', null)
    .is('superseded_at', null)
  const deleting = new Set((pendingDeletions ?? []).map((r) => r.user_id))
```

And in the `for (const profile of ...)` loop, after the existing `if (profile.sms_opted_out_at) continue` line, add:

```ts
    if (deleting.has(profile.user_id)) continue
```

- [ ] **Step 5: Hard-block suppressed numbers in the sender**

In `server/services/nudgeSender.ts`:

1. Import the suppressor (add to the existing imports):

```ts
import { isSmsSuppressed } from '~/server/utils/smsSuppression'
```

2. Change the SMS guard call site from `!canSendSms(user)` to `!(await canSendSms(user, admin))`:

```ts
    if (channel === 'sms' && !(await canSendSms(user, admin))) {
      skipped.push('sms:no-opt-in-or-phone')
      continue
    }
```

3. Make `canSendSms` async and consult the suppression table:

```ts
async function canSendSms(user: Profile, admin: SupabaseClient): Promise<boolean> {
  if (!user.phone || !user.sms_opt_in_at) return false
  if (user.sms_opted_out_at) return false
  if (await isSmsSuppressed(admin, user.phone)) return false
  return true
}
```

4. `SupabaseClient` type import: add `import type { SupabaseClient } from '@supabase/supabase-js'` to the imports.

- [ ] **Step 6: Note the cron secret in `.env.example`** (optional doc touch; the comment block for `NUXT_CRON_SECRET` already mentions `/api/cron/nudge` — add one line covered in Task 7's `Architecture.md` note instead, so skip editing here).

- [ ] **Step 7: Verify**

Run: `npx nuxi typecheck && npm run lint && npx vitest run`
Expected: all clean; the 14-day logic, suppression, and flow tests still pass.

- [ ] **Step 8: Commit**

```bash
git add server/api/cron/purge.ts netlify/functions/purge-cron.mts netlify.toml server/api/cron/nudge.ts server/services/nudgeSender.ts
git commit -m "feat(account-deletion): daily purge cron + nudge-loop/send guards"
```

---

### Task 6: Settings UI + delete confirm + restore banner

**Files:**
- Create: `composables/useDeleteAccount.ts`, `components/ConfirmDeleteAccount.vue`
- Modify: `pages/app/settings.vue`, `pages/index.vue`

**Interfaces:**
- Consumes: `POST /api/account/delete`, `GET /api/account/export`, `POST /api/account/restore`; `auth.signOut()` (stores/auth.ts, may throw "user from sub claim does not exist").
- Produces: composable `useDeleteAccount()` with `requestDelete(confirmEmail)` + `clearSessionAndRedirect()`; `<ConfirmDeleteAccount @close>`; restore banner on `/` when `?deleted=1`.

- [ ] **Step 1: Write the composable**

`composables/useDeleteAccount.ts`:

```ts
// Client-side choreography for account deletion. The destructive call is a
// server route (service role); this only sends the confirm, then clears the
// local session — signOut throws "user from sub claim does not exist" because
// the auth user was already removed server-side, so it is caught and ignored.
export function useDeleteAccount() {
  const auth = useAuthStore()

  async function requestDelete(confirmEmail: string): Promise<void> {
    await $fetch('/api/account/delete', { method: 'POST', body: { confirmEmail } })
  }

  async function clearSessionAndRedirect(): Promise<void> {
    try {
      await auth.signOut()
    } catch {
      // Auth user is gone server-side; the session is already dead.
    }
    auth.user = null
    auth.ready = false
    clearAuthCookies()
    await navigateTo('/?deleted=1')
  }

  function clearAuthCookies(): void {
    if (!import.meta.client) return
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0]?.trim()
      if (name && name.startsWith('sb-') && name.endsWith('-auth-token')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
      }
    }
  }

  return { requestDelete, clearSessionAndRedirect }
}
```

- [ ] **Step 2: Write the confirm dialog**

`components/ConfirmDeleteAccount.vue`:

```vue
<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
    <div class="w-full max-w-md rounded-2xl border border-line bg-surface p-6">
      <h3 id="delete-title" class="font-display text-xl font-bold">Delete your account?</h3>
      <ul class="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink">
        <li>Your contacts and nudge history are removed for good.</li>
        <li>We keep a one-way hash of numbers that opted out, so they're never texted again.</li>
        <li>Paid invoices, if any, stay on file.</li>
      </ul>
      <p class="mt-4 rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral-press">
        You have 14 days to change your mind. Sign back in from the home page and we'll restore everything.
      </p>

      <button type="button" class="mt-4 text-sm text-coral hover:underline disabled:opacity-50" :disabled="downloading" @click="download">
        {{ downloading ? 'Preparing…' : 'Download my data' }}
      </button>

      <div class="mt-2">
        <label class="text-sm font-medium text-ink" for="confirm-email">Type your email to confirm</label>
        <input
          id="confirm-email" v-model="confirm" type="email" autocomplete="email"
          class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-colors focus:border-coral focus:outline-none"
          :placeholder="userEmail || 'you@example.com'"
        >
      </div>

      <p v-if="error" class="mt-3 text-sm text-coral">{{ error }}</p>

      <div class="mt-5 flex gap-2">
        <button type="button" class="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-paper" @click="$emit('close')">
          Keep my account
        </button>
        <button
          type="button" class="flex-1 rounded-lg bg-coral px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:opacity-50"
          :disabled="!matches || busy" @click="confirmDelete"
        >
          {{ busy ? 'Deleting…' : 'Delete my account' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDeleteAccount } from '~/composables/useDeleteAccount'

defineEmits<{ close: [] }>()

const auth = useAuthStore()
const userEmail = computed(() => auth.user?.email ?? '')

const confirm = ref('')
const matches = computed(() => confirm.value.trim().toLowerCase() === userEmail.value.trim().toLowerCase())
const busy = ref(false)
const downloading = ref(false)
const error = ref<string | null>(null)

const { requestDelete, clearSessionAndRedirect } = useDeleteAccount()

async function download() {
  downloading.value = true
  error.value = null
  try {
    const data = await $fetch('/api/account/export')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lanyard-data.json'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Could not download your data.'
  } finally {
    downloading.value = false
  }
}

async function confirmDelete() {
  busy.value = true
  error.value = null
  try {
    await requestDelete(confirm.value)
    await clearSessionAndRedirect()
  } catch (e) {
    busy.value = false
    error.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Deletion failed. Try again.'
  }
}
</script>
```

- [ ] **Step 3: Wire into settings**

In `pages/app/settings.vue`, inside the Account `<section>` (after the email line, next to the sign-out button), add:

```vue
      <button type="button" class="mt-3 block text-sm text-coral hover:underline" @click="showDeleteConfirm = true">Delete account</button>
```

In `<script setup>`:

```ts
const showDeleteConfirm = ref(false)
```

At the end of the template (inside the root `.mx-auto` div), add:

```vue
    <ConfirmDeleteAccount v-if="showDeleteConfirm" @close="showDeleteConfirm = false" />
```

- [ ] **Step 4: Add the restore banner to the home page**

In `pages/index.vue` template, directly after the opening `<div class="bg-paper text-ink">` and before `<!-- HERO -->`, add:

```vue
    <section v-if="restoreOpen" class="border-b border-line bg-coral-soft/40">
      <div class="mx-auto flex max-w-[1080px] flex-wrap items-center gap-3 px-6 py-4">
        <p class="text-sm text-ink">Your account is scheduled for deletion. Within 14 days we can restore it — everything is still here.</p>
        <input v-model="restoreEmail" type="email" placeholder="account email" class="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm focus:border-coral focus:outline-none">
        <button type="button" class="rounded-lg bg-coral px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-coral-press disabled:opacity-50" :disabled="restoring" @click="restore">
          {{ restoring ? 'Sending…' : 'Restore account' }}
        </button>
        <button type="button" class="text-sm text-muted underline" @click="dismissRestore">Dismiss</button>
      </div>
      <p v-if="restoreMsg" class="mx-auto max-w-[1080px] px-6 pb-3 text-sm text-ink">{{ restoreMsg }}</p>
    </section>
```

In `<script setup>` add:

```ts
const route = useRoute()
const auth = useAuthStore()

const restoreOpen = ref(Boolean(route.query.deleted))
const restoreEmail = ref('')
const restoreMsg = ref('')
const restoring = ref(false)

function dismissRestore() {
  restoreOpen.value = false
  window.history.replaceState(null, '', '/')
}

async function restore() {
  if (!restoreEmail.value) {
    restoreMsg.value = 'Enter the email of the account you deleted.'
    return
  }
  restoring.value = true
  restoreMsg.value = ''
  try {
    await $fetch('/api/account/restore', { method: 'POST', body: { email: restoreEmail.value } })
    await auth.signInWithEmail(restoreEmail.value)
    restoreMsg.value = 'Account restored — check your inbox for a sign-in link.'
  } catch (e) {
    restoreMsg.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Could not restore the account. It may be past the 14-day window.'
  } finally {
    restoring.value = false
  }
}
```

- [ ] **Step 5: Verify**

Run: `npx nuxi typecheck && npm run lint && npx vitest run`
Expected: all clean (no route/UI tests — verified by types + lint).

- [ ] **Step 6: Commit**

```bash
git add composables/useDeleteAccount.ts components/ConfirmDeleteAccount.vue pages/app/settings.vue pages/index.vue
git commit -m "feat(account-deletion): settings delete flow, confirm dialog, restore banner"
```

---

### Task 7: Docs + tasks + full verification

**Files:**
- Modify: `decisions.md`, `Architecture.md`, `tasks.md`

- [ ] **Step 1: Add the decision to `decisions.md`**

Insert under `## Decided` (newest first), one bullet:

```markdown
- **Account deletion = 14-day grace, then hard purge.** Deletion soft-deletes the auth user (`shouldSoftDelete: true`) and records a grace row in `account_deletions` (keyed on the real email — GoTrue obfuscates it on soft delete). A daily purge job hard-deletes past the window, which fires the existing FK cascades. Undo within grace **recreates the auth user + reparents the owned rows**, because GoTrue soft-delete is irreversible by design (obfuscates email/phone, frees the email, no undelete API). Numbers that opted out are retained forever as a **SHA-256 of the normalized E.164** in `sms_suppressions` (no raw numbers, no FK, never cascade-deleted) so a recycled number is never texted. Data export offered before the destructive call.
```

- [ ] **Step 2: Update `Architecture.md`**

1. Add to the `## Data model (Phase 1)` section, after the `shares`-style notes — two mini-table blocks:

```markdown
`sms_suppressions` — numbers to never text again.
| col | type | notes |
|---|---|---|
| id | bigint identity pk | |
| phone_hash | text unique | SHA-256 of normalized E.164; never the raw number |
| reason | text | `opted_out` |
| created_at | timestamptz | |

RLS enabled, **no public policies** — written by the delete flow and read by the send guard via the service-role client. No FK, so it outlives `auth.users` (indefinite retention = a recycled number is never texted again).

`account_deletions` — grace-window ledger for account deletion.
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | no FK — the audit row must outlive the purge |
| email | text | normalized real email (GoTrue obfuscates it on soft delete); undo/purge lookups key here |
| requested_at / purge_at | timestamptz | `purge_at = requested_at + 14 days` |
| purged_at / superseded_at | timestamptz | purge done / restoration won |

RLS enabled, **no public policies** (service-role only). Partial index on `purge_at where purged_at is null and superseded_at is null`.
```

2. Add a `## Account deletion` flow subsection (after `## Key flows` content) describing: request → soft-delete + ledger; purge cron daily; restore = recreate + reparent; client clears local session post-delete. Keep to 6–10 lines plain.

3. In `## Secrets`, no new secret names (unsalted SHA-256 needs none).

- [ ] **Step 3: Add tasks to `tasks.md`**

Append under a new numbered block `## 7. Account deletion` (before `## Parked`):

```markdown
## 7. Account deletion
- [x] Migration: `sms_suppressions` + `account_deletions` (RLS on, no public policies); FKs already cascade
- [x] Delete route: typed-email confirm → grace ledger → suppression → soft delete (service role only)
- [x] Export route (`GET /api/account/export`) → "Download my data"
- [x] Restore route: recreate auth user + reparent rows within 14 days
- [x] Daily purge cron (`@daily`) → hard delete past grace
- [x] Nudge loop skips pending deletions; sender hard-blocks suppressed numbers
- [x] Settings UI + confirm dialog + post-delete redirect + home restore banner
- [x] Vitest: delete happy/failure/idempotent, suppression hash, purge/restore plans
```

- [ ] **Step 4: Full verification gate**

Run:
```bash
npm run lint
npx nuxi typecheck
npx vitest run
```
Expected: all three pass clean. If any failure, fix before commit.

- [ ] **Step 5: Commit**

```bash
git add decisions.md Architecture.md tasks.md
git commit -m "docs(account-deletion): decisions, architecture, tasks"
```

---

## Self-Review

- **Spec coverage:** migration ✓ (Task 1) · delete route ✓ (Task 4) · purge cron ✓ (Task 5) · settings UI + confirm + re-auth-by-email + post-delete redirect + undo entry point ✓ (Task 6) · docs ✓ (Task 7) · tests: happy path + auth failure + suppression write + cascade behavior ✓ (Tasks 2–3; "cascade behavior" = the purge test asserting hard-delete targets past-due rows while grace rows survive).
- **Placeholders:** none — every task has concrete code/steps. (Deliberate future hook in `requestAccountDeletion` for Twilio/Stripe cancels is a code comment, not a TBD.)
- **Type consistency:** `GRACE_DAYS`, `gracePurgeAt`, `normalizeEmail`, `requestAccountDeletion`, `restoreAccount`, `purgeDueAccounts`, `writeSuppression`, `hashE164`, `isSmsSuppressed`, `useDeleteAccount().requestDelete/clearSessionAndRedirect` names match across tasks. `account_deletions` insert/update payloads match the Task 1 types.
- **Definition of done:** types, tests, lint pass (Task 7 Step 4); RLS on both new tables with no public policies (Task 1); service role only in `server/*` (all client code ships zero secrets); post-delete sign-out error caught + cookies cleared + `/?deleted=1` redirect (Task 6); docs/tasks updated (Task 7).