import { catalogSnapshot } from '../../core/catalog-snapshot';
import type { CatalogSnapshotDto, ErrorDto } from '../../core/dto';
import { isWhenkitError, type ErrorCode } from '../../core/errors';
import type {
  CatalogStore,
  Environment,
  FileSystem,
  OpenStoreOptions,
} from '../../core/ports';
import { catalogPath, resolveWorkspace } from '../../core/workspace';
import type { IpcResult } from '../../shared/ipc';

// The window's catalog (AD-10): opened once by main, for writing but without
// migrating, and read through core. Electron-free so tests can drive it.

export type DesktopCatalog =
  | { ok: true; store: CatalogStore }
  | { ok: false; code: ErrorCode };

export interface DesktopCatalogPorts {
  env: Environment;
  fs: FileSystem;
  openStore: (dbPath: string, options: OpenStoreOptions) => CatalogStore;
}

/** The code of a failure; anything but a WhenkitError is logged and is INTERNAL. */
function codeOf(error: unknown): ErrorCode {
  if (isWhenkitError(error)) return error.code;
  console.error(error);
  return 'INTERNAL';
}

/**
 * Resolves the workspace and opens its catalog without migrating (a pending
 * migration is a startup error shown by the window, never run by it). Never
 * throws.
 */
export function openDesktopCatalog({
  env,
  fs,
  openStore,
}: DesktopCatalogPorts): DesktopCatalog {
  try {
    const workspace = resolveWorkspace(env, fs);
    const store = openStore(catalogPath(fs, workspace), { migrate: false });
    return { ok: true, store };
  } catch (error) {
    return { ok: false, code: codeOf(error) };
  }
}

/** The `catalog:snapshot` answer for what startup opened. Never throws. */
export function snapshotResult(
  opened: DesktopCatalog,
): IpcResult<CatalogSnapshotDto> {
  const failure = (code: ErrorCode): { ok: false; error: ErrorDto } => ({
    ok: false,
    error: { code },
  });
  if (!opened.ok) return failure(opened.code);
  try {
    return { ok: true, data: catalogSnapshot(opened.store) };
  } catch (error) {
    return failure(codeOf(error));
  }
}
