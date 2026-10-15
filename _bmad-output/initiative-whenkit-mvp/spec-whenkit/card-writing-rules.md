# Reguli de scriere a fișelor

Sursa conținutului fișierului de reguli comun citit de `/importa` și `/gaseste` în workspace.

## Generale
- Totul în **română**, chiar dacă sursa e în engleză. Numele resursei rămâne original.
- Claude vizitează fiecare link înainte să scrie fișa; nu documentează din memorie un site care nu se încarcă.
- Un site care nu se încarcă intră totuși în lot, ca verificarea să decidă (respins cu motiv în jurnal sau intrat cu notă). Fișa conține doar ce spune inputul (nume, descriere); ce inputul nu acoperă se scrie minim, iar `/importa` o semnalează în raport ca nedocumentată, de rescris ulterior cu un `update`.
- Nu repară tacit un URL greșit: îl trimite așa cum apare, iar verificarea îl respinge.

## Clasificare
- Toolbox = „ce folosesc ca să fac X”. Learn = „ce citesc/studiez ca să înțeleg X”.
- Learn: material (are link spre ceva de studiat) vs. concept (notiță de cunoștințe).
- 1–2 categorii, pe principiul „unde aș căuta-o”, doar din lista zonei. O categorie nouă se declară explicit în lot.

## Ce face
- 2–3 propoziții concrete despre funcționalitățile reale văzute pe site/repo.

## Când o folosesc / Când îl aleg
- 3–6 situații, la persoana I, formulate ca **problemă**: „vreau să scot fundalul dintr-o poză”.
- Acoperă toate funcționalitățile principale ale resursei (resursele multifuncționale primesc câte o situație per funcție).
- Interzise formulările generice („când lucrezi cu imagini”).
- Pentru concepte: situația care duce la alegere, ex. „am un API public consumat de browsere → REST”.

## Cuvinte-cheie
- Sinonime în română **și** engleză pentru funcțiile principale (ex. „fundal, background, decupare, transparent”), ca să susțină căutarea text.

## Resurse înrudite
- Doar intrări existente în catalog; alternative, complementare, concept ↔ unealtă (ex. REST ↔ public-apis).

## Concepte
- Conținut complet, scris liber de Claude (fără marcaj „din sursă” vs. „completat”): explicație, exemplu, când îl alegi.
- Secțiune finală **„Surse”** cu linkuri spre documentație oficială.
- Un input cu ≥3 concepte înrudite produce și un **concept-umbrelă** cu tabel de comparație și „când alegi care”, legat de fiecare copil.

## Verificare de conținut
- Claude marchează ca dubios orice site de pirateria, ocolire a paywall-urilor sau distribuție ilegală de conținut cu copyright și scrie motivul.
- Poate propune domenii noi pentru lista de domenii interzise, doar în lot (apar în raport); nu editează fișierul.

## Protecții
- Nu scrie niciodată în „Notițele mele”.
- Nu scrie direct în `data/`; doar prin `whenkit import`.
