// One version constant per external or persistent format (conventions).

/** Format of %APPDATA%\whenkit\config.json. */
export const CONFIG_VERSION = 1;

/** Format of the import batch written by /importa (AD-6). */
export const BATCH_SCHEMA_VERSION = 1;

/** Format of the import report printed by `whenkit import --json` (AD-14). */
export const IMPORT_REPORT_VERSION = 1;

/** Format of the other `--json` outputs: list, show, rejections, categories and errors (AD-14). */
export const CLI_OUTPUT_VERSION = 1;

/**
 * Version of the files `whenkit init` copies into the workspace (AD-17).
 * Bump it whenever `workspace-template/` changes; a workspace marked with a
 * lower number is reported as outdated.
 */
export const TEMPLATE_VERSION = 7;

/** Format of `window-state.json` in the desktop userData folder (AD-20). */
export const WINDOW_STATE_VERSION = 1;
