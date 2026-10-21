# Scenarii de test din datele reale

Datele stau în `C:\Users\Luca\Personal\`, în afara repo-ului. Nu se transcriu manual și nu se copiază în repo; sunt input pentru `/adauga` și scenarii de acceptanță pentru tichete, nu praguri formale.

| Input | Conținut | Rezultat așteptat |
|---|---|---|
| `50 github repo/` (4 screenshot-uri) | ~50 repo-uri, nume + o descriere + link | ~12 fișe per lot; repo-urile de învățat (developer-roadmap, free-programming-books, system-design-primer, coding-interview-university, build-your-own-x, project-based-learning, You-Dont-Know-JS, tech-interview-handbook, freeCodeCamp) ca **material** în Learn; restul ca unelte; metadate GitHub prezente |
| `20 sites.png` | 20 de site-uri cu descriere scurtă | **12ft.io, libgen.is, sci-hub.se, pdfdrive.com respinse** (domeniu interzis / conținut dubios) cu motiv; `httpss://gutenberg.org` respins ca URL invalid, apoi reimportat corectat din jurnal; remove.bg, squoosh, photopea etc. ca unelte |
| `inspire.txt` | 6 URL-uri fără descriere (isladjan.com, apify.com/store, feralui.dev, bookofshapes.com, builder.atheros.ai/explore, figma.com) | fiecare dintre cele 6 linkuri ajunge în catalog (fișă documentată din vizitarea site-ului) sau, dacă site-ul nu se mai încarcă (ex. isladjan.com cu certificat invalid), în jurnalul de respinse cu motiv |
| `API/` (5 screenshot-uri, română) | notițe despre tipuri de API (REST … RPC) | concepte în Learn, câte unul per tip, plus umbrela „Tipuri de API” cu tabel de comparație; categoria Backend & API-uri |

Verificări de căutare: remove.bg se găsește prin categoria „Imagini & video”, prin căutarea „fundal” și prin `/gaseste ce am pentru a scoate fundalul dintr-o poză?`.

Final: toate fișele în română, `input/` gol.
