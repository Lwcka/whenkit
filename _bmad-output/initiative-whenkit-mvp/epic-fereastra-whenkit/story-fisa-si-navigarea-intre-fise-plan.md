---
title: 'Fișa și navigarea între fișe'
type: 'feature'
ticket: '7'
created: '2026-10-20'
status: done
baseline_revision: '24d70a17dd16acc321dd3fc93397b8d2d3aa9e6b'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md'
  - '{project-root}/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A card can be selected but not opened, so the full entry (all of `entry-model.md`), the links between entries and Flow 7 cannot be seen in the window (CAP-10).

**Approach:** A read-only `entry-sheet` with `sheet-bar` replaces the category bar and grid in the work area. It opens from a card (click, Enter) and from a single-entry arrival toast („Deschide”). `related-link`s push onto a stack; back (Înapoi, Esc, Alt+←, mouse back) pops it, and the last step restores the list as it was left. The sheet reads its DTO from the one store, so it refreshes live with a pulse.

## Boundaries & Constraints

**Always:** AD-9, AD-10 (the sheet reads the DTO from the store by id; no copy), AD-13 (texts in `strings.ro.ts`, plural via `plural`, dates via `formatDate`/`formatDateTime`, reasons via `reasonTexts`), the renderer styling convention (DESIGN class names, state in `data-*`/`aria-*`, values from `tokens.css`/DESIGN component tokens, no `style` prop), the Esc dispatcher (`ESCAPE_PRIORITY.openSheet`), single keys inactive in text fields, animations off under reduced motion.

**Never:** No Markdown rendering, no clickable external link, no `open-in-browser` (entry 8). No editing, no „Editează”/„Șterge”, no E/Delete (entries 10, 12). No editable notes (entry 9). No IPC change, no main change, no browser history/router, no second store.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open | click or Enter on remove.bg in Toolbox → Imagini & video, list scrolled | sheet animates in; crumbs „Toolbox / Imagini & video / remove.bg”; window title „remove.bg — WhenKit”; status-bar hints „Esc înapoi” | none |
| All fields | tool with GitHub data, 2 categories, notes, a verification note | header (mark, name, URL as text · type · category), lead, „Când o folosesc · 4” callouts 01–04, keywords, notes (read-only); side: related, verification note, title-block „FIȘĂ · UNEALTĂ” + „rev. N”, Zonă, Tip, Adăugată, Verificată, short Id, Stele, Ultimul commit | none |
| Gaps | no related, no GitHub data, concept without link, no keywords/sources, empty notes, never verified | each empty section/rubric is absent; notes show the placeholder | none |
| Concept | umbrella with 5 children; child with a parent | content as plain text (pre-wrap), „Surse” as text; side „Concepte · 5” / „Face parte din” | missing target ids skipped |
| Stack | umbrella → click „REST API” | child opens, stack 2; Esc → umbrella; Esc → list, same zone, category, scroll, origin card focused | none |
| Cross-zone | related link to an entry of the other zone | active zone-tab follows the shown entry; back restores the origin zone | none |
| Zone switch | zone-tab or Ctrl+1/2 in the sheet | stack dropped; that zone's list with its remembered category | none |
| Search | typing in the search box from the sheet | stack dropped; list shows the results | Esc in the box with text still clears it first (priority 3) |
| Toast | single arrival, „Deschide” | that sheet opens (pushed when a sheet is open); its tape is gone in the list | multi-entry toast keeps „Vezi” only |
| Tape | open a fresh arrival | its tape, ring and „· N nou” count are gone for good | none |
| Live | open entry gets a higher revision | fields refresh in place, sheet pulses once | none |
| Vanished | open entry missing after reload | it leaves the stack; previous sheet or the list | none |
| Keys in sheet | [ ] , arrows, Enter | do nothing (list only) | none |

</frozen-after-approval>

## Code Map

- `src/desktop/renderer/app.tsx` -- owns view state; add `stack: string[]` + `origin: { zone, categoryId, searchText, scrollTop, cardId }`; when `stack` is non-empty render `SheetBar` + `EntrySheet` in place of `CategoryBar` + grid (keep `Toolbar`, `StatusBar`, `ToastHost`); `toolbar` `zone` = shown entry's zone. Register `ESCAPE_PRIORITY.openSheet` beside the search ones (L213–227); `moveCategory` no-op while a sheet is open. `document.title` from `appStrings.productName`. Pass `open` to `arrivalToasts` (L146).
- `card-grid.tsx` -- `onOpen(id)` to each card, `initialActiveId` seeds `activeId` (L107) so the origin card is the Tab stop. `entry-card.tsx` -- `onClick` and Enter (`keydown`, `code === 'Enter'`) → `onOpen`; update the stale doc comment L100–104. Selection look = `:focus-visible` (`entry-card.css` L56, L143).
- `catalog-store.ts` -- add `dismissArrival(id)`: drops it from `arrivals` (no-op when absent).
- `catalog-view.ts` L201 `arrivalToasts(arrived, onSee, onOpen)` -- single-entry toast gets action `appStrings.arrivalToastOpen` „Deschide”. Pure helpers here: `sheetCrumbs`, `shortId` (`7f3c…e21a`), sheet link lists (children, parents, related; unknown ids skipped).
- `keyboard.ts` `frameBindings` -- add `back` (`ArrowLeft` + alt, `when` sheet open). Mouse back: `mouseup`/`mousedown` with `button === 3` on `document`, `preventDefault`, in `app.tsx`.
- `status-bar.tsx` -- `keyHints` prop; `appStrings.sheetKeyHints = [{ keys: 'Esc', action: 'înapoi' }]`.
- New `sheet-bar.tsx/.css`, `entry-sheet.tsx/.css` (+ `related-link`, `title-block`, `situation-callout`, `keyword-tag`, read-only `my-notes` inside or beside it). Anatomy: DESIGN L740–754, L773–781; tokens in the DESIGN front matter L343–460 (mirror missing ones into `tokens.css`); mockup `mockups/key-fisa.html` H416–460 (reading). Reuse `Button` (`button-ghost`), `kbd.css`, lucide `ChevronLeft`, `ArrowRight`, `Pencil`, `Check`, `Flag`, `Star`.
- Responsive: `@media (max-width: 1199px)` side 300 px, `(max-width: 959px)` one column with the side below the content (as `toolbar.css` L113).
- `strings.ro.ts` -- reuse `entryStrings`, `kindLabels`, `zoneLabels`, `resourceTypeLabels`, `reasonTexts`, `formatCompact`; add sheet texts (back, crumbs label, „Concepte · N”, „Face parte din”, „Resurse înrudite · N”, title-block labels, „FIȘĂ · …”, „rev. N”, notes placeholder „Scrie aici ce vrei să-ți amintești.”, window title, „Deschide”).
- Tests: `test-fixtures.ts` `makeEntry`; fake api and store setup in `app.test.tsx`, `app-arrivals.test.tsx`.

## Tasks & Acceptance

**Execution:**
- [ ] `catalog-store.ts`, `catalog-view.ts`, `strings.ro.ts` -- `dismissArrival`, helpers, toast action, texts.
- [ ] `entry-card.tsx`, `card-grid.tsx` -- open on click/Enter, initial Tab stop.
- [ ] `sheet-bar.*`, `entry-sheet.*`, `tokens.css` -- the sheet, open animation (`motion.slide`, `motion.enter-scale`, replayed per entry), pulse (parity like the card), layout.
- [ ] `app.tsx`, `keyboard.ts`, `status-bar.tsx` -- stack, origin restore (scroll then focus with `preventScroll`), Esc/Alt+←/mouse back, zone and search exits, title, hints.
- [ ] Tests -- `entry-sheet.test.tsx` (all fields, every gap, concept lists, plain-text content); `app-sheet.test.tsx` (every matrix row from „Stack” down, title, hints); `catalog-store.test.ts` (`dismissArrival`); `catalog-view.test.ts` (crumbs, `shortId`, toast „Deschide”); `keyboard.test.tsx` (Alt+←).

**Acceptance Criteria:**
- Given the change, when `npx vitest run --maxWorkers=2`, `npm run lint`, `npm run typecheck` run, then all pass.
- Given `npm start` on the dev workspace at 720 and 1200 px, when Flow 7 steps 1, 3 and 5 are done, then the umbrella and child sheets show their fields and Esc twice returns to the Learn grid with „Tipuri de API” selected.

## Implementation Notes

- `Origin` in `app.tsx` holds only `{ scrollTop, cardId }`: the list's zone, category and search text already live in `App` state and stay untouched while a sheet shows. The tab and the toolbar placeholder follow the shown entry through a derived `shownZone`, so a cross-zone link needs no zone restore on the way back.
- Vanished entries are filtered out of the stack at render time (derived `liveStack`) and the stored stack is then normalized in an effect.
- `slotOf` and the pulse-parity rule moved from `card-grid.tsx` to `catalog-view.ts` (`entrySlot`, `pulseParity`) so the card and the sheet share them.
- The sheet focuses itself on mount (`tabIndex={-1}`, no ring), so keyboard and screen readers are in it; cards carry `data-entry-id` for the focus restore.
- Not checked by hand (no GUI in this session): `npm start` at 720 and 1200 px, Flow 7 steps 1, 3, 5.

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-20:** high 0, medium 0, low 4, false 0, maybe-false 0. Three low findings were patched and one low finding was rejected.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | The title-block hairline grid leaves an empty grey cell on most sheets (all-fields repo, never-verified tool, repo without push date) | low | patch | `entry-sheet.css` `.title-block > :nth-child(2n):last-child` counts children, but the wide `Id` rubric sits in the middle, and the grid background is `var(--line)`. Fix: drop the rule; in `TitleBlock`, the last single rubric of each group (before and after `Id`) is wide when its group is odd, plus a test. |
| 2 | Both category dots in the sheet subline take the first category's color | low | patch | `.sheet-category` spans have no `data-slot`, so they inherit `--category` from `.entry-sheet[data-slot]`. Fix: `data-slot` per span, as the `tokens.css` slot rules expect. |
| 3 | Numpad Enter does not open a card | low | patch | `entry-card.tsx` `onKeyDown` checks only `event.code === 'Enter'`; the card is a `div role="button"`, with no native activation. Fix: also accept `NumpadEnter`. |
| 4 | Clearing the search with Esc in the box while a sheet is open leaves `origin` from the results view, so the return restores a stale scroll and card in the category view | low | reject | `app.tsx` restore effect on `[sheetOpen, origin]`: real, but it needs a sheet opened from results, then the box focused and Esc; the effect is only a wrong scroll offset. The fix adds a new guard that drops the origin when the view under the sheet changes. |

## Design Notes

**Calls made in planning (the author may override at the checkpoint).** Until their entries land: notes are shown read-only (text or placeholder, no save hint); the sheet-bar has only „Înapoi” and the crumbs, and the status bar shows only „Esc înapoi”; the URL and sources are plain text and `open-in-browser` is absent (entry 8 adds it, with its narrow-layout move under the title). Typing a search from a sheet goes back to the list. The mouse back button is handled in the renderer (DOM button 3), the window title through `document.title` (Electron follows it), so main stays untouched.

**Why the origin is saved, not the list rebuilt from the stack.** The list view (zone, category, search text) already lives in `App` state and is untouched while the sheet shows; only the scroll and the origin card are lost when the grid unmounts. Saving `scrollTop` and the card id at open and restoring them in a layout effect on return is enough. A cross-zone link changes the shown zone, so `origin.zone` is restored too.

## Verification

**Commands:**
- `npx vitest run --maxWorkers=2` -- all pass (default workers crash on this machine, see deferred-work)
- `npm run lint`, `npm run typecheck` -- pass

**Manual checks (if no CLI):**
- `npm start`: open from a card and from a single-arrival toast; Flow 7 steps 1, 3, 5; an import `update` on the open entry pulses it; 720 and 1200 px.
