# WhenKit

**Un catalog personal de resurse pentru developeri, în care cauți după problemă, nu după nume.**

Salvezi zeci de linkuri, screenshot-uri cu liste de unelte și notițe despre concepte, iar când chiar ai nevoie de ceva nu-ți mai amintești cum se numea. WhenKit le transformă într-un catalog verificat, în română, în care fiecare fișă spune **„Când o folosesc”**: cauți „scot fundalul dintr-o poză” și găsești remove.bg, chiar dacă n-ai mai auzit de el de luni de zile.

- **Aplicație desktop** pentru Windows 11, în română, cu două zone: **Toolbox** (unelte pe care le folosești) și **Learn** (materiale și concepte pe care le studiezi).
- **Claude Code e „creierul”**: el citește ce îi dai (un link, un text, un screenshot), documentează resursa și scrie fișa. Aplicația nu conține AI și nu folosește chei API.
- **Aplicația e catalogul**: verifică fiecare resursă (linkul merge? domeniu interzis? duplicat?), o salvează și ți-o arată.

> **Stadiu:** MVP (v0.1.0), terminat pe 2026-10-22. E un proiect personal, open-source, testat pe un singur laptop. Merge, dar încă nu e șlefuit pentru oricine. Bug-urile și ideile sunt binevenite în [Issues](../../issues).

*English: WhenKit is a Windows desktop catalog of developer resources that you search by problem ("when do I use it?"), filled and searched through Claude Code. The app and docs are in Romanian for now; an English version is on the [roadmap](_bmad-output/initiative-whenkit-mvp/spec-whenkit/post-v1-roadmap.md).*

---

## Cuprins

1. [Cum funcționează](#cum-funcționează)
2. [Ce ai nevoie](#ce-ai-nevoie)
3. [Instalare, pas cu pas](#instalare-pas-cu-pas)
4. [Primii pași](#primii-pași)
5. [Adăugarea resurselor: `/adauga`](#adăugarea-resurselor-adauga)
6. [Căutarea prin Claude: `/gaseste`](#căutarea-prin-claude-gaseste)
7. [Aplicația desktop](#aplicația-desktop)
8. [Verificarea resurselor](#verificarea-resurselor)
9. [Fișele: ce conțin](#fișele-ce-conțin)
10. [Workspace-ul și datele tale](#workspace-ul-și-datele-tale)
11. [CLI-ul `whenkit`](#cli-ul-whenkit)
12. [Actualizare și dezinstalare](#actualizare-și-dezinstalare)
13. [Probleme frecvente](#probleme-frecvente)
14. [Ce nu face (încă)](#ce-nu-face-încă)
15. [Pentru dezvoltatori](#pentru-dezvoltatori)
16. [Licență](#licență)

---

## Cum funcționează

```
   tu                    Claude Code                     WhenKit
   ──                    ───────────                     ───────
 un link,          ──►  /adauga: citește,      ──►  whenkit import:        ──►  catalogul
 un text,               documentează și             verifică linkurile,         (SQLite, în
 un screenshot          scrie un lot JSON           domeniile, duplicatele      workspace-ul tău)
                                                    și salvează                     │
                                                                                    ▼
 „ce folosesc     ◄──   /gaseste: caută în    ◄──   whenkit list / show    ◄──  fereastra WhenKit
  pentru X?”            catalog după problemă                                   se actualizează
                                                                                singură, live
```

Sunt trei piese care lucrează împreună:

| Piesă | Ce e | Ce face |
|---|---|---|
| **Aplicația WhenKit** | fereastra desktop (Electron) | răsfoiești, cauți, citești, corectezi, ștergi, exporți |
| **CLI-ul `whenkit`** | comandă în terminal | singura cale prin care Claude citește și scrie în catalog; tot ea creează workspace-ul |
| **Workspace-ul** | un folder al tău (de ex. `C:\Users\<tu>\whenkit`) | ține catalogul, materialele de importat și cele două skill-uri pentru Claude Code: `/adauga` și `/gaseste` |

Claude **nu scrie niciodată direct** în baza de date: scrie un lot JSON, iar `whenkit import` îl validează și îl verifică. Așa, verificarea nu poate fi ocolită pe tăcute.

---

## Ce ai nevoie

| Ce | De ce | Unde |
|---|---|---|
| **Windows 11** | aplicația e doar pentru Windows (installer Squirrel) | — |
| **Git** | ca să clonezi repo-ul (pentru CLI) | [git-scm.com](https://git-scm.com/) |
| **Node.js 24 sau mai nou** | CLI-ul folosește `node:sqlite`, care există doar de la Node 24 | [nodejs.org](https://nodejs.org/) |
| **Claude Code**, cu cont | rulează skill-urile `/adauga` și `/gaseste` | [claude.com/claude-code](https://claude.com/claude-code) |
| **Internet** | la import, linkurile se verifică live | — |

Verifică versiunea de Node într-un terminal nou:

```powershell
node --version   # trebuie să fie v24.x sau mai mare
```

---

## Instalare, pas cu pas

Sunt patru pași: aplicația, CLI-ul, workspace-ul, apoi o verificare. Comenzile de mai jos sunt pentru **PowerShell** (sau terminalul din VS Code).

### 1. Instalează aplicația desktop

**Varianta rapidă (recomandată): din Release.**

1. Deschide pagina [Releases](../../releases) a repo-ului și descarcă `WhenKit-0.1.0.Setup.exe` din ultima versiune.
2. Rulează-l. Nu are asistent de instalare: se instalează singur în `%LOCALAPPDATA%\WhenKit` și pornește aplicația. De acum o găsești în meniul Start, ca **WhenKit**.
3. **Windows SmartScreen** va spune probabil „Windows a protejat computerul”, pentru că installer-ul nu e semnat digital (un certificat costă bani, iar acesta e un proiect personal). Apasă **„Mai multe informații” → „Rulează oricum”**.

La prima pornire, fereastra îți spune că workspace-ul nu e configurat. E normal: îl creezi la pasul 3.

**Varianta din sursă** (dacă vrei să construiești tu installer-ul): după pasul 2, rulează în folderul repo-ului `npm run make`. Installer-ul apare în `out\make\squirrel.windows\x64\WhenKit-0.1.0 Setup.exe`; îl rulezi la fel.

### 2. Instalează CLI-ul `whenkit`

CLI-ul nu vine cu installer-ul: îl construiești din repo, o singură dată.

```powershell
git clone https://github.com/Lwcka/whenkit.git
cd whenkit
npm ci              # instalează dependențele (exact versiunile din package-lock.json)
npm run build:cli   # compilează CLI-ul în dist/cli/whenkit.mjs
npm link            # face comanda `whenkit` disponibilă global
```

Deschide un **terminal nou** și verifică:

```powershell
whenkit --help
```

> Ține folderul clonat: `whenkit` legat global rulează mereu din `dist/cli/` al lui. Dacă îl muți sau îl ștergi, comanda nu mai merge.

### 3. Creează workspace-ul

**Workspace-ul** e folderul tău de lucru: în el stă catalogul, acolo pui materialele de adăugat și acolo deschizi Claude Code. Îl alegi tu, o singură dată. Poate fi orice folder **în afara repo-ului clonat** (aplicația refuză altfel), de exemplu `C:\Users\<tu>\whenkit`. Rulează:

```powershell
whenkit init C:\Users\<tu>\whenkit
```

Sau, dacă ești deja în folderul ales, `.` înseamnă „folderul curent”:

```powershell
cd C:\Users\<tu>\whenkit
whenkit init .
```

> `whenkit init` fără cale nu creează nimic la prima instalare: răspunde că workspace-ul nu e configurat. Fără cale, comanda doar actualizează un workspace care există deja.

Asta:

- creează folderul cu `input\`, `batches\`, `data\` și catalogul gol (`data\catalog.sqlite`, cu categoriile de start);
- instalează `CLAUDE.md`-ul de lucru și skill-urile `/adauga` și `/gaseste` pentru Claude Code;
- salvează calea în `%APPDATA%\whenkit\config.json`, ca aplicația și CLI-ul să știe unde e catalogul.

### 4. Verifică

```powershell
whenkit categories   # arată categoriile Toolbox și Learn
whenkit list         # „Catalogul e gol.”
```

Repornește aplicația WhenKit: acum arată catalogul gol, cu calea workspace-ului în bara de jos.

---

## Primii pași

1. **Deschide Claude Code în workspace** (important: în workspace, nu în repo):

   ```powershell
   cd C:\Users\<tu>\whenkit
   claude
   ```

2. **Adaugă prima resursă:**

   ```
   /adauga https://www.remove.bg
   ```

   Claude deschide pagina, scrie fișa în română (ce face, când o folosești, cuvinte-cheie), alege categoria și o importă. La final îți dă raportul: ce a intrat, ce a fost respins și de ce.

3. **Uită-te în aplicație:** fișa apare singură în câteva secunde, fără repornire, cu o bandă deasupra cardului care arată de când a sosit („acum 3 s”).

4. **Caută după problemă:** în aplicație, Ctrl+K și scrii „fundal”. Sau, în Claude Code:

   ```
   /gaseste vreau să scot fundalul dintr-o poză
   ```

---

## Adăugarea resurselor: `/adauga`

`/adauga` acceptă patru forme:

| Ce scrii | Ce face |
|---|---|
| `/adauga` | ia pe rând **fiecare fișier din `input\`**: screenshot-uri (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`) și fișiere text (`.txt`, `.md`) cu linkuri sau nume de resurse |
| `/adauga https://…` | adaugă **un singur link** |
| `/adauga <orice text>` | scoate linkurile și numele de resurse din text, ca dintr-un fișier `.txt` |
| `/adauga respinse` | reia resursele din **jurnalul de respinse** (de ex. după ce un site căzut și-a revenit) |

Cum lucrează, pe scurt:

1. Verifică întâi că folderul în care e deschis e chiar workspace-ul configurat; altfel se oprește.
2. Pentru fiecare resursă, citește pagina (sau GitHub-ul) și scrie fișa după regulile din `.claude\skills\reguli-fise.md`: în română, cu 3–6 situații „Când o folosesc”, cuvinte-cheie în română și engleză.
3. Scrie un **lot** JSON în `batches\` (un lot per fișier de input) și rulează `whenkit import`.
4. Doar după un import reușit șterge lotul și fișierul din `input\`. Un import eșuat nu lasă nimic pe jumătate scris.

Bune de știut:

- **Un screenshot cu o listă** (de ex. „20 de site-uri utile”) devine 20 de fișe dintr-o singură rulare.
- **Conținutul dubios** (piraterie, ocolirea paywall-urilor) e respins de Claude, cu motivul scris în raport.
- **Duplicatele** sunt ignorate, cu mesajul „există deja: <nume>”.
- **„Notițele mele”** nu sunt atinse niciodată de import.
- Poți cere și lucruri libere, de ex. „rescrie fișa remove.bg după regulile noi”. Claude o face tot printr-un lot de tip `update`.

---

## Căutarea prin Claude: `/gaseste`

`/gaseste <problema ta, în cuvintele tale>` caută în catalog după ce vrei să faci, nu după nume:

```
/gaseste am nevoie de date publice gratuite pentru un proiect
/gaseste cum aleg între REST și GraphQL
```

Claude citește catalogul (doar citește: `whenkit list --json` și `whenkit show --json`) și îți recomandă fișele potrivite, cu motivul. Dacă nu găsește nimic, îți spune simplu și nu inventează resurse; îți poate sugera să adaugi una cu `/adauga`.

---

## Aplicația desktop

### Ecranul principal

- **Bara de titlu**: numele aplicației și comutatorul zi/noapte (tema se păstrează după repornire).
- **Toolbox / Learn**: cele două zone, fiecare cu numărul de fișe.
- **Căutarea**: filtrează live în zona curentă, în tot textul fișelor. Fiecare cuvânt scris contează ca început de cuvânt („fund” găsește „fundal”), iar o fișă apare doar dacă le conține pe toate.
- **Bara de categorii**: „Toate” plus categoriile zonei; rotița mouse-ului o derulează orizontal.
- **Grila de carduri**: numele, ce face, gazda linkului și tipul (site / repo / aplicație); în Learn și felul (material / concept). Un concept cu alte concepte legate sub el e o **colecție** („colecție · 5 concepte”).
- **Bara de jos**: câte fișe ai, ultima adăugată și calea workspace-ului.

Aplicația pornește mereu pe **Toolbox → Toate** și își amintește poziția, dimensiunea, starea maximizată, tema și zoomul.

### Fișa

Click pe un card (sau Enter) deschide fișa:

- „Ce face”, **„Când o folosesc”** (la concepte „Când îl aleg”), cuvinte-cheie, surse;
- la concepte, conținutul în Markdown, cu tabele;
- **Resurse înrudite**, și la colecții conceptele ei: un click te duce la fișa respectivă, iar „Înapoi” te readuce exact unde erai;
- **„Deschide în browser”**: linkurile se deschid mereu în browserul tău, niciodată în fereastra aplicației;
- datele GitHub (stele, ultimul push) la repo-uri, și notele de verificare, dacă există;
- **„Notițele mele”**: scrii direct, fără buton de salvare. Se salvează singure după o scurtă pauză, iar niciun import nu le suprascrie.

### Editare, ștergere, categorii, export

- **Editează** (E): schimbi orice câmp scris de Claude. Dacă schimbi linkul sau sursele, ele trec prin aceeași verificare ca la import. Salvezi cu Ctrl+S, renunți cu Esc. Dacă între timp Claude a actualizat fișa din terminal, aplicația îți spune și nu suprascrie pe nimeni pe tăcute.
- **Șterge** (Delete): cere confirmare; fișa dispare împreună cu legăturile ei.
- **Gestionează categoriile**: redenumești, unifici două categorii (fișele se mută) sau ștergi una. Categoriile noi apar doar prin import.
- **Exportă catalogul**: alegi un folder și primești `whenkit-export-<data>\` cu `catalog.json` (totul, cu toate câmpurile) și `fise\*.md` (o fișă Markdown pe resursă, cu legături `[[…]]`). Folderul se deschide direct ca vault în **Obsidian**.

### Scurtături

Totul merge și cu mouse-ul; tastatura e doar o scurtătură.

| Tastă | Ce face | Unde |
|---|---|---|
| Ctrl+K / Ctrl+F | focus în căutare | oriunde |
| Ctrl+1 / Ctrl+2 | Toolbox / Learn | oriunde, în afara editării |
| [ / ] | categoria anterioară / următoare | listă |
| ← ↑ → ↓ | mută selecția în grilă | listă |
| Enter | deschide cardul selectat | listă |
| Alt+← / butonul „înapoi” al mouse-ului | înapoi | fișă |
| E | editează | fișă |
| Ctrl+S | salvează editarea | fișă în editare |
| Delete | șterge (cu confirmare) | fișă |
| Esc | închide dialogul / renunță la editare / golește căutarea / înapoi | după context |
| Ctrl+= / Ctrl+− / Ctrl+0 | zoom 80–200 %, se păstrează la repornire | oriunde |

Scurtăturile merg și pe tastatura română (se leagă de tasta fizică, nu de caracter). Animațiile urmează setarea Windows „Animation effects”: dacă o oprești, aplicația nu mai animă nimic.

---

## Verificarea resurselor

Regula de bază: **în caz de dubiu, resursa nu intră, iar tu primești motivul.** O resursă lipsă e mai bună decât una periculoasă. Verificarea e în cod, deterministă, nu la Claude: un model AI poate repara tacit un link greșit sau poate „documenta” din memorie un site care nu mai există.

| Situație | Rezultat |
|---|---|
| Linkul merge (2xx, 3xx după redirect) | ✅ intră |
| Site-ul blochează programele (401, 403, 429) | ✅ intră, cu nota „blochează accesul automat” |
| Site căzut temporar (5xx, timeout 10 s) | 2 reîncercări, apoi ⚠️ intră cu avertizare |
| URL invalid, 404/410, domeniu inexistent, certificat SSL invalid, conexiune refuzată | ❌ respinsă |
| Domeniu din lista de domenii interzise | ❌ respinsă |
| Duplicat (în catalog sau în același lot) | ⚠️ ignorată, „există deja: <nume>” |
| Conținut dubios (piraterie, ocolirea paywall-urilor) | ❌ respinsă de Claude, cu motiv |
| Repo GitHub abandonat (ultimul push mai vechi de 24 de luni) | ✅ intră, cu notă |
| Fără internet | ⏸️ importul se oprește; nu se scrie nimic, nu se respinge nimic |

- **Jurnalul de respinse** păstrează fiecare resursă respinsă, cu motivul și data. Îl vezi cu `whenkit rejections` și îl reiei cu `/adauga respinse`.
- **Domeniile interzise** sunt în `data\blocked-domains.txt`, un domeniu pe linie (`pdfdrive.com`, sau `libgen.*` pentru toate variantele). Fișierul e al tău: îl editezi cum vrei. Lista de start: `libgen.*`, `sci-hub.*`, `z-lib.*`, `pdfdrive.com`, `12ft.io`.
- **`--force`** adaugă totuși o resursă respinsă la verificare, marcată „verificare ocolită de utilizator”. Claude îl folosește doar dacă i-o ceri explicit. Nu ocolește schema, categoriile necunoscute sau duplicatele.

---

## Fișele: ce conțin

| Fel | Zonă | Ce este | Link |
|---|---|---|---|
| **unealtă** | Toolbox | ce folosești ca să **faci** ceva (remove.bg, ComfyUI) | obligatoriu |
| **material** | Learn | ce citești ca să **înțelegi** ceva (system-design-primer, roadmaps) | obligatoriu |
| **concept** | Learn | o notiță de cunoștințe (REST, RPC); poate fi o **colecție** de alte concepte („Tipuri de API”) | opțional |

Fiecare fișă are: nume, 1–2 categorii, „Ce face” (2–3 propoziții), **„Când o folosesc”** (3–6 situații), cuvinte-cheie în română și engleză, resurse înrudite și „Notițele mele”. Conceptele au în plus conținut Markdown și surse.

**Categoriile de start:**

- **Toolbox:** Imagini & video · Mockup-uri & capturi de cod · Design & UI · AI & LLM · Claude Code & agenți · Securitate · Date & API-uri · Descoperire & arhive · Terminal & dev tools
- **Learn:** Roadmaps & cariere · Interviuri · Cărți & cursuri gratuite · Construiești ca să înveți · Backend & API-uri · Limbaje · Securitate

---

## Workspace-ul și datele tale

```
C:\Users\<tu>\whenkit\
├── CLAUDE.md                  instrucțiunile pentru Claude Code (gestionat de aplicație)
├── batch.schema.json          schema lotului de import (gestionat)
├── .whenkit-template.json     versiunea șablonului (gestionat)
├── .claude\skills\
│   ├── adauga\                skill-ul /adauga (gestionat)
│   ├── gaseste\               skill-ul /gaseste (gestionat)
│   └── reguli-fise.md         regulile de scriere a fișelor (gestionat)
├── input\                     ce vrei să adaugi: screenshot-uri, .txt (al tău)
├── batches\                   loturile scrise de Claude, temporare
└── data\                      (al tău, nu îl edita de mână)
    ├── catalog.sqlite         catalogul
    ├── blocked-domains.txt    domeniile interzise (îl poți edita)
    └── backups\               copii automate ale catalogului
```

- Fișierele **gestionate** sunt rescrise la fiecare `whenkit init`. Fișierele **tale** (`data\`, `input\`) sunt create doar dacă lipsesc și nu sunt niciodată șterse.
- Înainte de orice actualizare a structurii bazei de date (o versiune nouă a aplicației), catalogul se copiază în `data\backups\`.
- **Unde stă restul:**

  | Ce | Unde |
  |---|---|
  | calea workspace-ului | `%APPDATA%\whenkit\config.json` |
  | preferințele ferestrei (temă, poziție, zoom) | `%APPDATA%\whenkit\desktop\window-state.json` |
  | aplicația instalată | `%LOCALAPPDATA%\WhenKit` |

- **Copie de siguranță:** copiază folderul workspace-ului, sau folosește „Exportă catalogul” pentru o variantă lizibilă fără aplicație (JSON + Markdown).

---

## CLI-ul `whenkit`

De obicei îl folosește Claude, dar îl poți rula și tu. Cu `--json`, fiecare comandă scrie pe stdout un singur document JSON; fără el, text pentru oameni.

| Comandă | Ce face |
|---|---|
| `whenkit init [cale]` | creează sau actualizează workspace-ul; fără cale, actualizează workspace-ul configurat |
| `whenkit import <lot> [--json] [--force <ref>]…` | validează lotul, verifică linkurile, adaugă sau actualizează fișele |
| `whenkit list [--json]` | toate fișele |
| `whenkit show <id> [--json]` | o fișă completă |
| `whenkit categories [--json]` | categoriile fiecărei zone |
| `whenkit rejections [--json]` | jurnalul de respinse |
| `whenkit rejections --remove <id> [--json]` | șterge un rând din jurnal |
| `whenkit schema` | schema JSON a lotului |
| `whenkit --help` | ajutorul |

**Coduri de ieșire:** `0` succes (și un lot cu respinse; ele sunt în raport) · `1` intrare invalidă (argumente, lot care nu respectă schema, id necunoscut) · `2` configurare (workspace neconfigurat sau invalid) · `3` indisponibil (bază de date blocată, fără internet) · `4` eroare internă. La orice cod diferit de 0, **nu s-a scris nimic** în catalog.

---

## Actualizare și dezinstalare

**Când apare o versiune nouă:**

```powershell
cd <folderul clonat>\whenkit
git pull
npm ci
npm run build:cli
whenkit init        # aduce workspace-ul la noul șablon (skill-uri, reguli)
```

Pentru aplicație: închide WhenKit, **dezinstalează versiunea veche** (Setări → Aplicații → Aplicații instalate → WhenKit → Dezinstalare), apoi rulează noul `Setup.exe`. Dezinstalarea șterge doar programul: catalogul, preferințele și workspace-ul rămân.

Dacă vreo comandă `whenkit` avertizează că fișierele workspace-ului sunt mai vechi decât aplicația, rulează `whenkit init`.

**Dezinstalare completă:** dezinstalează WhenKit din Setări, rulează `npm unlink -g whenkit`, apoi șterge, dacă vrei, workspace-ul și `%APPDATA%\whenkit`.

---

## Probleme frecvente

| Simptom | Cauza și ce faci |
|---|---|
| SmartScreen: „Windows a protejat computerul” | installer-ul nu e semnat. „Mai multe informații” → „Rulează oricum”. |
| Fereastra spune „Nu găsesc workspace-ul.” sau `whenkit` spune „Workspace-ul … nu e configurat încă” | n-ai rulat încă `whenkit init <cale>` (sau `whenkit init .` din folderul ales); rulează-l, apoi repornește aplicația. |
| `whenkit` nu e recunoscut | deschide un terminal **nou** după `npm link`; verifică `node --version` (≥ 24). |
| Eroare despre `node:sqlite` | Node e mai vechi de 24; actualizează-l. |
| `/adauga` nu apare în Claude Code | Claude Code trebuie deschis **în folderul workspace-ului**, nu în repo. Într-o sesiune deja deschisă înainte de `whenkit init`, pornește una nouă. |
| `/adauga` se oprește, „workspace diferit” | ai deschis Claude Code în alt folder decât cel din `config.json`. Deschide-l în workspace-ul configurat. |
| „Baza de date e ocupată” | aplicația și un import scriu în același timp; reîncearcă după câteva secunde. |
| Importul se oprește „fără internet” | verificarea are nevoie de rețea; nu s-a scris nimic, reia după ce revine conexiunea. |
| Avertisment „șablon mai vechi” | rulează `whenkit init`. |

---

## Ce nu face (încă)

Lucruri lăsate intenționat în afara MVP-ului:

- nu are formular de adăugare în aplicație: adăugarea trece prin `/adauga`;
- nu are AI în aplicație (căutare semantică, embeddings);
- nu re-verifică automat resursele vechi și nu are ecran de setări;
- nu are conturi, sincronizare sau versiune web / mobil: totul e local, pe calculatorul tău;
- interfața e doar în română.

Ideile pentru după v1 sunt în [`post-v1-roadmap.md`](_bmad-output/initiative-whenkit-mvp/spec-whenkit/post-v1-roadmap.md).

---

## Pentru dezvoltatori

### Stack

Electron + TypeScript + React (Electron Forge, template Vite) · SQLite prin `node:sqlite` (cu FTS5 pentru căutare) · Zod pentru schema lotului · Vitest + Testing Library pentru teste · oxlint + oxfmt.

### Comenzi

| Comandă | Ce face |
|---|---|
| `npm ci` | instalează dependențele |
| `npm start` | fereastra în mod dezvoltare (hot reload, DevTools) |
| `npm test` | toate testele (Vitest); un singur fișier: `npx vitest run <cale>` |
| `npm run lint` / `npm run lint:fix` | oxlint (inclusiv granițele arhitecturii) + formatare |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build:cli` | compilează CLI-ul în `dist/cli/whenkit.mjs` |
| `npm run cli:dev -- <argumente>` | rulează CLI-ul cu `.env` încărcat (workspace de dezvoltare) |
| `npm run make` | construiește installer-ul în `out/` |

- **Workspace de dezvoltare:** copiază `.env.example` în `.env` și pune în `WHENKIT_WORKSPACE` un folder în afara repo-ului, **diferit** de workspace-ul tău real. `npm start` și `npm run cli:dev` îl folosesc pe acela; testele nu ating niciodată workspace-ul real.
- **Terminalul din VS Code** are `ELECTRON_RUN_AS_NODE=1`, cu care `electron .` rulează fără fereastră. Pornește fereastra doar cu `npm start`.

### Arhitectura, pe scurt

- **Nucleu hexagonal** în `src/core`: logica, schemele și porturile, fără Electron, React sau `node:*` (impus de oxlint). Adaptoarele (SQLite, HTTP, GitHub, fișiere) sunt în `src/adapters`.
- **Două intrări peste același nucleu:** CLI-ul (`src/cli`) și aplicația desktop (`src/desktop`: `main` / `preload` / `renderer`, cu IPC tipizat în `src/shared/ipc.ts`).
- **Verificarea** e un modul separat, determinist și testat izolat (`src/core/verification`).
- **Fereastra vede importurile live:** main-ul urmărește `data_version` al SQLite și anunță renderer-ul.
- **Toate textele românești** stau într-un singur fișier, `src/shared/strings.ro.ts`; codul e integral în engleză.
- **Migrările SQL** (`src/adapters/sqlite/migrations/`) sunt append-only: o migrare publicată nu se mai editează.

Deciziile de arhitectură (regulile AD-1…AD-20) sunt în [`architecture-whenkit.md`](_bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md).

### Structura repo-ului

| Cale | Ce conține |
|---|---|
| `src/core/` | nucleul: cazurile de utilizare, schemele, porturile, verificarea |
| `src/adapters/` | SQLite, HTTP, GitHub, sistemul de fișiere, mediul |
| `src/cli/` | CLI-ul `whenkit` |
| `src/desktop/` | aplicația Electron (main, preload, renderer React) |
| `src/shared/` | contractul IPC și textele în română |
| `workspace-template/` | ce copiază `whenkit init` în workspace: `CLAUDE.md`, skill-urile, regulile fișelor |
| `tests/` | teste de integrare și fixture-uri sintetice |
| `_bmad-output/` | documentele de produs: spec, UX, arhitectură, tichete și planurile lor |
| `CLAUDE.md` | instrucțiunile pentru Claude Code când **dezvoltă** aplicația |

### Cum a fost construit

Proiectul a fost planificat și construit cu [BMad Method](https://github.com/bmad-code-org/BMAD-METHOD) și Claude Code, tichet cu tichet: spec → UX → arhitectură → epicuri și tichete → implementare cu revizie de cod pe fiecare tichet. Totul e în `_bmad-output/initiative-whenkit-mvp/`:

| Document | Ce e |
|---|---|
| [`spec-whenkit.md`](_bmad-output/initiative-whenkit-mvp/spec-whenkit/spec-whenkit.md) | ce face produsul: capabilitățile CAP-1…CAP-13, constrângerile, ce nu face |
| [`ux-whenkit/`](_bmad-output/initiative-whenkit-mvp/ux-whenkit/) | `DESIGN.md` (cum arată), `EXPERIENCE.md` (cum se comportă), machete HTML |
| [`architecture-whenkit.md`](_bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md) | regulile de arhitectură AD-1…AD-20 |
| `epic-*/tickets.toml` și `*-plan.md` | tichetele, în ordinea construirii, cu planul și triajul reviziei fiecăruia |

Documentele sunt în română; traducerea lor în engleză e pe [roadmap](_bmad-output/initiative-whenkit-mvp/spec-whenkit/post-v1-roadmap.md).

### Contribuții

Proiectul e deschis: poți raporta un bug sau propune o idee în [Issues](../../issues), iar un pull request e binevenit. Înainte de cod, citește [`CLAUDE.md`](CLAUDE.md) (comenzile, structura, regulile de lucru) și regulile de arhitectură; `npm test`, `npm run lint` și `npm run typecheck` trebuie să treacă.

---

## Licență

[MIT](LICENSE) © 2026 Luca
