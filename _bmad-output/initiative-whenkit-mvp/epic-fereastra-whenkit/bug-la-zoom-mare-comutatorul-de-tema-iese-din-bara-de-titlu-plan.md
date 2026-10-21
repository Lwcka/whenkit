---
title: 'Main owns the zoom: title bar fits at any zoom, zoom persists'
type: 'bugfix'
ticket: '19'
created: '2026-10-21'
status: done
baseline_revision: '230fe5c91d71fcd80dbbc5c0a88f433afd627212'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The zoom is applied only in the renderer (preload `webFrame.setZoomFactor`), while the native title bar overlay stays 40 DIP; `.title-bar` takes its height from `env(titlebar-area-height)`, which shrinks in CSS px as the zoom grows, so at 150–200 % the theme switch spills out of the bar. The zoom is also lost on restart.

**Approach:** Follow AD-20 („Zoomul”): main owns the zoom. The renderer sends only the intent over `window:zoom` (`'in' | 'out' | 'reset'`); main steps through 80–200 %, applies `webContents.setZoomFactor`, sets the overlay height to `round(TITLE_BAR_HEIGHT × zoom)` on every `setTitleBarOverlay` call (theme changes included), reapplies the zoom at startup and after a reload, and saves it as an optional `zoom` in `window-state.json` (missing = 1, out of 0.8–2 = nearest limit, no version bump). Preload drops `webFrame` and exposes no zoom factor.

## Boundaries & Constraints

**Always:** The same eight steps `[0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]`, clamped at the ends; Ctrl+0 always applies 100 %. Keyboard bindings (Ctrl+= / − / 0, numpad, muted-except-zoom in dialogs) unchanged. `window:zoom` validates its argument (`ARGUMENTS_INVALID` otherwise) and answers `IpcResult<null>` like `window:setTheme`. The step logic is Electron-free and unit-tested in main. The first paint of a restarted window is already at the saved zoom with the matching overlay height.

**Never:** No zoom in `localStorage`, `config.json` or the renderer. No `webFrame` in preload. No change to the title bar layout CSS (it already follows `env(titlebar-area-*)`). No version bump of `window-state.json`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Zoom in | zoom 1, `'in'` | 1.1; `setZoomFactor(1.1)`; overlay height 44; saved | — |
| Clamp top | zoom 2, `'in'` | stays 2; nothing re-applied or rewritten | — |
| Clamp bottom | zoom 0.8, `'out'` | stays 0.8 | — |
| Reset | any zoom, `'reset'` | 1 applied (always, even at 1) | — |
| Off-step saved value | file `zoom: 1.3`, `'in'` / `'out'` | 1.5 / 1.25 | — |
| Bad intent | `'big'`, `2`, `undefined` | `{ ok: false, error: { code: 'ARGUMENTS_INVALID' } }` | no change |
| Restart | file `zoom: 1.5` | window opens at 1.5, overlay height 60 | — |
| Old file | no `zoom` | 1 | — |
| Out of range | `zoom: 3` / `0.5` | 2 / 0.8 | — |
| Bad shape | `zoom: "big"` | whole file `{}`, as the other fields | — |
| Theme change at zoom 1.5 | `window:setTheme` | overlay recolored, height still 60 | — |

</frozen-after-approval>

## Code Map

- `src/shared/ipc.ts:24-42,108-190` -- `IPC_CHANNELS` (add `windowZoom: 'window:zoom'`), `isTheme` pattern to copy for a `ZoomIntent` type + `isZoomIntent`; `WhenkitApi.setZoomFactor` (line 189) becomes `zoom(intent: ZoomIntent): Promise<IpcResult<null>>`.
- `src/desktop/preload/preload.ts:1,59` -- drop `webFrame` import and `setZoomFactor`; add `zoom` via `ipcRenderer.invoke`.
- `src/desktop/renderer/keyboard.ts:5-37` -- `ZOOM_STEPS`, `createZoom`, `Zoom.factor()` move out; keep the `Zoom` interface (`zoomIn`, `zoomOut`, `reset`) used by `frameBindings`.
- `src/desktop/renderer/keyboard.test.tsx:177-~240` -- step tests move to main; the binding test keeps a fake `Zoom` recording calls.
- `src/desktop/renderer/app.tsx:57,88,754-755` -- `createZoom(setZoomFactor)` → a memoized `Zoom` that calls `api.zoom('in' | 'out' | 'reset')` (result ignored); `FrameApi` pick list `'setZoomFactor'` → `'zoom'`.
- `src/desktop/renderer/app.test.tsx:171-177`, `test-fixtures.ts:83` -- expect `zoom('in')`, `zoom('reset')`; fake `zoom`.
- `src/desktop/main/zoom.ts` (new) -- Electron-free: steps, `nextZoom(current, intent)`, `clampZoom(value)`; with `zoom.test.ts`.
- `src/desktop/main/theme.ts` -- `nativeThemeSettings(theme, zoom = 1)` sets `height: Math.round(TITLE_BAR_HEIGHT * zoom)`; update `theme.test.ts`.
- `src/desktop/main/window-state.ts` -- optional `zoom` (finite number in schema; clamped on parse; written when defined), like `maximized` from 2.18; tests in `window-state.test.ts`.
- `src/desktop/main/main.ts:168-260,386-410` -- `saved`, `createWindow` (pass `webPreferences.zoomFactor` and the zoomed overlay), `applyNativeTheme` (use current zoom), the `window:setTheme` handler; add the `window:zoom` handler and a `did-finish-load` reapply.

## Tasks & Acceptance

**Execution:**
- [ ] `src/desktop/main/zoom.ts` + `zoom.test.ts` -- steps, `nextZoom` (off-step value goes to the next step in that direction), `clampZoom`; cover the matrix rows on stepping.
- [ ] `src/desktop/main/window-state.ts` + test -- `zoom?: number`, schema, clamp on parse, write; rows Old file / Out of range / Bad shape / round trip.
- [ ] `src/desktop/main/theme.ts` + test -- zoom-aware overlay height; row "Theme change at zoom 1.5" at the settings level (height 60).
- [ ] `src/shared/ipc.ts` -- channel, `ZoomIntent`, `isZoomIntent`, API method.
- [ ] `src/desktop/main/main.ts` -- handler (validate → `nextZoom` → if changed or reset: `setZoomFactor`, `setTitleBarOverlay` with the current theme, `saved.zoom`, `saveState`), startup `zoomFactor` + overlay height, `did-finish-load` reapply, `applyNativeTheme` with the current zoom.
- [ ] `src/desktop/preload/preload.ts` -- `zoom` over IPC; no `webFrame`.
- [ ] `src/desktop/renderer/keyboard.ts`, `app.tsx`, `test-fixtures.ts`, `keyboard.test.tsx`, `app.test.tsx` -- renderer sends intents only; binding tests still pass.
- [ ] `src/shared/ipc.test.ts` (or the existing ipc test file) -- `isZoomIntent` accepts the three intents, rejects others.

**Acceptance Criteria:**
- Given the installed app in both themes, when the zoom is 80, 100, 150 and 200 %, then the mark, title and theme switch fit in the title bar, aligned with the native buttons; dragging and the native buttons still work (hitl).
- Given zoom 150 %, when WhenKit restarts, then it opens at 150 %; after Ctrl+0 and a restart, at 100 % (hitl).

## Design Notes

At zoom z the overlay is `40·z` DIP, so `env(titlebar-area-height)` stays 40 CSS px and the bar keeps its layout at every zoom; no CSS change. `webPreferences.zoomFactor` gives the first paint the saved zoom; the `did-finish-load` reapply covers reloads (dev). `setZoomFactor` persists per origin in the session, so reapplying is idempotent.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: clean
- `npm run typecheck` -- expected: clean

**Manual checks (if no CLI):**
- `npm start`: Ctrl+= to 200 %, the bar grows with its content in both themes; restart keeps the zoom; Ctrl+0 → 100 %.

## Implementation Notes

- Zoom 1 is stored by omitting `zoom` (missing = 1). The overlay theme in the handler comes from `nativeTheme.shouldUseDarkColors`, like `currentTheme()`.
- After review, the handler's decision logic moved to `zoomResult` in `zoom.ts` (pattern of `openExternalResult`), with `apply` then `record` callbacks; `main.ts` only wires it.

## Review Triage Log

Quick lens: high 0, medium 1, low 1, false 0, maybe-false 0.

| Verdict | Route | Finding | Evidence / action |
|---|---|---|---|
| low | patch | `saved.zoom` set before `setZoomFactor`/`setTitleBarOverlay`; a throw would persist an unapplied zoom | Confirmed by reading the handler. Fixed: `record` runs only after `apply` succeeds. |
| medium | patch | Handler matrix rows (Zoom in, Clamp, Reset, Bad intent) had no test; logic inline in Electron-bound `main.ts` | Matrix audit failure. Extracted `zoomResult` into `zoom.ts` with tests for each row. |
