# Design — In-App Change Password

Date: 2026-08-11 · Status: Approved · Branch: `feature/change-password`

## Goal

Add a signed-in "change password" form to Settings that requires the current password and revokes other devices' sessions without signing out the current device.

## Decisions

- Setting in **Settings → Account** section, shown for all accounts (no SMS/email-path gating).
- Uses `updateUser({ password, current_password })` — `current_password` mirrors the Supabase passwords guide's "Verifying the current password" (available in supabase-js v2.102.0+, repo has `^2.112.2`).
- After success, `signOut({ scope: 'others' })` revokes all other sessions while keeping the current one (verified: `others` scope fires no `SIGNED_OUT` event on the current device).
- **Current-password field is optional** — deliberately omitted from the payload when blank so OAuth/magic-link users (who have email identities but no password) can set a first password. Password users who leave it blank get the server's error surfaced.
- Pure, IO-free payload builder `utils/changePassword.ts` follows the repo's tested-utils convention (`buildPasswordUpdate(currentPassword, newPassword)`).
- Network-bound flows get no unit tests — manual verification checklist instead (repo convention).

## Flow

1. User opens Settings → Account → Password.
2. Enters current password (optional), new password (min 8), confirmation.
3. Client-side guards: min length, match, different-from-current.
4. `useAuthStore().changePassword(currentPassword, newPassword)`:
   - `updateUser(buildPasswordUpdate(...))`; throw on error.
   - `signOut({ scope: 'others' })`.
5. Success → inline `text-graduated` message; fields clear. Wrong current → `invalid_credentials` mapped to "Current password is incorrect."

## Files

```
new       utils/changePassword.ts            pure payload builder
new       tests/unit/changePassword.test.ts
modified  stores/auth.ts                     + changePassword action
new       components/ChangePasswordForm.vue   Settings Account card
modified  pages/app/settings.vue             + Password subsection
modified  decisions.md                       revoke-others decision
modified  tasks.md                           auth entry
```

## Definition of done

Types pass (`nuxi typecheck`) · tests pass (`vitest run`, 61 existing + 4 new) · lint passes · no schema/RLS/env changes · no comments in code · success path revokes other devices and keeps current session.