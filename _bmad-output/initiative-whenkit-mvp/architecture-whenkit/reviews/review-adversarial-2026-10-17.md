# Review adversarial — architecture-whenkit, delta 2026-10-17

Reviewer independent, fără acces la conversația care a produs delta. Ținta: AD-10 (extins), AD-16, AD-20 (nou), AD-19 (`productName`), văzute din poveștile epicului `epic-fereastra-whenkit` și din comportamentul din `ux-whenkit/EXPERIENCE.md`. Nu repet constatările din `review-adversarial.md` (2026-10-13).

**Metoda.** Pentru fiecare problemă construiesc două povești ale epicului (construite în sesiuni separate, pe ramuri separate) care respectă literal fiecare AD și totuși nu se potrivesc. Fiecare pereche e o gaură, închisă cu un AD înăsprit; textul regulii e dat gata de lipit. Am verificat ce există deja în cod: `src/core/dto.ts`, `src/core/ports.ts`, `src/adapters/sqlite/sqlite-catalog-store.ts`, `migrations/0001-initial.sql`, `src/desktop/**`.

**Verdict.** Delta are direcția bună (un singur depozit, revizia ca semnal, un singur proprietar al preferințelor), dar AD-10 descrie *clasificarea* („sosire” / „actualizare din terminal”) fără să fixeze *ce* conține depozitul, *ce* întorc scrierile proprii și *ce* înseamnă `revision`. Trei povești (notițe, editare, categorii) vor da răspunsuri diferite, iar combinațiile produc conflicte false pe propria editare, date rămase vechi și sosiri pierdute. Trebuie închise G1–G4 înainte de tăierea în povești; G5–G9 se pot închide la primul tichet care le atinge, dar e mai ieftin acum.

---

## HIGH

### G1 — `setNotes` și `revision`: trei citiri, toate conforme, toate incompatibile

AD-5 spune „`entries.revision` crește la **fiecare** scriere”; AD-16 spune că `setNotes` nu are `expectedRevision`; AD-10 spune că scrierile proprii trec în depozit „revizia întoarsă de IPC”. Nu spune nimeni dacă `setNotes` întoarce o revizie sau dacă o schimbă.

- **Povestea „Notițele mele” (autosave)** citește AD-5 literal: `setNotes` face `revision = revision + 1`. Întoarce `{ ok: true }` (AD-16 nu cere nimic altceva; nicio verificare de revizie nu o folosește).
- **Povestea „fișa în editare + conflict-banner”** captează `expectedRevision` la intrarea în editare (singura citire care respectă AD-16: altfel o actualizare din terminal venită în timpul editării ar fi suprascrisă tacit).
- **Ciocnirea 1 (conflict fals pe propria notiță):** EXPERIENCE spune că `my-notes` e editabil „mereu, fără mod de editare”, deci și cât fișa e în editare. Luca scrie o notiță → autosave → `revision` r → r+1. Apasă Ctrl+S → `entries:patch { expectedRevision: r }` → `CONFLICT` → banner „Fișa a fost modificată din terminal”. Nu a modificat-o nimeni.
- **Ciocnirea 2 (puls și banner fals):** `setNotes` nu întoarce revizia ⇒ depozitul nu o poate înregistra ⇒ `catalog:changed` (emis de main după propria scriere, AD-10) reîncarcă lista, vede r+1 > r ⇒ „actualizare din terminal”: puls pe card la fiecare pauză de tastare și `conflict-banner` dacă fișa e în editare.
- **Ciocnirea 3 (reparația greșită):** dacă povestea de editare, ca să evite ciocnirea 1, ia `expectedRevision` din depozit la momentul salvării, atunci un `update` din terminal sosit în timpul editării (deja în depozit) devine `expectedRevision` și salvarea îl suprascrie tacit — exact ce AD-16 trebuia să prevină.

**Închidere (AD-5 + AD-16 înăsprite):**

> `revision` numără doar schimbările câmpurilor scrise de Claude și ale categoriilor fișei: `update` din lot, `entries:patch`, unificarea și ștergerea unei categorii care o atinge. `entries:setNotes` **nu** schimbă `revision` (notițele se scriu doar din fereastră, care e un singur exemplar). `entries:patch` folosește `expectedRevision` captat la intrarea în editare și actualizat doar de „Reîncarcă fișa”.

Alternativa (o coloană `notes_revision` separată) e mai grea și nu aduce nimic: notițele nu au alt scriitor.

### G2 — „Compară după `id` și `revision`”: diff de date sau doar clasificare?

AD-10 spune „compară după `id` și `revision`”. Cuvântul „diff” invită o optimizare naturală: aplică în depozit doar fișele cu revizie nouă (identitate stabilă a obiectelor React, mai puține re-randări). Dar mai multe câmpuri din `EntryDto` se schimbă **fără** ca revizia fișei să crească:

- `categories[].name` la redenumirea unei categorii (scrie doar în `categories`);
- `relatedIds` / `parentIds` / `childIds` ale vecinilor la ștergerea unei fișe (cascade pe `links`) și la un `add` din lot care leagă o fișă existentă (`insertLink` nu atinge revizia vecinului);
- `myNotes`, dacă G1 se închide ca mai sus.

- **Povestea „depozitul catalogului + grila + banda”** aplică doar fișele cu revizie mai mare.
- **Povestea „category-manager”** redenumește prin `categories:rename`, iar main emite `catalog:changed`.
- **Ciocnire:** lista reîncărcată are numele nou, dar nicio revizie nu a crescut ⇒ depozitul păstrează numele vechi pe toate cardurile (Done when 2 cade: „redenumirea… actualizează toate fișele”). La fel, după Flow 4, vecinii fișei șterse trimit încă spre ea („Resurse înrudite” cu un id mort).
- **Variantă cu scrieri proprii:** povestea de editare întoarce din `entries:patch` doar `{ revision }` (AD-10 cere doar revizia). Depozitul înregistrează r+1 cu datele **vechi**; reîncărcarea vine tot cu r+1 ⇒ „neschimbată” ⇒ editarea nu apare până la repornire.
- **Cursă:** o reîncărcare pornită de un `catalog:changed` din CLI e calculată în main înainte de `entries:patch` (main e un singur fir), dar răspunsul ei ajunge după răspunsul patch-ului. Lista aduce r, depozitul știe r+1. AD-10 nu spune ce se face cu o revizie **mai mică**: o poveste o aplică (fișa sare înapoi la versiunea veche), alta o ignoră.

**Închidere (AD-10, paragraf nou):**

> Fiecare reîncărcare **înlocuiește** tot conținutul depozitului cu lista primită; `id` și `revision` servesc doar la clasificare (sosire, actualizare din terminal), nu la a decide ce se copiază. Excepție: o fișă a cărei revizie din listă e mai mică decât cea cunoscută își păstrează versiunea din depozit (răspuns vechi). Orice IPC de scriere întoarce DTO-urile complete ale fișelor pe care le-a schimbat (`EntryDto` sau `EntryDto[]`), iar depozitul le pune pe loc înainte de reîncărcarea următoare.

### G3 — Ce conține depozitul: o zonă sau ambele, cu sau fără `content`, cu sau fără categorii

AD-10 spune „reîncarcă `entries:list`”, fără parametri declarați și fără formă. Trei alegeri conforme, toate locale unei povești:

1. **Zona.** Povestea „grilă Toolbox/Learn” face `entries:list({ zone })` (natural: grila arată o zonă). Atunci (a) sosirile din cealaltă zonă nu se văd ⇒ fără toast „2 fișe noi în Learn” (Flow 2, pasul 3); (b) la comutarea zonei, prima încărcare a zonei noi e fie „linie de bază” (sosirile din ea se pierd), fie comparată cu un depozit gol (toate fișele ei devin „sosiri”: 40 de benzi și un toast fals). AD-10 spune „prima încărcare e linia de bază”, dar nu spune *a cui* (a procesului renderer? a zonei? a componentei montate?).
2. **`content`.** `CatalogReader.entrySummaries()` există deja și omite `content` (AD-11: `whenkit list --json` e fără `content`). Povestea grilei o refolosește. Povestea fișei are nevoie de `content` pentru concepte și adaugă `entries:get(id)` ⇒ fișa citește dintr-o a doua sursă, contrar AD-10 („fișa citește doar din depozit”), iar reîmprospătarea live a conținutului unui concept actualizat din terminal depinde de cine își amintește să refacă `entries:get`.
3. **Categoriile.** `category-bar` arată și categoriile cu 0 fișe, iar `category-picker` arată toate categoriile zonei; ambele cer lista de categorii, care **nu** e în `entries:list`. Povestea „bara de categorii” o citește o dată la pornire; povestea „category-manager” o citește la deschidere și la `catalog:changed` (EXPERIENCE: „Lista se actualizează live dacă un import creează categorii”). Un import care creează o categorie nouă o face vizibilă în dialog, dar nu pe bară; o redenumire din dialog nu ajunge în `category-picker`. Doi proprietari ai aceleiași liste.

Corelat: **căutarea** (FTS, ordinea relevanței) e un al patrulea drum dacă `entries:search` întoarce DTO-uri: cardurile rezultatelor nu se reîmprospătează live și nu pulsează.

**Închidere (AD-10, înăsprit):**

> Depozitul ține un **instantaneu al întregului catalog**: `catalog:snapshot` (sau `entries:list` + `categories:list`, cerute împreună) întoarce toate fișele ambelor zone ca `EntryDto` complet (cu `content`) și toate categoriile ambelor zone, fără parametri. Linia de bază e prima încărcare din viața procesului renderer; schimbarea zonei, a categoriei sau a căutării nu o resetează. Filtrarea pe zonă, categorie și căutare e o vedere peste depozit. `entries:search` întoarce doar id-uri în ordinea relevanței (plus numărul de potriviri din cealaltă zonă); cardurile se randează din depozit.

---

## MEDIUM

### G4 — Unificarea și ștergerea categoriilor: scriere pe mai multe fișe, cu formularul deschis

AD-5 nu spune dacă `categories:merge` / `categories:delete` cresc revizia fișelor mutate; AD-10 presupune că o scriere proprie are **o** revizie întoarsă.

- **Povestea „category-manager”, varianta A:** unificarea crește revizia celor 3 fișe mutate (respectă AD-5, „fiecare scriere”). IPC-ul întoarce `{ ok: true }`. Depozitul vede 3 revizii mai mari ⇒ 3 pulsuri „din terminal”; dacă una e în editare, banner fals.
- **Varianta B:** unificarea nu atinge revizia (scrie doar `entry_categories`). Fișa X e în editare cu categoria-sursă bifată în `category-picker`; butonul „Categorii” din `toolbar` e accesibil (EXPERIENCE: `toolbar` „rămâne la fel în listă și în fișă”; doar Ctrl+1/2 sunt oprite în editare). Luca unifică, revine, Ctrl+S ⇒ `expectedRevision` trece, patch-ul scrie `categories = [idȘters]` ⇒ eroare de cheie străină (`INTERNAL`, dialog de eroare) sau, dacă patch-ul filtrează id-urile necunoscute, fișa rămâne fără categorie (încalcă „1–2 categorii”).

**Închidere:**

> (AD-5) Unificarea și ștergerea cu țintă cresc `revision` pe fiecare fișă mutată și întorc DTO-urile lor (G2). `entries:patch` validează în `core` că fiecare categorie există și e din zona felului; altfel `CONFLICT`. (AD-10) Gestionarea categoriilor nu se poate deschide cât o fișă e în editare (butonul „Categorii” e inactiv).

### G5 — `CONFLICT` verificat înainte sau după verificarea linkului?

AD-16 spune „dacă `revision` diferă, `core` întoarce `CONFLICT`”, fără să spună *când*. Un `entries:patch` cu link nou rulează verificarea (HTTP, până la 3 încercări × 10 s).

- **Povestea „editare”**: citește fișa, compară revizia (respinge devreme, ca să nu verifice degeaba), verifică linkul, apoi `writeTransaction` → `updateEntry`, care crește revizia necondiționat (`ports.ts`).
- **Povestea `/importa`** (deja construită): în cele ~30 s, un `update` din CLI scrie fișa (r → r+1).
- **Ciocnire:** patch-ul scrie peste update fără `CONFLICT` — suprascrierea tacită pe care AD-16 o interzice.

**Închidere (AD-16):**

> Comparația de revizie se face **în** tranzacția de scriere, după verificare, ca compare-and-set (`UPDATE … WHERE id = ? AND revision = ?`, 0 rânduri ⇒ `CONFLICT`); o comparație devreme e permisă doar ca optimizare, nu înlocuiește verificarea din tranzacție. Aceleași trei faze ca la import (AD-6).

### G6 — Ce înseamnă „nou”: toast, bandă, `section-header` și `status-bar` numără mulțimi diferite

AD-10 spune că toast-ul, banda și contoarele „citesc doar din depozit”, dar nu definește mulțimea „fișe noi” și ciclul ei de viață.

- **Povestea „toast”** numără delta ultimei reîncărcări, pe zonă („5 fișe noi în Toolbox”).
- **Povestea „grilă + bandă”** numără fișele cu bandă activă (dispare la deschidere sau după `{motion.tape-lifetime}`), pentru „· N noi” din `section-header`.
- **Povestea „status-bar”** („6 fișe · 1 nouă”) numără sosirile din toată sesiunea.
- **Ciocnire:** după două importuri și o fișă deschisă, cele trei numere diferă — exact ce AD-10 spune că previne („toast, bandă și contoare care numără diferit”).

**Închidere (AD-10):**

> Depozitul ține `arrivals: Map<id, arrivedAt>`; o fișă iese din ea când e deschisă, când expiră `{motion.tape-lifetime}` sau când e ștearsă. Banda, „· N noi” și `status-bar` derivă doar din `arrivals` (filtrat pe vedere sau pe zonă). Toast-ul folosește doar sosirile reîncărcării curente, grupate pe zonă.

### G7 — Tema „înainte de prima randare”: cinci mecanisme, două sisteme de CSS

AD-20 fixează proprietarul, nu mecanismul. Variante conforme: `additionalArguments` citit în preload; `ipcRenderer.sendSync` în preload; query string în `loadURL`/`loadFile`; `await window.whenkit.getTheme()` înainte de `createRoot`; `nativeTheme.themeSource` + CSS pe `prefers-color-scheme`.

- **Povestea „tokeni / stil” (primul tichet al epicului)** scrie temele CSS sub `:root[data-theme="dark"]`.
- **Povestea „theme-switch + window state”** setează `nativeTheme.themeSource = 'dark'` (aduce și dialogul nativ de folder și bara de titlu în tema corectă) și se bazează pe `prefers-color-scheme`.
- **Ciocnire:** switch-ul schimbă cromul nativ, dar nu tokenii; sau invers, dacă prima poveste face doar `data-theme`, dialogul de export rămâne luminos noaptea. În plus, AD-20 nu spune dacă „urmează tema din Windows” la prima pornire e o citire unică sau urmărire live până la primul click.
- **Clipire:** `BrowserWindow.backgroundColor` trebuie să știe tema înainte de `ready-to-show`; nimeni nu e obligat să-l seteze.

**Închidere (AD-20):**

> Main-ul rezolvă tema (fișier sau `nativeTheme.shouldUseDarkColors`), setează `nativeTheme.themeSource` și `backgroundColor` ale ferestrei și o trimite prin `webPreferences.additionalArguments` (`--whenkit-theme=dark`); preload-ul o expune sincron ca `window.whenkit.initialTheme`, iar renderer-ul pune `data-theme` pe `<html>` înainte de `createRoot`. CSS-ul folosește doar `[data-theme]`. `window:setTheme` scrie fișierul și actualizează `themeSource` și `backgroundColor`. Fără fișier, tema urmează Windows live până la primul click.

---

## LOW

### G8 — Ordinea: capcana `.reverse()` și sosirea în vederea de căutare

`entrySummaries()` întoarce deja `added_at, seq` crescător (folosit de CLI). Povestea care construiește `entries:list` îl refolosește și face `.reverse()` ⇒ `added_at DESC, seq DESC`: în fiecare lot ordinea e inversată față de AD-10 (`seq ASC`). Separat, EXPERIENCE cere ca o fișă nouă care intră în căutarea activă să „aterizeze prima”, dar căutarea e ordonată după relevanța FTS, iar AD-10 interzice reordonarea în renderer.

**Închidere:** „Ordinea `added_at DESC, seq ASC` se face în SQL (`ORDER BY added_at DESC, seq ASC`), nu prin inversarea listei crescătoare. În vederea de căutare, ordinea e relevanța FTS; o sosire nu e mutată prima (sau: excepție explicită, decisă de autor).”

### G9 — Tranzacția de citire a exportului pe conexiunea unică

AD-10: o singură conexiune în main, pentru polling și scrieri. AD-12: exportul citește într-o singură tranzacție. Povestea „export” face `BEGIN; citește; await scrie fișierele; COMMIT`. Cât durează scrierea fișierelor, autosave-ul notițelor apelează `writeTransaction`, care aruncă `INTERNAL` („nested transaction”, deja în `sqlite-catalog-store.ts`) ⇒ dialog de eroare; iar `PRAGMA data_version` citit în tranzacția deschisă nu vede importurile.

**Închidere (AD-12):** „Tranzacția de citire a exportului e sincronă: datele se citesc în memorie, tranzacția se închide, abia apoi se scriu fișierele. Pe conexiunea main-ului nu există niciun `await` între `BEGIN` și `COMMIT`.”

### G10 — `userData` mutat după lock-ul de instanță unică

EXPERIENCE: „a doua pornire aduce fereastra existentă în față” ⇒ `app.requestSingleInstanceLock()`, care folosește `userData`. Povestea „cadru / instanță unică” îl apelează la începutul `main.ts`; povestea „window state” pune `app.setPath('userData', …)` înainte de `app.whenReady()` (respectă AD-20), dar după lock, pentru că modulul ei e importat mai jos. Lock-ul și fișierele Chromium ajung în `%APPDATA%\WhenKit` = `%APPDATA%\whenkit`, lângă `config.json`. Separat: două module din main (temă, poziție) care fac fiecare citire-modificare-scriere asincronă pe `window-state.json` își pierd reciproc câmpurile.

**Închidere (AD-20):** „`app.setPath('userData', …)` e primul apel din `main.ts`, înaintea verificării Squirrel și a `requestSingleInstanceLock()`. `window-state.json` are un singur modul în main care îl ține în memorie și îl scrie întreg, sincron.”

---

## Rezumat

| Id | Sever. | AD | Pe scurt |
|---|---|---|---|
| G1 | HIGH | AD-5, AD-16 | `setNotes` crește revizia ⇒ conflict fals sau suprascriere tacită |
| G2 | HIGH | AD-10 | „diff” aplicat doar pe revizie pierde redenumiri, legături, propriile editări |
| G3 | HIGH | AD-10 | depozitul pe zonă / fără `content` / fără categorii ⇒ sosiri pierdute, doi proprietari ai categoriilor |
| G4 | MED | AD-5, AD-10 | unificarea cu fișa în editare: pulsuri false sau FK rupt |
| G5 | MED | AD-16 | `CONFLICT` verificat înainte de rețea ⇒ suprascriere tacită |
| G6 | MED | AD-10 | „nou” fără ciclu de viață ⇒ trei numere diferite |
| G7 | MED | AD-20 | mecanismul temei și CSS-ul nefixate |
| G8 | LOW | AD-10 | `.reverse()` inversează lotul; sosire vs relevanță FTS |
| G9 | LOW | AD-10, AD-12 | tranzacția exportului peste `await` blochează notițele |
| G10 | LOW | AD-20 | `setPath` după lock-ul de instanță; două scrieri ale `window-state.json` |
