---
title: 'Gestionarea categoriilor'
type: 'feature'
ticket: '13'
created: '2026-10-21'
status: done
baseline_revision: '8ec65f6b4e1100ab8af1aa858f6b4c4802efbfe0'
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

**Problem:** Categories come only from imports and cannot be renamed, merged or removed, so the user cannot tidy them (CAP-11, EXPERIENCE Flow 5).

**Approach:** Core use cases `renameCategory`, `mergeCategories`, `deleteCategory` (AD-5) on channels `categories:rename`, `categories:merge`, `categories:delete` through `runWrite`. The toolbar gets „Categorii”, which opens a wide dialog `category-manager` (Toolbox and Learn sections, rename in place, „Unifică…” and „Șterge” through confirmations that replace the manager and return to it).

## Boundaries & Constraints

**Always:** AD-5 (unique `(owner_id, zone, name_key)` via `nameKey` from `core/name-key.ts`; merge only within a zone; deleting the only category of some entries needs a target and becomes a merge; merge/delete bump `revision` on the affected entries, rename does not), AD-3 (only core writes), AD-10 (writes through the store's `write`; the result carries what changed), AD-13 (texts and plurals in `strings.ro.ts`), AD-18, the styling convention (DESIGN `category-manager` tokens into `tokens.css`), Esc priorities, focus returns to the opener.

**Never:** No category creation from the UI. No reordering (the bar stays alphabetical). No change to the import's category rules. No undo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rename | „Mockup-uri & capturi de cod” → „Mockup-uri” | every entry with it shows the new name; their `revision` unchanged; color kept | same name_key in the zone (other id) → `CATEGORY_NAME_TAKEN`; empty → `ARGUMENTS_INVALID`; unknown → `CATEGORY_NOT_FOUND` |
| Rename case | „mockup-uri” → „Mockup-uri” (same key, same id) | saved | none |
| Merge | source with 3 entries → target, same zone | source gone; entries carry the target once (no duplicate when they had both); affected `revision + 1` | other zone or same id → `ARGUMENTS_INVALID`; unknown → `CATEGORY_NOT_FOUND` |
| Delete empty | 0 entries | category gone | none |
| Delete shared | every entry with it also has another | removed from them, `revision + 1` on them; category gone | none |
| Delete sole | some entries have only it, no target | nothing written | `CATEGORY_TARGET_REQUIRED` |
| Delete with target | same as above with a target of the same zone | behaves as Merge | other zone → `ARGUMENTS_INVALID` |
| Manager | „Categorii” in the toolbar | dialog „Categorii”, text „Categoriile noi apar doar din import.”, sections Toolbox and Learn, rows alphabetical (ro): dot, name, count („3 fișe”), „Redenumește”, „Unifică…”, „Șterge”; „Închide” + Esc | none |
| Rename UI | „Redenumește”, type, Enter | row becomes a text field (Enter salvează · Esc renunță); Enter saves; Esc cancels the rename only (a second Esc closes the manager) | taken: „Există deja „X” în Toolbox. Folosește „Unifică…”.” under the row, still renaming |
| Merge UI | „Unifică…” | confirmation replaces the manager: title „Unifică „S””, select „Mut fișele în” (same zone, not S, alphabetical, placeholder „Alege o categorie”), consequence „Mut cele 3 fișe în „T” și șterg „S”?” (plural forms), „Unifică” danger-solid disabled until chosen; Esc/„Renunță” → back to the manager | zone with no other category: „Unifică…” disabled |
| Delete UI | „Șterge” on a category with sole entries | confirmation „Ștergi „S”?” + „1 fișă are doar categoria asta. Alege unde o muți, ca să nu rămână fără categorie.” + required select; „Șterge” disabled until chosen | without sole entries: no select |
| Busy | any write answers `DATABASE_BUSY` (or another code) | error toast `errorMessages[code]`; dialog stays | none |
| Live | an import adds a category while the manager is open | it appears in its section | none |
| Bar | the zone's active category is merged or deleted | the bar shows „Toate” for that zone; counts right | none |

</frozen-after-approval>

## Code Map

- `src/core/ports.ts` -- reader: `entryIdsWithCategory(categoryId): string[]`, `categoryById(id): StoredCategory | undefined`. Writer: `renameCategory(id, name, nameKey)`, `deleteCategory(id)`, `bumpRevisions(entryIds)`. `sqlite-catalog-store.ts` -- SQL beside `categoriesInZone` L226 / `insertCategory` L403 / `replaceEntryCategories` L506; `entry_categories.category_id` has **no** cascade (migration L57–61): rows must be moved or removed before `DELETE FROM categories`. Unique violation on rename is prevented by a core check, not caught.
- New `src/core/categories.ts` -- `renameCategory(store, { id, name })`, `mergeCategories(store, { sourceId, targetId })`, `deleteCategory(store, { id, targetId? })`, each one `writeTransaction`, each returning `{ changed: EntryDto[]; categories: CategoryDto[] }` (the entries that carry or carried the category, as stored after the write; the full category list via `allCategories`). Merge: per affected entry, the new set = its ids with source replaced by target, deduplicated, then `replaceEntryCategories` + `bumpRevisions`. Delete without target: remove the category from entries that keep another (`replaceEntryCategories`), `bumpRevisions`; `targetId` given → merge. Model: `src/core/delete-entry.ts`, `patch-entry.ts` (issues).
- `src/core/errors.ts` -- `CATEGORY_NOT_FOUND`, `CATEGORY_NAME_TAKEN`, `CATEGORY_TARGET_REQUIRED`; add them to `src/cli/exit-codes.ts` (L14–32, `EXIT_INVALID_INPUT`) and `errorMessages` (`strings.ro.ts` L50–82).
- `src/shared/ipc.ts` -- channels; `WriteResult` gains optional `categories?: readonly CategoryDto[]` (the full list after the write); `WhenkitApi.renameCategory`, `mergeCategories`, `deleteCategory`. `preload.ts` -- `invoke`. `main/catalog.ts` -- three `…Result` handlers like `deleteEntryResult` (L168–186); `main.ts` registers them (L282 pattern).
- `src/desktop/renderer/catalog-store.ts` `applyChanged` L165–188 -- when `categories` is present, replace `state.categories`. Test in `catalog-store.test.ts`.
- `toolbar.tsx` -- `Button` „Categorii” (lucide `Layers`, icon-only with tooltip under the narrow breakpoint as the other toolbar buttons per EXPERIENCE L224) with `onOpenCategories`; disabled with the rest of the toolbar in edit mode.
- `dialog.tsx/.css` -- `size: 'confirm' | 'wide'` (`.dialog[data-size='wide']` = `--category-manager-width`, L41–42 pattern); the Dialog's Esc handler takes an optional `escapeActive` / lets a child register a higher priority: add `ESCAPE_PRIORITY.renaming` above `dialog` in `keyboard.ts` for the rename row.
- New `category-manager.tsx/.css` (+ test) -- reads `categories`, `entries` from the store (live); counts via `categoryCounts` (`catalog-view.ts` L50), order via `barCategories` (L40), dots via `categorySlots` (L22). States: list | renaming `{ id, text, error }` | confirm `{ kind: 'merge' | 'delete', id, targetId }`. Confirm content uses `SelectField` (`select-field.tsx`; add an optional `placeholder` option) and `Dialog size="confirm"`. Writes via a prop `onWrite(run)` = `store.write`; failure → toast. Mockup `key-dialogs.html` screens 01–03 (L406–722), CSS L349–371. Tokens DESIGN L496–503 → `tokens.css`.
- `app.tsx` -- `managingCategories` state; open from the toolbar; render `CategoryManager` (focus returns to „Categorii”). Active category fallback: if a zone's remembered category id is no longer in `state.categories`, use „Toate” (check where the category per zone is kept).
- `strings.ro.ts` -- manager title/intro, section labels (reuse `zoneLabels`), `rename`, `merge: 'Unifică…'`, `delete`, `close: 'Închide'`, rename hints, `categoryNameLabel: 'Numele categoriei'`, `nameTaken(name, zone)`, merge title/consequence (`plural` L244: 1 → „Mut fișa în „T” și șterg „S”?”; 0 → „Șterg „S”. Nu are fișe.”; n → „Mut cele {n} fișe / de fișe în …”), delete title, `soleEntries(n)`, `chooseCategory: 'Alege o categorie'`, `moveTo: 'Mut fișele în'`.

## Tasks & Acceptance

**Execution:**
- [ ] `ports.ts`, `sqlite-catalog-store.ts`, `core/categories.ts`, `errors.ts`, `exit-codes.ts` -- store methods and use cases.
- [ ] `ipc.ts`, `preload.ts`, `main/catalog.ts`, `main.ts`, `catalog-store.ts` -- channels and `categories` in `WriteResult`.
- [ ] `dialog.tsx`, `keyboard.ts`, `select-field.tsx`, `category-manager.tsx/.css`, `toolbar.tsx`, `app.tsx`, `strings.ro.ts`, `tokens.css` -- the manager.
- [ ] Tests -- `tests/categories-manage.test.ts` (core rows Rename … Delete with target, revision checks, no duplicate rows, FTS still finds entries by the new name if the index covers categories); `catalog.test.ts` handlers; `category-manager.test.tsx` and `app-categories.test.tsx` (UI rows: Manager, Rename UI incl. two-step Esc, Merge UI, Delete UI, Busy, Live, Bar).

**Acceptance Criteria:**
- Given the change, when `npx vitest run --maxWorkers=2`, `npm run lint`, `npm run typecheck` run, then all pass.
- Given `npm start`, when Flow 5 steps 1–5 are done, then counters are right and no entry is left without a category.

## Implementation Notes

- Rename trims and collapses spaces, and checks the unique `(zone, name_key)` in core; no SQL unique violation is caught. A given `targetId` always makes a delete a merge.
- `applyChanged` replaces `state.categories` whenever a write returns `categories`, even with no entry changed. The existing per-zone category fallback already returns to „Toate” when the active category disappears.
- The FTS index does not cover categories; the rename test only checks that content search is intact.
- The manager's two `Dialog`s carry different `key`s; otherwise React reuses the instance and the new dialog never takes focus.
- The merge consequence appears once a target is chosen (immediately for 0 entries), because the select has no preselected value.
- The taken-name message shows the existing category's stored name, matched in the renderer ignoring case and accents (the renderer cannot import `core/name-key`); core stays the authority.
- Not checked by hand (no window in this session): Flow 5 with `npm start`, two-step Esc.

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-21:** high 0, medium 1, low 3, false 0, maybe-false 0. All four were patched.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | After a failed rename, merge or delete, focus is left on `<body>` | medium | patch | The rename field and the danger button are disabled while busy, so Chromium drops their focus, and nothing refocuses them on failure. Fix: refocus the field or the confirmation's control, plus assertions. |
| 2 | Raw gaps and paddings in `category-manager.css` and `toolbar.css`; DESIGN's manager typography tokens not mirrored | low | patch | They break the styling convention. Fix: tokens. |
| 3 | Deleting the only category of a zone that some entries hold alone opens a dead-end confirmation | low | patch | The select has no option, so „Șterge” never enables. Fix: disable the row's „Șterge” there, with a tooltip. |
| 4 | „Există deja „X”” shows the typed name, not the existing category's | low | patch | The stored name is the one „Unifică…” points to. Fix: look it up by `name_key`. |

## Design Notes

**Calls made in planning.** Channel names `categories:rename|merge|delete` (AD-5 names only `categories:merge`). Three new codes so the UI can tell a taken name and a missing target from a bad argument. The merge confirmation uses the same required select with „Alege o categorie” as the delete one (EXPERIENCE gives the placeholder only for delete), so neither confirmation preselects a destination. Consequence texts for 0 and 1 entries are written here.

**Why `categories` in `WriteResult`.** The store keeps categories only from the snapshot; without the list in the result, the manager would show the old name until the reload after `catalog:changed`.

## Verification

**Commands:**
- `npx vitest run --maxWorkers=2` -- all pass (default workers crash on this machine, see deferred-work)
- `npm run lint`, `npm run typecheck` -- pass

**Manual checks (if no CLI):**
- `npm start`: Flow 5 steps 1–5 and failures A and B; two-step Esc in a rename.
