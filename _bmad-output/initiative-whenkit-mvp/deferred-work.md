# Deferred work

Pruned on 2026-10-15 at the closure of epic-catalog-prin-claude: entries already handled by tickets 7–17 or by spec updates were removed (git history keeps them); the ESLint wording in ticket 1's entry stays, since a done ticket is the record.


Nothing is deferred: the last entry (journal rows that a retry cannot clear) was built as ticket 1.18 on 2026-10-16.

- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-fereastra-whenkit/story-ciclul-de-viata-al-ferestrei-plan.md`
  summary: `window.whenkit.initialTheme` comes from `additionalArguments`, fixed at window creation, so after `window:setTheme` a renderer reload (Ctrl+R, Vite full reload) gets the original theme; entry 3 must read the current theme on reload (e.g. a `window:getTheme`, or `initialTheme` refreshed another way) without breaking AD-20's no-flash rule.
  evidence: Opus review of entry 2 (2026-10-19): `setTheme` cannot change the arguments of an existing window; harmless until entry 3 sets `data-theme` from `initialTheme`.
