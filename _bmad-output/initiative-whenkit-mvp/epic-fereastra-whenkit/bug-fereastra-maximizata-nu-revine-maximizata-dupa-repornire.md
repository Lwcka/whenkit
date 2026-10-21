---
id: 18
type: bug
title: "Fereastra maximizată nu revine maximizată după repornire"
parent: epic-fereastra-whenkit
covers: [CAP-8]
after: [17]
refined: true
hitl: true
risk: low
severity: P3
---

# Fereastra maximizată nu revine maximizată după repornire

## Description

Autorul maximizează fereastra, o închide și o pornește din nou. WhenKit revine la dimensiunea normală, nu maximizat, deși tema, poziția și dimensiunea normală se păstrează corect. Fereastra trebuie să revină în starea în care a fost închisă: maximizată, dacă așa era. Pasul uman: autorul confirmă pe aplicația instalată.

## Reproduction

1. WhenKit 0.1.0 instalat din commit-ul `ae6fba9b1c139de7caac35086ea7ccd018a0659c`, Windows 11.
2. Fereastra nemaximizată, mutată și redimensionată. Apoi maximizată, cu butonul nativ sau cu dublu-click pe bara de titlu.
3. Închisă cu X și pornită din nou din meniul Start.
4. Rezultat: fereastra apare la poziția și dimensiunea normale de dinainte de maximizare. `%APPDATA%\whenkit\desktop\window-state.json` conține doar `version`, `theme` și `bounds` (verificarea 2.16, A9).
5. Așteptat: fereastra pornește maximizată, iar butonul nativ de restaurare o readuce la poziția și dimensiunea normale salvate.

## Cause Hypothesis

La închidere, main-ul salvează doar dimensiunea normală a ferestrei, nu și dacă era maximizată. Formatul din AD-20 (`{ version, theme?, bounds? }`) nu are un câmp pentru asta, deci la pornire nimic nu îi spune main-ului să maximizeze fereastra.

## Acceptance Criteria

1. **Fereastra maximizată revine maximizată**
   **Given** fereastra maximizată la închidere
   **When** WhenKit pornește din nou
   **Then** fereastra e maximizată pe ecranul pe care a fost închisă, fără să apară întâi la dimensiunea normală
   **And** butonul nativ de restaurare o readuce la poziția și dimensiunea normale de dinaintea maximizării
2. **Fereastra nemaximizată se comportă ca acum**
   **Given** fereastra nemaximizată la închidere
   **When** WhenKit pornește din nou
   **Then** apare la poziția și dimensiunea salvate, nemaximizată; o poziție în afara oricărui ecran se ignoră, ca acum
3. **Fișierele vechi de stare rămân valabile**
   **Given** un `window-state.json` scris de versiunea de acum, fără starea maximizată, sau un fișier corupt
   **When** WhenKit pornește
   **Then** fișierul vechi se citește ca nemaximizat, iar cel corupt dă valorile implicite, ca acum
4. **Testele acoperă condiția găsită**
   **Given** testele main-ului
   **When** rulează
   **Then** un test care pică pe defect și trece după reparație acoperă salvarea și citirea stării maximizate, iar câte un test acoperă fișierul fără câmpul nou și fereastra nemaximizată
5. **Sau: nicio schimbare necesară, cu dovadă**
   **Given** reproducerea
   **When** e rulată pe codul curent
   **Then** fereastra revine deja maximizată, cu dovada trecută în Notes; acest criteriu le înlocuiește pe 1–4

## References

- parent — _bmad-output/initiative-whenkit-mvp/epic-fereastra-whenkit/epic-fereastra-whenkit.md
- architecture — _bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md, AD-20 („Preferințe”)
- ux — _bmad-output/initiative-whenkit-mvp/ux-whenkit/EXPERIENCE.md, Responsive & Platform („își amintește poziția și dimensiunea”)
- evidence — _bmad-output/initiative-whenkit-mvp/epic-fereastra-whenkit/story-aplicatia-instalata-pe-catalogul-real-plan.md, Verification Result

## Notes

- Decision: starea maximizată intră în `window-state.json`; AD-20 se extinde întâi prin `bmad-architecture`, înainte de build (autorul, 2026-10-21).
- Decision: autorul a spus „fullscreen”, dar a descris maximizarea (butonul nativ sau dublu-click pe bara de titlu). WhenKit nu are mod fullscreen (2026-10-21).
- Decision: câmpul nou din `window-state.json` e opțional, iar versiunea formatului nu crește. Un fișier fără el rămâne valabil (criteriul 3). La fel la 19.
- Decision: după 17, pentru că ambele pot atinge partea temei din main; tot de el depinde 19, care schimbă același fișier de stare (2026-10-21).
