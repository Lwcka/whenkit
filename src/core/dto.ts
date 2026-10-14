import { z } from 'zod';
import { ENTRY_KINDS, RESOURCE_TYPES, ZONES, zoneOf } from './entry';
import type {
  StoredCategory,
  StoredEntry,
  StoredEntrySummary,
  StoredRejection,
} from './ports';
import { verdictReasonSchema } from './verification/reason-codes';

// The one set of DTOs (AD-18) that `--json`, IPC and the export share: plain
// objects, dates as ISO strings. Links appear as id lists on the entry;
// LinkDto arrives with the export.

export const categoryDtoSchema = z.strictObject({
  id: z.string(),
  zone: z.enum(ZONES),
  name: z.string(),
});

export type CategoryDto = z.infer<typeof categoryDtoSchema>;

/** A category as an entry shows it; the zone is the entry's own. */
export const entryCategoryDtoSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
});

export const entryDtoSchema = z.strictObject({
  id: z.string(),
  ownerId: z.string(),
  kind: z.enum(ENTRY_KINDS),
  zone: z.enum(ZONES),
  name: z.string(),
  url: z.string().nullable(),
  resourceType: z.enum(RESOURCE_TYPES).nullable(),
  categories: z.array(entryCategoryDtoSchema),
  relatedIds: z.array(z.string()),
  parentIds: z.array(z.string()),
  childIds: z.array(z.string()),
  whatItDoes: z.string(),
  situations: z.array(z.string()),
  keywords: z.array(z.string()),
  sources: z.array(z.string()),
  content: z.string().nullable(),
  myNotes: z.string(),
  githubStars: z.number().int().nullable(),
  githubPushedAt: z.string().nullable(),
  githubArchived: z.boolean().nullable(),
  verificationNotes: z.array(verdictReasonSchema),
  forced: z.boolean(),
  revision: z.number().int(),
  addedAt: z.string(),
  verifiedAt: z.string().nullable(),
});

export type EntryDto = z.infer<typeof entryDtoSchema>;

/** An entry as `whenkit list` shows it: everything but `content`. */
export const entrySummaryDtoSchema = entryDtoSchema.omit({ content: true });

export type EntrySummaryDto = z.infer<typeof entrySummaryDtoSchema>;

/** A journaled rejection (AD-5): what /importa needs to retry the item. */
export const rejectionDtoSchema = z.strictObject({
  id: z.string(),
  op: z.enum(['add', 'update']),
  /**
   * The batch item as it passed the schema when it was rejected. Not
   * re-validated against today's schema: the journal may predate it.
   */
  element: z.record(z.string(), z.unknown()),
  reasons: z.array(verdictReasonSchema),
  dedupKey: z.string(),
  batchSchemaVersion: z.number().int(),
  rejectedAt: z.string(),
});

export type RejectionDto = z.infer<typeof rejectionDtoSchema>;

export function toCategoryDto(category: StoredCategory): CategoryDto {
  return { id: category.id, zone: category.zone, name: category.name };
}

export function toEntrySummaryDto(entry: StoredEntrySummary): EntrySummaryDto {
  return {
    id: entry.id,
    ownerId: entry.ownerId,
    kind: entry.kind,
    zone: zoneOf(entry.kind),
    name: entry.name,
    url: entry.url,
    resourceType: entry.resourceType,
    categories: entry.categories.map(({ id, name }) => ({ id, name })),
    relatedIds: [...entry.relatedIds],
    parentIds: [...entry.parentIds],
    childIds: [...entry.childIds],
    whatItDoes: entry.whatItDoes,
    situations: [...entry.situations],
    keywords: [...entry.keywords],
    sources: [...entry.sources],
    myNotes: entry.myNotes,
    githubStars: entry.githubStars,
    githubPushedAt: entry.githubPushedAt,
    githubArchived: entry.githubArchived,
    verificationNotes: entry.verificationNotes.map((reason) => ({ ...reason })),
    forced: entry.forced,
    revision: entry.revision,
    addedAt: entry.addedAt,
    verifiedAt: entry.verifiedAt,
  };
}

export function toEntryDto(entry: StoredEntry): EntryDto {
  return { ...toEntrySummaryDto(entry), content: entry.content };
}

export function toRejectionDto(rejection: StoredRejection): RejectionDto {
  return {
    id: rejection.id,
    op: rejection.op,
    element: { ...rejection.element },
    reasons: rejection.reasons.map((reason) => ({ ...reason })),
    dedupKey: rejection.dedupKey,
    batchSchemaVersion: rejection.batchSchemaVersion,
    rejectedAt: rejection.rejectedAt,
  };
}
