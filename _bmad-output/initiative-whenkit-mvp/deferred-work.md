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
- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-update-si-integritatea-lotului-plan.md`
  summary: Ticket 9 must also write the GitHub fields on `op: update` (AD-6 says they are recomputed); today `updateEntry` leaves them as they are.
  evidence: ticket 1.6 implementation report.
- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-update-si-integritatea-lotului-plan.md`
  summary: Ticket 8 must decide how `forced_by_user` survives an update, since an update recomputes `verification_notes` while `forced` stays.
  evidence: ticket 1.6 implementation report.
- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-update-si-integritatea-lotului-plan.md`
  summary: Ticket 7 must make the op/id rules (update needs id, add forbids it, ids unique) visible in the generated JSON Schema, or document them in the skill; they live in `superRefine`, which `z.toJSONSchema` drops.
  evidence: ticket 1.6 implementation report.
- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-update-si-integritatea-lotului-plan.md`
  summary: Ticket 7 must handle an update that changes the kind of a concept which is an umbrella or a child (AD-5: `parent` links only concept → concept) — reject the update or drop those links, decided in its plan.
  evidence: ticket 1.6 review, finding 3; ticket 1.6 lets an update change `kind`.
- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-jurnalul-de-respinse-si-force-plan.md`
  summary: Ticket 11 (/importa) must re-declare in `newCategories` any category of a journaled element that is missing from `whenkit categories --json` before retrying it, because the journal keeps only the item, not the batch's declared categories.
  evidence: ticket 8 review loop 1, finding 6: a retried element whose category was declared only in its original batch comes out `unknown_category`.
- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-whenkit-init-complet-si-workspace-ul-gestionat-plan.md`
  summary: Clarify in `workspace-and-import-flow.md` (through bmad-spec) that the workspace's shared card rules file is `.claude/skills/reguli-fise.md`, built from the companion `card-writing-rules.md`; ticket 11 must create it under that name, since the runtime CLAUDE.md already points there.
  evidence: ticket 10 review, finding 5: the spec's structure tree says "fișier de reguli comun = card-writing-rules.md", which can be read as the file name.
