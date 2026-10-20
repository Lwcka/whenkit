---
title: 'Markdown și linkurile externe'
type: 'feature'
ticket: '8'
created: '2026-10-21'
status: 'built'
baseline_revision: '290705706e75314d78fb00ae8558f558b4106c2c'
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

**Problem:** The sheet shows a concept's content as plain text and every link (the entry's URL, the sources) as dead text, so tables and formatting are lost and nothing can be opened in the browser (CAP-10, EXPERIENCE `open-in-browser`, `markdown-content`).

**Approach:** Render concept content as Markdown with GFM tables through **react-markdown 10.1.0 + remark-gfm 4.0.1** (no raw HTML, no images). Add one IPC channel `shell:openExternal` whose main handler opens only `http:`/`https:` URLs through `shell.openExternal`; the sheet uses it for `open-in-browser`, the URL in the subline, the sources and links inside the Markdown. Any other scheme shows as plain text.

## Boundaries & Constraints

**Always:** AD-9 (no navigation, no `window.open`, CSP unchanged, main validates the URL again: the renderer is not trusted), AD-18 (handler never throws; answers `IpcResult<null>`), AD-13 (texts in `strings.ro.ts`), the renderer styling convention (DESIGN class names, values from `tokens.css`, no `style` prop), one shared `isExternalUrl` used by both processes.

**Never:** No `rehype-raw`, no `dangerouslySetInnerHTML`, no image ever loaded (not even `data:` from Markdown). No editing, notes or delete (entries 9–12). No change to `will-navigate`/`setWindowOpenHandler` beyond what exists. No error toast for a failed open (nothing in EXPERIENCE asks for one).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Table | content with a GFM table | `<table>` with header row, token borders | none |
| Raw HTML | content with `<script>alert(1)</script>`, `<b>x</b>` | nothing executes; no `script`/`b` element in the DOM | dropped (`skipHtml`) |
| Image | `![logo](https://x.test/a.png)` | no `img` element; the alt text shows as plain text | none |
| Bad link | `[x](javascript:alert(1))`, `[y](file:///C:/a)`, `[z](mailto:a@b)` | plain text „x”, „y”, „z”, no anchor | none |
| Good link | `[docs](https://react.dev)` | accent link with ↗; click calls `openExternal('https://react.dev')`, default prevented | none |
| Open in browser | tool with `https://remove.bg` | side block „Deschide în browser” + URL; click opens it; subline URL is a link too | none |
| No URL / bad URL | concept without link; entry URL `ftp://…` | block absent; subline shows the URL as text | none |
| Sources | `https://…` and a non-http string | first is a link (↗), second plain text | none |
| Main handler | `'https://a.b'`, `'http://a.b'` | `shell.openExternal` called once; `{ ok: true, data: null }` | none |
| Main refuses | `'javascript:x'`, `'file:///c'`, `''`, `42`, `'not a url'` | not called; `{ ok: false, error: { code: 'ARGUMENTS_INVALID' } }` | none |
| Open fails | `shell.openExternal` rejects | `{ ok: false, error: { code: 'INTERNAL' } }`, error logged | logged, renderer ignores |

</frozen-after-approval>

## Code Map

- `package.json` -- add exact `"react-markdown": "10.1.0"`, `"remark-gfm": "4.0.1"` to `dependencies` (`npm install --save-exact`; both ESM, peer React ≥18).
- `src/shared/ipc.ts` -- add `IPC_CHANNELS.shellOpenExternal: 'shell:openExternal'`; `isExternalUrl(value: unknown): value is string` beside `isTheme` (parseable by `new URL` and protocol `http:`/`https:`); `WhenkitApi.openExternal(url: string): Promise<IpcResult<null>>` with doc comment. `ipc.test.ts` -- cases for `isExternalUrl`.
- `src/desktop/preload/preload.ts` -- `openExternal: (url) => ipcRenderer.invoke(IPC_CHANNELS.shellOpenExternal, url)`.
- New `src/desktop/main/external-link.ts` (+ `.test.ts`) -- `openExternalResult(url: unknown, open: (url: string) => Promise<void>, logError): Promise<IpcResult<null>>`: refuses with `ARGUMENTS_INVALID` unless `isExternalUrl`; on rejection logs and answers `INTERNAL`. Pure, like `searchResult` in `catalog.ts`.
- `src/desktop/main/main.ts` -- import `shell`; `ipcMain.handle(IPC_CHANNELS.shellOpenExternal, (_e, url: unknown) => openExternalResult(url, (u) => shell.openExternal(u), reporter.log))` beside the other handlers. Nothing else changes.
- `src/desktop/renderer/app.tsx` L48 -- add `'openExternal'` to `FrameApi`; pass `onOpenExternal={(url) => void api.openExternal(url)}` to `EntrySheet` (L483). Update every test `FrameApi` fake (`app.test.tsx` L24, `app-arrivals.test.tsx` L25, `app-search.test.tsx` L58, `app-sheet.test.tsx` L62) with `openExternal: vi.fn(async () => ({ ok: true, data: null }))` or equivalent.
- New `src/desktop/renderer/external-link.tsx` -- `ExternalLink({ href, onOpen, children, className? })`: when `isExternalUrl(href)`, `<a href className="external-link">` + lucide `ExternalLink` icon (`icon-sm`), `onClick` → `preventDefault()` + `onOpen(href)`; otherwise a `<span>` with the children (plain text).
- New `src/desktop/renderer/markdown-content.tsx` -- `<Markdown remarkPlugins={[remarkGfm]} skipHtml components={…}>`: `a` → `ExternalLink`; `img` → `<span>{alt}</span>`; `h1` → `<h2>` (the sheet keeps one `h1`). The default `urlTransform` stays (it already empties `javascript:`).
- `src/desktop/renderer/entry-sheet.tsx` -- prop `onOpenExternal(url)`; content section uses `MarkdownContent`; sources use `ExternalLink`; subline URL uses `ExternalLink`; new `OpenInBrowser` block (DESIGN L778: „Deschide în browser”, URL below in mono, `ExternalLink` icon right) first in `sheet-side`, and a second copy under the header for the one-column layout. Update the doc comment („nothing here opens a link”).
- `src/desktop/renderer/entry-sheet.css` -- drop `white-space: pre-wrap` and the „entry 8” comments; `.markdown-content` styles from DESIGN `markdown-content` tokens (front matter L455–464): `h2` headline, `h3` title-sm, `table` with `table-header` background, `table-border` borders, `table-radius`, `code`/`pre` mono on `code-background`, links accent. `.open-in-browser` from the mockup `mockups/key-fisa.html` L285–287 with token vars; `.sheet-head .open-in-browser` hidden above 959 px, the side copy hidden at ≤959 px (EXPERIENCE L224). Mirror missing component tokens into `tokens.css`.
- `src/shared/strings.ro.ts` -- `appStrings.openInBrowser: 'Deschide în browser'`.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` -- install the two libraries exactly.
- [ ] `src/shared/ipc.ts`, `preload.ts`, `main/external-link.ts`, `main/main.ts` -- channel, shared check, handler.
- [ ] `strings.ro.ts`, `external-link.tsx`, `markdown-content.tsx`, `entry-sheet.tsx/.css`, `tokens.css`, `app.tsx` -- rendering and wiring.
- [ ] Tests -- `ipc.test.ts` (`isExternalUrl`); `main/external-link.test.ts` (every „Main” matrix row); `markdown-content.test.tsx` (Table, Raw HTML incl. no `script` element and nothing executed, Image, Bad link, Good link); `entry-sheet.test.tsx` (Open in browser, No URL / bad URL, Sources); update the four `FrameApi` fakes.

**Acceptance Criteria:**
- Given the change, when `npx vitest run --maxWorkers=2`, `npm run lint`, `npm run typecheck` run, then all pass.
- Given `npm start` on the dev workspace, when „Deschide în browser” on a tool and a link in „Surse” of a concept are clicked, then the default browser opens them and the window stays on the sheet.

## Implementation Notes

## Plan Change Log

## Review Triage Log

**Pass 1 (quick, Opus), 2026-10-21:** high 0, medium 1, low 1, false 0, maybe-false 0. Both were patched.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | GFM footnotes render an English "Footnotes" heading (visible, headline style) and "Back to reference N" labels on the sheet | low | patch | remark-gfm turns footnotes on; nothing set `remarkRehypeOptions`, so mdast-util-to-hast uses its English defaults (AD-13). Fix: `footnoteLabel`/`footnoteBackLabel` from `strings.ro.ts`, plus a test. |
| 2 | In the one-column layout the head copy of `open-in-browser` sits in `.sheet-head-text`, beside the mark, so it is indented and drags the mark off the title line | medium | patch | `.sheet-head` is `display: flex; align-items: center`; EXPERIENCE L224 wants the block under the title. Fix: render that copy right after `</header>`, hidden above 959 px. |

## Design Notes

**Why react-markdown + remark-gfm.** It builds React elements from the Markdown syntax tree, so there is no HTML string and no `dangerouslySetInnerHTML`; raw HTML is dropped with `skipHtml`, and each element can be replaced (`a`, `img`). Rejected: `markdown-it`/`marked` (produce an HTML string that must be sanitized, e.g. with DOMPurify — a second dependency and the exact risk AD-9 names); `micromark` alone (same string output). GFM tables need `remark-gfm` (CommonMark has none). Both versions are the newest on npm (2025-03 and 2025-02), well past two weeks.

**Two copies of `open-in-browser`.** The block sits in the side panel, but in the one-column layout it moves under the title while the rest of the panel goes below the content. The two columns are separate boxes, so one CSS rule cannot move it; the sheet renders it in both places and the media query hides one (`display: none` also hides it from screen readers). Tests use `getAllBy…` for it.

**Main checks again.** The renderer already shows only http(s) links, but the handler is the security boundary: it re-checks with the same `isExternalUrl`, so a compromised renderer still cannot open `file:` or a protocol handler.

## Verification

**Commands:**
- `npx vitest run --maxWorkers=2` -- all pass (default workers crash on this machine, see deferred-work)
- `npm run lint`, `npm run typecheck` -- pass

**Manual checks (if no CLI):**
- `npm start`: a concept with a table and links; „Deschide în browser”, subline URL, a source; the window never navigates; 720 and 1200 px.
