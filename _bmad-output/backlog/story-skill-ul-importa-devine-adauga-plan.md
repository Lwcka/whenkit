---
title: 'The /importa skill becomes /adauga'
type: 'feature'
ticket: 'story-skill-ul-importa-devine-adauga'
created: '2026-10-21'
status: done
baseline_revision: 'dad85d385627df10fab5ac4c90cafbb5f63c4eda'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The workspace import skill is `/importa`, which the author confuses with Claude Code's own commands that start the same way. Every place the product tells the user which command to run says `/importa`, and an existing workspace would keep the old skill after an upgrade.

**Approach:** Rename the skill to `/adauga` with the same behavior, change every user-facing mention, and make `whenkit init` retire the old skill per AD-17: a list of retired template paths in code (`.claude/skills/importa/SKILL.md`, `.claude/skills/importa/exemplu-lot.json`, the only files that skill ever shipped) whose files `init` deletes, even when modified, removing their folder only when it is left with no files; `TEMPLATE_VERSION` goes from 7 to 8 so old workspaces get the outdated-template warning.

## Boundaries & Constraints

**Always:** `init` never touches `data/`, `input/`, `batches/`, or any file not on the retired list (a user file inside `.claude/skills/importa/` stays, and so does the folder). Retirement runs after the template plan is read (AD-11: a broken template still fails with nothing written). The skill's steps, Claude's verdict, the batch format and `whenkit import` are unchanged; only the name and the mentions change.

**Never:** No change to records (closed ticket plans, `deferred-work.md`, `.memlog.md`). No `/importa` left in the template, the UI strings, or any CLI message. No new runtime dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh init | empty folder | `.claude/skills/adauga/` (SKILL.md, exemplu-lot.json), no `importa/` | — |
| Upgrade | workspace with template-7 `importa/SKILL.md` + `exemplu-lot.json`, data and input files | both removed, `importa/` gone, `adauga/` installed, `data/**` and `input/**` byte-identical | — |
| Modified retired file | `importa/SKILL.md` edited by the user | still removed | — |
| User file in retired folder | `importa/notes.md` (not on the list) | kept, folder kept, retired files removed | — |
| Re-run | init twice | second run is a no-op for retirement | missing files are not an error |
| Old workspace warning | marker `templateVersion: 7`, `whenkit list` | stderr outdated-template warning asking for `whenkit init` | — |
| Empty catalog | window, catalog empty | the command shown is `/adauga` | — |

</frozen-after-approval>

## Code Map

- `workspace-template/.claude/skills/importa/` -- `git mv` to `adauga/`; in `SKILL.md`: `name: adauga`, heading `# /adauga`, `/importa respinse` → `/adauga respinse` (lines 2, 8, 79, 86). Keep the rest of the text.
- `workspace-template/CLAUDE.md:12`, `workspace-template/.claude/skills/reguli-fise.md:3`, `workspace-template/.claude/skills/gaseste/SKILL.md` (its `/importa` suggestions) -- mention `/adauga`.
- `src/shared/strings.ro.ts:387` -- `emptyCatalogCommand: '/adauga'`.
- `src/core/versions.ts` -- `TEMPLATE_VERSION = 8`; comment `/adauga`. `src/core/dto.ts:82` comment.
- `src/core/workspace.ts:45-108,354-398` -- `planTemplate`/`writeTemplate`/`initWorkspace`; add a `RETIRED_TEMPLATE_PATHS` constant and a retire step after `writeTemplate` (delete each listed file that exists; then each of their parent folders, deepest first, when `fs.listFiles` returns nothing). Update the doc comment of `initWorkspace`.
- `src/core/ports.ts:26-41` -- `FileSystem` has no file removal: add `removeFile(path)` (no-op when missing); implement in `src/adapters/fs/node-file-system.ts` and in every fake `FileSystem` (`src/core/workspace.test.ts`, `src/desktop/main/catalog.test.ts`, `tests/export-catalog.test.ts`; find others with `grep -rn "listFiles" src tests`).
- Tests: `tests/importa-skill.test.ts` → `tests/adauga-skill.test.ts` (paths, `meta.name === 'adauga'`), `tests/skill-files.ts:8,13`, `tests/init.test.ts:282-305` (fresh init has only `adauga`; add the upgrade, modified-file, user-file and re-run rows), `tests/gaseste-skill.test.ts:41,71,75`, `src/desktop/renderer/app.test.tsx:408`, `src/core/workspace.test.ts:65,309,443` (fixture paths that read the template skill), `tests/template-warning.test.ts` (old-workspace row, if not already covered for version < current).
- `CLAUDE.md:55,76` (dev) -- mention `/adauga`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/ports.ts`, `src/adapters/fs/node-file-system.ts`, fakes -- `removeFile`.
- [ ] `src/core/workspace.ts`, `src/core/versions.ts` -- retired list, retire step, version 8.
- [ ] `workspace-template/**` -- rename the skill folder and every mention.
- [ ] `src/shared/strings.ro.ts`, `src/core/dto.ts` -- `/adauga`.
- [ ] tests listed in the Code Map -- one per matrix row.
- [ ] `CLAUDE.md` -- `/adauga`.

**Acceptance Criteria:**
- Given the merge into `main`, when the author runs `npm run build:cli`, `whenkit init` on the real workspace and `/adauga <link>`, then the skill runs as `/importa` did and `.claude/skills/importa/` is gone (hitl).
- Given the change, when `grep -rn "/importa\|skills/importa" workspace-template src tests CLAUDE.md` runs, then the only hits are the retired-path list and the tests that seed an old workspace.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: clean
- `npm run typecheck` -- expected: clean

## Implementation Notes

- `FileSystem.removeFile` added (no-op when missing); the `src/core/workspace.test.ts` fake now lists a registered empty folder as empty, like the real file system.
- The retire step runs after `writeTemplate`, so a broken template fails before anything is deleted.

## Review Triage Log

Quick lens: high 0, medium 1, low 3, false 1, maybe-false 0.

| Verdict | Route | Finding | Evidence / action |
|---|---|---|---|
| low | rejected | A retired folder holding only a link, junction or empty subfolder is removed recursively | Real but rare (a user link inside a skill folder); `rmSync` does not follow links, so no target is lost; a non-recursive removal needs a new port method. |
| low | rejected | A retired path re-added to the template would be written then deleted in the same init | Hypothetical: no such path exists; the guard would cover a state not demonstrated. |
| medium | patch | The upgrade fixture already had `adauga/` installed, so "adauga installed" was not really tested | Fixed: the fixture deletes `adauga/` before seeding the template-7 files. |
| false | rejected | AC grep: two fresh-init asserts mention `importa` | They assert its absence, which the fresh-init matrix row requires. |
| low | patch | `initWorkspace` doc comment line not wrapped | Re-wrapped. |
