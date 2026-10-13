---
title: 'Firul de pornire: import add și list'
type: 'feature'
ticket: '3'
created: '2026-10-13'
status: 'built'
baseline_revision: 'db632767f7c0f114cebe57325b8b47974c441ff9'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md'
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/spec-whenkit/entry-model.md'
  - '{project-root}/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The catalog exists but nothing can put entries into it or read them back, so no later ticket (verification, update, links, skills) has a path to build on.

**Approach:** Define the batch contract, the report and the `--json` outputs as Zod schemas in `core`, add the import use case with phase 1 (schema) and phase 3 (one write transaction), and the CLI commands `import`, `list` and `show` (AD-6, AD-11, AD-14, AD-18).

## Boundaries & Constraints

**Always:** One batch schema in `src/core/batch-schema.ts`, `.strict()` everywhere, `kind` a discriminated union, `schemaVersion` required. Romanian text only in `src/shared/strings.ro.ts`; reasons and errors are codes. With `--json`, stdout holds exactly one JSON document validated by its schema, errors included; everything else goes to stderr. Exit codes 1–2 write nothing. Read commands never write. Tests use dev/temp workspaces only.

**Decisions (Claude for the author, 2026-10-13, author away; recommended options):** link fields (`related`, `children`) join the batch schema in ticket 7, which processes links, so this ticket accepts no field it ignores; `list`/`show` open the catalog read-only and refuse a database that needs migration (only `init`/`import` migrate); an outdated `schemaVersion` exits 1 (the batch is what is invalid) and the message says to run `whenkit init`; `flaggedByClaude` and duplicates are handled here (no I/O) so nothing doubtful is ever added before ticket 5; keep the plan whole despite its size.

**Never:** No HTTP, URL reachability, blocked domains or GitHub (tickets 4, 5, 9). No `op: update`, no `--force`, no rejections journal, no links, no `whenkit schema` (tickets 6–8). No IPC or UI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Add | initialized workspace; valid batch with one tool | item `added` with its new id; `list --json` and `show <id> --json` return it; exit 0 | — |
| Invalid batch | unknown field, missing required field, or bad `kind` | nothing written; JSON error with code and the schema issues (paths) | `BATCH_INVALID`, exit 1 |
| Unreadable | batch file missing or not JSON | nothing written | `BATCH_INVALID`, exit 1 |
| Outdated | `schemaVersion` ≠ current | nothing written; message says run `whenkit init` | `BATCH_SCHEMA_OUTDATED`, exit 1 |
| Unknown category | an item names a category absent from its zone and not declared | that item `rejected` (`unknown_category`, name in params); the others are added; exit 0 | — |
| Declared category | `newCategories` entry used by an added item | category created once (matched by `name_key` in the zone); report `created: true`, or `false` when it already existed | — |
| Duplicate | same normalized URL (or concept title) as the catalog or an earlier item in the batch | item `duplicate` with `duplicateOfId` when in the catalog | — |
| Flagged | item carries `flaggedByClaude` text | item `rejected` (`flagged_by_claude`, text kept) | — |
| No workspace | workspace not configured | JSON error document, `workspace: null` | `WORKSPACE_NOT_CONFIGURED`, exit 2 |
| No catalog | workspace without `data/catalog.sqlite` | nothing created | `CATALOG_NOT_FOUND`, exit 2 |
| Unknown id | `show <id>` with no such entry | — | `ENTRY_NOT_FOUND`, exit 1 |

</frozen-after-approval>

## Code Map

- `src/core/ports.ts` -- `CatalogStore` (ownerId, schemaVersion, close) grows here; `Clock`, `IdGenerator`, `FileSystem`, `Environment` exist.
- `src/core/errors.ts` (closed `ERROR_CODES`), `src/cli/exit-codes.ts` (one `ErrorCode → exit` table), `src/core/versions.ts` (`CONFIG_VERSION`), `src/core/name-key.ts`, `src/core/category-seed.ts` (`Zone`), `src/core/workspace.ts` (`resolveWorkspace`, `catalogPath`).
- `src/adapters/sqlite/sqlite-catalog-store.ts` -- `openCatalogStore(dbPath, { clock, ids, busyTimeoutMs, migrations? })`, `configureConnection`; `migrate.ts` exports `migrate`, `bundledMigrations`; schema in `migrations/0001-initial.sql` (entries: `seq`, `id`, JSON list columns, `UNIQUE(owner_id, dedup_key)`; categories `UNIQUE(owner_id, zone, name_key)`).
- `src/cli/main.ts` -- `main(args, io, deps)` with `CliDeps { env, fs, clock, ids, cwd, openStore }`; `bin.ts` is the only file importing adapters. `tests/helpers.ts` has temp dirs, fixed clock, sequential ids; `tests/init.test.ts` shows how CLI tests run.
- `src/shared/strings.ro.ts` -- `cliStrings`, `errorMessages: Record<ErrorCode, string>`.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- add `zod` 4.6.7 (exact, dependency) -- spine Stack
- [x] `src/core/versions.ts` -- `BATCH_SCHEMA_VERSION`, `IMPORT_REPORT_VERSION`, `CLI_OUTPUT_VERSION` (all 1)
- [x] `src/core/batch-schema.ts` (+ test) -- `{ schemaVersion, items (≥1), newCategories: [{ zone, name }] = [], proposedBlockedDomains: string[] = [] }`; item = `{ ref, op: 'add', kind, name, categories (1–2 names), whatItDoes, situations (≥1), keywords = [], flaggedByClaude? }` + `tool`/`material`: `url`, `resourceType ∈ repo|site|app`; `concept`: `url?`, `content`, `sources = []`; refs unique in the batch -- AD-6, entry-model
- [x] `src/core/url.ts` (+ test) -- `normalizeUrl()` (host lowercase, no `www.`, no scheme, fragment, trailing slash, `utm_*`; unparsable input → trimmed lowercase without scheme) and `dedupKey()` (`url:` or, for a concept without url, `title:` + `nameKey(name)`) -- AD-5, AD-7
- [x] `src/core/verification/reason-codes.ts` -- closed `ReasonCode` with `unknown_category`, `flagged_by_claude`, `duplicate`; `VerdictReason { code, params? }` -- AD-15
- [x] `src/core/dto.ts` -- `EntryDto` (all fields, `zone` derived from `kind`, categories as `{ id, name }`, ISO dates), `EntrySummaryDto` (no `content`), `CategoryDto`, mapping helpers -- AD-18
- [x] `src/core/import-report-schema.ts`, `src/core/cli-schemas.ts` -- report exactly as AD-14 (`ignoredLinks` stays `[]` until ticket 7); `list`, `show` and error documents `{ schemaVersion, workspace: string | null, error: { code, message, issues? } }` -- AD-14
- [x] `src/core/ports.ts`, `src/adapters/sqlite/sqlite-catalog-store.ts` -- store gains a read API (categories by zone, entry by id, summaries, id by dedup key) and `writeTransaction(fn)` (`BEGIN IMMEDIATE`, commit, rollback on throw) exposing inserts for entries, categories and `entry_categories`; read-only open mode (`readOnly`, no migrations, refuses pending ones with `DATABASE_NEEDS_MIGRATION`); write mode refuses a missing file with `CATALOG_NOT_FOUND` except when `init` creates it -- AD-4, AD-11
- [x] `src/core/import-batch.ts` (+ test with a fake store) -- phase 1: JSON → `schemaVersion` check → Zod; phase 3 in one write transaction: resolve categories by `name_key` in the item's zone (declared ones created on first use, reused when present), reject flagged, detect duplicates (catalog + earlier items), insert with `Clock` timestamps and `IdGenerator` ids, `verified_at` NULL until ticket 5; returns the report; every item appears exactly once -- AD-6
- [x] `src/core/errors.ts`, `src/cli/exit-codes.ts`, `src/shared/strings.ro.ts` -- `BATCH_INVALID`, `BATCH_SCHEMA_OUTDATED` (1), `ENTRY_NOT_FOUND` (1), `CATALOG_NOT_FOUND` (2), `DATABASE_NEEDS_MIGRATION` (3); Romanian texts for errors, reason codes, outcomes and the text report -- AD-11, AD-13
- [x] `src/cli/main.ts`, `src/cli/commands/*.ts` -- `import <lot> [--json]`, `list [--json]`, `show <id> [--json]`; unknown options exit 1; JSON outputs parsed through their schema before printing; text report rendered from the same report object -- AD-11, AD-14
- [x] `tests/import.test.ts` -- every matrix row through `main` on a temp workspace created by `init`; plus: `list`/`show` leave the catalog file's bytes unchanged

**Acceptance Criteria:**
- Given a dev workspace, when `init`, then `import` of a one-resource batch, then `list --json` run, then the resource is listed with its categories and `workspace` is the resolved path.
- Given `npm test`, `npm run lint`, `npm run typecheck`, when they run, then all pass.

## Design Notes

Phase 2 (verification, GitHub) slots between the two phases in ticket 5; keep phase 1 and phase 3 as separate functions so it can. The transaction re-checks duplicates itself because another process may write between phases. Zod issues go into `error.issues` as `{ path, message }` so `/importa` can fix the batch; their English messages are technical detail, not UI text.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors
- `npm run build:cli && node dist/cli/whenkit.mjs --help` -- expected: lists `import`, `list`, `show`

## Implementation Notes

- Added `ARGUMENTS_INVALID` (exit 1) so a usage error with `--json` still prints one JSON document (AD-11).
- Duplicates: an earlier *added* item of the same batch wins (reported by `params.ref`), then the catalog (`duplicateOfId`); rejection reasons (`flagged_by_claude`, `unknown_category`) take priority over duplicate.
- Report `newCategories` lists only declared categories an added item used (`created` true/false); unused declarations are neither created nor reported.
- Text fields are trimmed and must be non-empty (concept `content` kept verbatim); a numeric `schemaVersion` ≠ 1 is `BATCH_SCHEMA_OUTDATED`, a non-numeric one `BATCH_INVALID`; non-http(s) URLs use the fallback normalization.
- The report is validated inside the write transaction, so a schema bug rolls the import back.

## Review Triage Log

Loop 0 — quick lens: 0 high, 2 medium, 2 low, 1 rejected, 1 deferred.

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | store read-only open | `list`/`show` leave `-shm`/`-wal` files in `data/` | low | every reader of a WAL database needs the shared-memory file; catalog data is unchanged (AD-11's intent); avoiding it needs `immutable=1`, unsafe with concurrent writers | reject |
| 2 | `src/cli/main.ts` | unknown command with `--json` prints no JSON document | medium | JSON mode chosen after command lookup; reproduced with the built CLI | patch |
| 3 | `src/core/url.ts` fallback | scheme-less `host:port/x` URLs collapse to `port/x` → false duplicates | medium | `new URL('example.com:8080/x')` takes `example.com:` as scheme; fallback regex strips it | patch |
| 4 | `src/core/batch-schema.ts` | whitespace-only concept `content` passes | low | `z.string().min(1)`; direct correction | patch |
| 5 | `tests/import.test.ts` | matrix row Duplicate (concept title) not covered end to end; no concept through SQLite | medium | all CLI tests use tools | patch (matrix audit) |
| 6 | `src/shared/strings.ro.ts` | type imports from several `core` modules beyond `core/dto` | low | widens the item already in deferred-work.md | defer |
