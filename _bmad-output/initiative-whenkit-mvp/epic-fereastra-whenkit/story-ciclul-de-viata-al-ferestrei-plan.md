---
title: 'Ciclul de viață al ferestrei'
type: 'feature'
ticket: '2'
created: '2026-10-19'
status: 'built'
baseline_revision: 'cf384d0dfa1cb33c23546ebb61da463703d30f23'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md'
  - '{project-root}/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Main has no lifecycle: Electron's default userData (`%APPDATA%\WhenKit`, the same folder as `config.json` on Windows) is shared by `npm start` and the installed app, a second start opens a second window, position and theme are lost, the window can be navigated by a dropped link, and an unexpected main error is invisible.

**Approach:** The main half of AD-20 (no notes-on-close) plus AD-9's navigation guard and AD-19's error reporting: userData in `desktop\` / `desktop-dev\` before the single-instance lock, `window-state.json` read before the window and written by main, the theme applied natively and handed to preload as `window.whenkit.initialTheme`, `window:setTheme`, `productName` WhenKit. Decision logic lives in Electron-free modules under `src/desktop/main/`, tested; `main.ts` only wires.

## Boundaries & Constraints

**Always:** AD-8 (userData dir from the same function as `config.json`, i.e. `%APPDATA%\whenkit\`), AD-9, AD-18 (handlers never throw), AD-19, AD-20. Every persistent format has its version constant in `src/core/versions.ts`. Romanian text only in `strings.ro.ts`. Tests use temp dirs and injected environments, never real `%APPDATA%` or a workspace. Extend `ipc.ts`, preload and `catalog.ts` by addition only.

**Never:** No notes save on close, no renderer `data-theme`, CSS tokens or `theme-switch` (entry 3). No `shell.openExternal` (entry 8). No writes to `config.json`, the workspace (except appending `data/whenkit.log` when `data/` exists) or `localStorage`. No `maximized` or view in `window-state.json` (AD-20 fixes its shape). No new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| userData | `APPDATA=C:\A`, packaged / not | `C:\A\whenkit\desktop` / `C:\A\whenkit\desktop-dev`, created | no `APPDATA` → dialog, exit 1 |
| State missing | no `window-state.json` | defaults: no theme (follow Windows), default size, centered | none |
| State corrupt | bad JSON, wrong `version`, bad theme or bounds shape | defaults for everything | not rewritten until main writes |
| Bounds off-screen | bounds visible on no display (< 100×40 px overlap with every work area) | theme kept, bounds ignored | none |
| Second start | app already running | second process quits; first window restored if minimized, shown, focused | none |
| Navigation | dropped link, `window.open`, `<webview>` | blocked; only the app's own page URL may load | none |
| Unexpected error | uncaught exception / unhandled rejection in main | dialog + `<ISO> <stack>` appended to `<workspace>\data\whenkit.log` | log failure or unknown workspace → dialog only, never throws |
| Handled INTERNAL | non-WhenkitError in an IPC handler | logged to `whenkit.log` (no dialog); handler answers `INTERNAL` | as above |

</frozen-after-approval>

## Code Map

- `src/desktop/main/main.ts` -- current wiring; `.env` loading is inside `whenReady` (must move before userData). `if (started) app.quit()` does not stop the rest of the module from running.
- `src/desktop/main/catalog.ts` -- `codeOf` logs with `console.error`; add an optional `logError` port (default `console.error`) to `DesktopCatalogPorts` and `snapshotResult`.
- `src/core/workspace.ts` -- private `configDir(env, fs)`; `configPath` builds on it. Add next to it, reusing it.
- `src/core/versions.ts` -- add `WINDOW_STATE_VERSION = 1`.
- `src/shared/ipc.ts`, `src/desktop/preload/preload.ts`, `src/desktop/renderer/whenkit-api.ts`, `src/desktop/renderer/app.test.tsx` (its fake `window.whenkit` gains the new members).
- `index.html` -- CSP meta already has no external source; `<title>whenkit</title>`.
- `package.json` -- `productName: "whenkit"`; `forge.config.mts` needs no change.
- DESIGN.md tokens for native parts: canvas `#F7F4EE` / `#111923`, chrome `#F0EBE2` / `#0D131A`, ink `#1D1B18` / `#F0EBE2`, `titlebar-height` 40, `window-min-width` 640 × `window-min-height` 480.
- `node_modules/electron/electron.d.ts` -- `webPreferences.additionalArguments`, `app.setPath`, `requestSingleInstanceLock`, `setWindowOpenHandler`, `setTitleBarOverlay`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/workspace.ts`, `src/core/versions.ts` -- `desktopDataDir(env, fs, packaged): string | undefined` = `configDir` + `desktop` / `desktop-dev`; `WINDOW_STATE_VERSION`.
- [ ] `src/desktop/main/window-state.ts` (new) -- Zod schema `{ version, theme?, bounds?: { x, y, width, height } }` (integers, positive size); `parseWindowState(text, workAreas)`, `readWindowState(path, workAreas)` (missing/corrupt → `{}`), `writeWindowState(path, state)` (temp file + rename); `isVisible(bounds, workAreas)`.
- [ ] `src/desktop/main/theme.ts` (new) -- `nativeThemeSettings(theme)` → `{ backgroundColor, titleBarOverlay: { color, symbolColor, height } }` from the tokens above; `THEME_ARGUMENT_PREFIX` and `themeFromArgv(argv)` live in `src/shared/ipc.ts` (preload needs them).
- [ ] `src/desktop/main/navigation.ts` (new) -- `isAppNavigation(target, appUrl)`: http(s) dev server → same origin; `file:` → same path, query and hash ignored; anything else false.
- [ ] `src/desktop/main/error-log.ts` (new) -- `formatLogEntry(now, error)`; `createErrorReporter({ logPath?, append, showDialog, now })` → `{ log(error), report(error) }` (`report` = log + dialog), never throws.
- [ ] `src/shared/ipc.ts`, preload, `whenkit-api.ts` -- `Theme = 'light' | 'dark'`, channel `window:setTheme`, `WhenkitApi.initialTheme: Theme` (from argv, `'light'` when absent) and `setTheme(theme): Promise<IpcResult<null>>`.
- [ ] `src/desktop/main/main.ts` -- order: Squirrel exit (nothing else runs) → dev `.env` → `desktopDataDir` + `mkdirSync` + `app.setPath('userData')` → `requestSingleInstanceLock` (false → quit) and `second-instance` focus → process error handlers → `whenReady`: open catalog (pass `log`), read state with `screen` work areas, `nativeTheme.themeSource = theme ?? 'system'`, window with saved bounds, `minWidth/minHeight`, `title: 'WhenKit'`, `titleBarStyle: 'hidden'` + overlay, `backgroundColor`, `additionalArguments` with the resolved theme; `window:setTheme` validates, applies natively, saves; `close` saves `getNormalBounds()`; `web-contents-created` installs `will-navigate` guard, `setWindowOpenHandler` deny, `will-attach-webview` prevent.
- [ ] `src/desktop/renderer/app.tsx`, `index.css` -- a placeholder 40 px drag strip (`-webkit-app-region: drag`, right padding for the native buttons) with „WhenKit”, above both states; entry 3 replaces it.
- [ ] `src/shared/strings.ro.ts` -- `appStrings.productName`; `mainStrings`: unexpected-error dialog title and body with the log path.
- [ ] `package.json`, `index.html` -- `productName` and `<title>` WhenKit.
- [ ] Tests -- `src/core/workspace.test.ts` (`desktopDataDir` both modes, no APPDATA); `src/desktop/main/*.test.ts` for window-state (matrix rows, round trip, no temp file left), navigation, error-log (append failure and no workspace still show the dialog), theme (`themeFromArgv`); a test that `index.html`'s CSP sources are only `'self'`, `'none'` and `data:` in `img-src`; `catalog.ts` passes `INTERNAL` errors to `logError`.

**Acceptance Criteria:**
- Given `npm start` and the installed app, when both run, then each has its own userData folder and lock, and nothing new appears beside `config.json`.
- Given a moved and resized window, when the app restarts, then it opens at the same place and size.
- Given the change, when `npm test`, `npm run lint`, `npm run typecheck` run, then all pass.

## Implementation Notes

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-19:** high 0, medium 2, low 5, false 0, maybe-false 0.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | A throw in `whenReady` before the window exists leaves a windowless process holding the single-instance lock | medium | patch | The `uncaughtException`/`unhandledRejection` handlers keep the process alive; `window-all-closed` never fires and `second-instance` returns early on `mainWindow === undefined`. Fix: try/catch around startup, `report` then `app.exit(1)`. |
| 2 | `window:setTheme` answers `INTERNAL` when the save fails, although the theme is already applied | low | patch | Native theme and `saved.theme` change before `saveState`. Fix: answer ok (the failure is logged); deletion of one branch. |
| 3 | `will-navigate` guard reads the deprecated `url` argument | low | patch | `electron.d.ts:17844-17848` marks it `@deprecated`; the AD-9 guard would break silently on removal. Fix: `event.url`. |
| 4 | `initialTheme` is stale after a reload following `setTheme` | medium | defer | `additionalArguments` are fixed at creation (AD-20's mechanism); nothing reads `initialTheme` until entry 3. Recorded in `deferred-work.md` for entry 3. |
| 5 | A second start during startup (before the window exists) is dropped | low | reject | Window of a few hundred ms; the fix adds a pending-focus state for a case users will rarely meet. |
| 6 | Temp-file cleanup in `writeWindowState` is never exercised by a test | low | patch | The missing-folder test fails before the temp file exists. Fix: a rename-fails test (target is a directory). |
| 7 | `mkdirSync(userData)` throws before the error handlers exist → Electron's generic dialog, no log | low | reject | Needs a file named `desktop-dev` or no permissions on `%APPDATA%`; the fix adds a branch for a case not met in everyday use. |

## Design Notes

**Native title bar now.** AD-20 applies the theme to `titleBarOverlay`, which exists only with `titleBarStyle: 'hidden'`. Without a drag region the window could not be moved, so a minimal strip lands here; entry 3 builds the real `title-bar` in its place.

**Following Windows.** Absent `theme` → `themeSource = 'system'`, and `initialTheme` is the resolved `shouldUseDarkColors` value; the renderer always gets a concrete theme. Live tracking of a Windows theme change is not in this entry.

**Sandboxed preload argv.** `additionalArguments` reach the sandboxed preload's `process.argv`; if they do not, stop and report instead of switching to `sendSync`.

## Verification

**Commands:**
- `npm test` -- all pass
- `npm run lint` and `npm run typecheck` -- clean

**Manual checks (if no CLI):**
- `npm start`: window titled WhenKit, draggable by the strip, min 640×480; move it, close, restart → same place; start again while open → the first window comes forward; drag a link from the browser onto it → no navigation; `%APPDATA%\whenkit\desktop-dev\window-state.json` exists, nothing new beside `config.json`.
