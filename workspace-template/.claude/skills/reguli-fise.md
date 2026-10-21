# Reguli de scriere a fișelor

Fișierul acesta e gestionat de aplicație (se rescrie la fiecare `whenkit init`); nu îl edita. Îl citesc `/adauga` și `/gaseste` înainte să scrie sau să rescrie o fișă. Fiecare regulă de mai jos spune și în ce câmp al lotului ajunge (contractul complet e `batch.schema.json`).

## Generale

- Totul în **română**, chiar dacă sursa e în engleză. Numele resursei (`name`) rămâne cel original.
- Vizitezi fiecare link înainte să scrii fișa. Nu documentezi din memorie un site care nu se încarcă.
- Un site care nu se încarcă intră totuși în lot, ca verificarea să decidă (respins cu motiv în jurnal sau intrat, cu nota ei dacă are una). Primește **fișa minimă**, doar din ce spune inputul (nume, descriere): `whatItDoes` începe exact cu „Nedocumentată: pagina nu s-a încărcat la import.”, urmat de ce reiese din input; o singură situație, cea pe care inputul o susține; o categorie, cea mai apropiată din listă; fără cuvinte-cheie inventate. Regulile de mai jos despre numărul de propoziții, situații și cuvinte-cheie nu se aplică fișei minime. `/adauga` o semnalează în raport ca nedocumentată, de rescris ulterior cu un `update`.
- Nu repari tacit un URL greșit. Îl trimiți în `url` exact cum apare (și `httpss://` rămâne `httpss://`); verificarea îl respinge, iar jurnalul îl păstrează pentru reluare.

## Clasificare

- **Toolbox** = „ce folosesc ca să fac X” (`kind: "tool"`). **Learn** = „ce citesc sau studiez ca să înțeleg X”.
- În Learn, **material** (`kind: "material"`) are un link spre ceva de studiat; **concept** (`kind: "concept"`) e o notiță de cunoștințe, scrisă de tine.
- `resourceType` (la unelte și materiale): `repo` pentru un repository, `app` pentru o aplicație de instalat, `site` pentru orice altceva de pe web.
- `categories`: 1–2 nume, pe principiul „unde aș căuta-o”, **doar** din lista zonei fișei (`whenkit categories --json`). O categorie nouă o declari explicit în `newCategories` (cu zona ei); nu o scrii doar în fișă.

## Ce face (`whatItDoes`)

- 2–3 propoziții concrete despre funcționalitățile reale pe care le-ai văzut pe site sau în repo. Fără slogane și fără superlative.
- La concepte: pe scurt, ce este conceptul. Explicația completă merge în `content`.

## Când o folosesc / Când îl aleg (`situations`)

- 3–6 situații, la persoana I, formulate ca **problemă**: „vreau să scot fundalul dintr-o poză” (fișa minimă are una singură).
- Acoperă toate funcționalitățile principale ale resursei: o resursă multifuncțională primește câte o situație pentru fiecare funcție.
- Sunt interzise formulările generice („când lucrezi cu imagini”): o situație trebuie să-l facă pe utilizator să spună „asta e problema mea”.
- La concepte, situația duce la alegere: „am un API public consumat de browsere → REST”.

## Cuvinte-cheie (`keywords`)

- Sinonime în română **și** în engleză pentru funcțiile principale (de exemplu „fundal, background, decupare, transparent”), ca să susțină căutarea text.

## Resurse înrudite (`related`)

- Doar intrări care există: un element din același lot (după `ref`) sau o fișă deja din catalog (după id, din `whenkit list --json`). Nu inventa legături.
- Alternative, resurse complementare, concept ↔ unealtă (de exemplu REST ↔ public-apis). Legătura e simetrică.

## Concepte (`content`, `children`)

- Conținut complet (`content`, Markdown, tabele permise), scris liber de tine, fără marcaj „din sursă” versus „completat”: explicația, un exemplu și când îl alegi.
- Un input cu cel puțin 3 concepte înrudite produce și un **concept-umbrelă**: un concept cu tabel de comparație și „când alegi care”, ai cărui copii (`children`) sunt conceptele înrudite, referite după `ref`. Copiii trebuie să fie concepte.

## Surse (`sources`)

- Fiecare concept are o secțiune finală „Surse”: linkuri spre documentația oficială. Se scriu în câmpul **`sources`** (listă de URL-uri), nu ca secțiune repetată în `content`: importul verifică sursele și scoate din fișă pe cele moarte, ceea ce o copie din `content` nu ar urma.

## Verificare de conținut (`flaggedByClaude`)

- Marchezi ca dubios orice site de piraterie, de ocolire a paywall-urilor sau de distribuție ilegală de conținut cu copyright: scrii motivul în `flaggedByClaude`. Elementul rămâne în lot (importul îl respinge și îl trece în jurnal, cu motivul tău); nu îl omiți și nu îl ascunzi.
- Poți propune domenii pentru lista de domenii interzise doar în `proposedBlockedDomains` din lot (apar în raport). Nu editezi niciodată `data/blocked-domains.txt`.

## Notițele mele

- „Notițele mele” (`myNotes`) sunt ale utilizatorului. Nu le scrii niciodată, nu le pui în lot (schema le respinge) și nu le rescrii.
- Nu scrii direct în `data/`; modifici catalogul doar prin `whenkit import`.
