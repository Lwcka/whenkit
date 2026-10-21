---
title: 'Exportul catalogului'
type: 'feature'
ticket: '14'
created: '2026-10-21'
status: 'built'
baseline_revision: '9d2b25562519c3c9e4a2da23ff28263700ce667d'
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

**Problem:** The catalog lives only in SQLite; the author cannot take it out of the app or read it elsewhere (CAP-13, EXPERIENCE Flow 6).

**Approach:** A read-only core use case `exportCatalog` (AD-12) reads everything in one sync read transaction, builds `catalog.json` and `fise/<slug>.md` in memory, then writes them through `FileSystem` into `whenkit-export-<YYYY-MM-DD_HHmmss>/` under a folder picked in the native dialog. The toolbar gets „Exportă catalogul” (busy „Se exportă…”), a success toast with „Deschide folderul”, an error toast, nothing on cancel.

## Boundaries & Constraints

**Always:** AD-12 (one `slugify()` in core; map `id → slug` once, order `(addedAt, id)`, suffix `-2`, `-3` on case-insensitive collision; no `await` inside the read transaction), AD-18 (`catalog.json` uses `EntryDto`, `CategoryDto` and the new `LinkDto` only; handlers never throw), AD-2 (Electron dialog and `shell` only in `main.ts`; the handler logic Electron-free in `main/catalog.ts`), AD-9 (the renderer cannot open an arbitrary path), AD-13 (every Romanian text, including the `.md` headings, in `strings.ro.ts`, handed to core as labels), conventions (local `YYYY-MM-DD_HHmmss` for the folder name, `EXPORT_VERSION` in `versions.ts`, the styling convention, DESIGN `toolbar-button-primary` tokens).

**Never:** No restore/import from an export (Deferred). No CLI command. No write to the catalog, no `catalog:changed`. No progress bar. No export options (zone filter, format choice).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Export | catalog with tools, materials, concepts (umbrella + children, related), notes, sources, GitHub data | `whenkit-export-2026-10-16_143002/catalog.json` = `{ schemaVersion, exportedAt, entries: EntryDto[] (snapshot order, all fields incl. `myNotes`, `content`), categories: CategoryDto[], links: LinkDto[] }`, valid against its Zod schema; one `fise/<slug>.md` per entry | none |
| Links | related A–B, umbrella U → child C | `links` holds each once: `related` canonical (`fromId < toId`), `parent` `fromId = U, toId = C`; the `.md` of each side links `[[slug|Nume]]` to an existing file | none |
| Slug | „remove.bg”, „Șabloane & Țâțe”, 120-char name, „C++”, „日本” | `remove-bg`, `sabloane-tate`, ≤ 80 chars without trailing `-`, `c`, fallback `fisa` | none |
| Collision | two „Docker” (case/accents differ), the older first by `(addedAt, id)` | `docker`, `docker-2`; a later entry whose own slug is `docker-2` gets `docker-2-2` | none |
| Reserved | names „CON”, „nul”, „Com1”, „LPT9” | `con-1`, `nul-1`, `com1-1`, `lpt9-1` | none |
| Alias | name with `|`, `[` or `]` | alias in `[[slug|…]]` has them replaced by `-` | none |
| Same second | the folder name already exists | `…_143002-2` | none |
| Empty catalog | 0 entries | folder with `catalog.json` (empty lists) and empty `fise/` | none |
| Write fails | read-only folder / disk error mid-way | the half-written export folder is removed (best effort) | `EXPORT_WRITE_FAILED` → error toast „Nu am putut scrie în folderul ales.” |
| Cancel | user closes the folder dialog | nothing written, no toast, button back to normal | none |
| Busy | click | button disabled, `loader-circle` spinning, text „Se exportă…”, until the answer | other code (`DATABASE_BUSY`, `INTERNAL`) → error toast `errorMessages[code]` |
| Success | export done | toast „Catalog exportat: **whenkit-export-2026-10-16_143002**” with action „Deschide folderul” → main opens that folder | a path main did not export this session → `ARGUMENTS_INVALID` |
| Editing | an entry is in edit mode | „Exportă catalogul” stays enabled (export reads the stored catalog) | none |

</frozen-after-approval>

## Code Map

- `src/core/ports.ts` `FileSystem` -- add `removeDir(path)` (recursive, no error when missing); `src/adapters/fs/node-file-system.ts` -- `rmSync(..., { recursive: true, force: true })`. Fakes implementing `FileSystem` in tests (grep `listFiles:`) need the method.
- `src/adapters/sqlite/migrate.ts` L112–117 -- local `YYYY-MM-DD_HHmmss` stamp: move to core (e.g. `src/core/file-stamp.ts`), migrate imports it (adapters may import core).
- `src/core/dto.ts` -- the comment L14–16 promises `LinkDto`: add `linkDtoSchema { type: 'related' | 'parent', fromId, toId }` and `catalogExportSchema`; links derive from `StoredEntry.relatedIds` / `childIds` (no new store method). `src/core/versions.ts` -- `EXPORT_VERSION = 1`.
- New `src/core/slugify.ts` (+ `.test.ts`) -- NFD + strip marks, lowercase, runs of non `[a-z0-9]` → `-`, trim, cut to 80; Windows reserved (`con prn aux nul com1–9 lpt1–9`) → `-1`; empty → caller's fallback. `slugMap(entries)` for the collision rule (suffixed slug also ≤ 80, base cut).
- New `src/core/export-catalog.ts` -- `exportCatalog(store, { fs, clock }, { parentDir, labels }) → { folderName, folderPath }`. Inside `store.readTransaction`: `allEntries`, `allCategories`, `ownerId` not needed. Model: `catalog-snapshot.ts`. After it: pick a free folder name, `mkdir`, write; on any fs error `removeDir` (catch its own error) and throw `WhenkitError('EXPORT_WRITE_FAILED', { cause })`. `.md`: YAML front matter, each value `JSON.stringify`-ed (valid YAML): `id`, `kind`, `zone`, `aliases: [name]`, `url`, `resourceType`, `categories` (names), `keywords`, `addedAt`, `verifiedAt`, `github*` when not null, `forced`; body `# Nume`, what it does, sections (labels) situations, content, sources, umbrellas/children/related as `[[slug|Nume]]` lists, my notes; empty sections omitted.
- `src/core/errors.ts` -- `EXPORT_WRITE_FAILED`; `src/cli/exit-codes.ts` → `EXIT_UNAVAILABLE`; `strings.ro.ts` `errorMessages`.
- `src/shared/strings.ro.ts` -- `exportStrings` (md labels reusing `entryStrings` where they fit: `situations(kind)`, `sources`, `content`, `myNotes`; plus „Umbrele”, „Concepte”, „Resurse înrudite”, fallback slug `fisa`), `appStrings.exportButton` „Exportă catalogul”, `exporting` „Se exportă…”, `exported(name)` as `RichText`, `openFolder` „Deschide folderul”; `mainStrings.exportDialogTitle`.
- `src/shared/ipc.ts` -- channels `catalog:export`, `shell:openExportFolder`; `ExportResultDto { folderName, folderPath }`; `WhenkitApi.exportCatalog(): Promise<IpcResult<ExportResultDto | null>>` (`null` = cancelled), `openExportFolder(path): Promise<IpcResult<null>>`. `preload.ts` -- `invoke`.
- `src/desktop/main/catalog.ts` -- `exportCatalogResult(opened, parentDir | undefined, deps, logError)` like `snapshotResult` L117–126 (undefined → `{ ok: true, data: null }`); not via `runWrite`. `main.ts` -- handler: `dialog.showOpenDialog(window, { title, defaultPath: app.getPath('documents'), properties: ['openDirectory', 'createDirectory'] })`, then the result; keep exported paths in a `Set`; `shell:openExportFolder` accepts only those, `shell.openPath`, error string → `INTERNAL` (logged).
- `src/desktop/renderer/toolbar.tsx/.css` -- after „Categorii”: `toolbar-button-primary` with lucide `Upload`, `busy` prop (`LoaderCircle` + `.spin` from `button.css`, `aria-busy`, full opacity); icon-only below 960 px like „Categorii”. Tokens DESIGN L226–232 → `tokens.css`. `margin-left: auto` moves to the first right-hand button.
- `src/desktop/renderer/app.tsx` L820–830 -- `exporting` state; handler calls `api.exportCatalog`, toasts via `toasts.push` (L343 pattern), action runs `api.openExportFolder`, its failure → error toast. Export not disabled by `editing`.

## Tasks & Acceptance

**Execution:**
- [ ] `ports.ts`, `node-file-system.ts`, `migrate.ts`, `file-stamp.ts`, `errors.ts`, `exit-codes.ts`, `versions.ts`, `dto.ts` -- port, stamp, code, schema.
- [ ] `slugify.ts`, `export-catalog.ts` -- the use case.
- [ ] `strings.ro.ts`, `ipc.ts`, `preload.ts`, `main/catalog.ts`, `main.ts` -- the channels.
- [ ] `toolbar.tsx/.css`, `tokens.css`, `app.tsx` -- the button and the toasts.
- [ ] Tests -- `slugify.test.ts` (rows Slug, Collision, Reserved); `tests/export-catalog.test.ts` on a temp catalog with real fs (rows Export, Links incl. every `[[slug|…]]` target exists in `fise/`, Alias, Same second, Empty catalog, Write fails with a fake fs that throws mid-way → folder gone, `catalog.json` parses with `catalogExportSchema` and its entries equal `catalogSnapshot`); `catalog.test.ts` (cancel → null, closed catalog → its code); `app-export.test.tsx` (Busy, Success + action, Cancel, error toasts, enabled while editing).

**Acceptance Criteria:**
- Given the change, when `npx vitest run --maxWorkers=2`, `npm run lint`, `npm run typecheck` run, then all pass.
- Given `npm start` on the dev workspace, when Flow 6 is done, then the folder holds `catalog.json` and `fise/*.md`, and Obsidian opens it as a vault with working links.

## Implementation Notes

- Built by the implementation subagent in one pass; it did not edit this file. `margin-left: auto` sits on `.search-box + .toolbar-button`; `Toolbar` takes a required `onExport` and an optional `exporting`, so the fake APIs of the existing `app*.test.tsx` gained the two methods.
- The reserved-name `-1` is added after the 80-character cut (reserved names are short, so it never matters).
- `main.ts` answers the catalog's startup code before showing the dialog, so the user never picks a folder for an export bound to fail.
- Not checked by hand (no window in this session): Flow 6 with `npm start`, Obsidian, a read-only folder.

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-21:** high 0, medium 1, low 2, false 1, maybe-false 0.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | This plan file saved with a BOM and its Romanian text double-encoded (frozen block included) | low | reject (fix edits the plan) | Real: the workflow's PowerShell 5.1 status edits (`Get-Content -Raw` reads ANSI, `Set-Content -Encoding utf8` writes a BOM). Not a code defect; the file was rewritten from the original text, unchanged in substance. |
| 2 | `EXPORT_WRITE_FAILED` never logged, so the disk error behind it leaves no trace in `whenkit.log` (AD-19) | medium | patch | `codeOf` logs only non-WhenkitErrors; the test asserts nothing is logged. Content is built before the `try`, so only fs calls land in it. Fix: log the `cause` in `exportCatalogResult`. |
| 3 | `yaml()` leaves DEL, C1 controls and U+FFFE/U+FFFF unescaped; YAML 1.2 forbids them | low | patch | `JSON.stringify` escapes only U+0000–U+001F; the comment claims every string is valid YAML. Direct fix: extend the escape range. |
| 4 | The `!catalog.ok` check in the `catalog:export` handler repeats the one in `exportCatalogResult` | false | reject | The reviewer itself notes it is the right order (no dialog for an export bound to fail); not a defect. |

After the patches: `npx vitest run --maxWorkers=2` 1499 passed, `npm run lint` and `npm run typecheck` clean.

## Design Notes

**Calls made in planning.** One `catalog:export` call opens the dialog and exports, so the busy state starts at the click (behind the modal dialog) rather than after the folder is chosen; a two-call flow would let the renderer pass a path for main to write to. „Deschide folderul” goes through its own channel that only accepts folders exported in this session (AD-9). Failure removes the half-written folder (EXPERIENCE: „nimic pe jumătate scris”). `aliases` in the front matter lets Obsidian find a note by the entry's name. The `.md` is for reading; `catalog.json` is the complete copy.

**Labels into core.** Core cannot import `shared/`; the use case takes an `ExportLabels` object that main builds from `exportStrings`, so the Romanian headings stay in `strings.ro.ts` (AD-13).

## Verification

**Commands:**
- `npx vitest run --maxWorkers=2` -- all pass (default workers crash on this machine)
- `npm run lint`, `npm run typecheck` -- pass

**Manual checks (if no CLI):**
- `npm start`: export to Documents, „Deschide folderul”, open as a vault in Obsidian, follow an umbrella → child link; cancel the dialog → nothing; export to a read-only folder → error toast, no leftover folder.
