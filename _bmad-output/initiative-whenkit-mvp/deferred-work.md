# Deferred work

Pruned on 2026-10-15 at the closure of epic-catalog-prin-claude: entries already handled by tickets 7–17 or by spec updates were removed (git history keeps them); the ESLint wording in ticket 1's entry stays, since a done ticket is the record.


Nothing is deferred: the last entry (journal rows that a retry cannot clear) was built as ticket 1.18 on 2026-10-16.

- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-fereastra-whenkit/story-cadrul-vizual-tokeni-tema-bare-si-scurtaturi-plan.md`
  summary: At zoom above 100 % the in-app title bar may not fit its contents (theme switch 28 px, app-mark 20 px) inside the native 40-DIP overlay, or may stop lining up with the native buttons, since the overlay height never follows the zoom.
  evidence: Opus review of entry 3 (2026-10-19), unverified (medium if true): `title-bar.css` takes its height from `env(titlebar-area-height)` while `TITLE_BAR_HEIGHT` stays 40; settle it with `npm start` at Ctrl+= 150 % and 200 %. A fix likely has main own the zoom (an IPC that also resizes the overlay), which changes AD-20's zoom line.

- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-fereastra-whenkit/story-rasfoirea-pe-categorii-plan.md`
  summary: The production renderer build inlines the smallest Cascadia Mono subsets as `data:` font URIs, which the CSP (`default-src 'self'`, no `font-src`) blocks, so those glyph ranges fall back to Consolas.
  evidence: Seen by the implementer of entry 4 as console CSP warnings in a scratch production build (2026-10-19); the `@fontsource/cascadia-mono` import dates from entry 3. Settle with `npm run make` and the DevTools console; a likely fix is `build.assetsInlineLimit: 0` in `vite.renderer.config.mts`.

- source_plan: `_bmad-output/initiative-whenkit-mvp/epic-fereastra-whenkit/story-fereastra-vede-importurile-plan.md`
  summary: `npm test` with Vitest's default worker count crashes some workers at start (exit 134, "Zone Allocation failed - process out of memory"), so whole test files are dropped and the run fails.
  evidence: Seen during entry 5 (2026-10-20) and reproduced on the baseline `897b671` in a clean worktree (4 errors), with ~2.4 GB free of 16 GB and 16 cores; `npx vitest run --maxWorkers=2` passes all 51 files. A likely fix is a `maxWorkers` cap in `vitest.config.mts`.
