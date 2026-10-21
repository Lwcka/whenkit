---
title: 'Modul de editare al fișei'
type: 'feature'
ticket: '12'
created: '2026-10-21'
status: done
baseline_revision: '0580baf5450ec29f05ffab01dc282bc5140a01ca'
route: 'full'
route_source: 'auto'
risk: 'high'
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

**Problem:** The user can read an entry but not correct it; `entries:patch` exists in core with no UI (CAP-10, EXPERIENCE Flow 3).

**Approach:** An edit mode of the sheet (E / „Editează”): the main column's Claude-written fields become a form (text fields, a native select for the type, a category picker, list editors for situations, keywords and sources), validated locally; Ctrl+S / „Salvează” sends only the changed fields with the `expectedRevision` taken at entry (or at „Reîncarcă fișa”). Rejections show under their field; `CONFLICT` or a terminal update during editing shows a `conflict-banner`. `my-notes` and the side panel stay as in reading.

## Boundaries & Constraints

**Always:** AD-3/AD-7 (core verifies; the UI only maps the answer), AD-10 (the save goes through the store's `write`; the form keeps its own draft and never reloads from the DTO), AD-13 (all texts in `strings.ro.ts`, reasons via `reasonTexts`), AD-16 (`expectedRevision` from edit start, refreshed only by „Reîncarcă fișa”), the styling convention (DESIGN `text-field`, `select`, `category-picker`, `list-editor`, `conflict-banner`, `button-primary` tokens mirrored in `tokens.css`; no `style` prop), Esc dispatcher (`ESCAPE_PRIORITY.editing`), reduced motion, error and banner messages announced `assertive`.

**Never:** No edit of kind, id, dates, GitHub data, verification notes, links or notes. No category creation. No Markdown preview. No reordering of list rows. No save on window close (out of scope). No change to core or IPC.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Enter | E or „Editează” on a sheet | form in place of the main column's fields (DESIGN L750–754 order); focus in „Nume”; sheet-bar: crumbs, „Renunță” + Esc, „Salvează” + Ctrl S; status-bar „Ctrl S salvează · Esc renunță”; Ctrl+1/2, E, Delete, Alt+←, mouse back, zone tabs, search box, related links inactive | E in a text field does nothing |
| Reading hints | sheet open, not editing | status-bar „E editează · Esc înapoi”; sheet-bar „Editează” + `kbd` E before „Șterge” | none |
| Invalid | empty name; 0 categories; no non-empty situation; tool link empty or not http(s); concept link not http(s); concept content empty | message under that field; „Salvează” disabled; Ctrl+S does nothing | none |
| Picker | 2 categories chosen | others disabled; toggled by click or Space, `aria-pressed` | none |
| Lists | „Adaugă situație” / „Adaugă cuvânt-cheie” / „Adaugă sursă”, Enter in the last row, × | new empty row focused; × removes without confirmation; × disabled on the last situation; empty rows ignored on save | none |
| Save text | only `whatItDoes` changed | `patchEntry({ id, expectedRevision, changes: { whatItDoes } })`; on ok leave edit, sheet shows the saved entry, no pulse | none |
| Save link | link changed | „Salvează” busy „Se verifică linkul…”, all fields locked; accepted or warned → leave edit (a warning shows as the sheet's verification note) | none |
| Rejected | `ENTRY_REJECTED` with reasons | stay in edit, nothing lost; each reason's text under its field (a source's URL → that source row; otherwise the link field) | assertive |
| Offline | `OFFLINE` | stay in edit; „Nu pot verifica linkul fără internet. Modificarea nu s-a salvat.” above the actions or under the link | assertive |
| Busy | `DATABASE_BUSY` or any other code | stay in edit; error toast with `errorMessages[code]` | none |
| Terminal update | the store's DTO gets a higher revision while editing | form unchanged; `conflict-banner` „Fișa a fost modificată din terminal. Salvarea ta va fi refuzată.” + „Reîncarcă fișa”; stays until edit ends | assertive |
| Conflict | save answers `CONFLICT` | banner shown, fields kept | none |
| Reload | „Reîncarcă fișa”, form dirty | confirmation (body „Pierzi ce ai schimbat în fișă.”); confirm → form from the current DTO, new `expectedRevision`, banner gone, still editing; notes untouched | clean form: no confirmation |
| Cancel | Esc or „Renunță”, form dirty | dialog „Renunți la modificări?” / „Ce ai schimbat în „X” se pierde.”, „Înapoi la editare” (default) and „Aruncă modificările” (danger-solid) | clean form: leaves at once |
| Notes | typing in notes while editing | notes save as in reading; a notes save never sets the banner | none |
| Vanished | entry deleted from the terminal while editing | edit ends with the sheet (existing vanish rule) | none |

</frozen-after-approval>

## Code Map

- New `src/desktop/renderer/edit-draft.ts` (+ `.test.ts`) -- pure: `Draft` (strings and row arrays), `draftFromEntry(entry)`, `validateDraft(draft, kind): Partial<Record<FieldKey, string>>` (texts from `strings.ro.ts`), `patchChanges(draft, entry): EntryPatch` (trimmed, empty rows dropped, only differing fields; concept empty link → `null`), `isDirty`, `reasonsByField(reasons, draft)` (a reason whose `params.url` equals a source row → `sources[i]`; everything else → `url`). `EntryPatch` type from `../../shared/ipc` (`ipc.ts` re-exports it).
- New components, one `.tsx` + `.css` each: `text-field.tsx` (label above, `input`/`textarea`/mono variant, `aria-invalid`, error `id` in `aria-describedby`, `role="alert"` error), `select-field.tsx` (native `select` + lucide `ChevronDown`), `category-picker.tsx` (`role="group"`, chips as `button[aria-pressed]`, reuse `.category-chip` from `category-bar.css` L60–120 by adding `[aria-pressed='true']` selectors, no count), `list-editor.tsx` (rows: number for situations, `text-field`, `Button variant="ghost" iconOnly` `X` „Șterge rândul”; `Button variant="ghost" icon={Plus}` „Adaugă …”), `conflict-banner.tsx` (`role="alert"`, `TriangleAlert`, text, `Button` „Reîncarcă fișa”), `entry-edit-form.tsx` (header: mark + „Nume”, row „Link” + „Tip” (`--entry-sheet-edit-type-width`, tools/materials only); sections „Categorii”, „Ce face” (textarea), „Când o folosesc · N”/„Când îl aleg · N”, „Cuvinte-cheie”, concepts: „Conținut” (textarea, plain), „Surse”). Mockup: `mockups/key-fisa.html` L455–514, CSS L307–331. Tokens: DESIGN front matter L350, L380, L389, L504–530 → `tokens.css`.
- `entry-sheet.tsx` -- prop `edit?: { draft, onChange, errors, locked, categories }`; when set, render `EntryEditForm` in place of L255–345 (header through keywords; hide the head `OpenInBrowser` L288), keep `MyNotes` (L347) and `aside.sheet-side` (L355–391) as they are; related links get `disabled` in edit.
- `sheet-bar.tsx` -- reading: `Button` „Editează” + `kbd` E (`Pencil`) before „Șterge”; editing (`editing` prop): hide „Înapoi” and „Șterge”, show `Button variant="ghost"` „Renunță” + `kbd` Esc and `Button variant="primary"` „Salvează” + `kbd` „Ctrl S” (`busy` with „Se verifică linkul…” when links changed, else „Se salvează…”; disabled when invalid). Update the doc comment L22.
- `app.tsx` -- edit state `{ entryId, draft, expectedRevision, errors (server), banner, saving, confirm: 'cancel' | 'reload' | null }` (one `useState`/`useReducer`); enter (focus „Nume” after render), save (`store.write(() => api.patchEntry(...))`; `ok` → leave; `ENTRY_REJECTED` → `reasonsByField`; `ARGUMENTS_INVALID` → `issues` mapped by first path key; `CONFLICT` → banner; `OFFLINE` → offline message; else toast `errorMessages[code]`), banner when `shownEntry.revision > expectedRevision` (derived), cancel/reload dialogs with the existing `Dialog` (L685–709 pattern), leaving edit when the entry leaves the stack. `registerEscape(ESCAPE_PRIORITY.editing, …)` beside L372–391. Guards: `changeZone` L455, `changeSearch` L463, mouse back L397, toolbar zone tabs and search input disabled while editing. `keyHints` L683: editing → `appStrings.editKeyHints`, sheet → `sheetKeyHints` (now „E editează · Esc înapoi”; update `app-sheet.test.tsx` L170). `FrameApi` L58–67 gets `'patchEntry'`; update the five test fakes.
- `keyboard.ts` `frameBindings` L167–216 -- new params `editing`, `startEdit`, `save`: `KeyE` (no modifiers, `when` sheet open and not editing) → `startEdit`; `KeyS` + ctrl (`when` editing) → `save` (fires in text fields: ctrl bindings already do); Ctrl+1/2 L195–196 and Alt+← and Delete get `when: () => !editing()`.
- `strings.ro.ts` -- `entryStrings.name: 'Nume'`; `appStrings`: `edit: 'Editează'`, `save: 'Salvează'`, `saving: 'Se salvează…'`, `verifyingLink: 'Se verifică linkul…'`, `addSituation: 'Adaugă situație'`, `addKeyword: 'Adaugă cuvânt-cheie'`, `addSource: 'Adaugă sursă'`, `removeRow: 'Șterge rândul'`, `conflictText`, `reloadEntry: 'Reîncarcă fișa'`, reload dialog (title „Reîncarci fișa?”, body „Pierzi ce ai schimbat în fișă.”, „Înapoi la editare”, „Reîncarcă”), cancel dialog (title „Renunți la modificări?”, body `(name) => „Ce ai schimbat în „${name}” se pierde.”`, „Înapoi la editare”, „Aruncă modificările”), `editOffline`, validation texts („Scrie un nume.”, „Alege cel puțin o categorie.”, „Scrie cel puțin o situație.”, „Scrie linkul.”, „Linkul trebuie să înceapă cu http:// sau https://.”, „Scrie conținutul.”), `editKeyHints`, `sheetKeyHints` with E.

## Tasks & Acceptance

**Execution:**
- [ ] `edit-draft.ts`, `strings.ro.ts`, `tokens.css` -- draft logic and texts.
- [ ] `text-field`, `select-field`, `category-picker`, `list-editor`, `conflict-banner`, `entry-edit-form` -- the form.
- [ ] `entry-sheet.tsx`, `sheet-bar.tsx`, `keyboard.ts`, `app.tsx`, `toolbar.tsx`, `status-bar` wiring -- edit mode.
- [ ] Tests -- `edit-draft.test.ts` (validation per field, `patchChanges` diff/trim/empty rows/concept null link, `reasonsByField`); component tests for the picker and list editor; `app-edit.test.tsx` covering every matrix row with a fake `patchEntry` (a deferred promise for the busy/locked state).

**Acceptance Criteria:**
- Given the change, when `npx vitest run --maxWorkers=2`, `npm run lint`, `npm run typecheck` run, then all pass.
- Given `npm start` on the dev workspace, when Flow 3 is done (add a situation, change the link, Ctrl+S), then the entry saves, and after a restart the edit and a note are still there.

## Implementation Notes

- Beyond the plan:
  - A local check for an empty „Ce face” („Scrie ce face.”), since core refuses a blank `whatItDoes`.
  - `ARGUMENTS_INVALID` shows „Valoarea nu e acceptată.” under the field named by the issue's first path key (server messages are English); an issue with no field becomes a toast.
  - A save with no real change leaves edit without calling `patchEntry`.
  - The banner is sticky.
  - Offline shows under the link field.
  - „Reîncarcă” in the reload dialog is `danger-solid`.
- After review: the banner stays mounted while saving (`bannerHeld`). A `CONFLICT` answer triggers `store.reload()`, and „Reîncarcă fișa” awaits it. After a failed save, focus goes to the first invalid field, else „Salvează”; after a reload it goes to „Nume”. List and picker errors are set on every row and chip.
- The sheet mark keeps the entry's original first category color while editing.
- Not checked by hand (no window in this session): Flow 3 with `npm start`, failures A and B, 720 and 1200 px.

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-21:** high 0, medium 3, low 6, false 0, maybe-false 0. Seven were patched and two low findings were rejected.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | The banner unmounts while a save runs and is re-announced on `CONFLICT` | medium | patch | `showConflict` requires `saving === null`; the matrix says the banner stays until edit ends. Fix: keep it while saving and suppress only the success flash. |
| 2 | „Reîncarcă fișa” after a `CONFLICT` the store has not seen rebuilds from the stale DTO and hides the banner | medium | patch | `runWrite` emits only on success, so the store keeps the old revision until the next poll. Fix: `store.reload()` on `CONFLICT`, used by the reload. |
| 3 | Focus falls to `<body>` after failed saves with no invalid field, and after the reload dialog | medium | patch | The focused control is disabled while locked, and the dialog's opener unmounts. Fix: fall back to „Salvează”/the group's first field, and to „Nume” after a reload. |
| 4 | List and picker errors are tied to no focusable control | low | patch | `aria-describedby` sits on the `<ul>`/group only. Fix: `aria-invalid` + describedby on rows and chips. |
| 5 | A name duplicate on a linkless concept shows under the empty „Link” | low | patch | Core keys a linkless concept by name. Fix: route `duplicate` to `name` when the draft link is empty. |
| 6 | `.category-chip:disabled:hover` overrides a pressed chip's border | low | patch | Specificity 0,3,0 beats 0,2,0. Fix: exclude pressed chips. |
| 7 | Raw CSS values in the new files | low | patch | They break the styling convention. Fix: tokens. |
| 8 | `--conflict-banner-border` differs from DESIGN's `{colors.signal}` | low | reject | It follows the mockup (`key-fisa.html` L307: a light border plus a 4 px signal stripe); the visible stripe is signal. |
| 9 | „Conținut” textarea is monospace | low | reject | "plain" in the Code Map means no preview (EXPERIENCE L103: Markdown written as text); mono suits Markdown source. |

## Design Notes

**Calls made in planning (EXPERIENCE leaves them open).** Focus goes to „Nume” on entering edit. The reload dialog's title and buttons, the sources add label and four validation texts are written here. While editing, everything that would leave the form (zone tabs, Ctrl+1/2, search, related links, Alt+←, mouse back, E, Delete) is inactive, so the only exits are „Renunță”/Esc and a save; the entry vanishing still ends edit. Server reasons carry no field path, so a reason with `params.url` equal to a source row goes there and the rest to the link field. A warned save leaves edit like an accepted one; the warning is visible as the sheet's verification note (`WriteResult` has no verdict flag).

**Why the draft lives in `App`, not in the form.** The save, the banner (which compares the store's live DTO with `expectedRevision`), the dialogs and the key bindings all need it; the form stays a controlled view.

## Verification

**Commands:**
- `npx vitest run --maxWorkers=2` -- all pass (default workers crash on this machine, see deferred-work)
- `npm run lint`, `npm run typecheck` -- pass

**Manual checks (if no CLI):**
- `npm start`: Flow 3 steps 1–6 and failures A (a 404 link) and B (an import `update` during editing, then „Reîncarcă fișa”); 720 and 1200 px.
