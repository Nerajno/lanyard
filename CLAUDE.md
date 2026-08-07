# CLAUDE.md — Lanyard

**`AGENTS.md` is the canonical rulebook for this repo.** It is imported below — read it as if inline. Everything here is Claude Code-specific scaffolding on top of it; where the two disagree, AGENTS.md wins.

@AGENTS.md

---

## Doc map

Four docs, four jobs. Check the right one before proposing work:

| Doc | Answers |
|---|---|
| `prd.md` | What we're building and *why*. Scope boundaries, phases, success metrics. |
| `Architecture.md` | Stack, data model, the reminder loop, secrets. |
| `decisions.md` | ADR-lite. **Decided** = settled, don't relitigate. **Open** = needs a call before the relevant milestone. |
| `tasks.md` | Phase 1 sequence. Work top-down; §5 (the nudge) is the point of the project. |
| `AGENTS.md` | Code conventions, rules, definition of done. |

## Before you write code

1. **Check `decisions.md` first.** If a question is under **Decided**, it's settled — build it, don't re-argue it. If it's under **Open**, ask before building past it.
2. **Check Phase 1 scope in `prd.md`.** Parked work (QR scan, LinkedIn attach, share-link capture, AI opener, calendar) does not get started, even if it's a small diff.
3. **Check `tasks.md` order.** It's sequenced so the nudge loop works by end of week one. Don't build polish ahead of §5.

## When a doc goes stale

These five docs are the project's only state — there's no code yet to read. A change to the data model, the loop, or scope means **editing the doc in the same change**, not just the code:

- New/changed column or table → `Architecture.md`
- Scope moved between phases → `prd.md` **and** `tasks.md`
- An **Open** question resolved → move it up to **Decided** in `decisions.md` with a one-line rationale
- New convention or rule → `AGENTS.md`

Never leave a doc contradicting the code.

## Guardrails worth repeating

These are in AGENTS.md; they're the ones most likely to get violated by a plausible-looking diff:

- **Never auto-send a follow-up on the user's behalf.** The act-link opens a prefilled `sms:`/`mailto:` composer. This is a product decision, not a limitation to route around.
- **Never send SMS without `sms_opt_in_at`, or with `sms_opted_out_at` set.** Legal, not stylistic.
- **Every new table gets RLS in the same migration.** No exceptions, no follow-up commits.
- **Service-role key is edge-function only.** It never reaches the client bundle.
- **Never scrape LinkedIn.** Store the URL, ask the user for the name.
- **Not a CRM.** Reject scope that turns it into one.

## Repo notes

- This project lives in a subdirectory of a larger `~/Documents/Dev` git repo. Scope git operations to `Projects/lanyard/`; do not stage unrelated sibling projects.
- No code exists yet. `tasks.md` §0 is the starting line.
