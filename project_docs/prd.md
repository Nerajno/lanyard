# PRD — Conference Follow-Up App (working name: Lanyard)

## Problem
Connections made at conferences go cold because follow-up doesn't happen in time.

## User & wedge
Frequent conference-goers (speakers, organizers, serial attendees) — people who meet many and follow up with few. Start here, not "anyone who networks."

## North star
**Intentional consistency, not eventual consistency.** A network left alone resolves to *eventual* consistency — connections fade by default. Lanyard makes follow-up an intentional, scheduled act rather than an accident. (Framing crystallized around Vincent Mayers' JavaOne 2025 community talk and its *Three Cups of Tea* idea — trust is built through sustained, repeated engagement.)

## Principles
1. **The nudge is the product.** Value lives in the 15s after the reminder. The one metric that matters: friction between *nudge received* and *message sent*.
2. **Three cups of coffee.** Three touchpoints turn a contact into a connection. A contact runs a three-rung ladder (default +2 / +14 / +45 days), then **graduates** and stops nudging. The app has a defined end state per contact, not an infinite queue.

## Goals
- Capture a contact fast with at least one reachable channel, run the three-coffees cadence, get nudged on the channel you chose (SMS or email), act in one tap.

## Non-goals
- Not a CRM. No pipelines, no rich contact management. Do the one thing CRMs are too heavy for.
- Lanyard does not send the follow-up for you (P1). It opens a prefilled composer; you hit send.
- No bulk contact import.

## Phases (gate = behavior retention, not signups)
1. **Personal + portfolio, with the public surface live** — dogfood at next conference while the landing page and waitlist collect early-access signups. Q: does it change *my* behavior?
2. **Free MicroSaaS (first 100 free)** — do others return after their 2nd/3rd event?
3. **Paid + retoolable** — will they pay; does the loop generalize (sales, recruiting, personal CRM)?

## Phase 1 scope (build this only)
Manual add (`name` + `how_met` + **email or phone**, at least one) → ladder sets `follow_up_by` → an **hourly job** nudges on the user's chosen channel inside their local send window (at most one nudge per user per day) → act in one tap → mark followed up, which advances the ladder or graduates the contact → list sorted by due. One user (auth), one loop, end to end.

**Act = prefilled composer.** The act-link opens `sms:` or `mailto:` on the contact's captured channel with a draft, and marks the touchpoint done. Lanyard never sends on the user's behalf in P1.

**Nudge batching.** One contact due → a direct message inlining `how_met` with a one-tap act-link. Two or more due → a single digest ("3 due today") linking to the triage list. Protects the one-tap path on ordinary days and caps cost + mute risk after a conference.

**Share-link capture (pulled into Phase 1, 2026-08-09).** Add → Link generates a one-time, expiring `/share/:token` link (with QR to display it); the other person enters their own name, `how_met`, and email or phone, which creates a contact for the sharer. Cheaper than typing at a booth and the source of structured data that doesn't come from scraping. See `project_docs/specs/2026-08-09-sitemap-buildout-design.md`.

**Public launch surface.** Lanyard ships as a real product, not only a personal tool: landing page, early-access waitlist, pricing (free during early access), privacy and terms (privacy + terms are also required for A2P 10DLC).

Out of Phase 1: badge/LinkedIn QR *scanning*, LinkedIn attach, AI opener, calendar.

## Later scope (tagged)
- P2: badge-QR scan (vCard autofill / manual fallback), LinkedIn-QR attach-and-confirm, richer optional contact fields (company, title, socials, event, follow-up reason, photo), calendar delivery, consent capture.
- P3: AI-generated opener from the "how we met" note (paid differentiator); tier caps.

## Success signals
Measured from the `nudges` table (`sent_at` → `acted_at`), not self-report — self-report can't see latency, and latency is the stated metric.
- P1: median nudge→act latency; % of nudges acted on; % of contacts reaching all three coffees.
- P2: % of users active at a second conference.

## Constraints
- **LinkedIn QR** only encodes a profile URL → attach link + confirm name by hand. No LinkedIn data scraping (ToS). Structured data comes from own share-link/vCard path.
- **Badge QR** varies by event: parse a vCard when present, else store the raw payload and fall back to manual entry. Never depend on an event-platform API.
- **Captured data isn't ours** — explicit consent + clear storage (esp. EU attendees).
- **SMS to the user is regulated.** Texting our own users requires explicit opt-in, STOP/HELP handling, and US A2P 10DLC brand + campaign registration before a Twilio production number will deliver. Prerequisite for the loop, not polish. Email nudges are the fallback while registration is pending.
- **Send timing is user-local.** Every profile carries a timezone and quiet hours; the **hourly job** sends inside the window, never blind UTC.

Also: [Architecture.md](Architecture.md) · [tasks.md](tasks.md) · [decisions.md](decisions.md).
