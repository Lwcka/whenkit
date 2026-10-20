---
title: 'Notițele mele'
type: 'feature'
ticket: '9'
created: '2026-10-21'
status: 'built'
baseline_revision: '1b23ab5d1f3edea11596ad013ac88fd003241b1d'
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

**Problem:** „Notițele mele” are read-only in the sheet, and nothing writes `my_notes`, so the user cannot keep their own notes on an entry (CAP-10, EXPERIENCE `my-notes` L102).

**Approach:** A core `setNotes` use case and the `entries:setNotes` channel (no `expectedRevision`, `revision` unchanged, AD-16) through the existing `runWrite` helper. In the sheet, `my-notes` becomes a directly editable text area that saves itself after a 600 ms pause, on blur, when the sheet or entry changes, and when the window closes (AD-20: main asks the renderer to flush, waits at most 3 s, then saves window-state and closes).

## Boundaries & Constraints

**Always:** AD-4/AD-5 (only core writes, through `CatalogStore`), AD-16, AD-18 (handlers never throw), AD-10 (the write goes through the renderer store's `write`, so the returned DTO is applied before the reload), AD-13 (texts in `strings.ro.ts`), the styling convention (DESIGN `my-notes` tokens mirrored in `tokens.css`, no `style` prop), reduced motion turns the fade off. Notes are plain text, stored exactly as typed.

**Never:** No save button, no edit mode, no Markdown in notes. No `revision` bump, no pulse, no change to the fields Claude writes. No edit/delete of other fields (entries 10–12). No file watcher.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Core write | `setNotes(store, id, 'x')` | `my_notes = 'x'`; `revision`, `verified_at`, Claude fields unchanged; returns the entry's DTO | unknown id → `ENTRY_NOT_FOUND` |
| Import after | notes set, then `whenkit import` `update` of that entry | notes still `'x'` | none |
| Handler | `entries:setNotes` with `(id, text)` strings | `runWrite` → `{ ok: true, data: { changed: [dto] } }`, `catalog:changed` emitted | non-string id/text → `ARGUMENTS_INVALID`; catalog not open → its code |
| Pause | typing, then 600 ms idle | one `setNotes`; header „Se salvează…” then „Salvat” (≥ 800 ms), then the hint | none |
| Blur / leave | blur, Esc back, a related link, zone switch | pending text saved at once (no wait for the pause) | none |
| Unchanged | focus and blur without changes | no write | none |
| Failure | `setNotes` answers `ok: false` | text kept; header „Nu s-a salvat. Încerc din nou.” (error color); retried every 3 s until it succeeds | retry stops when the entry vanishes |
| Live refresh | terminal update while the field has focus or a save is pending | local text kept; other fields refresh | none |
| Live refresh idle | terminal update, field idle | field shows the DTO's notes | none |
| Close | window closed with a pending save | the save is written, then window-state, then the window closes | renderer silent → closes after 3 s anyway |
| Close idle | nothing pending | renderer answers at once; closes | none |
| Keys | `[`, `]`, `E` typed in the field | they type text (single keys inactive in text fields) | none |

</frozen-after-approval>

## Code Map

- `src/core/ports.ts` L221 `CatalogWriter` -- add `setEntryNotes(id: string, notes: string): boolean` (false when no row; never touches `revision`). Fix the `EntryUpdateRow` doc (L164) so it says `updateEntry` never touches notes, `setEntryNotes` does.
- `src/adapters/sqlite/sqlite-catalog-store.ts` L457 `updateEntry` -- beside it, `setEntryNotes`: `UPDATE entries SET my_notes = ? WHERE owner_id = ? AND id = ?`, return `changes > 0`. Tests in `tests/catalog-store.test.ts` (L504/L532 use raw SQL as a stand-in: switch them to the method).
- New `src/core/set-notes.ts` -- `setNotes(store, id, notes): EntryDto`: one `writeTransaction`; `setEntryNotes` false → `throw new WhenkitError('ENTRY_NOT_FOUND', { detail: id })`; return `toEntryDto(writer.entryById(id)!)`. Model: `src/core/remove-rejection.ts`. Test: new `tests/set-notes.test.ts` (Core write, Import after; pattern `tests/rejections-remove.test.ts`, helpers in `tests/helpers.ts`; `tests/import-update.test.ts` L74 raw SQL may switch to `setNotes`).
- `src/shared/ipc.ts` -- channels `entriesSetNotes: 'entries:setNotes'`, `windowFlushNotes: 'window:flushNotes'` (main → renderer), `windowNotesFlushed: 'window:notesFlushed'` (renderer → main); `WhenkitApi.setNotes(id, notes): Promise<IpcResult<WriteResult>>`, `onFlushNotes(flush: () => Promise<void>): () => void` (docs: preload awaits `flush`, then sends `notesFlushed`).
- `src/desktop/preload/preload.ts` -- `setNotes` via `invoke`; `onFlushNotes` like `onCatalogChanged` (L15), handler `async () => { try { await flush() } finally { ipcRenderer.send(windowNotesFlushed) } }`.
- `src/desktop/main/catalog.ts` -- `setNotesResult(opened, id: unknown, notes: unknown, emit, logError)`: argument check as `searchResult` (L90), then `runWrite` (`catalog-watch.ts` L103) with `store => ({ changed: [setNotes(store, id, notes)] })`. Test in `catalog.test.ts`.
- New `src/desktop/main/close-flush.ts` (+ test, fake timers) -- `waitForNotesFlush({ request, onReply, timeoutMs }): Promise<'flushed' | 'timeout'>`; `onReply(cb)` returns an unsubscribe; resolves once, cleans its listener and timer.
- `src/desktop/main/main.ts` L173 `close` handler -- first `close`: `preventDefault`, `waitForNotesFlush` with `request = () => webContents.send(windowFlushNotes)`, `onReply` = `ipcMain.on(windowNotesFlushed)` filtered on `event.sender === window.webContents`, `NOTES_FLUSH_TIMEOUT_MS = 3000`; then set a `flushed` flag and `window.close()`. Second `close` (flag set) runs `saveState` as today. A destroyed `webContents` skips the wait. Register `entries:setNotes` beside the others with `notifyCatalogChanged` (L250) as `emit` (move its definition above the handlers if needed).
- New `src/desktop/renderer/notes-flush.ts` -- registry: `registerNotesFlush(fn: () => Promise<void>): () => void`, `flushAllNotes(): Promise<void>` (awaits every registered fn, errors swallowed). `renderer.tsx` -- `window.whenkit.onFlushNotes(flushAllNotes)`.
- New `src/desktop/renderer/my-notes.tsx/.css` -- `MyNotes({ entryId, notes, onSave })`, rendered by `entry-sheet.tsx` L339 in place of the read-only section, keyed by `entry.id`. `<textarea>` labelled by the heading, `placeholder = appStrings.notesPlaceholder`, `field-sizing: content`, `caret-color: var(--my-notes-caret)`. State: local text, `lastSaved`, status `hint | saving | saved | error`; header right side in `role="status"`: hint „se salvează singure · doar tu scrii aici” / „Se salvează…” / „Salvat” (fade `motion.quick`) / error. Timers: autosave 600 ms, saved min 800 ms, retry 3 s (constants beside `SKELETON_DELAY_MS` style, mirroring `tokens.css`). Shows `notes` prop when not focused and nothing pending. Unmount and blur flush; registers itself in `notes-flush.ts` while mounted. Move the `.my-notes*` rules from `entry-sheet.css` L349–375 here.
- `src/desktop/renderer/entry-sheet.tsx` -- prop `onSaveNotes(id, notes): Promise<IpcResult<WriteResult>>`; `app.tsx` passes `(id, notes) => store.write(() => api.setNotes(id, notes))` (`catalog-store.ts` L230 `write`). `FrameApi` (L48) gets `'setNotes'`; update the four test fakes.
- `tokens.css` -- `--my-notes-*` from DESIGN L429–437 (background, border, heading, hint, error, caret, radius).
- `strings.ro.ts` -- `notesHint`, `notesSaving`, `notesSaved`, `notesSaveFailed`; update the `notesPlaceholder` doc (L414, no longer read-only).

## Tasks & Acceptance

**Execution:**
- [ ] `ports.ts`, `sqlite-catalog-store.ts`, `core/set-notes.ts` -- store method and use case, with tests.
- [ ] `ipc.ts`, `preload.ts`, `main/catalog.ts`, `main/close-flush.ts`, `main/main.ts` -- channels, handler, close flush, with tests.
- [ ] `notes-flush.ts`, `my-notes.tsx/.css`, `entry-sheet.tsx/.css`, `app.tsx`, `renderer.tsx`, `tokens.css`, `strings.ro.ts` -- the editable notes.
- [ ] Tests -- `my-notes.test.tsx` with fake timers (Pause, Blur/leave incl. unmount, Unchanged, Failure + retry, Live refresh, Live refresh idle, Keys via `app-sheet.test.tsx` if simpler); `notes-flush.test.ts`; `close-flush.test.ts` (flushed, timeout, single resolve).

**Acceptance Criteria:**
- Given the change, when `npx vitest run --maxWorkers=2`, `npm run lint`, `npm run typecheck` run, then all pass.
- Given `npm start`, when a note is typed and the window is closed within 600 ms, then after a restart the note is there.

## Implementation Notes

- `setNotes` guards the post-write read with an `INTERNAL` error instead of a non-null assertion.
- `catalog.ts` now imports `runWrite` from `catalog-watch.ts`, which already imports `codeOf`/`failure` from `catalog.ts`: a cycle between two function-only modules, harmless at runtime and in lint.
- `MyNotes.save()` is the single path (pause, blur, unmount, retry, window flush): it serializes writes, so a text typed during a write is saved after it. After review: a failed save keeps retrying after the field unmounts, until it succeeds or the entry is gone, and stays registered for the close flush until it settles. A reopened sheet of the same entry while such a retry runs shows the DTO's notes until the retry lands.
- Not run: `npm start` (needs the window); the manual checks in Verification remain.

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-21:** high 0, medium 2, low 3, false 0, maybe-false 0. Three were patched and two low findings were rejected.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | The header can stay on „Se salvează…” with no write in flight | medium | patch | A save of 'a' is in flight, the user types 'ab', and the success path schedules an autosave without leaving 'saving'. Deleting the 'b' then clears the timer; `save()` only resets 'error'. Fix: no 'saving' without a write in flight or a pending autosave, plus a test. |
| 2 | „Salvat” can show for less than 800 ms when a new save starts | low | reject | Only when a second save starts within 800 ms of the first success (one more key, then a blur). Cosmetic; the fix adds a deferred status switch. |
| 3 | A save that fails after the field unmounted is never retried, so the text is lost | medium | patch | The `mounted.current` guard skips the retry; this contradicts the Failure row. Fix: keep retrying after unmount until success or `ENTRY_NOT_FOUND`, still registered for the close flush. |
| 4 | A `DATABASE_BUSY` notes save shows no error toast (EXPERIENCE L133) | low | reject | EXPERIENCE L131 sets the notes failure specifically: inline header plus automatic retry. With #3 the text is never lost; a busy lock beyond the 2 s busy timeout is rare. |
| 5 | The `EntryUpdateRow` doc sentence is garbled and overlong | low | patch | The parenthesis splits the list. Fix: two wrapped sentences. |

## Design Notes

**Calls made in planning (no source fixes them).** Retry every 3 s (fixed, no backoff: a local SQLite write fails only on a lock or a closed catalog). Close waits at most 3 s: the store's busy timeout is 2 s (`DESKTOP_BUSY_TIMEOUT_MS`), so one locked save still fits. The blinking caret is the native one, colored with `caret-color` (CSS cannot time it; `motion.caret-blink` stays documentation).

**Why a reply channel and not `invoke`.** Main starts the exchange, and `ipcRenderer.invoke` only goes renderer → main. So main `send`s `window:flushNotes` and listens for `window:notesFlushed` from that window's `webContents`, with a timeout so a hung or crashed renderer never keeps the window open.

## Verification

**Commands:**
- `npx vitest run --maxWorkers=2` -- all pass (default workers crash on this machine, see deferred-work)
- `npm run lint`, `npm run typecheck` -- pass

**Manual checks (if no CLI):**
- `npm start`: type a note, wait for „Salvat”; type and close at once, restart, the note is there; `whenkit import` update of that entry leaves it.
