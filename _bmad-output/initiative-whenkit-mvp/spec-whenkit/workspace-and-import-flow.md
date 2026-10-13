# Workspace și fluxul de import

## Două contexte separate

| Context | Unde | Conține | Folosit pentru |
|---|---|---|---|
| Repo `whenkit` | `C:\Users\Luca\Proiecte\whenkit\` | cod, CLAUDE.md de dezvoltare, BMad, **șablonul** workspace-ului | dezvoltarea aplicației |
| Workspace | implicit `C:\Users\Luca\Programe\whenkit\`, configurabil; niciodată în repo sau într-un subfolder al lui | date, input, CLAUDE.md de runtime, skill-uri instalate | folosirea aplicației (import, căutare) |

Motivul separării: Claude Code încarcă CLAUDE.md din folderul curent **și din toate folderele părinte**. Un workspace în repo ar moșteni contextul de dezvoltare și skill-urile BMad.

## Structura workspace-ului

```
whenkit/
├── CLAUDE.md            ← instrucțiuni de runtime: „Cum lucrezi cu catalogul”
├── .claude/skills/
│   ├── importa/         ← /importa
│   ├── gaseste/         ← /gaseste
│   └── (fișier de reguli comun = card-writing-rules.md)
├── input/               ← materialele de importat (consumabile)
└── data/
    ├── catalogul        (format → bmad-architecture)
    ├── categorii        (listă Toolbox + Learn, editabilă)
    ├── domenii interzise
    └── jurnal de respinse
```

CLAUDE.md de runtime conține: unde e fișierul de reguli, comenzile CLI ale aplicației, regula „nu suprascrii niciodată Notițele mele”, regula „nu scrii direct în `data/`”. Acoperă și cererile libere (ex. „rescrie fișa X după regulile noi”).

## Fluxul de import

```
input/fișier  ─┐
/importa <link|text> ─┼─► /importa (Claude Code)
jurnal respinse ─┘        │ 1. extrage candidații (vision pe screenshot, linkuri din .txt)
                          │ 2. vizitează fiecare link, documentează
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
- Ștergerea fișierului din `input/` se face **doar după import reușit**.
- Nu se păstrează referință la fișierul sursă (catalogul e singura sursă de adevăr).
- Reluarea din jurnal: cu link corectat (trece prin verificare) sau cu `--force` (marcat în fișă).
