---
title: 'Fereastra vede importurile'
type: 'feature'
ticket: '5'
created: '2026-10-20'
status: 'built'
baseline_revision: '897b671f79ec3428f6094a80f7bd931001dfb218'
route: 'full'
route_source: 'auto'
risk: 'high'
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

**Problem:** The window reads the catalog once at startup; a `whenkit import` run from the terminal next to it stays invisible until a restart. Seeing entries land live is the core of Flow 2 (Done when 4).

**Approach:** Main polls `PRAGMA data_version` on its single connection and sends `catalog:changed`; a write helper for future IPC writes emits it too and returns the changed `EntryDto`s. The renderer store reloads and replaces the snapshot, classifies arrivals and updates by `id`/`revision` against a once-per-process baseline (AD-10), and the list shows them: landing card with ring and tape, pulse on updates, „· N nouă/noi” in the header, one arrival toast per zone.

## Boundaries & Constraints

**Always:** AD-2, AD-9, AD-10 (snapshot replaced whole; lower revision keeps the store's DTO; renderer never re-sorts), AD-13 (texts in `strings.ro.ts`, plural via `plural`), AD-18 (handlers and the helper never throw), the renderer styling convention (DESIGN class names, state in `data-*`/`aria-*`, values from `tokens.css`, no `style` prop). Electron-free main logic in its own module, tested with fake timers. Animations off under `prefers-reduced-motion` (tokens already zero them).

**Never:** No file watchers. No IPC write channel yet (entries 8–12 add them through the helper). No „Deschide” action on the single-entry toast and no tape removal on open (entry 7). No search rerun (entry 6). No `localStorage`, no state library, no second store.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First load | snapshot of 12 entries | ready, no arrivals, no toasts, no pulses | error first, success later → that success is the baseline |
| Arrival | reload has a new id in the current view | card first in the grid with `entry-card-new` + tape „ADĂUGAT · ACUM 3 S”, lands animated; header „8 fișe · 1 nouă”; tab, chip and status-bar counters grow | none |
| Arrival elsewhere | new id in the other zone / another category | no card change in view; toast still shown; counters grow | none |
| Update | known id, higher revision | DTO replaced in place, card pulses once (`motion.pulse`), no toast | none |
| Lower revision | snapshot revision < known | store keeps its own DTO for that id | none |
| Own write | `store.write(...)` resolves with `changed` rev 5; then `catalog:changed` with rev 5 | changed DTOs applied first; no pulse, no arrival | `catalog:changed` during a pending write waits for it |
| Toasts | batch: 5 Toolbox + 1 Learn | two toasts, Toolbox first: „**5 fișe noi** în Toolbox” + „Vezi” (→ Toolbox, Toate); „Fișă nouă: **Webhook** · Learn / Backend & API-uri”, no action | entry without categories → „· Learn” only |
| Tape life | arrival older than `motion.tape-lifetime` (600 s) | tape, ring and „· N nou” gone; relative time „acum 3 s” → „acum 2 min” meanwhile | none |
| Removed | id missing from reload | gone from grid and counters | none |
| Poll | other connection commits | `catalog:changed` within one interval (2 s) | read throws → logged once per failure streak, polling continues |
| Bursts | two `catalog:changed` during one reload | one more reload after it, never parallel | snapshot error on reload → keep last ready state, error toast |

</frozen-after-approval>

## Code Map

- `src/core/ports.ts` L260 `CatalogStore` -- add `dataVersion(): number`; `src/adapters/sqlite/sqlite-catalog-store.ts` L578–595 next to `readTransaction` -- implement with `PRAGMA data_version`.
- `src/desktop/main/catalog.ts` -- `openDesktopCatalog`, `snapshotResult`, `codeOf` (reuse for the helper); add the watcher and `runWrite` here or in `catalog-watch.ts` beside it (Electron-free).
- `src/desktop/main/main.ts` L208–214 (handlers), L245 (`will-quit` closes the store: stop polling first) -- start polling after `createWindow`, send to `mainWindow.webContents` when alive.
- `src/shared/ipc.ts` -- `IPC_CHANNELS.catalogChanged = 'catalog:changed'`; `WriteResult = { changed: readonly EntryDto[] }`; `WhenkitApi.onCatalogChanged(listener): () => void`. `src/desktop/preload/preload.ts` -- `ipcRenderer.on`/`removeListener`.
- `src/desktop/renderer/catalog-store.ts` -- the only store (AD-10); extend `ready` with `arrivals: ReadonlyMap<id, ms>` and `pulses: ReadonlyMap<id, n>`; add `reload`, `write`, `subscribeArrivals`; inject `now` for tests. `renderer.tsx` wires `onCatalogChanged → store.reload`.
- `src/desktop/renderer/toast-store.ts`, `toast.tsx/.css` -- add kind `'arrival'` (stripe `--tape`, mini tape „Adăugat”), message as `string | readonly (string | { strong: string })[]`; mockup H331–342, H518–522.
- `src/desktop/renderer/entry-card.tsx/.css` -- `data-new`, tape element, `data-pulse`; mockup `key-learn-import.html` H227–229, H429–432. DESIGN `entry-card-new` L298, `arrival-tape` L323.
- `card-grid.tsx` -- roving is by id already (arrivals do not move focus); add the slide of shifted cards. `section-header.tsx` -- optional new-count. `app.tsx` -- counters already derive from the snapshot; wire arrival toasts and „Vezi”.
- `src/shared/strings.ro.ts` L283 `appStrings` -- add texts; `plural` L240.
- `tokens.css` -- tape, pulse and arrival tokens exist (L41, L92, L99–114, L206); add only missing component tokens.
- Tests: `tests/catalog-snapshot.test.ts` shows the CLI harness (`initialized`, `batch`, `importReport`) for a real import on a second connection; `src/desktop/renderer/test-fixtures.ts` `makeEntry`.

## Tasks & Acceptance

**Execution:**
- [ ] `ports.ts`, `sqlite-catalog-store.ts` -- `dataVersion()`.
- [ ] `src/desktop/main/catalog-watch.ts` (new) -- `watchCatalog({ readVersion, emit, intervalMs, logError, timers })` → `stop()`; emits only on change; `runWrite(opened, fn, emit, logError)` → `IpcResult<T extends WriteResult>`, emits after a successful write only, never throws.
- [ ] `ipc.ts`, `preload.ts`, `main.ts` -- channel, bridge, poll every 2000 ms, stop before `close()`.
- [ ] `catalog-store.ts` -- serialized reloads (coalesce), classification, `write`, arrivals listener, error toast on failed reload.
- [ ] `catalog-view.ts` -- pure `arrivalToasts(arrived, zoneOf, …)` (per zone, Toolbox then Learn) and `isNew(arrivedAt, now)`.
- [ ] `strings.ro.ts` -- tape text with `relativeTime`, „· N nouă/noi”, toast messages, „Vezi”, „Adăugat”, reload failure.
- [ ] `toast*`, `entry-card*`, `card-grid*`, `section-header*`, `app.tsx`, `renderer.tsx` -- the visuals and wiring; one 1 s ticker only while a tape is visible.
- [ ] Tests -- `catalog-watch.test.ts` (fake timers: change → one emit, no change → none, throw logged once; `runWrite` emit/no-emit, throw → code); `tests/catalog-changed.test.ts` (temp catalog: CLI import on another connection changes `dataVersion` and the watcher emits; a write on the watched connection does not); `catalog-store.test.ts` (every matrix row on the store); `catalog-view.test.ts` (toast order and texts); `strings.ro.test.ts` (relative time, „1 nouă / 2 noi / 20 de noi”); component tests for tape, pulse, header count, toast „Vezi”.

**Acceptance Criteria:**
- Given the change, when `npm test`, `npm run lint`, `npm run typecheck` run, then all pass.
- Given `npm start` on the dev workspace with Learn → a category open, when `npm run cli:dev -- import <batch>` adds entries to both zones, then within a few seconds the matching card lands first with tape and ring, counters grow and two toasts appear, Toolbox first.

## Implementation Notes

- `createCatalogStore(api, { now, toasts })`: the clock and the toast queue are injected, for the tests.
- `runWrite` accepts a sync or async `fn`, because entry edits re-verify links before writing. Its emit failure is logged and the write still answers ok.
- The watcher also emits on the first good read after a failure streak, since changes may have gone unseen meanwhile.
- If a write starts while a snapshot is in flight, the store discards that snapshot and reads again.
- The card grid skips the slide when the grid width changed or `animate` is missing (jsdom).
- `npm test` with default workers crashes on this machine (also on the baseline); verified with `npx vitest run --maxWorkers=2`.

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-20:** high 0, medium 0, low 4, false 1, maybe-false 0. Two low findings were patched and two low ones rejected; one pre-existing issue was deferred.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | Switching to a view whose arrival came while the ticker was off paints one frame with a stale `now`: ring, an „acum 0 s” tape, the header count and the landing all start, even past 600 s | low | patch | `app.tsx` L89–100: `now` advances only while `tapeVisible`, and the `useEffect` corrects it after paint. Fix: refresh `now` in a layout effect on the view and the arrivals, plus a test with an expired arrival in the other zone. |
| 2 | `reload()` rejects, and drops a queued rerun, if a state or arrival listener throws, against its „Never rejects” comment | low | reject | `catalog-store.ts` L192, `set`: real, but the listeners are the app's own (React and the toast push) and do not throw in use; the fix adds guards. |
| 3 | `applyChanged` prepends a changed DTO the snapshot lacks, so the renderer invents an order | low | patch | `catalog-store.ts` L164, against AD-10 („Renderer-ul nu reordonează”; only an import creates entries). No write channel exists yet. Fix: ignore unknown ids until the next reload, and update the test. |
| 4 | A failed reload is never retried, so the import stays hidden until another commit | low | reject | Matches the approved matrix row („keep last ready state, error toast”). A WAL read in `readTransaction` is not blocked by the CLI's writer, so a failing snapshot means a bug, not a passing glitch; a retry adds complexity. |
| 5 | The spies on `getComputedStyle` / `offsetTop` in the sliding tests are never restored | false | reject | `card-grid.test.tsx` L40–43: the file-level `afterEach` calls `vi.restoreAllMocks()`, which also runs for the nested `describe('sliding')`. |
| — | `npm test` with default parallelism crashes Vitest workers (exit 134, out of memory at start) | medium (pre-existing) | defer | Reproduced on the baseline `897b671` in a temporary worktree (4 errors, 854 tests). `--maxWorkers=2` passes everything. Logged in `deferred-work.md`. |

## Design Notes

**Calls made in planning (the author may override at the checkpoint).** Poll interval 2 s. The ring lives as long as the tape (600 s). Landing plays whenever a new card mounts (also after „Vezi”). The other cards slide via the Web Animations API (FLIP; no `style` prop, CSP-safe), skipped under reduced motion. A failed reload keeps the last good catalog and shows an error toast instead of `app-error`.

**Why the renderer waits for pending writes.** Main emits `catalog:changed` inside the write handler, so the event can reach the renderer before the write's reply. A reload in that gap would see the new revision and pulse the user's own edit. `write()` counts in-flight writes; a reload asked meanwhile runs after they settle.

**Pulse restart.** `pulses` holds a counter per id; the card maps parity to `data-pulse="a" | "b"` with two identical keyframes, so each update restarts the animation.

## Verification

**Commands:**
- `npm test`, `npm run lint`, `npm run typecheck` -- all pass

**Manual checks (if no CLI):**
- `npm start` + `npm run cli:dev -- import` in a second terminal: card visible within ~2 s, tape time ticks, toasts per zone, „Vezi” goes to that zone at Toate; Animation effects off → no landing, pulse or slide.
