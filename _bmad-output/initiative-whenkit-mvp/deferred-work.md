# Deferred work

Pruned on 2026-10-15 at the closure of epic-catalog-prin-claude: entries already handled by tickets 7–17 or by spec updates were removed (git history keeps them); the ESLint wording in ticket 1's entry stays, since a done ticket is the record.

- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/story-skill-ul-importa-plan.md`
  summary: A journal row whose retry changed the link's dedup key (e.g. a domain typo fixed) is never removed, and no CLI command can remove a journal row; consider a `whenkit rejections --remove <id>` or clearing by journal id on retry.
  evidence: ticket 11 review, finding 6: `deleteRejections(key)` uses the written item's dedup key.
