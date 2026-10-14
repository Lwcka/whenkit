# whenkit: cum lucrezi cu catalogul

Acesta e workspace-ul aplicației **whenkit**: un catalog personal de resurse pentru developeri, în română, cu două zone: **Toolbox** (unelte pe care le folosești) și **Learn** (materiale și concepte pe care le studiezi). Tu ești „creierul”: documentezi, clasifici și scrii fișele. Aplicația e catalogul: verifică și salvează. Fișierul acesta e gestionat de aplicație și se rescrie la fiecare `whenkit init`; nu îl edita.

## Folderele

| Cale | Ce conține |
|---|---|
| `input/` | materialele de importat (screenshot-uri, fișiere `.txt` cu linkuri); consumabile, ale utilizatorului |
| `batches/` | loturile JSON scrise de tine; **aici** scrii loturile, niciodată în `input/` |
| `data/` | catalogul (`catalog.sqlite`), copiile de siguranță și `blocked-domains.txt`; **nu scrii niciodată aici** |
| `.claude/skills/importa/` | skill-ul `/importa`: transformă materiale în fișe |
| `.claude/skills/gaseste/` | skill-ul `/gaseste`: caută în catalog după problemă |
| `.claude/skills/reguli-fise.md` | regulile de scriere a fișelor (limbă, câmpuri, ton); citește-le înainte să scrii orice fișă |
| `batch.schema.json` | JSON Schema a lotului de import (aceeași cu `whenkit schema`) |

## Comenzile CLI

Singura cale de a citi și de a scrie în catalog e CLI-ul `whenkit`. Cu `--json`, comenzile scriu pe stdout **un singur document JSON** (și la eroare); fără el, text pentru om. Parsează JSON-ul, nu textul.

| Comandă | Ce face |
|---|---|
| `whenkit import <lot> [--json] [--force <ref>]…` | validează lotul, verifică linkurile, adaugă sau actualizează fișele, scrie raportul. `--force <ref>` (repetabil) scrie totuși un element respins doar de verificare și îl marchează „forțat”; se folosește doar la cererea explicită a utilizatorului |
| `whenkit list [--json]` | toate fișele, fără conținutul conceptelor |
| `whenkit show <id> [--json]` | o fișă completă |
| `whenkit categories [--json]` | categoriile fiecărei zone; folosește-le pe acestea, nu inventa altele |
| `whenkit rejections [--json]` | jurnalul respinselor: elementele respinse, cu motive |
| `whenkit schema` | schema JSON a lotului |
| `whenkit init [cale]` | actualizează fișierele acestui workspace (CLAUDE.md, skill-uri, reguli, schema lotului); în `data/` și `input/` nu suprascrie și nu șterge nimic, doar creează ce lipsește. Rulează-l fără `[cale]`: o cale diferită mută workspace-ul configurat |

Coduri de ieșire:

| Cod | Sens |
|---|---|
| 0 | succes (un lot cu elemente respinse iese tot cu 0: respinsele sunt în raport și în jurnal) |
| 1 | intrare invalidă: comandă sau argumente greșite, lot care nu respectă schema, id necunoscut |
| 2 | configurare: workspace neconfigurat sau invalid, catalog lipsă |
| 3 | indisponibil: bază de date blocată sau de altă versiune, fără internet |
| 4 | eroare internă a aplicației |

La orice cod diferit de 0 **nu s-a scris nimic** în catalog. Dacă stderr avertizează că fișierele workspace-ului sunt mai vechi decât aplicația, spune-i utilizatorului să ruleze `whenkit init`.

## Reguli

1. **Nu scrii niciodată direct în `data/`.** Catalogul se modifică doar prin `whenkit import`.
2. **Nu atingi „Notițele mele”.** Câmpul e al utilizatorului; nu îl scrii în loturi și nu îl rescrii.
3. **Loturile se scriu în `batches/`**, un lot per fișier de input, nu în `input/`. Un lot se șterge **doar după** ce `whenkit import` a ieșit cu cod 0; fișierul din `input/` se șterge tot doar după import reușit.
4. **Contractul lotului** e `batch.schema.json` (sau `whenkit schema`). Dacă `whenkit import` respinge lotul cu cod 1, corectează lotul după mesajele din raport și reia; nu ocoli schema.
5. **Cererile libere** se rezolvă tot prin lot. De exemplu „rescrie fișa X după regulile noi”: găsești fișa cu `whenkit list`/`show`, scrii un lot cu un element `update` (cu `id`-ul fișei) și îl imporți. Un `update` nu atinge „Notițele mele”, proprietarul sau data adăugării.
6. **Fără ocoliri la verificare.** În caz de dubiu asupra unei resurse, o semnalezi în lot (judecata ta completează verificarea deterministă); nu o ascunzi și nu folosești `--force` din inițiativă proprie.
7. **Limba:** fișele se scriu în română, după `.claude/skills/reguli-fise.md`.
