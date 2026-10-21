---
title: 'Editarea în core: entries:patch'
type: 'feature'
ticket: '11'
created: '2026-10-21'
status: done
baseline_revision: '1f1344dedaa66159e290a64f8bdfb6a5465139cb'
route: 'full'
route_source: 'auto'
risk: 'high'
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

**Problem:** The window cannot correct an entry: there is no core path that edits the fields Claude wrote under the same rules as an import `update` (AD-3, AD-7, AD-16), so entry 12's edit mode has nothing to call (CAP-10).

**Approach:** A core `patchEntry` use case and the `entries:patch { id, expectedRevision, changes }` channel through `runWrite`. It validates the changes, verifies links with the same verification as import when `url` or `sources` change, checks duplicates, compares `expectedRevision` inside the write transaction (`CONFLICT`), bumps `revision`, and answers the changed `EntryDto` or an error that carries its `VerdictReason`s. No UI in this entry.

## Boundaries & Constraints

**Always:** AD-3 (one verification for import and UI: reuse `verifyItem`, no second rule set), AD-5 (revision bumps only when editable content changes), AD-7 (verdict table; `OFFLINE` writes nothing), AD-15 (reasons as codes; texts only in `strings.ro.ts`), AD-16 (compare after verification, inside the write transaction), AD-18 (handlers never throw), AD-2 (core imports no adapter; main wires the real `HttpClient`/`GitHubClient` as `src/cli/bin.ts` does).

**Never:** No edit of `kind`, `id`, dates, GitHub data, verification notes, links or `myNotes` through a patch. No `--force`-like bypass from the UI. No category creation (only existing ids of the entry's zone). No renderer change beyond the `WhenkitApi` type and preload.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Text edit | `changes: { whatItDoes, situations }`, right revision | saved; `revision + 1`; no HTTP call; `verifiedAt`, GitHub, notes kept; returns the DTO | none |
| No-op | changes equal to the stored values | no write, no bump; returns the current DTO | none |
| New link ok | tool `url` → a 200 URL | saved; `revision + 1`; `verifiedAt = now`; GitHub data and notes from the verdict | none |
| Link 404 | `url` → 404 | nothing written | `ENTRY_REJECTED` with `[{ code: 'http_error', params: { status: '404' } }]` |
| Dead source | concept `sources` gain a 404 link | saved without it; notes hold `source_link_removed` with its URL | none |
| Blocked | `url` on a blocked domain | nothing written | `ENTRY_REJECTED` `blocked_domain` |
| Duplicate | `url` normalizes to another entry's `dedup_key` | nothing written | `ENTRY_REJECTED` `duplicate { name }` of that entry |
| Journal | the new key has a journaled rejection | saved; that rejection row is gone | none |
| Offline | HTTP answers `offline` | nothing written | `OFFLINE` |
| Conflict | `expectedRevision` ≠ stored (an import `update` landed meanwhile, even during verification) | nothing written | `CONFLICT` |
| Notes | entry with `myNotes` | notes unchanged after any patch | none |
| Invalid | empty name; 0 or 3 categories; a category id of the other zone or unknown; no situation; `content` on a tool; `url: null` on a tool; unknown field | nothing written, no HTTP | `ARGUMENTS_INVALID` with `issues` (field paths) |
| Missing | unknown `id` | nothing written | `ENTRY_NOT_FOUND` |
| Handler | non-object payload, non-integer revision | — | `ARGUMENTS_INVALID`; reasons/issues of a `WhenkitError` reach the `ErrorDto` |

</frozen-after-approval>

## Code Map

- `src/core/errors.ts` L4 `ERROR_CODES` -- add `CONFLICT`, `ENTRY_REJECTED`; `WhenkitError` (L37) gains optional `reasons?: VerdictReason[]`. Every `Record<ErrorCode, …>` must grow: `src/cli/exit-codes.ts` (both → `EXIT_INVALID_INPUT`), `strings.ro.ts` `errorMessages` L50 („Fișa s-a schimbat din terminal între timp. Modificarea nu s-a salvat.”, „Modificarea nu a trecut verificarea.”), any CLI JSON error schema that enumerates codes.
- `src/core/dto.ts` L98 `ErrorDto` -- add optional `reasons` (VerdictReason schema) and `issues` (`{ path, message }`, as `ErrorIssue`). `src/desktop/main/catalog.ts` `codeOf`/`failure` (L34/L72) -- a helper `errorDtoOf(error, logError)` keeps `reasons`/`issues` of a `WhenkitError`; `runWrite` (`catalog-watch.ts` L103) uses it so they reach the window.
- `src/core/batch-schema.ts` -- export the pieces a patch reuses (`text` L15, situations/keywords/categories shapes from `commonFields` L26, `RESOURCE_TYPES`). New `entryPatchSchema` (strict, all optional): `name`, `url` (string, or `null` only for concepts), `resourceType`, `whatItDoes`, `situations` (≥1), `keywords`, `sources`, `content`, `categoryIds` (1–2, unique). Kind rules (tool/material: no `content`/`sources`, `url` non-null; concept: no `resourceType`, `content` non-blank) checked in `patchEntry` against the stored kind. Put the schema in a new `src/core/entry-patch.ts` if `batch-schema.ts` should stay batch-only.
- New `src/core/patch-entry.ts` -- `patchEntry(store, ctx: { verification: VerificationContext; clock }, input: { id, expectedRevision, changes }): Promise<EntryDto>`:
  1. parse `changes` (Zod issues → `WhenkitError('ARGUMENTS_INVALID', { issues })`); read the entry (`readTransaction`, missing → `ENTRY_NOT_FOUND`); merge; kind and category-zone checks (`categoriesInZone`, ports.ts L196); no difference → return the stored DTO.
  2. if merged `url` or `sources` differ from stored: build a `BatchItem` (`op: 'update'`, the entry's id, category names, no `flaggedByClaude`) and call `verifyItem(item, ctx.verification)` (`verification/verify.ts` L360; `OFFLINE` propagates). `rejected` → `WhenkitError('ENTRY_REJECTED', { reasons })`. Use `verdict.sources` (kept), `verdict.reasons` + warnings as `verificationNotes` (as `applyBatch` does, `import-batch.ts` L586–621, keep `forced_by_user` if the entry is forced), `github`, `verifiedAt = clock.now()`. Otherwise keep stored notes, GitHub data and `verifiedAt`.
  3. `writeTransaction`: re-read; missing → `ENTRY_NOT_FOUND`; `revision !== expectedRevision` → `CONFLICT`; `dedupKey` (`url.ts` L49) and `entryIdByDedupKey` (≠ id → `ENTRY_REJECTED` `duplicate { name }`); `updateEntry` (bumps revision, keeps `my_notes`, sticky `forced`); `replaceEntryCategories` when categories changed; `deleteRejections(key)`; return `toEntryDto(entryById(id))`. One connection and one transaction make read-compare-update atomic (the AD-16 `WHERE revision = ?` intent).
- `src/shared/ipc.ts` -- `entriesPatch: 'entries:patch'`; exported `EntryPatchInput` type (from core dto/schema); `WhenkitApi.patchEntry(input): Promise<IpcResult<WriteResult>>`. `preload.ts` -- `invoke`.
- `src/desktop/main/catalog.ts` -- `patchEntryResult(opened, input: unknown, deps: { http, github, clock, readBlockedDomains }, emit, logError)`: shape check (object, string id, integer revision) → `runWrite(opened, store => ({ changed: [await patchEntry(...)] }))` with a `VerificationContext` built as `src/cli/commands/import.ts` L45–55 (blocked domains read per call from `catalog.workspace`, `now` from the clock). `main.ts` -- create `createHttpClient()` / `createGitHubClient()` once (as `src/cli/bin.ts` L21–36) and register the handler with `notifyCatalogChanged`.
- Tests: new `tests/patch-entry.test.ts` -- every matrix row, with a fake `HttpClient`/`GitHubClient` (patterns: `tests/import-update.test.ts` L35 `fakeHttp`, `tests/helpers.ts` `okHttp`, `notFoundGithub`, `fixedClock`, `testStoreOpener`); the Conflict row also with a `whenkit import`-style `update` (via `applyBatch`) landing between the verification and the write (a fake HTTP that runs it when called). `catalog.test.ts` -- Handler row and reasons reaching `ErrorDto`. Existing tests touched by the new codes (`exit-codes`, `strings.ro.test.ts`).

## Tasks & Acceptance

**Execution:**
- [ ] `errors.ts`, `dto.ts`, `exit-codes.ts`, `strings.ro.ts`, `main/catalog.ts`, `catalog-watch.ts` -- new codes, reasons/issues carried to the window.
- [ ] `batch-schema.ts` / `entry-patch.ts`, `patch-entry.ts` -- schema and use case.
- [ ] `ipc.ts`, `preload.ts`, `main/catalog.ts`, `main.ts` -- channel and handler with the real adapters.
- [ ] Tests -- `tests/patch-entry.test.ts` (every matrix row), `catalog.test.ts`, the code tables.

**Acceptance Criteria:**
- Given the change, when `npx vitest run --maxWorkers=2`, `npm run lint`, `npm run typecheck` run, then all pass.
- Given the CLI, when `npm run build:cli` runs and `whenkit import` is used as before, then its behavior and JSON output are unchanged (existing CLI tests pass).

## Implementation Notes

- The patch schema lives in `src/core/entry-patch.ts`; `batch-schema.ts` only exports its `text` as `nonBlankText`. `EntryPatch`/`EntryPatchInput` are re-exported from `core/dto.ts` because `shared/ipc.ts` imports only from there.
- A no-op patch returns before the revision check, so a stale `expectedRevision` with identical values answers the current entry, not `CONFLICT`. It still makes `runWrite` emit `catalog:changed` (one extra reload, no pulse; triage #3).
- Any change to `url` or `sources` re-verifies the entry's URL and all sources, as an import `update` does; removing a concept's URL therefore needs the network.
- `PatchEntryContext.verification` is a function, called only when links change (no blocked-domains read on a text edit). Tests pass an optional `retryDelayMs` so they don't sleep.
- Not run: `npm start` with the real HTTP/GitHub adapters in main (no UI calls the channel yet; entry 12 will).

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-21:** high 0, medium 2, low 3, false 0, maybe-false 0. Four were patched and one low finding was rejected; the architecture part of #5 goes to `bmad-architecture` after the merge.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | `deleteRejections(key)` runs on every patch, so a text edit deletes Claude's journaled `update` rejection filed under the entry's own key | medium | patch | `journalRejections` (import-batch.ts L451–465) journals a rejected update under its own URL key; the Design Notes keep those. Fix: clear only when the key changed, plus a test. |
| 2 | Blocked domains are read (and the file maybe created) on every patch, before knowing whether links changed | low | patch | `patchEntryResult` builds the full context eagerly; a text edit can fail as `INTERNAL` on a file error. Fix: lazy verification context. |
| 3 | A no-op patch still emits `catalog:changed` | low | reject | `runWrite` emits on every success; the effect is one extra snapshot reload with no pulse. The fix needs a "nothing written" signal through core and `runWrite`. |
| 4 | Category ids are checked only in the read transaction; a category removed before the write fails the FK insert as `INTERNAL` | low | patch | Latent until entry 13 deletes categories. Fix: re-check inside the write transaction. |
| 5 | The `runWrite` doc and AD-18 still describe `{ error: { code } }` only | medium | patch | `ErrorDto` now carries `reasons`/`issues` (needed by AD-3). Fix: the doc comment here; AD-18 updated through `bmad-architecture` after the merge. |

## Design Notes

**Calls made in planning.** New codes `CONFLICT` (named by AD-16) and `ENTRY_REJECTED` (a rejected verdict or a duplicate, carrying the reasons); invalid changes reuse `ARGUMENTS_INVALID` with field `issues`, since entry 12 keeps invalid forms from saving and core only defends. Verification runs whenever `url` or `sources` change and then refreshes `verifiedAt`, GitHub data and notes together, as an import `update` does; it is skipped otherwise, so a text edit never goes to the network. A patch that changes nothing writes nothing (no revision bump, no false pulse). The rejection journal is cleared only for the new key (the ticket's wording); the entry's journaled import `update` rejections stay, because a UI edit does not supersede Claude's pending update.

**Why build a `BatchItem` for `verifyItem`.** It is the exact function the import uses (AD-3); extracting a narrower one would touch tested import code for no behavior gain. The item is internal to `patchEntry` and never stored.

## Verification

**Commands:**
- `npx vitest run --maxWorkers=2` -- all pass (default workers crash on this machine, see deferred-work)
- `npm run lint`, `npm run typecheck`, `npm run build:cli` -- pass
