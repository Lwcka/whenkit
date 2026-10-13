# Reguli de verificare

Regula de bază: **în caz de dubiu, resursa nu se adaugă, iar utilizatorul primește motivul.** O resursă lipsă e preferabilă uneia periculoase.

| Verificare | Cine o face | Efect |
|---|---|---|
| URL invalid sintactic (ex. `httpss://`) | cod | ❌ respinsă |
| Link-ul merge (2xx, 3xx după redirect) | cod | ✅ intră |
| Site-ul blochează programele (401, 403, 429) | cod | ✅ intră, cu notă „blochează accesul automat” |
| Site căzut temporar (5xx, timeout 10 s) | cod | 2 reîncercări, apoi ⚠️ intră cu avertizare „nu a răspuns la import”, vizibilă în fișă și în raport |
| Pagină inexistentă (404, 410, alt 4xx), domeniu inexistent (DNS), certificat SSL invalid, conexiune refuzată | cod | ❌ respinsă |
| Fără internet | cod | ⏸️ importul se oprește, nimic scris, nimic respins |
| Domeniu în lista de domenii interzise (link trimis sau final) | cod | ❌ respinsă |
| Duplicat în catalog sau în același lot | cod | ⚠️ ignorată + mesaj „există deja: <nume>” |
| Conținut dubios (pirateria, ocolirea paywall-urilor, conținut cu copyright distribuit ilegal) | Claude (`/importa`) | ❌ respinsă, cu motivul scris de Claude |
| Link din „Surse” mort sau invalid | cod | ⚠️ sursa se scoate, conceptul intră cu avertizare |
| Link din „Surse” dintr-un domeniu interzis | cod | ❌ conceptul e respins |
| Repo GitHub arhivat / abandonat | cod (API GitHub) | ✅ intră, cu notă în fișă |
| Lot invalid față de schemă | cod | ❌ tot lotul respins, nimic scris |
| Categorie necunoscută nedeclarată în lot | cod | ❌ respinsă |

- Conceptele fără link sar peste verificările de URL.
- Aceleași reguli se aplică și unei editări din aplicație care schimbă linkul sau sursele.
- `--force` adaugă o resursă respinsă la verificare; nota consemnează „verificare ocolită de utilizator”. Nu ocolește schema, categoria necunoscută sau duplicatul.
- Lista de domenii interzise e un fișier de date editat doar de utilizator. Conținut inițial: `libgen.*`, `sci-hub.*`, `z-lib.*`, `pdfdrive.com`, `12ft.io`. Claude propune domenii noi în raportul de import.
- Raport la fiecare import: adăugate, actualizate, respinse (cu motiv), avertizări, duplicate, categorii noi create, legături ignorate, domenii propuse.
- Jurnal de respinse: elementul complet din lot (fișa propusă) + motiv + dată.
- De ce în cod și nu la Claude: un LLM repară tacit typo-urile, poate documenta din memorie un site mort, nu ține minte catalogul între sesiuni, nu vede phishing-ul și e inconsecvent între rulări.

Extensii ulterioare în același modul: Google Safe Browsing; re-verificarea intrărilor existente (`post-v1-roadmap.md`).
