import type { ErrorCode } from '../core/errors';

// Process exit codes of the CLI contract (AD-11). The only ErrorCode → exit
// code mapping; anything that is not a WhenkitError exits with INTERNAL.
// On every non-zero exit nothing was written.

export const EXIT_OK = 0;
/** Invalid input: unknown command or option, invalid batch, unknown id. */
export const EXIT_INVALID_INPUT = 1;
export const EXIT_CONFIG = 2;
export const EXIT_UNAVAILABLE = 3;
export const EXIT_INTERNAL = 4;

export const exitCodeFor: Record<ErrorCode, number> = {
  WORKSPACE_NOT_CONFIGURED: EXIT_CONFIG,
  WORKSPACE_INSIDE_REPO: EXIT_CONFIG,
  CONFIG_INVALID: EXIT_CONFIG,
  CATALOG_NOT_FOUND: EXIT_CONFIG,
  ARGUMENTS_INVALID: EXIT_INVALID_INPUT,
  BATCH_INVALID: EXIT_INVALID_INPUT,
  BATCH_SCHEMA_OUTDATED: EXIT_INVALID_INPUT,
  ENTRY_NOT_FOUND: EXIT_INVALID_INPUT,
  MIGRATION_MISMATCH: EXIT_UNAVAILABLE,
  DATABASE_TOO_NEW: EXIT_UNAVAILABLE,
  DATABASE_NEEDS_MIGRATION: EXIT_UNAVAILABLE,
  DATABASE_BUSY: EXIT_UNAVAILABLE,
  INTERNAL: EXIT_INTERNAL,
};
