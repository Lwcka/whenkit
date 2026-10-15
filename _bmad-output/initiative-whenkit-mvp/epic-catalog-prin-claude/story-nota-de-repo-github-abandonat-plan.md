---
title: 'Nota de repo GitHub abandonat'
type: 'feature'
ticket: '17'
created: '2026-10-15'
status: done
baseline_revision: 'a104b1615b7dd25b0848a74f5e8fb07706feed2b'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/spec-whenkit/verification-rules.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `verification-rules.md` gives an abandoned GitHub repo (last push more than 24 months before the import, decided by the author on 2026-10-15) a note in its card, like an archived one; the import only notes archived repos.

**Approach:** The verification receives the import's current time and adds a new note `github_abandoned` (with the last push date) to a repo whose GitHub `pushedAt` is more than 24 calendar months older; the repo is still accepted, and an archived repo keeps only its archived note. Its Romanian text in `strings.ro.ts` (AD-13, AD-15), the `/importa` reason gloss, a template version bump, and offline tests (25 months → note, 23 months → none).

</frozen-after-approval>

## Implementation Notes

Oneshot: one reason code, one rule in the verification, the current time passed in, texts and tests.

## Verification

**Commands:**
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build:cli` -- expected: pass

## Review Triage Log

Quick lens (Opus): 0 high, 0 medium, 2 low (1 patched, 1 deferred).

- low — `isAbandoned` let 29 February spill to 1 March two years back, so a push up to a day younger than 24 months could be noted abandoned. Patched: the day is clamped to the target month's last day; a leap-day test covers it.
- low — AD-7 in the architecture does not list `github_abandoned` or the import time passed to the verification. Deferred: an architecture edit goes through `bmad-architecture`.
