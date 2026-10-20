import { z } from 'zod';
import { RESOURCE_TYPES, ZONES } from './entry';
import { nameKey } from './name-key';
import { BATCH_SCHEMA_VERSION } from './versions';

// The import batch contract (AD-6), defined once: validation and the JSON
// Schema (batch-json-schema.ts) both derive from it. Every object is strict,
// so an unknown field (a typo, or an application field such as myNotes) makes
// the batch invalid instead of being dropped. Field names follow
// spec-whenkit/entry-model.md. A link target is the `ref` of another item of
// the batch or the id of an existing entry (UUID); the rules that need the
// whole batch run in the superRefine below, the ones that need the catalog in
// the import (core/import-batch.ts).

const text = z.string().trim().min(1);

/** The shape of every text field, shared with the edit schema (entry-patch.ts). */
export const nonBlankText = text;

/** True for the spelling of an entry id (the same check as `id`). */
export function isEntryId(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

const LINK_TARGET_RULE =
  'Each target is the ref of another item of this batch, or the id (UUID) of an existing entry; a ref wins when both could match. Never the item itself.';

/** Fields every item has, whatever its kind. */
const commonFields = {
  /** Unique within the batch; the report refers to items by it. */
  ref: text.describe(
    'Unique within the batch: two items with the same ref make the batch invalid.',
  ),
  /**
   * `add` creates an entry; `update` fully replaces the fields Claude writes
   * on the entry `id` (AD-6). The pairing of `op` and `id` is checked below.
   */
  op: z.enum(['add', 'update']),
  /**
   * The entry an `update` rewrites; an `add` has none. Lowercased, the form
   * the catalog stores, so lookup and the unique-id rule see one spelling.
   */
  id: z
    .uuid()
    .transform((id) => id.toLowerCase())
    .optional()
    .describe(
      'Required for op "update", forbidden for op "add". Each entry id may appear in at most one item of the batch.',
    ),
  /** The resource's original name. */
  name: text,
  /** 1–2 category names, matched by name_key in the zone of the kind. */
  categories: z.array(text).min(1).max(2),
  whatItDoes: text,
  /** "Când o folosesc" / "Când îl aleg". */
  situations: z.array(text).min(1),
  keywords: z.array(text).default([]),
  /**
   * Entries this one is related to (symmetric). An update replaces every
   * related link of its entry with this list.
   */
  related: z
    .array(text)
    .default([])
    .describe(
      `Related entries, symmetric; an update replaces all of them. ${LINK_TARGET_RULE}`,
    ),
  /** Claude's content verdict; when present the item is rejected. */
  flaggedByClaude: text.optional(),
};

const resourceFields = {
  url: text,
  resourceType: z.enum(RESOURCE_TYPES),
};

export const toolItemSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('tool'),
  ...resourceFields,
});

export const materialItemSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('material'),
  ...resourceFields,
});

export const conceptItemSchema = z.strictObject({
  ...commonFields,
  kind: z.literal('concept'),
  url: text.optional(),
  /** Markdown, tables included. */
  content: z.string().refine((value) => value.trim() !== '', {
    message: 'content must not be blank',
  }),
  sources: z.array(text).default([]),
  /**
   * The concepts that hang under this umbrella concept. Absent ≠ empty: an
   * update without `children` keeps its child links, `[]` removes them all.
   */
  children: z
    .array(text)
    .optional()
    .describe(
      `Child concepts of this umbrella. Absent keeps the existing child links of an update; [] removes them. Every target must be a concept; a ref must name a concept item of this batch. ${LINK_TARGET_RULE}`,
    ),
});

export const batchItemSchema = z.discriminatedUnion('kind', [
  toolItemSchema,
  materialItemSchema,
  conceptItemSchema,
]);

export const newCategorySchema = z.strictObject({
  zone: z.enum(ZONES),
  name: text,
});

export const batchSchema = z
  .strictObject({
    schemaVersion: z.literal(BATCH_SCHEMA_VERSION),
    items: z
      .array(batchItemSchema)
      .min(1)
      .describe(
        'Every item has a unique ref; an entry id appears in at most one item.',
      ),
    newCategories: z.array(newCategorySchema).default([]),
    proposedBlockedDomains: z.array(text).default([]),
  })
  .superRefine((batch, ctx) => {
    const refs = new Set<string>();
    const ids = new Set<string>();
    const kindOfRef = new Map(batch.items.map((item) => [item.ref, item.kind]));

    const checkTargets = (
      item: BatchItem,
      index: number,
      field: 'related' | 'children',
      targets: readonly string[],
    ) => {
      targets.forEach((target, position) => {
        const path = ['items', index, field, position];
        const kind = kindOfRef.get(target);
        if (kind !== undefined) {
          if (target === item.ref) {
            ctx.addIssue({
              code: 'custom',
              path,
              message: `"${target}" is the item itself`,
            });
          } else if (field === 'children' && kind !== 'concept') {
            ctx.addIssue({
              code: 'custom',
              path,
              message: `child "${target}" is not a concept`,
            });
          }
        } else if (!isEntryId(target)) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: `"${target}" is neither the ref of an item of this batch nor an entry id`,
          });
        } else if (item.id !== undefined && target.toLowerCase() === item.id) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: `"${target}" is the item itself`,
          });
        }
      });
    };

    batch.items.forEach((item, index) => {
      if (refs.has(item.ref)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'ref'],
          message: `duplicate ref "${item.ref}" in the batch`,
        });
      }
      refs.add(item.ref);

      if (item.op === 'update' && item.id === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'id'],
          message: 'an update needs the id of the entry it rewrites',
        });
      }
      if (item.op === 'add' && item.id !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'id'],
          message: 'an add has no id: the application generates it',
        });
      }
      // Two updates of one entry would contradict each other (AD-6).
      if (item.id !== undefined) {
        if (ids.has(item.id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', index, 'id'],
            message: `entry id "${item.id}" appears twice in the batch`,
          });
        }
        ids.add(item.id);
      }

      checkTargets(item, index, 'related', item.related);
      if (item.kind === 'concept' && item.children !== undefined) {
        checkTargets(item, index, 'children', item.children);
      }

      const keys = item.categories.map(nameKey);
      if (new Set(keys).size !== keys.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'categories'],
          message: 'the same category is listed twice',
        });
      }
    });
  });

export type Batch = z.infer<typeof batchSchema>;
export type BatchItem = z.infer<typeof batchItemSchema>;
export type NewCategory = z.infer<typeof newCategorySchema>;
