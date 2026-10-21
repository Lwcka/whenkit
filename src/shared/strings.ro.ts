// All Romanian user-facing text lives here (AD-13). Code elsewhere refers to
// these entries and never embeds Romanian strings directly.

import type { EntryKind, ResourceType, Zone } from '../core/entry';
import type { ErrorCode } from '../core/errors';
import type { ImportOutcome } from '../core/import-report-schema';
import type { ReasonCode } from '../core/verification/reason-codes';

export const cliStrings = {
  usage: [
    'Utilizare: whenkit <comandă> [opțiuni]',
    '',
    'Comenzi:',
    '  init [cale]                     creează workspace-ul (sau îl verifică, dacă există) și',
    '                                  salvează calea; fără cale, folosește workspace-ul configurat',
    '  import <lot> [--json]           importă în catalog fișele dintr-un lot JSON;',
    '         [--force <ref>]…         --force <ref> (repetabil) scrie totuși elementul respins doar',
    '                                  de verificare și îl marchează „forțat”',
    '  list [--json]                   afișează toate fișele (fără conținutul conceptelor)',
    '  show <id> [--json]              afișează o fișă completă',
    '  rejections [--json]             afișează jurnalul respinselor (elementele din lot, cu motive)',
    '  rejections --remove <id> [--json]',
    '                                  șterge din jurnal rândul cu acel id (id-ul din „rejections --json”)',
    '  categories [--json]             afișează categoriile, pe zone (Toolbox, apoi Learn)',
    '  schema                          afișează JSON Schema a lotului de import',
    '',
    'Opțiuni:',
    '  --json                          scrie pe stdout un singur document JSON (și la eroare)',
    '  --version, -v                   afișează versiunea',
    '  --help, -h                      afișează acest ajutor',
  ].join('\n'),
  unknownCommand: (name: string) =>
    `Comandă necunoscută: „${name}”. Rulează „whenkit --help” pentru lista comenzilor.`,
  unknownOption: (command: string, option: string) =>
    `Opțiune necunoscută pentru „${command}”: „${option}”. Rulează „whenkit --help”.`,
  tooManyArguments: (command: string) =>
    `Prea multe argumente pentru „${command}”. Rulează „whenkit --help”.`,
  missingArgument: (command: string, argument: string) =>
    `Lipsește argumentul <${argument}> pentru „${command}”. Rulează „whenkit --help”.`,
  missingOptionValue: (command: string, option: string, value: string) =>
    `Opțiunea „${option}” cere o valoare (<${value}>) pentru „${command}”. Rulează „whenkit --help”.`,
  initDone: (workspace: string) => `Workspace-ul e gata: ${workspace}`,
  templateOutdated:
    'Atenție: fișierele workspace-ului (CLAUDE.md, skill-uri, schema lotului) sunt mai vechi decât aplicația. Rulează „whenkit init” ca să le actualizezi.',
  errorPrefix: 'Eroare',
  issueLine: (path: string, message: string) =>
    `  - ${path === '' ? '(lot)' : path}: ${message}`,
} as const;

export const errorMessages: Record<ErrorCode, string> = {
  WORKSPACE_NOT_CONFIGURED:
    'Workspace-ul nu e configurat. Rulează „whenkit init <cale>” sau setează variabila WHENKIT_WORKSPACE.',
  WORKSPACE_INSIDE_REPO:
    'Workspace-ul nu poate fi folderul aplicației și nici în interiorul lui. Alege o cale în afara repo-ului.',
  CONFIG_INVALID:
    'Calea workspace-ului sau configurarea lui e invalidă: %APPDATA%\\whenkit\\config.json nu poate fi citit sau nu e valid, ori calea (dată la „whenkit init”, din WHENKIT_WORKSPACE sau din config.json) nu e o cale Windows absolută (C:\\… sau \\\\server\\share) ori are un folder al cărui nume se termină cu punct sau spațiu. Rulează „whenkit init <cale>” cu o cale validă.',
  CATALOG_NOT_FOUND:
    'Workspace-ul nu are catalog (data\\catalog.sqlite). Rulează „whenkit init” ca să-l creezi.',
  ARGUMENTS_INVALID:
    'Argumentele comenzii sunt invalide. Rulează „whenkit --help”.',
  BATCH_INVALID:
    'Lotul nu poate fi citit sau nu respectă schema. Nu s-a scris nimic; corectează problemele de mai jos și reia importul.',
  BATCH_SCHEMA_OUTDATED:
    'Lotul folosește o versiune a schemei diferită de cea a aplicației. Nu s-a scris nimic. Rulează „whenkit init” ca să actualizezi workspace-ul, apoi refă lotul.',
  ENTRY_NOT_FOUND: 'Nu există nicio fișă cu acest id.',
  ENTRY_REJECTED: 'Modificarea nu a trecut verificarea.',
  CONFLICT:
    'Fișa s-a schimbat din terminal între timp. Modificarea nu s-a salvat.',
  CATEGORY_NOT_FOUND:
    'Categoria nu mai există. Poate a fost unificată sau ștearsă între timp.',
  CATEGORY_NAME_TAKEN: 'Există deja o categorie cu acest nume în zonă.',
  CATEGORY_TARGET_REQUIRED:
    'Unele fișe au doar această categorie. Alege categoria în care le muți.',
  REJECTION_NOT_FOUND:
    'Nu există niciun rând în jurnalul de respinse cu acest id. Nu s-a șters nimic.',
  MIGRATION_MISMATCH:
    'O migrare aplicată bazei de date diferă de cea din cod. Catalogul nu a fost deschis și nu s-a scris nimic.',
  DATABASE_TOO_NEW:
    'Baza de date e mai nouă decât această versiune whenkit. Actualizează whenkit; catalogul nu a fost deschis.',
  DATABASE_NEEDS_MIGRATION:
    'Baza de date trebuie actualizată la versiunea acestui whenkit. Rulează „whenkit init”; comenzile de citire nu modifică baza.',
  DATABASE_BUSY:
    'Baza de date e blocată de alt proces. Încearcă din nou peste câteva secunde.',
  OFFLINE:
    'Nu există conexiune la internet, deci linkurile nu pot fi verificate. Importul s-a oprit: nu s-a scris și nu s-a respins nimic. Reia importul când revine conexiunea.',
  EXPORT_WRITE_FAILED: 'Nu am putut scrie în folderul ales.',
  INTERNAL: 'Eroare internă neprevăzută.',
};

export const kindLabels: Record<EntryKind, string> = {
  tool: 'unealtă',
  material: 'material',
  concept: 'concept',
};

export const zoneLabels: Record<Zone, string> = {
  toolbox: 'Toolbox',
  learn: 'Learn',
};

export const resourceTypeLabels: Record<ResourceType, string> = {
  repo: 'repo',
  site: 'site',
  app: 'aplicație',
};

export const outcomeLabels: Record<ImportOutcome, string> = {
  added: 'adăugată',
  updated: 'actualizată',
  warned: 'adăugată cu avertisment',
  rejected: 'respinsă',
  duplicate: 'duplicat',
};

type Params = Readonly<Record<string, string>>;

export const reasonTexts: Record<ReasonCode, (params: Params) => string> = {
  unknown_id: (p) => `în catalog nu există nicio fișă cu id-ul ${p.id ?? ''}`,
  unknown_category: (p) =>
    `categoria „${p.name ?? ''}” nu există în zona fișei și nu e declarată în newCategories`,
  flagged_by_claude: (p) => `semnalată de Claude: ${p.text ?? ''}`,
  duplicate: (p) =>
    p.ref === undefined
      ? `există deja: ${p.name ?? ''}`
      : `există deja: ${p.name ?? ''} (elementul „${p.ref}” din același lot)`,
  invalid_url: () =>
    'linkul nu e un URL http(s) valid (de exemplu, o greșeală de scriere)',
  http_error: (p) =>
    `linkul nu funcționează: site-ul răspunde cu eroarea HTTP ${p.status ?? ''}`,
  dns_not_found: () => 'domeniul linkului nu există',
  tls_error: () => 'certificatul SSL al site-ului e invalid',
  connection_error: () =>
    'conexiunea la site a fost refuzată sau întreruptă, ori redirecționarea e greșită',
  blocks_automation: () =>
    'site-ul blochează accesul automat; linkul nu a putut fi verificat complet',
  no_response_at_import: (p) =>
    p.url === undefined
      ? 'site-ul nu a răspuns la import (eroare de server sau timeout, după 3 încercări)'
      : `sursa ${p.url} nu a răspuns la import (eroare de server sau timeout, după 3 încercări)`,
  blocked_domain: (p) =>
    `domeniu interzis (regula „${p.domain ?? ''}” din data\\blocked-domains.txt)`,
  source_link_removed: (p) =>
    `sursa ${p.url ?? ''} nu funcționează și a fost scoasă din Surse`,
  source_blocked_domain: (p) =>
    `sursa ${p.url ?? ''} e pe un domeniu interzis (regula „${p.domain ?? ''}”)`,
  link_target_not_written: (p) =>
    `elementul „${p.ref ?? ''}” nu a fost scris în catalog (respins sau duplicat), deci legătura nu s-a creat`,
  parent_requires_concept: (p) =>
    `legătura părinte–copil cere concepte, iar fișa ${p.id ?? ''} nu e concept; legătura nu s-a creat sau a fost ștearsă`,
  parent_cycle: (p) =>
    `legătura ar crea un ciclu: fișa ${p.id ?? ''} e deja părinte (direct sau indirect) al umbrelei`,
  forced_by_user: () => 'verificare ocolită de utilizator',
  github_archived: () => 'repo arhivat pe GitHub',
  github_abandoned: (p) =>
    `repo abandonat pe GitHub: ultimul push pe ${p.pushedAt ?? ''}, acum mai mult de 24 de luni`,
};

export const importStrings = {
  header: (workspace: string) => `Import în ${workspace}`,
  item: (ref: string, outcome: string) => `  ${ref}: ${outcome}`,
  /** The line of an `op: update` item. */
  updateItem: (ref: string, outcome: string) =>
    `  ${ref} (actualizare): ${outcome}`,
  /** Outcome `warned` of an update; an add uses outcomeLabels.warned. */
  warnedUpdate: 'actualizată cu avertisment',
  /** A rejected or duplicate update wrote nothing. */
  entryUnchanged: '(fișa rămâne neschimbată)',
  entryId: (id: string) => `(id ${id})`,
  duplicateOf: (id: string) => `(fișa existentă ${id})`,
  reason: (text: string) => `    - ${text}`,
  ignoredLinksHeader: 'Legături ignorate:',
  ignoredLink: (fromRef: string, to: string, text: string) =>
    `  ${fromRef} → ${to}: ${text}`,
  newCategoriesHeader: 'Categorii declarate:',
  newCategory: (name: string, zone: string, created: boolean) =>
    `  ${name} (${zone}): ${created ? 'creată' : 'exista deja'}`,
  proposedBlockedDomains: (domains: string) =>
    `Domenii propuse pentru blocare (editează tu data\\blocked-domains.txt): ${domains}`,
  summary: (counts: Record<ImportOutcome, number>) =>
    `Rezumat: ${counts.added} adăugate, ${counts.updated} actualizate, ${counts.warned} cu avertisment, ${counts.rejected} respinse, ${counts.duplicate} duplicate.`,
} as const;

export const rejectionStrings = {
  emptyJournal: 'Jurnalul de respinse e gol.',
  removed: (name: string) => `Am șters din jurnalul de respinse: ${name}`,
  line: (name: string, reasons: string, date: string) =>
    `${name} — ${reasons} (${date})`,
} as const;

export const entryStrings = {
  emptyCatalog: 'Catalogul e gol.',
  name: 'Nume',
  listLine: (id: string, kind: string, name: string, categories: string) =>
    `${id}  [${kind}] ${name} — ${categories}`,
  kind: (kind: string, zone: string) => `Fel: ${kind} (${zone})`,
  url: 'Link',
  resourceType: 'Tip',
  categories: 'Categorii',
  whatItDoes: 'Ce face',
  situations: (kind: EntryKind) =>
    kind === 'concept' ? 'Când îl aleg' : 'Când o folosesc',
  keywords: 'Cuvinte-cheie',
  sources: 'Surse',
  content: 'Conținut',
  myNotes: 'Notițele mele',
  addedAt: 'Adăugată la',
  verifiedAt: 'Verificată la',
  notVerified: 'încă neverificată',
  verificationNotes: 'Note de verificare',
  relatedIds: 'Resurse înrudite (id)',
  parentIds: 'Umbrele (id)',
  childIds: 'Copii (id)',
  id: 'Id',
} as const;

/** Headings of the exported `.md` files (AD-12, AD-13); core receives them as labels. */
export const exportStrings = {
  /** Slug of an entry whose name has no letter or digit. */
  fallbackSlug: 'fisa',
  situations: entryStrings.situations,
  content: entryStrings.content,
  sources: entryStrings.sources,
  myNotes: entryStrings.myNotes,
  umbrellas: 'Umbrele',
  children: 'Concepte',
  related: 'Resurse înrudite',
} as const;

export const categoryStrings = {
  zoneHeader: (zone: string) => `${zone}:`,
  line: (name: string) => `  ${name}`,
} as const;

/** Titles of the startup errors the window shows (EXPERIENCE, „Erori de pornire”). */
const startupTitles: Partial<Record<ErrorCode, string>> = {
  WORKSPACE_NOT_CONFIGURED: 'Nu găsesc workspace-ul.',
  CONFIG_INVALID: 'Configurarea workspace-ului e invalidă.',
  CATALOG_NOT_FOUND: 'Workspace-ul nu are catalog.',
  DATABASE_NEEDS_MIGRATION: 'Catalogul trebuie actualizat.',
  DATABASE_TOO_NEW: 'Catalogul e mai nou decât WhenKit.',
  MIGRATION_MISMATCH: 'Catalogul nu se potrivește cu această versiune.',
};

/** The command that fixes a startup error, when there is one. */
const startupCommands: Partial<Record<ErrorCode, string>> = {
  WORKSPACE_NOT_CONFIGURED: 'whenkit init <cale>',
  CONFIG_INVALID: 'whenkit init <cale>',
  CATALOG_NOT_FOUND: 'whenkit init',
  DATABASE_NEEDS_MIGRATION: 'whenkit init',
};

const genericStartupTitle = 'WhenKit nu a putut porni.';

export type PluralForms = Readonly<{ one: string; few: string; other: string }>;

const pluralRules = new Intl.PluralRules('ro');

/**
 * "N word" with the right Romanian form (EXPERIENCE, "Voice and Tone"):
 * one "1 fișă"; few "0 fișe", "2 fișe" … "19 fișe", "101 fișe"; other
 * "20 de fișe", "100 de fișe". Other plurals (situations, children) reuse it.
 */
export function plural(n: number, forms: PluralForms): string {
  const category = pluralRules.select(n);
  const form =
    category === 'one'
      ? forms.one
      : category === 'few'
        ? forms.few
        : forms.other;
  return `${n} ${form}`;
}

export const entryCount = (n: number): string =>
  plural(n, { one: 'fișă', few: 'fișe', other: 'de fișe' });

/** „1 nouă”, „2 noi”, „20 de noi”: the count of fresh entries in a header. */
export const newCount = (n: number): string =>
  plural(n, { one: 'nouă', few: 'noi', other: 'de noi' });

/** Text with parts shown strong (a toast message, EXPERIENCE toast). */
export type RichText = readonly (string | { strong: string })[];

/**
 * „acum 3 s”, „acum 2 min”, „acum 1 h”: only the arrival tape shows relative
 * time (EXPERIENCE, Voice and Tone). A negative span counts as 0.
 */
export function relativeTime(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  if (seconds < 60) return `acum ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `acum ${minutes} min`;
  return `acum ${Math.floor(minutes / 60)} h`;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** The number of a list row, from its zero-based index: `01`, `02`, … */
export const rowNumber = (index: number): string => pad2(index + 1);

function asDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** `15.10.2026`, in local time. */
export function formatDate(value: Date | string): string {
  const date = asDate(value);
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** `15.10.2026, 20:39`, in local time. */
export function formatDateTime(value: Date | string): string {
  const date = asDate(value);
  return `${formatDate(date)}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** `999`, `1k`, `137,7k`: decimal comma, no trailing `,0`. */
export function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  const [divisor, suffix] = n >= 999_950 ? [1_000_000, 'M'] : [1000, 'k'];
  const rounded = (n / divisor)
    .toFixed(1)
    .replace(/\.0$/, '')
    .replace('.', ',');
  return `${rounded}${suffix}`;
}

/** The key that focuses the search box (also Ctrl F). */
const searchShortcut = 'Ctrl K';

export const appStrings = {
  productName: 'WhenKit',
  tablistLabel: 'Zone',
  themeSwitchLabel: 'Temă întunecată',
  themeSwitchTitle: 'Comută tema: zi / noapte',
  themeNotChanged: 'Nu am putut schimba tema.',
  statusLabel: 'Starea catalogului',
  statusUpToDate: 'Catalog la zi',
  statusSummary: (count: number, lastAddedAt: string | null): string =>
    lastAddedAt === null
      ? entryCount(count)
      : `${entryCount(count)} · ultima adăugată ${formatDateTime(lastAddedAt)}`,
  /** The key hints of the list view (EXPERIENCE, status-bar). */
  listKeyHints: [
    { keys: searchShortcut, action: 'caută' },
    { keys: 'Enter', action: 'deschide' },
  ],
  searchLabel: 'Caută în fișe',
  searchShortcut,
  /** The search box's placeholder per zone (EXPERIENCE, Voice and Tone). */
  searchPlaceholder: {
    toolbox: 'Ce vrei să faci? ex. „scot fundalul”',
    learn: 'Ce vrei să înțelegi? ex. „aleg un API”',
  } satisfies Record<Zone, string>,
  /** The results header: „Rezultate pentru „fundal””. */
  searchResultsTitle: (query: string): string => `Rezultate pentru „${query}”`,
  /** The link to the matches of the other zone: „+2 în Learn”. */
  searchOtherZone: (count: number, zone: string): string =>
    `+${count} în ${zone}`,
  searchNothing: (query: string, zone: string): string =>
    `Nimic pentru „${query}” în ${zone}.`,
  searchedEverything: 'Am căutat în tot textul fișelor.',
  searchAskClaude: 'Sau cere-i lui Claude, în terminal:',
  searchAskClaudeCommand: '/gaseste …',
  searchFailed: 'Căutarea nu a reușit.',
  loadingLabel: 'Se încarcă catalogul…',
  categoryBarLabel: 'Categorii',
  allCategories: 'Toate',
  scrollCategoriesBack: 'Categoriile anterioare',
  scrollCategoriesForward: 'Categoriile următoare',
  cardListLabel: 'Fișe',
  /** The meta row of a concept that has children. */
  umbrella: (children: number): string =>
    `umbrelă · ${plural(children, { one: 'copil', few: 'copii', other: 'de copii' })}`,
  verificationFlag: 'notă de verificare',
  /** The stars item of a repo card: „137,7k · 15.10.2026”. */
  githubStats: (stars: number, pushedAt: string | null): string =>
    pushedAt === null
      ? formatCompact(stars)
      : `${formatCompact(stars)} · ${formatDate(pushedAt)}`,
  cardHintKey: 'Enter',
  cardHintAction: 'fișa',
  moreCategories: (count: number): string => `+${count}`,
  moreSituations: (count: number): string =>
    `+${plural(count, { one: 'situație', few: 'situații', other: 'de situații' })}`,
  emptyCatalogText: 'Spune-i lui Claude ce ai găsit:',
  emptyCatalogCommand: '/importa',
  emptyCatalogCommandRest: 'în terminal.',
  emptyViewTitle: (name: string): string => `Nicio fișă în „${name}” încă.`,
  /** The header's count: „8 fișe”, or „8 fișe · 1 nouă” after an arrival. */
  sectionCount: (count: number, fresh: number): string =>
    fresh > 0 ? `${entryCount(count)} · ${newCount(fresh)}` : entryCount(count),
  /** The tape on a fresh card: „Adăugat · acum 3 s” (shown in capitals). */
  arrivalTape: (elapsedMs: number): string =>
    `Adăugat · ${relativeTime(elapsedMs)}`,
  /** The small tape in an arrival toast. */
  arrivalToastTape: 'Adăugat',
  /** „Fișă nouă: Webhook · Learn / Backend & API-uri”; without category, „· Learn”. */
  arrivalToastOne: (
    name: string,
    zone: string,
    category: string | null,
  ): RichText => [
    'Fișă nouă: ',
    { strong: name },
    category === null ? ` · ${zone}` : ` · ${zone} / ${category}`,
  ],
  /** „5 fișe noi în Toolbox”. */
  arrivalToastMany: (count: number, zone: string): RichText => [
    {
      strong: `${entryCount(count)} noi`,
    },
    ` în ${zone}`,
  ],
  arrivalToastSee: 'Vezi',
  /** The action of a single-entry arrival toast. */
  arrivalToastOpen: 'Deschide',
  /** The key hints while a sheet is open (EXPERIENCE, status-bar). */
  sheetKeyHints: [
    { keys: 'E', action: 'editează' },
    { keys: 'Esc', action: 'înapoi' },
  ],
  /** The key hints while an entry is edited. */
  editKeyHints: [
    { keys: 'Ctrl S', action: 'salvează' },
    { keys: 'Esc', action: 'renunță' },
  ],
  /** The window title with a sheet open: „remove.bg — WhenKit”. */
  sheetWindowTitle: (name: string): string =>
    `${name} — ${appStrings.productName}`,
  sheetBack: 'Înapoi',
  /** Deleting an entry (EXPERIENCE, Flow 4): the sheet-bar button and its confirmation. */
  deleteEntry: 'Șterge',
  deleteEntryBusy: 'Se șterge…',
  deleteEntryTitle: (name: string): string => `Ștergi fișa „${name}”?`,
  deleteEntryBody: 'Se șterg și legăturile ei cu alte fișe. Nu se poate anula.',
  /** The default button of a confirmation: the one that does not destroy. */
  cancel: 'Renunță',
  /** Editing an entry (CAP-10, EXPERIENCE Flow 3): the sheet-bar buttons. */
  edit: 'Editează',
  save: 'Salvează',
  saving: 'Se salvează…',
  verifyingLink: 'Se verifică linkul…',
  /** The list editors' add buttons and the row's remove button. */
  addSituation: 'Adaugă situație',
  addKeyword: 'Adaugă cuvânt-cheie',
  addSource: 'Adaugă sursă',
  removeRow: 'Șterge rândul',
  /** The accessible names of the rows of a list editor. */
  situationRow: (number: number): string => `Situația ${number}`,
  keywordRow: (number: number): string => `Cuvântul-cheie ${number}`,
  sourceRow: (number: number): string => `Sursa ${number}`,
  /** The banner when the entry changed in the terminal during the edit. */
  conflictText:
    'Fișa a fost modificată din terminal. Salvarea ta va fi refuzată.',
  reloadEntry: 'Reîncarcă fișa',
  reloadEntryTitle: 'Reîncarci fișa?',
  reloadEntryBody: 'Pierzi ce ai schimbat în fișă.',
  reloadEntryConfirm: 'Reîncarcă',
  /** Leaving a dirty form. */
  discardTitle: 'Renunți la modificări?',
  discardBody: (name: string): string =>
    `Ce ai schimbat în „${name}” se pierde.`,
  backToEditing: 'Înapoi la editare',
  discardChanges: 'Aruncă modificările',
  /** A save that needs the network and found none. */
  editOffline:
    'Nu pot verifica linkul fără internet. Modificarea nu s-a salvat.',
  /** A field the core refused without a reason of its own (ARGUMENTS_INVALID). */
  editFieldInvalid: 'Valoarea nu e acceptată.',
  /** The local validation of the form, under the field. */
  editErrors: {
    name: 'Scrie un nume.',
    categories: 'Alege cel puțin o categorie.',
    whatItDoes: 'Scrie ce face.',
    situations: 'Scrie cel puțin o situație.',
    urlRequired: 'Scrie linkul.',
    urlScheme: 'Linkul trebuie să înceapă cu http:// sau https://.',
    content: 'Scrie conținutul.',
  },
  /** Category management (CAP-11, EXPERIENCE Flow 5). */
  categoriesButton: 'Categorii',
  /** Export (CAP-13, EXPERIENCE Flow 6). */
  exportButton: 'Exportă catalogul',
  exporting: 'Se exportă…',
  /** „Catalog exportat: whenkit-export-2026-10-16_143002”. */
  exported: (folderName: string): RichText => [
    'Catalog exportat: ',
    { strong: folderName },
  ],
  openFolder: 'Deschide folderul',
  categoryManagerTitle: 'Categorii',
  categoryManagerIntro: 'Categoriile noi apar doar din import.',
  categoryManagerClose: 'Închide',
  categoryRename: 'Redenumește',
  categoryMerge: 'Unifică…',
  categoryDelete: 'Șterge',
  categoryNameLabel: 'Numele categoriei',
  categoryRenameSave: 'salvează',
  categoryRenameCancel: 'renunță',
  /** „Există deja „Mockup-uri” în Toolbox. Folosește „Unifică…”.” */
  categoryNameTaken: (name: string, zone: string): string =>
    `Există deja „${name}” în ${zone}. Folosește „Unifică…”.`,
  categoryZoneEmpty: 'Nicio categorie.',
  /** The accessible name of a row button: „Redenumește Imagini & video”. */
  categoryActionLabel: (action: string, name: string): string =>
    `${action} ${name}`,
  categoryChoose: 'Alege o categorie',
  categoryMoveTo: 'Mut fișele în',
  categoryMergeTitle: (name: string): string => `Unifică „${name}”`,
  categoryMergeConfirm: 'Unifică',
  categoryMergeBusy: 'Se unifică…',
  /** The consequence of a merge, by how many entries the source holds. */
  categoryMergeConsequence: (
    count: number,
    source: string,
    target: string,
  ): string => {
    if (count === 0) return `Șterg „${source}”. Nu are fișe.`;
    return count === 1
      ? `Mut fișa în „${target}” și șterg „${source}”?`
      : `Mut cele ${entryCount(count)} în „${target}” și șterg „${source}”?`;
  },
  categoryDeleteTitle: (name: string): string => `Ștergi „${name}”?`,
  categoryDeleteBusy: 'Se șterge…',
  /** The delete of a category some entries hold alone: they need a new home. */
  categorySoleEntries: (count: number): string =>
    count === 1
      ? '1 fișă are doar categoria asta. Alege unde o muți, ca să nu rămână fără categorie.'
      : `${entryCount(count)} au doar categoria asta. Alege unde le muți, ca să nu rămână fără categorie.`,
  categoryDeleteShared: (count: number): string =>
    count === 1
      ? 'Fișa care o are rămâne cu cealaltă categorie.'
      : `Cele ${entryCount(count)} care o au rămân cu cealaltă categorie.`,
  categoryDeleteBlocked:
    'Unele fișe au doar categoria asta și nu există alta în zonă.',
  categoryDeleteEmpty: 'Categoria nu are fișe.',
  sheetCrumbsLabel: 'Poziția fișei',
  sheetLabel: (name: string): string => `Fișa ${name}`,
  /** „Când o folosesc · 4”. */
  sheetSituations: (kind: EntryKind, count: number): string =>
    `${entryStrings.situations(kind)} · ${count}`,
  /** The side lists: an umbrella's children, a child's umbrellas, related entries. */
  sheetChildren: (count: number): string => `Concepte · ${count}`,
  sheetParents: 'Face parte din',
  /** The accent block of the side panel (DESIGN, open-in-browser). */
  openInBrowser: 'Deschide în browser',
  /** The footnotes block of a concept's Markdown (remark-gfm) and its back links. */
  footnotesLabel: 'Note',
  footnoteBack: (referenceIndex: number, rereferenceIndex: number): string =>
    `Înapoi la referința ${referenceIndex + 1}${rereferenceIndex > 1 ? `-${rereferenceIndex}` : ''}`,
  sheetRelated: (count: number): string => `Resurse înrudite · ${count}`,
  /** The placeholder of the empty notes field (my-notes). */
  notesPlaceholder: 'Scrie aici ce vrei să-ți amintești.',
  /** The right side of the notes header (my-notes), in its four states. */
  notesHint: 'se salvează singure · doar tu scrii aici',
  notesSaving: 'Se salvează…',
  notesSaved: 'Salvat',
  notesSaveFailed: 'Nu s-a salvat. Încerc din nou.',
  /** The title block: „FIȘĂ · UNEALTĂ” and „rev. 3”. */
  titleBlockLabel: 'Bloc de titlu',
  titleBlockHead: (kind: EntryKind): string =>
    `FIȘĂ · ${kindLabels[kind].toUpperCase()}`,
  titleBlockRevision: (revision: number): string => `rev. ${revision}`,
  titleBlockZone: 'Zonă',
  titleBlockType: 'Tip',
  titleBlockAdded: 'Adăugată',
  titleBlockVerified: 'Verificată',
  titleBlockId: 'Id',
  titleBlockStars: 'Stele',
  titleBlockLastCommit: 'Ultimul commit',
  reloadFailed: 'Nu am putut reîncărca catalogul.',
  toastsLabel: 'Notificări',
  toastClose: 'Închide',
  startupTitle: (code: ErrorCode): string =>
    startupTitles[code] ?? genericStartupTitle,
  startupCommand: (code: ErrorCode): string | undefined =>
    startupCommands[code],
  restartLine: 'Apoi repornește WhenKit.',
} as const;

/** Texts of the main process: native dialogs, outside the renderer (AD-19). */
export const mainStrings = {
  exportDialogTitle: 'Alege folderul pentru export',
  unexpectedErrorTitle: 'Eroare neprevăzută',
  unexpectedErrorBody: (logPath: string | undefined): string =>
    logPath === undefined
      ? 'WhenKit a întâlnit o eroare neprevăzută. Nu am putut nota detaliile într-un fișier de jurnal.'
      : `WhenKit a întâlnit o eroare neprevăzută. Detaliile sunt în ${logPath}.`,
  noAppDataTitle: 'WhenKit nu poate porni',
  noAppDataBody:
    'Variabila de mediu APPDATA lipsește, deci nu știu unde să țin datele ferestrei. Repornește Windows sau contactează autorul.',
} as const;
