---
title: 'Skill-ul /gaseste'
type: 'feature'
ticket: '12'
created: '2026-10-15'
status: 'built'
baseline_revision: '412c9144e7e67488d53af0622bb4774d08a616f7'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/workspace-template/CLAUDE.md'
  - '{project-root}/workspace-template/.claude/skills/importa/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The runtime CLAUDE.md names `/gaseste`, but the skill does not exist, so the author cannot ask the catalog a problem in natural language and get back the resources whose "Când o folosesc" matches (CAP-12).

**Approach:** Add `workspace-template/.claude/skills/gaseste/SKILL.md` (Romanian): read the catalog with `whenkit list --json` and, when needed, `whenkit show <id> --json`; answer with the matching entries and their situations quoted verbatim; never write. Bump `TEMPLATE_VERSION`; test the file against the CLI contract.

## Boundaries & Constraints

**Always:** Read-only: the skill runs only `whenkit list --json` and `whenkit show <id> --json`; `allowed-tools` pre-approves exactly those two, and the skill writes no file and runs no `whenkit import`. Matching is by meaning over `name`, `whatItDoes`, `situations`, `keywords`, `categories` (Romanian and English synonyms), not by literal words. The answer is in Romanian and comes only from the catalog: for each match (most relevant first, at most 5 unless the user asks for more) its name, zone and kind, link, the matching situations quoted verbatim from "Când o folosesc" / "Când îl aleg", and a one-line why; related entries in the catalog may be named. `show` is used for concepts (to read `content`) or when the summary is not enough. An entry with `forced: true` is flagged as „verificare ocolită de utilizator”, one with `githubArchived: true` as archived. When nothing matches, say so plainly, invent nothing, and suggest `/importa <link>` if the user knows a resource. No argument → ask what problem they want to solve. A non-zero exit → show `error.message` and stop. When the output's `workspace` is not the current folder, say which catalog was searched. Before answering, read `.claude/skills/reguli-fise.md` for what each field means.

**Never:** No writes of any kind (no batch, no `myNotes`, no file in `data/`, `batches/` or `input/`). No web search to fill gaps. No `src/` change beyond `TEMPLATE_VERSION`. No change to `/importa`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Match | `/gaseste ce am pentru a scoate fundalul dintr-o poză?`, catalog with remove.bg | remove.bg first, its background-removal situation quoted verbatim, plus other matches | — |
| Concept | question about choosing an API style, catalog with REST/GraphQL and the umbrella | concepts named, `show` used to read `content`, situations quoted | — |
| No match | question nothing in the catalog answers | "nu am găsit nimic în catalog", no invented resource, `/importa <link>` suggested | — |
| No argument | `/gaseste` | asks what problem the user wants to solve; no command run | — |
| Error | `list --json` exits 2 | `error.message` shown, stop | WORKSPACE_NOT_CONFIGURED |
| Read-only | any run | `whenkit list --json` output and max `revision` identical before and after | — |

</frozen-after-approval>

## Code Map

- `src/core/dto.ts` `entryDtoSchema` / `entrySummaryDtoSchema` -- fields the skill reads: `id`, `kind`, `zone`, `name`, `url`, `categories[].name`, `relatedIds`, `parentIds`, `childIds`, `whatItDoes`, `situations`, `keywords`, `sources`, `content` (show only), `githubArchived`, `forced`, `revision`. `src/core/cli-schemas.ts` `listOutputSchema` (`entries`), `showOutputSchema` (`entry`), `errorOutputSchema`.
- `workspace-template/.claude/skills/importa/SKILL.md` -- frontmatter and tone to mirror (`name`, `description`, `argument-hint`, `allowed-tools`, `$ARGUMENTS`).
- `src/core/versions.ts` -- `TEMPLATE_VERSION` 2 → 3.
- `tests/importa-skill.test.ts` -- pattern for frontmatter parsing, `COMMAND_NAMES` check, rule-phrase assertions; `tests/init.test.ts` install test (add the gaseste file to it).

## Tasks & Acceptance

**Execution:**
- [ ] `workspace-template/.claude/skills/gaseste/SKILL.md` -- frontmatter `name: gaseste`, `description`, `argument-hint: '<problema ta>'`, `allowed-tools: Bash(whenkit list:*), Bash(whenkit show:*), Read`; the flow per the Always rules -- CAP-12, AD-11
- [ ] `src/core/versions.ts` -- `TEMPLATE_VERSION = 3` -- AD-17
- [ ] `tests/gaseste-skill.test.ts` -- see ACs; each matrix row gets an assertion that `SKILL.md` states its rule (key phrase)
- [ ] `tests/init.test.ts` -- the install test also expects `.claude/skills/gaseste/SKILL.md`

**Acceptance Criteria:**
- Given `SKILL.md`, when read, then its frontmatter has `name: gaseste`, `allowed-tools` names only `whenkit list`, `whenkit show` and `Read`, every `whenkit <word>` in the text is in `COMMAND_NAMES`, and it names `--json`, `situations`, `reguli-fise.md`, `/importa`.
- Given a fresh workspace with the `/importa` example batch imported, when `whenkit list --json` and `whenkit show <id> --json` run, then a second `list --json` is byte-identical to the first (reads never write).
- Given `npm test`, `npm run lint`, `npm run typecheck`, `npm run build:cli`, when they run, then all pass.

## Implementation Notes

## Plan Change Log

## Review Triage Log

Loop 0 — quick lens: 0 high, 0 medium, 2 low (2 patched).

| # | Location | Finding | Verdict | Evidence | Route |
|---|----------|---------|---------|----------|-------|
| 1 | `tests/gaseste-skill.test.ts:90-94` | the "import only in the forbidding sentence" comment is not enforced | low | the set check allows `import` anywhere; now asserts exactly one occurrence | patch |
| 2 | `tests/gaseste-skill.test.ts:199` | a missing `rest` item fails as a confusing show error | low | `?? ''` hides it; now asserted right after lookup | patch |

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: 0 errors
- `npm run typecheck` -- expected: 0 errors
- `npm run build:cli` -- expected: builds

**Manual checks:**
- On the dev catalog from ticket 11: `/gaseste ce am pentru a scoate fundalul dintr-o poză?` answers with remove.bg quoting its situations; `whenkit list --json` is identical before and after.
