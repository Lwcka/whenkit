# Spine Pair Review — WhenKit

## Overall verdict

Perechea e fidelă jurnalului (`.memlog.md`): toate deciziile închise (fără Setări, fără indicator de import, „Salvează” doar în modul de editare, „Categorii” peste tot, doar grila milimetrică, WhenKit/whenkit) se regăsesc, tokenii de culoare au toți hex și pereche întunecată, iar contrastele declarate se verifică la recalculare (diferențe ≤ 0,05). Trei goluri blochează însă extragerea curată pe tichete: regula culorii de categorie contrazice schema din arhitectură, controalele modului de editare nu sunt definite, iar butoanele și pastilele nu au aspect pentru hover/apăsat/inactiv. DESIGN.md e umflat mai ales prin repetarea acelorași valori în 3–4 locuri, ceea ce creează mai multe surse de adevăr care vor diverge.

## 1. Flow coverage — strong

Verificat: CAP-8, 9, 10, 11, 13 (epicul), CAP-2 și CAP-12 văzute din fereastră și cele două călătorii din memlog („Luca caută o unealtă”, „Claude importă”). Fiecare are un Key Flow cu protagonist numit (Luca), pași numerotați și climax; toate, în afară de Flow 7, au cale de eșec.

### Findings
- **low** Flow 7 (concepte API) nu are cale de eșec, deși are cazuri reale: un link din „Surse” scos la verificare (`source_link_removed`), o umbrelă fără copii (EXPERIENCE, Flow 7). *Fix:* un rând „Eșec:” cu unul dintre ele.

## 2. Token completeness — adequate

Verificat: toate cheile `colors` (21 de roluri cu pereche `-dark`, 9 sloturi de categorie, slotul 9 cu pereche), `typography` (18), `rounded` (8), `spacing` (26) și fiecare `{path}` din proză și din `components`: toate se rezolvă. Contrastele din tabel, recalculate: corecte. Golurile sunt la valorile care nu sunt tokeni.

### Findings
- **medium** Unii tokeni de componentă sunt proză și nu se pot rezolva: `'category colour 11% over {colors.surface}'`, `'2px {colors.tape} + 8px {colors.tape} 26%'`, `'1.5px dashed, {colors.signal} 70%'`, `'3px, category colour 28%'`, `'{colors.scrim} 40%'` (DESIGN frontmatter: `category-chip-active`, `entry-card-new`, `my-notes`, `section-header`, `entry-sheet`, `situation-callout`, `dialog`). Builder-ul trebuie să ghicească formula și cum ajunge culoarea categoriei în CSS. *Fix:* o singură convenție declarată o dată (ex. „culoarea categoriei e variabila `--category` pe element; diluările sunt `color-mix(in srgb, A p%, B)`”) și valorile scrise în ea.
- **medium** Umbrele nu au tokeni pentru toate nivelurile: nivelul 2 există doar ca `entry-card-hover.shadow`, nivelul 3 (dialog) e descris ca „nivelul 2 + scrim”, umbra benzii (`0 2px 5px rgba(0,0,0,.12)`) și „umbra colorată din accent” a `open-in-browser` stau doar în proză; `toast` și `dialog` nu au cheie `shadow` (DESIGN Elevation & Depth, Components). *Fix:* tokeni `elevation-1/2/3` (cu `-dark`) într-un singur loc, referiți de componente.
- **low** Lipsesc din tabelul de contrast două combinații de text folosite: {colors.muted} pe {colors.surface-2} (placeholder-ul căutării; 5,3 / 4,9) și {colors.accent} pe {colors.accent-bg} (contorul tabului activ; 5,6 / 6,1). Ambele trec (DESIGN Colors). *Fix:* două rânduri în tabel.
- **low** `keyword-tag` are text de 12,5 px, în afara scării tipografice; titlurile din `markdown-content` sunt „în Bahnschrift” fără mărimi (DESIGN Components). *Fix:* referă tokeni existenți (`{typography.caption}`/`{typography.label-sm}`; `headline`/`title-sm` pentru h2/h3).

## 3. Component coverage — thin

Verificat: fiecare componentă numită în cele două fișiere are un rând în DESIGN.Components (sau în frontmatter) și unul în EXPERIENCE.Component Patterns. Componentele de afișare sunt bine acoperite; lipsesc controalele de editare, stările interactive și câteva elemente folosite doar în EXPERIENCE.

### Findings
- **high** Modul de editare nu are controalele de care are nevoie. EXPERIENCE spune că „câmpurile scrise de Claude devin `text-field`”, dar printre ele sunt categorii (1–2, doar din zona felului), tip (repo/site/aplicație), situații („adaugă / șterge rând”), conținut Markdown și surse (listă de linkuri); „Unifică…” din `category-manager` alege ținta „dintr-o listă”, iar ștergerea cere un „selector de țintă”. DESIGN are doar `text-field` (EXPERIENCE Component Patterns `text-field`, `category-manager`, State Patterns; DESIGN Components). Fiecare tichet își va inventa selectorul și editorul de liste. *Fix:* componente `select` (tip, țintă de unificare), `category-picker` (1–2 pastile din zonă, ce se întâmplă la a 3-a), `list-editor` (rânduri cu adaugă/șterge, folosit la situații, cuvinte-cheie, surse), fiecare cu aspect în DESIGN și comportament în EXPERIENCE.
- **high** Butoanele și pastilele nu au aspect pentru hover, apăsat și inactiv. `button`, `button-ghost`, `button-danger`, `button-danger-solid`, `toolbar-button(-primary)` au doar tokeni în frontmatter, fără rând în DESIGN.Components; nicio componentă nu are stare inactivă, deși EXPERIENCE se bazează pe ea în cel puțin 6 locuri („Salvează” inactiv, „Șterge” inactiv până alegi ținta, „Unifică…” inactiv, „Se exportă…” inactiv, butoane inactive cât rulează acțiunea). Doar `entry-card` are hover (DESIGN Components; EXPERIENCE Component Patterns, State Patterns). *Fix:* un rând „Butoane” în DESIGN.Components cu hover / apăsat / inactiv / în lucru pentru toată familia, plus hover pentru `category-chip`, `zone-tab`, `related-link`.
- **medium** Banda de conflict („Fișa a fost modificată din terminal. Salvarea ta va fi refuzată.” cu „Reîncarcă fișa”) nu are componentă în niciun spine, deși e o suprafață-cheie (memlog: „edit mode with conflict band”) (EXPERIENCE State Patterns, rândurile de modificare din terminal și `CONFLICT`). *Fix:* componentă `conflict-banner` în ambele fișiere.
- **medium** „Glif per categorie” din pătrățelul fișei nu are sursă: categoriile n-au câmp de glif, iar importurile pot crea categorii noi. Iconițele în general (lupă, straturi, creion, soare/lună, butoanele doar cu iconiță sub 960 px) nu au nicio specificație, iar CSP-ul (AD-9) cere să fie incluse în pachet (DESIGN `entry-sheet`, `category-bar`, `theme-switch`; EXPERIENCE Responsive). *Fix:* stabilește setul de iconițe (ex. sprite-ul SVG din machetă sau o bibliotecă anume, mărime și grosime) și scoate glifurile per categorie sau leagă-le de slotul de culoare.
- **low** Elemente numite doar în EXPERIENCE, fără aspect în DESIGN: tooltip (butoanele doar cu iconiță, calea din bara de stare la hover), carduri-schelet (Pornire), pastila tipului „site/repo/aplicație” de pe card, varianta `entry-card (Learn)` (înălțimea minimă de 220 px nu e token). *Fix:* câte un rând scurt fiecare, sau tooltip nativ (`title`) declarat explicit.
- **low** „Salvează” folosește `toolbar-button-primary` în `sheet-bar`, o componentă de toolbar aproape identică vizual cu `button` (DESIGN `sheet-bar`). *Fix:* un `button-primary` propriu.

## 4. State coverage — adequate

Verificat pe fiecare suprafață din IA: pornire, catalog gol, categorie goală, căutare fără rezultat, sosire, actualizare din terminal, editare (conflict, verificare cu accepted/warned/rejected/offline, invalid local), notițe eșuate, categorii, bază ocupată, ștergere, export (în curs/reușit/eșuat/anulat), erori de pornire, focus. Acoperirea e largă; lipsesc câteva interacțiuni între stări.

### Findings
- **medium** Fișa citită „se actualizează live” când se schimbă din terminal, iar „Notițele mele” sunt mereu editabile, cu salvare după ~600 ms. Nicio regulă nu spune că reîmprospătarea nu are voie să suprascrie textul din notițe cât e în focus sau nesalvat (EXPERIENCE `entry-sheet`, `my-notes`). *Fix:* „la reîmprospătare, `my-notes` își păstrează textul local cât are focus sau o salvare în așteptare”.
- **medium** Erorile de pornire folosesc coduri greșite sau lipsă: „bază mai nouă decât aplicația” e `DATABASE_TOO_NEW`, nu `MIGRATION_MISMATCH` (care înseamnă hash nepotrivit); `CATALOG_NOT_FOUND`, `CONFIG_INVALID`, `DATABASE_NEEDS_MIGRATION` nu au tratament (EXPERIENCE State Patterns; `src/core/errors.ts`). *Fix:* un rând pe cod, cu textul din `strings.ro.ts` și comanda de rulat.
- **medium** Cu Esc nu e clar ce se întâmplă: ordinea „golește căutarea / închide dialogul / renunță la editare / înapoi din fișă” ar goli căutarea înaintea închiderii unui dialog sau a ieșirii din fișă. În plus, „Renunță”/Esc aruncă editările fără confirmare, deși „Reîncarcă fișa” cere confirmare (EXPERIENCE Interaction Primitives, `sheet-bar`, State Patterns). *Fix:* prioritate după context (dialog > editare > căutare cu focus > fișă) și confirmare la Renunță când formularul are modificări.
- **medium** Când sosesc fișe în ambele zone în aceeași actualizare (ex. `50 github repo/`: unelte și materiale), nu se știe unde duce „Vezi” (spec-ul spune „duce în zona lor, la Toate”) (EXPERIENCE State Patterns „Sosire”, Flow 2). *Fix:* regulă explicită (ex. zona cu cele mai multe fișe noi, sau câte un toast pe zonă).
- **low** Stări goale mici din fișă nedefinite: fără resurse înrudite (secțiunea dispare sau „· 0”?), notițe goale (placeholder?), repo fără date GitHub (limită de rată: rubricile Stele/Ultimul commit dispar?), sosire cu căutare activă („vederea curentă”) (EXPERIENCE `entry-sheet`, State Patterns). *Fix:* o linie fiecare.
- **low** Indicatorul din bara de stare are o singură stare, „Catalog la zi” (EXPERIENCE `status-bar`). *Fix:* definește și altă stare (ex. bază ocupată) sau declară-l static.

## 5. Visual reference coverage — strong

`mockups/`, `wireframes/` și `imports/` sunt goale, cum era de așteptat. Macheta aleasă, `.working/direction-planseta-calda-final.html`, e legată în DESIGN (Brand & Style, Components) și în EXPERIENCE (Foundation), cu ecranele 01–03 numite și panoul „Doze de planșă” exclus explicit. Regula „spine-urile câștigă” e scrisă o dată în fiecare spine. Abaterile de la machetă sunt numite: Proprietar, indicatorul de import, culoarea cifrelor, culorile Learn.

### Findings
- **low** Macheta are butonul de sortare „după adăugare” și stelele doar în subsolul cardului, dar niciuna dintre abateri nu e numită (EXPERIENCE `section-header` „Fără sortare”; DESIGN `entry-card`). *Fix:* adaugă-le la abaterile numite.

## 6. Bloat & overspecification — thin

Verificat: valori repetate, proză acolo unde ar merge un tabel, restatări din surse, secțiuni pe care nu le citește niciun builder. DESIGN.md are 609 rânduri, din care 434 de frontmatter.

### Findings
- **medium** Aceleași valori stau în 3–4 locuri, deci în mai multe surse de adevăr. Exemple: rotirea ștampilei −7° (frontmatter `kind-stamp.rotate`, Shapes, Components), inelul fișei noi (frontmatter, Components), colțurile de decupare (frontmatter, Shapes, Components), razele (frontmatter `rounded`, `components.*.radius`, tabelul Shapes, proza din Components), hex-urile (frontmatter și tabelul Colors), umbra nivelului 1 (frontmatter și Elevation). Rândurile din Components repetă în bună parte tokenii din frontmatter (ex. `title-bar`, `search-box`, `kbd`) (DESIGN Colors, Elevation, Shapes, Components). *Fix:* valorile stau doar în frontmatter; proza din Components păstrează doar anatomia și ce nu încape în tokeni; Shapes rămâne regula estetică plus excepțiile; Colors păstrează rolul și coloanele „Folosit / Nu se folosește”, fără hex.
- **medium** Anatomia `entry-card` și `entry-sheet` stă în celule de tabel de 120+ cuvinte, cu ordinea, variantele și prioritățile într-o singură frază, adică exact componentele cele mai încărcate (DESIGN Components). Un subagent care construiește cardul trebuie să le despartă singur. *Fix:* câte un H3 cu listă ordonată (sus → jos; Toolbox vs. Learn; prioritățile din subsol), restul tabelului rămânând pe un rând.
- **low** Istoria direcțiilor apare de ~5 ori: tabelul și paragraful din Brand & Style, bullet-ul grilei din Layout, Do's and Don'ts, iar în EXPERIENCE, Inspiration. „Moale, Paleta, Mica — nealese” nu folosește nimănui. *Fix:* istoria rămâne doar în EXPERIENCE.Inspiration, iar în DESIGN un singur rând Don't („fără rigle, cote, cartuș, cianotipie”).
- **low** Numărul de coloane e scris de două ori, ca valoare derivată, și diferă: DESIGN „sub ~700 px una”, EXPERIENCE „640–719 → 1, 720–959 → 2”. De fapt, cu `work-x` 32 px și minimum 320 px, a doua coloană apare abia de la ~728 px. Panoul lateral „se îngustează la 300 px” e o valoare care nu e token (DESIGN Layout & Spacing; EXPERIENCE Responsive). *Fix:* „numărul de coloane rezultă din `auto-fill`”, fără cifre; token `sheet-side-width-narrow`.
- **low** Scara tipografică are 18 roluri, cu pași de 0,5 px (13 / 13,5 / 14 / 14,5), copiați din machetă și greu de deosebit la 100% (DESIGN frontmatter `typography`). *Fix:* comprimă la ~10–12 roluri sau notează că pașii de 0,5 px sunt intenționați.
- **low** Lista „ce lipsește” apare de trei ori: Foundation „Lipsesc intenționat”, Inspiration „Anti-patterns respinse” și Interaction Primitives „Interzise”. „Decise la triaj” repetă decizii deja scrise în secțiunile de comportament (EXPERIENCE). *Fix:* păstrează Anti-patterns și Interzise, scoate „Decise la triaj” (jurnalul e în `.memlog.md`).

## 7. Inheritance discipline — thin

Verificat: cele 8 căi din `sources` se rezolvă; CAP-urile sunt citate după id; numele categoriilor sunt luate exact din `categories-seed.md`; numele componentelor sunt la fel în ambele fișiere; referințele la tokeni din EXPERIENCE (`{colors.tape}`, `{colors.signal}`, `{colors.danger}`, `{spacing.card-min-width}`, `{spacing.sheet-side-width}`) se rezolvă; spec-ul, arhitectura și codul curent (`dto.ts`, `errors.ts`, migrarea 0001) au fost comparate cu spine-urile.

### Findings
- **high** Slotul de culoare al categoriei „se calculează din ordinea creării în zona ei, ciclic”, dar arhitectura nu are ordinea creării: `categories` (AD-5, migrarea 0001) are doar `id, owner_id, zone, name, name_key`, iar `CategoryDto` doar `id, zone, name`; `rowid`-ul implicit nu e stabil la `VACUUM`. Mai grav, dacă slotul e poziția în lista existentă, o unificare sau o ștergere mută culorile tuturor categoriilor de după ea, contrar promisiunii „să rămână același” (DESIGN Colors, „Culorile categoriilor”; EXPERIENCE Flow 5 „culoarea rămâne”). *Fix:* o regulă fără schemă nouă, ex. seed-ul cu sloturi fixe după `name_key` și categoriile noi cu `hash(id) mod 9`, sau o coloană nouă adăugată prin `bmad-architecture`.
- **medium** Preferințele ferestrei (tema persistă, poziția și dimensiunea persistă) nu au un loc în arhitectură. Memlog-ul notase că locul e o decizie de arhitectură, iar spine-urile nu-l semnalează. Riscul: un builder scrie în `%APPDATA%\whenkit\config.json`, care aparține lui `whenkit init` (AD-8), sau în workspace. În plus, `productName` „WhenKit” face ca `userData` din Electron să fie același folder (Windows nu distinge majusculele) (EXPERIENCE `theme-switch`, Responsive & Platform). *Fix:* numește locul (ex. `localStorage` din renderer sau un fișier separat în `userData`, niciodată `config.json`) și trece-l prin `bmad-architecture` dacă e regulă.
- **medium** Formatele din glosar sunt încălcate chiar de exemple: „ultima adăugată 15 oct., 20:39” contrazice „date `15.10.2026`”; „75 fișe” e greșit în română (corect „75 de fișe”: de la 20 în sus apare „de”), și nu există o regulă de plural pentru `strings.ro.ts` (EXPERIENCE `status-bar`, Voice and Tone glosar). *Fix:* o regulă de plural (1 / 2–19 / ≥ 20 „de”) și exemple corectate; un singur format de dată, sau două formate numite (scurt / lung).
- **medium** Cardul Learn nu are subsol, deci nici `verification-flag`, deși EXPERIENCE pune semnalul „pe card”, iar materialele Learn pot avea note (`forced_by_user`, `github_archived`, `source_link_removed`). În schimb, la repo-uri stelele apar atât în rândul de metadate de sus, cât și în subsol (DESIGN `entry-card`; EXPERIENCE `verification-flag`). *Fix:* stabilește unde apare semnalul pe cardul Learn (ex. lângă ștampilă) și păstrează stelele într-un singur loc.
- **low** Textul de la căutarea fără rezultat („Am căutat în nume, „ce face”, situații și cuvinte-cheie.”) omite `content`, care e indexat în `entries_fts` (EXPERIENCE State Patterns). *Fix:* adaugă „conținut”, sau formulează fără listă.
- **low** Nu se spune că felul (unealtă/material/concept) nu se editează: schimbarea lui ar muta zona și ar invalida categoriile (EXPERIENCE `text-field`). *Fix:* adaugă „fel” la „Nu se editează”.

## 8. Shape fit — strong

DESIGN are secțiunile în ordinea canonică, toate prezente. EXPERIENCE are toate secțiunile obligatorii (Foundation, IA, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows). Responsive & Platform e declanșată de memlog („orice lățime”), iar Inspiration de direcțiile respinse. Motion e inventată și își merită locul (autorul vrea animație, plus regula `prefers-reduced-motion`).

### Findings
- **low** Regula de temă („`{colors.x}` devine `x-dark` noaptea”) e scrisă doar într-un comentariu YAML, iar `theme-switch` referă direct tokeni `-dark` (`knob-dark`, `icon-active-dark`), deci modelul pare amestecat (DESIGN frontmatter, Colors). *Fix:* o propoziție în Colors care declară regula și excepția (cheile `*-dark` din componente apar doar unde rolul diferă noaptea).
- **low** Scurtăturile `[` / `]` și `Ctrl+=` nu merg după caracter pe tastatura română standard, unde tastele acelea dau ă/î. Grila are navigare cu săgeți, dar nu spune dacă e un singur oprire de Tab (roving tabindex) sau câte unul pe card (EXPERIENCE Interaction Primitives, Accessibility Floor). *Fix:* „scurtăturile se leagă după `event.code`”; „grila e un singur oprire de Tab, săgețile mută selecția”.

## Mechanical notes

- `sources` se rezolvă în ambele fișiere (8/8). Fiecare `{colors|typography|rounded|spacing.*}` din proză și frontmatter se rezolvă. Nu există Mermaid.
- `category-manager.container: '{components.dialog}'` e o referință la o componentă: e validă după structura YAML, dar neobișnuită; tabelul Elevation scrie `entry-card.shadow` fără acolade.
- Componente din frontmatter fără rând propriu în proză: `app-mark` (e în tabelul Brand), `toolbar-button`, `toolbar-button-primary`, `category-chip-active`, `category-tab`, `button`, `button-ghost`, `button-danger`, `button-danger-solid`. Invers, `entry-card (Learn)` apare în proză fără cheie în frontmatter.
- Pozițiile tabului de categorie: 24 / 94 / 162 px în DESIGN față de 26 / 94 / 162 în machetă (neglijabil).
- Contrastele recalculate se potrivesc cu tabelul. Culorile de categorie față de `surface`: violetul noaptea 2,85 (acceptat explicit); slotul 8 ziua 3,04 și slotul 5 ziua 3,14 trec la limită.
- Fonturile verificate pe sistem: Bahnschrift și Segoe UI Variable au ș/ț cu virgulă dedesubt și glifurile ↗ ↵ ⚑ ★ → ›.
- Frontmatter-ul EXPERIENCE nu are `description` (opțional; exemplele nu-l au). Ambele spine-uri sunt `status: draft`.

## Rezolvare (2026-10-16)

Aplicată în DESIGN.md și EXPERIENCE.md după triajul din `.memlog.md`.

| # | Constatare | Rezultat |
|---|---|---|
| 1.1 | low · Flow 7 fără eșec | fixed: eșec cu `source_link_removed` |
| 2.1 | medium · tokeni de componentă în proză | fixed: convenția `--category` + `color-mix(in srgb, A p%, B)`, declarată o dată în Colors; toate valorile rescrise în ea |
| 2.2 | medium · umbre fără tokeni | fixed: grupul `elevation` (1, 2, tape, accent, cu `-dark`), referit de card, fișă, toast, dialog, bandă, „Deschide în browser” |
| 2.3 | low · două contraste lipsă | fixed: rânduri noi în tabel |
| 2.4 | low · `keyword-tag` 12,5 px, titluri Markdown fără mărimi | fixed: `{typography.caption}`, `h2`/`h3` = `headline`/`title-sm` |
| 3.1 | high · controalele modului de editare | fixed: `select`, `category-picker`, `list-editor` în ambele fișiere |
| 3.2 | high · stări hover/apăsat/inactiv | fixed: secțiunea „Butoane și stări interactive” (hover, apăsat, focus, inactiv, în lucru) + tokenii `interactive` |
| 3.3 | medium · banda de conflict | fixed: componenta `conflict-banner` |
| 3.4 | medium · glif per categorie, iconițe | fixed: inițiala categoriei; un singur set, Lucide, inclus în pachet |
| 3.5 | low · tooltip, schelet, pastila tipului, cardul Learn | fixed: `tooltip` nativ, `entry-card-skeleton`, pastila în anatomia cardului, cheia `entry-card-learn` |
| 3.6 | low · „Salvează” pe `toolbar-button-primary` | fixed: `button-primary` |
| 4.1 | medium · notițele suprascrise de reîmprospătare | fixed: textul local rămâne cât are focus sau salvare în așteptare |
| 4.2 | medium · coduri de eroare la pornire | fixed: tabel pe cod (`WORKSPACE_NOT_CONFIGURED`, `CONFIG_INVALID`, `CATALOG_NOT_FOUND`, `DATABASE_NEEDS_MIGRATION`, `DATABASE_TOO_NEW`, `MIGRATION_MISMATCH`); `DATABASE_BUSY`, `OFFLINE`, `INTERNAL` numite la stările lor |
| 4.3 | medium · Esc ambiguu, renunțare fără confirmare | fixed: prioritate pe context + dialog de confirmare la renunțare cu modificări |
| 4.4 | medium · sosiri în ambele zone | fixed: câte un toast pe zonă |
| 4.5 | low · stări goale mici din fișă | fixed: secțiuni care lipsesc, placeholder la notițe, sosire cu căutare activă |
| 4.6 | low · indicatorul din bara de stare | fixed: declarat static |
| 5.1 | low · sortarea și stelele din machetă | fixed: adăugate la abaterile numite |
| 6.1 | medium · valori repetate | fixed: valorile stau doar în YAML (inclusiv `motion` și pragurile de lățime); proza referă tokeni; Colors fără hex |
| 6.2 | medium · celule de 120+ cuvinte | fixed: H3 `entry-card` și `entry-sheet` cu liste ordonate și tabel de variante |
| 6.3 | low · istoria direcțiilor repetată | fixed: doar în EXPERIENCE.Inspiration; rândul „Moale, Paleta, Mica” scos |
| 6.4 | low · numărul de coloane, 300 px | fixed: coloanele rezultă din `auto-fill`; `sheet-side-width-narrow` și pragurile ca tokeni |
| 6.5 | low · scara tipografică de 18 roluri | not changed: pașii de 0,5 px sunt declarați intenționați; comprimarea ar schimba aspectul ales de autor |
| 6.6 | low · „ce lipsește” de trei ori, „Decise la triaj” | fixed: rândul din Foundation și secțiunea „Decise la triaj” scoase |
| 7.1 | high · slotul culorii din ordinea creării | fixed: `hash(id) mod 9 + 1`, coliziuni acceptate |
| 7.2 | medium · unde persistă preferințele ferestrei | fixed: fișier propriu în `userData`, niciodată `config.json`; de trecut prin `bmad-architecture` |
| 7.3 | medium · formatele și pluralul | fixed: un singur format de dată, regula `Intl.PluralRules('ro')`, exemple corectate |
| 7.4 | medium · cardul Learn fără subsol, stele dublate | fixed: subsol în ambele zone cu `verification-flag`; stelele doar în subsol |
| 7.5 | low · textul căutării fără rezultat | fixed: „Am căutat în tot textul fișelor.” |
| 7.6 | low · felul editabil? | fixed: felul e la „Nu se editează” |
| 8.1 | low · regula temei doar în comentariu | fixed: paragraful „Regula temei” în Colors |
| 8.2 | low · scurtături pe tastatura română, Tab în grilă | fixed: `event.code`; grila e o singură oprire de Tab |
| — | note mecanice | fixed: `category-manager.container` scos, umbrele referite cu acolade, toate componentele din YAML au rând în proză, pozițiile tabului 26 / 94 / 162 |
