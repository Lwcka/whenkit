---
title: 'Regulile de verificare în import'
type: 'feature'
ticket: '5'
created: '2026-10-14'
status: done
baseline_revision: 'ad327f683e8e2aa3318938afd0b94de27bd0b91a'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md'
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/spec-whenkit/verification-rules.md'
  - '{project-root}/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `whenkit import` adds anything that passes the schema: a dead link, a typo such as `httpss://`, a pirate site or a dead source all enter the catalog, which breaks the product's basic rule ("în caz de dubiu, resursa nu se adaugă").

**Approach:** Add the deterministic verification module in `src/core/verification/` (URL syntax, the AD-7 HTTP table with retries, blocked domains, concept sources) and run it as phase 2 of the import, between the schema check and the write transaction, with the real HTTP adapter injected by the CLI (AD-6, AD-7, AD-15).

## Boundaries & Constraints

**Always:** Verdicts are values (`accepted | warned | rejected`, `reasons: VerdictReason[]`), never exceptions; only `offline` stops the import (exit 3, nothing written, nothing rejected). The blocked-domain list is parsed by one core function and checked on the submitted URL and on `finalUrl`/`lastUrl`. Phase 2 holds no transaction. Tests never reach the internet: core tests use a fake `HttpClient`, CLI tests use local servers.

**Decisions (Claude for the author, 2026-10-14, author away; recommended options):** links are checked at most 4 at a time; a retry waits 1 s (injectable); `libgen.*` matches the label `libgen` followed by one or two labels (`libgen.is`, `libgen.co.uk`), subdomains included, and a plain rule matches the domain and its subdomains; a source that times out or answers 5xx stays, with a `no_response_at_import` warning naming it; flagged items skip HTTP; `verified_at` is set for every added item.

**Never:** No `op: update`, `--force`, rejections journal or links (tickets 6–8). No GitHub metadata (ticket 9). No editing of `blocked-domains.txt` by code beyond recreating a missing one; proposals stay in `proposedBlockedDomains`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bad syntax | `httpss://gutenberg.org` | rejected `invalid_url`, no request made | — |
| OK | 2xx/3xx after redirects | added, no reason | — |
| Blocks bots | 401, 403, 429 | added + `blocks_automation` | — |
| Flaky | 5xx or timeout, three times | warned `no_response_at_import`, stored with the note | — |
| Recovers | 5xx then 200 | added; three attempts at most | — |
| Dead | 404, 410, other 4xx, `dnsNotFound`, `tlsError`, `connectionError` | rejected with the matching code | — |
| Blocked | submitted URL, `finalUrl` or `lastUrl` on the list | rejected `blocked_domain` (domain in params) | — |
| Flagged | `flaggedByClaude` | rejected `flagged_by_claude`, no request made | — |
| Concept, no url | concept without `url` | URL checks skipped | — |
| Dead source | a concept source is invalid or rejected | source removed; concept warned `source_link_removed` (url in params) | — |
| Blocked source | a source on the list | concept rejected `source_blocked_domain` | — |
| Offline | any check returns `offline` | nothing written | `OFFLINE`, exit 3 |
| No list file | `data/blocked-domains.txt` missing | recreated from `workspace-template/data/`, then used | — |

</frozen-after-approval>

## Code Map

- `src/core/import-batch.ts` -- `parseBatch`/`readBatch` (phase 1) and `applyBatch(store, batch, { clock, ids, workspace })` (phase 3): `rejectionReasons()` collects `flagged_by_claude`/`unknown_category`; duplicates via `dedupKey`; `verified_at` NULL today. Phase 2 slots between; `applyBatch` takes the verdicts.
- `src/core/verification/reason-codes.ts` -- `REASON_CODES` (`unknown_category`, `flagged_by_claude`, `duplicate`), `VerdictReason`; texts in `src/shared/strings.ro.ts` by code.
- `src/core/url.ts` -- `normalizeUrl`, `dedupKey`. `src/core/ports.ts` -- `HttpClient.check(url)` → `ok{status,finalUrl} | httpError{status,finalUrl} | dnsNotFound|tlsError|timeout|connectionError {lastUrl} | offline`.
- `src/adapters/http/node-http-client.ts` -- `createHttpClient()`; `tests/http-client.test.ts` shows local HTTP servers and a fake `lookup`.
- `src/cli/commands/import.ts` -- runs phase 1 then opens the store and calls `applyBatch`; `src/cli/bin.ts` wires adapters; `src/core/workspace.ts` has `resolveWorkspace`, `initWorkspace`, `catalogPath`; `Environment.appRoot()` is the repo root.
- `workspace-template/` -- only `.gitkeep` today.

## Tasks & Acceptance

**Execution:**
- [x] `workspace-template/data/blocked-domains.txt` -- comment header + `libgen.*`, `sci-hub.*`, `z-lib.*`, `pdfdrive.com`, `12ft.io` -- spec
- [x] `src/core/verification/blocked-domains.ts` (+ test) -- `parseBlockedDomains(text)` (trim, lowercase, `#` comments, blank lines, `www.` dropped) and `isBlocked(url, rules)` returning the matched rule -- conventions table
- [x] `src/core/verification/url-syntax.ts` (+ test) -- `isValidHttpUrl()`: parses, `http:`/`https:` only, non-empty host, no whitespace
- [x] `src/core/verification/reason-codes.ts`, `src/shared/strings.ro.ts` -- add `invalid_url`, `http_error` (status), `dns_not_found`, `tls_error`, `connection_error`, `blocks_automation`, `no_response_at_import`, `blocked_domain` (domain), `source_link_removed` (url), `source_blocked_domain` (url, domain) with Romanian texts -- AD-15
- [x] `src/core/verification/verify.ts` (+ test, fake `HttpClient`) -- `checkLink(url, ctx)` (AD-7 table, 2 retries on 5xx/timeout) and `verifyItem(item, ctx)` → `{ outcome, reasons, sources }`; `verifyBatch(batch, ctx)` with concurrency 4 throws `WhenkitError('OFFLINE')` on the first `offline` -- AD-7
- [x] `src/core/workspace.ts` -- `readBlockedDomains(workspace, ports)`: reads `data/blocked-domains.txt`, recreating it from `<appRoot>/workspace-template/data/` when missing; `initWorkspace` creates it when missing (never overwrites) -- AD-17
- [x] `src/core/import-batch.ts` -- `applyBatch` takes the verdicts by `ref`: rejected verdict reasons join the existing rejection reasons; warned → outcome `warned`; added items store the kept `sources`, `verification_notes` = verdict reasons and `verified_at` = now -- AD-6
- [x] `src/core/errors.ts`, `src/cli/exit-codes.ts`, `src/shared/strings.ro.ts` -- `OFFLINE` → exit 3 -- AD-11
- [x] `src/cli/commands/import.ts`, `src/cli/main.ts`, `src/cli/bin.ts` -- phase 2 between phase 1 and opening the store; `CliDeps` gains `http: HttpClient` (real `createHttpClient()` in `bin.ts`)
- [x] `tests/import-verification.test.ts` -- CLI import against local servers (200, 403, 404, 500 always, a blocked host via fake `lookup`, a concept with one dead and one live source) gives the matrix verdicts; offline fake → exit 3 and an unchanged catalog; missing list file recreated

**Acceptance Criteria:**
- Given a batch mixing every matrix case, when it is imported, then each item appears once in the report with the expected outcome and reasons, and only added/warned items are in `list --json`.
- Given `npm test`, `npm run lint`, `npm run typecheck`, when they run, then all pass with no internet access.

## Design Notes

The verdict of an item merges: rejection reasons (flag, unknown category, link, blocked domain, blocked source) → rejected; otherwise warnings (`no_response_at_import`, `source_link_removed`) → warned; otherwise notes (`blocks_automation`) → added with the note. Duplicates stay in phase 3, under the lock. The domain check runs before the request on the submitted URL, so a blocked site is never contacted.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors

## Implementation Notes

- `flagged_by_claude` comes only from `verifyItem` now (not from `rejectionReasons()`), so it is reported once.
- A source answering 401/403/429 is kept without a note; one answering 5xx/timeout is kept with `no_response_at_import` `{ url }`.
- A rejected item reports only its rejection reasons. `blocked_domain.params.domain` is the matched rule (e.g. `libgen.*`).
- `runImport` checks `catalog.sqlite` exists before phase 2, so a workspace without a catalog fails before any network call.
- Test app roots must hold a copy of `workspace-template/` (`fakeAppRoot` in `tests/helpers.ts`).

## Review Triage Log

Loop 0 — quick lens: 1 high, 3 medium, 1 low.

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | `url-syntax.ts` | `https:/x`, `https:x`, `https:\x`, `https:///x` are repaired by `URL` and added | high | confirmed with node; contradicts "URL invalid sintactic → respinsă" | patch |
| 2 | `blocked-domains.ts` | rules with scheme, path, port, trailing dot or `*.` never match; fails open | medium | `matches` understands only `domain.tld` and `prefix.*` | patch |
| 3 | `workspace.ts` `initWorkspace` | missing template → INTERNAL after folders and catalog were created | low | `ensureBlockedDomains` runs after `openStore`; reorder is direct | patch |
| 4 | `render.ts` `renderEntry` | text `show` hides verification notes | medium | spec: warning "vizibilă în fișă"; notes are now stored | patch |
| 5 | `tests/import-verification.test.ts` | CLI batch misses several matrix cases (AC 1) | medium | timeout, 401/429, 410, refused, DNS, TLS, blocked redirect, invalid source only in core tests | patch |
