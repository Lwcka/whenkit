# Deferred work

Pruned on 2026-10-15 at the closure of epic-catalog-prin-claude: entries already handled by tickets 7–17 or by spec updates were removed (git history keeps them); the ESLint wording in ticket 1's entry stays, since a done ticket is the record.

- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-stocarea-si-workspace-ul-plan.md`
  summary: The spine's layer diagram says `shared` imports only `core/dto` types, but `strings.ro.ts` needs types from several `core` modules (`ErrorCode`, `ReasonCode`, `Zone`, …); widen the label to "only types from core" through bmad-architecture.
  evidence: ticket 1.2 review, finding 10; ticket 1.3 review, finding 6.
- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-nota-de-repo-github-abandonat-plan.md`
  summary: Add to AD-7 (through bmad-architecture) the abandoned-repo outcome — accepted with `github_abandoned` when the last push is more than 24 calendar months before the import — and that the verification receives the import's current time.
  evidence: ticket 17 review; AD-7 lists only the archived and rate-limit GitHub outcomes.
- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-skill-ul-importa-plan.md`
  summary: A journal row whose retry changed the link's dedup key (e.g. a domain typo fixed) is never removed, and no CLI command can remove a journal row; consider a `whenkit rejections --remove <id>` or clearing by journal id on retry.
  evidence: ticket 11 review, finding 6: `deleteRejections(key)` uses the written item's dedup key.
