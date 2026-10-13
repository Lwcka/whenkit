# Review independent — versiuni și realitatea stack-ului (2026-10-13)

Reviewer independent: nu am văzut conversația care a produs spine-ul. Lentila: fiecare decizie angajată a fost verificată pe web sau în practică, nu afirmată din memorie? Am verificat cu `npm view`, `npm pack` (inspectat codul template-ului și al `create-electron-app`), release notes Forge 8 (`gh release view`), releases.electronjs.org, documentația Node 24 și probe rulate în scratchpad (în afara proiectului; nimic instalat în repo).

**Verdict:** stack-ul e în mare parte corect și actual, dar rândul „Template Forge vite-typescript 7.11.2” e greșit: template-ul acela nu mai există în Forge 8, iar `create-electron-app` 8 îl refuză explicit. Întrebarea lăsată „de verificat la scaffold” are deja răspuns, iar răspunsul e negativ.

## Constatări

### 1. HIGH — `vite-typescript` 7.11.2 nu merge cu Forge 8 (Stack, Deferred, memlog Q)

- `@electron-forge/template-vite-typescript` s-a oprit la `8.0.0-alpha.10` (2026-07-02); nu există 8.0.0 stabil.
- Release notes Forge 8.0.0/8.0.1, secțiunea *Removed packages*: „`@electron-forge/template-vite-typescript` … use `--template vite --typescript`”.
- `create-electron-app@8.0.1` (care deține acum scaffolding-ul; `electron-forge init` a fost eliminat) depinde doar de `template-vite` și `template-webpack` 8.0.1. În `dist/init-scripts/find-template.js` există un mesaj explicit: `The "vite-typescript" template no longer exists. Use "--template vite --typescript" instead.`
- Dacă primul tichet „fixează” 7.11.2, obține un proiect Forge 7 (CJS, Vite 5/6, plugin-vite experimental), incompatibil cu `@electron-forge/plugin-vite` 8.0.1 din Stack.

**Fix:** în Stack, înlocuiește rândul cu `create-electron-app 8.0.1` + `@electron-forge/template-vite 8.0.1 (--typescript)`. Comanda de scaffold: `npx create-electron-app@8.0.1 whenkit --template vite --typescript --package-manager npm --electron-version 44.7.1`. Scoate elementul din Deferred și închide `(question)` din memlog.

### 2. MEDIU — „TypeScript / Vite: fixat de template” nu spune nimic concret, iar React nu e în template

- Din `tmpl/package.json` al `template-vite@8.0.1` rezultă `typescript ^6.0.0` (azi 6.0.3) și `vite ^8.0.0` (azi 8.3.4). Memlog-ul menționează TS 7.0.2 ca „cel mai nou”. E corect, dar template-ul **nu** îl folosește. Un agent care citește „fixat de template” și vede TS 7 pe npm poate forța upgrade-ul.
- Template-ul nu conține React. Memlog-ul spune „după ghidul oficial Forge”, dar ghidul Forge *React with TypeScript* e scris pentru **webpack** și testat cu React 18 și TS 4.3. Nu e o bază pentru Vite 8 + React 19.
- Pentru React pe Vite trebuie adăugate: `react` / `react-dom` 19.3.0, `@types/react` / `@types/react-dom` 19.3.x, `@vitejs/plugin-react` 6.1.2 (peer `vite ^8.0.0`, deci se potrivește), plus `"jsx": "react-jsx"` în tsconfig și pluginul în `vite.renderer.config.mts`.

**Fix:** în Stack, scrie versiunile rezolvate (TypeScript 6.0.x, Vite 8.3.x) și adaugă un rând pentru `@vitejs/plugin-react 6.1.2`. Pentru React nu mai trimite la ghidul Forge.

### 3. LOW — Raționamentul „plugin-vite experimental din v7.5” e învechit (memlog)

Release notes Forge 8: „The Vite plugin is promoted to stable … covered by semver. It now targets Vite 8”. Pagina de documentație electronforge.io/config/plugins/vite încă afișează avertismentul din v7.5, ceea ce probabil a indus în eroare. Tot din Forge 8: proiectele noi folosesc oxlint + oxfmt (nu ESLint/Prettier), Node ≥ 22.17 (local 24.19.0, deci OK), iar main/preload ies ca `.cjs`.

**Fix:** actualizează nota din memlog. Opțional, adaugă la Consistency Conventions „lint/format: oxlint + oxfmt (din template)”, ca tichetele să nu introducă ESLint în paralel.

### 4. LOW — Electron 44.7.1 a apărut azi

`electron@44.7.1` a fost publicat pe 2026-10-13T17:57Z (`latest`), după înregistrarea din memlog. Are același Node 24.21.0 și Chromium 152.0.7977.149 (față de .130), cu fix-uri backportate. Pinul pe 44.7.0 nu e greșit, dar pentru o aplicație nouă patch-ul cel mai recent e alegerea firească.

**Fix:** fixează 44.7.1 sau scrie „44.7.x, ultimul patch la scaffold”.

### 5. LOW — Fuse-ul `RunAsNode: false` din template contrazice elementul amânat „CLI prin `ELECTRON_RUN_AS_NODE`”

`forge.config.mts` din template setează `FuseV1Options.RunAsNode: false` (și `EnableNodeOptionsEnvironmentVariable: false`). În aplicația împachetată, `ELECTRON_RUN_AS_NODE` e deci dezactivat din fabrică. Elementul din Deferred cere ca acest fuse să fie redeschis, ceea ce e un compromis de securitate. Se poate face și altfel: un utilitar Node separat sau `utilityProcess`.

**Fix:** adaugă în elementul din Deferred „cere relaxarea fuse-ului RunAsNode; de reevaluat”.

### 6. LOW — `ELECTRON_RUN_AS_NODE=1` e setat în shell-ul agentului

În mediul Claude Code de pe această mașină, `ELECTRON_RUN_AS_NODE=1` e moștenit (din VS Code). Am reprodus efectul: `electron main.cjs` rulează ca Node pur, iar `require('electron').app` e `undefined`. Proba din memlog („sub ELECTRON_RUN_AS_NODE”) a fost probabil influențată de același lucru. `electron-forge start` șterge variabila (`core/dist/api/start.js`), deci `npm start` e sigur. Problema apare la orice lansare directă a lui `electron` sau la un harness de test E2E.

**Fix:** o notă operațională în tichetul de scaffold: aplicația se pornește doar prin `npm start`, iar orice alt lansator face `delete env.ELECTRON_RUN_AS_NODE`.

### 7. LOW — `node:sqlite` e Release Candidate (1.2), nu Stable

Documentația Node v24.21.0 are „Stability: 1.2 — Release candidate” (RC din v24.15.0). Din v24.19 nu mai apare `ExperimentalWarning`. Riscul e mic și e deja izolat în `SqliteCatalogStore` (AD-4 menționează better-sqlite3 13.0.3 ca înlocuitor).

**Fix:** menționează statutul RC în AD-4 sau în Stack, ca să fie vizibil la upgrade-uri de Node sau Electron.

### 8. LOW (în afara lentilei, verificare practică) — Testele pe `:memory:` nu acoperă WAL, `busy_timeout` și `data_version`

Am verificat: pe `:memory:`, `PRAGMA journal_mode` întoarce `memory`, iar `data_version` se schimbă doar la commit-urile **altei** conexiuni. AD-4 (WAL) și AD-10 (polling `data_version` între CLI și aplicație) nu pot fi testate pe `:memory:`.

**Fix:** în convenția de teste, păstrează `:memory:` pentru logica obișnuită și folosește un fișier temporar cu două conexiuni pentru AD-4 și AD-10.

## Confirmat (verificat, nu doar afirmat)

| Element | Rezultat | Cum |
|---|---|---|
| Electron 44.7.0: Node 24.21.0, SQLite 3.53.4 | OK | releases.electronjs.org (Node); `process.versions` în procesul **main** real al Electron 44.7.0 (SQLite 3.53.4) |
| `node:sqlite` + FTS5 `unicode61 remove_diacritics 2` | OK | rulat în procesul main Electron 44.7.0 (nu doar RUN_AS_NODE) și în Node 24.19.0 (SQLite 3.53.3); `elimina` găsește `elimină` |
| Bundling `node:sqlite` cu plugin-vite 8 | OK | `vite.base.config.ts` pune `builtinModules` ca externe; Node 24 include `node:sqlite` în listă |
| @electron-forge/cli, plugin-vite 8.0.1 | OK, `latest` | `npm view`; publicate 2026-09-29 |
| React 19.3.0 | OK, stabil | `npm view`; publicat 2026-09-09; `react-dom` 19.3.0, `@types/react` 19.3.0 |
| Zod 4.6.7 + `z.toJSONSchema` | OK | instalat în scratchpad: emite `$schema: draft/2020-12`. Notă: pentru lotul de **intrare** folosește `z.toJSONSchema(schema, { io: 'input' })` dacă schema are `.default()` sau transformări |
| Vitest 5.0.4 | OK | peer `vite ^6.4 \|\| ^7 \|\| ^8`, engines `node ^22.12 \|\| ^24`; se potrivește cu Vite 8 și Node 24 |
| React + Vite + plugin-react | coerent | `@vitejs/plugin-react` 6.1.2 cere `vite ^8.0.0`, ca template-ul |
| Node ≥ 24 pentru CLI | OK | Forge 8 cere ≥ 22.17; Vitest acceptă 24 |

## Surse

- `npm view` / `npm pack`: electron, @electron-forge/{cli,core,plugin-vite,template-vite,template-vite-typescript}, create-electron-app, react, react-dom, @types/react, zod, vitest, vite, typescript, @vitejs/plugin-react (2026-10-13)
- Release notes Electron Forge v8.0.1 (`gh release view v8.0.1 -R electron/forge`)
- https://releases.electronjs.org/release/v44.7.0 și /v44.7.1
- https://nodejs.org/docs/latest-v24.x/api/sqlite.html (v24.21.0)
- https://www.electronforge.io/config/plugins/vite (avertisment învechit din v7.5)
- https://www.electronforge.io/guides/framework-integration/react-with-typescript (webpack, React 18)
- Probe locale în scratchpad: Electron 44.7.0 main process, Node 24.19.0, Zod 4.6.7
