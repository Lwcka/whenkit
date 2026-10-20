---
title: 'Căutarea text'
type: 'feature'
ticket: '6'
created: '2026-10-20'
status: 'built'
baseline_revision: '1ad364477c498d59befd9d26c6b39cc45e769b32'
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

**Problem:** The window can only be browsed by category; finding a tool by the problem it solves („fundal”) needs the full-text index that the import already keeps (CAP-9, Done when 1).

**Approach:** One adapter function turns the user's text into an FTS5 query (each token `"tok"*`, joined with AND, AD-5); a core use case and the `entries:search` channel return the matching ids of both zones. The renderer filters the snapshot by them in the current zone, keeping the snapshot order (AD-10), with the search-box, the results header, „+N în Learn”, the no-result empty-state, Esc and a rerun on every catalog change.

## Boundaries & Constraints

**Always:** AD-2 (hexagon), AD-5 (the query is built only in the adapter; the user never writes FTS syntax), AD-10 (only ids cross IPC; the renderer never re-sorts), AD-13 (texts in `strings.ro.ts`, plural via `plural`), AD-18 (handler never throws; a non-string text → `ARGUMENTS_INVALID`). Renderer styling convention (DESIGN class names, state in `data-*`/`aria-*`, values from `tokens.css`, no `style` prop). Debounce = `motion.search-debounce` (150 ms, mirrored like `SKELETON_DELAY_MS`).

**Never:** No relevance ordering, no highlight or snippet, no synonym suggestions. No new migration or tokenizer change. No catalog data outside the single store (the search keeps only ids). No opening an entry from results (entry 7).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bilingual keyword | „fundal”; remove.bg has keyword „fundal”, English description | its id returned | none |
| Name, prefix, diacritics | „photopea”, „photo”, „stergere” vs „ștergere”, „ȘTERG” | match | none |
| Several words | „fundal video” | only entries holding both prefixes | none |
| FTS syntax typed | `"`, `fundal"`, `AND`, `NEAR(`, `*`, `-x`, `a:b`, `(` | treated as words, no throw | punctuation-only tokens dropped; none left → `[]` without querying |
| Blank | `""`, `"   "` | `[]`; the list shows the category from before | none |
| Results | Toolbox, „fundal” typed | after 150 ms: no chip checked, header „Rezultate pentru „fundal”” + count, cards in snapshot order, cascade | stale answers (older query) ignored |
| Other zone | 2 Learn matches | header link „+2 în Learn” → Learn, same text | 0 → no link |
| No result | none in Toolbox | empty-state „Nimic pentru „…” în Toolbox.”, „Am căutat în tot textul fișelor.”, „Sau cere-i lui Claude, în terminal: /gaseste …” | plus „+N în Learn” when the other zone has matches |
| Zone switch | text kept | same text applied to the new zone | none |
| Clear | Esc in the box with text, Esc in the list with an active search, or deleting the text | back to the category shown before | Esc priorities 3 and 1 (`ESCAPE_PRIORITY`) |
| Choose a category | chip click or [ / ] while searching | search cleared, that category shown | none |
| Catalog change | `catalog:changed` reload during a search | search reruns; a matching arrival lands with its tape | search failure → keep last results, error toast |

</frozen-after-approval>

## Code Map

- `src/adapters/sqlite/sqlite-catalog-store.ts` -- add `searchEntryIds(text)` next to `allEntries` (L308); the one exported query builder `ftsQuery(text): string | null` lives here. Join `entries_fts` (rowid = `seq`) to `entries`, filter `owner_id`, order `added_at DESC, seq ASC`. Errors via `toWhenkitError`.
- `src/core/ports.ts` L194 `CatalogReader` -- add `searchEntryIds(text: string): string[]`.
- `src/core/dto.ts` -- `searchResultDtoSchema = z.strictObject({ ids: z.array(z.string()) })` + type, like `catalogSnapshotDtoSchema` L83.
- `src/core/search-entries.ts` (new) -- `searchEntries(store, text): SearchResultDto`, pattern of `catalog-snapshot.ts`.
- `src/desktop/main/catalog.ts` -- `searchResult(opened, text: unknown, logError)` beside `snapshotResult`, reusing `failure`/`codeOf`. `main.ts` L208 -- `ipcMain.handle(IPC_CHANNELS.entriesSearch, …)`.
- `src/shared/ipc.ts` -- `entriesSearch: 'entries:search'`, export `SearchResultDto`, `WhenkitApi.searchEntries(text)`. `src/desktop/preload/preload.ts` -- bridge.
- `src/desktop/renderer/app.tsx` -- `FrameApi` gains `searchEntries`; holds the search text (one for both zones); `viewKey` includes the shown query so results cascade; header, empty-state and link; Esc handlers via `registerEscape`; `moveCategory`/`selectCategory` end the search. `renderer.tsx` passes the api.
- `src/desktop/renderer/search.ts` (new) -- `useSearch(api, text, entries)`: debounce, sequence guard, rerun when the snapshot's `entries` array changes; returns `{ query, ids } | null` (the query the shown ids answer).
- `catalog-view.ts` -- pure `searchHits(entries, ids, zone)` → `{ inZone, otherZone }`, snapshot order kept.
- `toolbar.tsx/.css` -- `search-box`: lucide `Search`, `input` (type `search`), zone placeholder, `kbd` „Ctrl K” hidden below `bp-half`; DESIGN `search-box` tokens L211, mockup `key-toolbox.html` H143–145, H379, H409.
- `category-bar.tsx` -- a no-selection state while searching (no `aria-checked="true"`, roving still reachable).
- `section-header.tsx` -- optional `action` (the „+N în …” link button). `empty-state.tsx` -- `command.lead` before the highlight, optional action.
- `keyboard.ts` `frameBindings` -- Ctrl+K and Ctrl+F (`KeyK`, `KeyF`) focus and select the box.
- `strings.ro.ts` `appStrings` L302 -- placeholders (EXPERIENCE L58), results title, other-zone link, no-result texts, search failure toast „Căutarea nu a reușit.”, search label.
- Tests: `tests/catalog-snapshot.test.ts` harness (`initialized`, `batch`, `tool`, `importReport`); `test-fixtures.ts` `makeEntry`; existing `app.test.tsx` fake api.

## Tasks & Acceptance

**Execution:**
- [ ] `ports.ts`, `sqlite-catalog-store.ts` -- `searchEntryIds` + `ftsQuery`: split on whitespace, drop tokens with no letter/digit, double inner `"`, `"tok"*`, join ` AND `.
- [ ] `dto.ts`, `search-entries.ts`, `catalog.ts`, `ipc.ts`, `preload.ts`, `main.ts` -- use case and channel.
- [ ] `search.ts`, `catalog-view.ts`, `toolbar*`, `category-bar.tsx`, `section-header*`, `empty-state*`, `keyboard.ts`, `app.tsx`, `strings.ro.ts` -- the UI.
- [ ] Tests -- `tests/search.test.ts` (temp catalog via CLI import: every adapter row of the matrix, owner scoping, `ftsQuery` outputs); `catalog.test.ts` (`searchResult` invalid argument, store throw → code); `catalog-view.test.ts` (`searchHits`); `search.test.tsx` (fake timers: debounce, stale answer dropped, rerun on new entries); `app-search.test.tsx` (results order, „+N în Learn” switches zone, empty-state texts, Esc in box and in list returns to the category before, chip click ends search, text kept across zones); `keyboard.test.tsx` (Ctrl+K/Ctrl+F focus).

**Acceptance Criteria:**
- Given the change, when `npx vitest run --maxWorkers=2`, `npm run lint`, `npm run typecheck` run, then all pass.
- Given `npm start` on the dev workspace, when Ctrl+K and „fundal” are typed in Toolbox, then remove.bg (or the dev catalog's matching entry) appears under „Rezultate pentru „fundal”” within a moment, and Esc twice returns to the category shown before.

## Implementation Notes

- One Esc already clears the search, both in the box and in the list.
- The query sent and shown in the header is the trimmed text, so a whitespace-only change does not search again.
- The empty-state shows the literal „/gaseste …”.
- The browser's own clear button in the search box is hidden, to match the mockup.
- The „+N în …” link sits in the header when the zone has hits and in the empty-state when it has none, never in both.
- Under StrictMode, the first mount skips the debounce once. This is harmless.
- `npm start` was not run, so the manual check is still open for the end of the epic.

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-20:** high 0, medium 1, low 3, false 0, maybe-false 0. Three were patched and one low finding was rejected.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | ← / → in the category bar during a search jump to „Toate”, while Tab lands on the hidden selection and [ / ] move from it | low | patch | `category-bar.tsx` `onKeyDown`: `current` is forced to -1 when `searching`, while `focusable` is still `selectedId`. Fix: drop the special case so the arrows move from the focusable chip. |
| 2 | Activating „+N în Learn” drops the focus to `<body>` | medium | patch | `app.tsx`: the link is inside `<div key={viewKey}>`, so `setZone` remounts it. The restore effect only handles `grid` and `bar`, and `focusArea` is null for a header button. Fix: set `focusArea.current = 'grid'` before switching zones. |
| 3 | A long query overflows the section header and scrolls the list horizontally | low | patch | `section-header.css`: `.section-header-name` is `nowrap` with no `min-width`, and it now holds user text. Fix: an ellipsis span plus a `title` on the header. |
| 4 | A first search that fails leaves the text in the box while the old category stays checked | low | reject | `search.ts`: `found` stays `null`, so the view stays on the category. This only happens when the IPC search fails, which means a bug, not an everyday state, and the toast says so. The fix would need a new „failed” state in the hook and the view. |

## Design Notes

**Calls made in planning (the author may override at the checkpoint).** The search returns ids of both zones in one call; the renderer splits them by the snapshot's `zone`, which gives „+N în Learn” for free. The ids live in a hook, not in the catalog store: they are a view parameter, not catalog data, so AD-10's single store stays the only holder of DTOs. The view switches to results only when the first answer arrives, and the header shows the query that answer belongs to, so header and cards never disagree; clearing is immediate. Picking a category while searching ends the search. A failed search keeps the last results and shows an error toast.

**Why tokens without letters or digits are dropped.** FTS5 turns `"-"*` into an empty phrase that matches nothing, so `fundal -` joined with AND would find nothing. Probed on node:sqlite: `"stergere"*` matches „Ștergere”, `"imag"*` matches „Îmagini”, `"remove.bg"*` matches, `""*` returns 0 without error.

```ts
ftsQuery('fundal "photo')  // → '"fundal"* AND """photo"*'
ftsQuery(' - ')            // → null
```

## Verification

**Commands:**
- `npx vitest run --maxWorkers=2` -- all pass (default workers crash on this machine, see deferred-work)
- `npm run lint`, `npm run typecheck` -- pass

**Manual checks (if no CLI):**
- `npm start`: Ctrl+K, type, results cascade; „+N în Learn” switches zone with the text kept; a `cli:dev -- import` during a search lands the matching card.
