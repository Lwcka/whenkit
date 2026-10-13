# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Acest fișier este pentru **dezvoltarea** aplicației. Claude-ul care *folosește* aplicația (import, căutare) lucrează în workspace-ul aplicației, în afara repo-ului, cu propriul CLAUDE.md de runtime (vezi mai jos).

## Stadiul proiectului

Încă nu există cod. Produsul e definit în spec-ul **`_bmad-output/initiative-whenkit-mvp/spec-whenkit/spec-whenkit.md`** și în companionii lui: aceasta e sursa de adevăr. Citește spec-ul înainte de a propune ceva de produs sau de arhitectură. Spec-ul se modifică doar prin skill-ul `bmad-spec` (e derivat din `.memlog.md`), nu de mână.

Încă **nu sunt decise**: framework-ul desktop, formatul de stocare, schema JSON a lotului de import. Ele se decid în `bmad-architecture`. Nu presupune un stack și nu inventa comenzi de build/test. Actualizează această secțiune după decizia de arhitectură.

## Structura proiectului

| Cale | Ce conține | În git? |
|---|---|---|
| `CLAUDE.md` | instrucțiunile de dezvoltare (acest fișier) | da |
| `_bmad-output/` | artefactele BMad: sursa de adevăr pentru ce construim | da |
| `_bmad-output/initiative-whenkit-mvp/` | inițiativa activă: tot ce ține de MVP (spec, apoi arhitectură și tichete) | da |
| `…/initiative-whenkit-mvp/spec-whenkit/` | spec-ul MVP-ului: `spec-whenkit.md` (kernel) + companioni + `.memlog.md` (jurnalul canonic) | da |
| `_bmad/config.toml` | configurația BMad a proiectului | da |
| `_bmad/custom/*.user.toml` | setări personale BMad, inclusiv inițiativa activă | nu |
| `_bmad/scripts/`, `_bmad/<modul>/scripts/` | generate de `bmad setup`; nu se editează de mână | da |
| `.claude/skills/` | skill-urile BMad folosite la dezvoltare (sursa în `skills-lock.json`) | da |
| `.tmp/` | fișiere de lucru ale sesiunilor (ex. `.tmp/grill-me/whenkit-mvp.md`: interviul de produs din care s-a făcut spec-ul) | nu |
| `.env` | chei și setări locale (ex. calea workspace-ului) | nu |

Când apare codul, se adaugă aici și folderul cu **șablonul workspace-ului** (CLAUDE.md de runtime, skill-urile `/importa` și `/gaseste`, regulile de scriere a fișelor), versionat în repo și instalat cu `whenkit init`.

Workspace-ul aplicației (implicit `C:\Users\Luca\Programe\whenkit\`, configurabil în `.env`) **nu** face parte din repo: conține `input/`, `data/` și skill-urile instalate. Stă în afara repo-ului pentru că Claude Code încarcă CLAUDE.md și din folderele părinte, iar contextul de dezvoltare nu trebuie să ajungă în sesiunile de import.

## Produsul, pe scurt

**whenkit**: aplicație **desktop** personală (Windows 11), în română, care catalogează resurse pentru developeri în două zone: **Toolbox** (unelte pe care le folosești) și **Learn** (materiale și concepte pe care le studiezi). Diferențiatorul este căutarea **după problemă**, prin câmpul „Când o folosesc”.

Decizii care trebuie respectate de orice arhitectură (detalii în spec, secțiunea Constraints):

- **Claude Code e „creierul”, aplicația e catalogul.** Importul, documentarea și căutarea în limbaj natural se fac prin skill-urile din workspace. Aplicația nu conține AI și nu folosește chei API în v1 (fără `AIProvider`, fără embeddings).
- În catalog se scrie **doar prin aplicație**: CLI `whenkit import` (folosit de Claude Code) și UI. Claude Code nu scrie direct în date.
- **Verificarea** e un modul separat, determinist și testabil (URL, link care răspunde, domenii interzise, duplicate), completat de judecata lui Claude pentru conținut dubios. În caz de dubiu, resursa se respinge cu motiv.
- Datele sunt separate de cod, în workspace, într-un format portabil.
- „Personal-first, multi-user ready”: `owner_id` în model de la început; setările în `.env`. **Nu** se construiesc acum: autentificare, conturi, hosting, plăți.
- **Limba:** codul e integral în engleză (identificatori, comentarii, mesaje de commit). În română sunt interfața, fișele din catalog și documentele citite de autor (README, documentație, artefacte BMad); documentele se traduc în engleză la trecerea open-source. Cod și README scrise ca pentru un proiect public.

Datele de test reale (screenshot-uri și `inspire.txt`) sunt în `C:\Users\Luca\Personal\`, în afara repo-ului. Sunt input pentru `/importa` și nu se transcriu manual. Rezultatele așteptate sunt în companionul `test-scenarios.md` al spec-ului.

## Cum vrea autorul să lucrăm

Proiectul e și pentru învățare: explică raționamentul, nu doar codul. La deciziile importante dă 2–3 opțiuni cu pro și contra și contrazice-l direct când greșește. Planificarea tehnică (spec, arhitectură, tichete) și implementarea se fac prin skill-urile BMad, nu printr-un plan separat în plan mode, ca să nu planificăm de două ori. Ordinea pașilor o alege autorul; dacă nu e clar ce urmează, întreabă skill-ul `bmad`. Se lucrează pas cu pas.

## BMad Method

Workflow-ul de planificare și implementare folosește skill-urile BMad instalate la nivel de proiect în `.claude/skills/` (sursa și hash-urile sunt în `skills-lock.json`). `bmod-core-tools` și `bmod-method` sunt doar metadate de modul și nu se invocă niciodată. Pentru a afla ce skill urmează, folosește skill-ul `bmad`, care răspunde din help-ul modulelor instalate.

- `_bmad/config.toml`: configurația proiectului. Artefactele BMad (spec-uri, arhitectură, tichete) se scriu în `_bmad-output/`, în folderul inițiativei active.
- Inițiativa activă e setată în `_bmad/custom/config.user.toml` (`active_initiative`); se schimbă prin skill-ul `bmad`.
- `_bmad/scripts/` și `_bmad/<modul>/scripts/` sunt generate de setup. Nu le edita de mână; se regenerează cu `bmad setup`.

Toate scripturile BMad cer `uv`. Verificarea instalării:

```
uv run --no-cache .claude/skills/bmad/scripts/setup.py --project-root . --skill .claude/skills/bmad --root .claude/skills --status
```

Actualizarea skill-urilor: `npx skills update -p -y`. Adăugarea unui skill: `npx skills add bmad-code-org/BMAD-METHOD --skill <nume> -a claude-code -y`, apoi rulează din nou `bmad setup`.
