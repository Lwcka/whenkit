---
id: SPEC-whenkit
companions:
  - workspace-and-import-flow.md
  - verification-rules.md
  - entry-model.md
  - card-writing-rules.md
  - categories-seed.md
  - ui-screens.md
  - ../ux-whenkit/DESIGN.md
  - ../ux-whenkit/EXPERIENCE.md
  - test-scenarios.md
  - post-v1-roadmap.md
  - project-context.md
  - ../architecture-whenkit/architecture-whenkit.md
sources:
  - ../../../.tmp/grill-me/whenkit-mvp.md
  - ../../../PROJECT_BRIEF.md   # șters din repo; copie în C:\Users\Luca\Personal\
---

> **Contract canonic.** Acest SPEC și fișierele din `companions:` sunt contractul complet, validat la preservare, pentru ce se construiește, testează și validează. Sursele din frontmatter sunt doar pentru trasabilitate.

# whenkit — MVP

## Why

**Durere + viziune.** Autorul (Luca, student, developer) strânge resurse utile (repo-uri GitHub, site-uri, unelte, materiale de învățat) haotic: screenshot-uri cu liste de pe social media, un `.txt` cu URL-uri fără descriere. Când are nevoie de ceva, nu știe unde să caute și nu-și amintește că a salvat unealta potrivită. whenkit transformă aceste materiale într-un catalog personal verificat, în care o resursă se găsește după **problema** pe care o rezolvă („Când o folosesc”), nu după nume. Claude Code face munca grea (extragere, documentare, căutare în limbaj natural), iar aplicația desktop păstrează, verifică și afișează catalogul. Proiectul e și de învățare și portofoliu.

## Capabilities

- **CAP-1**
  - **intent:** Utilizatorul poate crea workspace-ul aplicației, în afara repo-ului, gata de folosit cu Claude Code.
  - **success:** După `whenkit init` la calea configurată, workspace-ul conține structura din `workspace-and-import-flow.md` (CLAUDE.md de runtime, `/adauga`, `/gaseste`, fișierul de reguli, `input/`, `data/` cu categoriile din `categories-seed.md` și lista de domenii interzise); o sesiune Claude Code deschisă acolo nu încarcă CLAUDE.md-ul de dezvoltare al repo-ului.
- **CAP-2**
  - **intent:** Claude Code poate preda aplicației un lot de intrări candidate, iar aplicația decide ce intră în catalog.
  - **success:** `whenkit import <lot>` respinge un lot invalid față de schemă fără să scrie nimic, rulează verificarea pentru fiecare candidat, salvează doar ce trece și afișează raportul: adăugate, actualizate, respinse cu motiv, avertizări, duplicate, categorii noi create. Un element de tip actualizare modifică o fișă existentă, trece prin verificare și lasă neatinse „Notițele mele”, proprietarul și data adăugării.
- **CAP-3**
  - **intent:** Sistemul verifică determinist fiecare candidat înainte de salvare, după `verification-rules.md`.
  - **success:** Pe scenariile din `test-scenarios.md`, `httpss://gutenberg.org`, o pagină inexistentă (404), un domeniu inexistent, un site căzut temporar (intră cu avertizare), domeniile din lista interzisă și un duplicat primesc exact efectul din tabel, la fiecare rulare; modulul se testează izolat de UI și de Claude.
- **CAP-4**
  - **intent:** Utilizatorul poate recupera o resursă respinsă fără materialul original.
  - **success:** Fiecare respingere apare în jurnalul de respinse cu toate datele extrase și motivul; o reluare cu link corectat trece prin verificare normal, iar una cu `--force` intră în catalog marcată în nota de verificare ca „verificare ocolită de utilizator”.
- **CAP-5**
  - **intent:** Repo-urile GitHub primesc la import date exacte despre starea lor.
  - **success:** Un repo importat are stele, data ultimului commit și starea arhivat; un repo arhivat intră cu notă; la depășirea limitei API-ului public, resursa intră fără aceste date, nu e respinsă.
- **CAP-6**
  - **intent:** Utilizatorul poate transforma materialele din `input/` (screenshot-uri, `.txt`, alte fișiere text) sau un link/text dat direct în fișe complete, rulând `/adauga` în workspace.
  - **success:** Pentru fiecare fișier de input, `/adauga` produce un lot cu fișe în română conforme cu `card-writing-rules.md`, își dă verdictul pe conținut dubios, rulează `whenkit import`, arată raportul și șterge fișierul doar dacă importul a reușit; `/adauga <link>` și reluarea din jurnalul de respinse funcționează fără fișier în `input/`.
- **CAP-7**
  - **intent:** Materialele de tip notiță de concept devin intrări Learn utile pentru învățat, inclusiv comparații între concepte înrudite.
  - **success:** Screenshot-urile din `API/` produc câte un concept per tip de API plus conceptul-umbrelă „Tipuri de API”, cu tabel de comparație și „când alegi care”, legat de fiecare copil; fiecare concept are secțiunea „Surse”.
- **CAP-8**
  - **intent:** Utilizatorul poate răsfoi catalogul pe zone (Toolbox, Learn) și pe categorii.
  - **success:** Selectarea unei categorii din bara zonei afișează doar cardurile din acea categorie; o resursă cu două categorii apare în ambele; cardurile Learn arată felul (concept/material).
- **CAP-9**
  - **intent:** Utilizatorul poate găsi o resursă scriind cuvinte, fără AI.
  - **success:** Căutarea „fundal” găsește remove.bg, deși descrierea sursă era în engleză, datorită cuvintelor-cheie bilingve; căutarea după numele exact („photopea”) găsește resursa.
- **CAP-10**
  - **intent:** Utilizatorul poate vedea, corecta, completa cu notițele sale și șterge orice intrare.
  - **success:** Fișa completă afișează toate câmpurile din `entry-model.md`, inclusiv Markdown cu tabele pentru concepte; editările persistă după repornire; o editare care schimbă linkul sau sursele trece prin verificare și nu se salvează dacă e respinsă; o salvare peste o fișă modificată între timp din terminal e refuzată cu mesaj, nu suprascrie; ștergerea elimină și legăturile către intrare; „Notițele mele” rămân neatinse după orice import sau re-documentare.
- **CAP-11**
  - **intent:** Utilizatorul poate ține lista de categorii curată.
  - **success:** Redenumirea, unificarea și ștergerea unei categorii actualizează toate intrările afectate; nicio intrare nu rămâne cu o categorie inexistentă sau fără categorie (ștergerea ultimei categorii a unei fișe cere o categorie-țintă); unificarea se face doar în aceeași zonă.
- **CAP-12**
  - **intent:** Utilizatorul poate întreba în limbaj natural, în Claude Code, ce resursă are pentru o problemă.
  - **success:** `/gaseste ce am pentru a scoate fundalul dintr-o poză?` răspunde cu remove.bg (și alte potriviri din catalog), citând situațiile din „Când o folosesc”, fără să modifice datele.
- **CAP-13**
  - **intent:** Utilizatorul poate exporta tot catalogul printr-un buton din aplicație.
  - **success:** Exportul produce, la locația aleasă de utilizator, un fișier sau folder care conține toate intrările cu toate câmpurile (inclusiv „Notițele mele” și legăturile), plus lista de categorii, și care se poate citi fără aplicație.

## Constraints

- Aplicație **desktop** locală (Windows 11). Nu web, nu mobil.
- Numele afișat e **WhenKit** (titlul ferestrei, branding, installer); identificatorii tehnici rămân `whenkit` (comanda CLI, pachetul npm, fișiere și foldere).
- Două puncte de intrare peste același nucleu: UI desktop și CLI (`whenkit init`, `whenkit import`), folosit de Claude Code.
- **Fără AI și fără chei API în aplicație** în v1. Orice inteligență generativă trăiește în skill-urile Claude Code.
- Datele stau în workspace, în afara repo-ului (implicit `C:\Users\Luca\Programe\whenkit\`), într-un format portabil, ușor de citit de Claude Code (pentru `/gaseste`). Calea workspace-ului se salvează de `whenkit init` în configurarea utilizatorului (`%APPDATA%\whenkit\config.json`), poate fi suprascrisă de variabila `WHENKIT_WORKSPACE` la dezvoltare și nu e hardcodată.
- În catalog se scrie doar prin aplicație (`whenkit import`, UI). Claude Code nu scrie direct în date, ca verificarea să nu poată fi ocolită; singura ocolire e `--force`, marcată.
- Modulul de verificare e separat, determinist, testabil izolat și refolosibil pentru intrări deja existente (pregătit pentru re-verificare, vezi `post-v1-roadmap.md`).
- În caz de dubiu, resursa se respinge și utilizatorul primește motivul.
- Interfața și conținutul fișelor sunt în **română**, chiar dacă sursa e în engleză. Textele UI stau într-un singur fișier.
- **Codul e integral în engleză** (identificatori și comentarii), ca să nu fie tradus vreodată. În română sunt doar documentele citite de autor (README, documentație, artefacte BMad); acestea se traduc la trecerea open-source.
- „Notițele mele” sunt scrise doar de utilizator; niciun import sau skill nu le suprascrie.
- Categoriile provin dintr-o listă controlată; o categorie nouă apare doar declarată explicit în lot.
- Model „multi-user ready”: câmp `owner_id` pe fiecare intrare de la început; fără autentificare.
- Skill-urile, CLAUDE.md-ul de runtime și regulile de scriere sunt parte a produsului: versionate în repo, instalate în workspace.
- Arhitectura trebuie să permită ulterior pornirea din aplicație a proceselor Claude Code (headless și terminal interactiv), cu orice server intern ascultând doar pe localhost.
- Materialele personale (`input/`, `data/`) și `.env` nu ajung niciodată în repo; codul și README-ul se scriu ca pentru un proiect public.

## Non-goals

- Formular de adăugare manuală sau captură rapidă în UI (adăugarea trece prin `/adauga`).
- AI în aplicație: căutare semantică, embeddings, model local, `AIProvider`.
- Re-verificarea resurselor existente, câmpul Status, ecranul de Setări.
- Butoane Claude Code și terminal integrat în aplicație.
- Configurare de limbă / i18n complet; documentație în engleză.
- Google Safe Browsing, skill `/rescrie`, quiz/mod interactiv în Learn, graph view.
- Autentificare, conturi, hosting, plăți, multi-tenancy reală, GDPR/termeni.
- Versiune mobilă sau web.
- Câmpurile Nivel și Sursă.

## Success signal

- Materialele de test reale (`50 github repo/`, `20 sites.png`, `inspire.txt`, `API/`) puse în `input/` și importate cu `/adauga` ajung în aplicația desktop ca fișe în română, cu rezultatele din `test-scenarios.md` (site-urile de pirateria respinse cu motiv, conceptele API cu umbrelă), `input/` rămâne gol, iar remove.bg se găsește prin bara de categorii, prin căutarea „fundal” și prin `/gaseste`. MVP-ul e declarat gata de autor când toate capabilitățile sunt implementate.

## Assumptions

- Textele UI centralizate într-un fișier și identificatori de cod în engleză (propuse, neobiectate).
- Fiecare concept are secțiunea „Surse” cu linkuri spre documentație oficială, verificate ca orice link (propusă ca plasă de siguranță la completarea liberă, neobiectată).
- Duplicat = același URL normalizat (unelte/materiale) sau același titlu (concepte).
- Legăturile dintre intrări („Resurse înrudite”, umbrelă–copil) sunt bidirecționale.

## Open Questions

- Deferate la `bmad-architecture` (nu cer decizie de produs): framework desktop, format de stocare, formatul exportului, schema JSON a lotului, modelarea relației umbrelă–copil, câmpurile indexate de căutarea text.
