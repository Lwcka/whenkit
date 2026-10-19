import type { CatalogSnapshotDto, ErrorDto } from '../core/dto';

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
  windowSetTheme: 'window:setTheme',
} as const;

/** The two themes of the window (AD-20). */
export type Theme = 'light' | 'dark';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Main hands the resolved theme to preload as `--whenkit-theme=<theme>`. */
export const THEME_ARGUMENT_PREFIX = '--whenkit-theme=';

/** The theme main put in the arguments of the renderer; `light` when absent. */
export function themeFromArgv(argv: readonly string[]): Theme {
  for (const argument of argv) {
    if (!argument.startsWith(THEME_ARGUMENT_PREFIX)) continue;
    const value = argument.slice(THEME_ARGUMENT_PREFIX.length);
    if (isTheme(value)) return value;
  }
  return 'light';
}

/** Handlers never throw: they answer with a value (AD-18). */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorDto };

/** The bridge preload exposes as `window.whenkit`. */
export interface WhenkitApi {
  /** The theme the window opened with, resolved by main (AD-20). */
  initialTheme: Theme;
  catalogSnapshot(): Promise<IpcResult<CatalogSnapshotDto>>;
  setTheme(theme: Theme): Promise<IpcResult<null>>;
}
