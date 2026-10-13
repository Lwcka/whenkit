// Ports: every effect core needs from the outside world (AD-2). Adapters in
// src/adapters implement them and the drivers (cli, desktop/main) inject them.
// HttpClient and GitHubClient arrive with the tickets that need them.

import type { Zone } from './category-seed';
import type { EntryKind, ResourceType } from './entry';
import type { VerdictReason } from './verification/reason-codes';

/** Source of the current moment; timestamps are stored as `toISOString()`. */
export interface Clock {
  now(): Date;
}

/** Generates entity ids (UUID v4). */
export interface IdGenerator {
  newId(): string;
}

/** Read-only view of the process environment. */
export interface Environment {
  /** Value of an environment variable, or undefined when it is not set. */
  get(name: string): string | undefined;
  /** Absolute path of the application's own folder (the repo in development). */
  appRoot(): string;
}

/** Synchronous file-system access with UTF-8 text files. */
export interface FileSystem {
  exists(path: string): boolean;
  /** Creates the directory and any missing parents; no-op when it exists. */
  mkdir(path: string): void;
  readText(path: string): string;
  writeText(path: string, text: string): void;
  joinPath(...parts: string[]): string;
}

/** A category row, in camelCase. */
export interface StoredCategory {
  id: string;
  zone: Zone;
  name: string;
  nameKey: string;
}

/** An entry row with its categories, in camelCase (AD-5). */
export interface StoredEntry {
  id: string;
  ownerId: string;
  kind: EntryKind;
  name: string;
  url: string | null;
  resourceType: ResourceType | null;
  /** Ordered by name_key. */
  categories: StoredCategory[];
  whatItDoes: string;
  situations: string[];
  keywords: string[];
  sources: string[];
  content: string | null;
  myNotes: string;
  githubStars: number | null;
  githubPushedAt: string | null;
  githubArchived: boolean | null;
  verificationNotes: VerdictReason[];
  forced: boolean;
  dedupKey: string;
  revision: number;
  addedAt: string;
  verifiedAt: string | null;
}

/** An entry without its (possibly long) `content`. */
export type StoredEntrySummary = Omit<StoredEntry, 'content'>;

/** What core writes when it adds an entry; the store fills `owner_id`. */
export interface NewEntryRow {
  id: string;
  kind: EntryKind;
  name: string;
  url: string | null;
  resourceType: ResourceType | null;
  whatItDoes: string;
  situations: string[];
  keywords: string[];
  sources: string[];
  content: string | null;
  verificationNotes: VerdictReason[];
  dedupKey: string;
  addedAt: string;
  verifiedAt: string | null;
}

/** What core writes when it creates a category; the store fills `owner_id`. */
export type NewCategoryRow = StoredCategory;

/** Reads of the catalog, always scoped to the store's owner. */
export interface CatalogReader {
  categoriesInZone(zone: Zone): StoredCategory[];
  entryById(id: string): StoredEntry | undefined;
  /** Every entry without `content`, oldest first. */
  entrySummaries(): StoredEntrySummary[];
  entryIdByDedupKey(dedupKey: string): string | undefined;
}

/** Reads and writes inside one write transaction. */
export interface CatalogWriter extends CatalogReader {
  insertCategory(category: NewCategoryRow): void;
  insertEntry(entry: NewEntryRow): void;
  addEntryCategory(entryId: string, categoryId: string): void;
}

/** The catalog database. Grows with the use cases that need it. */
export interface CatalogStore extends CatalogReader {
  /** The single owner of every row, created on the first open (AD-5). */
  ownerId(): string;
  /** Highest applied migration version. */
  schemaVersion(): number;
  /**
   * Runs `fn` in one `BEGIN IMMEDIATE` transaction: commits when it returns,
   * rolls back and rethrows when it throws. Refused on a read-only store.
   */
  writeTransaction<T>(fn: (writer: CatalogWriter) => T): T;
  close(): void;
}

export interface OpenStoreOptions {
  /** Create the database file when it is missing (only `whenkit init`). */
  create?: boolean;
  /**
   * Open without writing: no migrations, and a database with pending ones is
   * refused (DATABASE_NEEDS_MIGRATION). For the read commands.
   */
  readOnly?: boolean;
}

/**
 * Opens the catalog at a file path. Without `create`, a missing file is
 * refused (CATALOG_NOT_FOUND); without `readOnly`, it is migrated.
 */
export type CatalogStoreOpener = (
  dbPath: string,
  options?: OpenStoreOptions,
) => CatalogStore;
