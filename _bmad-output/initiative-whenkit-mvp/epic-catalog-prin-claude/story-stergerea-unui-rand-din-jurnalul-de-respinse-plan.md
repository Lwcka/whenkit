---
title: 'Ștergerea unui rând din jurnalul de respinse'
type: 'feature'
ticket: '18'
created: '2026-10-15'
status: 'built'
baseline_revision: 'f46ff0b9ac9a406b72c02dc02a56dfcbbb9fa908'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md'
  - '{project-root}/workspace-template/.claude/skills/importa/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A journal row whose retry was written with a corrected link that changed its dedup key stays in the journal forever, and no command can remove a row; a later `/importa respinse` offers it again and it comes out `duplicate` (ticket 11 review, finding 6).

**Approach:** A write command `whenkit rejections --remove <id> [--json]` (AD-11, chosen by the author on 2026-10-15) deletes one journal row by its id in one write transaction and prints the removed row; `/importa` runs it after a retry whose item was written but whose old row is still in the journal.

## Boundaries & Constraints

**Always:** Plain `whenkit rejections [--json]` stays read-only and unchanged. `--remove` takes exactly one id (the journal row's `id` from `rejections --json`); `--remove` without a value or with another positional is a usage error (`ARGUMENTS_INVALID`, exit 1). An id not in the journal of this owner → new `ErrorCode` `REJECTION_NOT_FOUND`, exit 1 (one row in the `exit-codes.ts` table), nothing deleted. On success exit 0; `--json` prints one document validated by a new schema in `src/core/cli-schemas.ts`: `{ schemaVersion: CLI_OUTPUT_VERSION, workspace, removed: RejectionDto }`; text mode prints one Romanian line naming the removed element. The delete runs through `CatalogStore.writeTransaction` with a new `CatalogWriter` method (owner-scoped, returns whether a row was deleted). All Romanian text in `strings.ro.ts` (AD-13); usage text lists the new form. Template: `/importa` step 9 says, after a retry exits 0, to compare `whenkit rejections --json` against the retried rows and remove, with `--remove`, each row whose item was written (`added`/`updated`/`warned`) or came out `duplicate` (the resource is already in the catalog; renegotiated by the author on 2026-10-16 after review) but whose row is still there — never a row whose item was rejected again; the runtime `CLAUDE.md` command table lists `whenkit rejections --remove <id>`; bump `TEMPLATE_VERSION` to 7.

**Never:** No new migration. No change to how import journals or clears rows. No bulk removal, no removal by dedup key. No UI (epic 2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Remove | journal row `r1` | `rejections --remove r1 --json` → exit 0, `{ removed: {…r1} }`; `rejections --json` no longer lists it; other rows stay | — |
| Unknown id | `--remove nope` | exit 1, JSON error document, journal unchanged | REJECTION_NOT_FOUND |
| Missing value | `--remove` alone, or `--remove --json` | exit 1, nothing deleted | ARGUMENTS_INVALID |
| Extra argument | `--remove r1 r2` | exit 1, nothing deleted | ARGUMENTS_INVALID |
| Text | `rejections --remove r1` | one Romanian line with the element's name; exit 0 | — |
| Read-only list | `rejections --json` | unchanged output, never writes | — |

</frozen-after-approval>

## Code Map

- `src/cli/commands/rejections.ts` -- `runRejections`; today `parseArgs('rejections', args, { required: [], json: true })` then `withReadStore`. Pull `--remove <id>` out first, the way `extractForce` (`src/cli/command.ts:104`) pulls `--force <ref>` (same `missingOptionValue` usage error); without it, keep the current path untouched.
- `src/core/ports.ts:207` `CatalogWriter` -- add e.g. `deleteRejectionById(id): boolean`; `CatalogStore.writeTransaction` (line ~255). Implement in `src/adapters/sqlite/sqlite-catalog-store.ts` next to `deleteRejections` (line ~508; owner-scoped like it). Fakes implementing `CatalogWriter`/`CatalogStore` in tests (`src/core/import-batch.test.ts` and any other) need the method.
- `src/core/errors.ts` `ERROR_CODES`; `src/cli/exit-codes.ts` `exitCodeFor`; `src/shared/strings.ro.ts` `errorMessages` (line ~63, `ENTRY_NOT_FOUND` is the model), `usage` (line ~21), `rejectionStrings`.
- `src/core/cli-schemas.ts` -- add the output schema next to `rejectionsOutputSchema`; `src/core/dto.ts` `toRejectionDto`.
- `src/cli/render.ts` `renderRejections` -- model for the one-line text.
- `workspace-template/.claude/skills/importa/SKILL.md` step 9 (`/importa respinse`, item 4 already says a changed key leaves the old row); `workspace-template/CLAUDE.md` command table; `src/core/versions.ts` `TEMPLATE_VERSION`.
- Tests: `tests/import-rejections.test.ts` (journal fixtures via `tests/cli-harness.ts`), `tests/importa-skill.test.ts` (rule phrases), `tests/init.test.ts:279` (CLAUDE.md names commands).

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/ports.ts`, `src/adapters/sqlite/sqlite-catalog-store.ts`, test fakes -- delete-by-id writer method
- [ ] `src/core/errors.ts`, `src/cli/exit-codes.ts`, `src/core/cli-schemas.ts`, `src/shared/strings.ro.ts`, `src/cli/render.ts`, `src/cli/commands/rejections.ts` -- the `--remove` path
- [ ] `workspace-template/.claude/skills/importa/SKILL.md`, `workspace-template/CLAUDE.md`, `src/core/versions.ts` -- skill step, command table, `TEMPLATE_VERSION = 7`
- [ ] `tests/rejections-remove.test.ts` (or `tests/import-rejections.test.ts`), `tests/importa-skill.test.ts` -- every matrix row; the skill states when to remove and when not

**Acceptance Criteria:**
- Given a journal with two rows, when one is removed, then the other row and the catalog entries are untouched (same `list --json` before and after).
- Given `npm test`, `npm run lint`, `npm run typecheck`, `npm run build:cli`, when they run, then all pass.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build:cli` -- expected: pass

Loop 0 — quick lens (Opus): 0 high, 4 medium, 2 low (4 patched, 2 rejected); one finding renegotiated the intent.

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | `src/cli/commands/rejections.ts` | find/delete/not-found logic in the CLI breaks AD-3 (only core use cases write) | medium | `import` delegates to `applyBatch`; the window would repeat the logic | patch: `src/core/remove-rejection.ts` |
| 2 | `SKILL.md` step 9 | `--remove` run without `--json`; exit 1 cannot tell REJECTION_NOT_FOUND from ARGUMENTS_INVALID (AD-11) | medium | `reportError` maps UsageError to exit 1 | patch: `--json`, check `error.code` |
| 3 | `SKILL.md` step 9 | no deterministic link from a journal row to its retried item's outcome | medium | refs were free-form; the batch is deleted after exit 0 | patch: `ref` = `reluare-<id-rând>` |
| 4 | `SKILL.md` step 9 / intent | a `duplicate` row could never be removed, so stuck rows stay forever | medium | duplicate = the resource is already in the catalog | intent renegotiated by the author (2026-10-16): remove on `duplicate` too; patched |
| 5 | `extractValueOption` | a single-dash value is taken as the id | low | same as `extractForce`; gives REJECTION_NOT_FOUND, nothing deleted | reject (consistent, harmless) |
| 6 | `src/cli/command.ts` | `extractValueOption` nearly duplicates `extractForce` | low | refactor, not a bug | reject |
