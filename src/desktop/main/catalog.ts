import { catalogSnapshot } from '../../core/catalog-snapshot';
import { deleteEntry } from '../../core/delete-entry';
import type {
  CatalogSnapshotDto,
  ErrorDto,
  SearchResultDto,
} from '../../core/dto';
import { isWhenkitError, type ErrorCode } from '../../core/errors';
import type {
  CatalogStore,
  Environment,
  FileSystem,
  OpenStoreOptions,
} from '../../core/ports';
import { searchEntries } from '../../core/search-entries';
import { setNotes } from '../../core/set-notes';
import { catalogPath, resolveWorkspace } from '../../core/workspace';
import type { IpcResult, WriteResult } from '../../shared/ipc';
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
