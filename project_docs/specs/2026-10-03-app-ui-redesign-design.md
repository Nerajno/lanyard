# App UI Redesign — Design

**Date:** 2026-10-03
**Branch:** `feature/app-ui-redesign` (depends on `fix/in-app-act-claims-nudge`, merged first)
**Inputs:** Stitch project "Lanyard Conference Follow-Up" screens (Add Contact, Triage Queue, Contact detail, Nudge Preferences) and `project_docs/design/stitch-brief.md`. The brief is visual direction only; its conflict table lists what we deliberately do **not** take from it.

## Goal

Bring the logged-in app and the public share page in line with the Stitch designs so that:

- From the queue, the next follow-up is actionable in under 5 seconds (one tap to a prefilled composer).
- Capture takes under 30 seconds, one-handed.
- The app reads as one system with the landing page (navy / green, Inter, 8–12px radius).

## Non-goals

- No schema, RLS, grant, or service-role change. No migration.
- No change to the ladder, cadence presets, act-link route, or nudge cron.
- Nothing from the brief's conflict table: no mint CTAs, no Company/Role/Event fields, no push notifications, no calendar/WhatsApp hand-off, no "My Network" directory, no CSV/CRM export.
- Scan stays a "coming soon" stub.

## Prerequisite: `fix/in-app-act-claims-nudge` (separate branch)

**Bug (exists today):** in-app "Follow up" advances the ladder without touching `nudges`. If a direct nudge for that contact is still unclaimed, its act-link later advances the ladder a second time, skipping a coffee or graduating early.

**Fix in `useContacts.markFollowedUp(id)`:**

1. Find the user's most recent direct nudge for the contact: `contact_ids = {id}` and `acted_at is null`.
2. None found → advance as today.
3. Found → claim it: `update nudges set acted_at = now() where id = :id and acted_at is null`, returning the row.
   - Claim returned a row → advance.
   - Claim returned nothing (the act-link won the race) → **do not advance**; reload contacts.

Runs under the user's session. `nudges_update_own` RLS and the `update` grant on `nudges` already allow this. Side effect: in-app acts now count toward the nudge→act latency metric.

**Tests (Vitest):** no open nudge → advances; open nudge claimed → advances and stamps `acted_at`; claim lost → no advance; the 3rd touchpoint still graduates.

## 1. Shared UI components (`components/ui/`)

All `<script setup lang="ts">`, Tailwind on existing tokens, no component CSS.

| Component | Purpose | API |
|---|---|---|
| `AppButton` | All buttons and button-styled links | `variant: primary \| secondary \| ghost \| danger`, `size: sm \| md`, `to?` (renders `NuxtLink`), `href?` (renders `<a>`), `block?`, `disabled?`. Minimum tap target 44px. |
| `AppMenu` | "⋯" overflow menu | `items: { label, onSelect, danger?, children? }[]`. Click/Enter/Space opens; arrow keys move; Esc closes and returns focus to the trigger; outside click closes. `role="menu"` / `menuitem`. One level of submenu (used by "Nudge me later"). |
| `AppIcon` | Inline SVG icons | `name: queue \| plus \| settings \| stats \| more \| message \| sun \| moon \| check \| clock`. Hand-written 24px stroke paths; `aria-hidden` unless given a `label`. No new dependency. |
| `Avatar` | Initials circle | `name`, `size: sm \| md`. First and last initial on a navy-tint background. |
| `SectionHeader` | Group heading with count | `label`, `count?`, `tone?: due \| warm \| muted` |
| `EmptyState` | Empty and caught-up states | `title`, `body`, optional `action` slot |
| `AppField` | Label, control, hint, error | `label`, `for`, `hint?`, `error?`, `required?`. Error is linked to the control via `aria-describedby`. |
| `AppInput` | Text input and textarea | `as: input \| textarea`, `v-model`, passes through native attributes; shared focus ring. |

**Tests:** `AppMenu` (keyboard navigation, Esc returns focus, outside click closes, submenu); `AppButton` (renders `NuxtLink` / `<a>` / `<button>` correctly; disabled state).

## 2. App shell (`layouts/app.vue`)

- **Mobile (< md):** bottom tab bar with icon and label: **Queue · Add · Stats · Settings**. Add is styled as the green primary button. Active tab uses `text-accent` and `aria-current="page"`. Padding includes `env(safe-area-inset-bottom)`.
- **Desktop (≥ md):** top bar with the same four links and the theme toggle (`AppIcon` sun/moon replaces the `☀/☾` glyphs).
- Content width: `max-w-3xl` for the queue, `max-w-xl` for forms.
- Onboarding keeps no nav.
- **Tokens:** no palette change. Light `--paper` may move to `#f8f9ff`, but only if `muted` text on it still meets AA (4.5:1); otherwise it stays as it is.

## 3. Queue (`pages/app/index.vue`) and `ContactCard`

### Grouping: `utils/queue.ts`

`groupQueue(contacts, now)` is a pure function. It considers only `status = 'active'` contacts, sorts each group soonest first, and uses browser local time.

| Group | Rule | Header tone |
|---|---|---|
| Due now | `follow_up_by <= now` | `due` |
| Later today | after `now`, same local calendar day | `warm` |
| Upcoming | a later local day | `muted` |

- Every future contact appears in Upcoming (no 2–5 day cut-off), so nothing disappears.
- Empty groups are hidden.
- Cards in Due now whose `follow_up_by` falls on an earlier local day show an "Overdue · Nd" badge.

### Page

- Header: "Queue" title plus a Due / Graduated segmented toggle (`?filter=graduated`, as today). The header Add button is removed, since Add lives in the nav.
- No contacts at all → `EmptyState` with the existing "Met someone? Add them." copy and an Add action.
- Due now and Later today both empty, Upcoming not → "All caught up" `EmptyState` above Upcoming, naming the next contact and when ("Next nudge: Elena, in 4d").
- Graduated view: same cards, green "Graduated · 3 coffees" badge, no primary action; the menu offers Edit only (today's card hides Delete for graduated contacts; keep that).

### `ContactCard`

```
[Avatar] Name                         [badge: Overdue 2d | Due | 3:00 PM | In 4d]
         how_met (verbatim, 2-line clamp)
         ●●○  2 of 3 coffees
[ Message ▸ ]  (primary; full width on mobile)                    [⋯]
```

- **Due now / Later today:** the primary action is **Message**, an `<a href="composerUrl(contact, contact.how_met)">`. Its click handler fires `markFollowedUp` (with the prerequisite's claim logic) without blocking navigation.
- **Upcoming:** the primary action is **Snooze** (secondary style). Message moves into the menu.
- **Menu:**
  - Message (Upcoming only)
  - Mark done (same as Message without opening the composer: for in-person follow-ups, and the recovery path if a background advance fails)
  - Nudge me later ▸ 15 min / 1 hr / 4 hr / 1 day
  - Set aside
  - Edit
  - divider, then Delete (danger; keeps the existing `confirm()`)
- **No usable channel** (email fails `isValidContactEmail` and there is no phone): Message is disabled with the hint "Add a valid email or phone"; Edit becomes the primary action.
- **Success toast** (`role="status"`, auto-dismisses after 4s): "Coffee 2 of 3 logged · next nudge in 12d" or "Graduated 🎓". No undo.
- **Background advance fails:** page error banner reads "Couldn't log that follow-up. Use ⋯ › Mark done."
- **`CoffeeDots`:** restyled, gains `aria-label="N of 3 coffees"`.

**Tests:**
- `groupQueue`: group boundaries, sub-day rungs, overdue day count, excludes graduated and archived.
- `ContactCard`: Message `href` equals `composerUrl` output; Upcoming shows Snooze as primary; disabled state when there is no usable channel; menu items per status.

## 4. Capture and edit

- **`add/index`** becomes the manual form page; the Add tab lands straight on the form. "Other ways to add" (Share link, Scan) is a small row below the form on mobile and beside it on desktop. `add/manual` redirects to `add/index`.
- **`ContactForm`** (built on `AppField` / `AppInput`):
  1. **Name.** Autofocus on desktop only.
  2. **How you met.** Textarea, plus up to 3 chips taken from the user's own recent `how_met` values (text before the first "·", capped at 30 chars, unique). Tapping a chip inserts its text at the start of the field. Local only; `how_met` is still stored verbatim. Helper: `recentHowMetPrefixes(contacts)` in `utils/`.
  3. **Reach them via (at least one):** Email, an "or" divider, Phone. The channel error shows after blur or submit instead of immediately. `hasChannel` logic and the DB CHECK are unchanged.
  4. **Pace.** Collapsed row "Pace: Default (2 · 14 · 45 days) ▸" that expands to the existing preset and custom-ladder UI.
  5. **Save contact.** Full-width primary; sticky above the tab bar on mobile.
- **Contact detail (`app/c/[id]`):** header with avatar, name and coffee dots; `ContactForm` in edit mode; Delete as a danger button below a divider.
- **Share link (`add/link`):** restyled; "Copy link" flips to ✓ for 2s.
- **Share page (`share/[token]`):** public, no app nav. Centred card with `BrandMark` and "Let's stay in touch", fields on the new components, the email validation unchanged, and a clear success state after submit.
- Remove the empty `pages/contacts/[id]/` directory.

**Tests:** `recentHowMetPrefixes` unit test; `ContactForm` (channel error only after blur/submit, chip insert); e2e add-contact flow updated for the route change and the redirect.

## 5. Settings, Stats, Onboarding, Auth

- **Settings:** cards in this order.
  - **Nudges:** Channel (segmented Email / Text / Both; the SMS consent checkbox and verification-code flow are unchanged, styling only), Timezone, and **Quiet hours**: two hour selects ("Don't disturb after" → `quiet_hours_start`, "Resume at" → `quiet_hours_end`). These columns already exist (defaults 21 / 9) and the cron already respects them; the hard-coded "09:00–21:00" hint is replaced. `useProfile.save` is extended to send them if it doesn't already. Values are 0–23 integers; start equal to end is rejected inline.
  - **Appearance:** theme toggle.
  - **Account:** password form, then a danger zone with `ConfirmDeleteAccount` (restyle only).
- **Stats:** stat tiles; nudge→act latency is the hero tile. Same data; no chart library.
- **Onboarding:** a single centred card on the new components; no nav.
- **Login / reset-password / confirm:** the same centred-card treatment as the share page. `OAuthButtons` and `PasswordAuthForm` move onto `AppButton` / `AppField`; auth logic is untouched.

**Tests:** quiet-hours validation (start ≠ end, 0–23); existing settings and auth tests updated for the new markup.

## Error handling (all pages)

- Composable errors → one inline `role="alert"` banner per page (the existing pattern).
- Toasts are for success only.
- Form errors sit on the field via `AppField`'s `error` prop.

## Order of work

1. `fix/in-app-act-claims-nudge`: separate branch and PR, merged first.
2. On this branch, each step green before the next:
   1. UI components
   2. App shell
   3. Queue and card
   4. Capture and edit
   5. Settings
   6. Stats / onboarding / auth
   7. Share page

## Definition of done

- `npm run lint`, `npx nuxi typecheck`, `npm run test`, and e2e pass.
- Screenshots of every in-scope screen at 375px and 1280px, light and dark.
- WCAG AA contrast confirmed for any new colour pair.
- No schema / RLS / service-role change.
- `AGENTS.md` gains the convention "build UI from `components/ui` primitives". `tasks.md` gets a line for this redesign.
