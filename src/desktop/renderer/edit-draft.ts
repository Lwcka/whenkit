import {
  isExternalUrl,
  type EntryDto,
  type EntryPatch,
  type ErrorDto,
} from '../../shared/ipc';
import { appStrings, reasonTexts } from '../../shared/strings.ro';

// The form of the edit mode (CAP-10): a draft the user types into, the local
// validation that mirrors core's rules, and the mapping from the draft to the
// `entries:patch` changes and from the server's answers back to the fields.
// Pure: no React, no IPC. The draft is the user's own copy; it never follows
// the store's DTO while editing (AD-10).

export type ResourceType = NonNullable<EntryDto['resourceType']>;

/** The editable fields as the form holds them: strings and rows of strings. */
export interface Draft {
  name: string;
  url: string;
  /** Tools and materials only. */
  resourceType: ResourceType | null;
  categoryIds: string[];
  whatItDoes: string;
  situations: string[];
  keywords: string[];
  /** Concepts only. */
  sources: string[];
  /** Concepts only; Markdown. */
  content: string;
}

/** Where an error text shows: a field, or one row of the sources list. */
export type FieldKey =
  | 'name'
  | 'url'
  | 'resourceType'
  | 'categories'
  | 'whatItDoes'
  | 'situations'
  | 'keywords'
  | 'content'
  | 'sources'
  | `sources.${number}`;

export type FieldErrors = Partial<Record<FieldKey, string>>;

type Reason = NonNullable<ErrorDto['reasons']>[number];
type Issue = NonNullable<ErrorDto['issues']>[number];

export function draftFromEntry(entry: EntryDto): Draft {
  return {
    name: entry.name,
    url: entry.url ?? '',
    resourceType: entry.resourceType,
    categoryIds: entry.categories.map((category) => category.id),
    whatItDoes: entry.whatItDoes,
    situations: [...entry.situations],
    keywords: [...entry.keywords],
    sources: [...entry.sources],
    content: entry.content ?? '',
  };
}

/** The rows that count: trimmed, empty ones dropped. */
function cleanRows(rows: readonly string[]): string[] {
  return rows.map((row) => row.trim()).filter((row) => row !== '');
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return sameList([...a].sort(), [...b].sort());
}

/**
 * The local validation (the rules of core's `entries:patch`, so a save that
 * cannot succeed is not sent): the message of each invalid field.
 */
export function validateDraft(
  draft: Draft,
  kind: EntryDto['kind'],
): FieldErrors {
  const errors: FieldErrors = {};
  if (draft.name.trim() === '') errors.name = appStrings.editErrors.name;
  if (draft.categoryIds.length === 0)
    errors.categories = appStrings.editErrors.categories;
  if (draft.whatItDoes.trim() === '')
    errors.whatItDoes = appStrings.editErrors.whatItDoes;
  if (cleanRows(draft.situations).length === 0)
    errors.situations = appStrings.editErrors.situations;
  const url = draft.url.trim();
  if (url === '') {
    // A concept may have no link; a tool or a material always has one.
    if (kind !== 'concept') errors.url = appStrings.editErrors.urlRequired;
  } else if (!isExternalUrl(url)) {
    errors.url = appStrings.editErrors.urlScheme;
  }
  if (kind === 'concept' && draft.content.trim() === '')
    errors.content = appStrings.editErrors.content;
  return errors;
}

/**
 * Only the fields that differ from `entry`, trimmed, with the empty rows
 * dropped. A concept's emptied link is `null` (it removes the link).
 */
export function patchChanges(draft: Draft, entry: EntryDto): EntryPatch {
  const changes: EntryPatch = {};
  const concept = entry.kind === 'concept';

  const name = draft.name.trim();
  if (name !== entry.name.trim()) changes.name = name;

  const url = draft.url.trim();
  if (concept && url === '') {
    if (entry.url !== null) changes.url = null;
  } else if (url !== (entry.url ?? '').trim()) {
    changes.url = url;
  }

  if (
    !concept &&
    draft.resourceType !== null &&
    draft.resourceType !== entry.resourceType
  ) {
    changes.resourceType = draft.resourceType;
  }

  const whatItDoes = draft.whatItDoes.trim();
  if (whatItDoes !== entry.whatItDoes.trim()) changes.whatItDoes = whatItDoes;

  const situations = cleanRows(draft.situations);
  if (!sameList(situations, cleanRows(entry.situations)))
    changes.situations = situations;

  const keywords = cleanRows(draft.keywords);
  if (!sameList(keywords, cleanRows(entry.keywords)))
    changes.keywords = keywords;

  if (concept) {
    const sources = cleanRows(draft.sources);
    if (!sameList(sources, cleanRows(entry.sources))) changes.sources = sources;

    const content = draft.content.trim();
    if (content !== (entry.content ?? '').trim()) changes.content = content;
  }

  if (
    !sameSet(
      draft.categoryIds,
      entry.categories.map((category) => category.id),
    )
  ) {
    changes.categoryIds = [...draft.categoryIds];
  }
  return changes;
}

/** Whether the draft holds anything the entry does not. */
export function isDirty(draft: Draft, entry: EntryDto): boolean {
  return Object.keys(patchChanges(draft, entry)).length > 0;
}

/** Whether saving these changes makes core verify links (a slow save). */
export function changesLinks(changes: EntryPatch): boolean {
  return changes.url !== undefined || changes.sources !== undefined;
}

/** „linkul nu funcționează” → „Linkul nu funcționează.”: a reason is a clause. */
function asSentence(text: string): string {
  const first = text.charAt(0).toLocaleUpperCase('ro') + text.slice(1);
  return /[.!?]$/.test(first) ? first : `${first}.`;
}

function joinTexts(previous: string | undefined, text: string): string {
  return previous === undefined ? text : `${previous} ${text}`;
}

/**
 * The reasons of a rejected save, each under its field. A reason carries no
 * field path (AD-15): one whose `params.url` is a source row of the draft goes
 * to that row; everything else concerns the entry's own link.
 */
export function reasonsByField(
  reasons: readonly Reason[],
  draft: Draft,
): FieldErrors {
  const errors: FieldErrors = {};
  const rows = draft.sources.map((source) => source.trim());
  for (const reason of reasons) {
    const text = asSentence(reasonTexts[reason.code](reason.params ?? {}));
    const url = reason.params?.url;
    const row = url === undefined ? -1 : rows.indexOf(url);
    // Core keys a concept without a link by its name, so a duplicate is the name's.
    const key: FieldKey =
      row >= 0
        ? `sources.${row}`
        : reason.code === 'duplicate' && draft.url.trim() === ''
          ? 'name'
          : 'url';
    errors[key] = joinTexts(errors[key], text);
  }
  return errors;
}

const ISSUE_FIELDS: Readonly<Record<string, FieldKey>> = {
  name: 'name',
  url: 'url',
  resourceType: 'resourceType',
  whatItDoes: 'whatItDoes',
  situations: 'situations',
  keywords: 'keywords',
  sources: 'sources',
  content: 'content',
  categoryIds: 'categories',
};

/** The invalid fields of an `ARGUMENTS_INVALID` answer, by the first key of each path. */
export function issuesByField(issues: readonly Issue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = ISSUE_FIELDS[String(issue.path[0])];
    if (field !== undefined) errors[field] = appStrings.editFieldInvalid;
  }
  return errors;
}

/** The error keys that belong to a draft field. */
function errorKeysOf(field: keyof Draft): (key: string) => boolean {
  switch (field) {
    case 'categoryIds':
      return (key) => key === 'categories';
    case 'sources':
      return (key) => key === 'sources' || key.startsWith('sources.');
    default:
      return (key) => key === field;
  }
}

/** The errors that remain after the user changed these fields of the draft. */
export function withoutErrorsOf(
  errors: FieldErrors,
  changed: readonly (keyof Draft)[],
): FieldErrors {
  const matchers = changed.map(errorKeysOf);
  const kept: FieldErrors = {};
  for (const [key, text] of Object.entries(errors)) {
    if (!matchers.some((matches) => matches(key))) kept[key as FieldKey] = text;
  }
  return kept;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
