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
  line: (name: string, reasons: string, date: string) =>
    `${name} — ${reasons} (${date})`,
} as const;

export const entryStrings = {
  emptyCatalog: 'Catalogul e gol.',
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

export const categoryStrings = {
  zoneHeader: (zone: string) => `${zone}:`,
  line: (name: string) => `  ${name}`,
} as const;
