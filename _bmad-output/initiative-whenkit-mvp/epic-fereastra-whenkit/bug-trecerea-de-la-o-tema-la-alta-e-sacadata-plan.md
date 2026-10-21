---
title: 'Smooth theme transition'
type: 'bugfix'
ticket: '17'
created: '2026-10-21'
status: done
baseline_revision: 'e8fa0a94c740aa7bb00e82f00c126bc2ad09f3bb'
route: 'full'
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

**Problem:** Switching the theme looks choppy: `index.css` puts a color transition on every node under `[data-theme-changing]`, so Chromium animates hundreds of cards at once and drops frames; the millimetre grid (`background-image` gradients) cannot transition and jumps; the native caption buttons recolor at the click, before the rest.

**Approach:** Cross-fade the whole page as one image with the View Transitions API (`document.startViewTransition`), timed by `{motion.theme}`; send `window:setTheme` to main at the midpoint of the fade, so the caption buttons change once, mid-transition. With `{motion.theme}` at 0 (Animation effects off) or no `startViewTransition`, the theme changes instantly as today.

## Boundaries & Constraints

**Always:** The duration comes only from the `--motion-theme` token (0 under `prefers-reduced-motion`), read at the moment of the switch; no duplicated millisecond constant. `data-theme` on `<html>` stays the only truth the CSS reads (AD-20). The theme switch keeps its sliding knob. Existing theme tests keep passing. An echo of the same theme (main's `nativeTheme` change reaching `matchMedia`) never starts a transition.

**Never:** No change to main, preload or `ipc.ts` (the native recolor already follows `window:setTheme` through `nativeTheme` `updated`). No per-element color transitions left for the theme. No new dependency. No inline styles (CSP).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Animated toggle | click, `--motion-theme` 300ms, `startViewTransition` present | one view transition; `data-theme` flips inside its update callback; `setTheme` called once, half of the duration after the transition's animation starts | — |
| Reduced motion | `--motion-theme` 0ms | no view transition; `data-theme` flips at once; `setTheme` called at once | — |
| No API | `document.startViewTransition` undefined (jsdom) | same as reduced motion | — |
| Echo from main | `matchMedia` change to the theme already set | no transition, no listener call | — |
| Windows switches theme (no saved theme) | `matchMedia` change to the other theme | animated as above (no IPC) | — |
| Rapid double toggle | second click before the first midpoint | only the latest theme reaches `setTheme` | — |
| Save fails | `setTheme` → `ok: false` or rejects | theme goes back (animated), error toast as today | existing toast |
| Transition skipped/aborted | `ready` rejects | theme still applied; `setTheme` still sent once | swallow the rejection |

</frozen-after-approval>

## Code Map

- `src/desktop/renderer/theme.ts` -- `applyTheme(theme, { animate })` sets `data-theme-changing` with a `TRANSITION_MS = 300` guard; `followSystemTheme` calls it with `animate: true` on `change`. Rewrite the animated path here; keep `getTheme`, `subscribeTheme`, `followSystemTheme` signatures.
- `src/desktop/renderer/theme-switch.tsx` -- `toggle()` applies, then awaits `setTheme(next)`, reverts + `toasts.push` on failure. Must await the midpoint before `setTheme` and drop stale toggles.
- `src/desktop/renderer/index.css:31-42` -- the `[data-theme-changing] *` transition rule to delete; add the `::view-transition-*` rules here (base styles of the window).
- `src/desktop/renderer/theme-switch.css` -- knob transitions (`transform`, `background-color`) and slot `color`; the pill itself has no color transition yet.
- `src/desktop/renderer/tokens.css:98,354` -- `--motion-theme: 300ms`, 0ms under reduced motion. Read-only.
- `src/desktop/renderer/theme-switch.test.tsx` -- existing tests (jsdom: no `startViewTransition`, no tokens loaded → instant path); extend here.
- `src/desktop/main/main.ts:386-428` -- `window:setTheme` handler and `nativeTheme.on('updated')`; do not change.

## Tasks & Acceptance

**Execution:**
- [ ] `src/desktop/renderer/theme.ts` -- make `applyTheme` return a `Promise<void>` that resolves at the visual midpoint: same theme → resolve at once, no transition; animated with a positive `--motion-theme` and `startViewTransition` → flip `data-theme` and notify listeners inside the update callback, resolve half the duration after `ready` (also resolve if `ready` rejects); otherwise flip at once and resolve. Read the duration from the computed `--motion-theme` of `<html>` (`ms`/`s`); allow tests to inject it. Delete `TRANSITION_MS` and `data-theme-changing`. Update the header comments.
- [ ] `src/desktop/renderer/theme-switch.tsx` -- `await applyTheme(next, { animate: true })` before `setTheme`; a toggle that is no longer the latest when its midpoint arrives sends nothing.
- [ ] `src/desktop/renderer/index.css` -- delete the `[data-theme-changing]` rule; add `::view-transition-old(root), ::view-transition-new(root)` with `animation-duration: var(--motion-theme)` and `animation-timing-function: var(--motion-ease)`, and `::view-transition { pointer-events: none; }` so the window stays clickable during the fade.
- [ ] `src/desktop/renderer/theme-switch.css` -- give `.theme-switch` `view-transition-name: theme-switch`, hide `::view-transition-old(theme-switch)`, `animation: none` on `::view-transition-new(theme-switch)`, so the live switch shows its own knob slide; add `background-color`/`border-color` transitions of `{motion.theme}` on the pill.
- [ ] `src/desktop/renderer/theme-switch.test.tsx` -- tests for every matrix row, with a stubbed `document.startViewTransition` and fake timers; restore the stub after each test.

**Acceptance Criteria:**
- Given the installed app on the real catalog (Toolbox → Toate full of cards, then an open sheet), when the author toggles the theme both ways, then all colors and the grid change in one smooth `{motion.theme}` fade, the knob slides, and the caption buttons recolor once, mid-fade (hitl, AC 1 of the ticket).
- Given Animation effects off in Windows, when the author toggles, then the theme changes instantly (hitl, AC 2).

## Design Notes

A view transition snapshots the old page and cross-fades it into the live new one on the compositor: one GPU fade instead of hundreds of style transitions, and gradients/masks fade with everything else. The update callback runs after the old snapshot, so `data-theme` must change inside it. Elements with their own `view-transition-name` are lifted out of the root snapshot; the switch shows only its live new state, so its CSS transitions play on top.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint` -- expected: clean
- `npm run typecheck` -- expected: clean

**Manual checks (if no CLI):**
- `npm start`, toggle both ways on a full grid and on a sheet: one smooth fade, knob slides, caption buttons change once mid-fade; DevTools Performance shows no long frames during the switch.

## Implementation Notes

- Added `getTargetTheme()` to `theme.ts` (not in the plan): during a fade `data-theme` still holds the old theme, so a fast second click must compute its direction from the last requested theme.

## Review Triage Log

Pass 1 (quick lens): high 0, medium 1, low 1, false 0, maybe-false 0; one test-coverage finding split into two rows.

| Verdict | Route | Finding | Evidence / action |
|---|---|---|---|
| medium | patch | `applyTheme` increments `latestCall` before the echo check, so an echo during a pending transition cancels its flip | Confirmed in `theme.ts`: echo returns before `flip`, pending callback sees a stale `call`. Patched: increment after the echo return; test added. |
| low | rejected | Echo of the previous toggle arriving after a newer click starts an extra transition | Real, but the window is one IPC round trip and the end state is consistent; the fix needs extra state (theme last told main). |
| low | rejected | "Save fails / rejects" tested only on the instant path | The matrix row is covered by the existing reject test; the failure handling is the same `catch` on both paths. |
| medium | patch | No test for an echo while a transition is pending | Part of the first patch. |
