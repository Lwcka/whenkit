---
type: epic
title: "Catalogul se umple prin Claude"
parent: initiative-whenkit-mvp
covers: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7, CAP-12]
after: []
assignee: ""
risk: medium
---

# Catalogul se umple prin Claude

## Description

Proiectul există și rulează; workspace-ul se creează cu `whenkit init`; Claude transformă materialele din `input/` în fișe cu `/importa`, iar `whenkit import` le verifică și le salvează în SQLite; `/gaseste` răspunde din catalog. Totul funcționează din terminal, înainte să existe fereastra. Capabilitățile sunt în spec; regulile, în arhitectură.

## Outcome

Autorul își are catalogul real populat și verificat și găsește resurse după problemă prin `/gaseste`; semnalul e Done when 1–2.

## Requirements

Sursa sunt capabilitățile din spec, citate prin id: CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7, CAP-12 (spec-whenkit.md, secțiunea Capabilities, plus companionii).

## Done when

1. Materialele de test reale, importate cu `/importa` în `C:\Users\Luca\Programe\whenkit\`, dau rezultatele din `test-scenarios.md` (inclusiv 12ft.io, libgen, sci-hub, pdfdrive respinse cu motiv; `httpss://gutenberg.org` respins și apoi reimportat corectat; conceptele API cu umbrela „Tipuri de API”), iar `input/` rămâne gol.
2. `/gaseste ce am pentru a scoate fundalul dintr-o poză?` răspunde cu remove.bg, citând situațiile din fișă.
3. Testele modulului de verificare acoperă fiecare rând din `verification-rules.md` și trec fără internet.
4. Un lot invalid nu scrie nimic, iar un element `update` nu atinge „Notițele mele”, proprietarul și data adăugării (test automat).
5. Comanda `whenkit` rulează din orice terminal pe laptop, iar o sesiune Claude Code deschisă în workspace nu încarcă CLAUDE.md-ul de dezvoltare.

## Boundaries

Nucleul (`src/core`), adaptoarele (`src/adapters`), CLI-ul (`src/cli`), șablonul workspace-ului (`workspace-template/`) și scheletul întregului proiect, inclusiv o fereastră Electron goală care dovedește că scheletul pornește. Nu: ecranele aplicației, IPC-ul de date, exportul, gestionarea categoriilor din UI (epic-fereastra-whenkit). Garanția că importul nu atinge „Notițele mele” se livrează aici; editarea lor din UI, în epicul următor.

## References

- spec — _bmad-output/initiative-whenkit-mvp/spec-whenkit/spec-whenkit.md, secțiunea Capabilities; companionii workspace-and-import-flow.md, verification-rules.md, entry-model.md, card-writing-rules.md, categories-seed.md, test-scenarios.md
- architecture — _bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md, AD-1…AD-8, AD-11, AD-13
- constraint — spec-whenkit.md, secțiunea Constraints

## Notes

- Handoff către epic-fereastra-whenkit: scheletul Forge cu fereastra goală; `SqliteCatalogStore` cu toată schema v1 (categorii, `links` cu cascade, `meta.owner_id`, `entries_fts` întreținut la fiecare scriere); `resolveWorkspace()`; portul `CatalogStore`, pe care epicul următor îl extinde cu editare, ștergere, categorii și export.

- Decision: firul de pornire sunt intrările 1–3 (schelet, stocare, import add + list), nu doar prima, pentru că scheletul singur nu trece prin straturile de date (2026-10-13).
- Decision: o singură linie de lucru, 14 intrări, pentru că pipeline-ul de import e atins de aproape toate; peste intervalul obișnuit de 8–12, acceptat pentru un singur autor (2026-10-13).
- Decision: curățenia (13) înaintea importului real (14); problemele găsite la importul real devin tichete de bug (decizia autorului, 2026-10-13).
- Decision: planul a trecut două validări independente (subagenți), la cererea autorului (2026-10-13).
- Assumption: intrarea 5 încape într-o sesiune; dacă nu, se împarte în modulul pur de verificare și legarea în faza 2 cu verificarea prin CLI.
- Resolved: template-ul Forge vite-typescript nu mai există în Forge 8; se folosește create-electron-app@8.0.1 --template vite --typescript (review-versions.md).
