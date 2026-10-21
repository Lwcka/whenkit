---
title: 'Curățenie finală (refactor sweep)'
type: 'refactor'
ticket: '15'
created: '2026-10-21'
status: 'built'
baseline_revision: 'bfdff691e743e52b92f824672450552c194bb4f9'
route: 'full'
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

**Problem:** Entries 1–14 of the window epic left duplication (the same write-handler shape six times in `main/catalog.ts`, a `catalog ↔ catalog-watch` import cycle, repeated row mapping in `SqliteCatalogStore`, a fake `FrameApi` bridge and render helper copied into eight renderer test files, store/entry builders copied across `tests/`), some dead exports and parameters, two stale comments, and the deferred Vitest worker crash that makes plain `npm test` fail.

**Approach:** Behavior-preserving cleanup only: shared helpers for each duplicated shape, dead code removed, stale comments rewritten, a `maxWorkers` cap in the Vitest config. Anything that needs new behavior becomes a new ticket, recorded in `deferred-work.md`.

## Boundaries & Constraints

**Always:** No change to what the window shows or does, IPC channels and payloads, CLI output, exit codes, schemas, migrations, strings' text or CSS computed styles. Every existing test keeps its assertions: tests move onto shared helpers, never weakened or dropped; the test count after is at least the baseline count. AD-2 and the renderer import rules in `.oxlintrc.json` hold (the renderer takes core types only through `src/shared`). Contract types and schemas exported by `src/core` stay exported.

**Never:** No new behavior, no bug fixes beyond the Vitest config (the zoom-overlay and CSP-font entries in `deferred-work.md` stay deferred to entry 16). No new components that change markup (a shared `ConfirmDialog`, `FieldError`, `OpenInBrowser` on `ExternalLink`) and no merging of non-identical CSS rules. No edits to tickets, spec, architecture or UX files.

</frozen-after-approval>

## Code Map

**Main and preload** (`src/desktop/main/`):
- `catalog.ts` -- `setNotesResult` 226, `deleteEntryResult` 249, `renameCategoryResult` 276, `mergeCategoriesResult` 299, `deleteCategoryResult` 324, `patchEntryResult` 374 each validate args → `failure('ARGUMENTS_INVALID')` → `runWrite(opened, fn, emit, logError)`: one guarded-write helper. Move `runWrite` here from `catalog-watch.ts:97-127` (ends the cycle; rewrite its stale "future IPC handler" comment); fix imports in `catalog-watch.test.ts:5`, `catalog.test.ts:11`. One "log, never throw" helper for catalog.ts 53, 161, catalog-watch.ts 53, external-link.ts 22. `codeOf` stops being exported.
- `main.ts` 281-344 -- build the write context (`opened`, emit, log) once for the six write handlers; one `applyNativeTheme(window, theme)` for 403-415 / 441-444; one live-window guard for 124, 269, 440; `failure()` instead of hand-written `{ ok: false, error }` at 399, 422 and `external-link.ts` 15, 26.
- Dead parameters: `close-flush.ts:14-17` `timers`; `error-log.ts:9,56` the `error` argument of `showDialog` (and its callers/tests).
- `catalog.test.ts` -- one top-level `opened()` (now at 219, 345, 438 + inline literals) and one `storedEntry(overrides)` for 176-202, 291-319.

**Core and adapter:**
- `src/core/export-catalog.ts:174-177` -- call `catalogSnapshot(store)`. `ExportResultDto` (`src/shared/ipc.ts:101`) becomes an alias of `ExportResult`.
- `src/core/patch-entry.ts` 40-45, 131-138 and `import-batch.ts` 33-44, 80-85 -- shared zod-issues → `ErrorIssue[]` and issues-error helpers in `errors.ts`; one local helper for the zone-category check (185-193, 278-290).
- `delete-entry.ts:28-34`, `categories.ts:50-54`, `set-notes.ts:22`, `patch-entry.ts:336`, `categories.ts:84,114,180` -- one ids → DTOs helper and one "vanished" INTERNAL error helper.
- `src/adapters/sqlite/sqlite-catalog-store.ts` -- private row → `StoredEntry` mapper (290-339), a category-columns constant (228, 361, 369), a `changes > 0` helper (523, 544, 551, 630, 637), one private transaction runner for `writeTransaction`/`readTransaction` (656-682). SQL text and migrations unchanged.

**Renderer** (`src/desktop/renderer/`):
- `test-fixtures.ts` -- add `fakeFrameApi(overrides)`, an ok-write result, `renderApp(store, api)`, `okSnapshot(entries, categories)` and the shared `imagini`/`backend`/`securitate` categories; move `app*.test.tsx` (8 files) and `catalog-view.test.ts` onto them and onto `makeEntry`/`makeCategory`.
- `toast-store.ts` -- an error-toast helper for `app.tsx` 210, 224, 386, 536, `category-manager.tsx` 207, `search.ts` 52, 57.
- A `useLatest` hook for the latest-value refs (dialog.tsx 53, category-manager.tsx 175, app.tsx 329, 658, 722, my-notes.tsx 58).
- `catalog-view.ts` -- one exported zone order (26, 193; `category-manager.tsx:51`, `toolbar.tsx:11`); `toolbar.tsx:9` takes `Zone` from `src/shared`. `catalog-store.ts:121` calls `isNew`.
- `keyboard.ts` -- a has-modifier helper for card-grid.tsx 175, category-bar.tsx 112, entry-card.tsx 139.
- Repeated types: `setTheme` (title-bar.tsx 13, theme-switch.tsx 10), `CatalogStore['write']` (category-manager.tsx 44), `onSave`/`onSaveNotes` (my-notes.tsx 31, entry-sheet.tsx 58), the saving union (app.tsx 138, sheet-bar.tsx 17), the INTERNAL result (catalog-store.ts 74, my-notes.tsx 105). Row number `padStart(2,'0')` (entry-sheet.tsx 342, list-editor.tsx 80) → one helper beside `pad2` in `strings.ro.ts`; `arrivalToastMany` (strings.ro.ts 406) uses `entryCount`.
- Dead: drop `export` from `SKELETON_DELAY_MS`, `gridColumns`, `slideDuration`, `CATEGORY_SLOT_COUNT`, `MAX_CATEGORIES`; `SkeletonGrid`'s never-passed `count` prop becomes a constant.
- CSS: group the identical dot rules (`category-bar.css:115` + `category-manager.css:76`; `entry-sheet.css:137` + `:433`); move `@keyframes spin`/`.spin` to `tokens.css`, dropping `toolbar.tsx:5`'s `button.css` import only if computed styles are unchanged. `index.css:1-2` comment: reword so it covers the `.app-error*` rules.

**Tests** (`tests/`):
- `cli-harness.ts` -- export `onStore(s, fn)` typed with `CatalogStore` (copies in set-notes 24, delete-entry 35, categories-manage 23; inline in import-update 72), `concept`/`material` beside `tool` (copies in catalog-snapshot, delete-entry, export-catalog, patch-entry, search; keep differing defaults as overrides), `idsByRef(report)` (categories-manage 60, delete-entry 67, export-catalog 109). `search.test.ts:121-127` uses `testStoreOpener`; give `testStoreOpener` an ids-series option for `catalog-snapshot.test.ts:82-93` and `catalog-changed.test.ts:18-27`.

**Config:** `vitest.config.mts` -- `maxWorkers: 2` at the root `test` level; remove that entry from `_bmad-output/initiative-whenkit-mvp/deferred-work.md`.

## Tasks & Acceptance

**Execution:**
- [ ] `vitest.config.mts`, `deferred-work.md` -- worker cap; drop the fixed entry -- plain `npm test` must pass
- [ ] `src/desktop/main/*` -- write helper, `runWrite` move, safe-log, window/theme helpers, `failure()`, dead params, test fixtures -- duplication and cycle
- [ ] `src/core/*`, `src/shared/ipc.ts`, `sqlite-catalog-store.ts` -- helpers listed above -- duplication
- [ ] `src/desktop/renderer/*`, `src/shared/strings.ro.ts` -- test fixtures, helpers, types, dead exports, CSS grouping, comment -- duplication and dead code
- [ ] `tests/cli-harness.ts` + the test files listed -- shared builders -- duplication

**Acceptance Criteria:**
- Given the change, when `git diff` is read, then no IPC payload, string text, SQL statement, migration or rendered markup differs, and the only CSS changes are grouped selectors and the moved `.spin`.
- Given `npm test` with no flags, when it runs, then all tests pass and the count is at least the baseline count.
- Given `npm run lint`, `npm run typecheck`, `npm run build:cli`, when they run, then all pass, and `catalog.ts` and `catalog-watch.ts` no longer import each other.

## Implementation Notes

- The six `*Result` handlers in `catalog.ts` take a `WriteContext` (`{ opened, emit, logError? }`); `runWrite`'s callback also gets the workspace, so `patchEntryResult` fits the shared helper. The `runWrite` tests moved to `catalog.test.ts` (6 out, 6 in; count stays 1499).
- `app.tsx`: five handler refs moved below the handlers they point at, so `useLatest` starts from the real closures instead of no-ops.
- `import-links.test.ts` (not in the Code Map) also moved onto the shared `concept`/`idsByRef`; `import-rejections` and `import-verification` keep their differing local `concept`.
- Verification after the patch: plain `npm test` aborted twice (V8 heap out of memory, 25 and 1 errors) with under 1.2 GB of 16 GB RAM free; `npx vitest run --maxWorkers=1` passed 77 files / 1499 tests. The first full run (12:02, more memory free) passed plain `npm test` with the cap of 2. Lint, typecheck and `build:cli` pass.

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-21:** high 0, medium 1, low 0, false 0, maybe-false 0. Patched.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | `.sheet-category-dot` grouped with `.sheet-lead` instead of `.related-link-dot`, so the sheet header's category dots lose background and size | medium | patch | `entry-sheet.css:137-144` read as reported; jsdom loads no CSS, so tests could not catch it. Fixed by the implementer: one `.sheet-category-dot, .related-link-dot` rule with the original declarations, `.sheet-lead` restored. |

## Design Notes

Left out on purpose (would change markup, merge non-identical rules, or add surface for little gain): a shared `ConfirmDialog` and `useEscape` hook, `FieldError`, `OpenInBrowser` on `ExternalLink`, the tape and section-label CSS, the listener-subscription helper, merging string keys that share a value, the BOM-strip and theme-enum repeats, `isPlainObject` vs `isObject`, unread DESIGN-mirror tokens, and `errorDtoSchema`'s export. Test-only APIs (`Zoom.factor`, `ToastStore.clear`, `CatalogStore.load`) stay.

## Verification

**Commands:**
- `npm test` -- expected: all pass, count ≥ baseline
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors
- `npm run build:cli` -- expected: builds
