---
title: 'The concept collection replaces the umbrella in the window and the export'
type: 'feature'
ticket: '20'
created: '2026-10-21'
status: 'built'
baseline_revision: '561d7f692950e17a6ab0f3b33d5ad0992a891011'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The window and the export still say „umbrelă” and „copii”: the card of a concept with concepts under it shows „umbrelă · N copii”, and an exported child `.md` titles its parents „Umbrele”. Decision 1B (EXPERIENCE glossary, DESIGN `entry-card`) names that concept a **colecție**: „colecție · N concepte” on the card, „Face parte din” for a child's parents, as the sheet already does.

**Approach:** In `src/shared/strings.ro.ts`, replace `appStrings.umbrella` with `appStrings.collection(count)` → `colecție · ${plural(count, { one: 'concept', few: 'concepte', other: 'de concepte' })}` and use it in `src/desktop/renderer/entry-card.tsx`; set `exportStrings.umbrellas` to „Face parte din” (reuse `appStrings.sheetParents` if the module order allows, otherwise the literal). Keep the core label key `umbrellas` in `src/core/export-catalog.ts` (a technical name) and leave the CLI and import strings (`entryStrings.parentIds`/`childIds`, the import reasons) unchanged — they keep „umbrelă” by decision 2A. Tests: the card label with 1, 2 and 20 concepts („colecție · 1 concept”, „colecție · 2 concepte”, „colecție · 20 de concepte”) in `entry-card.test.tsx`, replacing the „umbrelă · 3 copii” expectation; the exported child `.md` carries `## Face parte din` (update the `umbrellas: 'Umbrele'` fixture in `src/desktop/main/catalog.test.ts` or the export test that uses `exportStrings`). After the change, no „umbrelă”/„copii”/„Umbrele” string is reachable from `src/desktop/**` or the export labels.

</frozen-after-approval>

## Implementation Notes

Oneshot: string and test changes in about five files. Implemented in a Sonnet subagent, per CLAUDE.md.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: clean
- `npm run typecheck` -- expected: clean
- `grep -rniE "umbrel|copii" src/desktop src/shared/strings.ro.ts` -- expected: only identifiers, comments, test fixture ids, and the CLI/import strings kept by decision 2A

## Review Triage Log

Quick lens: no findings.
