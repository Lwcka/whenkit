# Deferred work

- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-scheletul-proiectului-plan.md`
  summary: The description of entry 1 in `epic-catalog-prin-claude/tickets.toml` still says ESLint; the author chose oxlint (AD-2 updated), so the ticket text should be corrected through bmad-ticket.
  evidence: tickets.toml line 8 reads "ESLint cu granițele hexagonului"; bmad-build may not write ticket files.
- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-stocarea-si-workspace-ul-plan.md`
  summary: The spine's layer diagram says `shared` imports only types from `core/dto`, but AD-13/AD-15 need `strings.ro.ts` to import the `ErrorCode` and `ReasonCode` types; widen the diagram label through bmad-architecture.
  evidence: `src/shared/strings.ro.ts` imports `type ErrorCode` from `../core/errors` (ticket 1.2 review, finding 10).
- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-firul-de-pornire-import-add-si-list-plan.md`
  summary: `strings.ro.ts` now imports types from `core/category-seed`, `core/entry`, `core/import-report-schema` and `core/verification/reason-codes`; the spine diagram ("shared imports only core/dto types") should say "only types from core" — same fix as the earlier entry.
  evidence: ticket 1.3 review, finding 6.
