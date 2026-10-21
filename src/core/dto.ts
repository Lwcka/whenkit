import { z } from 'zod';
import { ERROR_CODES } from './errors';
import { ENTRY_KINDS, RESOURCE_TYPES, ZONES, zoneOf } from './entry';
import { EXPORT_VERSION } from './versions';
import type {
  StoredCategory,
  StoredEntry,
  StoredEntrySummary,
  StoredRejection,
} from './ports';
import { verdictReasonSchema } from './verification/reason-codes';

export type { EntryPatch, EntryPatchInput } from './entry-patch';

// The one set of DTOs (AD-18) that `--json`, IPC and the export share: plain
// objects, dates as ISO strings. Links appear as id lists on the entry and,
// in the export, once each as a LinkDto.

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

/**
 * One link between two entries (AD-5), as `catalog.json` lists it: a
 * `related` link canonical (`fromId < toId`), a `parent` link from the
 * umbrella to its child.
 */
export const linkDtoSchema = z.strictObject({
  type: z.enum(['related', 'parent']),
  fromId: z.string(),
  toId: z.string(),
});

export type LinkDto = z.infer<typeof linkDtoSchema>;

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

/** What the window shows at startup: every entry of both zones and every category. */
export const catalogSnapshotDtoSchema = z.strictObject({
  entries: z.array(entryDtoSchema),
  categories: z.array(categoryDtoSchema),
});

export type CatalogSnapshotDto = z.infer<typeof catalogSnapshotDtoSchema>;

/** `catalog.json` of an export (AD-12): the whole catalog, nothing left out. */
export const catalogExportSchema = z.strictObject({
  schemaVersion: z.literal(EXPORT_VERSION),
  exportedAt: z.string(),
  entries: z.array(entryDtoSchema),
  categories: z.array(categoryDtoSchema),
  links: z.array(linkDtoSchema),
});

export type CatalogExport = z.infer<typeof catalogExportSchema>;

/** What a search answers with (AD-10): the ids only, in display order, both zones. */
export const searchResultDtoSchema = z.strictObject({
  ids: z.array(z.string()),
});

export type SearchResultDto = z.infer<typeof searchResultDtoSchema>;

/**
 * An error as it crosses IPC: the code, plus the data a form needs to explain
 * it; the interface owns the text (AD-18). `reasons` (ENTRY_REJECTED) are
 * the verdict's codes (AD-15); `issues` (ARGUMENTS_INVALID) name the fields.
 */
export const errorDtoSchema = z.strictObject({
  code: z.enum(ERROR_CODES),
  reasons: z.array(verdictReasonSchema).optional(),
  issues: z
    .array(
      z.strictObject({
        path: z.array(z.union([z.string(), z.number()])),
        message: z.string(),
      }),
    )
    .optional(),
});

export type ErrorDto = z.infer<typeof errorDtoSchema>;

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
