# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stadiul proiectului

Încă nu există cod. Stack-ul, stocarea datelor, furnizorul AI și MVP-ul **nu sunt decise** (vezi `PROJECT_BRIEF.md` §10). Nu presupune un stack și nu inventa comenzi de build/test. Actualizează această secțiune după ce se iau deciziile.

`PROJECT_BRIEF.md` este doar o referință de start: notițele inițiale ale autorului despre **ce** construim și **de ce**. Informațiile din el vor fi extrase și structurate în artefactele BMad din `_bmad-output/`, care devin apoi sursa de adevăr, iar brief-ul va fi șters. Până atunci, citește-l înainte de a propune ceva de produs sau de arhitectură. După ștergere, actualizează trimiterile la secțiunile lui din acest fișier (§4, §6, §9.2, §10) ca să indice artefactele BMad. Numele de lucru din brief („Resource Toolbox”) e diferit de numele folderului/proiectului (`whenkit`); numele final e încă o întrebare deschisă.

## Produsul, pe scurt

Catalog personal de resurse pentru developeri (repo-uri, site-uri, unelte) cu două zone separate: **Toolbox** (unelte pe care le folosești) și **Learn** (concepte pe care le înveți). Diferențiatorul este căutarea **după problemă**, prin câmpul „Când o folosesc”, nu după nume.

Decizii deja luate, care trebuie respectate de orice arhitectură (brief §4, §6, §9.2):

- Resursele intră **prin aplicație** (adăugare, editare, ștergere, căutare), niciodată scrise în cod.
- Datele sunt **separate de cod**, într-un format portabil, cu export posibil.
- **Verificarea înainte de adăugare** e obligatorie și trebuie să fie un **modul separat și testabil**. Regula: în caz de dubiu, resursa se respinge și utilizatorul primește o alertă cu motivul.
- „Personal-first, multi-user ready”: câmp `owner_id`/`user_id` în modelul de date de la început; furnizorul AI în spatele unei abstracții (de ex. `AIProvider`); toate cheile și setările în `.env` (ignorat de git). **Nu** se construiesc acum: autentificare, conturi, hosting, plăți.
- Cod și README scrise ca și cum proiectul ar fi public (portofoliu).

Datele de test reale (screenshot-uri și `inspire.txt`) sunt în `C:\Users\Luca\Personal\`, în afara repo-ului. Sunt input pentru funcția de import și nu se transcriu manual. `20 sites.png` conține intenționat site-uri care trebuie respinse.

## Cum vrea autorul să lucrăm

Proiectul e și pentru învățare: explică raționamentul, nu doar codul. La deciziile importante dă 2–3 opțiuni cu pro și contra și contrazice-l direct când greșește. Planificarea tehnică (spec, arhitectură, tichete) și implementarea se fac prin skill-urile BMad, nu printr-un plan separat în plan mode, ca să nu planificăm de două ori. Ordinea pașilor o alege autorul; dacă nu e clar ce urmează, întreabă skill-ul `bmad`. Se lucrează pas cu pas.

## BMad Method

Workflow-ul de planificare și implementare folosește skill-urile BMad instalate la nivel de proiect în `.claude/skills/` (sursa și hash-urile sunt în `skills-lock.json`). `bmod-core-tools` și `bmod-method` sunt doar metadate de modul și nu se invocă niciodată. Pentru a afla ce skill urmează, folosește skill-ul `bmad`, care răspunde din help-ul modulelor instalate.

- `_bmad/config.toml`: configurația proiectului. Artefactele BMad (spec-uri, arhitectură, tichete) se scriu în `_bmad-output/`.
- `_bmad/custom/*.user.toml`: răspunsuri personale, ignorate de git.
- `_bmad/scripts/` și `_bmad/<modul>/scripts/` sunt generate de setup. Nu le edita de mână; se regenerează cu `bmad setup`.

Toate scripturile BMad cer `uv`. Verificarea instalării:

```
uv run --no-cache .claude/skills/bmad/scripts/setup.py --project-root . --skill .claude/skills/bmad --root .claude/skills --status
```

Actualizarea skill-urilor: `npx skills update -p -y`. Adăugarea unui skill: `npx skills add bmad-code-org/BMAD-METHOD --skill <nume> -a claude-code -y`, apoi rulează din nou `bmad setup`.
