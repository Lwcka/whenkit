// Closed set of error codes (AD-18). Texts live in src/shared/strings.ro.ts;
// exit codes in src/cli/exit-codes.ts.

export const ERROR_CODES = [
  'WORKSPACE_NOT_CONFIGURED',
  'WORKSPACE_INSIDE_REPO',
  'CONFIG_INVALID',
  'MIGRATION_MISMATCH',
  'DATABASE_TOO_NEW',
  'DATABASE_BUSY',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * A program or configuration error identified by its code. Expected outcomes
 * (verdicts, rejections) are values, never exceptions.
 */
export class WhenkitError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, options?: { cause?: unknown; detail?: string }) {
    super(options?.detail ? `${code}: ${options.detail}` : code, {
      cause: options?.cause,
    });
    this.name = 'WhenkitError';
    this.code = code;
  }
}

export function isWhenkitError(value: unknown): value is WhenkitError {
  return value instanceof WhenkitError;
}
