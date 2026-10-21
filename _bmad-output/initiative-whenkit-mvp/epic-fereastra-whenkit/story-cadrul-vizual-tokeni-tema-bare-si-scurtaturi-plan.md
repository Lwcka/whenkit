---
title: 'Cadrul vizual: tokeni, temă, bare și scurtături'
type: 'feature'
ticket: '3'
created: '2026-10-19'
status: done
baseline_revision: 'bdf7af0b50be4490f7f3ef10136ef05d96f832ac'
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

**Problem:** The window is unstyled: a placeholder drag strip, plain tabs, no theme in the renderer, no status bar, no shared toast or busy button, no Romanian formats or plural, no keyboard layer. Every later window ticket needs this frame.

**Approach:** DESIGN.md tokens as CSS custom properties for both themes under `[data-theme]`, set on `<html>` before `createRoot`; the real `title-bar` (app-mark, „WhenKit”, `theme-switch`), `toolbar` with the two `zone-tab`s and live counters, `status-bar`; shared `Toast` (queue store) and `Button` (busy state); formats and plural in `strings.ro.ts`; one keyboard layer by `event.code` with an Esc priority dispatcher and zoom 80–200%. It fixes the renderer styling convention for the epic.

## Boundaries & Constraints

**Always:** AD-9, AD-10 (counters and status bar read only the catalog store), AD-13 (all Romanian text, labels and formats in `strings.ro.ts`), AD-20. Tokens only through `var(--…)`; components never hard-code a color, size or duration. Versions exactly as in Stack: `lucide-react` 1.58.0, `@fontsource/cascadia-mono` 5.3.0 (weights 400, 500). CSP unchanged. Renderer tests under jsdom with `cleanup`; `matchMedia` and `window.whenkit` faked.

**Decision (author, 2026-10-19), theme after a reload:** the renderer's theme comes from `matchMedia('(prefers-color-scheme: dark)')`, which Electron ties to `nativeTheme.themeSource`: read before `createRoot` for the first paint and followed live (`change` event), so it is right after a reload and follows Windows live when no theme is saved. `initialTheme`, `THEME_ARGUMENT_PREFIX` and `themeFromArgv` are removed (with their test); AD-20's theme line is updated via `bmad-architecture`, and the deferred-work entry about the stale theme is closed.

**Never:** No search box, „Categorii”, „Exportă catalogul”, category bar, grid redesign, sheet, arrivals or arrival tape (later entries); the toolbar holds only the zone tabs for now. No `localStorage`, no zoom persistence (AD-20 fixes `window-state.json`). No undo toast. No new IPC channel. No state library.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Plural | 1, 0, 2, 19, 20, 100, 101 | „1 fișă”, „0 fișe”, „2 fișe”, „19 fișe”, „20 de fișe”, „100 de fișe”, „101 fișe” | none |
| Formats | local 15.10.2026 20:39; 999; 1000; 137 654 | „15.10.2026”, „15.10.2026, 20:39”; „999”, „1k”, „137,7k” | none |
| Status bar | 75 entries, newest first | „Catalog la zi” · „75 de fișe · ultima adăugată 15.10.2026, 20:39” · path cut in the middle, full path in `title` · „Ctrl K caută · Enter deschide” | 0 entries → „0 fișe”, no „ultima adăugată” |
| Single-key in field | `E`, `[`, `]`, `Delete` while focus is in input/textarea/contenteditable | binding does not fire | Ctrl combos and Esc still fire |
| Esc | several handlers active | only the highest priority runs: dialog → editing → search with text → open sheet → active search | none active → nothing |
| Zoom | Ctrl+= / Ctrl+− / Ctrl+0 (also numpad) | steps 80, 90, 100, 110, 125, 150, 175, 200 %; clamped at the ends; Ctrl+0 → 100 % | none |
| Theme switch | click | `data-theme` flips at once (300 ms color transition), `setTheme` called | error result → error toast, theme reverted |
| Toasts | 4th pushed | oldest dropped, max 3, newest at the bottom; 6 s dwell paused on hover; × closes; `aria-live="polite"` | none |
| Widths | 960–1200 / 720–960 / 640–720 | all / path shrinks / tab counters and path hidden, status keeps state + count | none |

</frozen-after-approval>

## Code Map

- `DESIGN.md` front matter L1–560 (colors L16–70, `-dark` twins swap by name L587; typography L71–90; rounded L91–99; spacing/sizes L100–127; elevation L128–134; motion L135–154; components L155–559). Prose: title-bar L761, theme-switch L762, toolbar L763, zone-tab L764, status-bar L782, toast L783, kbd L790, focus-ring L791, states/busy L710–719, icons L684–695, fonts L633–641.
- `EXPERIENCE.md` -- formats L68–72; frame L80–83; status bar L107; toasts L108; shortcuts L150–166; Esc L168–174; motion L188–199; a11y L205–214; widths L216–232.
- `mockups/key-toolbox.html` -- copyable tokens `:root` H20–74, night H75–85 (swap `:root:has(#theme:checked)` for `[data-theme='dark']`; drop `--page`, `--win-shadow`); title-bar/theme-switch H115–132, toolbar/zone-tab H135–142, kbd H145, status-bar H232–239, toast H331–342, widths H372–392 (container queries → media queries), reduced motion H394–396; markup H406–413, H493–498.
- `src/desktop/renderer/app.tsx` -- `DragStrip` to replace; tabs become `zone-tab`s; keep `AppError` and the card list as is (only restyled with tokens).
- `src/desktop/renderer/renderer.tsx` -- set `data-theme` before `createRoot`; install the keyboard layer.
- `src/desktop/renderer/index.css` -- replace with `tokens.css` + base; `app.test.tsx` -- extend its fake API.
- `src/desktop/preload/preload.ts`, `src/shared/ipc.ts` -- drop `initialTheme`/`THEME_ARGUMENT_PREFIX`/`themeFromArgv` (and `src/desktop/main/theme.test.ts`'s argv cases); add `workspacePath: string | null` (argv `--whenkit-workspace=`, same pattern) and `setZoomFactor(factor)` (preload `webFrame`, no IPC).
- `src/desktop/main/main.ts` -- `additionalArguments` carries the workspace path instead of the theme; `Menu.setApplicationMenu(null)`. `catalog.ts` `openDesktopCatalog` -- also return the resolved workspace.
- `src/shared/strings.ro.ts` -- `appStrings` grows; add `formatStrings`/helpers.
- `deferred-work.md` last entry (stale theme after reload) -- removed once this lands.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` -- add `lucide-react@1.58.0`, `@fontsource/cascadia-mono@5.3.0` (exact).
- [ ] `src/desktop/renderer/tokens.css` (new) -- all DESIGN tokens as `--group-name` (colors unprefixed), light under `:root[data-theme='light']`, dark under `[data-theme='dark']`; `color-scheme`; motion tokens to `0ms` under `prefers-reduced-motion: reduce` (live by CSS); base `:focus-visible` ring; `@fontsource/cascadia-mono` 400/500.
- [ ] `src/shared/strings.ro.ts` -- `plural(n, forms)` via `Intl.PluralRules('ro')`, `entryCount(n)`, `formatDate`, `formatDateTime` (local time), `formatCompact`; frame labels (theme switch, status, key hints, toast close).
- [ ] `src/desktop/renderer/keyboard.ts` (new) -- one `keydown` listener; bindings `{ code, ctrl?, shift?, alt?, run, when? }`; unmodified keys skipped in text fields; Esc dispatcher `registerEscape(priority, isActive, run)` with the five priorities; zoom steps; frame bindings Ctrl+1/2 (Digit1/Digit2), zoom (Equal/Minus/Digit0 + Numpad).
- [ ] `src/desktop/renderer/toast-store.ts`, `toast.tsx` (new) -- external store (`push`, `dismiss`, max 3), info and error kinds, optional action, 6 s dwell paused on hover.
- [ ] `src/desktop/renderer/button.tsx` (new) -- variants, icon, icon-only with `title`, `busy` (spinning `loader-circle`, disabled, `aria-busy`, full opacity), min 24×24.
- [ ] `title-bar.tsx`, `theme-switch.tsx`, `toolbar.tsx` (`zone-tab` with counter, `tablist`), `status-bar.tsx` (path: shrinking head + fixed last segment, `title` full) (new), each with its own `.css` -- per DESIGN; drag region with `no-drag` on controls; height and right inset from `env(titlebar-area-*)` with 40 px fallback so it stays aligned with the native buttons at any zoom.
- [ ] `app.tsx`, `renderer.tsx`, `index.css` -- assemble; zone state lifted so the keyboard layer switches it.
- [ ] Tests -- `strings.ro.test.ts` (plural, formats), `keyboard.test.ts` (text fields, Esc priority, zoom steps/clamp), `toast-store.test.ts`, `*.test.tsx` for theme switch (data-theme + `setTheme`, error → toast + revert), status bar (matrix row, zero entries), zone counters, busy button; existing `app.test.tsx` kept green.
- [ ] Architecture -- after the code, record via `bmad-architecture` the styling convention (Design Notes) in Consistency Conventions.

**Acceptance Criteria:**
- Given the change, when `npm test`, `npm run lint`, `npm run typecheck` run, then all pass.
- Given a chosen theme, when the app restarts, then it opens in that theme; given none, it follows Windows, with no flash of the other theme.
- Given `npm start` at 720 and 1200 px, then the frame matches the mockup's narrow and wide layouts.

## Implementation Notes

- Architecture recorded by the implementer through `bmad-architecture`'s Update step, applied by hand without the reviewer gate (memlog says so): AD-20 theme line, a new AD-20 bullet (workspace path, zoom, no menu), the „Stilizare (renderer)” convention, the Deferred item narrowed.
- `keyboard.test.tsx` is `.tsx` (needs jsdom); `app.test.tsx` tab lookups use `/^Toolbox/` since the counter is part of the tab.

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-19:** high 0, medium 3, low 12, false 0, maybe-false 1 (some low rejected).

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | Native caption buttons keep startup colors when Windows changes theme | medium | patch | `theme.ts` follows matchMedia live; `main.ts` has no `nativeTheme.on('updated')`. Fix: re-apply `nativeThemeSettings` on `updated`. |
| 2 | Theme-switch knob jumps instead of sliding | low | patch | `index.css` `[data-theme-changing] *` `!important` transition omits `transform`. Fix: add it. |
| 3 | Title bar contents overflow / misalign at high zoom | maybe-false | defer | Overlay height fixed at 40 DIP; whether `env(titlebar-area-height)` scales with zoom needs `npm start` at 200 %. Logged in `deferred-work.md`. |
| 4 | Ctrl+0 does nothing after a reload left the page zoomed | low | patch | `createZoom.move` returns early at index 100 %; Chromium keeps zoom per origin. Fix: reset always applies. |
| 5 | Path tail overflows onto key hints; separator lost | low | patch | `.status-path` lacks `overflow: hidden`; `splitPath` cuts the separator. Direct fix. |
| 6 | Hover restarts the 6 s dwell instead of pausing | medium | patch | `ToastCard` effect starts a full timer on every leave; EXPERIENCE says pause. Fix: resume remaining time. |
| 7 | Toasts leave with no fade | medium | patch | `dismiss` removes at once; EXPERIENCE Motion: „iese prin estompare”. Fix: leaving state + timer. |
| 8 | Toast action row and × style differ from DESIGN/mockup | low | patch | `.toast-action` on its own row; × uses filled ghost button. CSS fix. |
| 9 | Caller's `aria-label` dropped by `Button` | low | patch | `aria-label` set after `{...rest}`. Direct fix; the icon-only-without-title type guard rejected (adds types for an unmet case). |
| 10 | memlog line 125 corrupted by MSYS path conversion | low | patch | Reads „Ctrl+=C:/Program Files/Git/-/0”. Text fix. |
| 11 | `updated` lost its quotes in architecture front matter | low | patch | Diff shows `'2026-10-19'` → `2026-10-19`. Restore. |
| 12 | `tokens.css` misses six motion tokens; invents `--motion-spin`; dwell duplicated in JS | low | patch (missing tokens) / reject (rest) | Six DESIGN tokens absent → add. `--motion-spin` and `TOAST_DWELL_MS` (commented mirror) rejected: reading CSS vars in JS adds code for no user harm. |
| 13 | Raw values in `index.css` / `toast.css` / `theme-switch.css` | low | reject | No DESIGN token exists for `38rem`, `z-index` or the 1px ring; fixing means inventing tokens. |
| 14 | Unused `statusLabel`/`workspaceLabel`; `aria-label` on a role-less span | low | patch | grep finds no use; footer unnamed. Direct fix. |
| 15 | Spacing differs from the mockup by 1–2 px | low | reject | Values come from DESIGN tokens, the contract; the mockup's px are not tokens. |

## Design Notes

**Styling convention (fixed here).** Plain CSS, one file per component next to it, class names = DESIGN component names (`.title-bar`, `.zone-tab`), state through attributes (`[aria-selected]`, `[data-busy]`), values only from `tokens.css`. No CSS modules, no CSS-in-JS (CSP has no inline styles in production).

**Menu removed.** Electron's default menu owns Ctrl+=/−/0, Ctrl+R and Ctrl+Shift+I; `Menu.setApplicationMenu(null)` leaves the renderer's layer the single owner. DevTools in dev still open programmatically; text editing keys work without a menu on Windows.

**Workspace path through argv.** Resolved once by main at startup, so a launch argument (the mechanism the theme used in entry 2) is exact and needs no channel; `null` when unresolved.

## Verification

**Commands:**
- `npm test`, `npm run lint`, `npm run typecheck` -- all pass

**Manual checks (if no CLI):**
- `npm start`: switch theme, restart → kept; delete `theme` from `window-state.json`, set Windows dark → opens dark without a light flash; resize to 720 and 1200 px against `key-toolbox.html`; Ctrl+1/2 switch tabs; Ctrl+= to 200 % → nothing clipped, title bar aligned with the native buttons; Tab shows the focus ring, a click does not; Windows „Animation effects” off → no transitions, without restart.
