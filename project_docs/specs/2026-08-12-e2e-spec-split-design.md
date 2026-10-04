# E2E Spec Split — Design

## Goal

Break the three e2e spec files (`tests/e2e/auth.spec.ts`, `contacts.spec.ts`,
`settings.spec.ts`) into six focused files, each covering one scenario area,
and extract the repeated login dance (fill email/password → Continue → land in
the app) into a single shared `loginAs` helper.

This is purely a structural change: **what scenarios run does not change**. The
same signs-in, signs-out, magic-link, add-contact, no-channel validation, and
change-password scenarios all run, same seed users, same `workers: 1` and
serial mode, same CI job and `playwright.config.ts`. Only file boundaries move.

## Decisions

- **Flat split** — all spec files stay directly in `tests/e2e/`
  (`*.spec.ts`), matching the existing `testDir` glob. No subfolders.
- **Shared helper** — a `tests/e2e/helpers.ts` exports `loginAs`, the single
  home of the login dance that today is copy-pasted ~8 times across the specs.
- **One scenario per file** — each file owns one coherent flow to keep failure
  isolation granular and the files replaceable as scenarios grow.
- **Keep `pw@`/`e2e@` user isolation** — the password-change scenario keeps the
  dedicated `pw@lanyard.test` user so its password mutation never affects the
  sign-in/add-contact flows. No seed changes.

## Layout

### `tests/e2e/helpers.ts`

- `loginAs(page, goto, { email = 'e2e@lanyard.test', password = 'e2epass123' } = {})`
  — `goto('/login', { waitUntil: 'hydration' })`, fill `#email`/`#password`,
  click the `Continue` button (exact), assert the URL lands on `/app(/|$)`.
- The `pw@` specs override credentials via the third argument.

### Six spec files

| File | Tests (moved verbatim) | From |
|---|---|---|
| `tests/e2e/signin.spec.ts` | sign-in happy path; wrong password → signup prompt | `auth.spec.ts` |
| `tests/e2e/magic-link.spec.ts` | magic-link sends + inbox notice | `auth.spec.ts` |
| `tests/e2e/signout.spec.ts` | sign out via Settings → landing page | `auth.spec.ts` |
| `tests/e2e/add-contact.spec.ts` | add a contact from the manual form → visible in list | `contacts.spec.ts` |
| `tests/e2e/validation.spec.ts` | contact with no email/phone is blocked with inline error | `contacts.spec.ts` |
| `tests/e2e/change-password.spec.ts` | change password + re-sign-in with the new one (`pw@lanyard.test` / `pwpass123` → `pwnew456`) | `settings.spec.ts` |

Deleted: `tests/e2e/auth.spec.ts`, `tests/e2e/contacts.spec.ts`,
`tests/e2e/settings.spec.ts`.

Each test body becomes `await loginAs(page, goto)` (plus credentials when the
scenario isn't the `e2e@` default) followed by its own steps. Test names,
assertions, and selectors are unchanged from today.

## Data flow

No data changes. The seed already provides:

- `e2e@lanyard.test` / `e2epass123` — fully onboarded `profiles` row, used by
  sign-in, add-contact, and validation.
- `pw@lanyard.test` / `pwpass123` — dedicated password-change user, mutated to
  `pwnew456` by the change-password scenario.

Each `supabase db reset` re-seeds both, so CI runs are deterministic across
runs.

## Error handling / failure isolation

No new error paths. `workers: 1` + `fullyParallel: false` already serialize the
suite; splitting files does not change execution order guarantees. A failure
now localizes to the flow's own file (granular `github` reporter annotations),
which is the point of the split.

## Definition of done

- Six spec files + `helpers.ts` under `tests/e2e/`; the three old files gone.
- `loginAs` used by every spec (no inline login dances remain).
- `loginAs` needed at least once anywhere other than a default-credential call
  (i.e. the `pw@` override path is exercised).
- `npm run test:e2e` green against the local Supabase stack.
- No changes to `playwright.config.ts`, `supabase/seed.sql`, or
  `.github/workflows/ci.yml`; no changes to `tests/component/` or `tests/unit/`.