---
id: 19
type: bug
title: "La zoom mare, comutatorul de temă iese din bara de titlu"
parent: epic-fereastra-whenkit
covers: [CAP-8]
after: [18]
refined: true
hitl: true
risk: medium
severity: P3
---

# La zoom mare, comutatorul de temă iese din bara de titlu

## Description

Cu zoom mare (Ctrl+=), comutatorul de temă iese din bara de titlu și se vede deplasat față de butoanele native. EXPERIENCE.md cere zoom 80–200 % fără tăieturi. Tot aici, la decizia autorului, zoomul ales se păstrează după repornire, lucru pe care AD-20 îl excludea până acum. Pasul uman: autorul confirmă pe aplicația instalată.

## Reproduction

1. WhenKit 0.1.0 instalat din commit-ul `ae6fba9b1c139de7caac35086ea7ccd018a0659c`, Windows 11, scalarea Windows 100 %.
2. Ctrl+= de mai multe ori, până la 150 %, apoi la 200 %.
3. Rezultat: comutatorul de temă iese puțin din bara de titlu și „se vede aiure” (verificarea 2.16, L6). Restul interfeței se mărește corect.
4. Închis și repornit: zoomul revine la 100 % (L7). Așa a fost decis în AD-20 („nepersistat”), iar autorul a schimbat decizia (3A).
5. Așteptat: la orice zoom între 80 și 200 %, bara de titlu își cuprinde conținutul, aliniat cu butoanele native, iar zoomul ales revine la repornire.

## Cause Hypothesis

Înălțimea barei de titlu vine din zona barei native de deasupra ferestrei, fixată la 40 DIP, care nu urmează zoomul. Zoomul se aplică doar în renderer, prin preload, deci conținutul barei se mărește, dar bara nativă rămâne la fel. Recenzia Opus a intrării 3 a observat același lucru (deferred-work, 2026-10-19). E o ipoteză, nu o soluție impusă.

## Acceptance Criteria

1. **Bara de titlu își cuprinde conținutul la orice zoom**
   **Given** aplicația instalată, în ambele teme
   **When** zoomul e 80, 100, 150 și 200 %
   **Then** marca, titlul și comutatorul de temă încap în bara de titlu, nimic nu e tăiat și sunt aliniate vertical cu butoanele native
   **And** fereastra se trage în continuare de bara de titlu, iar butoanele native merg
2. **Zoomul se păstrează după repornire**
   **Given** zoomul pus la 150 %
   **When** WhenKit se închide și pornește din nou
   **Then** interfața și bara de titlu pornesc la 150 %; după Ctrl+0 și o nouă repornire, la 100 %
3. **Scurtăturile de zoom nu se schimbă**
   **Given** orice vedere
   **When** se apasă Ctrl+=, Ctrl+− și Ctrl+0
   **Then** zoomul crește, scade și revine la 100 % în aceiași pași și în aceleași limite, 80–200 %, ca acum
4. **Fișierele vechi de stare rămân valabile**
   **Given** un `window-state.json` fără zoom, sau cu o valoare în afara limitelor
   **When** WhenKit pornește
   **Then** zoomul e 100 %, respectiv cea mai apropiată limită
5. **Testele acoperă condiția găsită**
   **Given** testele main-ului, ale preload-ului și ale renderer-ului
   **When** rulează
   **Then** un test acoperă salvarea și citirea zoomului, unul acoperă înălțimea barei de titlu la un zoom diferit de 100 %, iar testele scurtăturilor de zoom trec ca acum
6. **Sau: nicio schimbare necesară pentru bara de titlu, cu dovadă**
   **Given** reproducerea de la pașii 2–3
   **When** e rulată pe codul curent
   **Then** bara de titlu își cuprinde deja conținutul, cu dovada trecută în Notes; acest criteriu înlocuiește doar criteriul 1, iar criteriile 2–5 rămân

## References

- parent — _bmad-output/initiative-whenkit-mvp/epic-fereastra-whenkit/epic-fereastra-whenkit.md
- architecture — _bmad-output/initiative-whenkit-mvp/architecture-whenkit/architecture-whenkit.md, AD-20 („Fereastra și renderer-ul”, zoomul)
- ux — _bmad-output/initiative-whenkit-mvp/ux-whenkit/EXPERIENCE.md, Accessibility Floor („Zoom 80–200%”) și Interaction Primitives (Ctrl+= / Ctrl+− / Ctrl+0)
- ux — _bmad-output/initiative-whenkit-mvp/ux-whenkit/DESIGN.md, `title-bar`, `theme-switch`
- evidence — _bmad-output/initiative-whenkit-mvp/epic-fereastra-whenkit/story-aplicatia-instalata-pe-catalogul-real-plan.md, Verification Result

## Notes

- Decision: zoomul se păstrează după repornire, în `window-state.json` (decizia 3A a autorului, 2026-10-21).
- Decision: AD-20 se schimbă întâi prin `bmad-architecture`, înainte de build: cine deține zoomul (main-ul, ca să potrivească bara nativă) și faptul că zoomul se salvează (2026-10-21).
- Decision: zoomul e un câmp opțional în `window-state.json`, iar versiunea formatului nu crește, ca la 18.
- Decision: după 18, care adaugă primul câmp nou în `window-state.json` (2026-10-21).
