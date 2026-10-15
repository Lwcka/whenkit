---
title: '/importa pierde linkurile ale căror pagini nu se încarcă'
type: 'bugfix'
ticket: '15'
created: '2026-10-15'
status: done
baseline_revision: '62a77eea384713076aec3dd717fd4003f2b170e7'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/bug-importa-pierde-linkurile-ale-caror-pagini-nu-se-incarca.md'
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/spec-whenkit/card-writing-rules.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/importa` leaves a link whose page does not load out of the batch and mentions it only in the chat summary; once the input file is deleted on exit 0 the link is in neither the catalog nor the rejection journal (bug 15; isladjan.com and unscreen.com in the real import).

**Approach:** Change the template's `/importa` skill and shared rules file to the spec rule of 2026-10-15: such a link still goes into the batch, written only from the input (the bug ticket's "minim" decision), so the verification rejects it with a reason or accepts it; the report names it as undocumented, to be rewritten later with an `update`; the summary's skipped-links list goes away. Bump `TEMPLATE_VERSION` (4) and update the skill-file tests; the bug ticket's acceptance criteria are the checklist.

</frozen-after-approval>

## Implementation Notes

Oneshot: the change is prose in two template files, one constant and the phrase tests (well under 100 lines).

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint`, `npm run typecheck`, `npm run build:cli` -- expected: pass

**Manual checks (hitl, at the end of the epic):**
- Re-run `/importa` on an input holding `https://isladjan.com/` and `https://unscreen.com`: both end in the catalog or the journal, none only in the chat.

## Review Triage Log

Quick lens (Opus): 0 high, 2 medium, 3 low — all patched.

- medium — step 5.4 and the general rules of `reguli-fise.md` still required 3–6 situations and keywords, so Claude could pad the minimal card from memory (AC1). Patched: the minimal card is defined in `reguli-fise.md`, the count rules say they do not apply to it, step 5.4 points to it; tests check the limits.
- medium — an undocumented item had no follow-up on `/importa respinse` or a leftover reimport, since its status lived only in Claude's memory. Patched: `whatItDoes` starts with the fixed marker „Nedocumentată: pagina nu s-a încărcat la import.”; the report and step 9 recognize it, and a retry visits the link again.
- low — "primit" lost the verification's note from the spec wording. Patched: "intrat, cu nota ei dacă are una".
- low — report (added only) and summary (all) counted undocumented cards differently. Patched: both count the ones that entered the catalog.
- low — the "old rule gone" tests match only literal wording. Accepted for phrase tests; the new limit needles now cover the rule that was missing.
