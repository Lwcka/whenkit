# Rubric review — UX delta to the architecture spine (2026-10-17)

Scope: only the delta made on 2026-10-17 after the UX spec was finalized: AD-10 extension (single renderer catalog store, id/revision diff, `entries:list` order), AD-19 (`productName` WhenKit), AD-20 (window preferences owned by main, `userData` moved to `%APPDATA%\whenkit\desktop`, `window-state.json`), Stack rows (lucide-react, @fontsource/cascadia-mono), IPC channel `window:setTheme`, seed diagram updates.

Inputs checked: `ux-whenkit/EXPERIENCE.md` (State Patterns, Component Patterns `my-notes` / `conflict-banner` / `theme-switch` / `toolbar`, Responsive & Platform), `ux-whenkit/DESIGN.md` (category color slots), `spec-whenkit.md` (CAP-8..CAP-11), `epic-fereastra-whenkit.md`, and the code: `src/adapters/sqlite/migrations/0001-initial.sql`, `src/adapters/sqlite/sqlite-catalog-store.ts`, `src/core/ports.ts`, `src/core/import-batch.ts`, `src/core/dto.ts`, `src/desktop/main/main.ts`, `package.json`.

## Verdict

The delta is pointed at the right divergence points and ratifies the existing import code correctly (one `now` per batch, `seq` = batch order), but the revision-diff mechanism interacts badly with AD-5/AD-16 for writes the window itself makes (`setNotes`, category writes), and two UX surfaces the store must serve (search, categories) are left outside the store. Needs one more pass before the first epic-fereastra ticket is planned.

## Checklist

| Check | Result |
|---|---|
| Fixes the real divergence points the UX introduces | Partly. Arrivals, terminal updates, counters and ordering are fixed. Search, the category list, notes-during-edit, category-writes-during-edit, and the notes flush on close are not. |
| Every rule is enforceable and prevents its divergence | Mostly. "Own writes put the returned revision into the store before the next comparison" is a renderer timing convention that only holds for single-entry writes. "No flash in the wrong theme" names the outcome, not the mechanism. |
| Nothing under Deferred lets units diverge | Acceptable. "The store's shape is fixed by the first ticket" is fine once AD-10 fixes the semantics (see F2, F3). |
| Ratifies the existing code | Yes for `added_at` and `seq`. Watch for one trap: `CatalogReader.entrySummaries()` returns `added_at, seq` ascending, and reversing it gives `seq DESC` inside a batch, which is wrong (F7). |
| No contradiction with existing ADs | **No.** AD-5 says "`revision` increases on every write", which makes `entries:setNotes` bump `revision`. Under AD-16 and the new AD-10 diff, that produces a false `CONFLICT` and a false "modified from terminal" banner (F1). |

## Findings

### F1 — `setNotes` bumps `revision` (AD-5), so own notes cause false CONFLICT and false banners (high)

AD-5: "`entries.revision` crește la fiecare scriere (AD-16)". AD-16: `entries:setNotes` has no `expectedRevision`. EXPERIENCE `my-notes`: notes are editable "direct, mereu", also while the sheet is in edit mode, and they autosave on blur. Concrete path: Luca types a note and clicks "Editează". The blur fires `setNotes`, and the revision becomes N+1. The edit form captured `expectedRevision = N` (from the store, or before the notes reply arrived). On Ctrl+S, `entries:patch` returns `CONFLICT`, and `conflict-banner` says "Fișa a fost modificată din terminal", which is false. The same happens when a note autosaves mid-edit. AD-10's "own writes update the store revision" keeps the *list* diff quiet, but it says nothing about the *form's* `expectedRevision`. Two tickets (notes, edit form) will each be locally right and collide.

**Fix:** amend AD-5/AD-16 so that `my_notes` writes do **not** bump `revision`. `revision` then counts writes to fields that `entries:patch` or import own. This is safe because nothing else writes notes: AD-3 lets only the UI write them, and the app runs as a single instance. The diff keeps working, because notes need no "external" classification. Alternative, if the bump stays: `setNotes` returns `{ revision }`, and both the store and an open edit form fast-forward `expectedRevision` only when `returned === known + 1`. This is fragile, so not recommended.

### F2 — Category writes from the window vs. the revision diff and the open edit form (high)

`toolbar` (with "Categorii") stays visible in the sheet and in edit mode (EXPERIENCE: "Rămâne la fel în listă și în fișă"). `categories:merge`, rename and delete touch many entries. The spine does not say whether they bump `revision` on the affected entries:
- If they **bump**, a single IPC result cannot "return the revision" for N entries. Every affected card pulses as "updated from terminal", and an open edit form on one of them gets `CONFLICT` with the terminal wording.
- If they **don't bump**, an open form that still has the merged-away category selected sends a patch with a deleted category id. `entry_categories.category_id` is an FK, so the user gets `INTERNAL`, or a silent drop if a ticket filters it.

**Fix:** decide it in AD-10/AD-16. Recommended: category writes do not bump entry `revision`. `entries:patch` validates the category ids in `core` and returns a coded error (e.g. `UNKNOWN_CATEGORY`) instead of an FK failure. "Categorii" is disabled while the sheet is in edit mode. Whichever option is chosen, generalize "own writes return a revision" to "own writes return the `{id, revision}[]` they changed".

### F3 — Search and the category list sit outside the "single store" (high)

AD-10 says that toast, tape, counters and sheet read *only* from the store, and that the store holds `entries:list`. But:
- **Search** (CAP-9, AD-5: one FTS query function in the adapter; EXPERIENCE: relevance order, "+N în Learn", reruns on arrival). No IPC channel is named, and "Renderer-ul nu reordonează" contradicts relevance order. One ticket will filter the store client-side, which breaks AD-5 semantics and the bilingual keyword match via FTS. Another will call FTS and reorder.
- **Categories:** the bar shows zero-count categories, `category-manager` "se actualizează live dacă un import creează categorii", and colour slots come from the id order per zone (DESIGN.md). None of these is derivable from entries alone, and no `categories:list` read is named. If a ticket fetches categories outside the store, chip counts and dialog counts can come from different moments.

**Fix:** add to AD-10:
- The store holds `{ entries, categories }`, reloaded together on `catalog:changed` from one IPC read in one read transaction.
- Search is `entries:search { text }`, which returns ranked ids for **both** zones. The renderer joins them with the store, keeps the rank order (the only permitted reordering), and reruns the search on every `catalog:changed`.

### F4 — Shared `userData` between dev (`npm start`) and the installed app; single-instance lock ordering (medium-high)

AD-20 moves `userData` to a fixed `%APPDATA%\whenkit\desktop`, for both the packaged build and `npm start`. EXPERIENCE requires a single instance ("a doua pornire aduce fereastra existentă în față"), and the author keeps the installed app open "tot timpul". Chromium's process-singleton lock and its profile (cache, LevelDB) are keyed by the user-data dir. With the installed WhenKit running, `npm start` would hand off to the installed window and quit, or contend for the cache locks. That breaks the dev/real separation that AD-19 protects. In addition, `requestSingleInstanceLock()` must run *after* `app.setPath('userData')`, and nothing orders the two.

**Fix:** in AD-20, use `%APPDATA%\whenkit\desktop\` when `app.isPackaged` and `%APPDATA%\whenkit\desktop-dev\` otherwise, so dev also gets its own `window-state.json`. Fix the boot order as: squirrel check, `setPath`, `requestSingleInstanceLock`, `ready`.

### F5 — Notes "save on leaving the app" needs a close handshake owned by main (medium)

EXPERIENCE `my-notes`: autosave "la ieșirea din câmp, din fișă sau din aplicație". The window close path will be written by the AD-20 ticket (it saves bounds on `close`), while the notes flush belongs to the notes ticket. An async `invoke` from `beforeunload` is not guaranteed to complete. Without a rule, the two tickets will not meet.

**Fix:** add to AD-20 (or AD-10) that main intercepts `close`, sends a flush request to the renderer, waits for its ack (with a timeout), and then writes `window-state.json` and closes.

### F6 — `window-state.json` details that two tickets will each guess (medium)

- `theme: 'light' | 'dark'` is mandatory. The bounds ticket (which writes on close) must then write *some* theme, which freezes the Windows theme after the first run, even if the user never toggled. **Fix:** `theme: 'light' | 'dark' | 'system'`, defaulting to `system`.
- The rule has no handling for a corrupt or unknown file, or for bounds on a monitor that is gone. **Fix:** an invalid file means defaults, never `app-error`; bounds that land off every display are dropped; store `maximized` too.
- "No flash" is an outcome, not a mechanism. **Fix:** main sets the `BrowserWindow` `backgroundColor` and `nativeTheme.themeSource` (native dialogs, scrollbars, `titleBarOverlay`) from the resolved theme, and passes the theme to the sandboxed preload via `additionalArguments`.
- The version constant belongs in `src/core/versions.ts`, according to the Formats convention. State it explicitly, because the file is read in main.

### F7 — Ordering ratification trap and read consistency (low)

`CatalogReader.entrySummaries()` is ordered `added_at, seq` ascending (sqlite-catalog-store.ts:293). `entries:list` needs `added_at DESC, seq ASC`, which is **not** the reverse of that order. A ticket that calls `.reverse()` flips each batch. In the same function, the entries, categories and links are read with separate statements outside a read transaction, so the list can mix two snapshots during an import. **Fix:** in AD-10, state that the order is applied in SQL by the store (or by a single `core` function), and that `entries:list` reads in one read transaction, as AD-12 already requires for export.

### F8 — Minor (low)

- Removal (an id missing from the reloaded list) is not classified. Only the window deletes entries, so this is benign, but say so.
- The store must always *adopt* the reloaded data. `revision` only classifies. Otherwise a ticket might refresh only bumped entries and miss changes to `relatedIds` or `childIds` on entries whose revision did not change (an import update of A rewrites B's related list without bumping B, and so does a delete). The same applies to an open sheet's content refetch.
- The `arrival-tape` relative time should be computed from `addedAt`, which matches `status-bar` "ultima adăugată", not from the moment of detection.
- The Stack versions for lucide-react and @fontsource/cascadia-mono are not yet in `package.json` and are unverified here. The CSP needs `font-src 'self'`.
- `productName` is still `whenkit` in `package.json` and the title is `'whenkit'` in `main.ts`. This is expected before the epic, but the first desktop ticket should change both.
