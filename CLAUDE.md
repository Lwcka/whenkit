# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Acest fișier este pentru **dezvoltarea** aplicației. Claude-ul care *folosește* aplicația (import, căutare) lucrează în workspace-ul aplicației, în afara repo-ului, cu propriul CLAUDE.md de runtime (vezi mai jos).

## Stadiul proiectului

Codul se construiește tichet cu tichet, în ordinea din `_bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/tickets.toml`. Ce e gata și ce urmează: `uv run _bmad/method/scripts/tickets.py --project-root . status` (sau `next`); planul fiecărui tichet construit stă lângă `tickets.toml`, ca `story-<titlu>-plan.md`, cu deciziile și triajul reviziei. Lucrurile amânate sunt în `_bmad-output/initiative-whenkit-mvp/deferred-work.md`. Produsul e definit în spec-ul **`_bmad-output/initiative-whenkit-mvp/spec-whenkit/spec-whenkit.md`** și în companionii lui: aceasta e sursa de adevăr. Citește spec-ul înainte de a propune ceva de produs sau de arhitectură. Spec-ul se modifică doar prin skill-ul `bmad-spec` (e derivat din `.memlog.md`), nu de mână.

Arhitectura e decisă în **`_bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md`** (regulile AD-1…AD-19): Electron + TypeScript + React (Electron Forge, template Vite), nucleu hexagonal în `src/core`, SQLite prin `node:sqlite`, Zod pentru schema lotului, Vitest pentru teste. Orice cod respectă regulile AD; o abatere se discută și se trece întâi în arhitectură, prin `bmad-architecture`.

## Comenzi

Cer Node ≥ 24 (`node:sqlite`, `--env-file-if-exists`). Prima dată: `npm ci`.

| Comandă | Ce face |
|---|---|
| `npm start` | pornește fereastra în mod dezvoltare (Vite cu hot reload, DevTools deschise) |
| `npm test` | rulează testele Vitest (`src/**/*.test.ts`, `tests/**/*.test.ts`); un singur fișier: `npx vitest run src/cli/main.test.ts` |
| `npm run lint` | oxlint (inclusiv granițele hexagonului, AD-2) + `oxfmt --check`; `npm run lint:fix` repară și formatează |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build:cli` | compilează CLI-ul în `dist/cli/whenkit.mjs` (config separat: `vite.cli.config.mts`) |
| `npm run cli:dev -- <argumente>` | rulează CLI-ul compilat cu `.env` încărcat (workspace-ul de dezvoltare) |
| `npm run make` | construiește installer-ul Windows (Squirrel) în `out/` |

- **CLI-ul global:** o singură dată, `npm run build:cli` apoi `npm link`; de atunci `whenkit` merge din orice terminal nou și folosește mereu ultimul `npm run build:cli`. `whenkit` legat global **nu** încarcă `.env` (e pentru workspace-ul real, cu codul de pe `main`); în dezvoltare folosește `npm run cli:dev`.
- **Fereastra se pornește doar cu `npm start`.** Terminalul din VS Code are `ELECTRON_RUN_AS_NODE=1`, cu care `electron .` rulează ca Node simplu, fără fereastră; `electron-forge start` șterge variabila.
- **Workspace de dezvoltare:** copiază `.env.example` în `.env` și pune în `WHENKIT_WORKSPACE` un folder **în afara repo-ului**, diferit de workspace-ul real (AD-8, AD-19). Testele nu ating niciodată workspace-ul real.
- `oxfmt` formatează doar codul: documentele (`*.md`, `_bmad*/`, `.claude/`) sunt excluse în `.oxfmtrc.json`, ca să nu fie rescrise.

## Structura proiectului

| Cale | Ce conține | În git? |
|---|---|---|
| `CLAUDE.md` | instrucțiunile de dezvoltare (acest fișier) | da |
| `_bmad-output/` | artefactele BMad: sursa de adevăr pentru ce construim | da |
| `_bmad-output/initiative-whenkit-mvp/` | inițiativa activă: tot ce ține de MVP (spec, apoi arhitectură și tichete) | da |
| `…/initiative-whenkit-mvp/spec-whenkit/` | spec-ul MVP-ului: `spec-whenkit.md` (kernel) + companioni + `.memlog.md` (jurnalul canonic) | da |
| `_bmad/config.toml` | configurația BMad a proiectului | da |
| `_bmad/custom/*.user.toml` | setări personale BMad, inclusiv inițiativa activă | nu |
| `_bmad/scripts/`, `_bmad/<modul>/scripts/` | generate de `bmad setup`; nu se editează de mână | da |
| `.claude/skills/` | skill-urile BMad folosite la dezvoltare (sursa în `skills-lock.json`) | da |
| `.tmp/` | fișiere de lucru ale sesiunilor (ex. `.tmp/grill-me/whenkit-mvp.md`: interviul de produs din care s-a făcut spec-ul) | nu |
| `…/initiative-whenkit-mvp/architecture-whenkit/` | arhitectura: `architecture-whenkit.md` (regulile AD) + `.memlog.md` + `reviews/` | da |
| `…/initiative-whenkit-mvp/tickets.toml`, `epic-*/` | epicurile și tichetele (`tickets.toml` în fiecare epic = planul de povești, în ordinea de construire) | da |
| `.env` | setări locale de dezvoltare (ex. `WHENKIT_WORKSPACE` pentru teste); model în `.env.example` | nu |
| `src/core/` | nucleul hexagonal: logica, schemele, porturile; nu importă Electron, React, `node:*` sau alte straturi (impus de oxlint) | da |
| `src/adapters/` | implementările porturilor (SQLite, HTTP, GitHub, fișiere, mediu); `http/` verifică linkuri pe `node:http`/`node:https`, cu DNS injectabil | da |
| `tests/fixtures/` | date de test sintetice (ex. certificatul self-signed din `tls/`, doar pentru teste) | da |
| `src/adapters/sqlite/migrations/` | migrările SQL numerotate (`NNNN-nume.sql`), **append-only**: o migrare ajunsă pe `main` nu se mai editează (hash-ul ei e verificat la deschidere), se adaugă una nouă | da |
| `src/cli/` | CLI-ul `whenkit`: `main.ts` (alege comanda; testabil), `commands/` (o comandă pe fișier), `render.ts` (ieșirea text), `exit-codes.ts` (singurul tabel `ErrorCode → cod de ieșire`), `bin.ts` (intrarea procesului; singurul loc care leagă adaptoarele reale) | da |
| `src/desktop/main/`, `preload/`, `renderer/` | procesul main Electron, puntea IPC, interfața React | da |
| `src/shared/` | `strings.ro.ts` (toate textele românești), mai târziu `ipc.ts` | da |
| `workspace-template/` | **șablonul workspace-ului** (CLAUDE.md de runtime, skill-urile `/importa` și `/gaseste`, regulile de scriere a fișelor, `data/blocked-domains.txt` inițial), instalat cu `whenkit init`; fișierele utilizatorului (`data/**`) se creează doar dacă lipsesc | da |
| `src/core/verification/` | verificarea deterministă (AD-7): sintaxa URL, tabelul HTTP cu reîncercări, domeniile interzise, sursele conceptelor; motivele sunt coduri (AD-15) | da |
| `tests/` | fixture-uri sintetice și teste de integrare | da |
| `dist/cli/`, `.vite/`, `out/` | ieșiri de build (CLI, Forge, installer) | nu |
| `.gitattributes` | forțează terminațiile LF (`oxfmt` le cere; `core.autocrlf` le-ar face CRLF pe Windows) | da |

Workspace-ul aplicației (implicit `C:\Users\Luca\Programe\whenkit\`; calea o salvează `whenkit init` în `%APPDATA%\whenkit\config.json`) **nu** face parte din repo: conține `input/`, `data/` și skill-urile instalate. Stă în afara repo-ului pentru că Claude Code încarcă CLAUDE.md și din folderele părinte, iar contextul de dezvoltare nu trebuie să ajungă în sesiunile de import.

## Produsul, pe scurt

**whenkit**: aplicație **desktop** personală (Windows 11), în română, care catalogează resurse pentru developeri în două zone: **Toolbox** (unelte pe care le folosești) și **Learn** (materiale și concepte pe care le studiezi). Diferențiatorul este căutarea **după problemă**, prin câmpul „Când o folosesc”.

Decizii care trebuie respectate de orice arhitectură (detalii în spec, secțiunea Constraints):

- **Claude Code e „creierul”, aplicația e catalogul.** Importul, documentarea și căutarea în limbaj natural se fac prin skill-urile din workspace. Aplicația nu conține AI și nu folosește chei API în v1 (fără `AIProvider`, fără embeddings).
- În catalog se scrie **doar prin aplicație**: CLI `whenkit import` (folosit de Claude Code) și UI. Claude Code nu scrie direct în date.
- **Verificarea** e un modul separat, determinist și testabil (URL, link care răspunde, domenii interzise, duplicate), completat de judecata lui Claude pentru conținut dubios. În caz de dubiu, resursa se respinge cu motiv.
- Datele sunt separate de cod, în workspace, într-un format portabil.
- „Personal-first, multi-user ready”: `owner_id` în model de la început; calea workspace-ului în configurarea utilizatorului (AD-8), nimic hardcodat. **Nu** se construiesc acum: autentificare, conturi, hosting, plăți.
- **Limba:** codul e integral în engleză (identificatori, comentarii, mesaje de commit). În română sunt interfața, fișele din catalog și documentele citite de autor (README, documentație, artefacte BMad); documentele se traduc în engleză la trecerea open-source. Cod și README scrise ca pentru un proiect public.

Datele de test reale (screenshot-uri și `inspire.txt`) sunt în `C:\Users\Luca\Personal\`, în afara repo-ului. Sunt input pentru `/importa` și nu se transcriu manual. Rezultatele așteptate sunt în companionul `test-scenarios.md` al spec-ului.

## Cum vrea autorul să lucrăm

Proiectul e și pentru învățare: explică raționamentul, nu doar codul. La deciziile importante dă 2–3 opțiuni cu pro și contra și contrazice-l direct când greșește. Planificarea tehnică (spec, arhitectură, tichete) și implementarea se fac prin skill-urile BMad, nu printr-un plan separat în plan mode, ca să nu planificăm de două ori. Ordinea pașilor o alege autorul; dacă nu e clar ce urmează, întreabă skill-ul `bmad`. Se lucrează pas cu pas.

## Flux de lucru cu git

- **Documente de planificare** (spec, arhitectură, CLAUDE.md): commit direct pe `main`.
- **Cod**: o ramură per tichet (`feat/<nume-scurt>`, `fix/<nume-scurt>`), revizie cu `bmad-code-review` pe ramură, apoi merge în `main` și ștergerea ramurii.
- **Fără `push`** pe GitHub (`origin` = `Lwcka/whenkit`) până nu cere autorul explicit; deocamdată totul rămâne local.
- Autorul învață acest flux: explică pe scurt fiecare pas de git (ce face și de ce) când îl execuți.

## BMad Method

Workflow-ul de planificare și implementare folosește skill-urile BMad instalate la nivel de proiect în `.claude/skills/` (sursa și hash-urile sunt în `skills-lock.json`). `bmod-core-tools` și `bmod-method` sunt doar metadate de modul și nu se invocă niciodată. Pentru a afla ce skill urmează, folosește skill-ul `bmad`, care răspunde din help-ul modulelor instalate.

- `_bmad/config.toml`: configurația proiectului. Artefactele BMad (spec-uri, arhitectură, tichete) se scriu în `_bmad-output/`, în folderul inițiativei active.
- Inițiativa activă e setată în `_bmad/custom/config.user.toml` (`active_initiative`); se schimbă prin skill-ul `bmad`.
- `_bmad/scripts/` și `_bmad/<modul>/scripts/` sunt generate de setup. Nu le edita de mână; se regenerează cu `bmad setup`.

Toate scripturile BMad cer `uv`. Verificarea instalării:

```
uv run --no-cache .claude/skills/bmad/scripts/setup.py --project-root . --skill .claude/skills/bmad --root .claude/skills --status
```

Actualizarea skill-urilor: `npx skills update -p -y`. Adăugarea unui skill: `npx skills add bmad-code-org/BMAD-METHOD --skill <nume> -a claude-code -y`, apoi rulează din nou `bmad setup`.
