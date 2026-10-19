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
} as const;

/** Handlers never throw: they answer with a value (AD-18). */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorDto };

/** The bridge preload exposes as `window.whenkit`. */
export interface WhenkitApi {
  catalogSnapshot(): Promise<IpcResult<CatalogSnapshotDto>>;
}
