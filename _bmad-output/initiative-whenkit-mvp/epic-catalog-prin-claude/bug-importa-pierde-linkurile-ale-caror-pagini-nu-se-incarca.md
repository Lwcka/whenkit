---
id: 15
type: bug
title: "/importa pierde linkurile ale căror pagini nu se încarcă"
parent: epic-catalog-prin-claude
covers: [CAP-6, CAP-4]
after: [11]
refined: true
hitl: true
risk: medium
severity: P2
---

# /importa pierde linkurile ale căror pagini nu se încarcă

## Description

Când pagina unui link nu se încarcă la documentare, `/importa` lasă linkul în afara lotului și îl pomenește doar în rezumatul din chat. Apoi șterge fișierul de input, iar linkul nu mai apare nici în catalog, nici în jurnalul de respinse. Ar trebui să intre în lot, scris doar din ce spune inputul, ca verificarea să decidă: respins cu motiv în jurnal sau primit. Pasul uman: autorul reia `/importa` pe un input cu isladjan.com și unscreen.com și confirmă rezultatul.

## Reproduction

1. Importul real din 2026-10-15, workspace `C:\Users\Luca\Programe\whenkit`, codul de la commit-ul `b6e5f84`.
2. `input/inspire.txt` conține `https://isladjan.com/`, al cărui certificat TLS e invalid. `input/20 sites.png` conține `https://unscreen.com`, care face redirect spre canva.com, iar acesta răspunde 403 programelor.
3. Se rulează `/importa`.
4. Rezultat: Claude raportează ambele linkuri în chat ca nefuncționale. Lotul nu le conține, importul iese cu cod 0 și fișierele de input se șterg. `whenkit list --json` și `whenkit rejections --json` nu conțin niciunul dintre ele.
5. Așteptat (`card-writing-rules.md`, Generale): ambele ajung în lot, doar din input. isladjan.com e respins cu `tls_error` și apare în jurnal. unscreen.com primește verdictul verificării: intră cu nota `blocks_automation` dacă răspunde 403, sau e respins cu motiv. Raportul semnalează fișa ca nedocumentată.

## Cause Hypothesis

Skill-ul `/importa` urmează regula veche din spec („nu documentează din memorie un site care nu se încarcă; îl raportează”). Pasul lui de documentare îi spune lui Claude să scoată din lot un site care nu se încarcă și să-l pună doar în rezumatul final. Fișierul de reguli comun din workspace (`reguli-fise.md`, la Generale) are aceeași regulă veche. Spec-ul s-a schimbat în commit-ul `e38b3cc`.

## Acceptance Criteria

1. **Linkul care nu se încarcă intră în lot**
   **Given** un fișier de input cu un link a cărui pagină nu se încarcă la documentare
   **When** `/importa` îl procesează
   **Then** linkul apare în lot, scris doar din ce spune inputul, fără documentare din memorie, și primește verdictul verificării: respins cu motiv în jurnal sau adăugat (cu nota pusă de verificare, dacă există)
2. **Raportul semnalează fișa nedocumentată**
   **Given** un astfel de element adăugat în catalog
   **When** `/importa` raportează rezultatul
   **Then** fișa e numită ca nedocumentată, iar utilizatorul află că o poate rescrie ulterior cu un `update`
3. **Niciun link din input nu se pierde**
   **Given** importul unui fișier de input încheiat cu cod 0
   **When** fișierul de input se șterge
   **Then** fiecare link din el e în catalog sau în jurnalul de respinse; rezumatul final nu mai are o listă de linkuri sărite
4. **Workspace-urile existente află de schimbare**
   **Given** un workspace inițializat cu șablonul de dinainte
   **When** rulează o comandă `whenkit`
   **Then** avertismentul de șablon vechi cere `whenkit init`
5. **Testele acoperă regula nouă**
   **Given** testele fișierelor skill-ului
   **When** rulează
   **Then** verifică faptul că skill-ul și fișierul de reguli comun spun regula nouă și niciunul nu mai spune să lase linkul în afara lotului
6. **Sau: nicio schimbare necesară, cu dovadă**
   **Given** reproducerea
   **When** e rulată pe codul curent
   **Then** linkurile ajung deja în catalog sau în jurnal, cu dovada trecută în Notes; acest criteriu le înlocuiește pe 1–5

## References

- parent — _bmad-output/initiative-whenkit-mvp/epic-catalog-prin-claude/epic-catalog-prin-claude.md
- spec — _bmad-output/initiative-whenkit-mvp/spec-whenkit/card-writing-rules.md, Generale
- spec — _bmad-output/initiative-whenkit-mvp/spec-whenkit/workspace-and-import-flow.md, Fluxul de import
- spec — _bmad-output/initiative-whenkit-mvp/spec-whenkit/verification-rules.md
- spec — _bmad-output/initiative-whenkit-mvp/spec-whenkit/test-scenarios.md, rândul inspire.txt
- evidence — _bmad-output/initiative-whenkit-mvp/spec-whenkit/.memlog.md, intrarea despre importul real (tichetul 14)

## Notes

- Decision: opțiunea B, aleasă de autor pe 2026-10-15: linkurile care nu se încarcă merg totuși la verificare.
- Decision: fișa unui site care nu s-a încărcat conține doar ce spune inputul, iar ce lipsește se scrie minim (spec, 2026-10-15).
- Decision: `hitl: true`, ca la tichetul 11: criteriile 1–3 descriu ce face Claude într-o sesiune `/importa`, deci le confirmă autorul reluând reproducerea (2026-10-15).
- Decision (2026-10-15, confirmată de autor): pentru un link venit fără descriere (ex. isladjan.com), „minim” înseamnă: `whatItDoes` spune că pagina nu s-a încărcat la import, plus ce reiese din input; o singură situație, cea pe care inputul o susține; o categorie, cea mai apropiată din listă după contextul inputului; fără cuvinte-cheie inventate.
