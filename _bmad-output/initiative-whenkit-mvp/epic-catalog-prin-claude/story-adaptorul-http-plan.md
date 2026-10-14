---
title: 'Adaptorul HTTP'
type: 'feature'
ticket: '4'
created: '2026-10-14'
status: done
baseline_revision: 'e22b8effc48f7c14917bfa7fde7d745d10e5c141'
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

**Problem:** Verification (ticket 5) needs to know what happens when a link is opened, and it must tell a dead page, a missing domain, a bad certificate and a missing internet connection apart, deterministically and without the real internet in tests.

**Approach:** Add the `HttpClient` port in `core` with a closed result union, and an adapter in `src/adapters/http/` built on `node:http`/`node:https` with injectable DNS resolution, tested only against local servers (AD-7).

## Boundaries & Constraints

**Always:** The port returns values, never throws for network outcomes: `ok(status, finalUrl) | httpError(status, finalUrl) | dnsNotFound | tlsError | timeout | connectionError | offline`. `HEAD` first, `GET` when `HEAD` is not accepted; browser User-Agent; redirects followed, the final URL reported; 10 s timeout by default (injectable for tests). Tests never reach the internet or the real DNS.

**Decisions (Claude for the author, 2026-10-14, author away; recommended options):** `node:http`/`node:https` instead of `fetch`, because only they take an injectable `lookup`; `GET` is retried for any `HEAD` status ≥ 400 (many servers answer `HEAD` wrongly), and the `GET` result wins; a name-not-found answer becomes `dnsNotFound` only if a probe lookup of a reference host succeeds, otherwise `offline`; a test-only self-signed certificate is committed under `tests/fixtures/`. Review loop 0: `timeout`, `dnsNotFound`, `tlsError` and `connectionError` also carry `lastUrl` (the last URL the check reached), so the blocked-domain rule sees a redirect target that then fails; `offline` carries none.

**Never:** No verdicts, retries on 5xx/timeout, blocked domains or wiring into the import (ticket 5). No GitHub API (ticket 9). No new runtime dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| OK | local server answers 200 | `ok(200, url)` | — |
| Redirect | 301 → 302 → 200, relative `Location` included | `ok(200, finalUrl)` with the last URL | — |
| HEAD refused | `HEAD` → 405, `GET` → 200 | `ok(200, url)`; one `GET` made | — |
| HTTP error | 404, 410, 403, 429, 500 (both `HEAD` and `GET`) | `httpError(status, url)` | — |
| Redirect loop | more than 10 redirects | `connectionError` | — |
| Timeout | server accepts but never answers | `timeout` within the configured limit | — |
| Refused | nothing listens on the port | `connectionError` | — |
| TLS | local HTTPS server with a self-signed certificate | `tlsError` | — |
| No domain | fake resolver: host not found, probe host resolves | `dnsNotFound` | — |
| Offline | fake resolver: everything fails | `offline` | — |
| Not http(s) | `ftp://x` | `connectionError`, no request made | — |

</frozen-after-approval>

## Code Map

- `src/core/ports.ts` -- ports so far: `Clock`, `IdGenerator`, `Environment`, `FileSystem`, catalog store types; add `HttpClient` and `HttpResult` here.
- `src/adapters/` -- adapters per concern (`sqlite/`, `fs/`, `env/`, `system.ts`); add `http/`.
- `.oxlintrc.json` -- core may not use `fetch` or Node built-ins; adapters may.
- `tests/helpers.ts` -- temp dirs and test helpers; `tests/` holds integration tests.
- `openssl` is available in Git Bash (`/mingw64/bin/openssl`) to generate the fixture once; `dns.lookup` on a missing name gives `ENOTFOUND` on this machine.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/ports.ts` -- `HttpResult` discriminated union on `kind` and `HttpClient { check(url: string): Promise<HttpResult> }` -- AD-7
- [x] `src/adapters/http/node-http-client.ts` -- `createHttpClient({ timeoutMs = 10_000, lookup?, probeHost = 'example.com', maxRedirects = 10 })`; one request per hop, response body discarded/destroyed after headers; redirects 301/302/303/307/308 resolved against the current URL; `GET` retry rule above; error mapping: DNS `ENOTFOUND`/`ENODATA` → probe → `dnsNotFound` or `offline`; `EAI_AGAIN`, `ENETUNREACH`, `ENETDOWN` → `offline`; certificate errors (`CERT_*`, `*_SELF_SIGNED_*`, `UNABLE_TO_VERIFY_*`, `ERR_TLS_*`, `ERR_SSL_*`) → `tlsError`; timer → `timeout`; anything else → `connectionError` -- AD-7
- [x] `src/adapters/http/user-agent.ts` -- one current desktop browser User-Agent constant
- [x] `tests/fixtures/tls/` -- self-signed `cert.pem`/`key.pem` for `127.0.0.1`, test-only, with a README line saying so
- [x] `tests/http-client.test.ts` -- every matrix row against local `http`/`https` servers on `127.0.0.1` with ephemeral ports and a short `timeoutMs`; the fake resolver injected through `lookup`; servers closed after each test

**Acceptance Criteria:**
- Given no network adapter is configured, when `npm test` runs offline, then every HTTP test still passes.
- Given `npm test`, `npm run lint`, `npm run typecheck`, when they run, then all pass.

## Design Notes

`lookup` has Node's `dns.lookup` signature, so the default is `dns.lookup` and tests pass a fake. IP literals skip lookup, which is why local servers use `127.0.0.1`. The probe exists because Windows answers `ENOTFOUND` both for a missing domain and for no network; asking for a host that must exist tells the two apart. The adapter must never leave a socket open: abort the request on timeout and destroy each response.

## Verification

**Commands:**
- `npm test` -- expected: all pass, no test touches the internet
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors

## Implementation Notes

- `timeoutMs` bounds the whole `check` (all hops and the GET retry); a timeout during the DNS probe yields `offline`. Ticket 5's retries call `check` again.
- `finalUrl` is the `URL`-serialized form; normalization stays in core. `UNABLE_TO_GET_ISSUER_CERT*` also maps to `tlsError`.
- `httpError` carries `finalUrl`; AD-7 wording aligned. The User-Agent (Chrome 141) needs an occasional bump.

## Review Triage Log

Loop 0 — quick lens: 0 high, 2 medium, 1 low, 2 rejected.

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | architecture AD-7 | changed without the author; bookkeeping skipped | low | the author delegated decisions on 2026-10-14; memlog now marks both AD-7 changes as Claude's, to confirm; `updated` bumped; docs committed separately; `reviews/` are historical records and stay as written | patch (docs) |
| 2 | `tests/http-client.test.ts` TLS | "no request reached the server" check cannot fail | low | the HTTPS handler never writes to `log` | patch |
| 3 | `node-http-client.ts` probe | probe uses the leftover deadline → false `offline` stops a whole import | medium | probe aborts with the check's remaining time; `offline` ⇒ exit 3 under AD-7 | patch |
| 4 | `ports.ts` `HttpResult` | network failures carry no URL → a redirect to a blocked domain that then times out is admitted | medium | `timeout` is retried then `warned`; the blocked-domain rule needs the redirect target | intent gap → decided for the author (`lastUrl`), fixed in place |
| 5 | plan checkboxes | tasks unticked while in review | false | boxes are ticked when the plan is marked built | reject |
