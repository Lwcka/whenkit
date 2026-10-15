---
title: 'Mesajul de duplicat numește fișa existentă'
type: 'feature'
ticket: '16'
created: '2026-10-15'
status: 'built'
baseline_revision: 'd9f8e4395a510752b25c05a4ff7ea7743b67c8a4'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/spec-whenkit/verification-rules.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A duplicate's report names only the existing entry's id (catalog) or the earlier item's ref (same batch), while `verification-rules.md` asks for "există deja: <nume>"; `/importa`, which reads the JSON, cannot name it either.

**Approach (renegotiated by the author on 2026-10-15 after review):** The `duplicate` reason carries `params.name`: the existing entry's name for a catalog duplicate (`{ name }`), the earlier item's name for a same-batch repeat (`{ ref, name }`), set by the import in its transaction. The text report renders "există deja: <nume>" from that same report (AD-14), and `/importa` names the entry from it (template version bump). The change to the JSON is additive (one more param); the report's shape, version and exit codes stay as they are; Romanian text lives in `strings.ro.ts` (AD-13).

</frozen-after-approval>

## Implementation Notes

Oneshot. First version looked the names up in the import command for the text report only; review loop 0 found it broke AD-14 (text from the same report) and added a failure path to `--json` after commit. The author chose to carry the name in the `duplicate` reason instead (intent renegotiated); the code was reverted and rebuilt that way.

## Verification

**Commands:**
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build:cli` -- expected: pass

## Review Triage Log

Loop 0 (first design, names looked up in the import command):
- medium — AD-14 broken: the text report used data outside the report object. Resolved by the author's redesign (name in `params`).
- medium — the lookup also ran under `--json` after commit; a failed read would exit non-zero after writing. Gone with the redesign.
- medium — `/importa` reads only JSON, so it could not name the entry. Resolved: the skill reads `params.name`.
- low — same-batch repeats had no name. Resolved: `{ ref, name }`.
- low — "există deja" printed twice; low — untested fallback branch. Both gone with the redesign.

Loop 1:
- low — the text test's `'există deja: Tool a'` also matched `Tool again`. Patched: the whole reason line is asserted.
- low — ticket 16's `verify` still said the JSON stays unchanged. Routed to the ticket entry (updated on `main` with the author's renegotiation).
