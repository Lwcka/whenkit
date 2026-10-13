import { z } from 'zod';
import { ZONES } from './entry';
import { verdictReasonSchema } from './verification/reason-codes';
import { IMPORT_REPORT_VERSION } from './versions';

// The import report (AD-14): what `whenkit import --json` prints and what
// its text output is rendered from. Every batch item appears exactly once.

export const IMPORT_OUTCOMES = [
  'added',
  'updated',
  'warned',
  'rejected',
  'duplicate',
] as const;

export type ImportOutcome = (typeof IMPORT_OUTCOMES)[number];

export const reportItemSchema = z.strictObject({
  ref: z.string(),
  op: z.enum(['add', 'update']),
  outcome: z.enum(IMPORT_OUTCOMES),
  /** The entry written (added, updated, warned). */
  id: z.string().optional(),
  /** The catalog entry this item duplicates. */
  duplicateOfId: z.string().optional(),
  reasons: z.array(verdictReasonSchema),
});

export type ReportItem = z.infer<typeof reportItemSchema>;

export const reportCategorySchema = z.strictObject({
  id: z.string(),
  zone: z.enum(ZONES),
  name: z.string(),
  /** False when the declared category already existed and was reused. */
  created: z.boolean(),
});

export type ReportCategory = z.infer<typeof reportCategorySchema>;

export const importReportSchema = z.strictObject({
  schemaVersion: z.literal(IMPORT_REPORT_VERSION),
  workspace: z.string(),
  items: z.array(reportItemSchema),
  newCategories: z.array(reportCategorySchema),
  /** Links to rejected items; always empty until links exist (ticket 7). */
  ignoredLinks: z.array(
    z.strictObject({
      fromRef: z.string(),
      to: z.string(),
      reason: verdictReasonSchema,
    }),
  ),
  proposedBlockedDomains: z.array(z.string()),
});

export type ImportReport = z.infer<typeof importReportSchema>;
