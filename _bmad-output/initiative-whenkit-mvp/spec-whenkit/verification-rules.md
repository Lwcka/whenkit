# Reguli de verificare

Regula de bază: **în caz de dubiu, resursa nu se adaugă, iar utilizatorul primește motivul.** O resursă lipsă e preferabilă uneia periculoase.

| Verificare | Cine o face | Efect |
|---|---|---|
| URL invalid sintactic (ex. `httpss://`) | cod | ❌ respinsă |
| Link-ul nu răspunde | cod | ❌ respinsă |
| Domeniu în lista de domenii interzise | cod | ❌ respinsă |
| Duplicat în catalog | cod | ⚠️ ignorată + mesaj „există deja: <nume>” |
| Conținut dubios (pirateria, ocolirea paywall-urilor, conținut cu copyright distribuit ilegal) | Claude (`/importa`) | ❌ respinsă, cu motivul scris de Claude |
| Repo GitHub arhivat / abandonat | cod (API GitHub) | ✅ intră, cu notă în fișă |
| Lot invalid față de schemă | cod | ❌ tot lotul respins, nimic scris |
| Categorie necunoscută nedeclarată în lot | cod | ❌ respinsă |

- Conceptele fără link sar peste verificările de URL; linkurile din „Surse” se verifică.
- `--force` adaugă o resursă respinsă; nota de verificare consemnează „verificare ocolită de utilizator”.
- Lista de domenii interzise e un fișier de date editabil. Conținut inițial: `libgen.*`, `sci-hub.*`, `z-lib.*`, `pdfdrive.com`, `12ft.io`. Claude poate propune domenii noi în raport.
- Raport la fiecare import: adăugate, respinse (cu motiv), duplicate, categorii noi create.
- Jurnal de respinse: date complete extrase (nume, link, descriere, fișă propusă) + motiv + dată.
- De ce în cod și nu la Claude: un LLM repară tacit typo-urile, poate documenta din memorie un site mort, nu ține minte catalogul între sesiuni, nu vede phishing-ul și e inconsecvent între rulări.

Extensii ulterioare în același modul: Google Safe Browsing; re-verificarea intrărilor existente (`post-v1-roadmap.md`).
