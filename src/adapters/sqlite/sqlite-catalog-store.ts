import { existsSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { CATEGORY_SEED, type Zone } from '../../core/category-seed';
import type { EntryKind, ResourceType } from '../../core/entry';
import { WhenkitError, isWhenkitError } from '../../core/errors';
import { nameKey } from '../../core/name-key';
import type {
  CatalogStore,
  CatalogWriter,
  Clock,
  IdGenerator,
  NewCategoryRow,
  NewEntryRow,
  OpenStoreOptions,
  StoredCategory,
  StoredEntry,
  StoredEntrySummary,
} from '../../core/ports';
import type { VerdictReason } from '../../core/verification/reason-codes';
import {
  bundledMigrations,
  checkMigrated,
  migrate,
  type Migration,
} from './migrate';

// The only way to the catalog database (AD-4). snake_case ↔ camelCase
// mapping happens here and nowhere else.

export interface OpenCatalogStoreOptions extends OpenStoreOptions {
  clock: Clock;
  ids: IdGenerator;
  /** How long a write waits for another process's lock (≤ 2000 in main). */
  busyTimeoutMs: number;
  /** Replaces the bundled migrations; tests only. */
  migrations?: Migration[];
}

const SQLITE_BUSY = 5;
const SQLITE_LOCKED = 6;

function isBusy(error: unknown): boolean {
  const errcode = (error as { errcode?: unknown } | null)?.errcode;
  if (typeof errcode !== 'number') return false;
  // Extended result codes keep the primary code in the low byte.
  const primary = errcode & 0xff;
  return primary === SQLITE_BUSY || primary === SQLITE_LOCKED;
}

function toWhenkitError(error: unknown): unknown {
  if (isWhenkitError(error)) return error;
  if (isBusy(error)) return new WhenkitError('DATABASE_BUSY', { cause: error });
  return error;
}

/**
 * Hook of migration 0001: creates the single owner and seeds the start
 * categories, exactly once, in the migration's transaction (AD-5).
 */
function seedInitial(db: DatabaseSync, ids: IdGenerator): void {
  const ownerId = ids.newId();
  db.prepare('INSERT INTO meta (id, owner_id) VALUES (1, ?)').run(ownerId);
  const insert = db.prepare(
    'INSERT INTO categories (id, owner_id, zone, name, name_key) VALUES (?, ?, ?, ?, ?)',
  );
  for (const category of CATEGORY_SEED) {
    insert.run(
      ids.newId(),
      ownerId,
      category.zone,
      category.name,
      nameKey(category.name),
    );
  }
}

interface CategoryRow {
  id: string;
  zone: Zone;
  name: string;
  name_key: string;
}

interface EntryRow {
  id: string;
  owner_id: string;
  kind: EntryKind;
  name: string;
  url: string | null;
  resource_type: ResourceType | null;
  what_it_does: string;
  situations: string;
  keywords: string;
  sources: string;
  content?: string | null;
  my_notes: string;
  github_stars: number | null;
  github_pushed_at: string | null;
  github_archived: number | null;
  verification_notes: string;
  forced: number;
  dedup_key: string;
  revision: number;
  added_at: string;
  verified_at: string | null;
}

const SUMMARY_COLUMNS = `id, owner_id, kind, name, url, resource_type,
  what_it_does, situations, keywords, sources, my_notes, github_stars,
  github_pushed_at, github_archived, verification_notes, forced, dedup_key,
  revision, added_at, verified_at`;

function toCategory(row: CategoryRow): StoredCategory {
  return {
    id: row.id,
    zone: row.zone,
    name: row.name,
    nameKey: row.name_key,
  };
}

function toSummary(
  row: EntryRow,
  categories: StoredCategory[],
): StoredEntrySummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    kind: row.kind,
    name: row.name,
    url: row.url,
    resourceType: row.resource_type,
    categories,
    whatItDoes: row.what_it_does,
    situations: JSON.parse(row.situations) as string[],
    keywords: JSON.parse(row.keywords) as string[],
    sources: JSON.parse(row.sources) as string[],
    myNotes: row.my_notes,
    githubStars: row.github_stars,
    githubPushedAt: row.github_pushed_at,
    githubArchived:
      row.github_archived === null ? null : row.github_archived === 1,
    verificationNotes: JSON.parse(row.verification_notes) as VerdictReason[],
    forced: row.forced === 1,
    dedupKey: row.dedup_key,
    revision: row.revision,
    addedAt: row.added_at,
    verifiedAt: row.verified_at,
  };
}

class SqliteCatalogStore implements CatalogStore, CatalogWriter {
  constructor(
    private readonly db: DatabaseSync,
    private readonly owner: string,
    private readonly version: number,
    private readonly readOnly: boolean,
  ) {}

  ownerId(): string {
    return this.owner;
  }

  schemaVersion(): number {
    return this.version;
  }

  private all<T>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.db.prepare(sql).all(...params) as unknown as T[];
  }

  private get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.db.prepare(sql).get(...params) as unknown as T | undefined;
  }

  categoriesInZone(zone: Zone): StoredCategory[] {
    return this.all<CategoryRow>(
      `SELECT id, zone, name, name_key FROM categories
       WHERE owner_id = ? AND zone = ? ORDER BY name_key`,
      this.owner,
      zone,
    ).map(toCategory);
  }

  /** Categories of the given entries (all of the owner's when omitted). */
  private categoriesByEntry(entryId?: string): Map<string, StoredCategory[]> {
    const rows = this.all<CategoryRow & { entry_id: string }>(
      `SELECT ec.entry_id, c.id, c.zone, c.name, c.name_key
       FROM entry_categories ec
       JOIN categories c ON c.id = ec.category_id
       JOIN entries e ON e.id = ec.entry_id
       WHERE e.owner_id = ? AND (?2 IS NULL OR ec.entry_id = ?2)
       ORDER BY c.name_key`,
      this.owner,
      entryId ?? null,
    );
    const byEntry = new Map<string, StoredCategory[]>();
    for (const row of rows) {
      const list = byEntry.get(row.entry_id) ?? [];
      list.push(toCategory(row));
      byEntry.set(row.entry_id, list);
    }
    return byEntry;
  }

  entryById(id: string): StoredEntry | undefined {
    const row = this.get<EntryRow>(
      `SELECT ${SUMMARY_COLUMNS}, content FROM entries
       WHERE owner_id = ? AND id = ?`,
      this.owner,
      id,
    );
    if (row === undefined) return undefined;
    const categories = this.categoriesByEntry(id).get(id) ?? [];
    return { ...toSummary(row, categories), content: row.content ?? null };
  }

  entrySummaries(): StoredEntrySummary[] {
    const rows = this.all<EntryRow>(
      `SELECT ${SUMMARY_COLUMNS} FROM entries
       WHERE owner_id = ? ORDER BY added_at, seq`,
      this.owner,
    );
    const categories = this.categoriesByEntry();
    return rows.map((row) => toSummary(row, categories.get(row.id) ?? []));
  }

  entryIdByDedupKey(dedupKey: string): string | undefined {
    return this.get<{ id: string }>(
      'SELECT id FROM entries WHERE owner_id = ? AND dedup_key = ?',
      this.owner,
      dedupKey,
    )?.id;
  }

  insertCategory(category: NewCategoryRow): void {
    this.db
      .prepare(
        'INSERT INTO categories (id, owner_id, zone, name, name_key) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        category.id,
        this.owner,
        category.zone,
        category.name,
        category.nameKey,
      );
  }

  insertEntry(entry: NewEntryRow): void {
    this.db
      .prepare(
        `INSERT INTO entries (id, owner_id, kind, name, url, resource_type,
           what_it_does, situations, keywords, sources, content,
           verification_notes, dedup_key, added_at, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        this.owner,
        entry.kind,
        entry.name,
        entry.url,
        entry.resourceType,
        entry.whatItDoes,
        JSON.stringify(entry.situations),
        JSON.stringify(entry.keywords),
        JSON.stringify(entry.sources),
        entry.content,
        JSON.stringify(entry.verificationNotes),
        entry.dedupKey,
        entry.addedAt,
        entry.verifiedAt,
      );
  }

  addEntryCategory(entryId: string, categoryId: string): void {
    this.db
      .prepare(
        'INSERT INTO entry_categories (entry_id, category_id) VALUES (?, ?)',
      )
      .run(entryId, categoryId);
  }

  writeTransaction<T>(fn: (writer: CatalogWriter) => T): T {
    if (this.readOnly) {
      throw new WhenkitError('INTERNAL', {
        detail: 'write on a read-only catalog',
      });
    }
    if (this.db.isTransaction) {
      throw new WhenkitError('INTERNAL', { detail: 'nested transaction' });
    }
    try {
      this.db.exec('BEGIN IMMEDIATE');
      const result = fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw toWhenkitError(error);
    }
  }

  close(): void {
    if (this.db.isOpen) this.db.close();
  }
}

/**
 * Per-connection settings (AD-4). `recursive_triggers` makes the rows that
 * `INSERT OR REPLACE` removes fire the delete triggers, so entries_fts drops
 * their terms. Exported so tests can configure a raw connection the same way.
 */
export function configureConnection(
  db: DatabaseSync,
  busyTimeoutMs: number,
): void {
  db.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.trunc(busyTimeoutMs))}`);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA recursive_triggers = ON');
}

/**
 * Opens the catalog at `dbPath`. A missing file is refused with
 * CATALOG_NOT_FOUND unless `create` is set (only `whenkit init`). In write
 * mode the connection gets the AD-4 pragmas and the database is migrated;
 * with `readOnly` nothing is written: the database must already be at the
 * code's version (DATABASE_NEEDS_MIGRATION otherwise). Throws a WhenkitError
 * when the database is refused (MIGRATION_MISMATCH, DATABASE_TOO_NEW) or
 * locked (DATABASE_BUSY); the connection is closed in that case.
 */
export function openCatalogStore(
  dbPath: string,
  options: OpenCatalogStoreOptions,
): CatalogStore {
  const readOnly = options.readOnly === true;
  if (!existsSync(dbPath) && (readOnly || options.create !== true)) {
    throw new WhenkitError('CATALOG_NOT_FOUND', { detail: dbPath });
  }

  const hooks: Record<number, (db: DatabaseSync) => void> = {
    1: (db) => seedInitial(db, options.ids),
  };
  const migrations = (options.migrations ?? bundledMigrations()).map(
    (migration) => ({
      ...migration,
      afterApply: migration.afterApply ?? hooks[migration.version],
    }),
  );

  let db: DatabaseSync | undefined;
  try {
    let version: number;
    if (readOnly) {
      db = new DatabaseSync(dbPath, { readOnly: true });
      // journal_mode is persistent (set by the writer); setting it here
      // would be a write.
      db.exec(
        `PRAGMA busy_timeout = ${Math.max(0, Math.trunc(options.busyTimeoutMs))}`,
      );
      version = checkMigrated(db, migrations);
    } else {
      db = new DatabaseSync(dbPath);
      configureConnection(db, options.busyTimeoutMs);
      version = migrate(db, { dbPath, clock: options.clock, migrations });
    }
    const meta = db.prepare('SELECT owner_id FROM meta WHERE id = 1').get() as
      | { owner_id: string }
      | undefined;
    if (meta === undefined) {
      throw new WhenkitError('INTERNAL', {
        detail: 'meta.owner_id is missing',
      });
    }
    return new SqliteCatalogStore(db, meta.owner_id, version, readOnly);
  } catch (error) {
    if (db?.isOpen) db.close();
    throw toWhenkitError(error);
  }
}
