---
title: 'Aplicația instalată pe catalogul real'
type: 'chore'
ticket: '16'
created: '2026-10-21'
status: done
baseline_revision: 'ae6fba9b1c139de7caac35086ea7ccd018a0659c'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'none'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Entries 1–15 of the window epic were verified by tests and reviews only; nobody has yet run the installed app on the real catalog, and the hand checks of the hitl entries (2.1–2.5, 2.7–2.9, 2.12, 2.14) plus two unverified deferred items (title bar at high zoom, Cascadia Mono `data:` fonts blocked by the CSP) were left for this entry.

**Approach:** Build the installer with `npm run make`, install WhenKit, and have the author check the epic's Done when 1–6 on the real workspace (`C:\Users\Luca\Programe\whenkit`) next to a `/importa` session. No code changes here: every problem found becomes a bug ticket (via `bmad-ticket`), and the two deferred items are either closed (not reproduced) or turned into bug tickets.

</frozen-after-approval>

## Implementation Notes

Oneshot: this entry is a hand verification of the installed app, not a code change; the work is building the installer, a backup of the real catalog, the author's checklist, and filing what fails as bug tickets.

- The real catalog has only migration `0001`, the one the window epic shipped with, so the window opens it without `DATABASE_NEEDS_MIGRATION`.
- `data/backups/` in the real workspace is empty; Done when 2 deletes an entry and renames/merges a category on real data, so a copy of `catalog.sqlite` is taken first.
- First `npm run make` (2026-10-21) failed in the renderer Vite build: `memory allocation of 320000 bytes failed`, with 651 MB of commit memory free out of 16 GB (TextInputHost alone at 2.1 GB). An environment problem, not a code one.
- After the author stopped Oracle (2.4 GB commit free), `npm run make` built `out/make/squirrel.windows/x64/WhenKit-0.1.0 Setup.exe`.
- Backup: `C:\Users\Luca\Programe\whenkit\data\backups\catalog-before-2.16-2026-10-21.sqlite` (no `-wal` file beside the catalog, so the copy is consistent).
- CSP font item: the bundle inlines only two `data:font/woff` URIs, the `woff` fallbacks of Cascadia Mono cyrillic-ext 400/500, each listed after a `woff2` file served from `'self'`. Chromium takes the first supported format (woff2), so the `data:` fallback is never fetched and no glyph range falls back to Consolas; cyrillic-ext is not used by Romanian text either. Closed as harmless, no ticket.
- The real catalog holds a test entry, „Tool A” (`https://example.com`, added 2026-10-19T16:07): the smoke test of entry 1 that reached the real workspace before `.env` loading was fixed (entry 1's review, finding 1). The checklist deletes it as the Flow 4 check.
- The author's full checklist: `.tmp/verificare-mvp.md` (sections 0, A–P, Z; codes per check). Results are read back from that file and each failure becomes a bug ticket.

## Verification Result (2026-10-21)

The author ran the whole checklist on the installed app and the real catalog: Done when 1–6 of the epic pass. Findings:

| Check | Finding | Outcome |
|---|---|---|
| A8 | The theme switch transition looks choppy | bug ticket |
| A9 | A maximized window does not come back maximized after a restart (AD-20 stores only `bounds`) | bug ticket; AD-20 gains the maximized state via `bmad-architecture` |
| L6 | At high zoom the theme switch overflows the title bar (confirms the deferred zoom item) | bug ticket; main owns the zoom, AD-20 changes via `bmad-architecture` |
| L7 | Zoom is not kept after a restart (by design, AD-20: „nepersistat”) | author's decision 3A: persist it in `window-state.json`, with the L6 fix |
| A12 | `window-state.json` is in `%APPDATA%\whenkit\desktop\`; the Chromium files beside `config.json` date from 2026-10-19 19:07, before entry 2.2 moved userData | pass; leftovers, not a current bug |
| E4 | No concept on the real catalog has a link inside its Markdown content | not testable on real data; covered by entry 8's tests |
| J10 | optional, skipped | — |
| CSP fonts (deferred) | only `woff` fallbacks behind `woff2` are inlined, never fetched | closed, no ticket |

Product changes asked by the author (spec/UX first, then tickets):
- Decision 1B: the umbrella label on cards becomes „colecție · N concepte” (no „umbrelă”/„copii” in the UI); `bmad-ux` glossary.
- Decision 2A: `/importa` is renamed `/adauga` (confused with Claude Code's own commands while typing); `bmad-spec`, workspace template, UI strings; `whenkit init` must also retire the old `importa` skill folder in an existing workspace.

Real data: the author chose to restore the backup. The test-state catalog was kept as `data\backups\catalog-after-2.16-test-2026-10-21.sqlite`; `catalog.sqlite` is again the 76-entry copy from before the checks („Tool A” included).

## Verification

**Commands:**
- `npm run make` -- expected: `out/make/squirrel.windows/x64/WhenKit-0.1.0 Setup.exe`
- `grep -r "url(data:font" .vite/renderer` -- expected: no match (else the CSP deferred item is real)

**Manual checks (if no CLI):**
- Done when 1–6 of `epic-fereastra-whenkit.md`, in the installed app on the real catalog.
- The pending hand checks of the hitl entries' plans (zoom 200 % on the title bar, 720/1200 px, Animation effects off, Flow 3/5/6/7, the deferred CSP console warnings in DevTools).
