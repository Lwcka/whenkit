---
title: 'Datele GitHub'
type: 'feature'
ticket: '9'
created: '2026-10-14'
status: done
baseline_revision: 'a1465951e2991787b0cb89e7cf5f29744e83d4fe'
route: 'full'
route_source: 'auto'
risk: 'low'
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

**Problem:** A GitHub repo enters the catalog without its stars, last commit date or archived state, so the author cannot tell a living tool from an abandoned one (CAP-5).

**Approach:** Recognize GitHub repo URLs with one core function, fetch their metadata in phase 2 through a new `GitHubClient` port (adapter on the public GitHub API, no token), add the `github_archived` note for an archived repo, and write the three fields on add and update; a rate limit or any API failure only leaves the fields empty (AD-7, AD-6).

## Boundaries & Constraints

**Always:** GitHub data never rejects an item and never stops the import. Metadata is fetched only for an item whose own URL is a GitHub repo and whose link check was accepted or warned. `githubPushedAt` = the API's `pushed_at`. An archived repo keeps its outcome and gains the note `github_archived`. An update recomputes the three fields: written when the API answered, `null` when the URL is not a GitHub repo or the API did not answer (rate limit, 404, 5xx, network, timeout, malformed body). Repo recognition lives in one core function; the adapter never parses item URLs. No API key, no token (spec Constraints). Tests never reach the real GitHub: the adapter is tested against a local server.

**Never:** No re-verification of existing entries (post-v1). No GitHub data for a concept's `sources`. No new migration: the `github_*` columns exist since 0001. No UI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Active repo | tool `https://github.com/o/r`, API: 1200 stars, `pushed_at`, not archived | `added`; `githubStars` 1200, `githubPushedAt` set, `githubArchived` false; no GitHub note | — |
| Archived | API says `archived: true` | `added` (not warned); reason `github_archived`; `githubArchived` true | — |
| Rate limit | API answers 403 with `x-ratelimit-remaining: 0`, or 429 | `added`; three fields null; no rejection, no note | — |
| API failure | API 500, 404, timeout or malformed JSON | `added`; three fields null | — |
| Not a repo | `https://example.com`, `https://github.com/topics/x`, `https://gist.github.com/u/1`, `https://github.com/o` | no API call; fields null | — |
| Subpath | `https://github.com/O/R/tree/main/docs` or `…/r.git` | metadata of `O/R` | — |
| Dead link | `github.com/o/gone` answers 404 to the link check | `rejected`; no API call | — |
| Update | repo entry updated; API now answers | fields replaced; `revision` +1 | — |
| Update off GitHub | repo entry updated to a non-GitHub URL | fields null | — |
| Renamed repo | API answers 301 to another `api.github.com/repos/...` URL | redirect followed (max 3); metadata of the target | — |

</frozen-after-approval>

## Code Map

- `src/core/ports.ts` -- comment "GitHubClient arrives with the ticket that needs it"; `HttpResult` is the model for a closed result union; `NewEntryRow`/`EntryUpdateRow` lack the `github*` fields (the store reads them in `StoredEntry`).
- `src/core/url.ts` -- `normalizeUrl`, `dedupKey`; put the repo recognizer beside them (`githubRepo(url): { owner, repo } | undefined`).
- `src/core/verification/verify.ts` -- `verify()` checks the own URL (`own`), then sources; `ItemVerdict` (`reasons`, `sources`, rejected-only `warnings`/`forcedSources`); `VerificationContext` (`http`, `blockedDomains`, `retryDelayMs`); `verifyBatch` shares a 4-check limiter. Forced flagged items are fully verified (ticket 8).
- `src/core/import-batch.ts` -- builds the row `fields` for `insertEntry`/`updateEntry`, including forced writes; add the GitHub fields from the verdict there.
- `src/adapters/sqlite/sqlite-catalog-store.ts` -- `insertEntry`/`updateEntry` SQL: add `github_stars`, `github_pushed_at`, `github_archived` (0/1/null).
- `src/adapters/http/node-http-client.ts` -- node:http/node:https pattern, deadline via `AbortController`; `user-agent.ts`.
- `src/cli/command.ts` (`CliDeps.http`), `src/cli/commands/import.ts` (passes `http` to `verifyBatch`), `src/cli/bin.ts` (only place wiring real adapters), `tests/helpers.ts` (fake ports), `tests/http-client.test.ts` (local server pattern).
- `src/core/verification/reason-codes.ts`, `src/shared/strings.ro.ts` -- closed reason set + Romanian text.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/url.ts` (+ test) -- `githubRepo(url)`: host `github.com` or `www.github.com` (http/https), first two path segments as owner/repo (`.git` stripped), first segment not a GitHub reserved route (`topics`, `orgs`, `settings`, `marketplace`, `features`, `sponsors`, `search`, `explore`, `login`, `about`, `collections`, `trending`, …); anything else → undefined -- AD-7
- [ ] `src/core/ports.ts` -- `GitHubClient.repo(owner, repo): Promise<GitHubResult>`, a closed union `ok { stars, pushedAt, archived } | rateLimited | notFound | failed`; never throws; row types gain the three `github*` fields -- AD-7
- [ ] `src/adapters/github/node-github-client.ts` (+ `tests/github-client.test.ts`, local server) -- `createGitHubClient({ baseUrl = 'https://api.github.com', timeoutMs = 10_000 })`: GET `/repos/{owner}/{repo}` with `Accept: application/vnd.github+json`, `X-GitHub-Api-Version`, a `User-Agent`; body validated with Zod (`stargazers_count`, `pushed_at`, `archived`); 403 + `x-ratelimit-remaining: 0` or 429 → `rateLimited`; 404 → `notFound`; 301/302/307 to a URL under `baseUrl` followed up to 3 times; anything else → `failed` -- AD-7
- [ ] `src/core/verification/reason-codes.ts`, `src/shared/strings.ro.ts` -- `github_archived` ("repo arhivat pe GitHub") -- AD-15
- [ ] `src/core/verification/verify.ts` (+ test) -- `VerificationContext.github`; after an own-URL check accepted or warned, when `githubRepo(url)` matches, fetch and put `github` on the verdict (present only on `ok`); `ok` + archived → `github_archived` among the notes -- AD-7
- [ ] `src/core/import-batch.ts` (+ test), `src/adapters/sqlite/sqlite-catalog-store.ts` (+ `tests/catalog-store.test.ts`) -- write the three fields on every add and update (forced included) from the verdict, null when absent -- AD-6
- [ ] `src/cli/command.ts`, `src/cli/commands/import.ts`, `src/cli/bin.ts`, `tests/helpers.ts` -- `CliDeps.github`; real client in `bin.ts`; a fake in tests (default: `notFound` for every repo)
- [ ] `tests/import-github.test.ts` -- every matrix row through `main` with fake HTTP and a fake `GitHubClient` (the renamed-repo row is covered by the adapter test)

**Acceptance Criteria:**
- Given a batch with an active and an archived repo, when it is imported and `show --json` runs, then both carry stars and `githubPushedAt`, and only the archived one has `githubArchived: true` and the `github_archived` note.
- Given `npm test`, `npm run lint`, `npm run typecheck`, when they run, then all pass, with no request to the real GitHub.

## Implementation Notes

## Plan Change Log

## Review Triage Log

Loop 0 — quick lens: 0 high, 0 medium, 5 low (2 patched, 3 rejected).

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | `node-github-client.ts` `repoSchema` | `pushed_at` stored unvalidated and without milliseconds | low | `z.string().nullable()`; Time convention wants `toISOString()` | patch |
| 2 | `node-github-client.ts:171,183` | redirect prefix check compares raw `baseUrl` with a normalized `href` | low | only an unusual `baseUrl` (uppercase host, explicit :443) breaks it; `bin.ts` uses the default | reject (unreachable) |
| 3 | `url.ts` `GITHUB_RESERVED` | `advisories` missing; one wasted API request | low | `github.com/advisories/GHSA-…` parses as owner/repo | patch |
| 4 | plan Design Notes | "60 requests/hour covers batches of about 12 repos" is wrong (≈60 repos/hour) | low | one API request per repo; link checks hit github.com, not the API | reject (fix edits this plan) |
| 5 | `deferred-work.md:12–14` | the "Ticket 9 must write the GitHub fields on update" entry is resolved but still listed | low | `updateEntry` now writes the three fields | reject (existing entries are not edited by this workflow; reported to the author) |

## Design Notes

Why `null` on a failed update instead of keeping the old values: the failed lookup may follow a URL change to another repo, and old numbers would then describe the wrong project; "enters without the data" (CAP-5) is the honest state. Why no token: v1 holds no API keys; the public limit (60 requests/hour) covers batches of about 12 repos.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors
- `npm run build:cli` -- expected: builds
