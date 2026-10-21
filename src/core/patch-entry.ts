import type { BatchItem } from './batch-schema';
import { toEntryDto, type EntryDto } from './dto';
import { zoneOf, type ResourceType, type Zone } from './entry';
import { entryPatchSchema, type EntryPatchInput } from './entry-patch';
import {
  issuesError,
  toErrorIssues,
  vanishedError,
  WhenkitError,
  type ErrorIssue,
} from './errors';
import type { CatalogStore, Clock, StoredEntry } from './ports';
import { dedupKey } from './url';
import type { VerdictReason } from './verification/reason-codes';
import { verifyItem, type VerificationContext } from './verification/verify';

// The window's edit of an entry (AD-3, AD-16): `entries:patch`. It validates
// the changes, verifies the links with the very function the import uses when
// `url` or `sources` change (AD-7), and writes in one transaction that first
// compares `expectedRevision`. A rejected edit is never saved; it comes back
// as an error carrying its reasons (AD-15).

export interface PatchEntryContext {
  /**
   * Link checks, blocked domains and the current time (see verifyItem).
   * Called only when `url` or `sources` change, so a text edit never pays
   * for it (reading the blocked domains is file I/O).
   */
  verification: () => VerificationContext;
  clock: Clock;
}

/** The editable fields of an entry, as they would be after the patch. */
interface Fields {
  name: string;
  url: string | null;
  resourceType: ResourceType | null;
  whatItDoes: string;
  situations: string[];
  keywords: string[];
  sources: string[];
  content: string | null;
  categoryIds: string[];
}

function invalid(issues: ErrorIssue[]): WhenkitError {
  return issuesError('ARGUMENTS_INVALID', issues);
}

/** One issue for each chosen category id that is not a category of `zone`. */
function unknownCategoryIssues(
  categoryIds: readonly string[],
  known: { has(id: string): boolean },
  zone: Zone,
): ErrorIssue[] {
  return categoryIds.flatMap((id, index) =>
    known.has(id)
      ? []
      : [
          {
            path: ['categoryIds', index],
            message: `"${id}" is not a category of the ${zone} zone`,
          },
        ],
  );
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return sameList([...a].sort(), [...b].sort());
}

function fieldsOf(entry: StoredEntry): Fields {
  return {
    name: entry.name,
    url: entry.url,
    resourceType: entry.resourceType,
    whatItDoes: entry.whatItDoes,
    situations: entry.situations,
    keywords: entry.keywords,
    sources: entry.sources,
    content: entry.content,
    categoryIds: entry.categories.map((category) => category.id),
  };
}

/** The item `verifyItem` expects, for the entry as it would be after the patch. */
function verificationItem(
  entry: StoredEntry,
  next: Fields,
  categoryNames: string[],
): BatchItem {
  const common = {
    ref: entry.id,
    op: 'update' as const,
    id: entry.id,
    name: next.name,
    categories: categoryNames,
    whatItDoes: next.whatItDoes,
    situations: next.situations,
    keywords: next.keywords,
    related: [],
  };
  if (entry.kind === 'concept') {
    return {
      ...common,
      kind: 'concept',
      ...(next.url === null ? {} : { url: next.url }),
      content: next.content ?? '',
      sources: next.sources,
    };
  }
  return {
    ...common,
    kind: entry.kind,
    url: next.url ?? '',
    resourceType: next.resourceType ?? 'site',
  };
}

/**
 * Edits the fields of an entry that Claude writes, on behalf of the window.
 *
 * `changes` are validated first (schema, then the rules of the entry's kind
 * and zone): ARGUMENTS_INVALID with the field paths, nothing written, no
 * request made. An unknown id is ENTRY_NOT_FOUND. Changes equal to the stored
 * values write nothing and answer the stored entry.
 *
 * When `url` or `sources` change, the links are verified as an import
 * `update` does (verifyItem): a rejection is ENTRY_REJECTED with its reasons,
 * offline is OFFLINE, and the entry gets the verdict's notes, GitHub data and
 * `verified_at` = now. Otherwise those stay as they were: a text edit never
 * reaches the network.
 *
 * The write transaction then re-reads the entry: a different `revision` than
 * `expectedRevision` is CONFLICT (also when an import landed during the
 * verification), a dedup key owned by another entry is ENTRY_REJECTED with a
 * `duplicate` reason. It increments the revision, keeps `myNotes` and the
 * sticky `forced`, and clears the journaled rejections of the new dedup key.
 * Answers the entry as stored.
 */
export async function patchEntry(
  store: CatalogStore,
  ctx: PatchEntryContext,
  input: EntryPatchInput,
): Promise<EntryDto> {
  const parsed = entryPatchSchema.safeParse(input.changes);
  if (!parsed.success) {
    throw invalid(toErrorIssues(parsed.error.issues));
  }
  const changes = parsed.data;

  const read = store.readTransaction((reader) => {
    const stored = reader.entryById(input.id);
    return {
      stored,
      zoneCategories:
        stored === undefined
          ? []
          : reader.categoriesInZone(zoneOf(stored.kind)),
    };
  });
  const { stored, zoneCategories } = read;
  if (stored === undefined) {
    throw new WhenkitError('ENTRY_NOT_FOUND', { detail: input.id });
  }

  const issues: ErrorIssue[] = [];
  if (stored.kind === 'concept') {
    if (changes.resourceType !== undefined) {
      issues.push({
        path: ['resourceType'],
        message: 'a concept has no resource type',
      });
    }
  } else {
    if (changes.content !== undefined) {
      issues.push({
        path: ['content'],
        message: `a ${stored.kind} has no content`,
      });
    }
    if (changes.sources !== undefined) {
      issues.push({
        path: ['sources'],
        message: `a ${stored.kind} has no sources`,
      });
    }
    if (changes.url === null) {
      issues.push({
        path: ['url'],
        message: `a ${stored.kind} needs a link`,
      });
    }
  }
  const knownCategories = new Map(zoneCategories.map((c) => [c.id, c.name]));
  issues.push(
    ...unknownCategoryIssues(
      changes.categoryIds ?? [],
      knownCategories,
      zoneOf(stored.kind),
    ),
  );
  if (issues.length > 0) throw invalid(issues);

  const before = fieldsOf(stored);
  const next: Fields = {
    name: changes.name ?? before.name,
    url: changes.url === undefined ? before.url : changes.url,
    resourceType: changes.resourceType ?? before.resourceType,
    whatItDoes: changes.whatItDoes ?? before.whatItDoes,
    situations: changes.situations ?? before.situations,
    keywords: changes.keywords ?? before.keywords,
    sources: changes.sources ?? before.sources,
    content: changes.content ?? before.content,
    categoryIds: changes.categoryIds ?? before.categoryIds,
  };

  const linksChanged =
    next.url !== before.url || !sameList(next.sources, before.sources);
  const categoriesChanged = !sameSet(next.categoryIds, before.categoryIds);
  const changed =
    linksChanged ||
    categoriesChanged ||
    next.name !== before.name ||
    next.resourceType !== before.resourceType ||
    next.whatItDoes !== before.whatItDoes ||
    next.content !== before.content ||
    !sameList(next.situations, before.situations) ||
    !sameList(next.keywords, before.keywords);
  if (!changed) return toEntryDto(stored);

  // Verification holds no transaction (AD-6): the network may take seconds.
  let links: {
    sources: string[];
    notes: VerdictReason[];
    githubStars: number | null;
    githubPushedAt: string | null;
    githubArchived: boolean | null;
    verifiedAt: string | null;
  } = {
    sources: next.sources,
    notes: stored.verificationNotes,
    githubStars: stored.githubStars,
    githubPushedAt: stored.githubPushedAt,
    githubArchived: stored.githubArchived,
    verifiedAt: stored.verifiedAt,
  };
  if (linksChanged) {
    const item = verificationItem(
      stored,
      next,
      next.categoryIds.map((id) => knownCategories.get(id) ?? ''),
    );
    const verdict = await verifyItem(item, ctx.verification());
    if (verdict.outcome === 'rejected') {
      throw new WhenkitError('ENTRY_REJECTED', {
        reasons: verdict.reasons,
        detail: verdict.reasons.map((reason) => reason.code).join(', '),
      });
    }
    links = {
      sources: stored.kind === 'concept' ? verdict.sources : [],
      // A forced entry stays forced, so every write of it carries the note.
      notes: stored.forced
        ? [...verdict.reasons, { code: 'forced_by_user' }]
        : verdict.reasons,
      githubStars: verdict.github?.stars ?? null,
      githubPushedAt: verdict.github?.pushedAt ?? null,
      githubArchived: verdict.github?.archived ?? null,
      verifiedAt: ctx.clock.now().toISOString(),
    };
  }

  return store.writeTransaction((writer) => {
    const current = writer.entryById(input.id);
    if (current === undefined) {
      throw new WhenkitError('ENTRY_NOT_FOUND', { detail: input.id });
    }
    if (current.revision !== input.expectedRevision) {
      throw new WhenkitError('CONFLICT', {
        detail: `expected revision ${input.expectedRevision}, stored ${current.revision}`,
      });
    }

    // Categories can be merged or deleted between the read and this write.
    if (categoriesChanged) {
      const known = new Set(
        writer.categoriesInZone(zoneOf(current.kind)).map((c) => c.id),
      );
      const gone = unknownCategoryIssues(
        next.categoryIds,
        known,
        zoneOf(current.kind),
      );
      if (gone.length > 0) throw invalid(gone);
    }

    const key = dedupKey({ url: next.url, name: next.name });
    const ownerId = writer.entryIdByDedupKey(key);
    if (ownerId !== undefined && ownerId !== input.id) {
      throw new WhenkitError('ENTRY_REJECTED', {
        reasons: [
          {
            code: 'duplicate',
            params: { name: writer.entryById(ownerId)?.name ?? '' },
          },
        ],
        detail: `duplicate of ${ownerId}`,
      });
    }

    writer.updateEntry({
      id: input.id,
      kind: current.kind,
      name: next.name,
      url: next.url,
      resourceType: next.resourceType,
      whatItDoes: next.whatItDoes,
      situations: next.situations,
      keywords: next.keywords,
      sources: links.sources,
      content: next.content,
      verificationNotes: links.notes,
      dedupKey: key,
      forced: current.forced,
      githubStars: links.githubStars,
      githubPushedAt: links.githubPushedAt,
      githubArchived: links.githubArchived,
      verifiedAt: links.verifiedAt,
    });
    if (categoriesChanged) {
      writer.replaceEntryCategories(input.id, next.categoryIds);
    }
    // A rejection under the entry's own key is Claude's pending import
    // update, which a window edit does not supersede.
    if (key !== current.dedupKey) writer.deleteRejections(key);

    const saved = writer.entryById(input.id);
    if (saved === undefined) {
      throw vanishedError('entry', input.id);
    }
    return toEntryDto(saved);
  });
}
