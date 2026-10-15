---
name: importa
description: Transformă materialele din input/ (screenshot-uri, fișiere text cu linkuri), un link dat direct sau elementele respinse din jurnal în fișe de catalog, prin loturi importate cu whenkit. Folosește-l când utilizatorul vrea să adauge resurse în catalog.
argument-hint: '[link | text | respinse]'
allowed-tools: Bash(whenkit:*), WebFetch, Read
---

# /importa

Transformi materiale în fișe de catalog, în română. Tu documentezi, clasifici și scrii; aplicația verifică și salvează. Nu scrii niciodată în `data/` și nu atingi „Notițele mele”: catalogul se modifică doar prin `whenkit import`. Citește `.claude/skills/reguli-fise.md` înainte să scrii prima fișă și respectă-le; forma unui lot valid o vezi în `.claude/skills/importa/exemplu-lot.json` (contractul complet e `batch.schema.json`).

Argumentul primit: `$ARGUMENTS`

## 1. Ce ai de importat

| Argument | Ce faci |
|---|---|
| lipsește | fiecare fișier din `input/`, pe rând (pasul 4) |
| un URL (începe cu `http`) | un lot cu un singur element, pentru linkul acela; nu atingi `input/` |
| `respinse` | reia elementele din jurnalul de respinse (pasul 9) |
| orice alt text | îl tratezi ca pe un text de input: scoți din el linkurile și numele de resurse, ca dintr-un fișier `.txt`; nu atingi `input/` |

## 2. Verifică workspace-ul (înainte de orice scriere)

Rulează `whenkit categories --json`. CLI-ul global află workspace-ul din `WHENKIT_WORKSPACE` sau din `config.json`, **nu** din folderul curent, deci poate scrie în alt catalog decât cel în care lucrezi.

- Dacă `workspace` din răspuns nu e folderul curent (compară căile fără să ții cont de majuscule și de tipul barei), **te oprești**: nu scrii nimic, nici lot, nici ștergeri. Spune-i utilizatorului să seteze `WHENKIT_WORKSPACE` pe acest folder sau să ruleze `whenkit init "<calea acestui folder>"` (cu calea; fără ea, `init` rezolvă același workspace greșit; iar cât timp `WHENKIT_WORKSPACE` arată în altă parte, `init` cu cale nu schimbă configurarea) și să pornească din nou.
- Dacă `whenkit categories --json` iese cu orice cod diferit de 0 (2 sau 3: de exemplu `WORKSPACE_NOT_CONFIGURED`, `CONFIG_INVALID`, `DATABASE_BUSY`, `DATABASE_NEEDS_MIGRATION`), te oprești și îi arăți utilizatorului `error.message`, care spune deja ce are de făcut. Îi sugerezi `whenkit init` (fără cale) doar la `CATALOG_NOT_FOUND` și când stderr avertizează că fișierele workspace-ului sunt mai vechi decât aplicația.
- Păstrează lista de categorii: **doar** din ea alegi categorii (pe zone). O categorie care lipsește o declari în `newCategories`; nu o inventezi pe tăcute.

## 3. Loturi rămase

Dacă `batches/` conține fișiere rămase dintr-o rulare întreruptă, le raportezi (nume și mărime) și lași utilizatorul să aleagă pentru fiecare: le reimporți (`whenkit import <lot> --json`, apoi pașii 7 și 8: la cod 0 ștergi lotul și fișierele de input care i se potrivesc) sau le ștergi. Nu continui până nu alege.

## 4. Fișierele din input/ (fără argument)

Parcurgi `input/` fișier cu fișier. **Un lot per fișier de input**, scris în `batches/<calea-fișierului-față-de-input/-cu-extensie>.json`, cu `/` înlocuit prin `--` (de exemplu `batches/inspire.txt.json`, `batches/50 github repo--1.png.json`), ca `x.txt` și `x.png` sau fișiere cu același nume din subfoldere diferite să nu se ciocnească; ordinea o alegi tu. Termini un fișier cu totul (lot, import, raport, ștergere) înainte să-l începi pe următorul.

- Se acceptă: fișiere text (`.txt`, `.md`) și imagini (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`).
- Un fișier care nu e text sau imagine (binar, arhivă, PDF etc.) nu e acceptat: îl lași pe loc, nu îl ștergi și îl raportezi la final ca sărit.
- Excepție: capturile dintr-un subfolder care sunt părți ale aceluiași subiect (de exemplu cinci capturi de notițe despre tipuri de API) le citești pe toate și scrii **un singur lot**, ca umbrela să-și poată lega copiii. Lotul se numește după folder (`batches/<folder>.json`); după import reușit ștergi toate fișierele grupului, apoi și subfolderul, dacă a rămas gol.
- Un fișier gol sau fără nimic de importat îl raportezi și îl lași pe loc.

## 5. Scrie fișele

Pentru fiecare fișier (sau link, sau text):

1. **Extrage candidații.** Pe imagini folosești `Read` (le vezi): citești numele resurselor, descrierile și linkurile. Din text scoți linkurile și numele de resurse. Notițele de concepte devin concepte.
2. **Vizitează fiecare link** cu `WebFetch` și documentează-te din ce vezi. Un site care nu se încarcă nu-l documentezi din memorie, dar **îl pui totuși în lot**, ca verificarea să decidă (îl respinge cu motiv și îl trece în jurnal, sau îl primește, cu nota ei dacă are una): niciun link din input nu se pierde. Fișa lui e **fișa minimă** din `reguli-fise.md` și conține doar ce spune inputul: `whatItDoes` începe exact cu „Nedocumentată: pagina nu s-a încărcat la import.”, urmat de ce reiese din input; o singură situație, cea pe care inputul o susține; o categorie, cea mai apropiată din listă după contextul inputului; fără cuvinte-cheie inventate. Îl ții minte ca **nedocumentat**, pentru raport. Un URL greșit ca formă (de exemplu `httpss://…`) nu-l repari: îl trimiți așa cum e scris, ca verificarea să-l respingă și să-l pună în jurnal.
3. **Clasifică:** zonă (Toolbox sau Learn), fel (`tool`, `material`, `concept`) și 1–2 categorii din lista de la pasul 2.
4. **Scrie fișa** după `reguli-fise.md` (la un site care nu s-a încărcat, doar fișa minimă de la pasul 2, nimic în plus): `whatItDoes`, 3–6 `situations` formulate ca problemă, `keywords` în română și engleză, `related` doar spre ce există, `content` și `sources` la concepte. Un input cu cel puțin 3 concepte înrudite produce și un **concept-umbrelă** cu tabel de comparație, „când alegi care” și `children` spre fiecare concept.
5. **Verdict de conținut:** pe orice site de piraterie, de ocolire a paywall-urilor sau de distribuție ilegală de conținut cu copyright îl **păstrezi în lot**, cu motivul în `flaggedByClaude` (importul îl respinge și îl trece în jurnal). Poți pune domeniul în `proposedBlockedDomains`; nu editezi `data/blocked-domains.txt`.
6. **Scrie lotul** în `batches/` (niciodată în `input/`), cu `schemaVersion` egal cu cel din `batch.schema.json`.

### Reguli de lot pe care schema JSON nu le arată

- Fiecare element are un `ref` unic: slug cu litere mici și cratime, făcut din nume (`remove-bg`). Raportul se citește înapoi după `ref`.
- `op: "add"` nu are `id` (aplicația îl generează). `op: "update"` cere `id` (UUID-ul fișei, din `whenkit list --json`) și rescrie câmpurile scrise de tine; fiecare `id` apare cel mult o dată în lot.
- `related` și `children` arată spre `ref`-ul unui alt element din lot sau spre id-ul unei fișe existente; niciodată spre elementul însuși. `children` primește doar concepte.
- Nu pui niciodată `myNotes` sau alt câmp necunoscut: schema le respinge.

## 6. Importă

Rulează `whenkit import batches/<lot>.json --json`. Pe stdout vine un singur document JSON; îl parsezi, nu citești textul. Lotul se rezolvă față de folderul curent, deci rulezi din rădăcina workspace-ului.

| Cod | Ce faci |
|---|---|
| 0 | succes: pasul 7. Elementele respinse nu sunt eroare: sunt în raport și în jurnal |
| 1 | intrare invalidă: citește `error.code` și `error.issues`. La `BATCH_INVALID` corectezi lotul după `issues` (fiecare are `path` și `message`) și reiei, **cel mult de două ori**; după a doua reluare eșuată te oprești, păstrezi lotul și fișierul de input și spui utilizatorului ce nu merge. La `BATCH_SCHEMA_OUTDATED` sau altă eroare fără `issues` te oprești și îi spui să ruleze `whenkit init` |
| 2, 3, 4 | te oprești: **păstrezi lotul și fișierul de input** și îi spui utilizatorului de ce (cod 2: configurare, cod 3: bază de date blocată sau de altă versiune, sau `OFFLINE`, adică fără internet, cod 4: eroare internă). La orice cod diferit de 0 nu s-a scris nimic în catalog |

## 7. Raportează (în română)

Din documentul de la cod 0 citești `items` după `ref` și spui, pentru fiecare element, numele fișei și rezultatul:

- `added` (adăugată), `updated` (actualizată), `warned` (adăugată cu avertisment, cu motivul), `duplicate` (există deja în catalog: numești fișa existentă din `reasons[].params.name`), `rejected` (respinsă, cu motivul).
- Explici motivele (`reasons[].code`) pe înțelesul utilizatorului: `invalid_url` (linkul nu e un URL valid), `http_error` (linkul dă eroare), `dns_not_found` (domeniul nu există), `tls_error` (certificat invalid), `connection_error` (conexiune refuzată), `blocked_domain` (domeniu interzis), `flagged_by_claude` (semnalată de tine, cu motivul), `unknown_category` (categorie inexistentă), `source_link_removed` (o sursă moartă a fost scoasă), `link_target_not_written` (o legătură nu s-a creat, fiindcă ținta nu a fost scrisă), `blocks_automation` și `no_response_at_import` (linkul n-a putut fi verificat complet), `github_archived` (repo arhivat), `github_abandoned` (repo abandonat: fără push de peste 24 de luni, cu data din `params.pushedAt`), `unknown_id` (în catalog nu există fișa cu acel id), `duplicate` (există deja: `params.name` e numele fișei existente sau, cu `params.ref`, al elementului din lot pe care îl repetă), `source_blocked_domain` (o sursă a conceptului e pe un domeniu interzis; la reluare scoți sursa aceea), `parent_requires_concept` și `parent_cycle` (legătura părinte–copil nu s-a creat: ținta nu e concept, sau ar face un ciclu), `forced_by_user` (verificare ocolită la cererea utilizatorului).
- Spui ce categorii noi s-au creat (`newCategories`), ce legături au fost ignorate (`ignoredLinks`) și ce domenii ai propus (`proposedBlockedDomains`): utilizatorul le adaugă singur în `data/blocked-domains.txt`, dacă vrea.
- Elementele respinse sunt în jurnal; spune-i că le poate relua cu `/importa respinse`.
- Numești fiecare fișă **nedocumentată** (`whatItDoes` începe cu „Nedocumentată:”) care a intrat în catalog (`added`, `updated` sau `warned`) și îi spui utilizatorului că o poate rescrie ulterior cu un `update` (de exemplu „rescrie fișa X după regulile noi”), când site-ul se încarcă.

## 8. Curăță, doar după cod 0

Abia după ce import-ul a ieșit cu **cod 0** ștergi lotul din `batches/` și fișierul de input din `input/` (și celelalte fișiere ale grupului, la un subfolder, apoi subfolderul însuși dacă a rămas gol). Cod 0 consumă fișierul chiar dacă unele elemente au fost respinse, fiindcă respinsele sunt în jurnal. La orice alt cod nu ștergi nimic. La linkul dat direct, textul dat direct și reluare ștergi doar lotul.

## 9. `/importa respinse`

1. Rulează `whenkit rejections --json` și citește `rejections`. Dacă e gol, spui asta și te oprești.
2. Pentru fiecare rând pregătești o propunere din `element` și `reasons`: linkul corectat (de exemplu `httpss://gutenberg.org` → `https://gutenberg.org`), o categorie lipsă, sau elementul rescris după schema curentă.
   - Un `batchSchemaVersion` diferit de cel din `batch.schema.json` înseamnă că rescrii elementul după schema curentă.
   - Dacă elementul are o categorie care lipsește din `whenkit categories --json`, o declari din nou în `newCategories`.
   - Un element nedocumentat (`whatItDoes` începe cu „Nedocumentată:”) îl vizitezi din nou cu `WebFetch`: dacă pagina se încarcă acum, îl documentezi complet după `reguli-fise.md`; dacă nu, rămâne fișa minimă și o numești nedocumentată în raport.
   - Elementele semnalate de tine (`flagged_by_claude`) sau pe domenii interzise (`blocked_domain`) nu se corectează: le arăți și le lași în jurnal, cu excepția cazului în care utilizatorul cere explicit altceva.
3. **Arată propunerile** (ce se schimbă, pentru fiecare element) și așteaptă acordul utilizatorului. Fără acord nu imporți nimic.
4. După acord scrii `batches/reluare-<yyyymmdd-hhmmss>.json` (data și ora curentă), cu `ref`-uri unice, îl imporți ca la pasul 6 și raportezi ca la pasul 7. Un rând din jurnal dispare doar când elementul scris păstrează același link normalizat (sau același nume, la un concept fără link); dacă corecția schimbă linkul într-un fel care îi schimbă cheia (de exemplu o greșeală în domeniu), rândul vechi rămâne în jurnal și o reluare ulterioară a lui va ieși `duplicate`: spune-i asta utilizatorului. Ce se respinge din nou rămâne.
5. `--force <ref>` (repetabil) folosești **doar** dacă utilizatorul cere explicit să treacă un element peste verificare; elementul apare apoi în catalog ca „forțat”. Nu îl propui din inițiativă.

Numele loturilor: `batches/<calea-fișierului-față-de-input/-cu-extensie>.json` (`/` înlocuit prin `--`), `batches/<folder>.json` pentru un grup dintr-un subfolder, `batches/link-<yyyymmdd-hhmmss>.json` pentru un link sau un text dat direct, `batches/reluare-<yyyymmdd-hhmmss>.json` pentru reluare.

## 10. Rezumat final

La sfârșit spui, pe scurt: câte fișe s-au adăugat, câte au fost respinse (cu motivele), câte fișe nedocumentate au intrat în catalog și ce fișiere au rămas în `input/` sau în `batches/` și de ce.
