import type {
  CatalogSnapshotDto,
  EntryDto,
  ErrorDto,
  SearchResultDto,
} from '../core/dto';

// The contract between the window's processes (AD-9, AD-18). Only types come
// from core, and only from core/dto.ts.

export type {
  CatalogSnapshotDto,
  CategoryDto,
  EntryDto,
  ErrorDto,
  SearchResultDto,
} from '../core/dto';

export const IPC_CHANNELS = {
  catalogSnapshot: 'catalog:snapshot',
  catalogChanged: 'catalog:changed',
  entriesSearch: 'entries:search',
  entriesSetNotes: 'entries:setNotes',
  entriesDelete: 'entries:delete',
  windowSetTheme: 'window:setTheme',
  shellOpenExternal: 'shell:openExternal',
  /** Main to renderer: save the pending notes now (AD-20). */
  windowFlushNotes: 'window:flushNotes',
  /** Renderer to main: the pending notes are saved (AD-20). */
  windowNotesFlushed: 'window:notesFlushed',
} as const;

/** The two themes of the window (AD-20). */
export type Theme = 'light' | 'dark';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/**
 * Whether `value` is a link the window may hand to the default browser
 * (AD-9): a parseable URL with the `http:` or `https:` scheme. Both the
 * renderer (to decide what is a link) and main (the security boundary, which
 * does not trust the renderer) use this one check.
 */
export function isExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
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
  /** Ids of entries the write removed from the database (a delete). */
  removed?: readonly string[];
}

/** The bridge preload exposes as `window.whenkit`. */
export interface WhenkitApi {
  /** The workspace main resolved at startup (AD-8); `null` when it could not. */
  workspacePath: string | null;
  catalogSnapshot(): Promise<IpcResult<CatalogSnapshotDto>>;
  /**
   * The ids of the entries (both zones) matching what the user typed, in
   * the order of the snapshot (AD-10). The text is plain words (AD-5).
   */
  searchEntries(text: string): Promise<IpcResult<SearchResultDto>>;
  /**
   * Replaces the author's notes of an entry (AD-16): no `expectedRevision`,
   * `revision` unchanged. Answers with the entry as stored (AD-10).
   */
  setNotes(id: string, notes: string): Promise<IpcResult<WriteResult>>;
  /**
   * Deletes an entry (AD-3): its links and categories go with it. `changed`
   * holds the entries it was linked to, `removed` the deleted id (AD-10).
   */
  deleteEntry(id: string): Promise<IpcResult<WriteResult>>;
  /**
   * Registers what saves the notes still pending when the window closes
   * (AD-20). Main asks through `window:flushNotes`; preload awaits `flush`
   * and then answers with `window:notesFlushed`. Returns the function that
   * stops listening.
   */
  onFlushNotes(flush: () => Promise<void>): () => void;
  /**
   * Calls `listener` whenever main saw the catalog change (AD-10); returns
   * the function that stops listening. The event carries no data: the
   * renderer reloads the snapshot.
   */
  onCatalogChanged(listener: () => void): () => void;
  setTheme(theme: Theme): Promise<IpcResult<null>>;
  /**
   * Opens `url` in the default browser (AD-9). Main refuses anything but
   * `http:`/`https:` with `ARGUMENTS_INVALID`; the window never navigates.
   */
  openExternal(url: string): Promise<IpcResult<null>>;
  /** Zooms the whole interface (preload `webFrame`; no IPC, nothing persisted). */
  setZoomFactor(factor: number): void;
}
