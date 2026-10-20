import type { CatalogSnapshotDto, EntryDto, ErrorDto } from '../core/dto';

// The contract between the window's processes (AD-9, AD-18). Only types come
// from core, and only from core/dto.ts.

export type {
  CatalogSnapshotDto,
  CategoryDto,
  EntryDto,
  ErrorDto,
} from '../core/dto';

export const IPC_CHANNELS = {
  catalogSnapshot: 'catalog:snapshot',
  catalogChanged: 'catalog:changed',
  windowSetTheme: 'window:setTheme',
} as const;

/** The two themes of the window (AD-20). */
export type Theme = 'light' | 'dark';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Main hands the resolved workspace to preload as `--whenkit-workspace=<path>`. */
export const WORKSPACE_ARGUMENT_PREFIX = '--whenkit-workspace=';

/** The workspace main put in the arguments of the renderer; `null` when absent. */
export function workspaceFromArgv(argv: readonly string[]): string | null {
  for (const argument of argv) {
    if (!argument.startsWith(WORKSPACE_ARGUMENT_PREFIX)) continue;
    const value = argument.slice(WORKSPACE_ARGUMENT_PREFIX.length);
    if (value !== '') return value;
  }
  return null;
}

/** Handlers never throw: they answer with a value (AD-18). */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorDto };

/**
 * What every write answers with (AD-10): the entries it changed, as the
 * database now holds them, so the renderer's store applies them before the
 * next comparison and the user's own edits never look like terminal ones.
 */
export interface WriteResult {
  changed: readonly EntryDto[];
}

/** The bridge preload exposes as `window.whenkit`. */
export interface WhenkitApi {
  /** The workspace main resolved at startup (AD-8); `null` when it could not. */
  workspacePath: string | null;
  catalogSnapshot(): Promise<IpcResult<CatalogSnapshotDto>>;
  /**
   * Calls `listener` whenever main saw the catalog change (AD-10); returns
   * the function that stops listening. The event carries no data: the
   * renderer reloads the snapshot.
   */
  onCatalogChanged(listener: () => void): () => void;
  setTheme(theme: Theme): Promise<IpcResult<null>>;
  /** Zooms the whole interface (preload `webFrame`; no IPC, nothing persisted). */
  setZoomFactor(factor: number): void;
}
