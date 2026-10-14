---
title: 'Update și integritatea lotului'
type: 'feature'
ticket: '6'
created: '2026-10-14'
status: done
baseline_revision: '9af002354056f324b408cc99793b0af0e1e712ec'
route: 'full'
route_source: 'auto'
risk: 'high'
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

**Problem:** A batch can only add entries, so Claude cannot rewrite a card ("rescrie fișa X după regulile noi"), and nothing yet proves that an import keeps the author's own data or writes nothing when it fails.

**Approach:** Add `op: update` to the batch contract and the import (full replacement of Claude's fields, verified like an add, the author's fields untouched), and pin down the batch's integrity with tests: the complete report, the exit codes 3 and 4 with nothing written (AD-6, AD-14, AD-16).

## Boundaries & Constraints

**Always:** An update replaces every field Claude writes (kind, name, url, resourceType, whatItDoes, situations, keywords, content, sources, categories) and never touches `myNotes`, `ownerId`, `addedAt`, `forced`. `revision` grows by one on every update; `verifiedAt` and `verification_notes` are recomputed. A rejected or duplicate update leaves the entry exactly as it was. The duplicate check of an update excludes the entry itself. Phase 3 stays one transaction: any failure inside it rolls everything back.

**Decisions (Claude for the author, 2026-10-14, author away; recommended options):** the same `id` twice in one batch makes the batch invalid (`BATCH_INVALID`), so updates can never contradict each other; an update may change `kind`, and its categories are then matched in the new zone; an update of an entry that does not exist is `rejected` with `unknown_id`.

**Never:** No links, `children` or `related` (ticket 7). No `--force` or rejections journal (ticket 8). No GitHub metadata (ticket 9). No UI edits (`entries:patch`, epic 2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Update | existing entry with `my_notes`, `forced`; batch `op: update` with its `id` and new fields | outcome `updated`; Claude's fields replaced, categories replaced; `myNotes`, `ownerId`, `addedAt`, `forced` unchanged; `revision` +1; `verifiedAt` new | — |
| Same URL | update keeps its own URL | not a duplicate of itself | — |
| Collides | update's new URL equals another entry's | `duplicate` with `duplicateOfId`; entry unchanged | — |
| Unknown id | `op: update` with an id not in the catalog | `rejected` (`unknown_id`) | — |
| Rejected update | update whose new link is dead | `rejected`; entry unchanged, `revision` unchanged | — |
| Id twice | two updates with the same id in one batch | nothing written | `BATCH_INVALID`, exit 1 |
| Category reuse | the same new category declared twice (different case/diacritics) and used | created once; report lists it once, `created: true` | — |
| Report | batch with added, updated, warned, rejected, duplicate items and `proposedBlockedDomains` | every item exactly once with its outcome; domains echoed | — |
| Locked | another process holds the write lock longer than the busy timeout | nothing written | `DATABASE_BUSY`, exit 3 |
| Refused DB | an applied migration changed | nothing written | `MIGRATION_MISMATCH`, exit 3 |
| Internal | a failure injected inside phase 3 after some items were written | catalog byte-for-byte unchanged | `INTERNAL`, exit 4 |

</frozen-after-approval>

## Code Map

- `src/core/batch-schema.ts` -- item `op: z.literal('add')` (line ~19); refs unique via a refinement; `kind` discriminated union; `newCategories`, `proposedBlockedDomains`.
- `src/core/import-batch.ts` -- `applyBatch(store, batch, verdicts, ctx)`: `CategoryResolver` (declared categories created on first use, `created` flag), `rejectionReasons()`, batch then catalog duplicate check via `dedupKey`/`entryIdByDedupKey`, `insertEntry`; report built and returned inside `store.writeTransaction`.
- `src/core/ports.ts` -- `CatalogReader.entryById`, `entrySummaries`; `CatalogWriter.insertCategory/insertEntry/addEntryCategory`. `src/adapters/sqlite/sqlite-catalog-store.ts` implements them; FTS triggers already handle `UPDATE`.
- `src/core/verification/verify.ts` -- `verifyBatch` gives a verdict per `ref`; updates go through it unchanged.
- `src/core/verification/reason-codes.ts`, `src/shared/strings.ro.ts`, `src/core/errors.ts`, `src/cli/exit-codes.ts` -- codes and texts; `DATABASE_BUSY`/`MIGRATION_MISMATCH` → 3, `INTERNAL` → 4 already mapped.
- `tests/import.test.ts`, `tests/import-verification.test.ts`, `tests/helpers.ts` -- CLI tests on temp workspaces with a local HTTP server and fake `lookup`.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/batch-schema.ts` (+ test) -- `op: 'add' | 'update'`; `update` requires `id` (UUID), `add` forbids it; ids unique in the batch -- AD-6
- [x] `src/core/verification/reason-codes.ts`, `src/shared/strings.ro.ts` -- `unknown_id`; Romanian label for outcome `updated` and update lines in the text report -- AD-15
- [x] `src/core/ports.ts`, `src/adapters/sqlite/sqlite-catalog-store.ts` -- writer gains `updateEntry(row)` (Claude's fields, `verification_notes`, `verified_at`, `dedup_key`, `revision = revision + 1`; never `my_notes`, `owner_id`, `added_at`, `forced`) and `replaceEntryCategories(id, categoryIds)` -- AD-5, AD-16
- [x] `src/core/import-batch.ts` (+ test, fake store) -- per update: `unknown_id` when `entryById` misses; duplicate check excluding the entry itself; on success update + replace categories, outcome `updated` (or `warned` with warnings); earlier added/updated keys in the batch still count as batch duplicates -- AD-6
- [x] `tests/import-update.test.ts` -- every matrix row through `main` on a temp workspace (set `my_notes`/`forced` directly in SQLite before the update; locked DB via a second connection holding `BEGIN IMMEDIATE`; internal failure via a `CliDeps.openStore` wrapper whose writer throws after the first insert; compare catalog bytes before/after)

**Acceptance Criteria:**
- Given an entry whose "Notițele mele" the author wrote, when a batch updates it, then `show --json` returns the same `myNotes`, `addedAt` and owner, and the new Claude fields.
- Given `npm test`, `npm run lint`, `npm run typecheck`, when they run, then all pass.

## Design Notes

`updated` vs `warned`: the report's `op` says whether the item was an add or an update, so a warned update is `outcome: warned, op: update`. The update writes `dedup_key` again because a new URL changes it. A rejected update writes nothing, which matches the journal rule of ticket 8 (only rejections are logged, the entry is never touched).

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors

## Implementation Notes

- `updateEntry` throws INTERNAL for a missing id (the use case checks `entryById` first); `replaceEntryCategories` replaces the whole set.
- Text report: update lines read `ref (actualizare): …`; a rejected or duplicate update adds "(fișa rămâne neschimbată)". Summary wording changed to "N adăugate, N actualizate, N cu avertisment, N respinse, N duplicate".
- Phase 2 still checks the link of an update whose id is unknown (phase 2 has no catalog access); the result is right, one request is wasted.
- Left for later tickets (also in deferred-work.md): GitHub fields on update (ticket 9), keeping `forced_by_user` on update (ticket 8), op/id rules live in `superRefine` and will not show in `z.toJSONSchema` (ticket 7).

## Review Triage Log

Loop 0 — quick lens: 0 high, 0 medium, 2 low, 1 deferred.

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | `batch-schema.ts` `id` | uppercase id → `unknown_id`; case bypasses "same id twice" | low | `z.uuid()` accepts uppercase; stored ids lowercase; SQLite `=` case-sensitive | patch |
| 2 | `render.ts` | "(fișa rămâne neschimbată)" printed for `unknown_id` | low | condition checks only that nothing was written | patch |
| 3 | plan decision "update may change kind" | a kind change would leave `parent` links on a non-concept once ticket 7 exists | low (future) | AD-5: `parent` only concept → concept; no links exist yet | defer |
