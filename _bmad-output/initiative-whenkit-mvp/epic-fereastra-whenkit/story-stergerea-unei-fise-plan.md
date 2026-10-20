---
title: 'Ștergerea unei fișe'
type: 'feature'
ticket: '10'
created: '2026-10-21'
status: 'built'
baseline_revision: 'e55fecb729b4f600702671d424475f22af1e1c41'
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

**Problem:** An entry the user no longer wants cannot be removed from the window (CAP-10, EXPERIENCE Flow 4).

**Approach:** A core `deleteEntry` use case (links and categories go by cascade) and the `entries:delete` channel through `runWrite`. A reusable `Dialog` component (modal, focus trap, Esc, focus returns to the opener, scrim below the title bar, open animation), used first by the delete confirmation that „Șterge” in the sheet-bar and the Delete key open. On success the user is back in the list and the card collapses; on `DATABASE_BUSY` an error toast shows and the sheet stays.

## Boundaries & Constraints

**Always:** AD-4/AD-5 (only core writes), AD-10 (the write goes through the renderer store's `write`; the result says which entries changed and which one is gone), AD-13 (texts in `strings.ro.ts`, error texts from `errorMessages`), AD-18, the styling convention (DESIGN `dialog` tokens, no `style` prop), `ESCAPE_PRIORITY.dialog`, single keys inactive in text fields and while the dialog is open, animations off under reduced motion.

**Never:** No undo, no „anulează” toast, no success toast (EXPERIENCE L134, L247). No delete from the card or list. No „Editează” button (entry 12). No native `<dialog>`/`showModal` (jsdom and the title-bar drag region make it unpredictable).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Core | `deleteEntry(store, id)` on an entry with related, parent, child links and 2 categories | row, its links, its category rows and its update rejections gone; FTS no longer finds it; returns `{ removed: id, changed: [DTOs of the entries it was linked to] }` | unknown id → `ENTRY_NOT_FOUND` |
| Handler | `entries:delete` with a string id | `runWrite` → `{ ok: true, data: { changed, removed: [id] } }`, `catalog:changed` emitted | non-string → `ARGUMENTS_INVALID` |
| Open | „Șterge” or Delete in the sheet | dialog „Ștergi fișa „X”?”, text „Se șterg și legăturile ei cu alte fișe. Nu se poate anula.”, focus on „Renunță” | none |
| Trap | Tab / Shift+Tab in the dialog | focus cycles between „Renunță” and „Șterge” only | none |
| Cancel | Esc or „Renunță” | dialog closes, entry untouched, focus back on „Șterge” in the sheet-bar | Esc does not also close the sheet |
| Confirm | „Șterge” in the dialog | button busy while it runs; then back to the list: same zone, category, scroll; the card collapses (`motion.slide`), neighbours slide, counters drop; linked sheets no longer list it | none |
| Busy | answer `DATABASE_BUSY` | dialog closes, sheet stays, error toast with `errorMessages.DATABASE_BUSY` | any other failure: same with its code's text |
| Keys | Delete while the dialog is open, in a text field (notes), or in the list | nothing | none |
| Stack | entry deleted while it sits lower in the stack (opened from an umbrella) | back from the sheet lands on the umbrella, which no longer lists it | none |

</frozen-after-approval>

## Code Map

- `src/core/ports.ts` `CatalogWriter` (L221) -- add `deleteEntry(id: string): boolean` (false when no row). `src/adapters/sqlite/sqlite-catalog-store.ts` -- `DELETE FROM entries WHERE owner_id = ? AND id = ?` (`PRAGMA foreign_keys = ON` at L671 cascades `entry_categories` and `links`, migration `0001-initial.sql` L58/L69; trigger `entries_fts_delete` L155 cleans FTS). No new migration.
- New `src/core/delete-entry.ts` -- `deleteEntry(store, id): { removed: string; changed: EntryDto[] }` in one `writeTransaction`: read the entry (`entryById`, unknown → `WhenkitError('ENTRY_NOT_FOUND', { detail: id })`), collect the ids it links to (related, parents, children, from the stored entry's link fields), `deleteUpdateRejections(id)`, `writer.deleteEntry(id)`, then `toEntryDto` of each linked entry still present. Model: `src/core/set-notes.ts`, `remove-rejection.ts`. Revision of linked entries is not bumped (AD-5: cascade, not an edit). Test: new `tests/delete-entry.test.ts` (pattern `tests/set-notes.test.ts`, also `searchEntries` no longer finds it).
- `src/shared/ipc.ts` -- `entriesDelete: 'entries:delete'`; `WriteResult` gains optional `removed?: readonly string[]` (doc: ids gone from the database); `WhenkitApi.deleteEntry(id): Promise<IpcResult<WriteResult>>`. `preload.ts` -- `invoke`.
- `src/desktop/main/catalog.ts` -- `deleteEntryResult(opened, id: unknown, emit, logError)`, like `setNotesResult`; `main.ts` registers it with `notifyCatalogChanged`. Test in `catalog.test.ts`.
- `src/desktop/renderer/catalog-store.ts` -- `applyChanged` (L161) also drops the `removed` ids from `entries` (and their pulses/arrivals). Test in `catalog-store.test.ts`.
- New `src/desktop/renderer/dialog.tsx/.css` (+ test) -- `Dialog({ title, children, actions, onCancel, initialFocusRef })`: portal into `document.body`; `.dialog-scrim` fixed below the title bar (`inset: var(--spacing-titlebar-height) 0 0 0`, DESIGN L487–495 tokens, mockup `key-dialogs.html` L346–353); `.dialog` `role="dialog" aria-modal="true" aria-labelledby/aria-describedby`; Tab trap on keydown; Esc through `registerEscape(ESCAPE_PRIORITY.dialog, …)` (`keyboard.ts` L73); on unmount focus returns to `document.activeElement` captured at mount; open animation `motion.fade` + `motion.enter-scale`. Reusable by the category manager later (entry 13). Clicking the scrim does nothing.
- `src/desktop/renderer/keyboard.ts` `frameBindings` (L157) -- `Delete` (no modifiers, `when` sheet open and no dialog) → `requestDelete`. Single keys must also be inactive while a dialog is open (check how `isTextField` L99 gates them; add a dialog-open guard).
- `src/desktop/renderer/sheet-bar.tsx` -- right side: `Button variant="danger"` „Șterge” with lucide `Trash2` (DESIGN L773; „Editează” comes with entry 12). Prop `onDelete`; expose a ref so focus can return to it.
- `src/desktop/renderer/app.tsx` -- `confirmingDelete` state; renders the confirmation `Dialog` (`Button` default „Renunță” + `kbd` Esc, `Button variant="danger-solid"` `Trash2` „Șterge”, busy while running); confirm → `store.write(() => api.deleteEntry(id))`; ok → pop the stack to the list (origin restore as today) and set the collapsing card; failure → `toasts.push({ kind: 'error', message: errorMessages[code] })`, sheet stays. `FrameApi` (L48) gets `'deleteEntry'`; update the four test fakes.
- `src/desktop/renderer/card-grid.tsx/.css` -- collapse: `CardGrid` takes `leaving?: { entry, index }`; renders that card at its old index with `data-leaving` (non-interactive, `aria-hidden`) and a collapse animation (`motion.slide`, scale + opacity, then width/height to 0 as layout allows), removed on `animationend` or immediately when `slideDuration()` (L47) is 0; the existing FLIP slide (L86–102) moves the neighbours. App computes `index` from the list it showed before the delete.
- `strings.ro.ts` -- `deleteEntry: 'Șterge'`, `deleteEntryTitle(name)`, `deleteEntryBody`, `cancel: 'Renunță'` (reuse if present).

## Tasks & Acceptance

**Execution:**
- [ ] `ports.ts`, `sqlite-catalog-store.ts`, `core/delete-entry.ts` -- store method and use case, with tests.
- [ ] `ipc.ts`, `preload.ts`, `main/catalog.ts`, `main/main.ts`, `catalog-store.ts` -- channel, handler, `removed`, with tests.
- [ ] `dialog.tsx/.css`, `keyboard.ts`, `sheet-bar.tsx`, `app.tsx`, `card-grid.tsx/.css`, `strings.ro.ts`, `tokens.css` -- dialog, confirmation, collapse.
- [ ] Tests -- `dialog.test.tsx` (Trap, Esc, focus return, focus on initial ref); `app-delete.test.tsx` (Open, Cancel, Confirm incl. the linked sheet no longer listing it, Busy toast, Keys, Stack); `card-grid.test.tsx` (leaving card rendered then gone).

**Acceptance Criteria:**
- Given the change, when `npx vitest run --maxWorkers=2`, `npm run lint`, `npm run typecheck` run, then all pass.
- Given `npm start`, when an entry is deleted from its sheet, then the card collapses in the list and after a restart it is gone.

## Implementation Notes

- **Stack row.** Confirm pops only the deleted sheet: the store drops the entry, `liveStack` already filters it, so from `[umbrella, child]` the user lands on the umbrella (which no longer lists the child); from a single sheet, on the list, where the card collapses. The collapsing card (`leaving`) is set only in the single-sheet case.
- **Esc and „Renunță” while the delete runs** do nothing (the button is busy); the dialog closes when the answer arrives.
- **Keyboard guard.** While a `[role=dialog][aria-modal=true]` is in the document every binding is muted except the zoom ones (`allowInDialog`), not only the single keys.
- **Focus after a delete.** The list focuses the card that took the deleted one's place (clamped to the last).
- **`animationend`** on the leaving card is a native listener (React's `onAnimationEnd` is not wired in jsdom); with `motion.slide` at 0 the card is not drawn at all.
- **Manual checks not done** (no window in this session): the Verification list under „Manual checks”.

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-21:** high 0, medium 3, low 4, false 0, maybe-false 0. Six were patched and one low finding was rejected.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | `confirmingDelete` keeps a stale id when the shown entry changes with the dialog open; later deletes are blocked, and reopening the entry pops the dialog | medium | patch | It is reset only in cancel and after confirm. Fix: clear it when it no longer matches the shown entry, plus a test. |
| 2 | Mouse back pops the sheet behind the open modal | medium | patch | The `mouseup` handler checks only that a sheet is open, while the keyboard guard mutes Alt+←. Fix: same dialog check, plus a test. |
| 3 | A stale `leaving` survives when the deleted card was the last of its view; a later import draws its ghost | low | patch | EmptyState renders, so `onLeft` never fires. Fix: clear it when the view has no cards. |
| 4 | The grid's entrance fade on return hides most of the collapse | low | patch | `card-grid-in` 0→1 over 200 ms wraps the leaving card's 1→0. Fix: no entrance animation while a card is leaving. |
| 5 | `Dialog` wraps children in `<p>` and fixes the confirm width, so entry 13 cannot reuse it | medium | patch | The plan names the category manager as its next user. Fix: children in a `div`, plus a `size` prop. |
| 6 | Shift+Delete opens the confirmation | low | patch | The binding lacks `shift: false`. |
| 7 | Actions-row gap/margin differ from the mockup (10/6 px vs 12/4 px) | low | reject | The styling convention takes values only from tokens; 10 px and 6 px are not tokens. |

## Design Notes

**Why `removed` in `WriteResult`.** AD-10 makes own writes return what changed so the store applies it before the next reload. A delete changes the linked entries (their link lists) and removes one; `changed` alone cannot say „gone”, so an optional `removed` is added. Without it the sheet would show the deleted entry until the reload after `catalog:changed`.

**Risk raised to medium** (ticket: low): the delete is irreversible and the dialog component is shared by later tickets.

## Verification

**Commands:**
- `npx vitest run --maxWorkers=2` -- all pass (default workers crash on this machine, see deferred-work)
- `npm run lint`, `npm run typecheck` -- pass

**Manual checks (if no CLI):**
- `npm start`: delete from the sheet with the button and with Delete; Esc cancels; the card collapses; the title bar can still be dragged with the dialog open.
