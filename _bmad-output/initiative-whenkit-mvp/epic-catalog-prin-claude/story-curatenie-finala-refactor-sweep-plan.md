---
title: 'Curățenie finală (refactor sweep)'
type: 'refactor'
ticket: '13'
created: '2026-10-15'
status: 'built'
baseline_revision: '1bc414d3f02164ae510abde3fb502ecbe3e6f5fa'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/spec-whenkit/verification-rules.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tickets 1–12 left duplication (the same CLI test harness rebuilt in nine test files, the same open-read-close shape in four read commands), two stale ticket comments, a `Zone` type defined away from `ZONES`, and three rules of `verification-rules.md` with no offline test.

**Approach:** Behavior-preserving cleanup only: one shared CLI test harness, one read-store helper for the read commands, `Zone` derived from `ZONES`, stale comments fixed, and the missing offline tests added. Gaps that need new behavior become new tickets (recorded in `deferred-work.md`).

## Boundaries & Constraints

**Always:** No change to CLI output, exit codes, schemas, migrations, the workspace template or any observable behavior. Every existing test keeps its assertions: tests are moved onto the shared harness, never weakened or dropped; the test count after the change is at least the count before (634) plus the new tests. AD-2 boundaries hold (`src/core` imports nothing outside core). The deferred items of earlier tickets already settled (GitHub fields on update — ticket 9; op/id pairing in the JSON Schema and kind changes of umbrellas — ticket 7; `forced` on update — ticket 8; re-declared categories on retry — ticket 11) are not reopened.

**Never:** No new behavior: the duplicate message without the entry's name (`verification-rules.md` "există deja: <nume>") and the "abandonat" repo note have no code today and become new tickets. No removal of exported contract types/schemas from `src/core` (the window epic consumes them). No edits to tickets, spec or architecture files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default timeout | `createHttpClient()` without `timeoutMs`, a server that never answers | the check gives up after 10 s (fake timers), as a timeout | — |
| Force vs schema | `import <lot> --force <ref>` on a batch that fails the schema | exit 1, nothing written, nothing journaled | BATCH_INVALID |
| Initial blocked list | `workspace-template/data/blocked-domains.txt` | holds the rules for `libgen.*`, `sci-hub.*`, `z-lib.*`, `pdfdrive.com`, `12ft.io` | — |

</frozen-after-approval>

## Code Map

- `tests/helpers.ts` -- `runWhenkit` (hard-codes `unusedHttp`, `fixedClock()`), `fakeAppRoot`, `fakeEnvironment`, `okHttp`, `notFoundGithub`, `testStoreOpener`. Extend it (or add `tests/cli-harness.ts`) with one `setup(options)` + `runCli(s, args)` whose options cover the variations found: `workspaceEnv`, `openStore`, `http`, `github`, `clock`, `retryDelayMs` (`CliDeps.retryDelayMs`, src/cli/command.ts:35).
- Files rebuilding that harness: `tests/import.test.ts:39-91`, `tests/import-update.test.ts:59-102`, `tests/import-links.test.ts:46-88`, `tests/import-rejections.test.ts:51-93`, `tests/import-github.test.ts:66-113`, `tests/import-verification.test.ts:176-221`, `tests/init.test.ts:53-78` (its `runCli` = `runWhenkit`), `tests/importa-skill.test.ts:72-93`, `tests/gaseste-skill.test.ts:148-169`. Also repeated per file: `initialized`, `writeBatch`/`batchCount`, `tool`, `batch`, `importJson`, `importReport`, `show`, `count` -- share the ones identical across files; keep file-specific variants local.
- `tests/importa-skill.test.ts:39-48`, `tests/gaseste-skill.test.ts:36-45` -- identical `frontmatter()`, `TEMPLATE`, `EXAMPLE`, `read`: share them.
- `src/cli/commands/{list,show,categories,rejections}.ts` -- each opens the store `readOnly: true`, reads, closes in `finally`, then prints; add one helper in `src/cli/command.ts` (e.g. `withReadStore(ctx, workspace, read)`).
- `src/core/category-seed.ts:6` `Zone`, `src/core/entry.ts:1,11` `ZONES` -- define `ZONES` in `entry.ts` and derive `Zone` from it; `category-seed.ts` imports the type.
- Stale comments: `src/core/batch-schema.ts:6-7` ("from ticket 7"), `tests/import-update.test.ts:174` ("`--force` (ticket 8) will write").
- `src/adapters/http/node-http-client.ts:61` `timeoutMs = 10_000`; `tests/http-client.test.ts` (local servers, `quick` options). `tests/import-rejections.test.ts` for `--force` cases. `workspace-template/data/blocked-domains.txt`.

## Tasks & Acceptance

**Execution:**
- [ ] `tests/helpers.ts` (or `tests/cli-harness.ts`) + the nine test files above -- one shared harness and shared builders; per-file copies removed -- duplication
- [ ] `src/cli/command.ts`, `src/cli/commands/{list,show,categories,rejections}.ts` -- read-store helper -- duplication
- [ ] `src/core/entry.ts`, `src/core/category-seed.ts` -- `Zone` from `ZONES`
- [ ] `src/core/batch-schema.ts`, `tests/import-update.test.ts` -- fix the stale comments to describe what exists now
- [ ] `tests/http-client.test.ts`, `tests/import-rejections.test.ts`, `tests/init.test.ts` (or a template test) -- the three matrix rows
- [ ] `_bmad-output/initiative-whenkit-mvp/deferred-work.md` -- two entries: the duplicate message lacks the entry's name; the "abandonat" repo note has no definition or code (needs a spec decision on what counts as abandoned)

**Acceptance Criteria:**
- Given the change, when `git diff` is read for `src/`, then only the read-store helper, the `Zone` move and comments changed; no CLI output, exit code or schema differs.
- Given `npm test`, when it runs, then all tests pass and the count is at least 634 plus the new tests.
- Given `npm run lint`, `npm run typecheck`, `npm run build:cli`, when they run, then all pass.

## Implementation Notes

## Plan Change Log

## Review Triage Log

Loop 0 — quick lens: 0 high, 0 medium, 2 low (1 patched, 1 rejected).

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | `tests/init.test.ts:163-193` | the blocked-list test reads the template file, not the list `init` installs | low | the matrix row's input is the template file; `init` copying template files byte for byte is covered since ticket 10 | reject (row met; no new coverage) |
| 2 | `tests/import-update.test.ts:69` | rewritten comment is one 91-column line among 80-column comments | low | cosmetic; wrapped | patch (applied in the main session) |

## Design Notes

Dead `export`s found in the sweep are kept: most are the contract types and schemas of `core` (AD-14, AD-18) that the window epic will import, and the rest are tested directly. The `--json` flag stated both in `COMMANDS` and in each command's `parseArgs` stays: `main` needs it before parsing to print a usage error as JSON.

## Verification

**Commands:**
- `npm test` -- expected: all pass, count ≥ 634 + new
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors
- `npm run build:cli` -- expected: builds
