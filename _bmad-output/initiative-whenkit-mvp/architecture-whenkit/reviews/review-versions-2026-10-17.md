# Review independent — versiuni și realitatea stack-ului, delta 2026-10-17

Reviewer independent, fără acces la conversația care a produs actualizarea. Lentila: deciziile angajate azi au fost verificate pe web sau în practică, sau sunt afirmate din memorie? Scopul e **doar delta din 2026-10-17**: rândurile din Stack `lucide-react 1.58.0` și `@fontsource/cascadia-mono 5.3.0`, AD-20 (`app.setPath('userData')`, `nativeTheme`, calea implicită `userData`) și AD-19 (`productName` = `WhenKit` și efectul asupra maker-ului Squirrel din Forge 8).

Ce am verificat:

- `npm view` (versiuni, date de publicare, `peerDependencies`, `exports`, `dist-tags`);
- `npm pack` pentru cele două pachete, inspectate în scratchpad (nimic instalat în repo);
- `node_modules/electron/electron.d.ts` (Electron 44.7.1, instalat);
- documentația `app` de pe electronjs.org și sursa Electron `shell/common/electron_paths.cc` și `shell/app/electron_main_delegate.cc`;
- sursa `@electron-forge/maker-squirrel` 8 și `electron-squirrel-startup` din `node_modules`;
- `package.json`, `forge.config.mts`, `index.html`, `src/desktop/main/main.ts`, `src/core/workspace.ts`;
- conținutul real al `%APPDATA%\whenkit` și `%LOCALAPPDATA%\whenkit` pe această mașină.

**Verdict:** cele două versiuni noi sunt corecte și au fost luate din `npm view`. AD-20 se bazează însă pe comportamente Electron afirmate fără precondițiile lor. Regula, așa cum e scrisă, aruncă excepție la prima pornire și pune aplicația de dezvoltare și cea instalată în același profil Chromium. Ambele se repară prin reformulare, fără altă decizie.

## Ce s-a confirmat

| Afirmație din spine | Rezultat |
|---|---|
| `lucide-react` 1.58.0 | `latest`, publicat 2026-10-16T06:16Z (cu o zi înainte). Lucide publică aproape zilnic, deci pinul exact e alegerea corectă. `peerDependencies.react`: `^16.5.1 \|\| ^17 \|\| ^18 \|\| ^19.0.0`, deci React 19.3.0 e acoperit; `@types/react` e peer opțional. Pachetul e ESM (`module`) și are `sideEffects: false`, deci importul per iconiță e tree-shaken de Vite. Toate cele 20 de iconițe numite în DESIGN.md există ca exporturi. |
| `@fontsource/cascadia-mono` 5.3.0 | `latest`, publicat 2026-07-19. `exports` include `./*.css` și `./files/*.woff2`, deci Vite le importă direct. Greutăți statice 200–700, subseturi `latin` și `latin-ext` (ș, ț românești sunt în `latin-ext`). Fișierele woff2 normale 400/500 au 5,9–35 KB, toate peste `assetsInlineLimit` (4096 B), deci Vite le emite ca fișiere, nu ca `data:`. CSP-ul din `index.html` (`default-src 'self'`, fără `font-src`) le permite. |
| Calea implicită `userData` = `%APPDATA%\<productName>` | Confirmat în `electron_paths.cc`: `DIR_USER_DATA` = `DIR_APP_DATA` + `GetPossiblyOverriddenApplicationName()`, cu `create_dir = true`. `app.getName()` preferă `productName` din `package.json`. |
| Chromium nu scrie în altă parte decât `userData` | Confirmat. `DIR_SESSION_DATA` întoarce `DIR_USER_DATA` („By default and for backward, equivalent to DIR_USER_DATA”), `DIR_CRASH_DUMPS` = `userData\Crashpad`, iar `DIR_APP_LOGS` pe Windows = `userData\logs`. Toate trei se calculează din `userData`, deci îl urmează dacă `setPath('userData')` rulează primul. Documentația cere ca `sessionData` să fie schimbat înainte de `ready`, ceea ce AD-20 respectă. |
| `nativeTheme` pentru prima pornire | `nativeTheme.shouldUseDarkColors` și `themeSource: 'system' \| 'light' \| 'dark'` există în typings-urile 44.7.1. |
| AD-19, efectul `productName` asupra Squirrel | Din sursa `MakerSquirrel.js` (Forge 8.0.1): `exe` = `${packagerConfig.executableName \|\| appName}.exe` → `WhenKit.exe`; `setupExe` = `WhenKit-0.1.0 Setup.exe`; `title` = `WhenKit`. ID-ul Squirrel (`name`) vine din `package.json.name` = `whenkit`, deci folderul de instalare rămâne `%LOCALAPPDATA%\whenkit` și actualizările rămân pe același ID. Pe această mașină nu există nicio instalare (`%LOCALAPPDATA%\whenkit` și `out/` lipsesc), deci nu e nimic de migrat. `electron-squirrel-startup` creează scurtătura după `basename(process.execPath)`, deci folosește noul `WhenKit.exe`. |

## Constatări

### 1. MEDIU — `app.setPath` aruncă excepție dacă folderul nu există; ordinea de la pornire nu e scrisă (AD-20)

- Typings-urile 44.7.1 și documentația spun: „If the path specifies a directory that does not exist, an Error is thrown. In that case, the directory should be created with `fs.mkdirSync`.” La prima pornire, `%APPDATA%\whenkit\desktop\` nu există, deci regula aplicată literal oprește aplicația.
- Ordinea contează și în alte două locuri:
  - `electron-squirrel-startup` cheamă `app.quit()` asincron, deci codul de după rulează și la `--squirrel-install` / `--squirrel-uninstall`;
  - `requestSingleInstanceLock()` (pe care fereastra îl va dori probabil) se leagă de directorul `userData`, așa că mutarea trebuie făcută înainte de el. Lucrul ăsta nu e documentat explicit de Electron; vezi fix-ul din Electron 16.2.2 („incorrect return value of `requestSingleInstanceLock()` when setting non-existent user data folder”).
- Calea e scrisă literal, `%APPDATA%\whenkit\desktop\`, deși AD-8 calculează `%APPDATA%\whenkit` dintr-un singur loc (`src/core/workspace.ts`, din `process.env.APPDATA`). Două calcule ale aceluiași folder pot diverge.

**Fix (formulare în AD-20):** înlocuiește prima propoziție cu: „Primul lucru din main, după ieșirea Squirrel (`electron-squirrel-startup`) și înainte de `requestSingleInstanceLock` și `ready`: creează (`mkdirSync`, `recursive`) și setează `userData` (`app.setPath`) la `<folderul de configurare din AD-8>\desktop\`, calculat din aceeași funcție ca `config.json`. `sessionData`, `crashDumps` și `logs` derivă din `userData` și îl urmează; nimic nu citește `app.getPath` înainte.”

### 2. MEDIU — Dezvoltarea și aplicația instalată ar împărți același `userData` (AD-20 contra AD-19)

- `npm start` (`electron-forge start`) citește tot `productName: WhenKit`, iar `setPath` primește aceeași cale literală. `npm start` și `WhenKit.exe` instalat scriu deci în același `window-state.json` și în același profil Chromium.
- Două procese Electron pe același profil, pornite simultan, produc erorile cunoscute de cache Chromium („Unable to move the cache: Access is denied”). Dacă se adaugă single-instance lock, `npm start` nu mai pornește cât timp e deschisă aplicația instalată.
- AD-19 cere explicit ca dezvoltarea să nu atingă starea reală. Tema și poziția sunt mărunte, dar profilul partajat nu e.

**Fix (formulare în AD-20):** „…la `desktop\` pentru aplicația împachetată (`app.isPackaged`) și la `desktop-dev\` în dezvoltare.” O alternativă e o variabilă din `.env`, ca `WHENKIT_WORKSPACE`, dar `isPackaged` nu cere configurare.

### 3. SCĂZUT — Folderul implicit e deja **același** cu folderul CLI-ului, iar resturile rămân

- NTFS nu face diferența între majuscule și minuscule, așa că `%APPDATA%\WhenKit` (implicit, după `productName`) e același folder cu `%APPDATA%\whenkit`. AD-20 are deci dreptate că mutarea e necesară.
- Pe această mașină, `%APPDATA%\whenkit` conține deja, lângă `config.json`, un profil Chromium complet din rulările `npm start`: `Cache`, `GPUCache`, `Local Storage`, `Network`, `Preferences`, `Local State` etc. AD-20 nu spune ce se întâmplă cu ele.
- Dacă ceva cheamă `app.getPath('userData')` înainte de `setPath`, Electron recreează folderul implicit (`create_dir = true`). Aici nu strică nimic, pentru că folderul există deja.

**Fix:** o notă în tichetul care implementează AD-20, nu în spine: „după prima rulare, șterge de mână profilul Chromium vechi din `%APPDATA%\whenkit` (totul în afară de `config.json`)”. Nu se automatizează: aplicația nu șterge nimic din folderul CLI-ului.

### 4. SCĂZUT — „Tema ajunge în renderer înainte de prima randare” nu acoperă părțile native

- DESIGN.md cere o bară de titlu proprie peste butoanele native ale ferestrei, colorată pe `{colors.chrome}`. În Electron asta înseamnă `titleBarStyle: 'hidden'` + `titleBarOverlay` (`color`, `symbolColor`, `height: 40`). Overlay-ul nu urmează CSS-ul; se schimbă doar din main, cu `setTitleBarOverlay` (API confirmat în 44.7.1).
- Fundalul de dinaintea primei randări vine din `BrowserWindow({ backgroundColor })`. Fără el, fereastra clipește în alb noaptea.
- Barele de derulare și `prefers-color-scheme` urmează `nativeTheme.themeSource`, nu clasa din renderer.

**Fix (formulare în AD-20):** „Main-ul aplică tema și părților native, la creare și la `window:setTheme`: `backgroundColor`, `titleBarOverlay` (`setTitleBarOverlay`) și `nativeTheme.themeSource`.” Asta întărește regula „un singur proprietar”.

### 5. SCĂZUT — Importul implicit al fontului aduce doar greutatea 400

- `@fontsource/cascadia-mono` (fără sub-cale) încarcă `index.css`, adică doar 400. DESIGN.md folosește și 500 (`kbd`).
- Fișierele per subset (`latin-500.css`, `latin-ext-500.css`) nu au `unicode-range`. Importate împreună, ultima declarație o înlocuiește pe prima, iar literele de bază se pierd.

**Fix:** în rândul din Stack sau în tichet: „import `@fontsource/cascadia-mono/400.css` și `/500.css` (toate subseturile, cu `unicode-range`)”.

### 6. INFO — `trash-2` e acum alias

În lucide-react 1.x, `Trash2` e exportat ca alias al lui `Trash` (`Trash as Trash2`); glifa e cea cu două linii verticale. Importul `Trash2` din DESIGN.md merge. Doar numele canonic s-a schimbat; nu e nimic de corectat în spine.

### 7. INFO (în afara deltei) — Electron 44.7.1 nu mai e ultimul patch

După 44.7.1 (2026-10-13) au apărut `44.7.2` (2026-10-14) și `44.8.0` (2026-10-16, `latest`). Comportamentele verificate mai sus nu se schimbă într-o versiune minoră. Pinul se reevaluează la următorul tichet de dependențe.

### 8. INFO — Locuri din cod care încă spun `whenkit`

`index.html` (`<title>whenkit</title>`) și `src/desktop/main/main.ts` (`title: 'whenkit'`) trebuie actualizate odată cu `productName`. Ține de tichet, nu de spine.

## Surse

- `npm view` / `npm pack`: lucide-react@1.58.0, @fontsource/cascadia-mono@5.3.0, electron, @electron-forge/maker-squirrel (2026-10-17)
- https://www.electronjs.org/docs/latest/api/app (`getPath`, `setPath`, `getName`)
- https://raw.githubusercontent.com/electron/electron/main/shell/common/electron_paths.cc
- https://raw.githubusercontent.com/electron/electron/main/shell/app/electron_main_delegate.cc
- https://releases.electronjs.org/release/v16.2.2 (fix pentru single-instance lock cu `userData` inexistent)
- https://webdriver.io/docs/desktop-testing/electron/deeplink-testing (lock-ul depinde de directorul `userData`)
- `node_modules/electron/electron.d.ts` (44.7.1), `node_modules/@electron-forge/maker-squirrel/dist/MakerSquirrel.js`, `node_modules/electron-squirrel-startup/index.js`
