---
name: whenkit
status: final
created: 2026-10-16
updated: 2026-10-19
sources:
  - ../spec-whenkit/spec-whenkit.md
  - ../spec-whenkit/ui-screens.md
  - ../spec-whenkit/entry-model.md
  - ../spec-whenkit/categories-seed.md
  - ../spec-whenkit/card-writing-rules.md
  - ../spec-whenkit/test-scenarios.md
  - ../epic-fereastra-whenkit/epic-fereastra-whenkit.md
  - ../architecture-whenkit/architecture-whenkit.md
---

# WhenKit — Experience Spine

## Foundation

| Aspect | Decizie |
|---|---|
| Formă | Aplicație **desktop**, o singură fereastră Electron, Windows 11. Nu web, nu mobil. |
| Limbă | Interfața în română; toate textele în `src/shared/strings.ro.ts` (AD-13). Numele zonelor „Toolbox” și „Learn” rămân în engleză (nume de produs). |
| Sistem UI | Niciunul preluat: componente proprii în React, după DESIGN.md. Comportamentul nativ Windows (bara de titlu, dialogul de alegere a folderului, tema aplicațiilor, „Animation effects”) e respectat. |
| Identitate vizuală | `DESIGN.md` (tokeni și componente). Acest fișier e comportamentul; duratele și pragurile sunt tokeni din DESIGN.md (`{motion.*}`, `{spacing.*}`). |
| Folosire | Fereastra stă **deschisă tot timpul**, ca jurnal personal; des pe jumătate de ecran, lângă terminalul cu Claude Code. Mouse-ul e intrarea principală, tastatura e scurtătură. |
| Rolul ferestrei | Locul unde **se găsesc** lucrurile. Adăugarea trece prin Claude (`/importa`); fereastra doar afișează, corectează, adnotează, șterge, ordonează categoriile și exportă (CAP-8, CAP-9, CAP-10, CAP-11, CAP-13). |

Referință de compoziție: machetele ecranelor-cheie din `mockups/` ([key-toolbox](mockups/key-toolbox.html), [key-fisa](mockups/key-fisa.html), [key-learn-import](mockups/key-learn-import.html), [key-dialogs](mockups/key-dialogs.html)), descrise în DESIGN.md, „Brand & Style”, unde e și regula de conflict.

## Information Architecture

| Suprafață | Se ajunge din | Rol |
|---|---|---|
| **Cadrul ferestrei** | mereu vizibil | `title-bar` (marca, `theme-switch`), `toolbar` (`zone-tab`, `search-box`, „Categorii”, „Exportă catalogul”), `status-bar` |
| **Lista Toolbox** | pornirea aplicației (mereu Toolbox → Toate), tabul Toolbox, Ctrl+1 | `category-bar` + `section-header` + grila de `entry-card` (CAP-8) |
| **Lista Learn** | tabul Learn, Ctrl+2 | la fel, cu `kind-stamp` pe carduri (CAP-8) |
| **Rezultatele căutării** | scris în `search-box` (Ctrl+K) | aceeași grilă, filtrată în zona curentă (CAP-9) |
| **Fișa completă** | click pe card, Enter pe cardul selectat, `related-link`, acțiunea „Deschide” din toast | `sheet-bar` + `entry-sheet`, toate câmpurile din `entry-model.md` (CAP-10) |
| **Fișa în editare** | „Editează” sau E, în fișă | câmpurile scrise de Claude devin `text-field`, `select`, `category-picker`, `list-editor` (CAP-10) |
| **Gestionarea categoriilor** | butonul „Categorii” | `dialog` cu `category-manager` (CAP-11) |
| **Confirmări** | „Șterge”/Delete în fișă; „Renunță”/Esc sau „Reîncarcă fișa” cu modificări nesalvate; „Unifică…” și „Șterge” în `category-manager` | `dialog` modal ([mockups/key-dialogs.html](mockups/key-dialogs.html)) |
| **Exportul** | „Exportă catalogul” | dialogul nativ de alegere a folderului, apoi `toast` (CAP-13) |
| **Toast-uri** | apar oriunde | sosiri din import, rezultatul exportului, erori nefatale |
| **Ecran de eroare** | pornire eșuată (State Patterns, „Erori de pornire”) | `app-error`, blochează restul |

Model de navigare: o singură fereastră, fără ferestre secundare. Fișa **înlocuiește** grila în zona de lucru; `toolbar` rămâne, `category-bar` e înlocuită de `sheet-bar`. Navigarea între fișe (`related-link`, umbrelă ↔ copil) formează o stivă; „Înapoi” coboară un pas, iar ultimul pas readuce lista cu aceeași categorie, aceeași derulare și cardul de pe care ai plecat selectat. Comutarea tabului de zonă din fișă duce la lista acelei zone. Dialogurile au un singur nivel, niciodată dialog peste dialog (excepție: confirmarea din `category-manager`, care îl înlocuiește temporar).

Categoria selectată se ține minte pe zonă cât timp aplicația e deschisă; la repornire se pierde (mereu Toolbox → Toate).

## Voice and Tone

Microcopy. Vocea de brand e în `DESIGN.md`, „Brand & Style”. Toate textele stau în `strings.ro.ts`; motivele de verificare și erorile se afișează din textele codurilor (AD-15, AD-18), niciodată ca text compus în UI.

| Do | Don't |
|---|---|
| Persoana a II-a, informal, scurt: „Ce vrei să faci? ex. „scot fundalul”” (Toolbox), „Ce vrei să înțelegi? ex. „aleg un API”” (Learn) | „Introduceți termenul de căutare” |
| Stări ca fapte: „Catalog la zi”, „6 fișe · 1 nouă”, „Salvat” | „Operațiune realizată cu succes!” |
| Explicația de lângă gest: „se salvează singure · doar tu scrii aici”, „Fișele noi apar singure, nu trebuie să reîmprospătezi.” | Tutoriale, pop-up-uri de întâmpinare |
| Banda de sosire: „ADĂUGAT · ACUM 3 S” | Emoji, semne de exclamare |
| Eroare = ce s-a întâmplat + ce faci: „Nu găsesc workspace-ul.” + textul codului + comanda `whenkit init` | Coduri goale („WORKSPACE_NOT_CONFIGURED”) fără explicație; codul apare doar ca detaliu |
| Confirmare cu consecința: titlul e întrebarea sau acțiunea, textul e consecința. „Ștergi fișa „remove.bg”?” + „Se șterg și legăturile ei cu alte fișe. Nu se poate anula.”; „Unifică „Descoperire & arhive”” + „Mut cele 3 fișe în „Date & API-uri” și șterg „Descoperire & arhive”?”; „Ștergi „Terminal & dev tools”?” | „Sigur?” |
| Trimitere la Claude când fereastra nu poate ajuta: „Sau cere-i lui Claude, în terminal: /gaseste …” | Promisiuni de AI în fereastră |

**Glosar** (identic în UI și documente): **fișă** (o intrare), **Toolbox** / **Learn** (zonele), **categorie** (la fel pe bară, în dialog și în firimituri), **unealtă / material / concept** (felul), **Când o folosesc** / **Când îl aleg**, **Notițele mele**, **Resurse înrudite**, **notă de verificare**.

**Formate:**

- **Date:** un singur format, `15.10.2026`; cu oră, `15.10.2026, 20:39`. Timpul relativ („acum 3 s”, „acum 2 min”) apare doar pe banda de sosire.
- **Numere:** zecimale cu virgulă („137,7k”).
- **Plural:** după `Intl.PluralRules('ro')`, cu trei forme în `strings.ro.ts`: *one* „1 fișă”; *few* „0 fișe”, „2 fișe” … „19 fișe”, „101 fișe”; *other* „20 de fișe”, „75 de fișe”, „100 de fișe”. La fel pentru situații, copii, fișe noi.

## Component Patterns

Comportament. Aspectul e în `DESIGN.md`, „Components”.

| Componentă | Unde | Reguli de comportament |
|---|---|---|
| `title-bar` | cadru | Trage fereastra; dublu-click maximizează (nativ). Titlul ferestrei din Windows (bara de activități, Alt+Tab) poartă numele fișei: „WhenKit” în listă, „remove.bg — WhenKit” în fișă. Bara de titlu din aplicație arată mereu doar „WhenKit”. Rămâne vie și cât e deschis un dialog. |
| `app-mark` | `title-bar` | Decorativ, fără acțiune. |
| `theme-switch` | `title-bar` | Click comută zi/noapte, cu tranziție de culoare. Alegerea **persistă** între reporniri (unde, vezi „Responsive & Platform”); la prima pornire urmează tema aplicațiilor din Windows. Nu e un ecran de setări. |
| `zone-tab` | `toolbar` | Click/Ctrl+1/Ctrl+2 schimbă zona; contorul arată fișele zonei și se actualizează live. Păstrează textul din căutare și îl aplică noii zone. |
| `search-box` | `toolbar` | Ctrl+K (și Ctrl+F) pune focusul. Filtrare live după {motion.search-debounce} de pauză, în **zona curentă**, peste toate categoriile; câmpurile indexate și sintaxa sunt ale arhitecturii (AD-5: fiecare cuvânt ca prefix, toate obligatorii). Cât există text, nicio pastilă nu e activă și `section-header` arată „Rezultate pentru „fundal”” cu numărul. Dacă cealaltă zonă are potriviri, header-ul adaugă linkul „+2 în Learn”. Golirea căutării revine la categoria de dinainte. Ordinea rezultatelor e cea a listei: cele mai noi primele (AD-10). |
| `toolbar-button` „Categorii” | `toolbar` | Deschide `dialog` cu `category-manager`. |
| `toolbar-button-primary` „Exportă catalogul” | `toolbar` | Deschide dialogul nativ de folder; cât rulează exportul e „în lucru”: „Se exportă…”. Vezi Flow 6. |
| `toolbar` | cadru | Rămâne la fel în listă și în fișă; nu se ascunde la derulare. La lățimi mici își comprimă butoanele („Responsive & Platform”). |
| `category-bar` + `category-chip` | listă | Selecție unică; „Toate” prima, apoi categoriile zonei în ordine alfabetică românească, fiecare cu contor. Categoriile fără fișe apar, cu contor 0. La debordare: derulare orizontală cu rotița mouse-ului, butonul „›” derulează o pagină înainte, pastila activă e adusă în vedere. Cât rândul nu e la început, apar și estomparea din stânga și butonul „‹”, care derulează o pagină înapoi; la capătul din dreapta dispar „›” și estomparea lui. [ și ] trec la categoria anterioară/următoare. |
| `section-header` | listă | Numele vederii + linia de cotă cu numărul de fișe și, după o sosire, „· N nouă/noi”. Fără acțiuni, fără sortare. |
| `entry-card` | grilă | Click oriunde deschide fișa (un singur click). Săgețile mută selecția; Enter deschide. Ordinea: cele mai noi primele (după „adăugat la”); la egalitate (fișe din același lot), în ordinea din lot. O fișă cu două categorii apare în ambele (CAP-8). Cardul nu are butoane proprii și nu se editează direct. `verification-flag` apare în subsol, în ambele zone. |
| `entry-card-skeleton` | grilă | Doar la pornire, dacă încărcarea durează peste {motion.skeleton-delay}. |
| `arrival-tape` + `entry-card-new` | grilă | Pe fișele sosite în timpul sesiunii (State Patterns, „Sosire”). Timpul de pe bandă se actualizează („acum 3 s” → „acum 2 min”). Banda dispare când fișa e deschisă sau după {motion.tape-lifetime}. |
| `button` și variantele | `sheet-bar`, dialoguri, formular | O singură acțiune pe buton, cu `kbd` alături când are scurtătură. `button-danger` („Șterge” în fișă) nu șterge niciodată direct: deschide confirmarea; doar `button-danger-solid` din dialog execută. Inactiv cât formularul e invalid; „în lucru” cât rulează acțiunea lui. |
| `kind-stamp`, `category-tab`, `situation-item`, `keyword-tag`, `situation-callout`, `title-block` | card / fișă | Doar afișare. Cuvintele-cheie nu sunt linkuri de căutare în v1. |
| `verification-flag` | card | Doar semnal; detaliile (motivele, inclusiv „verificare ocolită de utilizator” și repo arhivat) sunt în fișă. |
| `sheet-bar` | fișă | „Înapoi” coboară în stivă. „Editează”/E intră în editare. „Șterge”/Delete deschide confirmarea. În editare „Înapoi” e ascuns: rămân „Salvează” (Ctrl+S) și „Renunță” (Esc), care cere confirmare dacă formularul are modificări. |
| `entry-sheet` | fișă | Arată toate câmpurile din `entry-model.md`, în ordinea din DESIGN.md. Se actualizează live dacă fișa se schimbă din terminal cât e doar citită. Golurile: fără resurse înrudite, secțiunea lipsește; repo fără date GitHub (limită de rată), rubricile Stele și Ultimul commit lipsesc; concept fără link, `open-in-browser` lipsește. |
| `conflict-banner` | fișă în editare ([mockups/key-fisa.html](mockups/key-fisa.html)) | Apare când fișa s-a schimbat din terminal în timpul editării sau când salvarea întoarce `CONFLICT` (AD-10, AD-16). Rămâne până la ieșirea din editare. „Reîncarcă fișa” încarcă versiunea nouă în formular și rămâi în editare; dacă formularul are modificări, cere întâi confirmarea „Pierzi ce ai schimbat în fișă.”. Nu atinge `my-notes`. |
| `open-in-browser` și orice link extern | fișă | Deschide URL-ul în **browserul implicit** (`shell.openExternal`, doar `http:`/`https:`, AD-9). Fereastra nu navighează niciodată. Linkurile cu altă schemă se afișează ca text simplu. |
| `related-link` | fișă | Navigare internă la fișa țintă (se adaugă în stivă). La umbrelă: lista „Concepte”; la copil: „Face parte din”. |
| `markdown-content` | fișă (concept) | Randat fără HTML brut și fără imagini externe (AD-9); linkurile externe se deschid în browser. |
| `my-notes` | fișă | Editabile **direct**, mereu, fără mod de editare și fără buton de salvare. Salvare automată după {motion.notes-autosave} de pauză și la ieșirea din câmp, din fișă sau din aplicație. Antetul arată pe rând „Se salvează…” → „Salvat” (vizibil cel puțin {motion.saved-min-visible}), apoi revine la indiciu. Goale: placeholder „Scrie aici ce vrei să-ți amintești.”. La o reîmprospătare live a fișei, notițele își **păstrează textul local** cât au focus sau o salvare în așteptare. Scrierea nu e blocată de importuri (AD-16: fără `expectedRevision`). Text simplu, fără Markdown. |
| `text-field` | fișă în editare | Nume, ce face, link (la concepte opțional), conținut (concepte, Markdown scris ca text, fără previzualizare). Fiecare câmp are o etichetă vizibilă („Nume”, „Link”, „Tip”, sau eticheta secțiunii), care e și eticheta accesibilă. **Nu se editează:** felul (ar muta fișa în altă zonă), id, date, date GitHub, nota de verificare, legăturile. Un motiv de respingere sau de invaliditate apare sub câmpul vizat. |
| `select` | editare, `category-manager` | `<select>` nativ, cu tastatura nativă. Folosit pentru tip (repo / site / aplicație, doar la unelte și materiale) și pentru categoria-țintă la „Unifică…” și la ștergerea cu țintă (doar categoriile aceleiași zone, fără cea curentă, alfabetic). |
| `category-picker` | fișă în editare | Arată toate categoriile zonei felului, alfabetic; click (sau Space) comută o categorie (`aria-pressed`). Cu 2 alese, celelalte devin inactive până deselectezi una. Cu 0 alese: „Alege cel puțin o categorie.” sub câmp, „Salvează” inactiv. Nu se pot crea categorii aici (doar prin import). |
| `list-editor` | fișă în editare | Pentru situații, cuvinte-cheie și surse, câte un rând pe element, într-o singură coloană. „Adaugă …” (sau Enter în ultimul rând) adaugă un rând gol la final, cu focus. × șterge rândul, fără confirmare. Rândurile goale se ignoră la salvare. Situațiile au minimum una: × e inactiv pe ultima rămasă. Fără reordonare. Sursele sunt linkuri: se verifică la salvare, ca linkul fișei (AD-3). |
| `status-bar` | cadru | Stânga: „Catalog la zi” (indicator static: fereastra urmărește catalogul, AD-10; nu are altă stare) + „75 de fișe · ultima adăugată 15.10.2026, 20:39”; calea workspace-ului rezolvat (AD-8), tăiată la mijloc când nu încape („C:\Users\…\whenkit”), întreagă în `tooltip`. Dreapta: indicii de taste pentru vederea curentă: „Ctrl K caută · Enter deschide” în listă, „E editează · Esc înapoi” în fișă, „Ctrl S salvează · Esc renunță” în editare. |
| `toast` | colțul din dreapta jos, deasupra `status-bar` | Nu fură focusul, nu blochează nimic. Dispare după {motion.toast-dwell}, cu pauză cât e mouse-ul deasupra; × îl închide; maximum 3 stivuite, cel mai nou jos, lângă colț, cele vechi urcă. Toast-urile aceluiași lot apar în ordinea zonelor: Toolbox, apoi Learn. Fără toast de „anulează”. |
| `dialog` | modal | Capturează focusul; Esc sau „Renunță” închide; focusul revine pe elementul care l-a deschis. În confirmările distructive, butonul implicit e cel care **nu** distruge. Fundalul estompat lasă bara de titlu activă: fereastra se poate trage și minimiza și cu un dialog deschis. |
| `category-manager` | dialog ([mockups/key-dialogs.html](mockups/key-dialogs.html)) | Vezi Flow 5. Se închide cu „Închide” sau Esc. Redenumire pe loc (Enter salvează, Esc renunță; Esc anulează întâi redenumirea, apoi închide dialogul). „Unifică…” deschide o confirmare care înlocuiește dialogul: `select` „Mut fișele în” cu categoriile aceleiași zone (fără cea curentă, alfabetic), consecința cu numărul de fișe și „Unifică” (`button-danger-solid`, pentru că șterge categoria-sursă). „Șterge” deschide tot o confirmare; dacă unele fișe au doar categoria asta, ea cere și o țintă și devine unificare (CAP-11, AD-5). La închiderea confirmării revii în `category-manager`. Nu se pot crea categorii din UI. |
| `tooltip` | butoane doar cu iconiță, texte tăiate | Nativ (`title`), apare la hover. |
| `empty-state`, `app-error` | zona de lucru / fereastra | Vezi State Patterns. |
| `kbd`, `focus-ring` | peste tot | `kbd` e doar indiciu, nu se apasă. `focus-ring` apare doar la focus din tastatură (`:focus-visible`). |

## State Patterns

| Stare | Suprafață | Tratament |
|---|---|---|
| Pornire | fereastra | Se deschide **mereu** pe Toolbox → Toate, fără restaurarea vederii. Peste {motion.skeleton-delay} de încărcare: `entry-card-skeleton`. |
| Catalog gol | listă | `empty-state`: „Catalogul e gol. Spune-i lui Claude ce ai găsit: /importa în terminal.”. Categoriile din seed apar cu 0. |
| Categorie fără fișe | listă | `empty-state` mic: „Nicio fișă în „Terminal & dev tools” încă.” |
| Căutare fără rezultat | listă | `empty-state`: „Nimic pentru „convertesc un video în gif” în Toolbox.”, „Am căutat în tot textul fișelor.” și „Sau cere-i lui Claude, în terminal: /gaseste …”; dacă cealaltă zonă are potriviri, linkul „+N în Learn”. Fără sugestii de sinonime. |
| **Sosire din import** | oriunde ([mockups/key-learn-import.html](mockups/key-learn-import.html)) | Main-ul emite `catalog:changed` (AD-10, la câteva secunde); fereastra compară lista și găsește fișele noi. O fișă nouă care intră în vederea curentă (categoria afișată sau căutarea activă, rulată din nou) aterizează prima în grilă, cu `entry-card-new` și `arrival-tape`; celelalte carduri alunecă. **Oricum** apare un `toast` de sosire, **câte unul pe zonă**: o singură fișă, „Fișă nouă: Webhook · Learn / Backend & API-uri” cu „Deschide”; mai multe, „5 fișe noi în Toolbox” cu „Vezi” (duce la acea zonă, la Toate). Contoarele (tab, pastile, `section-header`, `status-bar`) cresc. Doar fișele intrate; respingerile rămân în raportul lui Claude și în jurnal. |
| Import în curs | — | Fereastra **nu** știe că rulează un import: vede doar scrierile încheiate (AD-6, AD-10). Nu există indicator de import. |
| Fișă actualizată din terminal (`update`) | listă / fișă citită | Se reîmprospătează pe loc, cu un puls scurt de contur {colors.accent} ({motion.pulse}), fără toast. `my-notes` își păstrează textul local cât are focus sau o salvare în așteptare. |
| Fișă modificată din terminal în timpul editării | fișă în editare ([mockups/key-fisa.html](mockups/key-fisa.html)) | Formularul **nu** se reîncarcă (AD-10); apare `conflict-banner`: „Fișa a fost modificată din terminal. Salvarea ta va fi refuzată.”. |
| Salvare refuzată: `CONFLICT` (AD-16) | fișă în editare | Nu se salvează nimic; apare `conflict-banner`. Modificările rămân în câmpuri. |
| Salvare cu link sau surse schimbate | fișă în editare | „Salvează” e „în lucru” („Se verifică linkul…”) și câmpurile sunt blocate. **accepted**: se salvează, ieși din editare. **warned**: se salvează, nota apare în fișă. **rejected**: nu se salvează nimic (AD-3), motivele apar sub câmpul vizat, rămâi în editare. **`OFFLINE`**: nu se salvează: „Nu pot verifica linkul fără internet. Modificarea nu s-a salvat.”. |
| Câmp invalid local | fișă în editare | Nume gol, 0 categorii, nicio situație, link fără `http(s)`: mesaj sub câmp, „Salvează” inactiv. |
| Renunțare cu modificări | fișă în editare | `dialog`: „Renunți la modificări? Ce ai schimbat în „remove.bg” se pierde.”, cu „Înapoi la editare” (implicit) și „Aruncă modificările” (`button-danger-solid`). Fără modificări, „Renunță” iese direct. |
| Notițe: salvare eșuată | `my-notes` | Textul rămâne; antetul arată „Nu s-a salvat. Încerc din nou.”, cu reîncercare automată. |
| Gestionarea categoriilor | `category-manager` ([mockups/key-dialogs.html](mockups/key-dialogs.html)) | Nume existent: mesaj sub rând (Flow 5, eșec B). Categorie unică pe unele fișe: confirmarea de ștergere spune „1 fișă are doar categoria asta. Alege unde o muți, ca să nu rămână fără categorie.” (plural după „Voice and Tone”), cu `select` de țintă obligatoriu („Alege o categorie”), iar „Șterge” e inactiv până alegi (eșec A). Zonă fără altă categorie: „Unifică…” inactiv. Lista se actualizează live dacă un import creează categorii cât dialogul e deschis. |
| Bază ocupată la scriere (`DATABASE_BUSY`) | orice scriere | `toast` de eroare cu textul codului; modificările rămân în formular sau în notițe. |
| Ștergere reușită | listă | Revii în listă; cardul se strânge și dispare, vecinii alunecă. Fără toast și fără „anulează”. |
| Export: în curs / reușit / eșuat / anulat | `toolbar` + `toast` | În curs: butonul „în lucru”. Reușit: toast „Catalog exportat: whenkit-export-2026-10-16_143002” cu „Deschide folderul”. Eșuat: toast de eroare „Nu am putut scrie în folderul ales.”. Anulat (închizi dialogul de folder): nimic. |
| Eroare neprevăzută (`INTERNAL`) | fereastra | Dialogul de eroare al main-ului și `data/whenkit.log` (AD-19). |
| Focus | peste tot | `focus-ring` pe elementul activ; scurtăturile dintr-o tastă (E, Delete, [, ]) **nu** se declanșează cât focusul e într-un câmp de text. |

**Erori de pornire.** Fiecare blochează fereastra cu `app-error`: titlul de mai jos, textul codului din `strings.ro.ts`, comanda evidențiată (dacă există), codul ca detaliu și „Apoi repornește WhenKit.”. Fereastra nu reîncearcă singură.

| Cod (`src/core/errors.ts`) | Titlu | Comanda |
|---|---|---|
| `WORKSPACE_NOT_CONFIGURED` | „Nu găsesc workspace-ul.” | `whenkit init <cale>` |
| `CONFIG_INVALID` | „Configurarea workspace-ului e invalidă.” | `whenkit init <cale>`, cu o cale validă |
| `CATALOG_NOT_FOUND` | „Workspace-ul nu are catalog.” | `whenkit init` |
| `DATABASE_NEEDS_MIGRATION` | „Catalogul trebuie actualizat.” | `whenkit init` |
| `DATABASE_TOO_NEW` | „Catalogul e mai nou decât WhenKit.” | fără comandă: actualizează WhenKit (CLI-ul și aplicația vin din același commit, AD-19) |
| `MIGRATION_MISMATCH` | „Catalogul nu se potrivește cu această versiune.” | fără comandă; catalogul nu a fost deschis și nu s-a scris nimic (AD-4) |

## Interaction Primitives

**Mouse întâi, tastatura ca scurtătură.** Un click face acțiunea principală; nimic nu e accesibil doar prin tastatură sau doar prin hover. Scurtăturile se leagă după **tasta fizică** (`event.code`), nu după caracter, ca să meargă pe tastatura română (unde `[` și `]` dau „ă” și „î”).

| Tastă | Acțiune | Context |
|---|---|---|
| Ctrl+K / Ctrl+F | focus în căutare | oriunde |
| Esc | după context, vezi mai jos | oriunde |
| Enter | deschide cardul selectat | listă |
| ← ↑ → ↓ | mută selecția în grilă | listă |
| Ctrl+1 / Ctrl+2 | Toolbox / Learn | oriunde, în afara editării |
| [ / ] | categoria anterioară / următoare | listă |
| E | editează | fișă |
| Ctrl+S | salvează editarea | fișă în editare |
| Delete | șterge (deschide confirmarea) | fișă |
| Alt+← / butonul „înapoi” al mouse-ului | înapoi | fișă |
| Ctrl+= / Ctrl+− / Ctrl+0 | zoom pe toată interfața | oriunde |

**Esc, în ordinea priorității** (se aplică doar prima regulă potrivită):

1. Un dialog e deschis: îl închide (ca „Renunță”).
2. Fișa e în editare: „Renunță” (cu confirmare dacă formularul are modificări).
3. Focusul e în `search-box` și are text: golește căutarea.
4. E deschisă o fișă: înapoi, un pas în stivă.
5. Lista are o căutare activă: golește căutarea.

- Indiciile de taste stau în `status-bar` și în `kbd`-uri lângă butoane, nu într-un ecran de ajutor.
- Rotița mouse-ului peste `category-bar` derulează orizontal.
- **Interzise:** navigarea ferestrei la un site extern sau `window.open` (AD-9); toast cu „anulează”; buton de salvare pentru notițe; formular de adăugare; meniuri contextuale (click dreapta) în v1; drag & drop.

## Motion

Autorul vrea o interfață cât mai animată, fără exagerări. Fiecare animație confirmă o schimbare de stare; niciuna nu întârzie o acțiune. Curba implicită e {motion.ease}.

| Moment | Animație | Durată |
|---|---|---|
| Sosirea unei fișe | cardul aterizează de sus ({motion.arrival-offset}, scara {motion.enter-scale} → 1, opacitate 0 → 1) cu {motion.arrival-ease}, banda se lipește; celelalte carduri alunecă la noul loc | {motion.arrival}; alunecarea {motion.slide} |
| Fișă actualizată din terminal | puls de contur {colors.accent} | {motion.pulse} |
| Toast | intră glisând de jos și apare treptat; iese prin estompare | {motion.slide} / {motion.fade} |
| Comutarea temei | culorile trec lin; butonul glisant se mută | {motion.theme} |
| Hover și apăsare | strat de hover, ridicarea cardului | {motion.quick} |
| Schimbarea categoriei / căutarea | grila se estompează, cardurile intră în cascadă ({motion.stagger} între ele, cel mult primele {motion.stagger-max}) | {motion.fade} |
| Deschiderea fișei | fișa intră prin estompare și scalare {motion.enter-scale} → 1 | {motion.slide} |
| Dialog | fundal estompat, foaia de la scara {motion.enter-scale} | {motion.fade} |
| Ștergere | cardul se strânge și dispare, vecinii alunecă | {motion.slide} |
| Salvarea notițelor | „Salvat” apare prin estompare | {motion.quick} |
| „În lucru” | `loader-circle` se rotește | continuu |
| Cursorul din notițe | clipire | {motion.caret-blink} |

**Setarea Windows „Animation effects” (`prefers-reduced-motion: reduce`) oprește toate animațiile WhenKit**: schimbările apar instant, banda și inelul fișei noi apar fără mișcare, iconița „în lucru” stă pe loc, cursorul nu mai clipește. Se urmărește live, fără repornire.

## Accessibility Floor

Comportament. Contrastul vizual e în `DESIGN.md`, „Colors”.

- Orice acțiune se poate face din tastatură; ordinea Tab urmează ordinea vizuală: bara de titlu → bara de unelte → categoriile → grila → bara de stare.
- Grila e **o singură oprire de Tab** (roving tabindex): Tab intră pe cardul selectat (sau primul), săgețile mută selecția, Tab iese din grilă.
- Roluri: `zone-tab` ca `tablist`; `category-chip`-urile ca grup de selecție unică; grila ca listă de carduri-butoane cu numele ca etichetă; `category-picker` ca butoane comutabile (`aria-pressed`); `dialog` cu `aria-modal` și captură de focus.
- `toast`-urile și sosirile se anunță printr-o regiune `aria-live="polite"`; erorile de salvare și `conflict-banner` prin `assertive`.
- `focus-ring` vizibil la orice focus din tastatură, la contrast AA față de fundal.
- Culoarea nu e niciodată singurul semnal: categoriile au nume, felul are text pe ștampilă, nota de verificare are iconiță și text, câmpul respins are mesaj.
- Ținte de click de minimum 24×24 px (WCAG 2.2).
- Zoom 80–200% fără tăieturi; la zoom mare se aplică regulile de lățime din „Responsive & Platform”.
- „Animation effects” oprit în Windows ⇒ fără animații (vezi „Motion”).
- Etichetele accesibile sunt în română, din `strings.ro.ts`.

## Responsive & Platform

Fereastra trebuie să arate bine **la orice dimensiune și lățime**, mai ales pe jumătate de ecran lângă terminal. Pragurile sunt pe lățimea ferestrei în pixeli CSS (după scalarea Windows). În listă, numărul de coloane rezultă din `auto-fill` (minimum {spacing.card-min-width} pe coloană), fără praguri proprii: aproximativ 1 coloană sub 690 px, 2 până pe la 1010 px (deci și la 720 și la 960 px), 3 până pe la 1340 px. Ambele lățimi tipice sunt în [mockups/key-toolbox.html](mockups/key-toolbox.html).

| Lățimea ferestrei | Fișă | Bare |
|---|---|---|
| ≥ {spacing.bp-wide} | 2 coloane, panou lateral {spacing.sheet-side-width} | totul vizibil |
| {spacing.bp-half} – {spacing.bp-wide} (jumătate de ecran pe 1920) | 2 coloane, panou lateral {spacing.sheet-side-width-narrow} | „Categorii” și „Exportă catalogul” rămân cu text |
| {spacing.bp-narrow} – {spacing.bp-half} | o coloană: `open-in-browser` urcă sub titlu, restul panoului lateral coboară sub conținut | butoanele din `toolbar` devin doar iconiță, cu `tooltip`; `kbd` din căutare dispare; `category-bar` aduce pastila activă în vedere, cu estompare și buton pe partea derulată; în `status-bar` calea se taie la mijloc („C:\Users\…\whenkit”) și se strânge până dispare, înaintea contoarelor și a tastelor |
| {spacing.window-min-width} – {spacing.bp-narrow} | o coloană | contoarele de pe taburi dispar; `status-bar` păstrează doar starea și numărul de fișe |

- Dimensiunea minimă a ferestrei: {spacing.window-min-width} × {spacing.window-min-height}.
- Fereastra își amintește poziția și dimensiunea între reporniri (nu și vederea: pornește mereu pe Toolbox → Toate).
- **Unde persistă tema și fereastra:** în `window-state.json`, scris doar de main-ul aplicației desktop, în `%APPDATA%\whenkit\desktop\` (`desktop-dev\` pentru `npm start`); **niciodată** lângă `config.json`, care aparține lui `whenkit init` (AD-8), în workspace sau în `localStorage`. Detaliile (pornire, temă fără clipire, salvarea notițelor la închidere) sunt în AD-20.
- `category-bar` nu se rupe pe mai multe rânduri la nicio lățime: derulare orizontală.
- Respectă scalarea Windows 100–200% și tema aplicațiilor la prima pornire; fonturile sunt de sistem, plus Cascadia Mono inclus.
- Un singur exemplar al aplicației: a doua pornire aduce fereastra existentă în față.

## Inspiration & Anti-patterns

| Sursă | Ce s-a luat | Ce s-a lăsat |
|---|---|---|
| **AutoCAD** (referința de densitate) | straturi colorate, grilă milimetrică, colțuri de decupare pe selecție, bloc de titlu, bara de stare cu taste, aspectul de unealtă capabilă | complexitatea reală: rigle, cote, panouri multe |
| **Direcția Planșetă** (baza) | ideea și aspectul care i-au plăcut cel mai mult autorului | era prea complicată și nu destul de prietenoasă |
| **Direcția Fișier** (prietenia) | carduri rotunjite, pastile de categorie, spațiu aerisit, tabul colorat al categoriei | restul catalogului editorial |
| **Planșetă Caldă** (hibridul ales) | hârtie ivoire, navy desaturat cu text crem noaptea, tabul de categorie | — |
| **Atelier** | doar ștampilele Concept/Material și banda pe fișa nouă | notițe scrise de mână, titlul serif (Sitka) |
| **Dozele de planșă** | doar grila milimetrică pe toată zona | rigle, cote pe selecție, cartuș tehnic, cianotipie |

**Anti-patterns respinse:**

- Toast cu „anulează” după ștergere: ștergerea cere confirmare înainte, nu reparație după.
- Buton de salvare pentru „Notițele mele”.
- Panou de Setări, chiar mic (pornirea pe Toolbox → Toate e fixă în v1; ideea e pentru după v1).
- Formular de adăugare sau „jurnal rapid” în fereastră: totul intră prin Claude (ideea e pentru după v1).
- Ecran de respinse: raportul lui Claude și jurnalul acoperă asta.
- Fereastra care navighează la un site: linkurile pleacă mereu în browser.
- Indicator de progres al importului, pe care fereastra nu-l poate ști.
- Control de sortare: ordinea e fixă, cele mai noi primele.

## Key Flows

Protagonistul e **Luca**, student și developer, cu WhenKit deschis lângă terminalul cu Claude Code.

### Flow 1 — Luca caută o unealtă (CAP-8, CAP-9, CAP-12, CAP-10)

Machete: pașii 2–3 în [mockups/key-toolbox.html](mockups/key-toolbox.html), pasul 4 în [mockups/key-fisa.html](mockups/key-fisa.html).

Luca lucrează la un proiect și are nevoie să scoată fundalul dintr-o poză de profil. WhenKit e deschis pe jumătatea dreaptă a ecranului.

1. Luca dă click pe fereastră; e pe Toolbox → Toate, două coloane de carduri.
2. Dă click pe pastila „Imagini & video”; grila se reface în cascadă, `section-header` arată „Imagini & video · 6 fișe”.
3. Citește primele situații de pe carduri; pe remove.bg vede „vreau să scot fundalul dintr-o poză”.
4. Dă click pe card; fișa se deschide, cu „Când o folosesc · 4” și notițele lui de data trecută.
5. **Climax:** apasă „Deschide în browser”; remove.bg se deschide în browserul implicit, iar WhenKit rămâne exact unde era, gata pentru următoarea căutare.

Variantă prin căutare: la pasul 2 apasă Ctrl+K și scrie „fundal”; remove.bg apare, deși descrierea sursă era în engleză (cuvintele-cheie bilingve).

Eșec (nu găsește): căutarea „convertesc un video în gif” dă `empty-state`, cu trimiterea la `/gaseste`. Luca scrie în terminal `/gaseste ce am pentru a face un gif dintr-un video?`; Claude răspunde cu numele fișelor. Luca revine în WhenKit, scrie numele în căutare (dacă fișa e în cealaltă zonă, apasă „+1 în Learn”), deschide fișa, citește ce face și, dacă îi convine, deschide linkul în browser. Nu există legătură automată terminal → fereastră.

### Flow 2 — Luca urmărește cum importă Claude (CAP-2 văzut din fereastră, CAP-8)

Machetă: pasul 3 și varianta în vedere, în [mockups/key-learn-import.html](mockups/key-learn-import.html).

Luca a pus `inspire.txt` în `input/` și rulează `/importa` în terminal. WhenKit e deschis lângă, pe Learn → Backend & API-uri.

1. Claude lucrează în terminal; în fereastră nu se întâmplă nimic încă (fereastra nu vede importul în curs).
2. `whenkit import` termină; în câteva secunde main-ul observă schimbarea (AD-10).
3. Lotul a adus fișe în ambele zone: apar două toast-uri, „6 fișe noi în Toolbox · Vezi” și „2 fișe noi în Learn · Vezi”, fără să întrerupă nimic. Contoarele taburilor cresc.
4. Luca apasă „Vezi” pe toast-ul Toolbox; ajunge pe Toolbox → Toate.
5. **Climax:** fișele noi sunt primele, fiecare prinsă cu banda „ADĂUGAT · ACUM 12 S”, cu inelul galben; Luca le vede aterizate pe planșă fără să fi apăsat nimic de reîmprospătare.
6. Deschide una; banda ei dispare.

Varianta în vedere: dacă o fișă nouă intră chiar în categoria afișată, ea aterizează animat în grilă, sub ochii lui, iar toast-ul apare oricum.

Eșec: isladjan.com are certificat invalid și e respins; fereastra nu arată nimic despre el (motivul e în raportul lui Claude și în jurnal). Dacă tot lotul e respins sau importul se oprește (offline), nu sosește nimic și nu apare niciun toast.

### Flow 3 — Luca corectează o fișă și își scrie notițele (CAP-10)

Machetă: pașii 2–4 și eșecul B, în [mockups/key-fisa.html](mockups/key-fisa.html).

1. Luca deschide remove.bg.
2. Dă click în „Notițele mele” și scrie „Gratuit doar la rezoluție mică.”; după o pauză scurtă antetul arată „Se salvează…”, apoi „Salvat”. Nu există buton.
3. Apasă E (sau „Editează”); câmpurile scrise de Claude devin editabile.
4. În `list-editor`-ul situațiilor apasă „Adaugă situație”, scrie „vreau o poză de profil cu fundal colorat” și schimbă linkul în `https://www.remove.bg/ro`.
5. Apasă Ctrl+S; „Se verifică linkul…”.
6. **Climax:** verificarea trece, fișa iese din editare cu noua situație ca „05”, iar după o repornire a WhenKit editarea și notița sunt tot acolo.

Eșec A: linkul nou dă 404; nimic nu se salvează, motivul („pagina nu există”, din textul codului) apare sub câmpul link; Luca îl corectează sau apasă „Renunță” și confirmă că aruncă modificările.
Eșec B: între timp Claude a rulat un `update` pe remove.bg; formularul nu se reîncarcă, apare `conflict-banner`; salvarea e refuzată (`CONFLICT`). Luca apasă „Reîncarcă fișa”, confirmă, și reface modificarea peste versiunea nouă. Notițele nu sunt afectate de conflict.

### Flow 4 — Luca șterge o fișă (CAP-10)

Machetă: pasul 3, în [mockups/key-dialogs.html](mockups/key-dialogs.html), ecranul 04.

1. Luca deschide o fișă pe care nu o mai vrea (ex. un duplicat vechi).
2. Apasă „Șterge”.
3. Dialogul întreabă: „Ștergi fișa „X”? Se șterg și legăturile ei cu alte fișe. Nu se poate anula.” Focusul e pe „Renunță”.
4. Apasă „Șterge”.
5. **Climax:** revine în listă, cardul se strânge și dispare, contoarele scad, iar fișele care o aveau la „Resurse înrudite” nu mai trimit spre ea.

Eșec: Esc sau „Renunță” închide dialogul, fișa rămâne neatinsă.

### Flow 5 — Luca își ordonează categoriile (CAP-11)

Machetă: pașii 2–3 și eșecul A, în [mockups/key-dialogs.html](mockups/key-dialogs.html), ecranele 01–03.

1. Luca apasă „Categorii”; dialogul arată Toolbox și Learn, fiecare categorie cu numărul de fișe.
2. **Redenumire:** dă click pe „Redenumește” la „Mockup-uri & capturi de cod”, scrie „Mockup-uri”, Enter. Pastila și toate fișele afectate preiau numele; culoarea rămâne (slotul vine din ordinea `id`-urilor, pe care redenumirea nu o schimbă).
3. **Unificare:** la „Descoperire & arhive” alege „Unifică…”; confirmarea ia locul dialogului și, în `select`, alege ținta „Date & API-uri” (lista arată doar Toolbox). Confirmă: „Mut cele 3 fișe în „Date & API-uri” și șterg „Descoperire & arhive”?”. Categoriile de după „Descoperire & arhive” în ordinea `id`-urilor își pot schimba culoarea; e acceptat.
4. **Ștergere:** la „Terminal & dev tools” (0 fișe) apasă „Șterge”, confirmă.
5. **Climax:** închide dialogul; bara de categorii arată lista curată, contoarele sunt corecte și nicio fișă nu a rămas fără categorie.

Eșec A: ștergerea unei categorii care e singura pe unele fișe cere o categorie-țintă din aceeași zonă; fără țintă, „Șterge” e inactiv.
Eșec B: noul nume există deja în zonă (aceeași formă normalizată): mesaj sub câmp, „Există deja „X” în Toolbox. Folosește „Unifică…”.”.

### Flow 6 — Luca exportă catalogul (CAP-13)

1. Luca apasă „Exportă catalogul”.
2. Se deschide dialogul Windows de alegere a folderului; alege `Documente`.
3. Butonul arată „Se exportă…”.
4. **Climax:** toast „Catalog exportat: whenkit-export-2026-10-16_143002 · Deschide folderul”; Luca îl deschide, găsește `catalog.json` și `fise/*.md` și deschide folderul ca vault în Obsidian.

Eșec: folderul nu se poate scrie: toast de eroare, nimic pe jumătate scris de semnalat. Anulare la pasul 2: nimic nu se întâmplă.

### Flow 7 — Luca învață din conceptele de API (CAP-8, CAP-10)

1. Pe Learn → Backend & API-uri, cardurile au ștampila „CONCEPT”; „Tipuri de API” arată „umbrelă · 5 copii”.
2. Deschide umbrela: tabelul de comparație și „Când îl aleg”.
3. În panoul lateral, la „Concepte”, dă click pe „REST API”; fișa copil se deschide (stiva crește).
4. La „Surse”, dă click pe documentația oficială; se deschide în browser.
5. **Climax:** apasă Esc de două ori și e înapoi pe grila Learn, pe cardul „Tipuri de API”, selectat cu colțurile de decupare.

Eșec: un link din „Surse” a fost scos la import (`source_link_removed`); cardul are `verification-flag`, iar în fișă nota de verificare arată linkul scos.
