// Closed set of error codes (AD-18). Texts live in src/shared/strings.ro.ts;
// exit codes in src/cli/exit-codes.ts.

export const ERROR_CODES = [
  'WORKSPACE_NOT_CONFIGURED',
  'WORKSPACE_INSIDE_REPO',
  'CONFIG_INVALID',
  'CATALOG_NOT_FOUND',
  'ARGUMENTS_INVALID',
  'BATCH_INVALID',
  'BATCH_SCHEMA_OUTDATED',
  'ENTRY_NOT_FOUND',
  'REJECTION_NOT_FOUND',
  'MIGRATION_MISMATCH',
  'DATABASE_TOO_NEW',
  'DATABASE_NEEDS_MIGRATION',
  'DATABASE_BUSY',
  'OFFLINE',
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

/**
 * A program or configuration error identified by its code. Expected outcomes
 * (verdicts, rejections) are values, never exceptions.
 */
export class WhenkitError extends Error {
  readonly code: ErrorCode;
  readonly issues: readonly ErrorIssue[] | undefined;

  constructor(
    code: ErrorCode,
    options?: { cause?: unknown; detail?: string; issues?: ErrorIssue[] },
  ) {
    super(options?.detail ? `${code}: ${options.detail}` : code, {
      cause: options?.cause,
    });
    this.name = 'WhenkitError';
    this.code = code;
    this.issues = options?.issues;
  }
}

export function isWhenkitError(value: unknown): value is WhenkitError {
  return value instanceof WhenkitError;
}
