# Stitch site redesign — navy/green system, site-wide

**Status:** Implemented 2026-09-22
**Branch:** `feature/stitch-site-redesign` (off `main` @ 6e46317)
**Source:** Stitch project 8173146796510831213, screen 988f3e7e (HTML export pasted 2026-09-22)

## Goal

Replace the coral / Bricolage visual system with the Stitch navy + green / Inter system **across the whole site** (marketing pages and the signed-in app), and rebuild the landing page on the Stitch layout. Product behaviour does not change.

## Decisions taken

- **Scope: site-wide (option 3).** Marketing and app share one token set.
- **Copy corrections accepted.** Stitch copy that contradicts product rules is rewritten, not ported:
  1. "Send SMS Follow-up" → "Open prefilled text" (never auto-send; act-link opens composer).
  2. "Increases connection chance by 70%" → removed (fabricated stat).
  3. Sample nudge quotes `how_met` verbatim (single-contact nudge rule).
  4. Met → Message → Coffee stepper → three-coffee ladder (+2 / +14 / +45, then graduates), reusing `CoffeeDots`.
  5. "Localized Timing" kept as meaning user-local send; "Quiet Hours" copy says they are user-set.
- **Keep token *names*, swap *values*.** Tokens are CSS variables in `assets/css/main.css`, so most of the reskin is a value change. Exception: `coral` is renamed to `accent` (29 files) because a token called coral that renders green is a trap.

## Token mapping (light / dark)

| Token | Light (Stitch) | Dark (derived from Stitch `dark:` classes) |
|---|---|---|
| `paper` (page bg) | surface `#f8f9ff` | primary `#041627` |
| `surface` (cards) | `#ffffff` | primary-container `#1a2b3c` |
| `sunken` | surface-container-low `#eff4ff` | `#0b1d2d` |
| `line` | outline-variant `#c4c6cd` | `#2a3b4d` |
| `ink` | on-surface `#0b1c30` | primary-fixed `#d2e4fb` |
| `ink-2` | on-surface-variant `#44474c` | primary-fixed-dim `#b7c8de` |
| `muted` | outline `#74777d` | on-primary-container `#8192a7` |
| `faint` | `#9a9da5` | `#5d6e82` |
| `navy` | primary `#041627` | primary-container `#1a2b3c` |
| `accent` (was coral) | secondary `#006d37` | secondary-fixed-dim `#4ae183` |
| `accent-press` | on-secondary-fixed-variant `#005228` | secondary-fixed `#6bfe9c` |
| `accent-soft` | `#d8f5e2` | `#0f3321` |
| `warm` / `warm-soft` | tertiary-fixed-dim `#ffb961` / tertiary-fixed `#ffddb9` | `#ffb961` / `#3e2400` |
| `due` / `due-soft` | on-tertiary-container `#cb8000` / `#ffddb9` | `#ffb961` / `#3e2400` |
| `fresh` / `graduated` | secondary `#006d37` / `#005228` | `#4ae183` / `#6bfe9c` |
| error (new) | `#ba1a1a` / `#ffdad6` | `#ffb4ab` / `#93000a` |

Dark-mode text on `accent` switches to `#00210c` (white on `#4ae183` fails contrast). Every pair gets checked for ≥ 4.5:1 body / 3:1 large text; values adjusted where they fail.

**Type:** `font-display` → Inter 700 (Bricolage dropped from the Google Fonts link). Add Stitch sizes as Tailwind `fontSize` tokens (`headline-lg`, `headline-md`, `action`, `body-lg`, `body-sm`, `label-caps`). JetBrains Mono stays for numbers/codes only.
**Icons:** inline SVG, not the Material Symbols font (no extra font request).
**Images:** no `lh3.googleusercontent.com` URLs. The hero uses the existing `HeroPhone` component; the event photo becomes a local asset in `public/` (or is dropped if none is supplied).

## Steps

1. **Tokens.** `assets/css/main.css` (light + dark values, `accent`, `error`), `tailwind.config.js` (rename `coral`→`accent`, add `error`, fontSize scale, display font), `nuxt.config.ts` (font link).
2. **Rename sweep.** `coral`→`accent` across `pages/`, `components/`, `layouts/` (sed, then review the diff by hand). Replace hard-coded status colours if any turn up.
3. **Layout.** `layouts/default.vue`: Stitch nav (wordmark, Features / How it works / Pricing, CTA → `/early-access`, keep Log in / Open app, theme toggle, mobile menu, sticky-header scroll offset). Footer: Privacy / Terms / Contact; drop the placeholder Twitter/LinkedIn links; year computed.
4. **Landing.** `pages/index.vue` split into `components/landing/`: `LandingHero`, `LandingStepNudge`, `LandingStepConnect`, `LandingStepClimb`, `LandingFocus`. Copy follows the corrections above; ladder values stay data-driven from `LADDER_PRESETS` / `DEFAULT_QUIET_HOURS`. Keep the existing restore banner, `#how-it-works` / `#features` / `#get` anchors, and the waitlist CTA.
5. **App screens.** `layouts/app.vue`, `pages/app/**`, `pages/contacts/**`, `pages/auth/**`, `login`, `early-access`, `pricing`, `about`, `privacy`, `terms`, `share`: restyle to the new tokens only. No behaviour or structure changes. Status chips (fresh / warm / due / graduated) re-checked visually.
6. **Tests.** Update `tests/e2e/landing.test.ts` for the new copy; add assertions that the page has no "send"-for-you wording and no remote Stitch image hosts. Existing unit tests must stay green unchanged.
7. **Docs.** Record the design system in `project_docs/decisions.md` under **Decided** (navy/green + Inter, site-wide, 2026-09-22). Update existing specs only where they state colours as current.

## Verification

- `npm run lint`, `npx nuxi typecheck`, `npm run test`, `npm run build` all pass.
- `npx playwright test tests/e2e/landing.test.ts` passes (other e2e specs need local Supabase/Docker; run them if the stack is up, otherwise report them as not run).
- Screenshots at 375px and 1280px, light and dark: `/`, `/pricing`, `/login`, `/app`, the contacts list, add contact. Compared side by side with the Stitch export.
- `grep -rn coral pages components layouts assets` returns nothing.
- Contrast check on accent / status pairs in both themes.

## As built (deviations from the steps above)

- **Contrast fixes.** Light `muted` → `#696c72`, `warm` → `#9e5e00`, `due` → `#804c00` (the Stitch ambers fail as text on white); dark `due` → `#ffa448` so it differs from `warm`. Added `on-error`. All pairs ≥ 4.5:1 in both themes.
- **Errors/destructive** (error messages, validation, the SMS opt-out warning, delete buttons) moved to `error` rather than `accent`.
- **Eyebrow labels** across the app went from mono uppercase to Inter `text-label-caps`; `font-extrabold` → `font-bold`.
- **Climb** uses a purpose-built three-coffee stepper instead of reusing `CoffeeDots` (the stepper needed per-rung labels and timing).
- **Landing sections trimmed** to the Stitch structure: the separate "problem", "three coffees" and "philosophy" bands are gone (three-coffee copy lives in Climb; the philosophy line and Vincent Mayers credit moved under the final CTA). No event photo (none supplied).
- **Footer** keeps the existing site links (no Contact page exists); no social links.
- **Login** got top/bottom padding (heading was flush under the header before this change too).
- **Tests.** `NudgePrefsForm.test.ts` asserts `bg-accent-soft` instead of `bg-coral-soft` (class rename only).
- **Not verified visually:** signed-in app screens. `.env` targets the hosted Supabase project and Docker is down, so there was no local session; they are covered by the token swap plus component tests only.

## Out of scope

Behaviour, data model, RLS, the nudge pipeline, and any Phase-2 features pictured or implied by Stitch.
