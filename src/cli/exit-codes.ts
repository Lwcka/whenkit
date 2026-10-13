import type { ErrorCode } from '../core/errors';

// Process exit codes of the CLI contract (AD-11). The only ErrorCode → exit
// code mapping; anything that is not a WhenkitError exits with INTERNAL.

export const EXIT_OK = 0;
/** Invalid input (unknown command, bad arguments; later: invalid batch). */
export const EXIT_INVALID_INPUT = 1;
export const EXIT_CONFIG = 2;
export const EXIT_UNAVAILABLE = 3;
export const EXIT_INTERNAL = 4;

export const exitCodeFor: Record<ErrorCode, number> = {
  WORKSPACE_NOT_CONFIGURED: EXIT_CONFIG,
  WORKSPACE_INSIDE_REPO: EXIT_CONFIG,
  CONFIG_INVALID: EXIT_CONFIG,
  MIGRATION_MISMATCH: EXIT_UNAVAILABLE,
  DATABASE_TOO_NEW: EXIT_UNAVAILABLE,
  DATABASE_BUSY: EXIT_UNAVAILABLE,
  INTERNAL: EXIT_INTERNAL,
};
