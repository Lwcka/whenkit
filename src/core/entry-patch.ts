import { z } from 'zod';
import { nonBlankText } from './batch-schema';
import { RESOURCE_TYPES } from './entry';

// The fields the window may edit (AD-16, `entries:patch`): the ones Claude
// writes, minus `kind`, links and anything the application computes. Every
// field is optional and the object is strict, so a field outside the list
// (`myNotes`, `kind`, `verifiedAt`, a typo) is invalid instead of dropped. The
// rules that depend on the stored kind are checked in patchEntry.

export const entryPatchSchema = z.strictObject({
  name: nonBlankText.optional(),
  /** `null` removes a concept's link; a tool or material always has one. */
  url: nonBlankText.nullable().optional(),
  resourceType: z.enum(RESOURCE_TYPES).optional(),
  whatItDoes: nonBlankText.optional(),
  situations: z.array(nonBlankText).min(1).optional(),
  keywords: z.array(nonBlankText).optional(),
  /** Concepts only. */
  sources: z.array(nonBlankText).optional(),
  /** Concepts only; Markdown. */
  content: z
    .string()
    .refine((value) => value.trim() !== '', {
      message: 'content must not be blank',
    })
    .optional(),
  /** 1–2 ids of existing categories of the entry's zone. */
  categoryIds: z
    .array(z.string().min(1))
    .min(1)
    .max(2)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'the same category is listed twice',
    })
    .optional(),
});

export type EntryPatch = z.input<typeof entryPatchSchema>;

/** What the window sends to `entries:patch` (AD-16). */
export interface EntryPatchInput {
  id: string;
  /** The revision the form was opened on (or last reloaded to). */
  expectedRevision: number;
  changes: EntryPatch;
}
