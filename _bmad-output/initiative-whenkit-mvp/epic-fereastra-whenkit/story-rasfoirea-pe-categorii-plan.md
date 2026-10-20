---
title: 'Răsfoirea pe categorii'
type: 'feature'
ticket: '4'
created: '2026-10-19'
status: 'built'
baseline_revision: 'a0a2be3a4e6ca4735ec57a96fdfd75410bf76d9d'
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

**Problem:** The list view shows plain cards of a whole zone: no category bar, no section header, no real entry card, no keyboard movement in the grid, nothing for an empty catalog or a slow start. Browsing by category (CAP-8) is the first way the author finds things.

**Approach:** Build the list view of both zones from the catalog store only: `category-bar` (Toate + the zone's categories in Romanian order, with counters, single selection, horizontal scroll with fades and ‹ ›, `[` / `]`, category remembered per zone while the app runs), `section-header`, the full `entry-card` (category-tab, meta row, kind-stamp in Learn, first situations, footer with verification-flag), the auto-fill grid as one roving-tabindex stop moved by arrows, `empty-state`, startup skeleton and the cascade on view change.

## Boundaries & Constraints

**Always:** AD-9, AD-10 (every view, counter and order derives from the store's snapshot; filtering keeps the snapshot order, never re-sorts entries), AD-13 (all text in `strings.ro.ts`), the „Stilizare (renderer)” convention: one `.css` per component, DESIGN class names, state through attributes, values only from `tokens.css`. No `style` prop: category color, tab position and stagger index go through `data-*` attributes mapped in CSS. The color-slot rule lives in one renderer function. Keys by `event.code` through the existing keyboard layer (still one listener). Renderer tests under jsdom with fake `window.whenkit` and `matchMedia`.

**Never:** No opening the sheet (click or Enter on a card does nothing beyond selecting it; entry 7), no search box, no arrivals, `entry-card-new` or arrival tape (entry 5), no „Categorii” button, no new IPC channel, no change to `core` or main, no state library, no `localStorage`, no remembering the category across restarts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bar order | Toolbox seed + one entry each in „AI & LLM” and „Imagini & video” | „Toate 2” first, then categories by `Intl.Collator('ro')` with counts, the empty ones at 0 | none |
| Select | click chip „Imagini & video” (or `]` from Toate) | only its entries, snapshot order; section-header „Imagini & video” · „N fișe” | none |
| Two categories | entry in A and B | appears under A, under B and once under Toate; footer „A +1” (first category of the entry) | none |
| Color slots | 10 categories in a zone | sorted by `id` as plain text → slots 1…9, the 10th gets slot 1; zones counted separately | none |
| Learn card | concept, 3 children, 4 situations | meta „umbrelă · 3 copii”, stamp „Concept”, first situation without label, „+3 situații” | concept without url or children → empty meta row, height kept |
| Toolbox card | GitHub repo, stars 137 654, pushed 15.10.2026, 4 situations, a verification note | meta „github.com/owner” + „repo”; label „Când o folosesc” + 2 situations; footer flag, „137,7k · 15.10.2026”, „+2 situații” | no stars → no stars item |
| Memory | Toolbox → „AI & LLM”, Ctrl+2, Ctrl+1 | back on „AI & LLM”; Learn kept its own | remembered category gone from snapshot → Toate |
| `[` `]` | on first / last chip | previous / next category, clamped at the ends, chip brought into view | in a text field → nothing |
| Grid keys | focus on a card | ←/→ ±1, ↑/↓ ± column count, clamped; Tab leaves the grid; Tab back lands on the selected card | none |
| Empty | whole catalog empty / zone or category without entries | big empty-state „Catalogul e gol.” + „/importa în terminal” / small „Nicio fișă în „X” încă.” (X = zone name under Toate) | none |
| Startup | snapshot slower than 200 ms | title bar + skeleton cards; none if it arrives sooner | error → app-error as today |

</frozen-after-approval>

## Code Map

- `DESIGN.md` front matter: `category-bar` L233, `category-chip(-active)` L241–257, `section-header` L258, `entry-card*` L264–305, `category-tab` L306, `kind-stamp` L313, `situation-item` L333, `verification-flag` L339, `empty-state` L545. Prose: slot rule and `--category` L606–610, states L710–719, entry-card anatomy L721–738, bar/chip/header/stamp/flag L766–772, empty-state L793.
- `EXPERIENCE.md` -- memory L50, bar/card/skeleton L88–91, startup/empty L119–121, keys L158–161, wheel L177, cascade L191, reduced motion L199, a11y L205–210 (chips = single-select group, grid = list of card-buttons named by the entry, one Tab stop), widths L224, L230.
- `mockups/key-toolbox.html` -- CSS bar H152–170, work-area mm grid H172–179, header/dimension line H181–190, cards/selected/Learn/stamp H192–225, narrow footer H384–386; markup H414–498. `mockups/key-learn-import.html` H431–450 (Learn cards). Mockup `style="--category…"` becomes `data-slot`.
- `src/desktop/renderer/app.tsx` -- replace the plain `.card` list; keep `TitleBar`, `Toolbar`, `StatusBar`, `ToastHost`, `AppError`; lift `categoryByZone` here next to `zone`; `loading` currently returns `null`.
- `src/desktop/renderer/keyboard.ts` -- `installKeyboard`, `Binding`; add `[`/`]` (`BracketLeft`/`BracketRight`, single keys) through a ref so the layer stays installed once.
- `src/desktop/renderer/index.css` -- drop `.card-grid`/`.card`; `.shell` becomes the work area.
- `src/desktop/renderer/tokens.css` -- add the component tokens above (only the ones used).
- `src/shared/strings.ro.ts` -- reuse `entryStrings.situations`, `entryStrings.emptyCatalog`, `kindLabels`, `resourceTypeLabels`, `zoneLabels`, `plural`, `entryCount`, `formatDate`, `formatCompact`; extend `appStrings`.
- Entry categories arrive sorted by `name_key` (`sqlite-catalog-store.ts` L227), so `categories[0]` is the card's color and footer name.
- `app.test.tsx` -- 'renders nothing while loading' changes with the skeleton; tab lookups use `/^Toolbox/`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/desktop/renderer/catalog-view.ts` (new) -- pure functions: `categorySlots(categories)` (per zone, by id, 1–9 cycling), `barCategories(categories, zone)` (Romanian collator), `categoryCounts`, `entriesInView(entries, zone, categoryId | null)`, `cardHost(url)` (hostname without `www.`; `github.com/<owner>` for GitHub), `nextGridIndex(index, key, columns, count)`.
- [ ] `src/shared/strings.ro.ts` -- bar label „Categorii”, „Toate”, scroll button labels, „+N situații”, „umbrelă · N copii”, „notă de verificare”, „Enter ↵ fișa”, the card list label, empty-state texts.
- [ ] `category-bar.tsx/.css` (new) -- `layers` label, separator, chips as `radiogroup`/`radio` (`aria-checked`, roving, ←/→ select); overflow-x scroll with hidden scrollbar, wheel → horizontal, ‹ › one page, fades and buttons from scroll position (scroll + ResizeObserver), active chip scrolled into view on change.
- [ ] `section-header.tsx/.css` (new) -- tab + view name + dimension line labelled `entryCount`.
- [ ] `entry-card.tsx/.css` (new) -- anatomy per DESIGN; `data-slot`, `data-tab` (index % 3), `data-zone`; Learn stamp; selected look on `:focus-visible` (accent border and ring, crop corners, „Enter ↵ fișa” pill); `entry-card-skeleton`.
- [ ] `card-grid.tsx/.css` (new) -- `ul` auto-fill grid, `li` per card, card `role="button"` named by the entry; roving tabindex, arrows via `nextGridIndex` with columns from computed `grid-template-columns` (1 when unknown); remounted per view (key) for the fade + cascade, `data-stagger` capped at 8.
- [ ] `empty-state.tsx/.css` (new) -- target drawing (SVG), title, text, command with the highlighted part; big and small variants.
- [ ] `app.tsx`, `index.css`, `tokens.css` -- assemble: tabpanel = category bar + header + grid on the mm-grid work area; skeleton after 200 ms while loading.
- [ ] Tests -- `catalog-view.test.ts` (slots incl. wrap and per zone, collator order with diacritics, counts incl. 0, view filtering keeps order, host, grid index); `*.test.tsx`: selecting a category shows only its entries, two-category entry in both, Learn cards stamped and Toolbox not, bar order and counters, `[`/`]` and per-zone memory, roving ←/→ and Tab stop, both empty states, skeleton only after 200 ms (fake timers); existing tests green.

**Acceptance Criteria:**
- Given the change, when `npm test`, `npm run lint`, `npm run typecheck` run, then all pass.
- Given `npm start` on the development catalog at 720 and 1200 px, then the list matches `key-toolbox.html` (bar scrolls without wrapping, fades and ‹ › appear only on the scrollable side) and Learn matches `key-learn-import.html` without the arrival.

## Implementation Notes

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-20:** high 0, medium 3, low 5, false 0, maybe-false 0 (two low rejected); one pre-existing issue deferred.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | After a zone switch the bar keeps the old zone's scroll; the active chip may be off-screen | medium | patch | `app.tsx` renders one `CategoryBar` for both zones; its scroll-into-view effect depends only on `[selectedId]`, which stays `null` when both zones are on Toate. Fix: `key={zone}` on the bar. |
| 2 | Wheel scrolling loses distance under `scroll-behavior: smooth` | medium | patch | `category-bar.css` L44 smooth; `onWheel` does `scrollLeft += deltaY`, and Chromium reads the mid-animation position on the next event. Fix: wheel scrolls instantly (`scrollBy` with `behavior: 'instant'`); smooth only for ‹ › and scrollIntoView. |
| 3 | Fades and ‹ › stale when content width changes without a box resize (font swap); observer rebuilt every render | low | patch | ResizeObserver watches only the scroller; `items` is a new array per `App` render. Fix: also observe the chips; depend on a stable signature, not the array. |
| 4 | `[`/`]` or Ctrl+1/2 with focus in the grid drops focus to `<body>`; arrows then dead | medium | patch | `app.tsx` L164 and `CardGrid` remount per `viewKey`, removing the focused card. Fix: when focus was in the grid before the view change, focus the new roving card; when it was in the bar, focus the checked chip. |
| 5 | Shift+`[`/`]` also changes the category | low | patch | `keyboard.ts` `matches()` treats a missing `shift` as any; the bindings at L165–166 omit it. Fix: `shift: false`. |
| 6 | Literal CSS values with no token; spacing tokens used as radii | low | reject | Same call as ticket 3 #13: DESIGN has no tokens for these; fixing means inventing tokens. |
| 7 | Spacing a few px off the mockup | low | reject | Same call as ticket 3 #15: DESIGN tokens are the contract, the mockup's px are not. |
| 8 | Stars · date separator composed in `entry-card.tsx` | low | patch | `entry-card.tsx` L57 builds `${…} · ${…}`; AD-13 puts composed text in `strings.ro.ts`, like „umbrelă · N copii”. Fix: a formatter in `strings.ro.ts`. |
| — | Bundled Cascadia subsets inlined as `data:` URIs, blocked by CSP | medium (unverified in a packaged build) | defer | Reported by the implementer; `index.html` CSP has no `font-src`, so `default-src 'self'` blocks `data:`; the import dates from ticket 3. Logged in `deferred-work.md`. |

## Design Notes

**Calls made in planning (the author may override at the checkpoint).** The „Enter ↵ fișa” pill ships now as part of `entry-card-selected`; Enter starts working in entry 7. `[`/`]` clamp at the ends, like zoom. A zone or category without entries gets the small empty-state; the big one is only for a fully empty catalog. While loading only the title bar is drawn (no counters to show yet).

**Selection = keyboard focus.** A click would open the sheet (entry 7), so selection exists only through the keyboard: the roving card (`tabIndex=0`) keeps its place while focus is elsewhere and shows the selected look only on `:focus-visible`. Entry 7 restores it by focusing the card.

**No `style` prop.** Slots `[data-slot='1'] { --category: var(--category-1) }` … 9; the skeleton/stagger and tab positions likewise. Keeps the CSP rule literal and the state in attributes.

## Verification

**Commands:**
- `npm test`, `npm run lint`, `npm run typecheck` -- all pass

**Manual checks (if no CLI):**
- `npm start` on the dev workspace: Toolbox → Toate; click a category, cascade plays; `[`/`]` move; Ctrl+2 / Ctrl+1 keeps each zone's category; resize to 720 and 1200 px against the mockups; wheel over the bar scrolls it; Tab reaches the grid once, arrows move the crop corners; Animation effects off → no cascade.
