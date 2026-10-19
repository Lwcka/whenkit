---
title: 'Firul de pornire: catalogul în fereastră'
type: 'feature'
ticket: '1'
created: '2026-10-19'
status: 'built'
baseline_revision: '1950f3738692cb15c7f6c76b9c6daa2fe2c908a8'
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

**Problem:** The window shows a placeholder: main opens no catalog, there is no IPC contract, no preload bridge and no renderer state, so the imported entries are invisible outside the CLI.

**Approach:** Thread one read end to end: main resolves the workspace and opens the single connection in a new write-without-migrating mode; core's `catalogSnapshot` reads everything in one transaction; `catalog:snapshot` carries it through `src/shared/ipc.ts` and `window.whenkit` into the renderer's single catalog store, which renders Toolbox/Learn tabs with simple cards, or `app-error` for a startup error. Renderer testing (jsdom + Testing Library) is set up here.

## Boundaries & Constraints

**Always:** AD-2 (core pure), AD-9 (sandboxed renderer, only `window.whenkit`), AD-18 (handlers never throw; `{ ok: true, data } | { ok: false, error: { code } }`; `ipc.ts` imports types only from `core/dto.ts`). Main busy timeout ≤ 2000 ms. Snapshot order `added_at DESC, seq ASC`, done in SQL; the renderer never reorders entries. Romanian text only in `strings.ro.ts`. Tests use temp dirs and injected environments, never `%APPDATA%` or a real workspace.

**Never:** No `catalog:changed`, polling or write channels (entry 5+). No AD-20 lifecycle, userData, theme or window-state (entry 2). No DESIGN tokens, fonts, icons, category bar, status bar, skeleton (entries 3–4). No migrations from the window. No new migration file. No state library.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Snapshot | temp catalog with tools, materials, concepts from two batches | `{ entries: EntryDto[] (with content), categories: CategoryDto[] }`; newest batch first, batch order kept | none |
| Not configured | no `WHENKIT_WORKSPACE`, no `config.json` | snapshot → `{ ok: false, error: { code: 'WORKSPACE_NOT_CONFIGURED' } }`; renderer shows its `app-error` | no file created |
| Pending migrations | catalog at v0/v1 while code has a newer migration | `DATABASE_NEEDS_MIGRATION`; `app-error` | file bytes, `schema_migrations` unchanged; no `backups/` |
| Other open refusals | missing `catalog.sqlite`, invalid config, too new, mismatch | `CATALOG_NOT_FOUND`, `CONFIG_INVALID`, `DATABASE_TOO_NEW`, `MIGRATION_MISMATCH` → their `app-error` rows | nothing written |
| Unexpected throw | non-WhenkitError at open or snapshot | `{ ok: false, error: { code: 'INTERNAL' } }`, logged with `console.error` | handler does not throw |

</frozen-after-approval>

## Code Map

- `src/adapters/sqlite/sqlite-catalog-store.ts` -- `openCatalogStore` (l. 580): today `readOnly` → `checkMigrated`, else `configureConnection` + `migrate`. Reuse `checkMigrated` from `migrate.ts`; `entryById`/`entrySummaries` show how rows, `categoriesByEntry()`, `linksByEntry()` (no arg = all) and `toSummary` combine.
- `src/core/ports.ts` -- `CatalogReader`, `CatalogStore`, `OpenStoreOptions`; extend by addition only.
- `src/core/dto.ts` -- `toEntryDto`, `toCategoryDto`, `entryDtoSchema`, `categoryDtoSchema`.
- `src/core/workspace.ts` -- `resolveWorkspace(env, fs)`, `catalogPath(fs, ws)`.
- `src/cli/bin.ts` -- model for wiring real adapters (`createProcessEnvironment`, `nodeFileSystem`, `systemClock`, `randomIdGenerator`).
- `src/desktop/main/main.ts`, `preload/preload.ts` (empty), `renderer/app.tsx`, `renderer/renderer.tsx`, `renderer/index.css` -- the placeholders to replace.
- `src/shared/strings.ro.ts` -- `errorMessages` (text of every code) is reused by `app-error`.
- `tests/helpers.ts` -- `tempDir`, `fixedClock`, `sequentialIds`, `fakeEnvironment`, `errorCodeOf`; `tests/catalog-store.test.ts` -- `open()` and `withRawDb` patterns and custom `Migration` lists (e.g. `v2`) to simulate pending migrations.
- `vitest.config.mts` -- node only, `*.test.ts`; `.oxlintrc.json` -- renderer may not import `core`/`adapters`/`node:`/`electron`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/ports.ts`, `src/adapters/sqlite/sqlite-catalog-store.ts` -- add `OpenStoreOptions.migrate?: boolean` (default true): `migrate: false` opens for writing, sets `busy_timeout`, runs `checkMigrated` **before** `journal_mode`/`foreign_keys` pragmas, then configures; add `CatalogReader.allEntries(): StoredEntry[]` (with content, `ORDER BY added_at DESC, seq ASC`) and `allCategories(): StoredCategory[]` (by zone, then `name_key`); add `CatalogStore.readTransaction<T>(fn: (reader: CatalogReader) => T): T` (`BEGIN`…`COMMIT`, rollback on throw, refuses nesting) -- the window's mode, the snapshot reads, one consistent read (AD-10, reused by export AD-12).
- [ ] `src/core/dto.ts`, `src/core/catalog-snapshot.ts` -- `catalogSnapshotDtoSchema`/`CatalogSnapshotDto { entries, categories }` and `ErrorDto { code: ErrorCode }` in dto.ts; `catalogSnapshot(store)` maps inside `readTransaction`.
- [ ] `src/shared/ipc.ts` -- `IPC_CHANNELS = { catalogSnapshot: 'catalog:snapshot' }`, `IpcResult<T>`, `WhenkitApi { catalogSnapshot(): Promise<IpcResult<CatalogSnapshotDto>> }`.
- [ ] `src/desktop/main/catalog.ts` (new) -- `openDesktopCatalog({ env, fs, openStore })` → `{ ok: true, store } | { ok: false, code }` (resolveWorkspace + `migrate: false`, never throws); `snapshotResult(opened)` → `IpcResult` (catches, unknown → `INTERNAL`). Electron-free, testable.
- [ ] `src/desktop/main/main.ts` -- after `ready`, open once with real adapters (`DESKTOP_BUSY_TIMEOUT_MS = 2000`), `ipcMain.handle(IPC_CHANNELS.catalogSnapshot, …)`, close store on `will-quit`. If `createProcessEnvironment()`'s `import.meta.url` default breaks in the CJS main bundle, pass `__filename`.
- [ ] `src/desktop/preload/preload.ts` -- `contextBridge.exposeInMainWorld('whenkit', api satisfies WhenkitApi)` via `ipcRenderer.invoke`.
- [ ] `src/desktop/renderer/catalog-store.ts` (new) -- the single store (see Design Notes); `whenkit-api.ts` with the `Window.whenkit` global type.
- [ ] `src/desktop/renderer/app.tsx`, `app-error.tsx`, `renderer.tsx`, `index.css` -- create the store from `window.whenkit`, `load()` once; loading renders nothing; `ready`: tablist Toolbox/Learn (`role="tab"`, `aria-selected`, starts on Toolbox), grid of cards (name + `whatItDoes`) for the zone in snapshot order; `error`: `app-error` per EXPERIENCE (title, `errorMessages[code]`, highlighted command when the table has one, code as detail, „Apoi repornește WhenKit.”); minimal CSS.
- [ ] `src/shared/strings.ro.ts` -- `appStrings`: zone tab labels reuse `zoneLabels`; startup titles and commands exactly as EXPERIENCE's table; a generic title for other codes („WhenKit nu a putut porni.”); restart line.
- [ ] `package.json`, `vitest.config.mts` -- devDeps `jsdom@30.1.3`, `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2` (exact); include `src/**/*.test.tsx` with jsdom (Vitest `projects`, or a per-file `@vitest-environment jsdom` docblock if projects misbehave); call RTL `cleanup` after each test.
- [ ] Tests -- `tests/catalog-snapshot.test.ts` (order, both zones, content, categories; `migrate: false` refusals with unchanged file bytes and no `backups/`; `openDesktopCatalog`/`snapshotResult` codes for the matrix rows); `src/desktop/renderer/app.test.tsx` (fake `window.whenkit`: tabs switch zones, order kept; `WORKSPACE_NOT_CONFIGURED` and `DATABASE_NEEDS_MIGRATION` render their titles and code).

**Acceptance Criteria:**
- Given a dev workspace with imported entries, when `npm start` runs, then Toolbox shows tools and Learn shows materials and concepts, newest first.
- Given any startup refusal, when the window opens, then only `app-error` is shown and the catalog file is untouched.
- Given the change, when `npm test`, `npm run lint`, `npm run typecheck` run, then all pass, including the lint boundaries test.

## Implementation Notes

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-19:** high 1, medium 0, low 3, false 2, maybe-false 0.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | `npm start` loads no `.env`; main falls back to the real `config.json` workspace | high | patch | `"start": "electron-forge start"`, no `--env-file`/`loadEnvFile` anywhere; breaks AD-19 (also how the implementer's smoke test reached the real catalog). Fix: `process.loadEnvFile(<appPath>/.env)` when `!app.isPackaged` and the file exists. |
| 2 | `migrate: false` + `create: true` creates an empty file before refusing | low | patch | Guard is `readOnly \|\| create !== true`; unreachable from the desktop but a direct one-condition correction. |
| 3 | `readTransaction` hands `fn` the writable store | false | reject | `fn` is typed `CatalogReader`; a write needs an explicit cast. Same pattern as `writeTransaction` passing `this`. |
| 4 | `allCategories` test does not assert `name_key` order | low | patch | Test only compares zones to their sorted copy; add per-zone order assertion. |
| 5 | `appStrings.zoneTabs` unused | low | patch | `app.tsx` imports `zoneLabels` directly; delete the field. |
| 6 | New devDependencies not yet in Stack | false | reject | Not a code defect: the plan schedules it for the main session after review (Design Notes). |

## Design Notes

**Renderer store (fixes AD-10's deferred shape).** A framework-free external store read with `useSyncExternalStore`, no dependency; later entries add `applyChanged(dtos)`, reload on `catalog:changed` and arrival classification to the same object.

```ts
type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; code: ErrorCode }
  | { status: 'ready'; entries: readonly EntryDto[]; categories: readonly CategoryDto[] };
interface CatalogStore { getState(): CatalogState; subscribe(l: () => void): () => void; load(): Promise<void> }
```

Views derive per-zone lists by filtering `entries` (`entry.zone`), never sorting. `ErrorCode` reaches the renderer as a type via `shared/ipc.ts` (`ErrorDto`), keeping the lint boundary.

**Write-without-migrate:** checking before the WAL pragma keeps a refused open free of writes (setting `journal_mode` on a non-WAL file writes its header).

**After review (main session, not the subagent):** record jsdom, @testing-library/react, @testing-library/dom in Stack and the store/testing conventions via `bmad-architecture`.

## Verification

**Commands:**
- `npm test` -- all pass, new snapshot, desktop-catalog and renderer tests included
- `npm run lint` and `npm run typecheck` -- clean

**Manual checks (if no CLI):**
- `npm start` with `.env` dev workspace: both tabs list the imported entries. Do not test the error screens by unsetting `WHENKIT_WORKSPACE`: the real `config.json` would open the real workspace (AD-19); point `WHENKIT_WORKSPACE` at an empty temp folder instead („Workspace-ul nu are catalog.”).
