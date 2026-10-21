---
id: 1
type: story
title: "Skill-ul /importa devine /adauga"
parent: none
covers: [CAP-6, CAP-1]
after: []
refined: true
hitl: true
risk: medium
---

# Skill-ul /importa devine /adauga

## Description

Skill-ul de import din workspace se numește `/importa`, iar când îl scrie în Claude Code autorul îl încurcă cu comenzile proprii ale lui Claude Code care încep la fel. Skill-ul se redenumește `/adauga`, cu același comportament, iar fiecare loc în care produsul îi spune utilizatorului comanda spune noul nume. `whenkit init` aduce un workspace existent la noul nume și scoate skill-ul vechi, ca să nu rămână două comenzi. Pasul uman: după merge-ul în `main`, autorul rulează `npm run build:cli` (CLI-ul legat global folosește ultimul build), apoi `whenkit init` pe workspace-ul real și un `/adauga` cu un link.

## Acceptance Criteria

1. **Un workspace nou are doar /adauga**
   **Given** un folder gol
   **When** se rulează `whenkit init` în el
   **Then** workspace-ul are skill-ul `adauga`, nu are skill-ul `importa`, iar `/adauga` acceptă toate formele de până acum: fișierele din `input/`, un link sau un text dat direct, reluarea din jurnalul de respinse
2. **Un workspace existent trece la noul nume**
   **Given** un workspace inițializat cu șablonul de dinainte, care are skill-ul `importa`
   **When** se rulează `whenkit init`
   **Then** fișierele skill-ului `importa` care vin din șablon sunt scoase, folderul lui dispare dacă rămâne gol, skill-ul `adauga` e instalat, iar `data/`, `input/` și `batches/` rămân neatinse
   **And** fișierele adăugate de utilizator în `.claude/` care nu vin din șablon rămân neatinse, inclusiv cele din folderul `importa`
3. **Workspace-urile vechi află de schimbare**
   **Given** un workspace cu șablonul de dinainte
   **When** se rulează în el o comandă care citește workspace-ul (de exemplu `whenkit list`)
   **Then** avertismentul de șablon vechi cere `whenkit init`
4. **Peste tot apare noul nume**
   **Given** produsul după schimbare
   **When** utilizatorul citește un text care îi spune ce comandă să ruleze: starea „Catalog gol” din fereastră, CLAUDE.md-ul de runtime, skill-ul `/gaseste`, fișierul de reguli al fișelor
   **Then** scrie `/adauga`; nici aceste texte, nici șablonul workspace-ului, nici vreun mesaj al CLI-ului nu mai scriu `/importa`
5. **Testele acoperă schimbarea**
   **Given** testele
   **When** rulează
   **Then** acoperă instalarea într-un folder gol (doar `adauga`), trecerea unui workspace vechi (scoaterea lui `importa`, cu `data/` și `input/` neatinse) și textul stării „Catalog gol”

## Boundaries

- Must not change: comanda CLI `whenkit import` și formatul lotului (`/adauga` le folosește, ca `/importa` până acum); comportamentul skill-ului (pașii, verdictul lui Claude, ștergerea inputului doar după import reușit); datele din catalog.
- Must not change: înregistrările (planurile tichetelor încheiate, `deferred-work.md`, jurnalele `.memlog.md`) păstrează vechiul nume.

## References

- spec — _bmad-output/initiative-whenkit-mvp/spec-whenkit/spec-whenkit.md, CAP-6 și CAP-1
- spec — _bmad-output/initiative-whenkit-mvp/spec-whenkit/workspace-and-import-flow.md, Structura workspace-ului și Fluxul de import
- ux — _bmad-output/initiative-whenkit-mvp/ux-whenkit/EXPERIENCE.md, State Patterns („Catalog gol”)
- architecture — _bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md, AD-17 (șablonul gestionat de `whenkit init`)
- evidence — _bmad-output/initiative-whenkit-mvp/epic-fereastra-whenkit/story-aplicatia-instalata-pe-catalogul-real-plan.md, Verification Result

## Notes

- Decision: noul nume e `/adauga`, opțiunea A a autorului; are aceeași formă ca `/gaseste` (2026-10-21).
- Decision: e un tichet de sine stătător în `backlog/`, nu o intrare în epic-catalog-prin-claude. Epicul acela e închis, iar redeschiderea lui ar ține pe loc tichetele din epic-fereastra-whenkit, care așteaptă ca el să fie gata (2026-10-21).
- Decision: spec-ul (prin `bmad-spec`), EXPERIENCE.md (prin `bmad-ux`) și arhitectura (prin `bmad-architecture`) trec la `/adauga` înainte de build. AD-17 primește în plus regula: `whenkit init` scoate căile retrase din șablon, dar niciodată `data/`, `input/`, `batches/` sau fișiere care nu vin din șablon (2026-10-21).
- Decision: `whenkit init` scoate doar fișierele lui `importa` care vin din șablon, chiar dacă au fost modificate (se suprascriu oricum la init), și folderul doar dacă rămâne gol; fișierele utilizatorului rămân (opțiunea 3A a autorului, 2026-10-21).
