import { z } from 'zod';

// Closed set of reason codes (AD-15). A reason is data: its Romanian text
// lives in src/shared/strings.ro.ts, keyed by code. The params each code
// carries are listed next to it.

export const REASON_CODES = [
  /** `{ id }`: an update names an entry that is not in the catalog. */
  'unknown_id',
  /** `{ name }`: a category neither in the item's zone nor declared. */
  'unknown_category',
  /** `{ text }`: Claude's content verdict, kept as written. */
  'flagged_by_claude',
  /** `{ ref }` for a repeat within the batch; none for a catalog duplicate. */
  'duplicate',
  /** The link is not an http(s) URL. */
  'invalid_url',
  /** `{ status }`: 404, 410 or another 4xx that is not 401/403/429. */
  'http_error',
  /** The link's domain does not exist. */
  'dns_not_found',
  /** The site's TLS certificate is invalid. */
  'tls_error',
  /** Refused or reset connection, or a broken redirect chain. */
  'connection_error',
  /** A note: the site answered 401, 403 or 429 to the check. */
  'blocks_automation',
  /** A warning: 5xx or timeout after the retries; `{ url }` for a source. */
  'no_response_at_import',
  /** `{ domain }`: the submitted or final URL matches this blocked rule. */
  'blocked_domain',
  /** A warning, `{ url }`: a dead or invalid source was removed. */
  'source_link_removed',
  /** `{ url, domain }`: a source matches a blocked rule; rejects the concept. */
  'source_blocked_domain',
  /** `{ ref }`: a link target is a batch item that was not written. */
  'link_target_not_written',
  /** `{ id }`: a parent link needs a concept, and this entry is not one. */
  'parent_requires_concept',
  /** `{ id }`: the child already is an ancestor of the parent. */
  'parent_cycle',
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export const verdictReasonSchema = z.strictObject({
  code: z.enum(REASON_CODES),
  params: z.record(z.string(), z.string()).optional(),
});

/** Why an item got its outcome, e.g. `{ code: 'unknown_category', params: { name } }`. */
export type VerdictReason = z.infer<typeof verdictReasonSchema>;
