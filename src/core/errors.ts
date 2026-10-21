// Closed set of error codes (AD-18). Texts live in src/shared/strings.ro.ts;
// exit codes in src/cli/exit-codes.ts.

import type { VerdictReason } from './verification/reason-codes';

export const ERROR_CODES = [
  'WORKSPACE_NOT_CONFIGURED',
  'WORKSPACE_INSIDE_REPO',
  'CONFIG_INVALID',
  'CATALOG_NOT_FOUND',
  'ARGUMENTS_INVALID',
  'BATCH_INVALID',
  'BATCH_SCHEMA_OUTDATED',
  'ENTRY_NOT_FOUND',
  'ENTRY_REJECTED',
  'CONFLICT',
  'CATEGORY_NOT_FOUND',
  'CATEGORY_NAME_TAKEN',
  'CATEGORY_TARGET_REQUIRED',
  'REJECTION_NOT_FOUND',
  'MIGRATION_MISMATCH',
  'DATABASE_TOO_NEW',
  'DATABASE_NEEDS_MIGRATION',
  'DATABASE_BUSY',
  'OFFLINE',
  'EXPORT_WRITE_FAILED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * A technical detail of an error, e.g. one schema issue of an invalid batch.
 * The message is English: it helps fix the input, it is not interface text.
 */
export interface ErrorIssue {
  path: (string | number)[];
  message: string;
}

/** The issues of a failed zod parse as `ErrorIssue`s; JSON input never yields symbol keys. */
export function toErrorIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): ErrorIssue[] {
  return issues.map(({ path, message }) => ({
    path: path.map((key) => (typeof key === 'number' ? key : String(key))),
    message,
  }));
}

/**
 * A program or configuration error identified by its code. Expected outcomes
 * (verdicts, rejections) are values, never exceptions.
 */
export class WhenkitError extends Error {
  readonly code: ErrorCode;
  readonly issues: readonly ErrorIssue[] | undefined;
  /** Why an edit was rejected (ENTRY_REJECTED): the verdict's reasons (AD-15). */
  readonly reasons: readonly VerdictReason[] | undefined;

  constructor(
    code: ErrorCode,
    options?: {
      cause?: unknown;
      detail?: string;
      issues?: ErrorIssue[];
      reasons?: VerdictReason[];
    },
  ) {
    super(options?.detail ? `${code}: ${options.detail}` : code, {
      cause: options?.cause,
    });
    this.name = 'WhenkitError';
    this.code = code;
    this.issues = options?.issues;
    this.reasons = options?.reasons;
  }
}

export function isWhenkitError(value: unknown): value is WhenkitError {
  return value instanceof WhenkitError;
}

/** An invalid input, with every issue found; the detail joins their messages. */
export function issuesError(
  code: 'ARGUMENTS_INVALID' | 'BATCH_INVALID',
  issues: ErrorIssue[],
): WhenkitError {
  return new WhenkitError(code, {
    issues,
    detail: issues.map((issue) => issue.message).join('; '),
  });
}

/** A row that was just there and is gone inside the same transaction. */
export function vanishedError(
  what: 'entry' | 'category',
  id: string,
): WhenkitError {
  return new WhenkitError('INTERNAL', { detail: `${what} ${id} vanished` });
}
