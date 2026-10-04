# In-App Act Claims Nudge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the ladder advancing twice when a user follows up in-app and later taps the act-link from the same nudge.

**Architecture:** A small helper, `claimOpenNudges`, claims every open *direct* nudge for a contact (sets `acted_at` only where it is still null), using the same conditional-update pattern as `server/routes/act/[token].get.ts`. `useContacts.markFollowedUp` calls it first and advances only when no nudge was open, or when it won at least one claim. Runs on the user's session under existing RLS.

**Tech Stack:** Nuxt 3, supabase-js v2, Vitest.

**Spec:** `project_docs/specs/2026-10-03-app-ui-redesign-design.md` → "Prerequisite: `fix/in-app-act-claims-nudge`"

## Global Constraints

- No migration. Uses the existing `nudges_update_own` RLS policy and the `grant select, insert, update on public.nudges to authenticated` grant.
- The service-role key is never used client-side; `useSupabase()` (the session client) only.
- A snooze or a reminder never consumes a rung (unchanged).
- The third touchpoint graduates the contact (unchanged).
- Branch: `fix/in-app-act-claims-nudge`. Commit trailer: `Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Act-link wins the race:** the in-app claim updates 0 rows → must NOT advance; reload contacts so the UI shows the act-link's advance.
- **Several open direct nudges for one contact** (e.g. an older failed delivery plus a newer one): claim **all** of them, or the older one's act-link could still advance later.
- **Digest nudges** (`contact_ids` length > 1) are never claimed; the digest act-link doesn't advance the ladder, so claiming it would only distort the latency metric.
- **Supabase error on the lookup or claim:** surface it (throw), don't silently advance.
- **No open nudge** (followed up before any nudge was sent): advance as today.

---

### Task 1: `claimOpenNudges` helper

**Files:**
- Create: `utils/claimNudges.ts`
- Test: `tests/unit/claimNudges.test.ts`

**Interfaces:**
- Produces: `export type ClaimResult = 'none' | 'claimed' | 'lost'` and
  `export async function claimOpenNudges(sb: NudgeClient, userId: string, contactId: string, now?: Date): Promise<ClaimResult>`
  where `NudgeClient = Pick<SupabaseClient<Database>, 'from'>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/claimNudges.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { claimOpenNudges } from '~/utils/claimNudges'

type Row = { id: string; user_id: string; contact_ids: string[]; acted_at: string | null }
let rows: Row[]
let failOn: 'select' | 'update' | null

// Minimal fake of the supabase query builder for the two calls the helper makes.
function fakeClient() {
  return {
    from(_table: string) {
      const f: { eq: Record<string, unknown>; isNull: string[]; contains?: string[]; inIds?: string[] } = { eq: {}, isNull: [] }
      let patch: Partial<Row> | null = null
      const q: any = {
        select: () => q,
        update: (p: Partial<Row>) => { patch = p; return q },
        eq: (k: string, v: unknown) => { f.eq[k] = v; return q },
        is: (k: string, v: null) => { if (v === null) f.isNull.push(k); return q },
        contains: (_k: string, v: string[]) => { f.contains = v; return q },
        in: (_k: string, v: string[]) => { f.inIds = v; return q },
        then: (res: (v: unknown) => void) => {
          const match = rows.filter((r) =>
            Object.entries(f.eq).every(([k, v]) => (r as any)[k] === v)
            && f.isNull.every((k) => (r as any)[k] === null)
            && (!f.contains || f.contains.every((c) => r.contact_ids.includes(c)))
            && (!f.inIds || f.inIds.includes(r.id)))
          if (patch) {
            if (failOn === 'update') return res({ data: null, error: { message: 'update failed' } })
            match.forEach((r) => Object.assign(r, patch))
            return res({ data: match.map((r) => ({ id: r.id })), error: null })
          }
          if (failOn === 'select') return res({ data: null, error: { message: 'select failed' } })
          return res({ data: match.map((r) => ({ id: r.id, contact_ids: r.contact_ids })), error: null })
        },
      }
      return q
    },
  }
}

const NOW = new Date('2026-10-03T12:00:00Z')

beforeEach(() => {
  rows = []
  failOn = null
})

describe('claimOpenNudges', () => {
  it('returns none when the contact has no open direct nudge', async () => {
    rows = [{ id: 'n1', user_id: 'u1', contact_ids: ['c1'], acted_at: '2026-10-01T00:00:00Z' }]
    expect(await claimOpenNudges(fakeClient() as never, 'u1', 'c1', NOW)).toBe('none')
  })

  it('claims an open direct nudge and stamps acted_at', async () => {
    rows = [{ id: 'n1', user_id: 'u1', contact_ids: ['c1'], acted_at: null }]
    expect(await claimOpenNudges(fakeClient() as never, 'u1', 'c1', NOW)).toBe('claimed')
    expect(rows[0].acted_at).toBe(NOW.toISOString())
  })

  it('claims every open direct nudge for the contact', async () => {
    rows = [
      { id: 'n1', user_id: 'u1', contact_ids: ['c1'], acted_at: null },
      { id: 'n2', user_id: 'u1', contact_ids: ['c1'], acted_at: null },
    ]
    expect(await claimOpenNudges(fakeClient() as never, 'u1', 'c1', NOW)).toBe('claimed')
    expect(rows.every((r) => r.acted_at === NOW.toISOString())).toBe(true)
  })

  it('ignores digest nudges that include the contact', async () => {
    rows = [{ id: 'd1', user_id: 'u1', contact_ids: ['c1', 'c2'], acted_at: null }]
    expect(await claimOpenNudges(fakeClient() as never, 'u1', 'c1', NOW)).toBe('none')
    expect(rows[0].acted_at).toBeNull()
  })

  it('returns lost when the act-link claimed it between lookup and update', async () => {
    rows = [{ id: 'n1', user_id: 'u1', contact_ids: ['c1'], acted_at: null }]
    const client = fakeClient()
    const realFrom = client.from
    let calls = 0
    client.from = (t: string) => {
      calls += 1
      // Second call is the claim; simulate the act-link winning just before it.
      if (calls === 2) rows[0].acted_at = '2026-10-03T11:59:59Z'
      return realFrom(t)
    }
    expect(await claimOpenNudges(client as never, 'u1', 'c1', NOW)).toBe('lost')
    expect(rows[0].acted_at).toBe('2026-10-03T11:59:59Z')
  })

  it('throws when the lookup fails', async () => {
    failOn = 'select'
    await expect(claimOpenNudges(fakeClient() as never, 'u1', 'c1', NOW)).rejects.toThrow('select failed')
  })

  it('throws when the claim fails', async () => {
    rows = [{ id: 'n1', user_id: 'u1', contact_ids: ['c1'], acted_at: null }]
    failOn = 'update'
    await expect(claimOpenNudges(fakeClient() as never, 'u1', 'c1', NOW)).rejects.toThrow('update failed')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit tests/unit/claimNudges.test.ts`
Expected: FAIL, `Failed to resolve import "~/utils/claimNudges"`.

- [ ] **Step 3: Write the implementation**

```ts
// utils/claimNudges.ts
// Claims a contact's open direct nudges so an in-app follow-up and the
// act-link can't both advance the ladder. Same conditional update as the
// act route: only rows whose acted_at is still null are stamped.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'

export type ClaimResult = 'none' | 'claimed' | 'lost'
type NudgeClient = Pick<SupabaseClient<Database>, 'from'>

export async function claimOpenNudges(
  sb: NudgeClient,
  userId: string,
  contactId: string,
  now: Date = new Date(),
): Promise<ClaimResult> {
  const { data: open, error: findError } = await sb
    .from('nudges')
    .select('id, contact_ids')
    .eq('user_id', userId)
    .is('acted_at', null)
    .contains('contact_ids', [contactId])
  if (findError) throw new Error(findError.message)

  // Direct nudges only — a digest act-link never advances the ladder.
  const ids = (open ?? []).filter((n) => n.contact_ids.length === 1).map((n) => n.id)
  if (ids.length === 0) return 'none'

  const { data: claimed, error: claimError } = await sb
    .from('nudges')
    .update({ acted_at: now.toISOString() })
    .in('id', ids)
    .is('acted_at', null)
    .select('id')
  if (claimError) throw new Error(claimError.message)

  return (claimed ?? []).length > 0 ? 'claimed' : 'lost'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project unit tests/unit/claimNudges.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add utils/claimNudges.ts tests/unit/claimNudges.test.ts
git commit -m "fix(nudge): add claimOpenNudges helper for in-app acts

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `markFollowedUp` claims before advancing

**Files:**
- Modify: `composables/useContacts.ts` (the `markFollowedUp` function, ~lines 92–108; the import block at the top)
- Create: `utils/followUp.ts`
- Test: `tests/unit/followUp.test.ts`

**Interfaces:**
- Consumes: `claimOpenNudges(sb, userId, contactId, now?)` and `ClaimResult` from Task 1; `advanceTouchpoint` from `utils/cadence.ts`.
- Produces:
  - `export type FollowUpResult = { outcome: 'advanced'; touchpointsDone: number; followUpBy: string } | { outcome: 'graduated' } | { outcome: 'skipped' }`
  - `export function followUpPatch(contact: Pick<Contact, 'cadence_ladder' | 'touchpoints_done'>, now: Date): { patch: UpdateContact; result: FollowUpResult }` in `utils/followUp.ts`
  - `markFollowedUp(id: string): Promise<FollowUpResult>`. The redesign's success toast reads this.

Keeping the patch logic in a pure function makes it testable without mounting Nuxt. `useContacts` has no unit test today and this plan doesn't add a Nuxt-runtime one.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/followUp.test.ts
import { describe, it, expect } from 'vitest'
import { followUpPatch } from '~/utils/followUp'

const ladder = [
  { value: 2, unit: 'day' as const },
  { value: 14, unit: 'day' as const },
  { value: 45, unit: 'day' as const },
]
const NOW = new Date('2026-10-03T12:00:00Z')

describe('followUpPatch', () => {
  it('advances rung 1 → 2 and schedules the next rung from now', () => {
    const { patch, result } = followUpPatch({ cadence_ladder: ladder, touchpoints_done: 0 }, NOW)
    expect(patch).toEqual({ touchpoints_done: 1, follow_up_by: '2026-10-17T12:00:00.000Z' })
    expect(result).toEqual({ outcome: 'advanced', touchpointsDone: 1, followUpBy: '2026-10-17T12:00:00.000Z' })
  })

  it('advances rung 2 → 3', () => {
    const { patch } = followUpPatch({ cadence_ladder: ladder, touchpoints_done: 1 }, NOW)
    expect(patch).toEqual({ touchpoints_done: 2, follow_up_by: '2026-11-17T12:00:00.000Z' })
  })

  it('graduates on the third touchpoint', () => {
    const { patch, result } = followUpPatch({ cadence_ladder: ladder, touchpoints_done: 2 }, NOW)
    expect(patch).toEqual({ touchpoints_done: 3, status: 'graduated' })
    expect(result).toEqual({ outcome: 'graduated' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit tests/unit/followUp.test.ts`
Expected: FAIL, `Failed to resolve import "~/utils/followUp"`.

- [ ] **Step 3: Write `utils/followUp.ts`**

```ts
// utils/followUp.ts
// The contact patch for one completed touchpoint. Shared by the in-app
// follow-up so it can't drift from the act route's advance.
import type { Contact, UpdateContact } from '~/types'
import { advanceTouchpoint } from '~/utils/cadence'

export type FollowUpResult =
  | { outcome: 'advanced'; touchpointsDone: number; followUpBy: string }
  | { outcome: 'graduated' }
  | { outcome: 'skipped' }

export function followUpPatch(
  contact: Pick<Contact, 'cadence_ladder' | 'touchpoints_done'>,
  now: Date,
): { patch: UpdateContact; result: FollowUpResult } {
  const next = advanceTouchpoint(contact.cadence_ladder, contact.touchpoints_done, now)
  if (!next) {
    return { patch: { touchpoints_done: contact.touchpoints_done + 1, status: 'graduated' }, result: { outcome: 'graduated' } }
  }
  return {
    patch: { touchpoints_done: next.touchpoints_done, follow_up_by: next.follow_up_by },
    result: { outcome: 'advanced', touchpointsDone: next.touchpoints_done, followUpBy: next.follow_up_by },
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project unit tests/unit/followUp.test.ts`
Expected: PASS (3 tests). If the rung-2 date differs, check `addToTimestamp`: the expected value is NOW + 45 days.

- [ ] **Step 5: Rewire `markFollowedUp`**

In `composables/useContacts.ts`:

1. Change the cadence import to drop `advanceTouchpoint` (it is now only used via `followUpPatch`). The line becomes:

```ts
import { addToTimestamp, initialFollowUp, resolveLadder, snooze } from '~/utils/cadence'
```

2. Add these imports below it:

```ts
import { claimOpenNudges } from '~/utils/claimNudges'
import { followUpPatch } from '~/utils/followUp'
import type { FollowUpResult } from '~/utils/followUp'
```

If `advanceTouchpoint` is still referenced elsewhere in the file, keep it in the import; `npm run lint` will flag an unused import either way.

3. Replace the whole `markFollowedUp` function (doc comment included) with:

```ts
  /**
   * Mark a single touchpoint done. First claims any open direct nudge for the
   * contact so its act-link can't advance the ladder a second time. If the
   * act-link already claimed it, this does not advance (it already happened).
   */
  async function markFollowedUp(id: string): Promise<FollowUpResult> {
    if (!auth.user) throw new Error('You must be signed in')
    const contact = contacts.value.find((c) => c.id === id)
    if (!contact) return { outcome: 'skipped' }

    const now = new Date()
    const claim = await claimOpenNudges(sb, auth.user.id, id, now)
    if (claim === 'lost') {
      await load()
      return { outcome: 'skipped' }
    }

    const { patch, result } = followUpPatch(contact, now)
    await update(id, patch)
    return result
  }
```

4. `pages/app/index.vue`'s `onFollowUp` passes `markFollowedUp(c.id)` to `run(p: Promise<void>)`. Widen `run`'s parameter to `Promise<unknown>` so it type-checks:

```ts
async function run(p: Promise<unknown>) {
```

- [ ] **Step 6: Run the full checks**

Run: `npm run lint && npx nuxi typecheck && npm run test`
Expected: all pass, including `actRoute.test.ts` (the act route is unchanged).

- [ ] **Step 7: Commit**

```bash
git add utils/followUp.ts tests/unit/followUp.test.ts composables/useContacts.ts pages/app/index.vue
git commit -m "fix(nudge): in-app follow-up claims open nudges before advancing

An in-app follow-up advanced the ladder without touching nudges, so the
same nudge's act-link could advance it again later. markFollowedUp now
claims open direct nudges first and skips the advance if the act-link
already won.

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Docs

**Files:**
- Modify: `project_docs/Architecture.md` (the act-link / key-flows section that describes "first act wins")
- Modify: `AGENTS.md` (the "act-link advances the ladder at most once per nudge" rule)

- [ ] **Step 1: Update `AGENTS.md`**

Find the rule that begins "The act-link advances the ladder **at most once per nudge**". Append this sentence to the end of that bullet:

```markdown
In-app follow-ups claim the contact's open direct nudges the same way (`utils/claimNudges.ts`) and don't advance if the act-link got there first.
```

- [ ] **Step 2: Update `project_docs/Architecture.md`**

Run `grep -n "acted_at" project_docs/Architecture.md` to find the act-link flow. After the paragraph describing the atomic `acted_at` claim, add:

```markdown
In-app follow-up (`useContacts.markFollowedUp`) runs the same claim on the user's session before advancing: it stamps `acted_at` on every open **direct** nudge for that contact (`utils/claimNudges.ts`). No open nudge → advance. Claimed at least one → advance. Open nudge(s) but the act-link claimed them first → don't advance. In-app acts therefore also count toward nudge→act latency.
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md project_docs/Architecture.md
git commit -m "docs: in-app follow-up claims nudges like the act-link

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Done when

- `npm run lint`, `npx nuxi typecheck`, `npm run test` all pass.
- `claimNudges.test.ts` (7) and `followUp.test.ts` (3) pass.
- No migration, no service-role usage, `server/routes/act/[token].get.ts` unchanged.
