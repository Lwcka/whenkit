# Review adversarial — architecture-whenkit (2026-10-13)

Reviewer independent: nu am văzut conversația care a produs spine-ul. Nu repet constatările din `review-gate.md` (categorii prin nume, `ref` local, legătură spre element respins, `owner_id` în `meta`, duplicat în același lot, curățarea jurnalului).

**Metoda.** Pentru fiecare problemă construiesc două unități de un nivel mai jos (tichete construite în sesiuni separate, pe ramuri separate) care respectă literal fiecare AD și totuși nu se potrivesc. Fiecare pereche e o gaură, închisă cu un AD nou sau înăsprit; textul regulii propuse e dat gata de lipit.

**Verdict.** Spine-ul fixează bine straturile, stocarea și drumul unic de scriere, dar lasă nespecificate aproape toate **formele de date de la granițe** (raportul de import, jurnalul de respinse, DTO-urile IPC/`--json`, motivele verdictelor) și **regulile de concurență** (migrări din ramuri diferite, editare în fereastră vs `update` din CLI, tranzacția importului vs HTTP). Primul tichet care le atinge le va inventa, iar al doilea le va inventa altfel. Nu e gata de tăiat în povești fără cel puțin H1–H9.

---

## HIGH

### H1 — Forma raportului de import nu e un contract

- **Unitatea A** (tichet CLI `import`): emite cu `--json` `{ schemaVersion: 1, added: [...], rejected: [...], warnings: [...] }`, fiecare cu `name` și `url`. Respectă AD-11 (camelCase, `schemaVersion`, stabil).
- **Unitatea B** (tichet skill `/importa`): parsează `{ results: [{ ref, outcome, reasons }] }`, pentru că AD-6 vorbește de `ref` și AD-7 de `outcome`/`reasons[]`. Respectă AD-6, AD-7, AD-11.
- **Ciocnire:** skill-ul nu poate corela rezultatul cu elementul din lot (după nume? după URL normalizat?), nu știe ce `id` a primit o fișă nouă (necesar pentru `related` în lotul următor) și nu are unde citi „categorii noi create” sau „legături ignorate” (AD-6).
- **AD nou — AD-14 Raportul de import:** „Raportul e definit o singură dată ca schemă Zod în `src/core/import-report-schema.ts`, cu `schemaVersion` propriu. Forma: `{ schemaVersion, workspace, items: [{ ref, op, outcome: added|updated|warned|rejected|duplicate, id?, duplicateOfId?, reasons: VerdictReason[] }], newCategories: [{ id, zone, name, created: boolean }], ignoredLinks: [{ fromRef, to, reason }], proposedBlockedDomains: string[] }`. Fiecare element din lot apare exact o dată în `items`, identificat prin `ref`. `id` e prezent pentru `added`/`updated`/`warned`; `duplicateOfId` pentru `duplicate`. Ieșirea text (fără `--json`) e randată din același obiect. Testul de contract al skill-ului `/importa` folosește un fixture generat din schemă.”

### H2 — `--force <id>`: id-ul cui și ce ocolește

- **Unitatea A** (CLI): `<id>` = id-ul rândului din jurnalul de respinse (singurul „id” al unei resurse respinse; AD-5: id-uri UUID generate în `core`).
- **Unitatea B** (skill `/importa`, reluare din jurnal): construiește un lot nou din `rejections --json` și pasează `--force <ref>`, pentru că un element `add` nu are `id`.
- **Ciocnire suplimentară:** AD-7 spune că `--force` transformă *rejected* în *accepted*. „Categorie necunoscută nedeclarată” e tot *rejected* (verification-rules), deci un `--force` literal creează o fișă cu o categorie inexistentă — încalcă CAP-11. La fel pentru `update` cu `id` inexistent.
- **AD-7 înăsprit (paragraf nou):** „`--force <ref>` se poate repeta și referă `ref`-ul unui element din lotul curent. Ocolește doar respingerile de **verificare** (`invalid_url`, `http_not_found`, `dns`, `tls`, `blocked_domain`, `flagged_by_claude`, `source_link_*`). Nu ocolește niciodată: invaliditatea față de schemă, categoria necunoscută, `update` cu id inexistent, duplicatul. Un `ref` dat la `--force` care nu există în lot face lotul invalid (cod 1).”

### H3 — Motivele verdictului: text român în `core` sau coduri?

- **Unitatea A** (tichet verificare, `core/verification`): pune în `reasons[]` și în `verification_note` textele din spec: „blochează accesul automat”, „nu a răspuns la import”, „verificare ocolită de utilizator”. Respectă AD-7 (spec-ul dă textul exact).
- **Unitatea B** (tichet fișă în renderer): respectă AD-13 („textele UI stau **doar** în `strings.ro.ts`”) și caută în `strings.ro.ts` după cod, deci așteaptă coduri în `verification_note`.
- **Agravare:** `entry-model.md` spune că nota e scrisă de „Claude + aplicația”. Claude scrie text liber în română; aplicația, coduri sau text. O singură coloană `verification_note` (string) nu le poate ține pe ambele fără ca cineva să concateneze texte. CLI-ul are nevoie de aceleași texte românești ca renderer-ul, dar AD-13 le interzice în afara renderer-ului.
- **AD nou — AD-15 Motive ca date:** „Un motiv e `VerdictReason = { code: ReasonCode, params?: Record<string,string> }`; `ReasonCode` e un enum închis din `src/core/verification/reason-codes.ts`. Verdictul de conținut de la Claude are `code: 'flagged_by_claude'` și `params.text` (româna lui Claude, păstrată ca atare). Coloana devine `verification_notes` (JSON, listă de `VerdictReason`). Textele românești ale codurilor stau într-un singur fișier, `src/shared/strings.ro.ts`, importat și de CLI, și de renderer.” **AD-13 se modifică** corespunzător (`strings.ro.ts` mutat în `src/shared/`).

### H4 — Migrări din ramuri paralele pe aceeași bază reală

- **Unitatea A** (ramura epicului 1, tichet rejections): adaugă migrarea `user_version = 3` (tabelul `rejections`).
- **Unitatea B** (altă ramură, tichet categorii): adaugă tot `user_version = 3` (coloana `name_key` în `categories`). Ambele respectă AD-4 (migrări în `user_version`, tranzacție, refuz la bază mai nouă).
- **Ciocnire 1:** după merge există două migrări 3; baza reală, migrată deja de una dintre ramuri, are `user_version = 3` și nu primește niciodată cealaltă.
- **Ciocnire 2:** CLI-ul `whenkit` rulează din working tree-ul repo-ului (orice ramură e checkout), iar aplicația instalată e un snapshot `npm run make`. Un `whenkit import` rulat de pe o ramură de lucru migrează baza **reală** din workspace; aplicația instalată o refuză apoi („bază mai nouă”), iar dacă ramura e abandonată, baza rămâne pe o versiune care nu va exista în `main`.
- **AD-4 înăsprit:** „Migrările sunt fișiere numerotate, append-only, în `src/adapters/sqlite/migrations/NNNN-<nume>.sql`; numărul se alege la merge în `main`, nu pe ramură. Pe lângă `user_version`, tabelul `schema_migrations(version, name, sha256)` ține ce s-a aplicat; o nepotrivire de nume sau hash oprește deschiderea cu `WhenkitError('MIGRATION_MISMATCH')`. Înainte de orice migrare se copiază baza în `data/backups/catalog-v<N>-<timestamp>.sqlite`. Migrarea rulează în `BEGIN IMMEDIATE`; al doilea proces reverifică `user_version` după ce obține lock-ul. Codul de pe altă ramură decât `main` nu deschide workspace-ul real: dezvoltarea și testele folosesc `WHENKIT_WORKSPACE` spre un workspace de dev.”

### H5 — Semantica lui `update` nu e fixată

- **Unitatea A** (tichet verificare): verifică un `update` ca pe orice candidat, inclusiv duplicatul → URL-ul fișei se potrivește cu ea însăși → `duplicate`. Respectă AD-6 („trece prin verificare”) și AD-7.
- **Unitatea B** (tichet import): tratează `update` ca patch parțial (câmpurile lipsă rămân), pe când tichetul de schemă (`batch-schema.ts`) a făcut toate câmpurile obligatorii, ca la `add`. Ambele respectă AD-6, care nu spune nimic despre asta.
- **Și legăturile:** `related` e simetric, un singur rând (AD-5). Un `update` pe A cu `related: [C]` înlocuiește legăturile lui A? Atunci șterge și legătura B→A pusă de importul lui B. Le adaugă? Atunci o legătură greșită nu se mai poate scoate prin lot.
- **AD-6 înăsprit:** „`update` e **înlocuire completă** a câmpurilor scrise de Claude (aceleași câmpuri obligatorii ca `add`); câmpurile aplicației (`id`, `ownerId`, `addedAt`, `myNotes`, `forced`) rămân, `verifiedAt` și metadatele GitHub se recalculează. Verificarea duplicatului exclude fișa cu același `id`; un URL care duce la *altă* fișă dă `duplicate`. `update` cu `id` inexistent dă `rejected` (`unknown_id`), nu lot invalid. `related` dintr-un `update` înlocuiește legăturile `related` ale fișei în ambele sensuri; `parent` se înlocuiește doar dacă câmpul `children` e prezent. Un `update` respins lasă fișa neschimbată și intră în jurnal cu `op: 'update'`.”

### H6 — Lost update: fereastra și CLI-ul pe aceeași fișă

- **Unitatea A** (tichet editare în fișă): formularul trimite fișa întreagă prin `entries:update`; main-ul o scrie. Respectă AD-3 (scrie un caz de utilizare din `core`).
- **Unitatea B** (`/importa` „rescrie fișa X după regulile noi”): trimite `update` pentru X cât formularul e deschis. Respectă AD-6.
- **Ciocnire:** salvarea din fereastră suprascrie tacit rescrierea lui Claude (sau invers). Și AD-10: `catalog:changed` face renderer-ul să „reîncarce datele afișate”, deci tichetul de renderer poate șterge editările nesalvate din formular.
- **AD nou — AD-16 Concurența scrierilor:** „Fiecare fișă are `revision INTEGER`, incrementat de orice scriere. Editările din UI sunt comenzi pe câmpuri (`entries:patch { id, expectedRevision, changes }`); dacă `revision` diferă, `core` aruncă `WhenkitError('CONFLICT')`, iar renderer-ul arată conflictul și nu salvează. `myNotes` se scriu printr-o comandă separată (`entries:setNotes`), fără `expectedRevision`, pentru că niciun import nu le atinge. La `catalog:changed`, un formular cu modificări nesalvate nu se reîncarcă; se marchează „modificată din terminal”.”

### H7 — Tranzacția importului vs verificarea prin rețea; codurile de ieșire nu acoperă eșecurile reale

- **Unitatea A** (tichet import): citește AD-6 („o singură tranzacție”) și deschide tranzacția la început, verifică fiecare URL (HEAD/GET, 2 reîncercări, 10 s timeout) în interiorul ei, apoi face commit. Cu ~12 elemente, lock-ul de scriere stă minute întregi; `node:sqlite` e sincron, deci `busy_timeout` blochează **thread-ul main al Electron** la orice salvare din fereastră → UI înghețat.
- **Unitatea B** (alt tichet de import): commit per element, ca să nu țină lock-ul. Un crash la elementul 7 iese cu cod 1 (eroare necapturată în Node), pe care skill-ul îl citește ca „lot invalid, nimic scris” (AD-11) — fals.
- **Offline:** fără rețea, DNS eșuează → AD-7 dă `rejected` („DNS inexistent”) pentru tot lotul, jurnalul se umple de resurse bune, codul e 0 și skill-ul șterge fișierul din `input/`.
- **AD-6 și AD-11 înăsprite:** „Importul are trei faze: (1) validare de schemă, fără I/O; (2) verificare și metadate GitHub, fără tranzacție; (3) o singură tranzacție scurtă `BEGIN IMMEDIATE` care rescrie duplicatele (reverificate în tranzacție) și scrie tot. Coduri de ieșire: `0` = faza 3 a făcut commit (chiar cu respingeri); `1` = lot invalid, nimic scris; `2` = configurare lipsă; `3` = mediu indisponibil (rețea absentă detectată înainte de faza 2, bază blocată, migrare refuzată), nimic scris; `4` = eroare internă, nimic scris (garantat de faza 3 atomică). Erorile DNS se separă: `ENOTFOUND` = `rejected`; `EAI_AGAIN`/fără rețea = cod 3. Skill-ul șterge fișierul din `input/` doar la cod 0. În main, `busy_timeout` ≤ 2000 ms.”

### H8 — `whenkit init` repetat și copia JSON Schema din workspace

- **Unitatea A** (tichet `init`): copiază `workspace-template/`, scrie `blocked-domains.txt`, semănă categoriile, scrie JSON Schema. Respectă AD-6, AD-8 și convenția „Categorii”.
- **Unitatea B** (orice tichet ulterior care schimbă `batch-schema.ts`): ridică `schemaVersion` la 2. Respectă AD-6.
- **Ciocnire:** workspace-ul are încă schema v1 și skill-ul v1; skill-ul scrie loturi v1. Dacă importul acceptă doar versiunea curentă, tot importul pică cu cod 1 fără indicație; dacă acceptă și v1, codul are două scheme. Rularea din nou a lui `init` ca să actualizeze schema **suprascrie** `blocked-domains.txt` editat de utilizator și **re-semănă** categoriile șterse sau redenumite (CAP-11).
- **AD nou — AD-17 Workspace gestionat:** „Fișierele workspace-ului sunt de două feluri. *Gestionate de șablon* (`CLAUDE.md`, `.claude/skills/**`, fișierul de reguli, `batch.schema.json`): `whenkit init` le suprascrie mereu și scrie `.whenkit-template.json { templateVersion, batchSchemaVersion }`. *Ale utilizatorului* (`data/**`, inclusiv `blocked-domains.txt`, și `input/`): `init` le creează doar dacă lipsesc. Categoriile de start se semănă **o singură dată**, în migrarea care creează tabelul. `whenkit import` acceptă doar `schemaVersion` egal cu cel curent; altfel iese cu 1 și mesajul `BATCH_SCHEMA_OUTDATED: rulează whenkit init`. Orice comandă CLI avertizează pe stderr când `templateVersion` din workspace e mai vechi decât cel din cod. Skill-urile pot citi schema și din `whenkit schema`, care o tipărește din cod.”

### H9 — Identitatea categoriilor în cele două zone

- **Unitatea A** (tichet import): caută categoria după `name` exact în zona fișei. Respectă AD-6.
- **Unitatea B** (tichet gestionare categorii, UI): permite redenumirea „Imagini & video” → „imagini & video” și unificarea între zone („Securitate” din Toolbox cu „Securitate” din Learn — același nume apare în ambele zone în `categories-seed.md`). Respectă AD-5 (fișele referă categoria prin id, deci totul „se propagă”).
- **Ciocnire:** după unificare, o fișă `tool` are o categorie Learn și dispare din bara Toolbox (CAP-8); Claude scrie „Imagini și video” sau „imagini & video” și primește `unknown_category` sau creează un duplicat prin `newCategories`. Seed-ul spec-ului e un fișier „editabil”, AD-ul îl pune în DB; nimeni nu spune de unde citește `init` lista.
- **AD-5 înăsprit:** „`categories(id, owner_id, zone, name, name_key)`, unic pe `(owner_id, zone, name_key)`; `name_key` = aceeași normalizare ca titlul conceptului (lowercase, fără diacritice, spații comprimate), într-o singură funcție din `core`. Lotul referă categoria prin nume, potrivit după `name_key` în zona dată de `kind`. O intrare din `newCategories` (`{ zone, name }`) care se potrivește cu una existentă o refolosește și apare cu `created: false`. Unificarea și mutarea sunt permise doar în aceeași zonă. Categoriile unei fișe aparțin mereu zonei felului ei; un `update` care schimbă zona trebuie să aducă și categoriile. Lista de start e o constantă TypeScript din `core`, generată din `categories-seed.md`.”

---

## MEDIUM

### M1 — Cheia de duplicat nu e o coloană; redirect, schemă, concurență
- **A** (verificare): normalizează URL-ul trimis de Claude și compară, în memorie, cu toate fișele încărcate. **B** (store): salvează URL-ul final, după redirect. `http://remove.bg` vs `https://www.remove.bg/` diferă prin schemă, pe care AD-7 nu o normalizează. Două importuri simultane (CLI + încă un CLI) trec amândouă de verificare.
- **AD-7 înăsprit:** „Normalizarea scoate și schema (`http`/`https` echivalente). Se stochează URL-ul trimis, nu cel final. `core` calculează `dedup_key` (`url:<normalizat>` pentru fișe cu link, `title:<normalizat>` pentru concepte fără link) și îl dă store-ului; coloana are index unic pe `(owner_id, dedup_key)`; duplicatul se reverifică în tranzacția de scriere (H7). Același `dedup_key` stă pe rândurile din `rejections` și e cheia după care se curăță jurnalul (inclusiv concepte fără link, pe care regula actuală, „URL normalizat”, nu le poate curăța niciodată).”

### M2 — Cine întreține FTS-ul și cum se interoghează
- **A** (migrare): creează `entries_fts` ca tabel external-content cu triggere. **B** (store): „întreținut de `SqliteCatalogStore`” → inserează manual în FTS la fiecare scriere. Rezultat: rânduri dublate sau desincronizate. Și: tichetul de căutare pasează textul utilizatorului direct în `MATCH` (eroare la `"`, `-`, `OR`), iar „fundal” nu găsește „fundalul” fără prefix.
- **AD-5 înăsprit:** „`entries_fts` e external-content (`content='entries'`) și se sincronizează **doar** prin triggerele din migrare; codul nu scrie în FTS. Interogarea se construiește într-o singură funcție din adaptor: textul se împarte în tokeni, fiecare devine `"tok"*`, uniți cu AND; utilizatorul nu scrie niciodată sintaxă FTS.” Coloanele JSON (`situations`, `keywords`) se indexează prin coloane text derivate (elemente unite cu spațiu), nu prin JSON brut.

### M3 — `data_version` nu vede scrierile proprii
- **A** (main, polling): deschide o conexiune nouă la fiecare citire (`data_version` e per conexiune, deci nu se schimbă niciodată) sau folosește conexiunea pe care scrie și main-ul. **B** (renderer): se bazează pe `catalog:changed` și după editările proprii. `PRAGMA data_version` nu se schimbă pentru commit-urile aceleiași conexiuni → după o editare din UI, lista nu se reîmprospătează.
- **AD-10 înăsprit:** „Main-ul ține o singură conexiune, deschisă la pornire, pentru polling și scrieri. După orice comandă IPC care scrie, main-ul emite el însuși `catalog:changed`; polling-ul acoperă doar scrierile altor procese.”

### M4 — DTO-uri și erori prin IPC și `--json`
- **A** (handleri IPC): returnează entitățile din `core` (cu `Date`, clase) și aruncă `WhenkitError`; structured clone pierde prototipurile și `code` (renderer-ul primește un `Error` generic cu mesajul prefixat de Electron). **B** (CLI `list --json`): serializează propriul DTO, cu alte nume și fără `categories`. **C** (export `catalog.json`): al treilea format. Toate respectă AD-11/AD-12 și convenția camelCase.
- **AD nou — AD-18 Un singur DTO:** „`src/core/dto.ts` definește `EntryDto`, `CategoryDto`, `LinkDto`, `RejectionDto` (date ca string ISO, fără clase) și funcțiile de mapare; CLI `--json`, IPC și `catalog.json` le folosesc pe acestea. `shared/ipc.ts` importă doar tipuri din `core/dto.ts`. Handlerii IPC nu aruncă: întorc `{ ok: true, data } | { ok: false, error: { code } }`. Cu `--json`, stdout conține mereu exact un document JSON, inclusiv la eroare (`{ schemaVersion, error: { code, message } }`); logurile merg pe stderr.” Plus: „`list --json` include câmpurile din `EntryDto` fără `content`; `whenkit show <id> --json` dă fișa completă” — altfel `/gaseste` încarcă tot conținutul Markdown al conceptelor în context.

### M5 — Timpul
- **A** (store): `added_at DEFAULT CURRENT_TIMESTAMP` → `2026-10-13 10:00:00`. **B** (core prin `Clock`): `toISOString()` → `2026-10-13T10:00:00.000Z`. Ambele „ISO 8601 UTC”. Sortarea textuală le amestecă greșit.
- **Convenție înăsprită:** „Toate momentele vin din portul `Clock` ca `Date.toISOString()` (cu milisecunde și `Z`); niciun `DEFAULT` temporal în SQL. Numele de foldere/fișiere folosesc data **locală** în formatul `YYYY-MM-DD_HHmmss` (fără `:`, interzis pe Windows).”

### M6 — Slug-urile din export
- **A** (scrie `fise/<slug>.md`) și **B** (scrie legăturile Obsidian `[[...]]`) derivă slug-ul fiecare din `name`. Coliziuni: două fișe „REST” (concept + unealtă), nume care diferă doar prin majuscule (NTFS nu le distinge), `CON`/`NUL`, puncte la final, diacritice. Legăturile spre fișierul suprascris sunt rupte.
- **AD-12 înăsprit:** „O singură funcție `slugify()` în `core` (ASCII lowercase, fără diacritice, `[a-z0-9-]`, max 80, nume rezervate Windows sufixate cu `-`). Exportul calculează o dată harta `id → slug`, în ordinea `(addedAt, id)`, cu sufix `-2`, `-3` la coliziune comparată case-insensitive; fișierele și legăturile `[[slug|Nume]]` folosesc aceeași hartă. Numele folderului folosește formatul din M5; dacă există, se adaugă sufix.”

### M7 — Forma rândurilor din `links`
- **A** (import lui B, `related: [A]`) inserează `(B, A)`; **B** (import lui A, `related: [B]`) inserează `(A, B)`. „Un rând, interogat în ambele sensuri” → două rânduri, legătura apare de două ori. `parent`: nimic nu oprește un ciclu, o unealtă ca umbrelă sau o legătură spre sine.
- **AD-5 înăsprit:** „Pentru `related` se stochează `from_id < to_id` (ordonare canonică), cu `UNIQUE(type, from_id, to_id)` și `CHECK(from_id <> to_id)`. `parent` leagă doar concept → concept, fără cicluri (verificat în `core`); un copil poate avea mai mulți părinți.”

### M8 — Forma jurnalului de respinse
- **A** (import): scrie rândul cu coloane plate (`name`, `url`, `reason`). **B** (`/importa`, reluare): are nevoie de „fișa propusă” completă (spec CAP-4) ca să refacă elementul fără materialul original — inclusiv categorii, situații, conținutul conceptului.
- **AD-5 înăsprit:** „`rejections(id, owner_id, dedup_key, op, element JSON, reasons JSON, batch_schema_version, rejected_at)`; `element` e elementul din lot exact cum a trecut de schemă. `rejections --json` îl întoarce neschimbat, ca skill-ul să-l poată pune într-un lot nou (cu eventuale corecturi).” Ce se întâmplă cu o respingere salvată sub `schemaVersion` 1 după trecerea la 2 trebuie spus (migrarea o convertește sau `rejections --json` o marchează `stale`).

### M9 — Unde stă fișierul lotului
- **A** (`/importa`): scrie lotul lângă input, în `input/lot-<x>.json`. **B** (`/importa`, pasul „pentru fiecare fișier din `input/`”): la rularea următoare tratează `lot-<x>.json` ca material de importat („alte fișiere text”). Niciun AD nu fixează locul.
- **AD-17 (completare):** „Loturile se scriu în `<workspace>/batches/`, nu în `input/`; skill-ul le șterge după cod 0 și le păstrează la alt cod, pentru diagnostic.”

### M10 — Ștergerea unei categorii lasă fișe fără categorie
- **A** (`core`, ștergere): scoate categoria de pe fișe (CASCADE pe `entry_categories`) — CAP-11 respectat literal: nicio fișă nu are categorie *inexistentă*. **B** (renderer): presupune 1–2 categorii (entry-model) și afișează fișa doar sub categoria ei; o fișă cu zero categorii apare doar sub „Toate”.
- **AD-5 înăsprit:** „O fișă are 1–2 categorii din zona ei. Ștergerea unei categorii care e singura pe vreo fișă cere o categorie-țintă (devine unificare); unificarea elimină dublurile pe fișă.”

### M11 — Linkurile din „Surse” ale conceptelor
- **A** (verificare): un link din „Surse” cu 404 respinge conceptul (o resursă cu link mort). **B** (import): îl tratează ca avertizare, pentru că linkul conceptului e opțional. verification-rules spune doar că „se verifică”.
- **AD-7 înăsprit:** „Fiecare link din `sources` primește verdictul din tabel; un link *rejected* din `sources` respinge conceptul (`source_link_rejected`, cu URL-ul în `params`); *warned* se propagă ca avertizare. `--force` ocolește și aceste respingeri.”

### M12 — Taxonomia erorilor
- **A** (`core`) aruncă `WhenkitError({ code: 'db-locked' })`; **B** (CLI) mapează `'DB_LOCKED'` la cod 3; **C** (renderer) caută `errors.dbLocked` în `strings.ro.ts`. Toate respectă convenția „Erori”.
- **Convenție înăsprită:** „`ErrorCode` e un enum închis în `src/core/errors.ts` (`SCREAMING_SNAKE_CASE`); maparea `ErrorCode → exit code` stă într-un singur tabel în `cli`, iar maparea `ErrorCode → text` în `shared/strings.ro.ts`.”

---

## LOW

- **L1 — `blocked-domains.txt` în `data/` vs AD-3.** Spec-ul spune că „Claude poate propune domenii noi”; AD-3 interzice skill-urilor să scrie în `data/`. Un tichet de skill care adaugă direct domeniul încalcă AD-3; altul doar îl raportează. Fix: propunerile ajung în `proposedBlockedDomains` din raport (H1), iar utilizatorul editează fișierul. Sintaxa regulilor (`libgen.*`, subdomenii, comentarii `#`) se parsează într-o singură funcție din `core`, cu teste.
- **L2 — Rezolvarea căii în aplicația ambalată.** Un tichet de main care folosește `app.getPath('userData')` obține același folder doar dacă `name` din `package.json` e exact `whenkit`; Electron își pune și cache-ul acolo. `WHENKIT_WORKSPACE` setat doar în shell face CLI-ul și aplicația pornită din Start să lucreze pe baze diferite. Fix în AD-8: „Calea config-ului se calculează din `process.env.APPDATA`, nu din `app.getPath`. Calea rezolvată apare în fiecare ieșire `--json` (`workspace`) și în bara de stare a ferestrei.”
- **L3 — Contoare `schemaVersion`.** Lotul, raportul, exportul, `config.json`, DTO-urile `--json` și `user_version` pot fi un singur contor sau mai multe. Fix: „Fiecare format are propria constantă întreagă în `src/core/versions.ts`; versiunile sunt independente.”
- **L4 — Strictețea schemei lotului.** Zod scoate tacit cheile necunoscute; un skill care scrie `myNotes` sau `whatitDoes` nu află nimic. Fix în AD-6: „Toate obiectele lotului sunt `.strict()`; `kind` e o uniune discriminată (`url` obligatoriu pentru `tool`/`material`); erorile de schemă apar în `--json` cu calea câmpului. Câmpurile aplicației (`myNotes`, `ownerId`, `addedAt`, `verifiedAt`, `github*`, `forced`) nu există în schemă.”
- **L5 — Exportul cât CLI-ul scrie.** Exportul citește fișe, apoi legături, în citiri separate; un import la mijloc produce legături spre fișe lipsă din `catalog.json`. Fix în AD-12: „Exportul citește într-o singură tranzacție de citire (snapshot WAL).”
- **L6 — Markdown-ul conceptelor.** Tichetul de renderer poate activa HTML brut sau imagini externe în Markdown; CSP-ul din AD-9 le blochează tacit, iar un link din conținut navighează fereastra. Fix în AD-9: „Markdown fără HTML brut; toate linkurile din conținut trec prin `shell.openExternal`; imaginile externe nu se încarcă.”
- **L7 — GitHub.** „Data ultimului commit” poate fi `pushed_at` (un apel) sau commit-ul de pe ramura implicită (două apeluri, contează la limita de 60/h). Detectarea unui repo (`github.com/owner/repo/tree/main/...`) poate diferi între verificare și adaptor. Fix: „`core` extrage `owner/repo` cu o singură funcție; data ultimului commit = `pushed_at`.”

---

## Rezumat al modificărilor propuse

| AD | Tip | Închide |
|---|---|---|
| AD-14 Raportul de import | nou | H1, L1 |
| AD-15 Motive ca date (+ modificare AD-13) | nou | H3, M12 |
| AD-16 Concurența scrierilor (`revision`) | nou | H6 |
| AD-17 Workspace gestionat | nou | H8, M9 |
| AD-18 Un singur DTO, erori ca valori la IPC | nou | M4 |
| AD-4 | înăsprit | H4 |
| AD-5 | înăsprit | H9, M2, M7, M8, M10 |
| AD-6 | înăsprit | H5, H7, L4 |
| AD-7 | înăsprit | H2, M1, M11 |
| AD-8, AD-9, AD-10, AD-11, AD-12 | înăsprite | L2, L6, M3, H7, M6, L5 |
| Convenții (timp, erori, versiuni) | înăsprite | M5, M12, L3 |

Divergențe față de spec de propagat prin `bmad-spec`: categoriile de start nu mai sunt un fișier editabil în `data/` (H9); textele motivelor devin coduri (H3); propunerile de domenii interzise nu scriu în `data/` (L1).
