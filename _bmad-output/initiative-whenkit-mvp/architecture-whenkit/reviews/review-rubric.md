# Review — rubric walker (good-spine checklist)

Spine: `architecture-whenkit.md` (status: final, 13 ADs). Inputs read: the spine, `.memlog.md`, `spec-whenkit.md` and all 9 companions, `tickets.toml`. Deterministic lint (`lint_spine.py`): 0 findings.

**Verdict:** A solid spine. It covers all 13 capabilities and almost every spec constraint, and its core seams (pure core, single write path, one batch schema, one workspace resolver, Electron hardening) are well chosen. It is not yet airtight for handoff. Four real divergence points are still open: how UI edits relate to verification, what an `update` element means, the CLI's output and `--force` contract beyond the batch, and the operational envelope (how the CLI and the app are built, installed and kept on the same schema version). Each needs a short Rule, not a redesign.

---

## 1. Checklist walk

| Checklist item | Result | Notes |
|---|---|---|
| Fixes the real divergence points, misses none | **Partial** | Misses: UI-edit verification (F1), update semantics (F2), CLI read/report contract plus `--force` referent (F3), user-facing message ownership (F5), HTTP error taxonomy (F7), template refresh (F8), renderer conventions across a 5-CAP epic (F9) |
| Every AD Rule is enforceable and prevents its divergence | **Mostly** | AD-3 does not prevent the bypass it names (F1). AD-4 omits `foreign_keys=ON`, which AD-5's cascade depends on (F6). AD-6 is single-source only up to the copy in the workspace (F8). AD-13 conflicts with core/CLI emitting Romanian text (F5). AD-2 has no enforcement mechanism (F12) |
| Nothing under Deferred lets two units diverge | **Partial** | "React structure, routing, style library ... no divergence risk" is false for Epic 2 (5 CAPs, several stories) (F9). "Exact batch fields → first ticket" is fine for field names but hides the update-semantics decision (F2) |
| Named tech verified-current | **OK, one drift** | `npm view` today: electron **44.7.1** (spine pins 44.7.0); forge cli/plugin-vite 8.0.1, template 7.11.2, react 19.3.0, zod 4.6.7, vitest 5.0.4 all current. Vitest 5 peers Vite ^6–^8, so it is compatible with whatever the template pins. The template 7.x ↔ Forge 8 question is already logged as open |
| Ratifies brownfield | N/A | Greenfield |
| Covers the spec's capabilities | **OK** | CAP-1..13 all appear in `binds` and the capability map (§2) |
| Parent spine not weakened | N/A | No parent |
| Every dimension decided, deferred or open | **Gap** | Deployment & environments and operations are only implied (Deferred bullets plus memlog assumptions). There is no stated decision on how the CLI is installed and built, dev vs personal workspace, migration/version skew, backup, or error visibility (F4) |

## 2. Capability coverage

| CAP | Covered by | Residual gap |
|---|---|---|
| CAP-1 init | AD-6, AD-8, AD-11, seed | Init idempotency and re-run behaviour, `init` path argument (F8, F13) |
| CAP-2 import | AD-3, AD-6, AD-7, AD-11 | Update semantics (F2); transaction scope vs network (F10) |
| CAP-3 verification | AD-2, AD-7 | Unlisted network outcomes, offline handling (F7) |
| CAP-4 rejections, `--force` | AD-5, AD-7, AD-11 | `rejections` columns undefined; `--force <id>` referent ambiguous (F3) |
| CAP-5 GitHub | AD-2 (port), AD-7 | The archived and rate-limit rules live only in the spec; acceptable, but AD-7's table could add one row "GitHub API limit → accepted without metadata" (low) |
| CAP-6 /importa | AD-3, AD-6, AD-11 | Where batch files are written (not `input/`) (F13); schema copy drift (F8) |
| CAP-7 concepts + umbrella | AD-5, AD-6 | Effect of a failing "Surse" link is undecided (F7) |
| CAP-8 browse | AD-3, AD-9, AD-10 | Renderer data and refresh pattern (F9) |
| CAP-9 text search | AD-4, AD-5 | FTS5 query escaping (low, F13) |
| CAP-10 card, edit, notes, delete | AD-3, AD-5, AD-6 | Verification on UI edits (F1); cascade needs `foreign_keys` (F6); Markdown sanitisation (F9) |
| CAP-11 categories | AD-5 | `(zone, name)` uniqueness, entries left with 0 categories after delete (F6) |
| CAP-12 /gaseste | AD-11 | `list --json` shape has no single source (F3) |
| CAP-13 export | AD-12 | Slug collisions in `fise/<slug>.md` (low, F13) |

## 3. Spec-constraint coverage

| Constraint | Status |
|---|---|
| Local Windows desktop | OK (AD-1, seed) |
| Two entry points over one core | OK (paradigm, AD-2, AD-3) |
| No AI or API keys in the app | OK (Conventions: "fără chei API în v1") |
| Data outside repo, portable, readable by Claude; path via config/env, not hardcoded | OK (AD-4, AD-8, AD-11, AD-12). How `.env` is loaded into `WHENKIT_WORKSPACE` for `npm start` and the CLI is unstated (memlog only) → F4 |
| Writes only through the app; `--force` the only bypass | **Partial**: holds for Claude, not stated for UI edits (F1) |
| Verification separate, deterministic, reusable on existing entries | OK (AD-7) |
| Reject when in doubt | **Partial**: errors outside the table (ECONNREFUSED, ECONNRESET, offline) have no verdict (F7) |
| UI and content in Romanian, UI texts in one file | **Conflict** with core/CLI messages (F5) |
| Code entirely in English | Conflict as above (F5) |
| "Notițele mele" never overwritten | OK (AD-6). UI-side edit path should state the same guarantee in reverse (F2) |
| Controlled category list | OK (AD-6, Conventions) |
| `owner_id` from the start | OK (AD-5, `meta`) |
| Skills, runtime CLAUDE.md and rules versioned in repo, installed in workspace | Install OK; **update path missing** (F8) |
| Future headless/PTY processes, localhost-only server | OK (Deferred, AD-9) |
| Personal materials and `.env` never in repo | Mostly OK (AD-8 refuses an in-repo workspace). Add that `tests/` fixtures are synthetic, never copies of `C:\Users\Luca\Personal\` (low) |

---

## 4. Findings

### F1 — HIGH — UI edits can bypass verification; AD-3 does not prevent what it says it prevents
AD-3 lists "ocolirea verificării" under Prevents, and CAP-10 lets the user "corecta" any entry. Nothing says whether a UI edit to `url` or to concept `sources` goes through `core/verification`. The structural seed draws `main → HTTP`, which suggests it does, but no Rule fixes it. The import ticket (Epic 1) and the card-edit ticket (Epic 2) can diverge: one verifies, the other writes the URL directly. That also skips duplicate detection.
**Fix:** add to AD-3 (or AD-7): "Every write that changes `url` or `sources` (import or UI) goes through the same verification use case. A UI edit that gets `rejected` is not saved and shows the reasons. Edits to `myNotes` and other text fields skip verification." Also state that `myNotes` is writable **only** through the UI use case.

### F2 — HIGH — `update` semantics are undecided (patch vs replace, sets, failed verification)
AD-6 says an `update` needs `id`, goes through verification and never touches `myNotes`, `ownerId` or `addedAt`. It does not say:
- whether omitted fields are kept (patch) or cleared (full replacement of the Claude-owned fields);
- whether `categories`, `related` and `parent` in an update **replace** the existing sets or **add** to them;
- what happens when verification rejects an update (site now 404): is the entry left unchanged with a rejection logged, or deleted? The roadmap says re-verification "never deletes, only marks";
- that duplicate detection must exclude the entry itself (otherwise every unchanged-URL update comes back `duplicate`).

The `/importa` skill ("rewrite card X") and the import use case will each pick their own answer. Deferring "exact batch fields" to the first ticket is fine for field names, but this is a semantic decision.
**Fix:** one paragraph in AD-6: "`update` = full replacement of Claude-owned fields; sets are replaced; a rejected update leaves the entry unchanged and is reported (not journaled as a new candidate); duplicate check excludes `id`."

### F3 — HIGH — The skill↔CLI contract is single-sourced only for the batch; `rejections` and `--force <id>` are underspecified
AD-6 makes the batch schema the one source of truth. The skills also consume `list --json` (CAP-12), `categories --json`, `rejections --json` (CAP-4/6) and `import --json` (the report). AD-11 only says "stable JSON, camelCase, schemaVersion". There is no single definition, so the `/gaseste` skill and the `list` command can drift, which is exactly the divergence AD-11 says it prevents. In addition:
- The `rejections` table has no columns in the Structural Seed. The spec requires "complete extracted data + reason + date", and resuming from the journal needs the rejected candidate in batch-element form.
- `whenkit import <lot> --force <id>`: is `<id>` a rejection id, a batch `ref`, or an entry id? `/importa`'s resume flow depends on the answer.
- Exit codes cover 0/1/2 only. A DB newer than the code, a locked DB or a network-down abort have no code.

**Fix:** extend AD-6/AD-11: "Every `--json` output shape is a Zod schema in `src/core/cli-schemas.ts` (or next to `batch-schema.ts`) and is exported to JSON Schema by `init` like the batch. A `rejections` row stores the full batch element (`candidate` JSON) + `reasons` + `rejectedAt` + its own UUID. `--force` takes the batch `ref`." Add exit code `3` = runtime/environment failure (DB locked, schema too new, no network).

### F4 — HIGH — Operational envelope is silent: CLI install/build, environments, version skew, backup
The memlog decides "CLI on system Node via `npm link`" and "`npm start` for dev, `npm run make` → Forge installer". Neither reaches the spine, which only defers `ELECTRON_RUN_AS_NODE` and the installer polish. Undecided consequences:
- **Version skew on one DB.** `npm link` runs the repo's working tree, while the desktop app may be a `make`-built snapshot. AD-4 runs migrations on open and refuses a newer DB. A dev CLI with a new migration upgrades the real catalog, and the installed app then refuses to open it (or the reverse).
- **Dev vs personal data.** Nothing requires development and tests to use a separate workspace (`WHENKIT_WORKSPACE` → a dev folder). Today dev runs fall through to `%APPDATA%\whenkit\config.json`, which is the real catalog. How `.env` gets loaded (Node `--env-file` for the CLI, and for Electron main?) is unstated.
- **CLI build and module format.** Forge's Vite plugin builds main, preload and renderer, not a Node bin. Nothing fixes how `src/cli` is compiled (tsc, a Vite lib entry, Node type stripping) or the module format (ESM/CJS) that `core` must satisfy for both bundles. The skeleton ticket and the CLI ticket can choose differently.
- **Backup.** The SQLite file is the only copy of a personal catalog, and migrations run automatically. There is no "copy DB before migrating" rule.
- **Error visibility.** Logging is deferred, but where main-process errors surface (dialog, console, a file in `data/`) is not stated.

**Fix:** add a short "Deployment & Operations" section (or AD-14): CLI = `tsc`/Vite build to `dist/cli`, ESM, exposed via `npm link`. For v1, the desktop app runs from the same checkout (`npm start` or a `make` from the same commit), and the CLI and app version must match. A dev or test run must set `WHENKIT_WORKSPACE` to a non-personal workspace, loaded via `--env-file=.env`. `SqliteCatalogStore` copies `catalog.sqlite` to `catalog.sqlite.bak-<userVersion>` before any migration. Main-process errors go to a dialog plus `data/whenkit.log`.

### F5 — MEDIUM — Who owns Romanian user-facing text outside the renderer? (AD-13 conflict)
Verification reasons ("blochează accesul automat", "nu a răspuns la import", "există deja: <nume>", "verificare ocolită de utilizator") appear in the CLI report, the rejection journal and `verification_note`, all produced by `core` or the `cli`. AD-13 says code is English-only and UI texts live **only** in `src/desktop/renderer/strings.ro.ts`, a file the CLI cannot import under the paradigm's import graph. The verification author, the CLI author and the renderer author will each solve this differently: hard-coded Romanian in core, duplicated strings, or codes rendered differently.
**Fix:** reasons are codes plus params (`{ code: 'blocks_automation' }`, `{ code: 'duplicate', name }`, `{ code: 'dubious_content', text }` for Claude's free text). Persist codes in `verification_note` and `rejections`. Move the catalogue to `src/shared/strings.ro.ts` (used by both CLI and renderer) and amend AD-13 accordingly.

### F6 — MEDIUM — Referential integrity is assumed but not configured
- AD-5 relies on cascades ("ștergerea unei fișe șterge legăturile ei"; CAP-11 needs `entry_categories` cleaned on category delete), but SQLite enforces foreign keys only with `PRAGMA foreign_keys = ON` **per connection**. AD-4 lists WAL and `busy_timeout` and omits it. Without it, CAP-10 and CAP-11 fail silently.
- `related` is "symmetric, one row" with no canonical ordering. Import and UI can insert both A→B and B→A. Add `CHECK(from_id < to_id)` for `related`, or a unique index on `(min, max, type)`.
- `categories` needs `UNIQUE(zone, name)` ("Securitate" exists in both zones). `entry_categories` needs a PK `(entry_id, category_id)` so a merge does not create duplicates.
- Deleting a category can leave an entry with 0 categories, while `entry-model.md` says 1–2. Decide whether delete is blocked, the entry is moved to a fallback, or 0 is allowed.

**Fix:** add `foreign_keys=ON` to AD-4's Rule and these constraints to the Structural Seed.

### F7 — MEDIUM — The HTTP outcome taxonomy at the `HttpClient` port is open
AD-7's table names 2xx/3xx, 401/403/429, 5xx/timeout, 404/410/DNS/SSL/syntax and the blocklist. The adapter will also see ECONNREFUSED, ECONNRESET, other 4xx (400, 405 after GET, 451), redirect loops, and **no network at all** (EAI_AGAIN while offline). If unclassified, the adapter and core will map these differently. Offline is the dangerous case: every link becomes "DNS inexistent" → mass rejection into the journal. Also open: whether blocklist and duplicate checks apply to the **final** URL after redirects, which URL is stored, and whether a failing link in a concept's "Surse" rejects the concept or only drops the source.
**Fix:** define the port's result as a closed union (`ok(status, finalUrl) | httpError(status) | dnsNotFound | tlsError | timeout | connectionError | offline`). Add a default row "any other 4xx / connection error → rejected (when in doubt)". Make offline abort the batch with exit 3, writing nothing to the journal. Check the blocklist on both URLs, store and normalise the original URL, and treat a failing source link as a warning on the concept.

### F8 — MEDIUM — No refresh path for the installed workspace template (undermines AD-6)
`whenkit init` copies the skills, runtime CLAUDE.md, rules and the batch JSON Schema into the workspace. When the repo's skills or `batch-schema.ts` change, nothing updates the workspace copy. `/importa` keeps producing batches from a stale schema. The required `schemaVersion` makes those fail, but the user has no stated way to recover. Re-running `init` on an existing workspace is undefined: it might overwrite `blocked-domains.txt` or re-seed categories.
**Fix:** a Rule saying `whenkit init` is idempotent. It always refreshes template-owned files (`CLAUDE.md`, `.claude/skills/**`, schema files), never touches `data/` or `input/`, and creates the DB and seeds categories only when absent. A `schemaVersion` mismatch in import produces "run `whenkit init` to update the workspace".

### F9 — MEDIUM — The renderer is deferred as "no divergence risk", but Epic 2 spans 5 CAPs
Epic 2 (CAP-8, 9, 10, 11, 13) will be several stories in one renderer. At least these choices would diverge if left to each story: the renderer data-access and refresh pattern (how components re-query on `catalog:changed` and after their own IPC writes, since `PRAGMA data_version` does not change for the main process's own connection), the styling approach, and the Markdown renderer. There is also a security point AD-9 misses: concept `content` is Claude-written from web sources. Rendering Markdown with raw HTML enabled, inside a window whose `window.whenkit` can delete entries and write exports, is a risk. The CSP mitigates it but does not replace sanitisation.
**Fix:** move this item from Deferred to an assignment ("the first Epic 2 story fixes the data hook, styling and Markdown library; later stories reuse them"), mirroring how `batch-schema.ts` is handled. Add to AD-9: "Markdown is rendered with raw HTML disabled; links in content go through `shell.openExternal`." Add to AD-10: "After its own write IPC calls, the renderer refreshes too."

### F10 — MEDIUM — Import transaction scope vs network verification
AD-6 says an invalid batch writes nothing (one transaction). If an implementer wraps the whole import, including HTTP checks of up to 10 s × 3 attempts per link, in one write transaction, the SQLite write lock is held for minutes. UI edits then fail past `busy_timeout`.
**Fix:** "Schema validation and all verification (network included) run before the write transaction opens. The write phase is one short transaction."

### F11 — LOW — Stack pin drift
Electron 44.7.1 is out; the spine pins 44.7.0 (and claims Node 24.21.0 / SQLite 3.53.4 for that build). Re-pin at scaffold time together with the open template ↔ Forge 8 check. `node:sqlite` still prints an ExperimentalWarning on stderr under Node 24. That is harmless for `--json` on stdout, but worth a note so skills do not treat stderr as failure.

### F12 — LOW — AD-2 has no enforcement mechanism
"`core` does not import electron/react/node:fs/…" can only be checked by review. Add an ESLint `no-restricted-imports` (or dependency-cruiser) rule for `src/core/**` and for `renderer` → `core`/`adapters`, so the hexagon holds without anyone watching it.

### F13 — LOW — Small loose ends
- `whenkit init` takes no path in AD-11, while CAP-1 says "at the configured path" and the spec gives a default. Decide whether it is `init [path]` or a prompt.
- Where `/importa` writes batch files. Not in `input/`, or the next run would pick them up as input (e.g. `data/batches/` or a temp dir, deleted after import).
- FTS5 `MATCH` input must be escaped or quoted (e.g. "remove.bg", "-", ":"), and prefix matching is a choice. Both are confined to one adapter, so a note is enough.
- Export slugs can collide (same name, different kinds), which breaks Obsidian links. Use a `slug-<shortId>` suffix on collision.
- `verification_note` is written by both Claude and the app. State a merge rule (append, app notes after Claude's).
- `tests/` fixtures must be synthetic. Real test data stays in `C:\Users\Luca\Personal\`.

---

## 5. What is strong (keep)
- The hexagonal split with named ports in `ports.ts` makes CAP-3's isolated, deterministic tests real.
- `node:sqlite` removes the Electron/Node native ABI trap, and the memlog shows it was probed (FTS5 + `remove_diacritics`).
- One batch schema → JSON Schema for the skill (AD-6), with `ref`-based in-batch links and zone-scoped category names. This is the right contract shape. Extend it to the outputs (F3).
- One `resolveWorkspace()` with no hidden default, plus refusing an in-repo workspace, directly secures CAP-1's "does not load the dev CLAUDE.md".
- Electron hardening (AD-9) and data_version polling (AD-10) are proportionate for a solo local app.
