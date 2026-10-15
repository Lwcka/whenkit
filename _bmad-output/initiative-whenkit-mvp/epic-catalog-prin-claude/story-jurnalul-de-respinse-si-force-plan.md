---
title: 'Jurnalul de respinse și --force'
type: 'feature'
ticket: '8'
created: '2026-10-14'
status: done
baseline_revision: '6642f722722346995d3f1b102b6165cd5120d647'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 2
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md'
  - '{project-root}/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A rejected item leaves no trace once the report scrolls away, so /importa cannot offer to retry it; and the author cannot keep a resource the verification refused (CAP-4).

**Approach:** Every rejected item is journaled in `rejections` (the element as it passed the schema, its reasons, `dedup_key`, `op`, batch schema version) and removed once its `dedup_key` is written; `whenkit rejections --json` lists the journal; `whenkit import --force <ref>` (repeatable) writes an item that only the verification rejected, marked `forced_by_user` (AD-5, AD-7, AD-11).

## Boundaries & Constraints

**Always:** Journaling happens in phase 3, in the import's transaction. Every item with outcome `rejected` is journaled, whatever the reason (verification, Claude's flag, `unknown_category`, `unknown_id`), except when its `dedup_key` already belongs to another entry (a retry could only come out a duplicate); duplicates are not journaled. One journal row per `dedup_key`: a new rejection replaces the older row. Any written item (added, updated, warned, forced) deletes the rows with its `dedup_key`. `--force` bypasses only the verdict's rejection reasons (AD-7 table, Claude's flag included); it never bypasses the schema, `unknown_category`, `unknown_id` or a duplicate, and it has no effect on an item that was not rejected. A forced item is written with outcome `warned`, `forced = 1`, and reasons = the bypassed rejection reasons, then the warnings and notes the verification found (e.g. `source_link_removed`), then `forced_by_user`. A `--force` ref that is not in the batch makes the import invalid. `whenkit rejections` never writes.

**Decisions (author, 2026-10-14):** `forced` is sticky (AD-6): an update never resets it, and every write of an entry with `forced = 1` (a forced add, a forced update, or a plain update of a forced entry) appends `forced_by_user` to its verification notes, so the flag and the note never disagree. An update of a forced entry that the verification rejects again, without `--force`, is rejected and leaves the entry unchanged.

Amended by the author on 2026-10-14 after review loop 1: rejected items whose `dedup_key` belongs to another entry are not journaled; a forced item keeps the verification's warnings and notes.

**Never:** No GitHub data (ticket 9). No `whenkit init` or skill changes (tickets 10–11). No UI (epic 2). No new migration: `rejections` exists since 0001.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Journaled | tool with `httpss://gutenberg.org` | `rejected` (`invalid_url`); `rejections --json` lists it with the element, reasons, `dedupKey`, `op: add` | — |
| Cleared | same tool reimported with `https://gutenberg.org` (link works) | `added`; journal empty | — |
| Replaced | the same rejected item imported twice | one journal row, the latest | — |
| Forced | tool on a blocked domain, `--force <its ref>` | `warned`; reasons `blocked_domain`, `forced_by_user`; `show` has `forced: true`; not in the journal | — |
| Force + duplicate | `--force` on an item whose URL is already in the catalog | `duplicate`; nothing written | — |
| Force + category | `--force` on an item with an unknown category (and a dead link) | `rejected` with both reasons; journaled | — |
| Force, not rejected | `--force` on an accepted item | `added`, `forced: false` | — |
| Sticky | forced entry, later plain update whose link works | `updated`; `forced: true`; notes end with `forced_by_user` | — |
| Sticky reject | forced entry, plain update still on the blocked domain | `rejected`; entry unchanged; journaled | — |
| Unknown force ref | `--force nope` | nothing written | `BATCH_INVALID`, exit 1 |
| Usage | `--force` without a ref | nothing written | `ARGUMENTS_INVALID`, exit 1 |
| Text | `whenkit rejections` | one line per row: name, reasons in Romanian, date | exit 0 |

</frozen-after-approval>

## Code Map

- `src/cli/commands/import.ts` -- `runImport`: `parseArgs` then `readBatch` (phase 1), `verifyBatch` (phase 2), `applyBatch` (phase 3). Pass the force refs to `applyBatch`; check they are batch refs after phase 1.
- `src/cli/command.ts:67` -- `parseArgs` rejects every `-` argument; keep its signature and add a helper that pulls repeatable `--force <value>` pairs out of `args` first.
- `src/core/import-batch.ts` -- `rejectionReasons()` (~192) mixes `unknown_id`, verdict and category reasons: split them so only the verdict's are forcible; item loop (~391) writes added/updated; `ApplyBatchContext`. `dedupKey(item)` already computed per item.
- `src/core/verification/verify.ts` -- `verify()` (~200): returns early for `flaggedByClaude` without checking any link; a rejected verdict (~255) carries only the rejection reasons and `kept` (sources minus dead *and* blocked ones), dropping warnings and notes. `verifyBatch(batch, ctx)` (~285).
- `src/core/url.ts` -- `normalizeUrl` falls back to "lowercase, strip any `scheme://`" for unparseable input, so `httpss://gutenberg.org` and `https://gutenberg.org` share `url:gutenberg.org`.
- `src/core/ports.ts`, `src/adapters/sqlite/sqlite-catalog-store.ts` -- `NewEntryRow`/`EntryUpdateRow`, `insertEntry`, `updateEntry` (never touches `forced` today). `rejections` table: `migrations/0001-initial.sql:80` (`id, owner_id, dedup_key, op, element JSON, reasons JSON array, batch_schema_version, rejected_at`).
- `src/core/dto.ts` (comment: RejectionDto arrives with its ticket), `src/core/cli-schemas.ts` (pattern: `listOutputSchema`), `src/cli/commands/list.ts` (pattern for a read command, `readOnly: true`), `src/cli/main.ts` `COMMANDS`, `src/cli/render.ts`.
- `src/core/verification/reason-codes.ts`, `src/shared/strings.ro.ts` -- add `forced_by_user` ("verificare ocolită de utilizator", spec verification-rules.md); usage text.
- `tests/import-update.test.ts`, `tests/import-links.test.ts`, `tests/helpers.ts` -- patterns for CLI tests with fake HTTP, blocked domains and a temp workspace.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/verification/reason-codes.ts`, `src/shared/strings.ro.ts` -- `forced_by_user`; texts for the rejections output, `--force` and `rejections` in the usage -- AD-15
- [ ] `src/core/verification/verify.ts` (+ `verify.test.ts`) -- `verifyBatch` takes the force refs; a *forced* item flagged by Claude is still fully verified (URL and sources), `flagged_by_claude` first among its rejections; an unforced flagged item still contacts nothing. A rejected verdict also carries what a forced write needs: `warnings` (the warnings and notes it would have had) and `forcedSources` (its sources minus the dead or invalid ones; a blocked-domain source is kept, since forcing bypasses exactly that rejection) -- AD-3, AD-7
- [ ] `src/core/ports.ts`, `src/adapters/sqlite/sqlite-catalog-store.ts` (+ `tests/catalog-store.test.ts`) -- `insertEntry` takes `forced`; `updateEntry` takes `forced: boolean` and only ever sets it (`forced = forced OR ?`); reader `rejections()` (oldest first); writer `insertRejection(row)` (deletes rows with the same `dedup_key` first) and `deleteRejections(dedupKey)` -- AD-5
- [ ] `src/core/dto.ts`, `src/core/cli-schemas.ts` -- `RejectionDto { id, op, element, reasons, dedupKey, batchSchemaVersion, rejectedAt }` (`element` a JSON object, not re-validated against today's batch schema); `rejectionsOutputSchema` -- AD-14, AD-18
- [ ] `src/core/import-batch.ts` (+ test, fake store) -- `force` refs in the context; forcible = verdict reasons only; a forced write stores `forcedSources` and notes = rejection reasons, then `warnings`, then `forced_by_user`; written items clear their `dedup_key` in the item loop, and a written update of entry E also clears the journal rows of earlier rejected updates of E (writer `deleteUpdateRejections(entryId)`, matching `op = 'update'` and the element's `id`), since retrying one would undo the newer write; journaling runs *after* the item loop: element = the parsed item with each `related`/`children` target that is a batch ref replaced by the id that item was written with, or dropped when it was not written; an item is not journaled when its `dedup_key` belongs, by then, to an entry other than its own update id (it would retry as a duplicate); sticky notes as in Boundaries; a force ref not in the batch → `BATCH_INVALID` -- AD-6, AD-7
- [ ] `src/cli/command.ts`, `src/cli/commands/import.ts` -- repeatable `--force <ref>`; a missing value is a usage error -- AD-11
- [ ] `src/cli/commands/rejections.ts`, `src/cli/main.ts`, `src/cli/render.ts` (+ `src/cli/main.test.ts`) -- `whenkit rejections [--json]`, read-only store -- AD-11
- [ ] `src/core/versions.ts` -- the `CLI_OUTPUT_VERSION` comment also names `rejections`
- [ ] `tests/import-rejections.test.ts` -- every matrix row through `main` on a temp workspace, plus: a rejected umbrella whose `children` named batch refs retries alone (element passes `batchSchema`, refs rewritten to ids or dropped); `--force` on a flagged item with an `httpss://` URL lists `flagged_by_claude` and `invalid_url`; a forced concept with a dead and a blocked source keeps the blocked one and notes `source_link_removed`; a rejected add whose URL is already in the catalog is not journaled, in either batch order; a journaled rejected update of E disappears once a later update of E (another URL) is written

**Acceptance Criteria:**
- Given a journaled rejection (links included), when `whenkit rejections --json` runs, then its `element` imported again alone as a batch item passes the batch schema.
- Given `npm test`, `npm run lint`, `npm run typecheck`, when they run, then all pass.

## Implementation Notes

## Plan Change Log

- **Loop 2 (review of attempt 2).** Triggers: findings 5, 7, 9. Amended: the frozen Boundaries (by the author, finding 5), the `import-batch.ts` task (clear stale update rows), a `versions.ts` task, the test task. Known-bad state avoided: retrying a stale journaled update that rolls an entry back. **KEEP**: all of attempt 2 — diff at `C:/Users/Luca/AppData/Local/Temp/claude/c--Users-Luca-Proiecte-whenkit/62757b10-5c10-491c-81b3-6375512ba909/scratchpad/ticket8-attempt2.diff`; apply its code and test hunks (skip the hunk of this plan file), then add the loop-2 changes on top. It already matches the amended Boundaries.

- **Loop 1 (review of attempt 1).** Triggers: findings 1–4 of the Review Triage Log. Amended: a `verify.ts` task (forced flagged items fully verified; rejected verdicts carry `warnings` and `forcedSources`), the `import-batch.ts` task (journal after the item loop, refs rewritten, no row for a key owned by another entry), the test task and the first AC. Known-bad states avoided: a journaled element that fails the schema when retried alone; a forced flagged item written with unchecked links and notes that hide what was bypassed; a forced concept losing sources without a note; journal rows for resources already in the catalog, depending on item order. **KEEP** (attempt 1, diff at `C:/Users/Luca/AppData/Local/Temp/claude/c--Users-Luca-Proiecte-whenkit/62757b10-5c10-491c-81b3-6375512ba909/scratchpad/ticket8-attempt1.diff`, reuse it freely): the store methods (`insertEntry` with `forced`, `updateEntry` with `forced = forced OR ?`, `rejections()`, `insertRejection` replacing by key, `deleteRejections`) and their tests; `RejectionDto`/`rejectionsOutputSchema`; `extractForce` in `command.ts` and `assertForceRefs` checked before phase 2 and in `applyBatch`; `whenkit rejections` and `renderRejections`; `forced_by_user` and the strings; the sticky-forced logic and the report's reasons equal to the stored notes; the matrix tests in `tests/import-rejections.test.ts` and the updated assertions in `tests/import-update.test.ts`.

## Review Triage Log

Loop 2 — quick lens on attempt 3: 0 high, 1 medium, 1 low → patched.

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 10 | `journalRejections` | two rejected updates of E with different URLs leave two rows; retrying the older one deletes the newer silently | low | rows replaced only by `dedup_key`; `deleteUpdateRejections` runs only on a write | patch (call it before journaling a rejected update) |
| 11 | `journalElement` | a ref to a rejected `update` item is dropped though its entry exists; the retried element then deletes existing links unreported | medium | `writtenIds` holds only written items; update semantics replace `related` and, with `children`, parent links | patch (rewrite to that item's `id` when the entry exists) |

Loop 1 — quick lens on attempt 2: 0 high, 3 medium, 2 low; one intent gap → intent_gap (resolved by the author) + bad_plan loopback.

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 5 | `journalRejections`, forced `notes` | code skips journaling keys owned by another entry and puts warnings in forced reasons, against the frozen Boundaries | medium | frozen text said "every rejected item" and "rejection reasons followed by forced_by_user"; the loop-1 task amendment changed both | intent_gap → author amended the frozen block (both as coded) |
| 6 | `journalElement` | a journaled item using a category declared in `newCategories` is `unknown_category` when retried alone | medium | `CategoryResolver` creates declared categories only on use; the element holds no `newCategories` | defer (AD-5 fixes the element shape; /importa must re-declare missing categories on retry, ticket 11) |
| 7 | item loop `deleteRejections(key)` | a journaled rejected update of E outlives a later update of E to another URL; retrying it undoes the newer write | medium | rows cleared only by `dedup_key` | bad_plan |
| 8 | `verify.ts` unforced flagged verdict + `applyBatch` | `applyBatch` trusts `forcedSources` of a flagged verdict produced without force | low | unreachable: `import.ts` passes the same `force` to both phases; the fix adds a guard | reject |
| 9 | `versions.ts` | `CLI_OUTPUT_VERSION` comment omits `rejections` | low | comment lists "list, show and errors" | folded into the re-derivation |

Loop 0 — quick lens: 1 high, 3 medium, 0 low → bad_plan loopback.

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | `import-batch.ts` journal `element: { ...item }` | a journaled element whose links name batch refs fails `batchSchema` when retried alone; first AC unmet | medium | `checkTargets` accepts only batch refs or UUIDs; the element keeps `children: ['c']` | bad_plan |
| 2 | `verify.ts:206` + forced write | `--force` on a flagged item writes its URL and sources unchecked; `blocked_domain`/`invalid_url` never noted | high | `verify` returns before any check for `flaggedByClaude`; AD-3: every write of `url`/`sources` is verified | bad_plan |
| 3 | `verify.ts:255` + forced write | a forced concept loses dead sources without `source_link_removed`; warnings and notes dropped; blocked source dropped though forced | medium | rejected verdict returns only `rejections` and `kept` | bad_plan (grouped with 2: the rejected verdict lacks what a forced write needs) |
| 4 | `import-batch.ts` journaling before the duplicate check | rows for keys already in the catalog that retries never clear; final journal depends on item order | medium | rejection branch journals before `entryIdByDedupKey`; `deleteRejections` runs only on a write | bad_plan |

## Design Notes

Why `forced_by_user` lives in the notes and in the flag: the notes are what `show`, the report and later the UI print; the flag is what survives an update. Writing the note on every write of a forced entry keeps one derived from the other without a second source of truth.

Why one row per `dedup_key`: /importa retries from the journal; two rows for the same resource would make it retry twice.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors
