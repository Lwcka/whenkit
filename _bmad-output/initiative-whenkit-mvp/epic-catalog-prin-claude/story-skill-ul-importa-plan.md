---
title: 'Skill-ul /importa'
type: 'feature'
ticket: '11'
created: '2026-10-15'
status: done
baseline_revision: 'f63db36ab35e953d7b73bac92dbbca975378affc'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/spec-whenkit/card-writing-rules.md'
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/spec-whenkit/workspace-and-import-flow.md'
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/spec-whenkit/test-scenarios.md'
  - '{project-root}/workspace-template/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The workspace's runtime CLAUDE.md points to `/importa` and `.claude/skills/reguli-fise.md`, but neither exists, so Claude Code cannot turn `input/` materials, a link or a journaled rejection into cards (CAP-6, CAP-7).

**Approach:** Add to `workspace-template/` the shared rules file (from `card-writing-rules.md`), the `/importa` skill (Romanian instructions for Claude) and a reference example batch; bump `TEMPLATE_VERSION` so existing workspaces are told to re-init; test that the shipped files hold to the CLI contract.

## Boundaries & Constraints

**Always:** One batch per input file, written to `batches/`, imported with `whenkit import <lot> --json`; the report is read by `ref`, and the batch and the input file are deleted only on exit 0 (rejections are journaled, so exit 0 consumes the file). On exit 1 Claude fixes the batch from `error.issues` and retries at most twice; on 2–4 it stops, keeps both files and tells the user why. Before writing anything the skill runs `whenkit categories --json` and stops when its `workspace` is not the current folder (the global `whenkit` resolves the workspace from `WHENKIT_WORKSPACE`/config.json, not from the cwd). Categories come only from that list; a new one is declared in `newCategories`. Flagged content stays in the batch with `flaggedByClaude` (so it is rejected and journaled) and its domain may go to `proposedBlockedDomains`. A malformed URL is sent as written. Arguments: none → every file in `input/`, one at a time; a URL → a one-item batch; `respinse` → retry from `whenkit rejections --json`; any other text → treated as an input text. A retry shows the proposed fixes (e.g. corrected link) and imports after the user agrees; it re-declares in `newCategories` any category of the element missing from `whenkit categories --json`, rewrites the element to the current schema when its `batchSchemaVersion` differs, and uses `--force <ref>` only when the user explicitly asks. Leftover files in `batches/` at start are reported and the user chooses to re-import or delete them. All skill and rules text in Romanian.

**Never:** No `/gaseste` (ticket 12). No change to `src/` beyond `TEMPLATE_VERSION`. No writes in `data/`, no `myNotes`. No copy of the real test data into the repo. No spec edits.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Text file | `input/inspire.txt`, 6 URLs | 6 Romanian cards, 3–6 problem-shaped situations each; file deleted | — |
| Concept notes | `input/API/*.png` | one concept per API type + umbrella „Tipuri de API” with `children`, comparison table, „când alegi care”; every concept has `sources` | — |
| Link | `/importa https://remove.bg` | one card added; nothing in `input/` touched | — |
| Retry | journal holds `httpss://gutenberg.org` | proposed `https://gutenberg.org`; after OK, added; journal row gone | — |
| Invalid batch | import exits 1 | batch fixed from `issues`, re-imported; after 2 failed retries stop, files kept | BATCH_INVALID |
| Unavailable | import exits 3 (offline) | stop, batch and input file kept, user told | OFFLINE |
| Wrong workspace | `categories --json` `workspace` ≠ cwd | nothing written; user told to set `WHENKIT_WORKSPACE` or run `whenkit init` | — |
| Unsupported file | binary non-image in `input/` | skipped, left in place, reported | — |

</frozen-after-approval>

## Code Map

- `workspace-template/CLAUDE.md` -- already names `.claude/skills/importa/`, `.claude/skills/reguli-fise.md`, `batches/`, the exit codes; keep consistent, change only if a fact there turns out wrong.
- `src/core/batch-schema.ts` -- the batch contract: item fields (`ref`, `op`, `id`, `kind`, `name`, `categories` 1–2, `whatItDoes`, `situations`, `keywords`, `related`, `flaggedByClaude`; `url`+`resourceType` repo|site|app for tool/material; `content`, `sources`, `children` for concept), `newCategories`, `proposedBlockedDomains`. op/id rules live in `superRefine` and are absent from the JSON Schema: state them in the skill.
- `src/core/import-report-schema.ts` -- report: `items[{ ref, op, outcome, id?, duplicateOfId?, reasons }]`, `newCategories`, `ignoredLinks`, `proposedBlockedDomains`. `src/core/cli-schemas.ts` -- `errorOutputSchema` (`error.code`, `error.issues`), `rejectionsOutputSchema`, `categoriesOutputSchema`.
- `src/core/dto.ts:65` `rejectionDtoSchema` -- `element`, `op`, `reasons`, `dedupKey`, `batchSchemaVersion`.
- `src/core/verification/reason-codes.ts` -- reason codes the skill explains to the user.
- `src/core/versions.ts` -- `TEMPLATE_VERSION` 1 → 2.
- `src/cli/main.ts:50` `COMMAND_NAMES`; `src/cli/commands/import.ts:34` resolves the batch path against the cwd.
- `tests/helpers.ts` (`fakeAppRoot`, `runWhenkit`, `okHttp`), `tests/import.test.ts` (import with fake HTTP), `tests/init.test.ts:279` (template-content test pattern).

## Tasks & Acceptance

**Execution:**
- [ ] `workspace-template/.claude/skills/reguli-fise.md` -- every rule of `card-writing-rules.md`, mapped to batch fields (situations → `situations`, Surse → `sources`) -- shared by /importa and /gaseste
- [ ] `workspace-template/.claude/skills/importa/SKILL.md` -- frontmatter `name: importa`, `description`, `argument-hint`, `allowed-tools` (`Bash(whenkit:*)`, `WebFetch`, `Read`); the flow per the Always rules: arguments, workspace check, leftovers, extract candidates (images via Read, links from text), visit each link, classify, write per rules file, verdict, batch, import, report by ref in Romanian, delete on 0; exit-code handling; op/id rules; retry -- CAP-6, AD-6, AD-11, AD-14, AD-17
- [ ] `workspace-template/.claude/skills/importa/exemplu-lot.json` -- a valid batch: a tool (repo), a material, an umbrella concept with two child concepts and `sources`, a flagged item; seeded categories only -- the skill's reference shape
- [ ] `src/core/versions.ts` -- `TEMPLATE_VERSION = 2` -- AD-17
- [ ] `tests/importa-skill.test.ts` -- see ACs; the matrix rows are Claude's behavior, so each row also gets an assertion that `SKILL.md` states it (its key rule or phrase); the hitl check proves them live

**Acceptance Criteria:**
- Given `exemplu-lot.json`, when parsed with `batchSchema`, then it passes with `schemaVersion` = `BATCH_SCHEMA_VERSION`; and imported with `okHttp` into a fresh init'ed workspace, every item but the flagged one is `added`, the flagged one `rejected` with `flagged_by_claude`, and the umbrella links its children.
- Given `SKILL.md`, when read, then its frontmatter has `name: importa`, every `whenkit <word>` it names is in `COMMAND_NAMES`, and it names `batches/`, `input/`, `reguli-fise.md`, `exemplu-lot.json`, `--json`, `respinse`.
- Given `reguli-fise.md`, when read, then it covers the sections of `card-writing-rules.md` (Clasificare, Când o folosesc, Cuvinte-cheie, Resurse înrudite, Concepte, Surse, Notițele mele).
- Given `whenkit init` on an empty folder, when it runs, then `.claude/skills/importa/SKILL.md`, `exemplu-lot.json` and `.claude/skills/reguli-fise.md` exist in the workspace.
- Given `npm test`, `npm run lint`, `npm run typecheck`, `npm run build:cli`, when they run, then all pass.

## Implementation Notes

- `SKILL.md` adds one exception to "one batch per input file": screenshots in a subfolder that are parts of one subject (the five `API/` captures) become one batch named after the folder, so the umbrella can link its children; every file of the group is deleted after exit 0. Required by the `API/` scenario (CAP-7).
- `SKILL.md` lists a Romanian gloss of the reason codes for the report; text given directly is batched as `batches/link-<yyyymmdd-hhmmss>.json`.
- Writing batches (Write) and deleting files (rm) go through the normal permission prompt.
- Files: `src/core/versions.ts`, `workspace-template/.claude/skills/{reguli-fise.md,importa/SKILL.md,importa/exemplu-lot.json}`, `tests/importa-skill.test.ts`, `tests/init.test.ts`. Verified: `npm test` (623), lint, typecheck, build:cli.

## Plan Change Log

## Review Triage Log

Loop 0 — quick lens: 0 high, 4 medium, 5 low (9 patched; 2 follow-ups deferred).

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | `SKILL.md` step 2, wrong workspace | "rulează `whenkit init` aici" re-inits the other workspace | medium | `initWorkspace` with no path calls `resolveWorkspace` (workspace.ts:345); advice now names `WHENKIT_WORKSPACE` or `init <cale>` | patch |
| 2 | `SKILL.md` step 2, errors | bare `init` fails again on WORKSPACE_NOT_CONFIGURED; cod 3 not handled | medium | tests/init.test.ts expects exit 2 for bare init without config; now shows `error.message` on any non-zero exit | patch |
| 3 | `SKILL.md` step 3 | reimported leftover batch never cleaned, input file reprocessed as duplicates | medium | step 3 pointed only to step 7; now 7 and 8 | patch |
| 4 | `SKILL.md` 5.2/10 | a link whose page did not load is lost after the input file is deleted | medium | card rules say only "îl raportează"; summary now lists skipped links verbatim for `/importa <link>`; whether to journal them is a spec question (deferred) | patch |
| 5 | `SKILL.md` step 7 | reason gloss misses `unknown_id`, `duplicate`, `source_blocked_domain`, `parent_requires_concept`, `parent_cycle`, `forced_by_user` | low | reason-codes.ts | patch |
| 6 | `SKILL.md` 9.4 | journal row survives when the correction changes the dedup key | low | `deleteRejections(key)` with `dedupKey` from the written URL (import-batch.ts:621, url.ts:49); text corrected; no CLI removes a row (deferred) | patch |
| 7 | `SKILL.md` batch names | same stem in two files or subfolders collides with a kept batch | low | name from the stem only; now relative path with extension | patch |
| 8 | `SKILL.md` 4/8 | emptied subfolder stays in `input/` | low | test-scenarios.md expects `input/` empty | patch |
| 9 | `exemplu-lot.json` `filme-gratis` | one situation vs 3–6 in the rules | low | schema `min(1)` lets it pass | patch |

## Design Notes

„Surse” is the `sources` field, not a section repeated in `content`: the import verifies sources and drops dead ones (`source_link_removed`), which a copy in `content` would not follow. The workspace check exists because a Claude Code session in a dev workspace still calls the global `whenkit`, which would write into the real catalog unless `WHENKIT_WORKSPACE` is set. Refs are kebab-case slugs of the name, so the report reads back to the batch. Batch names: `batches/<input-stem>.json`, `batches/link-<yyyymmdd-hhmmss>.json`, `batches/reluare-<yyyymmdd-hhmmss>.json`. Deleting files goes through Claude Code's normal permission prompt (not pre-approved).

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors
- `npm run build:cli` -- expected: builds

**Manual checks (hitl):**
- `npm run build:cli`, `npm run cli:dev -- init`; open Claude Code in the dev workspace with `WHENKIT_WORKSPACE` set to it; copy `inspire.txt` and `API/` from `C:/Users/Luca/Personal/` into `input/`; run `/importa`: 6 cards with 3–6 situations, API concepts + umbrella with sources, `input/` empty; `/importa <link>` adds one card; a synthetic batch with `httpss://gutenberg.org` is rejected, then `/importa respinse` imports it with the corrected link.
