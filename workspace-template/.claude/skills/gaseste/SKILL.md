---
name: gaseste
description: Caută în catalog resursele potrivite pentru o problemă descrisă în limbaj natural, după câmpul „Când o folosesc”. Folosește-l când utilizatorul întreabă ce are în catalog pentru o problemă sau o nevoie.
argument-hint: '<problema ta>'
allowed-tools: Bash(whenkit list:*), Bash(whenkit show:*), Read
---

# /gaseste

Cauți în catalog, în română, resursele care rezolvă problema utilizatorului. Citești catalogul și răspunzi; **nu scrii nimic**. Răspunsul vine doar din catalog: nu inventezi resurse și nu cauți pe web. Citește `.claude/skills/reguli-fise.md` înainte să răspunzi, ca să știi ce înseamnă fiecare câmp al unei fișe (`whatItDoes`, `situations`, `keywords` și restul).

Argumentul primit: `$ARGUMENTS`

## 1. Fără argument

Dacă argumentul lipsește sau e gol, întrebi utilizatorul ce problemă vrea să rezolve și te oprești: nu rulezi nicio comandă.

## 2. Citește catalogul

Rulează `whenkit list --json`. Pe stdout vine un singur document JSON; îl parsezi, nu citești textul. Fișele sunt în `entries`.

- Dacă iese cu orice cod diferit de 0, arăți utilizatorului `error.message` (spune deja ce are de făcut) și te oprești. Nu încerci altceva și nu răspunzi din memorie.
- CLI-ul global află workspace-ul din `WHENKIT_WORKSPACE` sau din `config.json`, **nu** din folderul curent. Dacă `workspace` din răspuns nu e folderul curent (compară căile fără să ții cont de majuscule și de tipul barei), spune-i la începutul răspunsului în ce catalog ai căutat (calea din `workspace`). Căutarea e doar citire, deci poți răspunde.
- Un catalog gol (`entries` fără elemente) îl tratezi ca pe „nimic găsit” (pasul 5).

## 3. Potrivește după înțeles

Alegi fișele a căror problemă seamănă cu cea a utilizatorului. Compari **după înțeles, nu după cuvinte**: o întrebare în română se potrivește cu o fișă scrisă cu termeni în engleză și invers. Te uiți la:

- `situations` (cel mai important: sunt problemele pentru care a fost scrisă fișa),
- `whatItDoes`, `name`,
- `keywords` (sinonime în română și în engleză),
- `categories[].name`.

Ordonezi după relevanță, cea mai bună prima, și arăți **cel mult 5**, dacă utilizatorul nu cere mai multe. Nu completezi lista cu fișe care se potrivesc doar vag.

## 4. Citește fișa întreagă, când trebuie

`entries` din `list` nu are `content`. Rulează `whenkit show <id> --json` (cu `id`-ul din `list`) și citești `entry`:

- pentru **concepte** (`kind: "concept"`), ca să citești `content` (explicația, tabelul de comparație, „când alegi care”) înainte să răspunzi;
- când rezumatul din `list` nu ajunge ca să decizi dacă fișa se potrivește.

La o eroare (cod diferit de 0) arăți `error.message` și te oprești.

## 5. Răspunde (în română)

Pentru fiecare potrivire, în ordinea relevanței:

- **numele**, zona (Toolbox sau Learn) și felul (unealtă, material sau concept);
- **linkul** (`url`), dacă fișa are unul; conceptele pot să nu aibă;
- **situațiile care se potrivesc**, citate **întocmai** din `situations` („Când o folosesc” / „Când îl aleg”), fără să le rescrii sau să le comprimi;
- **o propoziție** despre de ce se potrivește.

Reguli:

- Poți numi fișe înrudite din catalog (`relatedIds`, `parentIds`, `childIds`, rezolvate prin `list` după `id`), ca utilizatorul să vadă și alternativele. Doar ce există în catalog.
- O fișă cu `forced: true` o marchezi „verificare ocolită de utilizator”. O fișă cu `githubArchived: true` o marchezi ca arhivată.
- Nu inventezi nicio resursă, situație sau link și nu cauți pe web ca să completezi golurile.
- **Nu găsești nimic potrivit:** spui simplu „nu am găsit nimic în catalog” pentru problema aceea, fără nicio resursă inventată. Dacă utilizatorul știe o resursă care ar rezolva-o, îi sugerezi `/importa <link>` ca s-o adauge.

## 6. Doar citire

Singurele comenzi pe care le rulezi sunt `whenkit list --json` și `whenkit show <id> --json`. Nu rulezi `whenkit import`, nu scrii loturi, nu scrii în `data/`, `batches/` sau `input/` și nu atingi „Notițele mele”. Dacă utilizatorul vrea să adauge sau să schimbe o fișă, îl trimiți la `/importa`.
