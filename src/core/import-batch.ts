import type { Zone } from './category-seed';
import {
  batchSchema,
  isEntryId,
  type Batch,
  type BatchItem,
} from './batch-schema';
import { zoneOf, type EntryKind } from './entry';
import { WhenkitError, type ErrorIssue } from './errors';
import {
  importReportSchema,
  type ImportReport,
  type ReportCategory,
  type ReportItem,
} from './import-report-schema';
import { nameKey } from './name-key';
import type {
  CatalogStore,
  CatalogWriter,
  Clock,
  FileSystem,
  IdGenerator,
  StoredCategory,
} from './ports';
import { dedupKey } from './url';
import type { VerdictReason } from './verification/reason-codes';
import type { BatchVerdicts, ItemVerdict } from './verification/verify';
import { BATCH_SCHEMA_VERSION, IMPORT_REPORT_VERSION } from './versions';

// The import use case (AD-6). Phase 1 validates the batch without I/O;
// phase 2 (verification/verify.ts) checks the links without a transaction;
// phase 3 writes the batch, with phase 2's verdicts, in one short write
// transaction.

function invalid(issues: ErrorIssue[]): WhenkitError {
  return new WhenkitError('BATCH_INVALID', {
    issues,
    detail: issues.map((issue) => issue.message).join('; '),
  });
}

/** Zod paths may hold symbols; JSON input never produces them. */
function issuePath(path: readonly PropertyKey[]): (string | number)[] {
  return path.map((key) => (typeof key === 'number' ? key : String(key)));
}

/**
 * Phase 1: the batch text → a validated batch. Throws BATCH_INVALID (with
 * the schema issues) or BATCH_SCHEMA_OUTDATED; writes nothing.
 */
export function parseBatch(text: string): Batch {
  let data: unknown;
  try {
    // Windows PowerShell 5.1 writes UTF-8 with a byte-order mark.
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw invalid([{ path: [], message: `not valid JSON: ${reason}` }]);
  }

  // An outdated batch is reported as such, not as a pile of schema issues.
  const version =
    typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (typeof version === 'number' && version !== BATCH_SCHEMA_VERSION) {
    throw new WhenkitError('BATCH_SCHEMA_OUTDATED', {
      detail: `batch schemaVersion ${version}, expected ${BATCH_SCHEMA_VERSION}`,
      issues: [
        {
          path: ['schemaVersion'],
          message: `expected ${BATCH_SCHEMA_VERSION}, got ${version}`,
        },
      ],
    });
  }

  const result = batchSchema.safeParse(data);
  if (!result.success) {
    throw invalid(
      result.error.issues.map((issue) => ({
        path: issuePath(issue.path),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

/** Phase 1 from a file: an unreadable file is an invalid batch. */
export function readBatch(fs: FileSystem, path: string): Batch {
  let text: string;
  try {
    text = fs.readText(path);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw invalid([{ path: [], message: `cannot read ${path}: ${reason}` }]);
  }
  return parseBatch(text);
}

export interface ApplyBatchContext {
  clock: Clock;
  ids: IdGenerator;
  /** The resolved workspace path, echoed in the report. */
  workspace: string;
  /** Refs of the items `--force` lets past the verification's rejection. */
  force?: readonly string[];
}

/**
 * The `--force` refs must all name an item of the batch, else the import is
 * invalid (AD-7). Throws BATCH_INVALID; checks no I/O.
 */
export function assertForceRefs(batch: Batch, force: readonly string[]): void {
  const refs = new Set(batch.items.map((item) => item.ref));
  const issues = force.flatMap((ref, index) =>
    refs.has(ref)
      ? []
      : [
          {
            path: ['force', index],
            message: `"${ref}" is not the ref of an item of this batch`,
          },
        ],
  );
  if (issues.length > 0) throw invalid(issues);
}

type ZoneKey = `${Zone}:${string}`;

const zoneKey = (zone: Zone, key: string): ZoneKey => `${zone}:${key}`;

/** Per-transaction view of the categories, by zone and name_key. */
class CategoryResolver {
  private readonly byZone = new Map<Zone, Map<string, StoredCategory>>();
  private readonly declared = new Map<ZoneKey, string>();
  /** Declared categories used by a written item, in order of first use. */
  readonly used = new Map<ZoneKey, ReportCategory>();

  constructor(
    private readonly writer: CatalogWriter,
    private readonly ids: IdGenerator,
    newCategories: Batch['newCategories'],
  ) {
    for (const category of newCategories) {
      const key = zoneKey(category.zone, nameKey(category.name));
      if (!this.declared.has(key)) this.declared.set(key, category.name);
    }
  }

  private zone(zone: Zone): Map<string, StoredCategory> {
    let categories = this.byZone.get(zone);
    if (categories === undefined) {
      categories = new Map(
        this.writer.categoriesInZone(zone).map((c) => [c.nameKey, c]),
      );
      this.byZone.set(zone, categories);
    }
    return categories;
  }

  /** True when `name` exists in the zone or is declared for it. */
  isKnown(zone: Zone, name: string): boolean {
    const key = nameKey(name);
    return this.zone(zone).has(key) || this.declared.has(zoneKey(zone, key));
  }

  /** The category id for a known name, creating a declared one on first use. */
  resolve(zone: Zone, name: string): string {
    const key = nameKey(name);
    const declaredName = this.declared.get(zoneKey(zone, key));
    const existing = this.zone(zone).get(key);
    if (existing !== undefined) {
      if (declaredName !== undefined && !this.used.has(zoneKey(zone, key))) {
        this.used.set(zoneKey(zone, key), {
          id: existing.id,
          zone,
          name: existing.name,
          created: false,
        });
      }
      return existing.id;
    }
    if (declaredName === undefined) {
      throw new WhenkitError('INTERNAL', {
        detail: `unknown category ${name}`,
      });
    }
    const category: StoredCategory = {
      id: this.ids.newId(),
      zone,
      name: declaredName,
      nameKey: key,
    };
    this.writer.insertCategory(category);
    this.zone(zone).set(key, category);
    this.used.set(zoneKey(zone, key), {
      id: category.id,
      zone,
      name: category.name,
      created: true,
    });
    return category.id;
  }
}

/** Why an item is rejected outright, before duplicates are considered. */
interface Rejection {
  /** Every reason, in report order: unknown id, verification, categories. */
  reasons: VerdictReason[];
  /**
   * True when the verification's reasons (Claude's flag included) are the
   * only ones: `--force` bypasses those and nothing else (AD-7).
   */
  forcible: boolean;
}

/**
 * The reasons that reject an item outright: an update's unknown id, the
 * verification's (Claude's flag included), then unknown categories.
 */
function rejectionOf(
  item: BatchItem,
  verdict: ItemVerdict,
  categories: CategoryResolver,
  writer: CatalogWriter,
): Rejection {
  const reasons: VerdictReason[] = [];
  let forcible = verdict.outcome === 'rejected';
  if (item.op === 'update') {
    const id = updateId(item);
    if (writer.entryById(id) === undefined) {
      reasons.push({ code: 'unknown_id', params: { id } });
      forcible = false;
    }
  }
  if (verdict.outcome === 'rejected') reasons.push(...verdict.reasons);
  const zone = zoneOf(item.kind);
  for (const name of item.categories) {
    if (!categories.isKnown(zone, name)) {
      reasons.push({ code: 'unknown_category', params: { name } });
      forcible = false;
    }
  }
  return { reasons, forcible };
}

/** The entry id of an update; the batch schema guarantees it is present. */
function updateId(item: BatchItem): string {
  if (item.id === undefined) {
    throw new WhenkitError('INTERNAL', {
      detail: `update ${item.ref} has no id`,
    });
  }
  return item.id;
}

type IgnoredLink = ImportReport['ignoredLinks'][number];

/** An item the batch wrote, with the id of its entry. */
interface WrittenItem {
  item: BatchItem;
  id: string;
}

/** The entry a link target names, or the reason the link is skipped. */
type ResolvedTarget =
  | { id: string; kind: EntryKind }
  | { ignored: VerdictReason };

/**
 * A link target is the ref of another item or an entry id; a ref wins when
 * both could match. Looked up after every item is written, so a ref names the
 * entry its item got and an id sees the updates of this batch.
 */
function resolveTarget(
  target: string,
  batchRefs: ReadonlySet<string>,
  writtenIds: ReadonlyMap<string, string>,
  writer: CatalogWriter,
): ResolvedTarget {
  let id: string;
  if (batchRefs.has(target)) {
    const writtenId = writtenIds.get(target);
    if (writtenId === undefined) {
      return {
        ignored: { code: 'link_target_not_written', params: { ref: target } },
      };
    }
    id = writtenId;
  } else {
    id = target.toLowerCase();
  }
  const entry = isEntryId(id) ? writer.entryById(id) : undefined;
  if (entry === undefined) {
    return { ignored: { code: 'unknown_id', params: { id } } };
  }
  return { id, kind: entry.kind };
}

/** True when `childId` is `parentId` or one of its ancestors. */
function closesCycle(
  writer: CatalogWriter,
  parentId: string,
  childId: string,
): boolean {
  const seen = new Set<string>();
  const pending = [parentId];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (id === childId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...writer.parentIdsOf(id));
  }
  return false;
}

/**
 * The link pass (AD-5, AD-6), after every item has its outcome: first the
 * removals of all updates, then the insertions, so a link written by an
 * earlier item survives a later update clearing the same entry's links.
 * Returns the links the catalog could not satisfy, in batch order.
 */
function writeLinks(
  writer: CatalogWriter,
  batch: Batch,
  written: readonly WrittenItem[],
  writtenIds: ReadonlyMap<string, string>,
): IgnoredLink[] {
  const batchRefs = new Set(batch.items.map((item) => item.ref));
  /** Parent links an update removed because its entry is no longer a concept. */
  const kindChanges = new Map<string, IgnoredLink[]>();

  for (const { item, id } of written) {
    if (item.op !== 'update') continue;
    writer.deleteRelatedLinks(id);
    if (item.kind !== 'concept') {
      kindChanges.set(
        item.ref,
        writer.deleteParentLinks(id).map((other) => ({
          fromRef: item.ref,
          to: other,
          reason: { code: 'parent_requires_concept', params: { id } },
        })),
      );
    } else if (item.children !== undefined) {
      writer.deleteChildLinks(id);
    }
  }

  const ignored: IgnoredLink[] = [];
  for (const { item, id } of written) {
    ignored.push(...(kindChanges.get(item.ref) ?? []));
    const skip = (to: string, reason: VerdictReason) =>
      ignored.push({ fromRef: item.ref, to, reason });

    for (const target of item.related) {
      const resolved = resolveTarget(target, batchRefs, writtenIds, writer);
      if ('ignored' in resolved) skip(target, resolved.ignored);
      else writer.insertLink('related', id, resolved.id);
    }

    if (item.kind !== 'concept') continue;
    for (const target of item.children ?? []) {
      const resolved = resolveTarget(target, batchRefs, writtenIds, writer);
      if ('ignored' in resolved) {
        skip(target, resolved.ignored);
      } else if (resolved.kind !== 'concept') {
        skip(target, {
          code: 'parent_requires_concept',
          params: { id: resolved.id },
        });
      } else if (closesCycle(writer, id, resolved.id)) {
        skip(target, { code: 'parent_cycle', params: { id: resolved.id } });
      } else {
        writer.insertLink('parent', id, resolved.id);
      }
    }
  }
  return ignored;
}

/** An item the import rejected, waiting to be journaled. */
interface RejectedItem {
  item: BatchItem;
  reasons: VerdictReason[];
  key: string;
}

/**
 * The journaled element (AD-5): the item as it passed the schema, with each
 * `related`/`children` target that is a batch ref replaced by the id its item
 * was written with, or dropped when that item was not written. Entry ids stay.
 * Imported again alone, it passes the batch schema: a ref to another item of
 * the old batch would not.
 */
function journalElement(
  item: BatchItem,
  batchRefs: ReadonlySet<string>,
  writtenIds: ReadonlyMap<string, string>,
  untouchedIds: ReadonlyMap<string, string>,
): Record<string, unknown> {
  const rewrite = (targets: readonly string[]): string[] => {
    const out: string[] = [];
    for (const original of targets) {
      let target = original;
      if (batchRefs.has(original)) {
        const id = writtenIds.get(original) ?? untouchedIds.get(original);
        if (id === undefined) continue;
        target = id;
      }
      if (!out.includes(target)) out.push(target);
    }
    return out;
  };
  const element: Record<string, unknown> = {
    ...item,
    related: rewrite(item.related),
  };
  if (item.kind === 'concept' && item.children !== undefined) {
    element.children = rewrite(item.children);
  }
  return element;
}

/**
 * Journals the rejected items (AD-5), after the item loop. An item whose
 * dedup key belongs by now to an entry other than its own update id is
 * skipped: retried, it would only be a duplicate, and no later write could
 * clear its row. A newer row replaces the older one of the same key.
 */
function journalRejections(
  writer: CatalogWriter,
  batch: Batch,
  rejected: readonly RejectedItem[],
  writtenIds: ReadonlyMap<string, string>,
  { newId, now }: { newId: () => string; now: string },
): void {
  const batchRefs = new Set(batch.items.map((item) => item.ref));
  // A rejected update leaves its entry in place: a link to it stays valid.
  const untouchedIds = new Map<string, string>();
  for (const item of batch.items) {
    if (
      item.op === 'update' &&
      !writtenIds.has(item.ref) &&
      writer.entryById(updateId(item)) !== undefined
    ) {
      untouchedIds.set(item.ref, updateId(item));
    }
  }
  for (const { item, reasons, key } of rejected) {
    const owner = writer.entryIdByDedupKey(key);
    const ownId = item.op === 'update' ? item.id : undefined;
    if (owner !== undefined && owner !== ownId) continue;
    // The journal keeps only the latest rejected update of an entry.
    if (item.op === 'update') writer.deleteUpdateRejections(updateId(item));
    writer.insertRejection({
      id: newId(),
      op: item.op,
      element: journalElement(item, batchRefs, writtenIds, untouchedIds),
      reasons,
      dedupKey: key,
      batchSchemaVersion: batch.schemaVersion,
      rejectedAt: now,
    });
  }
}

/**
 * Phase 3: writes a validated batch in one write transaction and returns the
 * report. `verdicts` holds phase 2's verdict for every item, by ref. Per
 * item, in batch order: rejected when an update's id is not in the catalog,
 * its verdict is rejected or a category is neither in its zone nor declared;
 * duplicate when its dedup key belongs to an item written earlier in the
 * batch or to another catalog entry (re-checked here, under the lock; an
 * update never duplicates its own entry); otherwise written, with the
 * sources the verification kept, its warnings and notes as verification
 * notes, the GitHub metadata the verification found (null when none) and
 * `verified_at` = now, creating the declared categories it uses.
 * An add inserts a new entry (added, or warned); an update fully replaces
 * Claude's fields and the categories of its entry, increments its revision
 * and keeps the author's fields (updated, or warned). A rejected or
 * duplicate update leaves its entry untouched. Every item appears exactly
 * once in the report.
 *
 * The rejection journal (AD-5) is kept here, in the same transaction: every
 * written item clears the rows of its dedup key, and after the loop every
 * rejected item is journaled (journalRejections). An item in `force` whose
 * only rejection reasons are the verification's is written as warned,
 * `forced`, with the sources the verification left it, those reasons, its
 * warnings and `forced_by_user` as notes; `forced` is sticky, so every write
 * of a forced entry carries `forced_by_user` too. `--force` never bypasses unknown categories, an
 * unknown id or a duplicate.
 *
 * The links come last (writeLinks): a link the catalog cannot satisfy is
 * skipped and reported in `ignoredLinks`, the item stays.
 */
export function applyBatch(
  store: CatalogStore,
  batch: Batch,
  verdicts: BatchVerdicts,
  { clock, ids, workspace, force = [] }: ApplyBatchContext,
): ImportReport {
  assertForceRefs(batch, force);
  const forceRefs = new Set(force);
  return store.writeTransaction((writer) => {
    const now = clock.now().toISOString();
    const categories = new CategoryResolver(writer, ids, batch.newCategories);
    /** Dedup keys written by this batch (added or updated), to their ref. */
    const writtenKeys = new Map<string, string>();
    const items: ReportItem[] = [];
    const written: WrittenItem[] = [];
    /** Rejected items, journaled once the whole batch is written. */
    const rejected: RejectedItem[] = [];
    /** Batch ref → id of the entry the item wrote. */
    const writtenIds = new Map<string, string>();

    for (const item of batch.items) {
      const base = { ref: item.ref, op: item.op };
      const verdict = verdicts.get(item.ref);
      if (verdict === undefined) {
        throw new WhenkitError('INTERNAL', {
          detail: `no verification verdict for ${item.ref}`,
        });
      }
      const key = dedupKey(item);
      const rejection = rejectionOf(item, verdict, categories, writer);
      const forcedWrite =
        rejection.reasons.length > 0 &&
        rejection.forcible &&
        forceRefs.has(item.ref);
      if (rejection.reasons.length > 0 && !forcedWrite) {
        // Journaled after the loop, once it is known what the batch wrote.
        rejected.push({ item, reasons: rejection.reasons, key });
        items.push({
          ...base,
          outcome: 'rejected',
          reasons: rejection.reasons,
        });
        continue;
      }

      // The batch check comes first: the transaction already sees the rows
      // this batch wrote, and those are reported by ref, not by id. Batch
      // ids are unique, so an earlier write is never this update's own.
      const earlierRef = writtenKeys.get(key);
      if (earlierRef !== undefined) {
        items.push({
          ...base,
          outcome: 'duplicate',
          reasons: [{ code: 'duplicate', params: { ref: earlierRef } }],
        });
        continue;
      }
      const existingId = writer.entryIdByDedupKey(key);
      if (existingId !== undefined && existingId !== item.id) {
        items.push({
          ...base,
          outcome: 'duplicate',
          duplicateOfId: existingId,
          reasons: [{ code: 'duplicate' }],
        });
        continue;
      }

      // A forced entry stays forced (AD-6): every write of one carries the
      // note, so the flag and the note never disagree. A forced write notes
      // the reasons it bypassed, then the warnings the item would have had.
      const forced =
        forcedWrite ||
        (item.op === 'update' &&
          writer.entryById(updateId(item))?.forced === true);
      const verdictNotes: VerdictReason[] = forcedWrite
        ? [...verdict.reasons, ...(verdict.warnings ?? [])]
        : verdict.reasons;
      const notes: VerdictReason[] = forced
        ? [...verdictNotes, { code: 'forced_by_user' }]
        : verdictNotes;
      const sources = forcedWrite
        ? (verdict.forcedSources ?? verdict.sources)
        : verdict.sources;

      const zone = zoneOf(item.kind);
      const categoryIds = item.categories.map((name) =>
        categories.resolve(zone, name),
      );
      const fields = {
        kind: item.kind,
        name: item.name,
        url: item.url ?? null,
        resourceType: item.kind === 'concept' ? null : item.resourceType,
        whatItDoes: item.whatItDoes,
        situations: item.situations,
        keywords: item.keywords,
        sources: item.kind === 'concept' ? sources : [],
        content: item.kind === 'concept' ? item.content : null,
        verificationNotes: notes,
        dedupKey: key,
        forced,
        // Written on every add and update; null when the API did not answer.
        githubStars: verdict.github?.stars ?? null,
        githubPushedAt: verdict.github?.pushedAt ?? null,
        githubArchived: verdict.github?.archived ?? null,
        verifiedAt: now,
      };
      let id: string;
      if (item.op === 'update') {
        id = updateId(item);
        writer.updateEntry({ id, ...fields });
        writer.replaceEntryCategories(id, categoryIds);
        // Retrying an older rejected update of this entry would undo this write.
        writer.deleteUpdateRejections(id);
      } else {
        id = ids.newId();
        writer.insertEntry({ id, ...fields, addedAt: now });
        for (const categoryId of categoryIds) {
          writer.addEntryCategory(id, categoryId);
        }
      }
      writer.deleteRejections(key);
      writtenKeys.set(key, item.ref);
      written.push({ item, id });
      writtenIds.set(item.ref, id);
      const done = item.op === 'update' ? 'updated' : 'added';
      items.push({
        ...base,
        outcome: forcedWrite || verdict.outcome === 'warned' ? 'warned' : done,
        id,
        reasons: notes,
      });
    }

    journalRejections(writer, batch, rejected, writtenIds, {
      newId: () => ids.newId(),
      now,
    });
    const ignoredLinks = writeLinks(writer, batch, written, writtenIds);

    // Validated before the commit: a report that breaks its own schema is a
    // bug, and it rolls the import back instead of exiting 4 after writing.
    return importReportSchema.parse({
      schemaVersion: IMPORT_REPORT_VERSION,
      workspace,
      items,
      newCategories: [...categories.used.values()],
      ignoredLinks,
      proposedBlockedDomains: batch.proposedBlockedDomains,
    });
  });
}
