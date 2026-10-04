# Stitch Design Brief — Lanyard

> **Status: design input, not a source of truth.**
> Exported from the Stitch project "Lanyard Conference Follow-Up"
> (`stitch.withgoogle.com/projects/8173146796510831213`). Use it for **visual direction only**.
> Where it disagrees with `project_docs/prd.md`, `project_docs/Architecture.md` or
> `project_docs/decisions.md`, those docs win. Known conflicts:
>
> | Brief says | Lanyard actually does | Source |
> |---|---|---|
> | Mint `#10b981` on primary CTAs | Keep `--accent` `#006d37` for CTAs (white on `#10b981` ≈ 2.5:1, fails WCAG AA). Mint is decorative / dark-mode only. | `assets/css/main.css`, decisions 2026-09-22 |
> | Ladder = Met (Day 0) → Follow Up → Coffee → Graduation (Day +45) | Three touchpoints on `cadence_ladder` (default `{2,14,45}`); graduates on the 3rd. Capture is not a rung. | decisions: *Three cups of coffee*, *Cadence = recurring ladder* |
> | Capture: Name, Company/Role, Event, Contextual Hook | `how_met` verbatim + at least one of email/phone. No schema change. | Architecture, AGENTS.md |
> | Local push notifications | Nudges go out by SMS or email. | Architecture |
> | "Book Coffee" → Calendar; WhatsApp hand-off | Calendar is parked; act-link opens `sms:` / `mailto:` only. | prd.md Phase 1 scope |
> | Return to app, one-tap status confirmation | Act-link advances the ladder on first act (atomic `acted_at` claim). No confirm step. | AGENTS.md |
> | "My Network" directory; Phase 2 CSV / CRM webhook | Not a CRM. Style the existing graduated view; no directory or export features from this brief. | AGENTS.md, prd.md |

---

# Lanyard Product Requirements Document (PRD) & Comprehensive Design Brief

**Product Name:** Lanyard  
**Stage:** Phase 1 (MVP) & Phase 2 Expansion  
**Author:** AI Product & Design Partner  
**Target Platform:** Mobile-First (iOS / Android) + Companion Desktop Web  
**Primary Design Philosophy:** *Show, Don't Tell* • *The Nudge is the Product*

---

## 1. Executive Summary & Vision

**Lanyard** is a high-utility, lightweight relationship momentum app designed specifically for frequent conference-goers, founders, tech professionals, and serial networkers.

The universal failure mode of networking isn't meeting people—it's the **friction of execution** afterwards. Users collect business cards, badges, and fleeting LinkedIn scans, only for contacts to go cold in forgotten notes. Lanyard automates the **"when"** and **"what"** of post-event networking, collapsing the entire follow-up sequence into an effortless, single-tap workflow.

---

## 2. Problem Statement & User Personas

### Problem Breakdown
1. **Context Decay:** 48 hours after an event, the vivid context ("we discussed distributed databases over cold brew") vanishes from memory.
2. **Drafting Inertia:** Staring at a blank email or SMS compose box creates cognitive hesitation.
3. **Pacing Ambiguity:** Users don't know when to follow up without feeling transactional or overbearing.
4. **Tool Bloat:** Full CRMs (Salesforce, HubSpot) are too heavy for personal relationships; basic contact lists lack workflow automation.

### Primary User Persona
* **"The Conference Maven" (e.g., Sarah & Marcus):**
  * Attends 4–8 industry summits annually.
  * Meets 20–50 people per event in loud, crowded hallways.
  * Requires one-handed, rapid contact capture in under 30 seconds.
  * Values intentionality, low cognitive load, and zero clutter.

---

## 3. Core System Architecture & "Ladder Logic"

Lanyard replaces open-ended task lists with an opinionated, finite relationship progression: **The 3-Rung Ladder**.

```
[ Rung 1: Met ] --------> [ Rung 2: Follow Up ] --------> [ Rung 3: Coffee ] --------> [ GRADUATION ]
  Day 0 (Capture)            Day +2 (+48 hrs)               Day +14 (+2 wks)             Day +45 (+6 wks)
  "Context Logged"           "Quick Touch / Recoil"         "Deeper Exchange"            "Active Network"
```

### Ladder Rules & Progression:
* **Rung 1 (Met / Day 0):** Rapid manual capture. Stores Name, Company/Role, Event Context ("Where & What"), and preferred communication channel (SMS or Email).
* **Rung 2 (Follow Up / Day +2):** First nudge. Generates an immediate contextual draft referencing the event notes. Completing it marks Rung 2 as checked.
* **Rung 3 (Coffee / Day +14):** Relationship deepening nudge. Suggests a 15-minute virtual sync, quick catch-up, or coffee link.
* **Graduation (Day +45):** After 3 successful touchpoints, the contact reaches "Graduated" status. They move out of the active triage queue and into the permanent "My Network" directory with a milestone badge.

---

## 4. Key Functional Requirements

### 4.1. Rapid Capture (< 30 Seconds, One-Handed)
* Minimal friction form:
  * Full Name (Required)
  * Event / Where Met (Auto-suggests current event/location if active)
  * Contextual Hook (e.g., "Discussed React Native Expo vs Flutter")
  * Channel Selector: Email or Phone/SMS (Strict validation: at least one channel required)
* Instant save without mandatory photo uploads or superfluous fields.

### 4.2. Intelligent Nudges & Quiet Hours
* **Local Notifications:** Triggered precisely at user-configured local times (e.g., 09:30 AM weekdays).
* **Quiet Hours:** Hard blackout periods (e.g., 8:00 PM – 8:00 AM, weekends optional) ensuring Lanyard never interrupts deep work or rest.
* **Timezone Awareness:** Adjusts dynamically as the user travels between conferences.

### 4.3. One-Tap Action & Native Hand-Off
* Lanyard **does not send emails or SMS directly** from third-party servers.
* Tapping **"Message"** or **"Book Coffee"** generates an intelligent contextual draft using the verbatim "How Met" note and hands off immediately to the native system client (Mail, iMessage, Messages, WhatsApp, or Calendar).
* Returns to the app with one-tap status confirmation.

### 4.4. Triage Queue & Urgency-First Hierarchy
* Categorizes follow-ups into:
  * **Due Now / Overdue:** High-priority visual alerts (urgent red / warning amber).
  * **Due Today:** Actionable items ready for immediate clearance.
  * **Upcoming:** Preview of contacts maturing in +2 to +5 days, with optional 24h Snooze.
  * **Zero Inbox State:** Calming "All Caught Up" illustration when queue is clear.

---

## 5. Visual & Brand Design Brief

### 5.1. Brand Identity & Principles
* **Deep Navy (`#1a2b3c` / Primary):** Represents stability, executive polish, and trust.
* **Vibrant Mint (`#10b981` / Accent & Action):** Reserved exclusively for progression, primary action buttons (CTAs), checkmarks, and "Graduated" milestones.
* **Clean Neutral Canvas (`#f8f9ff` to `#ffffff`):** Generous breathing room, clear typographic hierarchy, avoiding cognitive fatigue.
* **Corner Radius:** Standardized `8px` (`rounded-lg`) to `12px` for modern, utility-grade tactility.
* **Typography:** Inter (Variable Sans-Serif), highly scannable under direct sunlight or low-light event halls.

### 5.2. Core Design Heuristics
1. **The Nudge is the Product:** The screen shown in response to a notification must be 100% actionable within 5 seconds.
2. **Three Cups of Coffee:** Networking must feel finite and achievable, not an endless chore list.
3. **Show, Don't Tell:** Use visual previews, live UI drafts, and interactive ladder rungs rather than dense paragraphs of marketing or explanatory copy.

---

## 6. Success Metrics & KPIs

| Metric | Target | Measurement Method |
| :--- | :--- | :--- |
| **Capture Latency** | < 30 seconds | Median time from tapping "Add Contact" to submit |
| **Nudge-to-Action Time** | < 15 seconds | Time from opening nudge to launching native composer |
| **Ladder Graduation Rate** | > 45% | Percentage of captured contacts completing all 3 touchpoints |
| **7-Day Retention Post-Event** | > 60% | Active app sessions within 7 days after an event ends |

---

## 7. Phase Roadmap

* **Phase 1 (Current MVP):** Rapid Contact Capture, Triage Queue, 3-Rung Ladder Logic, One-Tap Native Hand-off, Quiet Hours Preferences, Show-Don't-Tell Web Landing Page.
* **Phase 2 (Upcoming):** Business card OCR scanner, calendar sync for coffee scheduling, shared event cohorts (e.g. "WebSummit 2024 Attendee Roster"), export to CSV / CRM webhook.
