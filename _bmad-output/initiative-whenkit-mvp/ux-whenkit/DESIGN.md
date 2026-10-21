---
name: whenkit
description: 'WhenKit, fereastra desktop a catalogului whenkit: o planșetă de desen caldă (hârtie ivoire ziua, navy de planșă noaptea), care arată densă ca o unealtă de lucru, dar rămâne simplă și prietenoasă.'
status: final
created: 2026-10-16
updated: 2026-10-21
sources:
  - ../spec-whenkit/spec-whenkit.md
  - ../spec-whenkit/ui-screens.md
  - ../spec-whenkit/entry-model.md
  - ../spec-whenkit/categories-seed.md
  - ../spec-whenkit/card-writing-rules.md
  - ../spec-whenkit/test-scenarios.md
  - ../epic-fereastra-whenkit/epic-fereastra-whenkit.md
  - ../architecture-whenkit/architecture-whenkit.md
colors:
  # Noaptea, fiecare token e înlocuit de perechea lui cu sufixul -dark (regula temei, vezi Colors).
  canvas: '#F7F4EE'
  surface: '#FFFDF9'
  surface-2: '#F5F1E9'
  chrome: '#F0EBE2'
  line: '#E7E0D3'
  line-strong: '#D4CAB9'
  grid: '#EEE7DA'
  grid-major: '#E3D9C8'
  ink: '#1D1B18'
  ink-2: '#47423A'
  muted: '#6A6357'
  accent: '#1D56C9'
  accent-bg: '#E8EEFA'
  accent-ink: '#FFFFFF'
  signal: '#B93F0E'
  signal-bg: '#FCEDE1'
  ok: '#2F7D46'
  danger: '#B91C1C'
  tape: '#EFD48A'
  tape-ink: '#3A2F0C'
  scrim: '#1D1B18'
  canvas-dark: '#111923'
  surface-dark: '#17212D'
  surface-2-dark: '#1C2836'
  chrome-dark: '#0D131A'
  line-dark: '#263242'
  line-strong-dark: '#364557'
  grid-dark: '#17212C'
  grid-major-dark: '#1D2A38'
  ink-dark: '#F0EBE2'
  ink-2-dark: '#C3BCB0'
  muted-dark: '#9A9387'
  accent-dark: '#86B1FF'
  accent-bg-dark: '#1D3150'
  accent-ink-dark: '#0B1424'
  signal-dark: '#FFA867'
  signal-bg-dark: '#3A2618'
  ok-dark: '#7BD392'
  danger-dark: '#FF8A8A'
  tape-dark: '#D2B866'
  tape-ink-dark: '#1E1806'
  scrim-dark: '#05080C'
  # Sloturile categoriilor: în fiecare zonă, categoriile sortate după id primesc sloturile 1…9 în ordine, apoi de la capăt (vezi Colors). Aceleași în ambele teme, în afară de slotul 9.
  category-1: '#2563EB'
  category-2: '#EA580C'
  category-3: '#DB2777'
  category-4: '#7C3AED'
  category-5: '#D97706'
  category-6: '#DC2626'
  category-7: '#0891B2'
  category-8: '#65A30D'
  category-9: '#475569'
  category-9-dark: '#94A3B8'
typography:
  display: { fontFamily: Bahnschrift, fontSize: 36px, fontWeight: '600', lineHeight: '1.05', letterSpacing: -0.005em }
  headline: { fontFamily: Bahnschrift, fontSize: 23px, fontWeight: '600', lineHeight: '1', letterSpacing: 0.01em }
  card-title: { fontFamily: Bahnschrift, fontSize: 21px, fontWeight: '600', lineHeight: '1.15', letterSpacing: 0.01em }
  tab: { fontFamily: Bahnschrift, fontSize: 16px, fontWeight: '600', lineHeight: '1', letterSpacing: 0.02em }
  title-sm: { fontFamily: Bahnschrift, fontSize: 14.5px, fontWeight: '600', lineHeight: '1.1', letterSpacing: 0.01em }
  app-title: { fontFamily: Bahnschrift, fontSize: 13.5px, fontWeight: '600', lineHeight: '1', letterSpacing: 0.02em }
  label: { fontFamily: Bahnschrift, fontSize: 13px, fontWeight: '600', lineHeight: '1', letterSpacing: 0.05em }
  label-sm: { fontFamily: Bahnschrift, fontSize: 12px, fontWeight: '600', lineHeight: '1', letterSpacing: 0.03em }
  stamp: { fontFamily: Bahnschrift, fontSize: 11px, fontWeight: '700', lineHeight: '1', letterSpacing: 0.18em }
  tape: { fontFamily: Bahnschrift, fontSize: 11.5px, fontWeight: '600', lineHeight: '1', letterSpacing: 0.1em }
  body: { fontFamily: 'Segoe UI Variable Text', fontSize: 14px, fontWeight: '400', lineHeight: '1.5' }
  body-lead: { fontFamily: 'Segoe UI Variable Text', fontSize: 14.5px, fontWeight: '400', lineHeight: '1.55' }
  body-sm: { fontFamily: 'Segoe UI Variable Text', fontSize: 13.5px, fontWeight: '400', lineHeight: '1.5' }
  button: { fontFamily: 'Segoe UI Variable Text', fontSize: 13.5px, fontWeight: '500', lineHeight: '1' }
  situation: { fontFamily: 'Segoe UI Variable Text', fontSize: 13px, fontWeight: '400', lineHeight: '1.4' }
  caption: { fontFamily: 'Segoe UI Variable Text', fontSize: 12px, fontWeight: '400', lineHeight: '1.35' }
  mono: { fontFamily: 'Cascadia Mono', fontSize: 12px, fontWeight: '400', lineHeight: '1.35' }
  mono-sm: { fontFamily: 'Cascadia Mono', fontSize: 11.5px, fontWeight: '400', lineHeight: '1' }
  kbd: { fontFamily: 'Cascadia Mono', fontSize: 11px, fontWeight: '500', lineHeight: '1' }
rounded:
  sm: 6px
  tab: 7px
  md: 10px
  lg: 12px
  xl: 14px
  card: 16px
  sheet: 20px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '7': 28px
  '8': 32px
  bar-x: 24px
  work-x: 32px
  card-gap-x: 24px
  card-gap-y: 26px
  card-min-width: 300px
  grid-minor: 16px
  grid-major: 80px
  titlebar-height: 40px
  toolbar-height: 64px
  category-bar-height: 60px
  sheet-bar-height: 58px
  status-bar-height: 32px
  sheet-side-width: 344px
  sheet-side-width-narrow: 300px
  bp-wide: 1200px
  bp-half: 960px
  bp-narrow: 720px
  window-min-width: 640px
  window-min-height: 480px
elevation:
  '1': '0 1px 2px rgba(60,45,20,.06), 0 14px 32px -20px rgba(60,45,20,.32)'
  1-dark: '0 1px 0 rgba(0,0,0,.25), 0 14px 34px -18px rgba(0,0,0,.65)'
  '2': '0 2px 4px rgba(60,45,20,.07), 0 22px 44px -22px rgba(29,86,201,.40)'
  2-dark: '0 1px 0 rgba(0,0,0,.25), 0 22px 44px -20px rgba(0,0,0,.8)'
  tape: '0 2px 5px rgba(0,0,0,.12)'
  accent: '0 10px 24px -14px {colors.accent}'
motion:
  quick: 150ms
  fade: 200ms
  slide: 250ms
  theme: 300ms
  pulse: 600ms
  arrival: 900ms
  ease: ease-out
  arrival-ease: 'cubic-bezier(.2,.9,.3,1.2)'
  arrival-offset: -12px
  enter-scale: '0.98'
  stagger: 30ms
  stagger-max: '8'
  caret-blink: 1s
  search-debounce: 150ms
  notes-autosave: 600ms
  saved-min-visible: 800ms
  skeleton-delay: 200ms
  toast-dwell: 6s
  tape-lifetime: 600s
components:
  icon:
    set: lucide-react
    size: 16px
    size-sm: 12px
    stroke-width: '1.5'
  interactive:
    hover-overlay: 'color-mix(in srgb, {colors.ink} 5%, transparent)'
    pressed-overlay: 'color-mix(in srgb, {colors.ink} 10%, transparent)'
    pressed-offset: 1px
    disabled-opacity: '0.45'
    busy-icon: loader-circle
  work-area:
    background: '{colors.canvas}'
    grid-minor: '{spacing.grid-minor}'
    grid-minor-color: '{colors.grid}'
    grid-major: '{spacing.grid-major}'
    grid-major-color: '{colors.grid-major}'
    grid-center-opacity: '0.42'
    padding-x: '{spacing.work-x}'
  title-bar:
    background: '{colors.chrome}'
    height: '{spacing.titlebar-height}'
    typography: '{typography.app-title}'
  app-mark:
    background: '{colors.accent}'
    foreground: '{colors.accent-ink}'
    dot: '{colors.signal}'
    size: 20px
    radius: '{rounded.sm}'
  theme-switch:
    background: '{colors.surface-2}'
    border: '{colors.line-strong}'
    knob: '{colors.surface}'
    knob-dark: '{colors.accent-bg-dark}'
    knob-border-dark: '{colors.accent-dark}'
    icon-active: '{colors.signal}'
    icon-active-dark: '{colors.accent-dark}'
    height: 28px
    radius: '{rounded.full}'
  toolbar:
    background: '{colors.surface}'
    border-bottom: '{colors.line}'
    height: '{spacing.toolbar-height}'
    padding-x: '{spacing.bar-x}'
  zone-tab:
    typography: '{typography.tab}'
    foreground: '{colors.muted}'
    foreground-hover: '{colors.ink-2}'
    foreground-active: '{colors.ink}'
    indicator: '{colors.accent}'
    indicator-height: 3px
    count-typography: '{typography.mono-sm}'
    count-background: '{colors.surface-2}'
    count-background-active: '{colors.accent-bg}'
    count-foreground-active: '{colors.accent}'
  search-box:
    background: '{colors.surface-2}'
    border: '{colors.line}'
    border-focus: '{colors.accent}'
    placeholder: '{colors.muted}'
    height: 42px
    max-width: 560px
    radius: '{rounded.xl}'
    typography: '{typography.body}'
  toolbar-button:
    background: transparent
    foreground: '{colors.ink-2}'
    height: 38px
    radius: '{rounded.lg}'
    typography: '{typography.button}'
  toolbar-button-primary:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.line-strong}'
    height: 38px
    radius: '{rounded.lg}'
    typography: '{typography.button}'
  category-bar:
    background: '{colors.surface}'
    border-bottom: '{colors.line}'
    height: '{spacing.category-bar-height}'
    padding-x: '{spacing.bar-x}'
    label-typography: '{typography.label}'
    scroll-button-size: 34px
    fade-width: 130px
  category-chip:
    background: '{colors.surface}'
    border: '{colors.line}'
    border-hover: '{colors.line-strong}'
    foreground: '{colors.ink-2}'
    count: '{colors.muted}'
    count-typography: '{typography.mono-sm}'
    typography: '{typography.button}'
    height: 34px
    radius: '{rounded.full}'
    dot-size: 10px
    dot-all: '{colors.ink-2}'
  category-chip-active:
    background: 'color-mix(in srgb, var(--category) 11%, {colors.surface})'
    border: 'color-mix(in srgb, var(--category) 55%, {colors.surface})'
    foreground: '{colors.ink}'
    dot-halo: '0 0 0 3px color-mix(in srgb, var(--category) 28%, transparent)'
  section-header:
    typography: '{typography.headline}'
    tab-width: 16px
    tab-height: 9px
    dimension-line: 'color-mix(in srgb, {colors.accent} 45%, {colors.canvas})'
    dimension-label: '{typography.mono}'
  entry-card:
    background: '{colors.surface}'
    border: '{colors.line}'
    radius: '{rounded.card}'
    padding: '20px 22px 16px'
    shadow: '{elevation.1}'
    meta: '{typography.mono}'
    meta-foreground: '{colors.muted}'
    type-pill-border: '{colors.line}'
    title: '{typography.card-title}'
    body: '{typography.body-sm}'
    body-foreground: '{colors.ink-2}'
    body-lines: '2'
    situations-label: '{typography.label-sm}'
    footer-border: '1px dashed {colors.line}'
    footer-text: '{typography.caption}'
    footer-meta: '{typography.mono-sm}'
    footer-dot-size: 8px
  entry-card-learn:
    min-height: 220px
  entry-card-hover:
    border: '{colors.line-strong}'
    shadow: '{elevation.2}'
    lift: -2px
  entry-card-selected:
    border: '{colors.accent}'
    ring: '0 0 0 1px {colors.accent}'
    shadow: '{elevation.2}'
    crop-corner-color: '{colors.accent}'
    crop-corner-size: 16px
    crop-corner-stroke: 2px
    crop-corner-offset: -9px
    keyboard-hint-background: '{colors.accent}'
    keyboard-hint-foreground: '{colors.accent-ink}'
  entry-card-new:
    border: transparent
    ring: '0 0 0 2px {colors.tape}, 0 0 0 8px color-mix(in srgb, {colors.tape} 26%, transparent)'
  entry-card-skeleton:
    background: '{colors.surface}'
    border: '{colors.line}'
    bar: '{colors.surface-2}'
    radius: '{rounded.card}'
  category-tab:
    background: 'var(--category)'
    width: 50px
    height: 9px
    radius: '{rounded.tab}'
    offset-top: -8px
    positions: '26px, 94px, 162px'
  kind-stamp:
    concept: '{colors.signal}'
    material: '{colors.accent}'
    typography: '{typography.stamp}'
    border: '2px double'
    radius: '{rounded.sm}'
    rotate: -7deg
    opacity: '0.9'
    blend: multiply
    blend-dark: normal
  arrival-tape:
    background: 'color-mix(in srgb, {colors.tape} 92%, transparent)'
    foreground: '{colors.tape-ink}'
    typography: '{typography.tape}'
    padding: '8px 18px 7px'
    rotate: -3deg
    offset-top: -15px
    offset-left: 30px
    clip-path: 'polygon(2% 0, 98% 6%, 100% 48%, 97% 100%, 3% 94%, 0 52%)'
    shadow: '{elevation.tape}'
  situation-item:
    background: '{colors.surface-2}'
    foreground: '{colors.ink}'
    marker: 'inset 3px 0 0 var(--category)'
    radius: '{rounded.md}'
    typography: '{typography.situation}'
  verification-flag:
    foreground: '{colors.signal}'
    typography: '{typography.mono-sm}'
    icon: flag
  sheet-bar:
    background: '{colors.surface}'
    border-bottom: '{colors.line}'
    height: '{spacing.sheet-bar-height}'
    padding-x: '{spacing.bar-x}'
    crumb: '{colors.muted}'
    crumb-current: '{colors.ink}'
  conflict-banner:
    background: '{colors.signal-bg}'
    border: '{colors.signal}'
    foreground: '{colors.ink}'
    icon: triangle-alert
    icon-color: '{colors.signal}'
    radius: '{rounded.lg}'
    typography: '{typography.body-sm}'
  entry-sheet:
    background: '{colors.surface}'
    border: '{colors.line}'
    radius: '{rounded.sheet}'
    shadow: '{elevation.1}'
    tab-width: 84px
    tab-height: 11px
    tab-left: 40px
    mark-size: 50px
    mark-radius: '{rounded.xl}'
    mark-background: 'color-mix(in srgb, var(--category) 10%, {colors.surface})'
    mark-border: 'color-mix(in srgb, var(--category) 30%, transparent)'
    mark-initial: '{typography.headline}'
    mark-foreground: '{colors.ink-2}'
    title: '{typography.display}'
    subline: '{typography.mono}'
    lead: '{typography.body-lead}'
    section-label: '{typography.label}'
    section-rule: '{colors.line}'
    side-background: 'color-mix(in srgb, {colors.surface-2} 70%, {colors.surface})'
    side-border: '{colors.line}'
    side-width: '{spacing.sheet-side-width}'
    edit-type-width: 170px
  button:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.line-strong}'
    height: 36px
    padding-x: 14px
    radius: '{rounded.lg}'
    typography: '{typography.button}'
  button-primary:
    background: '{colors.accent}'
    foreground: '{colors.accent-ink}'
    border: '{colors.accent}'
  button-ghost:
    background: '{colors.surface-2}'
    foreground: '{colors.ink-2}'
    border: transparent
  button-danger:
    background: transparent
    foreground: '{colors.danger}'
    border: transparent
  button-danger-solid:
    background: '{colors.danger}'
    foreground: '{colors.surface}'
    border: '{colors.danger}'
  open-in-browser:
    background: '{colors.accent}'
    foreground: '{colors.accent-ink}'
    radius: '{rounded.xl}'
    padding: '14px 16px'
    typography: '{typography.title-sm}'
    url-typography: '{typography.mono-sm}'
    url-opacity: '0.85'
    shadow: '{elevation.accent}'
  situation-callout:
    background: '{colors.surface}'
    border: '{colors.line}'
    radius: '{rounded.lg}'
    typography: '{typography.body}'
    number-size: 26px
    number-background: 'color-mix(in srgb, var(--category) 10%, {colors.surface})'
    number-foreground: '{colors.ink-2}'
    number-typography: '{typography.mono-sm}'
  keyword-tag:
    background: '{colors.surface-2}'
    border: '{colors.line}'
    foreground: '{colors.ink-2}'
    radius: '{rounded.full}'
    typography: '{typography.caption}'
  my-notes:
    background: 'color-mix(in srgb, {colors.signal-bg} 50%, {colors.surface})'
    border: '1.5px dashed color-mix(in srgb, {colors.signal} 70%, transparent)'
    heading: '{colors.signal}'
    hint: '{colors.muted}'
    error: '{colors.danger}'
    caret: '{colors.signal}'
    radius: '{rounded.xl}'
    typography: '{typography.body}'
  related-link:
    background: '{colors.surface}'
    border: '{colors.line}'
    border-hover: '{colors.line-strong}'
    context: '{colors.muted}'
    arrow: '{colors.accent}'
    arrow-shift-hover: 2px
    radius: '{rounded.lg}'
    typography: '{typography.title-sm}'
  title-block:
    background: '{colors.surface}'
    border: '{colors.line-strong}'
    header-background: '{colors.surface-2}'
    label: '{colors.muted}'
    check: '{colors.ok}'
    radius: '{rounded.lg}'
    typography: '{typography.mono-sm}'
  markdown-content:
    body: '{typography.body}'
    h2: '{typography.headline}'
    h3: '{typography.title-sm}'
    table-header: '{colors.surface-2}'
    table-border: '{colors.line}'
    table-radius: '{rounded.lg}'
    code: '{typography.mono}'
    code-background: '{colors.surface-2}'
    link: '{colors.accent}'
  status-bar:
    background: '{colors.chrome}'
    border-top: '{colors.line}'
    foreground: '{colors.muted}'
    height: '{spacing.status-bar-height}'
    padding-x: '{spacing.bar-x}'
    typography: '{typography.caption}'
    counters: '{typography.mono-sm}'
    dot: '{colors.ok}'
    dot-size: 7px
  toast:
    background: '{colors.surface}'
    border: '{colors.line-strong}'
    stripe-width: 4px
    stripe-new: '{colors.tape}'
    stripe-error: '{colors.danger}'
    action: '{colors.accent}'
    width: 360px
    radius: '{rounded.xl}'
    shadow: '{elevation.2}'
    typography: '{typography.body-sm}'
    stack-gap: '{spacing.2}'
  dialog:
    background: '{colors.surface}'
    border: '{colors.line}'
    scrim: 'color-mix(in srgb, {colors.scrim} 40%, transparent)'
    shadow: '{elevation.2}'
    radius: '{rounded.sheet}'
    title: '{typography.headline}'
    body: '{typography.body}'
    confirm-width: 480px
  category-manager:
    width: 640px
    section-label: '{typography.label}'
    row-count: '{typography.mono-sm}'
    row-min-height: 44px
    row-button-height: 28px
    row-button-typography: '{typography.caption}'
    rename-background: '{colors.surface-2}'
  text-field:
    label: '{typography.label-sm}'
    label-foreground: '{colors.muted}'
    background: '{colors.surface-2}'
    border: '{colors.line-strong}'
    border-focus: '{colors.accent}'
    border-error: '{colors.danger}'
    error-text: '{typography.caption}'
    error-foreground: '{colors.danger}'
    height: 36px
    radius: '{rounded.lg}'
    typography: '{typography.body}'
  select:
    background: '{colors.surface-2}'
    border: '{colors.line-strong}'
    border-focus: '{colors.accent}'
    icon: chevron-down
    height: 36px
    radius: '{rounded.lg}'
    typography: '{typography.body}'
  category-picker:
    gap: '{spacing.2}'
    max-selected: '2'
  list-editor:
    row-gap: '{spacing.2}'
    number: '{typography.mono-sm}'
    number-foreground: '{colors.muted}'
    remove-icon: x
    add-icon: plus
  kbd:
    background: '{colors.surface}'
    border: '{colors.line-strong}'
    border-bottom-width: 2px
    foreground: '{colors.ink-2}'
    radius: '{rounded.sm}'
    typography: '{typography.kbd}'
  focus-ring:
    outline: '2px solid {colors.accent}'
    offset: 2px
  tooltip:
    implementation: native-title
  empty-state:
    title: '{typography.headline}'
    body: '{typography.body}'
    body-foreground: '{colors.ink-2}'
    command: '{typography.mono}'
    command-highlight: '{colors.accent}'
    target-line: '{colors.line-strong}'
    target-cross: '{colors.accent}'
    target-center: '{colors.signal}'
  app-error:
    title: '{typography.headline}'
    body: '{typography.body}'
    code: '{typography.mono}'
    command: '{typography.mono}'
    command-highlight: '{colors.accent}'
---

## Brand & Style

**WhenKit** e o planșetă de desen caldă. Omagiul vine de la programele de proiectare (AutoCAD): grilă milimetrică, straturi colorate, colțuri de decupare pe selecție, bloc de titlu pe fișă, bară de stare cu taste. Prietenia vine de la un catalog de fișe pe hârtie: carduri rotunjite cu tab colorat, categorii-pastilă, spațiu de respirat. Rezultatul e **jucăuș și premium**: **arată** dens și capabil ca o unealtă de lucru, dar se folosește simplu. Densitatea e o impresie vizuală (linii fine, cifre monospațiate, multe repere mici), nu complexitate de interacțiune. Fereastra stă deschisă tot timpul, des pe jumătate de ecran lângă terminal, deci arată bine la orice lățime.

| Element | Regulă |
|---|---|
| Numele afișat | **WhenKit** (titlul ferestrei, bara de titlu, marca, installer-ul). |
| Identificatori tehnici | **whenkit**, cu litere mici (CLI, pachet npm, fișiere). În interfață apar doar în comenzi citate (`whenkit init`). |
| Marca | `app-mark`: pătrat {colors.accent} cu „W” în {colors.accent-ink} și un punct {colors.signal} în colțul din dreapta jos. |

Referința vizuală sunt patru machete ale ecranelor-cheie, fiecare în zi și noapte (comutatorul din pagină):

| Machetă | Ce arată |
|---|---|
| [mockups/key-toolbox.html](mockups/key-toolbox.html) | lista Toolbox → Imagini & video în repaus, cu un card selectat din tastatură, la 1280 px și la 720 px |
| [mockups/key-fisa.html](mockups/key-fisa.html) | fișa remove.bg în citire și în editare, cu `conflict-banner` |
| [mockups/key-learn-import.html](mockups/key-learn-import.html) | Learn → Backend & API-uri când aterizează un import: banda de sosire, ștampilele, toast-urile pe zone |
| [mockups/key-dialogs.html](mockups/key-dialogs.html) | `category-manager` (redenumire pe loc), confirmările „Unifică…” și „Șterge” cu țintă, confirmarea ștergerii unei fișe |

**Spine-urile câștigă la conflict cu machetele.** Explorarea direcțiilor (Planșetă, Fișier, hibrizii, dozele de planșă) a rămas în `.working/`, doar ca istoric.

## Colors

Două teme, comutate de utilizator: **ziua** pe hârtie ivoire caldă, **noaptea** pe un navy de planșă desaturat, cu text crem. O singură culoare de acțiune ({colors.accent}) și una de semnalizare ({colors.signal}); restul e hârtie, cerneală și linii.

**Regula temei.** Fiecare token de culoare și de umbră are o pereche de noapte cu sufixul `-dark` (ex. {colors.surface} → {colors.surface-dark}, {elevation.1} → {elevation.1-dark}). Componentele referă doar numele de zi; noaptea, fiecare se înlocuiește cu perechea lui. O cheie `*-dark` într-o componentă (ex. `theme-switch.icon-active-dark`) apare doar unde noaptea folosește **alt rol**, nu doar altă nuanță.

| Rol | Folosit pentru | Nu se folosește pentru |
|---|---|---|
| {colors.canvas} | zona de lucru, sub grilă | carduri |
| {colors.surface} | carduri, fișă, bare, dialoguri | fundalul zonei de lucru |
| {colors.surface-2} | inset: situații, căutare, etichete, câmpuri | suprafețe principale |
| {colors.chrome} | bara de titlu, bara de stare | conținut |
| {colors.line} / {colors.line-strong} | borduri; cea tare la butoane, câmpuri, blocul de titlu, `kbd` | separatoare groase |
| {colors.grid} / {colors.grid-major} | grila milimetrică | orice altceva |
| {colors.ink} | text principal, titluri | |
| {colors.ink-2} | „ce face”, text secundar, numerele situațiilor | |
| {colors.muted} | etichete, metadate, bara de stare, placeholder | text care trebuie citit în întregime |
| {colors.accent} | selecție, focus, linkuri, `button-primary`, „Deschide în browser”, ștampila Material, pulsul de actualizare | decor, categorii |
| {colors.accent-bg} | fond de selecție, contorul tabului activ | |
| {colors.signal} / {colors.signal-bg} | ștampila Concept, „Notițele mele”, nota de verificare, `conflict-banner` | erori |
| {colors.tape} / {colors.tape-ink} | **doar sosirea**: banda „ADĂUGAT”, inelul fișei noi, dunga toast-ului de sosire | orice altă stare, inclusiv actualizarea |
| {colors.ok} | punctul din bara de stare, bifa „Verificată” | |
| {colors.danger} | „Șterge”, erori de salvare, câmp respins | avertizări |
| {colors.scrim} | fundalul dialogurilor modale | |

**Culorile categoriilor.** Nouă sloturi, {colors.category-1} … {colors.category-9}, aceleași în ambele teme (slotul 9 are pereche de noapte). Slotul se dă **pe zonă**: categoriile zonei, sortate după `id` (UUID, ca text), primesc sloturile 1, 2, … 9 în această ordine, apoi de la capăt (a zecea primește slotul 1). Regula stă într-un singur loc din renderer și nu cere schemă nouă (`categories` nu are culoare, AD-5). Până la nouă categorii pe zonă nu se repetă nicio culoare. Redenumirea păstrează culoarea (`id`-ul nu se schimbă). Ștergerea sau unificarea unei categorii poate muta culoarea categoriilor de după ea în ordinea `id`-urilor; e rar și acceptat, pentru că numele categoriei e mereu scris lângă culoare.

**Cum ajunge culoarea în CSS.** Elementul care poartă o categorie (card, pastilă, fișă, rând) primește variabila `--category` cu valoarea slotului. Orice diluare se scrie `color-mix(in srgb, A p%, B)`, cu valorile din tokenii componentelor (ex. `category-chip-active.background`). Culoarea categoriei apare doar pe puncte, taburi, marcaje și fonduri diluate, **niciodată ca text**.

**Ținte de contrast (WCAG AA, ≥ 4,5 : 1 pentru text).**

| Combinație | Zi | Noapte |
|---|---|---|
| {colors.ink} pe {colors.surface} | 16,9 | 13,7 |
| {colors.ink-2} pe {colors.surface} / pe {colors.surface-2} | 9,8 / 8,8 | 8,6 / 7,9 |
| {colors.muted} pe {colors.surface} / {colors.canvas} / {colors.chrome} | 5,8 / 5,4 / 5,0 | 5,3 / 5,8 / 6,1 |
| {colors.muted} pe {colors.surface-2} (placeholder-ul căutării) | 5,3 | 4,9 |
| {colors.accent} pe {colors.surface} | 6,4 | 7,5 |
| {colors.accent} pe {colors.accent-bg} (contorul tabului activ) | 5,6 | 6,1 |
| {colors.accent-ink} pe {colors.accent} | 6,5 | 8,6 |
| {colors.ink-2} pe {colors.accent-bg} | 8,6 | 6,9 |
| {colors.signal} pe {colors.surface} / pe {colors.signal-bg} | 5,5 / 4,9 | 8,6 / 7,5 |
| {colors.tape-ink} pe {colors.tape} | 9,1 | 9,1 |
| {colors.danger} pe {colors.surface} | 6,4 | 7,2 |
| {colors.ok} pe {colors.surface} | 5,0 | 9,0 |

Culorile de categorie, ca elemente non-text, țintesc ≥ 3 : 1 față de {colors.surface}; violetul ({colors.category-4}) are 2,9 : 1 noaptea, acceptat pentru că numele categoriei e mereu scris lângă.

## Typography

Toate fonturile sunt pe Windows 11, în afară de Cascadia Mono, care se **include în pachet** (vine doar cu Windows Terminal), ca cifrele să arate la fel peste tot. Mărimile și greutățile stau doar în tokenii `typography`. Pașii de 0,5 px dintre unele roluri (ex. {typography.body} și {typography.body-sm}) sunt intenționați: vin din direcția aleasă și echilibrează Bahnschrift cu Segoe.

| Familie (cu rezervă) | Roluri |
|---|---|
| Bahnschrift → Segoe UI Variable Display → Segoe UI | {typography.display} titlul fișei · {typography.headline} titlul secțiunii, al dialogului, h2 în Markdown · {typography.card-title} · {typography.tab} · {typography.title-sm} resurse înrudite, „Deschide în browser”, h3 · {typography.app-title} · {typography.label} / {typography.label-sm} etichete de secțiune · {typography.stamp} · {typography.tape} |
| Segoe UI Variable Text → Segoe UI → system-ui | {typography.body} · {typography.body-lead} „ce face” în fișă · {typography.body-sm} „ce face” pe card · {typography.button} butoane, pastile · {typography.situation} · {typography.caption} bara de stare, subsolul cardului, cuvinte-cheie, mesaje sub câmp |
| Cascadia Mono → Cascadia Code → Consolas | {typography.mono} gazda, eticheta de cotă, cod · {typography.mono-sm} contoare, stele, id, blocul de titlu · {typography.kbd} |

Reguli: ștampila și banda sunt cu majuscule (`text-transform: uppercase`), restul nu. Numele resursei rămâne original („remove.bg” cu literă mică). Formatele de numere, date și plural sunt în EXPERIENCE.md, „Voice and Tone”. Fără serif, fără scris de mână.

## Layout & Spacing

Scara de bază e de 4 px: {spacing.1} … {spacing.8}. Ritmul ferestrei îl dau barele fixe, de sus în jos:

| Bară | Înălțime | Conține |
|---|---|---|
| Bara de titlu | {spacing.titlebar-height} | marca și „WhenKit”, comutatorul de temă, butoanele native ale ferestrei |
| Bara de unelte | {spacing.toolbar-height} | taburile Toolbox / Learn, căutarea, „Categorii”, „Exportă catalogul” |
| Bara de categorii (în listă) sau bara fișei (în fișă) | {spacing.category-bar-height} / {spacing.sheet-bar-height} | pastilele categoriilor / „Înapoi”, firimiturile, „Editează”, „Șterge” |
| Zona de lucru | restul | titlul secțiunii + grila de carduri, sau fișa |
| Bara de stare | {spacing.status-bar-height} | starea catalogului, contoare, calea workspace-ului, taste |

- Marginile laterale: barele {spacing.bar-x}, zona de lucru {spacing.work-x}.
- Grila de carduri: `repeat(auto-fill, minmax({spacing.card-min-width}, 1fr))`, spațiere {spacing.card-gap-x} pe orizontală și {spacing.card-gap-y} pe verticală (loc pentru tabul categoriei). Numărul de coloane rezultă din `auto-fill`: la 720 px rămân 656 px utili (720 − 2 × {spacing.work-x}), destul pentru 2 coloane (2 × {spacing.card-min-width} + {spacing.card-gap-x} = 624 px, cu loc și pentru bara de derulare); la 1280 px sunt 3. Comportamentul pe lățimi e în EXPERIENCE.md, „Responsive & Platform”; ambele lățimi în [mockups/key-toolbox.html](mockups/key-toolbox.html).
- Fișa: conținut + panou lateral de {spacing.sheet-side-width}; sub {spacing.bp-wide} panoul are {spacing.sheet-side-width-narrow}, iar sub {spacing.bp-half} coboară sub conținut.
- **Grila milimetrică** (`work-area`): pătrățele de {spacing.grid-minor} în {colors.grid} și linii mari la {spacing.grid-major} în {colors.grid-major}, pe toată zona de lucru, fixe față de zonă (nu derulează cu conținutul). O mască radială o estompează spre centru (`work-area.grid-center-opacity`) și o lasă plină spre margini, ca să nu concureze cu cardurile. Nu apare pe bare, carduri sau dialoguri.

## Elevation & Depth

Adâncimea e de hârtie pe planșetă: umbre calde și difuze ziua, negre și scurte noaptea (perechile `-dark`). Ierarhia vine din bare, tonuri și tipografie, nu din umbre adânci.

| Nivel | Token | Unde |
|---|---|---|
| 0 · planșa | fără umbră | {colors.canvas} cu grilă |
| 1 · foaie | {elevation.1} | card, fișă |
| 2 · ridicată | {elevation.2} | card sub mouse sau selectat, toast |
| 3 · deasupra | {elevation.2} + `dialog.scrim` | dialog modal |
| Speciale | {elevation.tape} / {elevation.accent} | banda de sosire / „Deschide în browser” (umbră din accent) |

## Shapes

Rotunjirea vine de la Fișier (prietenie), liniile fine de la Planșetă (precizie): colțuri prietenoase peste linii de 1 px. Cu cât suprafața e mai mare, cu atât raza crește: {rounded.sm} la elemente mici (`kbd`, ștampilă, marcă), {rounded.md} la situațiile de pe card, {rounded.lg} la butoane, câmpuri și rânduri, {rounded.xl} la căutare, notițe, toast, {rounded.card} la card, {rounded.sheet} la fișă și dialog. {rounded.full} la tot ce e pastilă. Excepție: {rounded.tab} doar pe colțurile de sus ale tabului de categorie. Fiecare componentă își numește raza în tokeni.

Semne de planșă care rămân, fiecare cu valorile în componenta ei: colțurile de decupare (`entry-card-selected`), linia de cotă (`section-header`), tabul de categorie (`category-tab`), ștampila rotită (`kind-stamp`), banda rotită cu margini neregulate (`arrival-tape`).

## Components

Ancore de compoziție: machetele din `mockups/`, legate mai jos la fiecare componentă. Valorile stau în tokenii componentei cu același nume; aici e doar anatomia. Comportamentul e în EXPERIENCE.md, „Component Patterns”.

### Iconițe

Un singur set pentru toată interfața: **Lucide** (`lucide-react`, licență ISC), **inclus în pachet** prin import per iconiță; nimic nu se încarcă din rețea (CSP, AD-9). Mărimea și grosimea sunt în `icon`; culoarea e a textului de lângă (`currentColor`). Glifele din text se desenează tot cu Lucide, nu cu caractere: ★ `star`, ↗ `external-link`, → `arrow-right`, ⚑ `flag`, ✓ `check`, ↵ `corner-down-left`.

| Unde | Iconiță |
|---|---|
| căutare · temă | `search` · `sun`, `moon` |
| „Categorii” · „Exportă catalogul” | `layers` · `upload` |
| „Înapoi” și derularea barei de categorii spre stânga · spre dreapta | `chevron-left` · `chevron-right` |
| „Editează”, antetul „Notițele mele” · „Șterge” | `pencil` · `trash-2` |
| `select` · `list-editor` · închiderea toast-ului | `chevron-down` · `plus`, `x` · `x` |
| `conflict-banner` · starea „în lucru” | `triangle-alert` · `loader-circle` |

Butoanele native ale ferestrei (minimizare, maximizare, închidere) rămân ale Windows.

### Butoane și stări interactive

| Variantă | Unde | Aspect |
|---|---|---|
| `button` | `sheet-bar`, dialoguri | fond și contur din tokeni |
| `button-primary` | „Salvează” în editare | plin {colors.accent} |
| `button-ghost` | „Înapoi”, „Renunță”, acțiunile din rândurile `category-manager` (mici: `row-button-*`), „Adaugă …” și × din `list-editor` | fond {colors.surface-2}, fără contur |
| `button-danger` | „Șterge” în fișă | doar text {colors.danger} |
| `button-danger-solid` | butonul care execută, în confirmări, inclusiv „Unifică” (șterge categoria-sursă) | plin {colors.danger} |
| `toolbar-button` / `toolbar-button-primary` | „Categorii” / „Exportă catalogul” | ca `button-ghost` fără fond / ca `button`, la înălțimea din tokeni |

Toate: iconiță opțională la stânga, {typography.button}, `kbd` după text când există scurtătură. Varianta doar cu iconiță (bara de unelte îngustă, × din `list-editor` și toast) e pătrată, cu `tooltip`.

Stările, comune butoanelor, `category-chip`, `zone-tab`, `related-link` și `entry-card`:

| Stare | Aspect |
|---|---|
| hover | strat {components.interactive.hover-overlay} peste fond, în {motion.quick}. În plus: `category-chip` și `related-link` primesc conturul `border-hover`, iar săgeata `related-link` se mută cu `arrow-shift-hover`; `zone-tab` inactiv trece la `foreground-hover`; cardul folosește `entry-card-hover`. |
| apăsat | strat {components.interactive.pressed-overlay}, coborât cu {components.interactive.pressed-offset} |
| focus | `focus-ring`, doar la focus din tastatură |
| inactiv | opacitate {components.interactive.disabled-opacity}, fără hover, cursor normal |
| în lucru | ca inactiv, dar la opacitate plină; iconița devine `loader-circle`, care se rotește, iar textul spune acțiunea („Se exportă…”, „Se verifică linkul…”) |
| activ / selectat | `category-chip-active`, `zone-tab` activ, `entry-card-selected` |

### entry-card

Machete: [mockups/key-toolbox.html](mockups/key-toolbox.html) (Toolbox, `entry-card-selected`), [mockups/key-learn-import.html](mockups/key-learn-import.html) (`entry-card-learn`, `entry-card-new`, `kind-stamp`, `arrival-tape`). De sus în jos:

1. `category-tab` ieșit deasupra marginii de sus, la una dintre `category-tab.positions`, alternând pe carduri vecine (ca filele unui fișier).
2. Rândul de metadate (`meta`): gazda + pastila tipului („site” / „repo” / „aplicație”, contur `type-pill-border`, {rounded.full}); la o colecție „colecție · N concepte”. La un concept care nu e colecție (fără link, fără concepte legate sub el) rândul rămâne gol, dar își păstrează înălțimea. În Learn, `kind-stamp` în colțul din dreapta sus.
3. Titlul (`title`).
4. „Ce face” (`body`), tăiat la `body-lines` rânduri.
5. Situațiile: în Toolbox eticheta „Când o folosesc” (`situations-label`) + primele 2 `situation-item`; în Learn prima situație, fără etichetă.
6. Subsolul, în ambele zone, despărțit de `footer-border`. Stânga: punctul și numele categoriei (+1 dacă are două). Dreapta, în ordinea priorității când nu e loc: `verification-flag`, ★ stele · ultimul commit (doar la repo GitHub; singurul loc de pe card unde apar), „+N situații”.

| Variantă | Diferența |
|---|---|
| `entry-card-learn` | înălțime minimă din token; restul identic |
| `entry-card-hover` | contur, umbră de nivel 2, ridicare |
| `entry-card-selected` | contur și inel {colors.accent}, umbră de nivel 2, **colțuri de decupare** sus-stânga și jos-dreapta. La selecția din tastatură, o pastilă „Enter ↵ fișa” (`keyboard-hint-*`) pe marginea de sus, în dreapta. |
| `entry-card-new` | inel dublu din {colors.tape}, fără contur, plus `arrival-tape` |
| `entry-card-skeleton` | forma cardului, cu bare `bar` în locul textului; fără animație |

### entry-sheet

Machetă: [mockups/key-fisa.html](mockups/key-fisa.html), în citire și în editare. Foaie cu `category-tab` mărit (`tab-width` × `tab-height`, la `tab-left`). **Coloana principală**, de sus în jos:

1. Antetul: pătrățelul (`mark-*`) cu inițiala primei categorii; titlul (`title`); dedesubt (`subline`) linkul în {colors.accent} cu ↗ · tipul · punctul și numele categoriei.
2. „Ce face” (`lead`).
3. Secțiuni, fiecare cu etichetă (`section-label`) urmată de o linie fină (`section-rule`): „Când o folosesc · N” / „Când îl aleg · N” (`situation-callout` pe 2 coloane); la concepte, conținutul (`markdown-content`) și „Surse”; „Cuvinte-cheie” (`keyword-tag`); `my-notes`.

**Panoul lateral** (`side-*`), de sus în jos: `open-in-browser`; „Resurse înrudite · N” (`related-link`), la o colecție „Concepte · N”, la un concept dintr-o colecție „Face parte din”; nota de verificare, dacă există; `title-block` jos.

**În editare:** `conflict-banner` sub `sheet-bar`, când e cazul; câmpurile scrise de Claude devin `text-field`, `select`, `category-picker` și `list-editor`, pe aceleași poziții; `my-notes` și panoul lateral rămân la fel.

- Antetul: lângă pătrățel, „Nume” pe toată lățimea, dedesubt „Link” și „Tip” (`select`, lățimea `edit-type-width`) pe un rând. Aceste trei câmpuri au eticheta deasupra (`text-field.label`, `label-foreground`).
- Sub antet, secțiuni cu `section-label`, ca în citire: „Categorii” (`category-picker`), „Ce face” (`text-field` pe mai multe rânduri), „Când o folosesc · N” / „Când îl aleg · N”, „Cuvinte-cheie” și, la concepte, „Conținut” și „Surse”.
- Fiecare `list-editor` e o singură coloană, rând sub rând, inclusiv cuvintele-cheie.

### Restul componentelor

| Componentă | Anatomie și aspect |
|---|---|
| **work-area** | {colors.canvas} cu grila milimetrică (Layout & Spacing). |
| **title-bar** | Stânga: `app-mark` + „WhenKit”, mereu, și în fișă (numele fișei e doar în titlul ferestrei din Windows, vezi EXPERIENCE.md, `title-bar`). Dreapta: `theme-switch`, apoi butoanele native ale ferestrei, colorate pe {colors.chrome} (bară de titlu proprie peste butoanele native). La orice zoom între 80 și 200% conținutul încape în bară și rămâne centrat vertical pe butoanele native. |
| **theme-switch** | Pastilă cu două locuri (`sun`, `moon`) și un buton glisant. Ziua: butonul pe soare, soarele în `icon-active`. Noaptea: butonul pe lună (`knob-dark`, contur `knob-border-dark`), luna în `icon-active-dark`. |
| **toolbar** | Ordine: `zone-tab` × 2, `search-box` (flexibil, până la `max-width`), spațiu, `toolbar-button` „Categorii”, `toolbar-button-primary` „Exportă catalogul”. |
| **zone-tab** | „Toolbox” / „Learn” + contor-pastilă. Activ: text `foreground-active`, bară `indicator` pe marginea de jos, contor pe `count-background-active`. |
| **search-box** | `search`, placeholder, `kbd` „Ctrl K” în dreapta. Focus: contur `border-focus` + `focus-ring`. |
| **category-bar** | Eticheta „Categorii” cu `layers`, separator vertical, apoi `category-chip`-uri pe un rând, care derulează sub etichetă. La debordare: estompare spre dreapta (`fade-width`) și un buton rotund `chevron-right` (`scroll-button-size`). Când rândul nu mai e la început, la fel spre stânga: estompare lipită de separator și un buton rotund `chevron-left`. |
| **category-chip** | Punct `dot-size` în `--category`, nume, contor. „Toate” are punctul `dot-all`. Activă: `category-chip-active` (fond și contur diluate, text {colors.ink} semibold, halou în jurul punctului). |
| **section-header** | Tab colorat mic + numele vederii („Toate”, categoria sau „Rezultate pentru «…»”), apoi o **linie de cotă** cu capete oblice și eticheta centrată („6 fișe”, „8 fișe · 1 nouă”). |
| **kind-stamp** | Ștampilă de cauciuc „CONCEPT” (`concept`) sau „MATERIAL” (`material`): contur dublu, rotită, mască de cerneală neuniformă, `blend` ziua, `blend-dark` noaptea. |
| **arrival-tape** | „ADĂUGAT · ACUM 3 S”: bandă rotită, ieșită deasupra cardului, cu margini tăiate neregulat (`clip-path`) și umbră proprie. |
| **situation-item** | Fond inset, marcaj vertical în `--category` pe stânga. |
| **verification-flag** | `flag` + „notă de verificare”. |
| **sheet-bar** | `button-ghost` „Înapoi” + `kbd` „Esc”; firimituri „Toolbox / Imagini & video / **remove.bg**” (`crumb`, ultimul `crumb-current`); dreapta: `button` „Editează” + `kbd` „E”, `button-danger` „Șterge”. În editare „Înapoi” dispare (Esc înseamnă „Renunță”), firimiturile rămân, iar în dreapta: `button-ghost` „Renunță” + `kbd` „Esc”, `button-primary` „Salvează” + `kbd` „Ctrl S”. |
| **conflict-banner** | Bandă pe toată lățimea fișei, sub `sheet-bar`: contur stâng gros `border`, `triangle-alert`, textul, iar în dreapta `button` „Reîncarcă fișa”. |
| **situation-callout** | Rând cu contur; număr „01”… într-un cerc `number-size` pe fond diluat din `--category`. |
| **keyword-tag** | Pastilă inset, text mic. |
| **my-notes** | Cutie cu contur punctat. Antet: `pencil` + „Notițele mele” (`heading`), iar în dreapta, în `hint`, „se salvează singure · doar tu scrii aici”, înlocuit pe rând de starea salvării (eroarea în `error`). Cursor `caret`. |
| **open-in-browser** | Bloc plin {colors.accent}: „Deschide în browser”, URL-ul dedesubt (`url-*`), `external-link` în dreapta, umbra {elevation.accent}. |
| **related-link** | Rând cu contur: punctul categoriei, numele, o linie de context („ce face”, tăiat la un rând), `arrow-right` în `arrow`. |
| **title-block** | Blocul de titlu „îmblânzit”: grilă de 2 coloane. Rândul de sus, pe `header-background`: „FIȘĂ · UNEALTĂ / MATERIAL / CONCEPT” + „rev. N”. Rubrici cu etichetă `label`: Zonă, Tip, Adăugată, Verificată (+ `check`), Id (scurt, `7f3c…e21a`); la repo, Stele și Ultimul commit. |
| **markdown-content** | Titluri `h2` / `h3`; tabele cu antet și borduri din tokeni; cod pe `code-background`; linkuri {colors.accent} cu ↗. Fără imagini externe (AD-9). |
| **status-bar** | Stânga: punct `dot` + „Catalog la zi”; contoare (`counters`); calea workspace-ului. Dreapta: indicii de taste cu `kbd` mici, fără fond. |
| **toast** | Card plutitor în colțul din dreapta jos, stivuit cu `stack-gap`. Sosire: dungă `stripe-new` pe stânga și, pe primul rând, în stânga, o bandă-miniatură „ADĂUGAT”; dedesubt textul și, în dreapta lui, acțiunea ca link `action`; × pentru închidere în colțul din dreapta sus. Eroare: dungă `stripe-error`, fără bandă. Machetă: [mockups/key-learn-import.html](mockups/key-learn-import.html). |
| **dialog** | Foaie peste `scrim`, titlu, text, butoane la dreapta jos. `scrim` acoperă tot sub `title-bar`; bara de titlu rămâne vie (tragere, butoanele native). Confirmările au lățimea `confirm-width`; titlul e întrebarea sau acțiunea („Ștergi fișa „remove.bg”?”, „Unifică „Descoperire & arhive””), textul e consecința. Confirmările distructive: `button-danger-solid` + `button` „Renunță” + `kbd` „Esc”. Machetă: [mockups/key-dialogs.html](mockups/key-dialogs.html), ecranele 02–04. |
| **category-manager** | Dialog lat (`width`): titlul „Categorii”, textul „Categoriile noi apar doar din import.”, două secțiuni (Toolbox, Learn) cu antet `section-label`, derulate în interiorul dialogului, și jos `button` „Închide” + `kbd` „Esc”. Fiecare rând (`row-min-height`): punctul categoriei, numele, contorul, acțiunile ca `button-ghost` mici (`row-button-height`, `row-button-typography`): „Redenumește”, „Unifică…”, „Șterge” în {colors.danger}. Rândul în redenumire: fond `rename-background` cu contur {colors.line}, `text-field` în locul numelui, contorul și acțiunile ascunse, în dreapta `kbd` „Enter” salvează · `kbd` „Esc” renunță. Machetă: [mockups/key-dialogs.html](mockups/key-dialogs.html), ecranul 01. |
| **text-field** | Câmp inset, o linie (`height`) sau înălțime liberă pentru text lung; eticheta, când are, deasupra (`label`, `label-foreground`). Focus: `border-focus` + `focus-ring`. Respins sau invalid: `border-error`, mesajul dedesubt (`error-text`, `error-foreground`). |
| **select** | Arată ca `text-field`, cu `chevron-down` în dreapta; lista deschisă e cea nativă. |
| **category-picker** | Rând de `category-chip`-uri ale zonei, cu rupere pe mai multe rânduri (doar aici); alese = `category-chip-active`; peste `max-selected`, celelalte sunt inactive. |
| **list-editor** | O singură coloană de rânduri `text-field`, fiecare cu număr (`number`, la situații) și un buton doar cu iconița `x`; sub listă, `button-ghost` „Adaugă …” cu `plus`. |
| **kbd** | Tastă mică, cu marginea de jos mai groasă. |
| **focus-ring** | Contur în jurul oricărui element interactiv, la `offset` distanță. |
| **tooltip** | Nativ (atributul `title`), fără componentă proprie. |
| **empty-state** | Centrat în zona de lucru: o țintă desenată cu linii fine (cercuri punctate `target-line`, cruce `target-cross`, centru `target-center`), titlu, text, comanda sugerată cu `/gaseste` evidențiat. |
| **app-error** | Ca `empty-state`, fără țintă: titlu, textul erorii, comanda de rulat evidențiată, codul erorii ca detaliu. |

## Do's and Don'ts

| Do | Don't |
|---|---|
| Grila milimetrică discretă pe toată zona de lucru | Rigle, cote pe selecție, cartuș tehnic, cianotipie |
| Ștampilă doar pe cardurile Learn; banda și {colors.tape} doar pe fișe proaspăt adăugate | Ștampile sau benzi ca decor; {colors.tape} pentru altă stare |
| Culoarea categoriei doar pe puncte, taburi, marcaje și fonduri diluate | Text colorat cu culoarea categoriei |
| Un singur accent ({colors.accent}) pentru selecție, focus, linkuri și acțiunea principală | Al doilea accent, gradiente decorative |
| {colors.signal} pentru Concept, notițe, nota de verificare și conflict | {colors.signal} pentru erori; roșu pentru avertizări |
| „WhenKit” în interfață, „whenkit” doar în comenzi citate | „whenkit” ca nume de produs în titlu sau marcă |
| Cascadia Mono și Lucide incluse în pachet | Fonturi sau iconițe din rețea, serif, scris de mână |
| Rotunjiri prietenoase peste linii fine | Colțuri drepte peste tot sau totul pastilă |
| Densitate vizuală: multe repere mici, monospațiate | Densitate de interacțiune: meniuri adânci, panouri multe |
| Contrast AA în ambele teme, verificat pe orice combinație nouă | Text {colors.muted} pe {colors.accent-bg} sau pe culori de categorie |
