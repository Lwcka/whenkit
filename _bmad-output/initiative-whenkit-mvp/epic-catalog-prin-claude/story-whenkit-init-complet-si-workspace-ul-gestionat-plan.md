---
title: 'whenkit init complet și workspace-ul gestionat'
type: 'feature'
ticket: '10'
created: '2026-10-14'
status: 'built'
baseline_revision: '077585492c8eb07c04cda34d5a5ab602bc7a3939'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md'
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/spec-whenkit/workspace-and-import-flow.md'
  - '{project-root}/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `whenkit init` only creates folders, the catalog and `blocked-domains.txt`; the workspace has no runtime CLAUDE.md, no batch schema, no template marker, and the skills cannot list categories, so a Claude Code session opened there does not know how to work with the catalog (CAP-1, AD-17).

**Approach:** `init` copies every file of `workspace-template/` (template-managed files overwritten, user files under `data/` and `input/` created only when missing), writes `batch.schema.json` and `.whenkit-template.json`; every command that resolves a workspace warns on stderr when its template is outdated; a new read command `whenkit categories [--json]`; the template gains the Romanian runtime CLAUDE.md.

## Boundaries & Constraints

**Always:** The copy is generic: any file under `workspace-template/` (recursively, `.gitkeep` skipped) lands at the same relative path; one rule decides ownership: a path whose first segment is `data` or `input` is the user's (create when missing, never overwrite), everything else is overwritten on every init. `data/catalog.sqlite`, `data/backups/` and anything not in the template are never touched or deleted. Every template file is read before anything is written: a missing or unreadable template fails INTERNAL with nothing created (AD-11). `batch.schema.json` (workspace root) is exactly what `whenkit schema` prints. `.whenkit-template.json` = `{ templateVersion: TEMPLATE_VERSION, batchSchemaVersion: BATCH_SCHEMA_VERSION }`, written last. The outdated-template warning (missing/unreadable marker, `templateVersion` lower than the code's, or a different `batchSchemaVersion`) goes only to stderr and never changes stdout or the exit code; `init` and `schema` never print it. `categories` opens the catalog read-only. All Romanian text in `strings.ro.ts` (AD-13), except the template's own files.

**Never:** No `/importa` or `/gaseste` skill files and no card-writing rules file (tickets 11, 12); the runtime CLAUDE.md names their paths. No deletion of workspace files that left the template. No category editing (epic 2). No new migration. No change to config.json handling or path checks (ticket 2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New workspace | `init <path>` on an empty folder | folders, catalog, `CLAUDE.md`, `data/blocked-domains.txt`, `batch.schema.json`, `.whenkit-template.json`; no `.gitkeep` | — |
| Re-init | edited `CLAUDE.md`, edited `blocked-domains.txt`, a file in `input/`, entries in the catalog | `CLAUDE.md` restored from template; the other three unchanged | — |
| Missing template | `workspace-template/CLAUDE.md` unreadable | exit 4, nothing created in the workspace | INTERNAL |
| Old workspace | workspace without `.whenkit-template.json` (or `templateVersion: 0`) | `list --json` prints its valid JSON and exit 0, plus a stderr warning naming `whenkit init` | — |
| Current workspace | right after `init` | `list`, `show`, `rejections`, `import`, `categories`: no warning | — |
| Categories | fresh catalog | `categories --json`: `{ schemaVersion, workspace, categories: CategoryDto[] }`, 16 seeded, toolbox first then learn, by name within zone; text mode grouped by zone | — |
| Categories, no workspace | nothing configured | exit 2 with the JSON error document | WORKSPACE_NOT_CONFIGURED |

</frozen-after-approval>

## Code Map

- `src/core/workspace.ts` -- `initWorkspace` (reads `missingBlockedDomainsText` before creating anything; keep that order), `WORKSPACE_FOLDERS` (already has `batches`), `readBlockedDomains`/`ensureBlockedDomains` (import recreates a missing list; keep working). Generalize the blocked-domains template read into the full template plan; keep `blockedDomainsPath`.
- `src/core/ports.ts` `FileSystem` -- add `listFiles(dir): string[]` (recursive, files only, relative with `/`, sorted). Implement in `src/adapters/fs/node-file-system.ts`; fakes to update: `FakeFileSystem` in `src/core/workspace.test.ts`, the `untouched` fake in `src/cli/main.test.ts`.
- `src/core/versions.ts` -- add `TEMPLATE_VERSION = 1`.
- `src/core/batch-json-schema.ts` `batchJsonSchema()` -- source of `batch.schema.json`; `src/cli/commands/schema.ts` prints it with `JSON.stringify(…, null, 2)` + `\n`, use the same bytes.
- `src/cli/commands/{list,show,rejections,import}.ts` -- each does `resolveWorkspace` then `ctx.workspace = workspace`; replace with one helper in `src/cli/command.ts` that also emits the warning. Model `categories` on `list.ts` + `rejections.ts`.
- `src/core/dto.ts` -- `categoryDtoSchema`, `toCategoryDto` exist; `CatalogReader.categoriesInZone(zone)` (ordered by name_key); `ZONES` in `src/core/entry.ts`.
- `src/core/cli-schemas.ts` -- add `categoriesOutputSchema`. `src/cli/main.ts` `COMMANDS`; `src/cli/render.ts` (add `renderCategories`); `src/shared/strings.ro.ts` (`usage`, warning text; reuse `zoneLabels`).
- `tests/init.test.ts`, `tests/helpers.ts` (`fakeAppRoot` copies the real template) -- end-to-end pattern. Tests that assert `stderr === ''` on workspaces built without `init` may need the marker written.
- `workspace-template/.gitkeep` -- delete once `CLAUDE.md` exists.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/ports.ts`, `src/adapters/fs/node-file-system.ts`, fakes -- `listFiles` -- template copy needs a listing
- [ ] `src/core/versions.ts`, `src/core/workspace.ts` (+ `workspace.test.ts`) -- template copy with the ownership rule, `batch.schema.json`, marker; `templateOutdated(workspace, fs): boolean` -- AD-17
- [ ] `src/cli/command.ts`, `src/cli/commands/{list,show,rejections,import}.ts` -- shared workspace resolver that sets `ctx.workspace` and warns on stderr -- AD-17
- [ ] `src/core/cli-schemas.ts`, `src/cli/commands/categories.ts`, `src/cli/main.ts`, `src/cli/render.ts`, `src/shared/strings.ro.ts` -- `whenkit categories [--json]`, usage text, warning text -- AD-11
- [ ] `workspace-template/CLAUDE.md` -- runtime instructions in Romanian: what the workspace is and its folders; CLI commands with exit codes 0–4; `/importa` (`.claude/skills/importa/`) and `/gaseste` (`.claude/skills/gaseste/`); the card rules file at `.claude/skills/reguli-fise.md`; rules: never write in `data/`, writes only through `whenkit import`; never touch "Notițele mele"; batches go to `batches/`, never `input/`, deleted only after exit 0; free requests ("rescrie fișa X după regulile noi") become an `update` batch; `batch.schema.json` / `whenkit schema` is the batch contract -- CAP-1
- [ ] `tests/init.test.ts`, `tests/categories.test.ts`, `tests/template-warning.test.ts` -- every matrix row; plus: the template CLAUDE.md names every command in `COMMANDS`

**Acceptance Criteria:**
- Given a dev workspace, when `init` runs twice with `blocked-domains.txt` edited in between, then the edit survives and every template-managed file matches the template again.
- Given `npm test`, `npm run lint`, `npm run typecheck`, `npm run build:cli`, when they run, then all pass.

## Implementation Notes

## Plan Change Log

## Review Triage Log

Loop 0 — quick lens: 0 high, 0 medium, 8 low (4 patched, 3 rejected, 1 deferred).

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | `workspace.ts` `templateOutdated` | a newer `batchSchemaVersion` also warns "mai vechi… rulează whenkit init", and following it would downgrade the template | low | real only when an older build runs on a workspace a newer build initialized; AD-19 ships CLI and app from one `main` commit and dev uses a separate workspace; the frozen intent asks for "a different `batchSchemaVersion`" | reject (unlikely; intent chose `!==`) |
| 2 | `workspace.ts` `planTemplate`/`writeTemplate` | binary template files would be corrupted by the UTF-8 copy | low | the template holds only text (CLAUDE.md, skills, rules, blocked-domains); the fix adds a binary path to the `FileSystem` port | reject (unreachable today; adds surface) |
| 3 | `versions.ts` `CLI_OUTPUT_VERSION` comment | omits `categories` | low | `categoriesOutputSchema` uses it | patch |
| 4 | `workspace.ts` `TemplateFile.segments` doc | says `/`-separated, field is an array | low | `relative.split('/')` | patch |
| 5 | `workspace-template/CLAUDE.md` | rules file named `reguli-fise.md`; `workspace-and-import-flow.md` says "fișier de reguli comun = card-writing-rules.md" | low | the spec line reads as the companion the file comes from, but is ambiguous; a spec edit goes through `bmad-spec` | defer |
| 6 | `tests/init.test.ts` install test | the no-`.gitkeep` assertion cannot fail: the real template has none | low | `.gitkeep` deleted in this diff; only the in-memory unit test exercises the skip | patch |
| 7 | `tests/init.test.ts` re-init test | inserts a category, not an entry, as the matrix row says | low | the catalog file is never part of the template copy; a surviving category already proves the database is kept | reject (fix adds an import setup for no new coverage) |
| 8 | `workspace-template/CLAUDE.md` `init` row | "nu atinge `data/` și `input/`" is inaccurate, and nothing warns that a different `[cale]` repoints config.json | low | init creates missing user files; `initWorkspace` writes config.json for an explicit path | patch |

## Design Notes

Why a path-prefix ownership rule instead of a list of files: tickets 11 and 12 add skill files without touching `init`; only `data/` and `input/` belong to the user (AD-17). Why the marker is written last: an interrupted init leaves the old marker, so the next command still warns. Why also compare `batchSchemaVersion`: a batch schema bump changes `batch.schema.json`, and forgetting to bump `TEMPLATE_VERSION` would otherwise hide a stale schema. The rules file name `reguli-fise.md` is fixed here because the runtime CLAUDE.md must name it; ticket 11 creates it under that name.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors
- `npm run build:cli` -- expected: builds

**Manual checks (hitl):**
- With `.env` pointing to the dev workspace: `npm run cli:dev -- init`, edit `data/blocked-domains.txt`, run init again, check the edit; open Claude Code in the workspace and confirm (`/memory` or asking it) that only the runtime CLAUDE.md is loaded.
