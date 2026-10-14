// Ports: every effect core needs from the outside world (AD-2). Adapters in
// src/adapters implement them and the drivers (cli, desktop/main) inject them.

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

/**
 * What happened when a link was opened (AD-7). A closed union: every network
 * outcome is a value, so verification never handles exceptions for them.
 * `finalUrl` is the URL that gave the status, after following redirects.
 * `lastUrl` is the last URL the check was requesting when it failed (a
 * redirect target included), so the blocked-domain rule still sees it.
 */
export type HttpResult =
  /** Final status below 400 (2xx, or a 3xx that is not followed). */
  | { kind: 'ok'; status: number; finalUrl: string }
  /** Final status 400 or above. */
  | { kind: 'httpError'; status: number; finalUrl: string }
  /** The host name does not exist, while DNS itself works. */
  | { kind: 'dnsNotFound'; lastUrl: string }
  /** The TLS handshake failed: invalid, expired or self-signed certificate. */
  | { kind: 'tlsError'; lastUrl: string }
  /** No answer within the time limit. */
  | { kind: 'timeout'; lastUrl: string }
  /**
   * Refused or reset connection, too many redirects, a redirect to a
   * non-http(s) URL (then `lastUrl` is that target), or a URL that is not
   * http(s) at all (then `lastUrl` is the input as given).
   */
  | { kind: 'connectionError'; lastUrl: string }
  /** No network: the machine cannot reach DNS or the internet. */
  | { kind: 'offline' };

/** Opens a link and reports what happened; never throws for network outcomes. */
export interface HttpClient {
  check(url: string): Promise<HttpResult>;
}

/**
 * What the GitHub API said about a repository (AD-7). A closed union: every
 * outcome is a value. Only `ok` carries data; the others mean "no metadata"
 * and never reject an item.
 */
export type GitHubResult =
  /** `pushedAt` is the API's `pushed_at`; null for a repo never pushed to. */
  | { kind: 'ok'; stars: number; pushedAt: string | null; archived: boolean }
  /** The public rate limit is used up (403 with no requests left, or 429). */
  | { kind: 'rateLimited' }
  /** 404: the repo does not exist or is private. */
  | { kind: 'notFound' }
  /** Server error, timeout, network failure or an unreadable answer. */
  | { kind: 'failed' };

/** Reads repository metadata from GitHub; never throws. */
export interface GitHubClient {
  repo(owner: string, repo: string): Promise<GitHubResult>;
}

/** A category row, in camelCase. */
export interface StoredCategory {
  id: string;
  zone: Zone;
  name: string;
  nameKey: string;
}

/** The two kinds of link between entries (AD-5). */
export type LinkType = 'related' | 'parent';

/** An entry row with its categories and link ids, in camelCase (AD-5). */
export interface StoredEntry {
  id: string;
  ownerId: string;
  kind: EntryKind;
  name: string;
  url: string | null;
  resourceType: ResourceType | null;
  /** Ordered by name_key. */
  categories: StoredCategory[];
  /** Entries linked as `related`, either direction; sorted by id. */
  relatedIds: string[];
  /** Umbrella concepts this entry hangs under; sorted by id. */
  parentIds: string[];
  /** Concepts hanging under this umbrella; sorted by id. */
  childIds: string[];
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
  /** True when the author forced the entry past the verification (AD-7). */
  forced: boolean;
  /** GitHub metadata; all three null when the API did not answer (AD-7). */
  githubStars: number | null;
  githubPushedAt: string | null;
  githubArchived: boolean | null;
  addedAt: string;
  verifiedAt: string | null;
}

/**
 * What core writes when an update rewrites an entry (AD-6): every field
 * Claude writes, plus the recomputed verification and duplicate key. The
 * store also increments `revision`; it never touches `my_notes`, `owner_id`
 * or `added_at`, and `forced` only ever goes from false to true: a `false`
 * here keeps the stored value (the flag is sticky).
 */
export type EntryUpdateRow = Omit<NewEntryRow, 'addedAt'>;

/** What core writes when it creates a category; the store fills `owner_id`. */
export type NewCategoryRow = StoredCategory;

/**
 * A journaled rejection (AD-5): the batch element exactly as it passed the
 * schema, so it can be imported again as a batch item.
 */
export interface StoredRejection {
  id: string;
  op: 'add' | 'update';
  element: Record<string, unknown>;
  reasons: VerdictReason[];
  dedupKey: string;
  batchSchemaVersion: number;
  rejectedAt: string;
}

/** What core writes when it journals a rejection; the store fills `owner_id`. */
export type NewRejectionRow = StoredRejection;

/** Reads of the catalog, always scoped to the store's owner. */
export interface CatalogReader {
  categoriesInZone(zone: Zone): StoredCategory[];
  entryById(id: string): StoredEntry | undefined;
  /** Every entry without `content`, oldest first. */
  entrySummaries(): StoredEntrySummary[];
  entryIdByDedupKey(dedupKey: string): string | undefined;
  /** The umbrellas of an entry (`parent` links ending at it); sorted by id. */
  parentIdsOf(id: string): string[];
  /** The rejection journal, oldest first. */
  rejections(): StoredRejection[];
}

/** Reads and writes inside one write transaction. */
export interface CatalogWriter extends CatalogReader {
  insertCategory(category: NewCategoryRow): void;
  insertEntry(entry: NewEntryRow): void;
  addEntryCategory(entryId: string, categoryId: string): void;
  /**
   * Rewrites the entry `entry.id` and increments its revision (AD-5, AD-16).
   * Throws when the entry does not exist.
   */
  updateEntry(entry: EntryUpdateRow): void;
  /** Replaces every category of an entry with `categoryIds`. */
  replaceEntryCategories(entryId: string, categoryIds: readonly string[]): void;
  /**
   * Inserts a link; a `related` link is stored canonically (smaller id
   * first). Inserting a link that exists is a no-op. The caller guarantees the
   * rules the database cannot see: parent links join concepts, with no cycles.
   */
  insertLink(type: LinkType, fromId: string, toId: string): void;
  /** Removes every `related` link touching the entry. */
  deleteRelatedLinks(id: string): void;
  /** Removes the `parent` links from the umbrella to its children. */
  deleteChildLinks(parentId: string): void;
  /**
   * Removes every `parent` link touching the entry, as umbrella or as child,
   * and returns the ids of the entries on their other end (sorted, unique).
   */
  deleteParentLinks(id: string): string[];
  /**
   * Journals a rejection; replaces the rows with the same `dedupKey`, so the
   * journal holds one row per resource.
   */
  insertRejection(rejection: NewRejectionRow): void;
  /** Removes the journal rows with this `dedupKey` (it was written). */
  deleteRejections(dedupKey: string): void;
  /**
   * Removes the journaled `update` rows whose element targets this entry id:
   * a newer write of the entry makes retrying them harmful.
   */
  deleteUpdateRejections(entryId: string): void;
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
