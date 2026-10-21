# Workspace și fluxul de import

## Două contexte separate

| Context | Unde | Conține | Folosit pentru |
|---|---|---|---|
| Repo `whenkit` | `C:\Users\Luca\Proiecte\whenkit\` | cod, CLAUDE.md de dezvoltare, BMad, **șablonul** workspace-ului | dezvoltarea aplicației |
| Workspace | implicit `C:\Users\Luca\Programe\whenkit\`, configurabil; niciodată în repo sau într-un subfolder al lui | date, input, CLAUDE.md de runtime, skill-uri instalate | folosirea aplicației (import, căutare) |

Calea workspace-ului o salvează `whenkit init` în `%APPDATA%\whenkit\config.json`; la dezvoltare o poate suprascrie variabila `WHENKIT_WORKSPACE`. Aplicația și CLI-ul o citesc din același loc.

Motivul separării: Claude Code încarcă CLAUDE.md din folderul curent **și din toate folderele părinte**. Un workspace în repo ar moșteni contextul de dezvoltare și skill-urile BMad.

## Structura workspace-ului

```
whenkit/
├── CLAUDE.md            ← instrucțiuni de runtime: „Cum lucrezi cu catalogul”
├── .claude/skills/
│   ├── adauga/          ← /adauga
│   ├── gaseste/         ← /gaseste
│   └── reguli-fise.md   ← fișierul de reguli comun, construit din card-writing-rules.md
├── input/               ← materialele de importat (consumabile)
├── batches/             ← loturile JSON scrise de /adauga, șterse după import reușit
└── data/
    ├── catalog.sqlite       (fișe, categorii, legături, jurnalul de respinse)
    ├── backups/             (copii automate înainte de orice migrare)
    └── blocked-domains.txt  (domenii interzise, editat doar de utilizator)
```

`whenkit init` rulat din nou actualizează fișierele șablonului (CLAUDE.md, skill-uri, reguli, schema lotului), dar nu atinge niciodată `data/` și `input/`.

Un skill retras din șablon (`importa`, redenumit `/adauga`) e scos de `whenkit init`: doar fișierele lui care vin din șablon, chiar modificate, iar folderul doar dacă rămâne gol. `data/`, `input/`, `batches/` și fișierele adăugate de utilizator rămân neatinse. Un workspace cu șablon vechi primește avertismentul care cere `whenkit init`.

CLAUDE.md de runtime conține: unde e fișierul de reguli, comenzile CLI ale aplicației, regula „nu suprascrii niciodată Notițele mele”, regula „nu scrii direct în `data/`”. Acoperă și cererile libere (ex. „rescrie fișa X după regulile noi”).

## Fluxul de import

```
input/fișier  ─┐
/adauga <link|text> ──┼─► /adauga (Claude Code)
jurnal respinse ─┘        │ 1. extrage candidații (vision pe screenshot, linkuri din .txt)
                          │ 2. vizitează fiecare link, documentează
                          │    (site care nu se încarcă: fișă doar din input, tot în lot)
                          │ 3. clasifică: zonă → fel → 1–2 categorii din listă
                          │ 4. scrie fișa în română (card-writing-rules.md)
                          │ 5. verdict pe conținut dubios + notă de verificare
                          │ 6. scrie lotul JSON
                          ▼
                    whenkit import <lot>  (cod determinist)
                          │ validare schemă → verificare (verification-rules.md)
                          │ → metadate GitHub → salvare → raport
                          ▼
                    raport în terminal ──► succes: skill-ul șterge fișierul din input/
                                         respinse: scrise în jurnal cu date complete
```

Reguli:
- **Un lot per fișier de input.** O întrerupere nu pierde loturile deja importate și ține contextul lui Claude mic.
- Ștergerea fișierului din `input/` se face **doar după import reușit**. Niciun link din input nu se pierde: fiecare ajunge în catalog sau în jurnalul de respinse.
- Nu se păstrează referință la fișierul sursă (catalogul e singura sursă de adevăr).
- Reluarea din jurnal: cu link corectat (trece prin verificare) sau cu `--force` (marcat în fișă).
- Lotul poate și **actualiza** fișe existente (ex. „rescrie fișa X după regulile noi”): elementul referă fișa prin id, trece prin verificare și nu atinge „Notițele mele”, proprietarul sau data adăugării.
