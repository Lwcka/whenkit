---
title: 'Legături, umbrele și JSON Schema'
type: 'feature'
ticket: '7'
created: '2026-10-14'
status: 'built'
baseline_revision: 'dcb48d565df2334f2a7032065be7996803720804'
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

**Problem:** A batch cannot link entries, so the API concepts cannot hang under their umbrella "Tipuri de API" and "Resurse înrudite" stay empty; and /importa has no JSON Schema to write batches against.

**Approach:** Add `related` and `children` to the batch, resolve them by existing id or batch `ref` after all items are written, store them in `links` (related canonical, parent concept → concept without cycles), report skipped links in `ignoredLinks`, and derive the batch's JSON Schema with `z.toJSONSchema`, printed by `whenkit schema` (AD-5, AD-6, AD-11, AD-14).

## Boundaries & Constraints

**Always:** Every item may carry `related: string[]` (default `[]`); only concepts may carry `children: string[]` (optional; absent ≠ empty). A link target is the `ref` of another item in the batch, else an entry id (UUID, lowercased); a ref wins when both could match. Links are written in phase 3, in the same transaction, after every item: first the removals of all updates, then the insertions. An update replaces every `related` link touching its entry; it replaces its outgoing `parent` links only when `children` is present. `related` is stored with `from_id < to_id`; inserting an existing link is a no-op. A parent link that would close a cycle is never written. Links of an item that was not written are not written and not reported (its outcome already says why). The JSON Schema is Draft 2020-12, input shape (defaults optional), and states the op/id pairing; rules JSON Schema cannot express (unique refs and ids, link targets) are in `description`s. `BATCH_SCHEMA_VERSION` and `CLI_OUTPUT_VERSION` stay 1: no batch or skill has been shipped yet.

**Decisions (author, 2026-10-14):** a link the catalog cannot satisfy (unknown id, non-concept child, cycle, rejected or duplicate target) skips only that link, reported in `ignoredLinks`; the item is still written. An update that turns a concept into a tool or material is written, and every `parent` link touching the entry (as parent or child) is removed, each reported in `ignoredLinks` (`fromRef` = the update's ref, `to` = the other entry's id, `parent_requires_concept`).

**Never:** No `batch.schema.json` in the workspace and no `whenkit init` change (ticket 10). No rejections journal or `--force` (ticket 8). No link editing from the UI, no `LinkDto` or export (epic 2). No new migration: `links` exists since 0001.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Umbrella | concept U with `children: [refA, refB]` listed before A and B, all in one batch | parent links U→A, U→B; `show` U lists both children, A lists U as parent | — |
| Related by id | add with `related: [<existing id>]` | one canonical related link; both entries list each other | — |
| Mutual related | A `related: [B]`, B `related: [A]` | one link | — |
| Rejected target | A `related: [refR]`, R rejected (or duplicate) | A written; `ignoredLinks: [{fromRef: A, to: refR, reason: link_target_not_written}]` | — |
| Unknown id | `related: [<uuid not in catalog>]` | item written; ignoredLinks `unknown_id` | — |
| Child not concept | `children: [<id of a tool>]` | ignoredLinks `parent_requires_concept` | — |
| Cycle | catalog has X→Y; batch updates Y with `children: [X]` | Y written; Y→X not written; ignoredLinks `parent_cycle` | — |
| Update related | entry has related to E1, E2; update with `related: [E3]` | only E3 remains | — |
| Update without children | entry is umbrella of C; update omits `children` | U→C kept | — |
| Kind change | concept C is a child of U; update turns C into a tool | C updated; U→C removed; ignoredLinks `parent_requires_concept` | — |
| Bad target | target neither a batch ref nor a UUID; target is the item itself; `children` ref to a non-concept item | nothing written | `BATCH_INVALID`, exit 1 |
| Schema | `whenkit schema` | stdout: JSON Schema that validates a correct batch and rejects one with an unknown field, an update without `id`, an add with `id` | exit 0, no workspace needed |

</frozen-after-approval>

## Code Map

- `src/core/batch-schema.ts` -- `commonFields` (add `related`), `conceptItemSchema` (add `children`), `batchSchema.superRefine` (refs/ids/categories rules; add link-target rules here). `id` uses `z.uuid().transform(lowercase)`.
- `src/core/import-batch.ts` -- `applyBatch`: one loop writes items; add a second pass for links. `writtenKeys` maps key → ref; add ref → written id and ref → kind. Report built at the end with `ignoredLinks: []` today.
- `src/core/ports.ts` -- `CatalogReader`/`CatalogWriter`; `StoredEntry` (add `relatedIds`, `parentIds`, `childIds`).
- `src/adapters/sqlite/sqlite-catalog-store.ts` -- `entryById` (~207), `entrySummaries` (~219, one links query grouped like `categoriesByEntry`), writer methods (~237–330). `links` table in `migrations/0001-initial.sql:67` (CHECKs for canonical related and no self-link, cascade).
- `src/core/dto.ts` -- `entryDtoSchema`/`toEntrySummaryDto`: add the three id lists (summary too, so `list --json` shows them).
- `src/core/import-report-schema.ts` -- `ignoredLinks` already in the shape; fix its comment.
- `src/core/verification/reason-codes.ts`, `src/shared/strings.ro.ts` -- closed reason set + Romanian texts; `cliStrings.usage` lists commands.
- `src/cli/main.ts` (`COMMANDS`), `src/cli/commands/*.ts` (pattern: `show.ts`), `src/cli/render.ts` (`renderImportReport`, `renderEntry`).
- `tests/import-update.test.ts`, `tests/helpers.ts` -- pattern for CLI tests on a temp workspace, fake HTTP, direct SQLite setup.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/verification/reason-codes.ts`, `src/shared/strings.ro.ts` -- codes `link_target_not_written {ref}`, `parent_requires_concept {id}`, `parent_cycle {id}` (reuse `unknown_id`); texts for them, for ignored-link lines, for link lines in `show`, and `schema` in the usage -- AD-15
- [ ] `src/core/batch-schema.ts` (+ test) -- `related` on every item, `children` on concepts only; refine: each target is another item's ref or a UUID, never the item's own ref or id; a `children` ref must name a concept item -- AD-6
- [ ] `src/core/batch-json-schema.ts` (+ test with `ajv` 2020, new exact-version devDependency) -- `batchJsonSchema()`: `z.toJSONSchema(batchSchema, { target: 'draft-2020-12', io: 'input' })` plus, per item, `if op=update then required id` / `if op=add then not required id`; descriptions for the refine-only rules -- AD-6
- [ ] `src/core/ports.ts`, `src/adapters/sqlite/sqlite-catalog-store.ts` (+ `tests/catalog-store.test.ts`) -- reader: link ids on `StoredEntry`, `parentIdsOf(id)`; writer: `insertLink(type, fromId, toId)` (canonical order for related, `INSERT OR IGNORE`), `deleteRelatedLinks(id)`, `deleteChildLinks(parentId)`, `deleteParentLinks(id)` (every parent link where the entry is parent or child; returns the other entries' ids) -- AD-5
- [ ] `src/core/import-batch.ts` (+ test, fake store) -- link pass as in the matrix; a written update whose new kind is not `concept` removes its parent links (`deleteParentLinks`) in the removal step and reports each as `parent_requires_concept` (deferred from ticket 6); cycle check walks `parentIdsOf` from the parent up; `ignoredLinks` in batch order -- AD-5, AD-6, AD-14
- [ ] `src/core/dto.ts`, `src/cli/render.ts` -- id lists in the DTOs; ignored-link lines in the import report, link lines in `show`
- [ ] `src/cli/commands/schema.ts`, `src/cli/main.ts` (+ `src/cli/main.test.ts`) -- `whenkit schema` prints the JSON Schema (2-space JSON) and exits 0, without resolving the workspace -- AD-11
- [ ] `tests/import-links.test.ts` -- every matrix row through `main` on a temp workspace (the cycle row seeds X→Y with a first import)

**Acceptance Criteria:**
- Given the umbrella batch, when it is imported and `show --json` runs on the umbrella, then `childIds` holds both children's ids and each child's `parentIds` holds the umbrella.
- Given `npm test`, `npm run lint`, `npm run typecheck`, when they run, then all pass.

## Implementation Notes

## Plan Change Log

## Review Triage Log

Loop 0 — quick lens: 0 high, 0 medium, 4 low (3 patched, 1 rejected).

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | `batch-json-schema.ts:44` | bare `throw new Error` in core | low | AD-18: core throws `WhenkitError`; only bare throw in non-test `src/`; CLI still exits 4 | patch |
| 2 | `import-batch.ts:263` `resolveTarget` | `unknown_id` param keeps the id as typed; the other link reasons lowercase it | low | `params: { id: target }` vs `resolved.id` | patch |
| 3 | `tests/import-links.test.ts:280` | matrix row "Child not concept" never asserts `parent_requires_concept` end to end | low | test checks only the text output and link count | patch |
| 4 | `import-batch.ts` `writeLinks` | an umbrella update with `children` (without C) listed before C's kind change removes U→C before the kind-change report sees it | low | real order dependence, but U explicitly dropped C, so nothing requested goes unreported; the fix adds branching | reject |

## Design Notes

Why links come last: an umbrella usually precedes its children in the batch, so a ref can only resolve once every item has its outcome. Removals before insertions, because B's `related: [A]` written earlier in the pass must survive A's update clearing A's related set.

Why two error tiers: what phase 1 can see without I/O (malformed target, self-link, child ref of a tool) is Claude's batch error → `BATCH_INVALID`; what needs the catalog (unknown id, existing non-concept, cycle, rejected target) only skips that link and reports it — the entry itself is fine.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors
- `npm run build:cli && npm run cli:dev -- schema` -- expected: a JSON Schema on stdout
