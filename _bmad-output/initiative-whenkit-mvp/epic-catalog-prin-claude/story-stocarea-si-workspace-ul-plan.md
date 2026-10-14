---
title: 'Stocarea și workspace-ul'
type: 'feature'
ticket: '2'
created: '2026-10-13'
status: done
baseline_revision: '1a275cbf7e1b1283e035fb041984c330e7d085a5'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md'
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/spec-whenkit/categories-seed.md'
  - '{project-root}/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing can be stored yet: there is no workspace on disk, no catalog database and no single place that decides which workspace the CLI and the app use.

**Approach:** Add the core ports, `resolveWorkspace()` and a minimal `whenkit init`, plus `SqliteCatalogStore` with a safe migration runner and migration 0001 holding the whole v1 schema (AD-4, AD-5, AD-8).

## Boundaries & Constraints

**Always:** `src/core` stays pure (AD-2): every effect goes through a port; adapters are injected by `cli`. One normalization function for `name_key`. All timestamps come from `Clock` as `toISOString()`; no temporal `DEFAULT` in SQL. Romanian text only in `src/shared/strings.ro.ts`. Tests use temp dirs and an injected `Environment` (fake `APPDATA`, fake `WHENKIT_WORKSPACE`); they never touch `%APPDATA%` or the real workspace.

**Decisions (author, 2026-10-13):** keep the plan whole despite ~2400 tokens.

**Never:** No batch schema, import, list, verification, HTTP or Zod (tickets 3+). No workspace template files, `blocked-domains.txt` or `.whenkit-template.json` (ticket 10). No IPC or desktop wiring. No hardcoded default workspace path. No other SQLite library.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Init new | `whenkit init <path>`, env var unset | creates `input/`, `batches/`, `data/`, `data/backups/`, `data/catalog.sqlite` at schema v1; writes `config.json` under `APPDATA\whenkit`; prints the path; exit 0 | — |
| Init with env | `WHENKIT_WORKSPACE` set, `whenkit init` | workspace created at the env path; `config.json` not written | — |
| Init again | init on an existing workspace | no re-migration, data untouched, exit 0 | — |
| Inside repo | init with a path equal to or inside the app's repo | nothing created | `WORKSPACE_INSIDE_REPO`, exit 2 |
| Not configured | init without a path, no env var, no `config.json` | nothing created | `WORKSPACE_NOT_CONFIGURED`, exit 2 |
| Bad config | `config.json` unreadable or malformed | nothing created | `CONFIG_INVALID`, exit 2 |
| Hash changed | an applied migration's SQL differs from the recorded sha256 | database not opened, nothing written | `MIGRATION_MISMATCH`, exit 3 |
| DB too new | database has a migration version unknown to the code | database not opened | `DATABASE_TOO_NEW`, exit 3 |
| Upgrade | database at v1, code ships v2 | backup in `data/backups/catalog-v1-<YYYY-MM-DD_HHmmss>.sqlite` exists before v2 applies | — |

</frozen-after-approval>

## Code Map

- `src/cli/main.ts`, `src/cli/bin.ts`, `src/cli/main.test.ts` -- ticket 1's CLI: `main(args, io)` returns the exit code; `bin.ts` wires `process`. Extend, keep `--version`/`--help`/unknown behavior and tests.
- `src/shared/strings.ro.ts` -- `cliStrings`; add error and init texts here.
- `.oxlintrc.json` -- core bans every Node built-in, `fetch`, `require`; core tests must use fakes, so DB/fs tests live in `tests/`.
- `tsconfig.json` -- `types: ["node"]`, includes `tests/`; `vite.cli.config.mts` bundles `src/cli/bin.ts`, `/^node:/` external.
- `node:sqlite` on Node 24.19.0 (probed): WAL, FTS5 `unicode61 remove_diacritics 2`, `json_each` inside triggers, `VACUUM INTO` all work; no ExperimentalWarning.
- Repo empty under `src/core`, `src/adapters` (`.gitkeep` only; remove them as files land).

## Tasks & Acceptance

**Execution:**
- [x] `src/core/ports.ts` -- `Clock { now(): Date }`, `IdGenerator { newId(): string }` (UUID v4), `Environment { get(name): string | undefined; appRoot(): string }`, `FileSystem` (exists, mkdir recursive, readText, writeText, joinPath), `CatalogStore { ownerId(): string; schemaVersion(): number; close(): void }` -- AD-2; `HttpClient`/`GitHubClient` arrive with tickets 4 and 9, `CatalogStore` grows from ticket 3
- [x] `src/core/errors.ts`, `src/core/versions.ts` -- closed `ErrorCode` enum (the codes in the matrix + `INTERNAL`), `WhenkitError { code }`; `CONFIG_VERSION = 1` -- AD-18, conventions
- [x] `src/core/name-key.ts` (+ `.test.ts`) -- `nameKey()`: NFD, strip combining marks (covers ș/ț), lowercase, trim, collapse whitespace -- AD-5 single function
- [x] `src/core/category-seed.ts` -- the 16 start categories from `categories-seed.md` (`toolbox`/`learn`, exact Romanian names) -- seeded once by 0001
- [x] `src/core/workspace.ts` (+ `.test.ts`, fakes) -- `resolveWorkspace(env, fs)`: `WHENKIT_WORKSPACE` → `<APPDATA>\whenkit\config.json` `{ configVersion, workspace }` → `WORKSPACE_NOT_CONFIGURED`; `initWorkspace({ path? }, ports)`: target = explicit path or `resolveWorkspace()`; a path counts as absolute only with a drive letter (`C:\`) or as UNC (`\\server\share`), wherever it comes from; refuse equal-to/inside `appRoot()` (case-insensitive, `/`≡`\`, trailing separator ignored); create folders; open store via an injected opener; write `config.json` only when the env var is unset; return the path -- AD-8
- [x] `src/adapters/sqlite/migrations/0001-initial.sql` -- schema below -- AD-4, AD-5
- [x] `src/adapters/sqlite/migrate.ts` -- runner over `{ version, name, sql, afterApply? }[]` (default list loaded with `import.meta.glob('./migrations/*.sql', { query: '?raw', import: 'default', eager: true })`, injectable for tests); creates `schema_migrations(version, name, sha256)`; checks hashes and unknown versions before anything; when pending and current version ≥ 1, `VACUUM INTO` the backup; then `BEGIN IMMEDIATE`, re-read the applied version, apply the rest, commit -- AD-4
- [x] `src/adapters/sqlite/sqlite-catalog-store.ts` -- `openCatalogStore(dbPath, { clock, ids, busyTimeoutMs, migrations? })`: pragmas `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout`; runs `migrate`; 0001's `afterApply` creates `meta.owner_id` and seeds categories with `nameKey()`; maps `SQLITE_BUSY` to a `WhenkitError` -- AD-4
- [x] `src/adapters/system.ts`, `src/adapters/fs/node-file-system.ts`, `src/adapters/env/process-environment.ts` -- system clock, `crypto.randomUUID`, node fs, `process.env`; `appRoot()` = repo root derived from the running file -- adapters for AD-2 ports
- [x] `src/cli/main.ts`, `src/cli/bin.ts`, `src/cli/exit-codes.ts` -- `main` becomes `async (args, io, deps)` with injected ports, the catalog opener included (only `bin.ts` imports adapters); an argument starting with `-` after `init` is an unknown option (exit 1, nothing created); `init [path]` resolves a relative path against the cwd; one `ErrorCode → exit code` table (config → 2, database → 3, unknown → 4); errors print the Romanian text on stderr, no stack -- AD-11
- [x] `src/shared/strings.ro.ts` -- usage lists `init`; `errorMessages: Record<ErrorCode, string>`; init success text -- AD-13
- [x] `src/declarations.d.ts` -- Vite client types for `import.meta.glob` -- typecheck
- [x] `.gitattributes` -- `* text=auto eol=lf`; convert the working copies of tracked code/config files to LF in place (no deletes, no reset) -- `core.autocrlf=true` checkouts are CRLF and fail `oxfmt --check`
- [x] `tests/catalog-store.test.ts`, `tests/init.test.ts` -- the matrix rows on temp dirs (Hash changed and Upgrade use an injected migration list); FTS: an inserted entry is found by an unaccented prefix of a word in `situations`; seed: 16 categories, rerun keeps 16 -- matrix audit

**Schema 0001:** `meta` (single row, `owner_id`); `entries` (`seq INTEGER PRIMARY KEY`, `id TEXT UNIQUE`, columns from the spine's Structural Seed; `kind ∈ tool|material|concept`, `url` required unless concept, `resource_type ∈ repo|site|app` or NULL; JSON columns default `'[]'`, `my_notes` default `''`, `revision` default 1, `forced` default 0; `UNIQUE(owner_id, dedup_key)`); `categories` (`zone ∈ toolbox|learn`, `UNIQUE(owner_id, zone, name_key)`); `entry_categories` (PK, cascade from entries); `links` (`type ∈ related|parent`, cascade both ends, `UNIQUE(type, from_id, to_id)`, `CHECK(from_id <> to_id)`, `CHECK(type <> 'related' OR from_id < to_id)`); `rejections` (spine columns, `op ∈ add|update`, index on `(owner_id, dedup_key)`); view `entries_fts_source` over `entries` exposing `seq, name, what_it_does, content` and `situations`/`keywords` as the JSON lists joined with `json_each` + `group_concat(value, ' ')`; `entries_fts` FTS5 `content='entries_fts_source'`, `content_rowid='seq'`, columns `name, what_it_does, situations, keywords, content`; insert/delete/update triggers on `entries` write the same derived values the view exposes (AD-5), so `'integrity-check'` and `'rebuild'` agree with the index.

**Acceptance Criteria:**
- Given a temp workspace, when the store is closed and reopened, then `schema_migrations` still holds one row and `owner_id` is unchanged.
- Given `npm test`, `npm run lint`, `npm run typecheck`, when they run, then all pass with no test touching the real `%APPDATA%`.

## Design Notes

`seq` is the FTS rowid because a table without `INTEGER PRIMARY KEY` may get new rowids after `VACUUM`, which would desynchronize the external-content index. `VACUUM INTO` gives a consistent backup of a WAL database; a raw file copy may miss the `-wal` file. `init` without a path reuses `resolveWorkspace()`, so there is no hidden default (AD-8); ticket 10 owns the full init.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors
- `npm run build:cli && node dist/cli/whenkit.mjs --help` -- expected: usage lists `init`

## Plan Change Log

- **Loop 1 (2026-10-13).** Trigger: quick review finding 3 — `content='entries'` with triggers that index derived (joined) text makes `rebuild`/`integrity-check`/`highlight`/`snippet` read raw JSON; proven with a `\n` inside `situations` ("fts5: checksum mismatch", search lost after rebuild). Amended: Schema 0001 (content view `entries_fts_source`), AD-5 wording (author chose the view); also folded in findings 1, 2, 5 (options after `init`, drive/UNC-only absolute paths, opener injected) and the `.gitattributes` task. Known-bad state avoided: an FTS index that silently diverges from its source. **Deviation (author, 2026-10-13):** code is fixed in place instead of reverted — the revert was blocked as destructive and the reviewer found the rest correct. KEEP: everything else as implemented — ports, errors, `nameKey`, seed, `resolveWorkspace`/`initWorkspace`, the migration runner (hash before write, CRLF-insensitive hash, `VACUUM INTO`, `BEGIN IMMEDIATE` + re-read), `DATABASE_BUSY`, STRICT tables, the exit-code table, all existing tests.

## Review Triage Log

Loop 0 — quick lens: 1 high, 2 medium, 2 low.

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | `src/cli/main.ts` `runInit` | `init --help` creates a `--help` workspace and rewrites the real `config.json` | high | `rest[0]` goes to `path.resolve` unchecked; reviewer reproduced it with the built CLI | patch (folded into loop 1) |
| 2 | `src/core/workspace.ts` `isAbsolutePath` | `\Users\…\whenkit\ws` from env/config counts as absolute, drive missing, so the inside-repo check fails | medium | `/^[\/]/` accepted; segments `[users,…]` vs `[c:,users,…]` never match | patch (folded into loop 1) |
| 3 | `0001-initial.sql` `entries_fts` | index and content table disagree for JSON-escaped text | medium | reviewer ran integrity-check on the real file: checksum mismatch | bad_plan → loop 1 |
| 4 | `src/adapters/sqlite/migrate.ts` | backup written before the lock; a busy DB leaves an extra backup file | low | real, but only when two processes migrate at once; fix adds a cleanup branch | reject |
| 5 | `src/cli/main.ts` / `bin.ts` | the store opener is imported in `main.ts`, not injected; `bin.ts` comment is wrong | low | `import { openCatalogStore }` in `main.ts`; direct correction | patch (folded into loop 1) |

## Implementation Notes

- Loop 1: FTS5 cannot read a content view that uses `json_each` ("no such table: main.json_each" on `'rebuild'`), so `entries_fts_source` joins the lists with a recursive CTE over `json_extract(list, '$[n]')`; the triggers copy rows from the view, so index and source share one derivation. Test: escaped text passes `integrity-check` before and after `'rebuild'`.
- Paths: only drive (`C:\`) and UNC (`\server\share`) count as absolute; device paths (`\?\`, `\.\`) are refused.

Loop 1 — quick lens (fresh reviewer): 0 high, 2 medium, 2 low, 1 false-as-code, 1 process.

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 6 | `src/core/workspace.ts` `initWorkspace` | a non-drive/UNC explicit path exits 4 (INTERNAL) | low | reproduced with the built CLI; switching the code to CONFIG_INVALID is a direct correction | patch |
| 7 | `src/core/workspace.ts` `pathSegments` | `C:\..\…` and trailing-dot segments bypass the inside-repo check | medium | `..` pops `c:`; reviewer's run created `whenkit.\wsdot` beside the repo | patch |
| 8 | `0001-initial.sql` / store | `INSERT OR REPLACE` on `entries` skips the FTS delete trigger | medium | reproduced on the real migration: stale term matches, integrity-check fails; ticket 3 writes entries | patch (`recursive_triggers`) |
| 9 | `src/core/workspace.ts` `readConfig` | BOM in `config.json` → CONFIG_INVALID | low | `JSON.parse('\uFEFF{}')` throws; PowerShell 5.1 writes a BOM; strip is a direct correction | patch |
| 10 | `src/shared/strings.ro.ts` | imports `ErrorCode` from `core/errors`; the spine diagram allows only `core/dto` types | false (as a code defect) | AD-13/AD-15 require texts indexed by `ErrorCode`/`ReasonCode`, which live outside `dto`; the diagram is too narrow | defer (architecture wording) |
| 11 | git workflow | AD-5 change made on the code branch | low | CLAUDE.md: planning docs go to `main`; handled with a separate docs commit | reject (handled at commit) |
