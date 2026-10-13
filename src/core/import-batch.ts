import type { Zone } from './category-seed';
import { batchSchema, type Batch, type BatchItem } from './batch-schema';
import { zoneOf } from './entry';
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
}

type ZoneKey = `${Zone}:${string}`;

const zoneKey = (zone: Zone, key: string): ZoneKey => `${zone}:${key}`;

/** Per-transaction view of the categories, by zone and name_key. */
class CategoryResolver {
  private readonly byZone = new Map<Zone, Map<string, StoredCategory>>();
  private readonly declared = new Map<ZoneKey, string>();
  /** Declared categories used by an added item, in order of first use. */
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

/**
 * Reasons that reject an item outright, before duplicates are considered:
 * the verification's (Claude's flag included), then unknown categories.
 */
function rejectionReasons(
  item: BatchItem,
  verdict: ItemVerdict,
  categories: CategoryResolver,
): VerdictReason[] {
  const reasons: VerdictReason[] =
    verdict.outcome === 'rejected' ? [...verdict.reasons] : [];
  const zone = zoneOf(item.kind);
  for (const name of item.categories) {
    if (!categories.isKnown(zone, name)) {
      reasons.push({ code: 'unknown_category', params: { name } });
    }
  }
  return reasons;
}

/**
 * Phase 3: writes a validated batch in one write transaction and returns the
 * report. `verdicts` holds phase 2's verdict for every item, by ref. Per
 * item, in batch order: rejected when its verdict is rejected or a category
 * is neither in its zone nor declared; duplicate when its dedup key
 * is in the catalog (re-checked here, under the lock) or belongs to an item
 * added earlier in the batch; otherwise added (warned when its verdict is),
 * with the sources the verification kept, its warnings and notes as
 * verification notes and `verified_at` = now, creating the declared
 * categories it uses. Every item appears exactly once in the report.
 */
export function applyBatch(
  store: CatalogStore,
  batch: Batch,
  verdicts: BatchVerdicts,
  { clock, ids, workspace }: ApplyBatchContext,
): ImportReport {
  return store.writeTransaction((writer) => {
    const now = clock.now().toISOString();
    const categories = new CategoryResolver(writer, ids, batch.newCategories);
    const addedKeys = new Map<string, string>();
    const items: ReportItem[] = [];

    for (const item of batch.items) {
      const base = { ref: item.ref, op: item.op };
      const verdict = verdicts.get(item.ref);
      if (verdict === undefined) {
        throw new WhenkitError('INTERNAL', {
          detail: `no verification verdict for ${item.ref}`,
        });
      }
      const reasons = rejectionReasons(item, verdict, categories);
      if (reasons.length > 0) {
        items.push({ ...base, outcome: 'rejected', reasons });
        continue;
      }

      // The batch check comes first: the transaction already sees the rows
      // this batch inserted, and those are reported by ref, not by id.
      const key = dedupKey(item);
      const earlierRef = addedKeys.get(key);
      if (earlierRef !== undefined) {
        items.push({
          ...base,
          outcome: 'duplicate',
          reasons: [{ code: 'duplicate', params: { ref: earlierRef } }],
        });
        continue;
      }
      const existingId = writer.entryIdByDedupKey(key);
      if (existingId !== undefined) {
        items.push({
          ...base,
          outcome: 'duplicate',
          duplicateOfId: existingId,
          reasons: [{ code: 'duplicate' }],
        });
        continue;
      }

      const zone = zoneOf(item.kind);
      const categoryIds = item.categories.map((name) =>
        categories.resolve(zone, name),
      );
      const id = ids.newId();
      writer.insertEntry({
        id,
        kind: item.kind,
        name: item.name,
        url: item.url ?? null,
        resourceType: item.kind === 'concept' ? null : item.resourceType,
        whatItDoes: item.whatItDoes,
        situations: item.situations,
        keywords: item.keywords,
        sources: item.kind === 'concept' ? verdict.sources : [],
        content: item.kind === 'concept' ? item.content : null,
        verificationNotes: verdict.reasons,
        dedupKey: key,
        addedAt: now,
        verifiedAt: now,
      });
      for (const categoryId of categoryIds) {
        writer.addEntryCategory(id, categoryId);
      }
      addedKeys.set(key, item.ref);
      items.push({
        ...base,
        outcome: verdict.outcome === 'warned' ? 'warned' : 'added',
        id,
        reasons: verdict.reasons,
      });
    }

    // Validated before the commit: a report that breaks its own schema is a
    // bug, and it rolls the import back instead of exiting 4 after writing.
    return importReportSchema.parse({
      schemaVersion: IMPORT_REPORT_VERSION,
      workspace,
      items,
      newCategories: [...categories.used.values()],
      ignoredLinks: [],
      proposedBlockedDomains: batch.proposedBlockedDomains,
    });
  });
}
