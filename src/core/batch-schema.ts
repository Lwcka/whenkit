import { z } from 'zod';
import { RESOURCE_TYPES, ZONES } from './entry';
import { nameKey } from './name-key';
import { BATCH_SCHEMA_VERSION } from './versions';

// The import batch contract (AD-6), defined once: validation and, from
// ticket 7, the JSON Schema both derive from it. Every object is strict, so
// an unknown field (a typo, or an application field such as myNotes) makes
// the batch invalid instead of being dropped. Field names follow
// spec-whenkit/entry-model.md. Link fields (`related`, `children`) arrive
// with the ticket that processes them.

const text = z.string().trim().min(1);

/** Fields every item has, whatever its kind. */
const commonFields = {
  /** Unique within the batch; the report refers to items by it. */
  ref: text,
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
    .optional(),
  /** The resource's original name. */
  name: text,
  /** 1–2 category names, matched by name_key in the zone of the kind. */
  categories: z.array(text).min(1).max(2),
  whatItDoes: text,
  /** "Când o folosesc" / "Când îl aleg". */
  situations: z.array(text).min(1),
  keywords: z.array(text).default([]),
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
    items: z.array(batchItemSchema).min(1),
    newCategories: z.array(newCategorySchema).default([]),
    proposedBlockedDomains: z.array(text).default([]),
  })
  .superRefine((batch, ctx) => {
    const refs = new Set<string>();
    const ids = new Set<string>();
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
