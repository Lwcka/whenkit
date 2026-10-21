---
title: 'Restore the maximized window after a restart'
type: 'bugfix'
ticket: '18'
created: '2026-10-21'
status: 'built'
baseline_revision: '3bd269ed2e16cfab63c60455a80f7456ce94ca88'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A window closed maximized comes back at its normal size: `window-state.json` holds only `version`, `theme` and `bounds` (`getNormalBounds()`), so main never knows to maximize at startup.

**Approach:** Follow AD-20 („Preferințe”): add an optional `maximized?: boolean` to `WindowState` and the file schema in `src/desktop/main/window-state.ts` (no version bump; a file without it reads as not maximized, a corrupt file still gives `{}`), and write it only when true or keep it explicit — either way a round trip keeps it. In `src/desktop/main/main.ts`, create the window with `show: false`, call `maximize()` when `saved.maximized` (the saved normal `bounds` stay the restore size and pick the screen), then `show()`; keep `saved.maximized` current from the window's `maximize` / `unmaximize` events (minimizing a maximized window must not lose it), so `saveState` writes it alongside `bounds`. Tests in `src/desktop/main/window-state.test.ts`: maximized round trip (fails on the old code), a file without the field, a non-maximized state, and a non-boolean `maximized` treated like any bad shape (`{}`, as the other fields).

</frozen-after-approval>

## Implementation Notes

Oneshot: about 30 lines of code plus tests in two files; the format is already decided in AD-20. Implemented in a Sonnet subagent, per CLAUDE.md.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: clean
- `npm run typecheck` -- expected: clean

**Manual checks (if no CLI):**
- Installed app: maximize, close, restart → opens maximized with no normal-size flash; the native restore button returns to the saved normal bounds. Not maximized → as before.

## Review Triage Log

Quick lens: high 0, medium 0, low 2, false 0, maybe-false 0.

| Verdict | Route | Finding | Evidence / action |
|---|---|---|---|
| low | rejected | The main side (`maximize`/`unmaximize` listeners, `maximize()` before `show()`) has no automated test | Real, but it lives in Electron-bound `createWindow`; testing it means extracting it, more structure than the bug needs. The installed-app check covers it. |
| low | patch | `window-state.ts` doc comments no longer matched the code (`maximized` kept with dropped bounds; "only ever true" vs a `boolean` type) | Comments corrected. |
