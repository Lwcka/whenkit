---
id: 17
type: bug
title: "Trecerea de la o temă la alta e sacadată"
parent: epic-fereastra-whenkit
covers: [CAP-8]
after: []
refined: true
hitl: true
risk: low
severity: P3
---

# Trecerea de la o temă la alta e sacadată

## Description

Când autorul comută tema din bara de titlu, culorile nu trec lin de la zi la noapte: trecerea se vede sacadată, cu salturi. EXPERIENCE.md, „Motion”, cere ca la comutarea temei culorile să treacă lin, în {motion.theme}, iar butonul glisant să se mute. Pasul uman: autorul confirmă trecerea în aplicația instalată.

## Reproduction

1. WhenKit 0.1.0 instalat cu `npm run make` din commit-ul `ae6fba9b1c139de7caac35086ea7ccd018a0659c`, Windows 11, catalogul real (76 de fișe, 54 în Toolbox).
2. Fereastra pe Toolbox → Toate, cu grila plină de carduri. Animation effects pornit în Windows.
3. Click pe `theme-switch` din bara de titlu, din zi în noapte, apoi înapoi.
4. Rezultat: tema se schimbă, dar trecerea e sacadată, „nu se vede clean deloc” (verificarea 2.16, A8).
5. Așteptat: o singură trecere lină a tuturor culorilor în {motion.theme}, fără salturi și fără părți care se schimbă înaintea celorlalte.

## Cause Hypothesis

Pe durata comutării, regula de tranziție a temei se aplică fiecărui element din pagină, deci browserul animează deodată culorile a sute de noduri (carduri, pastile, grila milimetrică), iar asta poate pierde cadre. În plus, unele părți nu pot trece lin: fundalurile desenate ca imagine (grila) și bara nativă a ferestrei, pe care main-ul o recolorează dintr-o dată, sar în timp ce restul se estompează. E o ipoteză, nu o soluție impusă.

## Acceptance Criteria

1. **Trecerea temei e lină**
   **Given** aplicația instalată pe catalogul real, cu lista Toolbox → Toate plină de carduri, apoi cu o fișă deschisă
   **When** autorul comută tema din zi în noapte și înapoi
   **Then** culorile trec lin, într-o singură mișcare de {motion.theme}, fără salturi vizibile
   **And** grila de fundal trece odată cu restul; butoanele native, pe care le desenează Windows, își schimbă culoarea o singură dată, într-un moment ales în timpul trecerii, fără un salt care să iasă în evidență
2. **Animation effects oprit rămâne instant**
   **Given** Animation effects oprit în Windows
   **When** autorul comută tema
   **Then** tema se schimbă instant, fără tranziție, ca acum
3. **Testele acoperă ce se poate verifica în cod**
   **Given** testele renderer-ului și ale main-ului
   **When** rulează
   **Then** trec testele existente ale temei, iar orice mecanism nou al tranziției (de exemplu ce se animă și când se încheie comutarea) are un test
4. **Sau: nicio schimbare necesară, cu dovadă**
   **Given** reproducerea
   **When** e rulată pe codul curent, pe aplicația instalată
   **Then** trecerea e deja lină, iar dovada (de exemplu o înregistrare a ecranului sau profilul de performanță din DevTools, în `npm start`) e trecută în Notes; acest criteriu le înlocuiește pe 1–3

## References

- parent — _bmad-output/initiative-whenkit-mvp/epic-fereastra-whenkit/epic-fereastra-whenkit.md
- ux — _bmad-output/initiative-whenkit-mvp/ux-whenkit/EXPERIENCE.md, Motion („Comutarea temei”)
- ux — _bmad-output/initiative-whenkit-mvp/ux-whenkit/DESIGN.md, `theme-switch`
- architecture — _bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md, AD-20 („Tema”)
- evidence — _bmad-output/initiative-whenkit-mvp/epic-fereastra-whenkit/story-aplicatia-instalata-pe-catalogul-real-plan.md, Verification Result

## Notes

- Decision: butoanele native nu se pot estompa; autorul acceptă ca ele să-și schimbe culoarea dintr-odată, într-un moment ales bine al trecerii (opțiunea 1A, 2026-10-21).
- Decision: verificarea pe aplicația instalată (2.16) o face autorul, pentru că o trecere sacadată nu se vede într-un test jsdom (2026-10-21).
