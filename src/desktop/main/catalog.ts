import { catalogSnapshot } from '../../core/catalog-snapshot';
import {
  deleteCategory,
  mergeCategories,
  renameCategory,
} from '../../core/categories';
import { deleteEntry } from '../../core/delete-entry';
import { exportCatalog, type ExportLabels } from '../../core/export-catalog';
import type {
  CatalogSnapshotDto,
  EntryPatch,
  ErrorDto,
  SearchResultDto,
} from '../../core/dto';
import { isWhenkitError, type ErrorCode } from '../../core/errors';
import { patchEntry } from '../../core/patch-entry';
import type {
  CatalogStore,
  Clock,
  Environment,
  FileSystem,
  GitHubClient,
  HttpClient,
  OpenStoreOptions,
} from '../../core/ports';
import { searchEntries } from '../../core/search-entries';
import { setNotes } from '../../core/set-notes';
import { catalogPath, resolveWorkspace } from '../../core/workspace';
import type { ExportResultDto, IpcResult, WriteResult } from '../../shared/ipc';
import { runWrite } from './catalog-watch';

// The window's catalog (AD-10): opened once by main, for writing but without
// migrating, and read through core. Electron-free so tests can drive it.

export type DesktopCatalog =
  | { ok: true; store: CatalogStore; workspace: string }
  | { ok: false; code: ErrorCode };

export interface DesktopCatalogPorts {
  env: Environment;
  fs: FileSystem;
  openStore: (dbPath: string, options: OpenStoreOptions) => CatalogStore;
  /** Where an unexpected (non-WhenkitError) failure is recorded; default console.error. */
  logError?: (error: unknown) => void;
}

/** The code of a failure; anything but a WhenkitError is logged and is INTERNAL. */
export function codeOf(
  error: unknown,
  logError: (error: unknown) => void,
): ErrorCode {
  if (isWhenkitError(error)) return error.code;
  try {
    logError(error);
  } catch {
    // Logging must not turn an answer into a throw (AD-18).
  }
  return 'INTERNAL';
}

/**
 * Resolves the workspace and opens its catalog without migrating (a pending
 * migration is a startup error shown by the window, never run by it). On
 * success the resolved workspace comes back too, for the status bar. Never
 * throws.
 */
export function openDesktopCatalog({
  env,
  fs,
  openStore,
  logError = console.error,
}: DesktopCatalogPorts): DesktopCatalog {
  try {
    const workspace = resolveWorkspace(env, fs);
    const store = openStore(catalogPath(fs, workspace), { migrate: false });
    return { ok: true, store, workspace };
  } catch (error) {
    return { ok: false, code: codeOf(error, logError) };
  }
}

/**
 * The error a handler answers with: the code, plus the reasons and issues a
 * WhenkitError carries, so the window can explain an edit that was refused.
 */
export function errorDtoOf(
  error: unknown,
  logError: (error: unknown) => void,
): ErrorDto {
  const code = codeOf(error, logError);
  if (!isWhenkitError(error)) return { code };
  return {
    code,
    ...(error.reasons === undefined || error.reasons.length === 0
      ? {}
      : { reasons: error.reasons.map((reason) => ({ ...reason })) }),
    ...(error.issues === undefined || error.issues.length === 0
      ? {}
      : {
          issues: error.issues.map(({ path, message }) => ({
            path: [...path],
            message,
          })),
        }),
  };
}

/** The failure answer of a handler (AD-18). */
export function failure(code: ErrorCode): { ok: false; error: ErrorDto } {
  return { ok: false, error: { code } };
}

/** The `catalog:snapshot` answer for what startup opened. Never throws. */
export function snapshotResult(
  opened: DesktopCatalog,
  logError: (error: unknown) => void = console.error,
): IpcResult<CatalogSnapshotDto> {
  if (!opened.ok) return failure(opened.code);
  try {
    return { ok: true, data: catalogSnapshot(opened.store) };
  } catch (error) {
    return failure(codeOf(error, logError));
  }
}

/** What `catalog:export` needs besides the store (AD-12, AD-13). */
export interface ExportDeps {
  fs: FileSystem;
  clock: Clock;
  /** The Romanian headings of the `.md` files, built from `strings.ro.ts`. */
  labels: ExportLabels;
}

/**
 * The `catalog:export` answer (CAP-13, AD-12, AD-18) once the user has
 * answered the folder dialog: `parentDir` is the chosen folder, or
 * `undefined` when the dialog was cancelled (then nothing is written and the
 * answer is `null`). The export only reads the catalog: it is not a write
 * (no `runWrite`, no `catalog:changed`). Never throws.
 */
export function exportCatalogResult(
  opened: DesktopCatalog,
  parentDir: string | undefined,
  deps: ExportDeps,
  logError: (error: unknown) => void = console.error,
): IpcResult<ExportResultDto | null> {
  if (!opened.ok) return failure(opened.code);
  if (parentDir === undefined) return { ok: true, data: null };
  try {
    return {
      ok: true,
      data: exportCatalog(opened.store, deps, {
        parentDir,
        labels: deps.labels,
      }),
    };
  } catch (error) {
    // codeOf logs only unexpected errors; the disk error behind a failed
    // write (EACCES, ENOSPC, …) is the only trace of why it failed (AD-19).
    if (isWhenkitError(error) && error.code === 'EXPORT_WRITE_FAILED') {
      try {
        logError(error.cause);
      } catch {
        // Logging must not turn an answer into a throw (AD-18).
      }
    }
    return failure(codeOf(error, logError));
  }
}

/**
 * The `shell:openExportFolder` answer (AD-9, AD-18). The renderer is not
 * trusted: only a folder this session exported (`exported`) is opened, so
 * the channel cannot open an arbitrary path. `open` is `shell.openPath`,
 * which answers with an error string, empty on success. Never throws.
 */
export async function openExportFolderResult(
  path: unknown,
  exported: ReadonlySet<string>,
  open: (path: string) => Promise<string>,
  logError: (error: unknown) => void = console.error,
): Promise<IpcResult<null>> {
  if (typeof path !== 'string' || !exported.has(path)) {
    return failure('ARGUMENTS_INVALID');
  }
  try {
    const problem = await open(path);
    if (problem !== '') throw new Error(problem);
    return { ok: true, data: null };
  } catch (error) {
    return failure(codeOf(error, logError));
  }
}

/**
 * The `entries:search` answer (AD-10, AD-18): the ids matching `text`. Text
 * that is not a string is `ARGUMENTS_INVALID`. Never throws.
 */
export function searchResult(
  opened: DesktopCatalog,
  text: unknown,
  logError: (error: unknown) => void = console.error,
): IpcResult<SearchResultDto> {
  if (typeof text !== 'string') return failure('ARGUMENTS_INVALID');
  if (!opened.ok) return failure(opened.code);
  try {
    return { ok: true, data: searchEntries(opened.store, text) };
  } catch (error) {
    return failure(codeOf(error, logError));
  }
}

/**
 * The `entries:setNotes` answer (AD-16, AD-18): replaces the notes of an
 * entry and answers with the entry as stored. An id or text that is not a
 * string is `ARGUMENTS_INVALID`. After the write `emit` tells the window
 * (AD-10). Never throws.
 */
export function setNotesResult(
  opened: DesktopCatalog,
  id: unknown,
  notes: unknown,
  emit: () => void,
  logError: (error: unknown) => void = console.error,
): Promise<IpcResult<WriteResult>> {
  if (typeof id !== 'string' || typeof notes !== 'string') {
    return Promise.resolve(failure('ARGUMENTS_INVALID'));
  }
  return runWrite(
    opened,
    (store) => ({ changed: [setNotes(store, id, notes)] }),
    emit,
    logError,
  );
}

/**
 * The `entries:delete` answer (AD-3, AD-10, AD-18): deletes an entry with its
 * links and answers with the entries it was linked to (`changed`) and the
 * deleted id (`removed`). An id that is not a string is `ARGUMENTS_INVALID`.
 * After the write `emit` tells the window. Never throws.
 */
export function deleteEntryResult(
  opened: DesktopCatalog,
  id: unknown,
  emit: () => void,
  logError: (error: unknown) => void = console.error,
): Promise<IpcResult<WriteResult>> {
  if (typeof id !== 'string') {
    return Promise.resolve(failure('ARGUMENTS_INVALID'));
  }
  return runWrite(
    opened,
    (store) => {
      const { removed, changed } = deleteEntry(store, id);
      return { changed, removed: [removed] };
    },
    emit,
    logError,
  );
}

/**
 * The `categories:rename` answer (AD-3, AD-5, AD-18): renames a category and
 * answers with the entries that carry it and the full category list. Ids and
 * names that are not strings are `ARGUMENTS_INVALID`. After the write `emit`
 * tells the window. Never throws.
 */
export function renameCategoryResult(
  opened: DesktopCatalog,
  id: unknown,
  name: unknown,
  emit: () => void,
  logError: (error: unknown) => void = console.error,
): Promise<IpcResult<WriteResult>> {
  if (typeof id !== 'string' || typeof name !== 'string') {
    return Promise.resolve(failure('ARGUMENTS_INVALID'));
  }
  return runWrite(
    opened,
    (store) => renameCategory(store, { id, name }),
    emit,
    logError,
  );
}

/**
 * The `categories:merge` answer (AD-3, AD-5, AD-18): merges the source into
 * the target of the same zone. Ids that are not strings are
 * `ARGUMENTS_INVALID`. After the write `emit` tells the window. Never throws.
 */
export function mergeCategoriesResult(
  opened: DesktopCatalog,
  sourceId: unknown,
  targetId: unknown,
  emit: () => void,
  logError: (error: unknown) => void = console.error,
): Promise<IpcResult<WriteResult>> {
  if (typeof sourceId !== 'string' || typeof targetId !== 'string') {
    return Promise.resolve(failure('ARGUMENTS_INVALID'));
  }
  return runWrite(
    opened,
    (store) => mergeCategories(store, { sourceId, targetId }),
    emit,
    logError,
  );
}

/**
 * The `categories:delete` answer (AD-3, AD-5, AD-18): deletes a category,
 * merging its entries into `targetId` when one is given (required when some
 * entry has only this category). An id that is not a string, or a target that
 * is neither a string nor absent, is `ARGUMENTS_INVALID`. After the write
 * `emit` tells the window. Never throws.
 */
export function deleteCategoryResult(
  opened: DesktopCatalog,
  id: unknown,
  targetId: unknown,
  emit: () => void,
  logError: (error: unknown) => void = console.error,
): Promise<IpcResult<WriteResult>> {
  if (
    typeof id !== 'string' ||
    (targetId !== undefined &&
      targetId !== null &&
      typeof targetId !== 'string')
  ) {
    return Promise.resolve(failure('ARGUMENTS_INVALID'));
  }
  return runWrite(
    opened,
    (store) =>
      deleteCategory(store, {
        id,
        ...(typeof targetId === 'string' ? { targetId } : {}),
      }),
    emit,
    logError,
  );
}

/** What `entries:patch` needs besides the store: the real adapters (AD-2). */
export interface PatchEntryDeps {
  http: HttpClient;
  github: GitHubClient;
  clock: Clock;
  /** The workspace's blocked-domain rules, read on every patch. */
  readBlockedDomains: (workspace: string) => string[];
  /** Pause before a link check is retried; the verification default when unset. */
  retryDelayMs?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The `entries:patch` answer (AD-3, AD-16, AD-18): edits the fields of an
 * entry through core's patchEntry and answers with the entry as stored. A
 * payload that is not `{ id: string, expectedRevision: integer, changes }` is
 * `ARGUMENTS_INVALID`; core validates `changes`. A refused edit keeps its
 * reasons or issues in the error. After the write `emit` tells the window
 * (AD-10). Never throws.
 */
export function patchEntryResult(
  opened: DesktopCatalog,
  input: unknown,
  deps: PatchEntryDeps,
  emit: () => void,
  logError: (error: unknown) => void = console.error,
): Promise<IpcResult<WriteResult>> {
  if (
    !isPlainObject(input) ||
    typeof input.id !== 'string' ||
    typeof input.expectedRevision !== 'number' ||
    !Number.isInteger(input.expectedRevision)
  ) {
    return Promise.resolve(failure('ARGUMENTS_INVALID'));
  }
  const { id, expectedRevision, changes } = input as {
    id: string;
    expectedRevision: number;
    changes: unknown;
  };
  if (!opened.ok) return Promise.resolve(failure(opened.code));
  const { workspace } = opened;
  return runWrite(
    opened,
    async (store) => ({
      changed: [
        await patchEntry(
          store,
          {
            verification: () => ({
              http: deps.http,
              github: deps.github,
              blockedDomains: deps.readBlockedDomains(workspace),
              retryDelayMs: deps.retryDelayMs,
              now: deps.clock.now(),
            }),
            clock: deps.clock,
          },
          { id, expectedRevision, changes: changes as EntryPatch },
        ),
      ],
    }),
    emit,
    logError,
  );
}
