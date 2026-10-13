---
type: initiative
title: "whenkit MVP: un catalog personal verificat, în care cauți după problemă"
parent: none
covers: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7, CAP-8, CAP-9, CAP-10, CAP-11, CAP-12, CAP-13]
after: []
assignee: ""
risk: medium
---

# whenkit MVP: un catalog personal verificat, în care cauți după problemă

## Description

Resursele salvate haotic de Luca (screenshot-uri cu liste, link-uri fără descriere, notițe de concepte) devin un catalog verificat, în română, pe care îl răsfoiește într-o aplicație desktop și îl interoghează prin Claude Code. Spec-ul deține capabilitățile, constrângerile și non-goals; arhitectura deține regulile AD-1…AD-13.

## Outcome

Luca găsește resursa potrivită pentru o problemă fără să-și amintească numele ei; semnalul e succesul din spec: materialele de test reale importate, iar remove.bg găsit prin categorie, prin căutarea „fundal” și prin `/gaseste`.

## Done when

1. Materialele de test reale (`50 github repo/`, `20 sites.png`, `inspire.txt`, `API/`), importate cu `/importa` în workspace-ul `C:\Users\Luca\Programe\whenkit\`, dau rezultatele din `test-scenarios.md`, iar `input/` rămâne gol.
2. remove.bg se găsește prin bara de categorii, prin căutarea „fundal” și prin `/gaseste`.
3. Toate capabilitățile CAP-1…CAP-13 funcționează în aplicația instalată pe laptop și în CLI-ul `whenkit` disponibil în terminal, nu doar în modul de dezvoltare.
4. Autorul declară MVP-ul gata.

## Boundaries

Aplicația desktop whenkit, CLI-ul ei și șablonul workspace-ului (cu skill-urile `/importa` și `/gaseste`), pe laptopul autorului. În afara scopului: tot ce listează spec-ul la Non-goals. Firul de pornire: proiectul Forge pornește, `whenkit init` creează workspace-ul, un lot cu o resursă e importat și apare în `whenkit list --json`.

- Touch point: API-ul public GitHub — doar citit pentru metadatele repo-urilor, fără cheie; owner: epic-catalog-prin-claude
- Touch point: Claude Code — rulează skill-urile din workspace, nu e modificat; owner: epic-catalog-prin-claude

## References

- spec — _bmad-output/initiative-whenkit-mvp/spec-whenkit/spec-whenkit.md, secțiunea Capabilities
- architecture — _bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md
- constraint — spec-whenkit.md, secțiunea Constraints
- test data — C:\Users\Luca\Personal\ (în afara repo-ului; scenariile în spec-whenkit/test-scenarios.md)

## Notes

- Decision: două epicuri — întâi „Catalogul se umple prin Claude”, apoi „Fereastra whenkit”; primul e folosibil singur prin `/gaseste` înainte să existe fereastra (decizia autorului, 2026-10-13).
- Decision: fără epic separat pentru platformă; scheletul (Forge, structura de foldere, teste) e primul tichet al primului epic, pentru că un singur autor și un singur repo nu justifică un epic doar de setup (2026-10-13).
- Decision: fără epic separat pentru Learn; conceptele trec prin același import și același ecran (2026-10-13).
- Decision: „producție” înseamnă aici aplicația instalată pe laptopul autorului și CLI-ul `whenkit` disponibil în terminal; fără server, fără CI (arhitectura, Deferred).
- Waits on epic-catalog-prin-claude because: fereastra citește și scrie prin nucleul și baza de date construite în primul epic.
