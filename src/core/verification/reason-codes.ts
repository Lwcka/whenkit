import { z } from 'zod';

// Closed set of reason codes (AD-15). A reason is data: its Romanian text
// lives in src/shared/strings.ro.ts, keyed by code. Ticket 5 adds the
// verification codes.

export const REASON_CODES = [
  'unknown_category',
  'flagged_by_claude',
  'duplicate',
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export const verdictReasonSchema = z.strictObject({
  code: z.enum(REASON_CODES),
  params: z.record(z.string(), z.string()).optional(),
});

/** Why an item got its outcome, e.g. `{ code: 'unknown_category', params: { name } }`. */
export type VerdictReason = z.infer<typeof verdictReasonSchema>;
