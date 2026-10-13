---
type: epic
title: "Fereastra whenkit"
parent: initiative-whenkit-mvp
covers: [CAP-8, CAP-9, CAP-10, CAP-11, CAP-13]
after: [epic-catalog-prin-claude]
assignee: ""
risk: medium
---

# Fereastra whenkit

## Description

Aplicația desktop instalată afișează catalogul real: tab-urile Toolbox/Learn cu bara de categorii, căutarea text, fișa completă cu editare, ștergere și „Notițele mele”, gestionarea categoriilor și exportul. Fereastra se actualizează singură cât Claude importă din terminal, iar link-urile se deschid în browser. Capabilitățile sunt în spec; regulile, în arhitectură.

## Outcome

Autorul răsfoiește, caută, corectează și exportă catalogul într-o fereastră proprie; semnalul e Done when 1–3.

## Requirements

Sursa sunt capabilitățile din spec, citate prin id: CAP-8, CAP-9, CAP-10, CAP-11, CAP-13 (spec-whenkit.md, secțiunea Capabilities, plus ui-screens.md și entry-model.md).

## Done when

1. În aplicația instalată (`npm run make`), pe catalogul real, remove.bg se găsește prin categoria „Imagini & video” și prin căutarea „fundal”; cardurile Learn arată felul.
2. O editare și o notiță în „Notițele mele” persistă după repornire; ștergerea unei fișe îi elimină și legăturile; redenumirea și unificarea unei categorii actualizează toate fișele.
3. Exportul produce `catalog.json` și `fise/*.md` cu toate câmpurile, deschise cu succes în Obsidian.
4. Cu fereastra deschisă, un `whenkit import` din terminal face fișele noi vizibile în câteva secunde, fără repornire.
5. Un click pe link-ul unei fișe îl deschide în browserul implicit; fereastra nu navighează niciodată la un site extern.

## Boundaries

Driverul desktop (`src/desktop/main`, `preload`, `renderer`), contractul IPC (`src/shared/ipc.ts`) și cazurile de utilizare din `core` pe care doar fereastra le cere (editare, ștergere, categorii, export). Nu: importul, verificarea, CLI-ul, skill-urile (epic-catalog-prin-claude).

## References

- spec — _bmad-output/initiative-whenkit-mvp/spec-whenkit/spec-whenkit.md, secțiunea Capabilities; companionii ui-screens.md, entry-model.md
- architecture — _bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md, AD-3, AD-5, AD-9, AD-10, AD-12, AD-13
- constraint — spec-whenkit.md, secțiunea Constraints

## Notes

- Decision: indexul `entries_fts` e creat și întreținut de `SqliteCatalogStore` în epic-catalog-prin-claude (la fiecare scriere); acest epic doar îl interoghează pentru căutarea text (2026-10-13).
- Waits on epic-catalog-prin-claude because: citește și scrie prin nucleul și SqliteCatalogStore construite acolo și lucrează pe catalogul real importat.
