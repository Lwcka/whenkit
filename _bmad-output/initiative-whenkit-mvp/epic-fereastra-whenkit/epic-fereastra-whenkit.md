---
type: epic
title: "Fereastra whenkit"
parent: initiative-whenkit-mvp
covers: [CAP-8, CAP-9, CAP-10, CAP-11, CAP-13]
after: [epic-catalog-prin-claude]
assignee: ""
risk: medium
status: done
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
6. Aplicația instalată se numește WhenKit, pornește mereu pe Toolbox → Toate, își păstrează tema și poziția după repornire, iar a doua pornire aduce fereastra existentă în față.

## Boundaries

Driverul desktop (`src/desktop/main`, `preload`, `renderer`), contractul IPC (`src/shared/ipc.ts`), preferințele ferestrei (AD-20), extinderea `CatalogStore` / `SqliteCatalogStore` și cazurile de utilizare din `core` pe care doar fereastra le cere (snapshot, căutare, editare, notițe, ștergere, categorii, export). Nu: importul, verificarea, CLI-ul, skill-urile (epic-catalog-prin-claude).

## References

- spec — _bmad-output/initiative-whenkit-mvp/spec-whenkit/spec-whenkit.md, secțiunea Capabilities; companionii ui-screens.md, entry-model.md
- ux — _bmad-output/initiative-whenkit-mvp/ux-whenkit/DESIGN.md (aspectul), EXPERIENCE.md (comportamentul), mockups/ (machetele ecranelor-cheie)
- architecture — _bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md, AD-2, AD-3, AD-4, AD-5, AD-7, AD-8, AD-9, AD-10, AD-12, AD-13, AD-15, AD-16, AD-18, AD-19, AD-20
- constraint — spec-whenkit.md, secțiunea Constraints

## Notes

- Decision: indexul `entries_fts` e creat și întreținut de `SqliteCatalogStore` în epic-catalog-prin-claude (la fiecare scriere); acest epic doar îl interoghează pentru căutarea text (2026-10-13).
- Source conflict: EXPERIENCE.md, `search-box` — „Ordinea rezultatelor: relevanța FTS” vs AD-10 — `entries:search` întoarce doar id-uri, afișate în ordinea instantaneului, iar renderer-ul nu reordonează. Rezolvat în favoarea AD-10 (vezi decizia de mai jos); EXPERIENCE.md corectat prin `bmad-ux` (2026-10-19).
- Decision: fereastra nu migrează catalogul; o bază cu migrări în așteptare dă `DATABASE_NEEDS_MIGRATION` (app-error), iar store-ul primește un mod care scrie fără să migreze; migrările rămân doar la CLI (decizia autorului, 2026-10-19).
- Decision: rezultatele căutării apar în ordinea instantaneului (AD-10), nu după relevanța FTS (decizia autorului, 2026-10-19).
- Decision: convențiile renderer-ului amânate de arhitectură (forma depozitului, stilizarea după tokeni, biblioteca Markdown) și dependențele noi (jsdom, Testing Library, biblioteca Markdown, lucide-react, Cascadia Mono) le fixează primul tichet care le folosește, nu toate primul tichet; fiecare trece versiunea în Stack prin `bmad-architecture`, în aceeași sesiune (decizia autorului, 2026-10-19).
- Decision: 16 intrări într-o singură linie de lucru; cadrul ferestrei e împărțit în ciclul de viață (main) și cadrul vizual, iar fișa în fișă + navigare și Markdown + linkuri externe; editarea din UI rămâne un singur tichet (decizia autorului, 2026-10-19).
- Decision: firul de pornire e intrarea 1 (snapshot → IPC → depozit → carduri simple în ambele tab-uri, cu erorile de pornire); după cadru vine întâi răsfoirea, apoi actualizarea live (AD-10), cea mai nesigură parte (2026-10-19).
- Decision: `ipc.ts`, preload, handlerii din main, `ports.ts` și `SqliteCatalogStore` sunt extinse de mai multe intrări doar prin adăugare, în ordinea din `tickets.toml`; scrierile prin IPC trec toate prin helperul din intrarea 5, care emite `catalog:changed` și întoarce DTO-urile schimbate (2026-10-19).
- Decision: curățenia (15) înaintea verificării pe aplicația instalată (16), ca în primul epic; problemele găsite acolo devin tichete de bug (2026-10-19).
- Decision: verificarea pe aplicația instalată (16, 2026-10-21) a trecut Done when 1–6; ce a găsit devine intrările 17–19 (bug-uri) și 20 (decizia 1B), plus povestea `/adauga` din `backlog/` (decizia 2A) (2026-10-21).
- Decision: pentru intrarea 20, EXPERIENCE.md (Information Architecture, Component Patterns, Flow 7), DESIGN.md (`entry-card`, meta) și macheta `key-learn-import.html` trec la „colecție · N concepte” prin `bmad-ux`, înainte de build (2026-10-21).
- Decision: la intrarea 20 se schimbă doar fereastra și exportul. CLI-ul (`whenkit show`, motivele de import) și skill-urile păstrează „umbrelă” ca termen tehnic, pentru că acolo le citește mai ales Claude (opțiunea 2A a autorului, 2026-10-21).
- Decision: 20 și povestea `/adauga` din `backlog/` nu depind una de alta; ambele schimbă `strings.ro.ts`, la chei diferite, iar linia de lucru e una singură, deci nu rulează în paralel (2026-10-21).
- Decision: fără a doua curățenie după 17–20: sunt reparații mici, fiecare cu revizia ei (2026-10-21).
- Decision: problema amânată cu fonturile Cascadia Mono inline e închisă fără tichet: în build sunt inline doar variantele `woff` de rezervă, aflate după `woff2`, deci nu se cer niciodată (2026-10-21).
- Decision: epicul e închis pe 2026-10-21, după verificarea de închidere (toate cele 20 de intrări done, Done when 1–6 îndeplinite pe aplicația instalată, 1581 de teste) și confirmarea autorului pentru 2.17–2.20; deferred-work.md gol.
- Waits on epic-catalog-prin-claude because: citește și scrie prin nucleul și SqliteCatalogStore construite acolo și lucrează pe catalogul real importat.
