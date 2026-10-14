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
  EntryUpdateRow,
  IdGenerator,
  LinkType,
  NewCategoryRow,
  NewEntryRow,
  NewRejectionRow,
  OpenStoreOptions,
  StoredCategory,
  StoredEntry,
  StoredEntrySummary,
  StoredRejection,
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

interface RejectionRow {
  id: string;
  op: 'add' | 'update';
  element: string;
  reasons: string;
  dedup_key: string;
  batch_schema_version: number;
  rejected_at: string;
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

const NO_LINKS = (): LinkIds => ({
  relatedIds: [],
  parentIds: [],
  childIds: [],
});

function toCategory(row: CategoryRow): StoredCategory {
  return {
    id: row.id,
    zone: row.zone,
    name: row.name,
    nameKey: row.name_key,
  };
}

interface LinkIds {
  relatedIds: string[];
  parentIds: string[];
  childIds: string[];
}

function toSummary(
  row: EntryRow,
  categories: StoredCategory[],
  links: LinkIds,
): StoredEntrySummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    kind: row.kind,
    name: row.name,
    url: row.url,
    resourceType: row.resource_type,
    categories,
    ...links,
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

  /** Link ids of the given entry (of all the owner's entries when omitted). */
  private linksByEntry(entryId?: string): Map<string, LinkIds> {
    const rows = this.all<{ type: LinkType; from_id: string; to_id: string }>(
      `SELECT l.type, l.from_id, l.to_id FROM links l
       JOIN entries e ON e.id = l.from_id
       WHERE e.owner_id = ?1 AND (?2 IS NULL OR l.from_id = ?2 OR l.to_id = ?2)`,
      this.owner,
      entryId ?? null,
    );
    const byEntry = new Map<string, LinkIds>();
    const of = (id: string): LinkIds => {
      let links = byEntry.get(id);
      if (links === undefined) {
        links = { relatedIds: [], parentIds: [], childIds: [] };
        byEntry.set(id, links);
      }
      return links;
    };
    for (const row of rows) {
      if (row.type === 'related') {
        of(row.from_id).relatedIds.push(row.to_id);
        of(row.to_id).relatedIds.push(row.from_id);
      } else {
        of(row.from_id).childIds.push(row.to_id);
        of(row.to_id).parentIds.push(row.from_id);
      }
    }
    for (const links of byEntry.values()) {
      links.relatedIds.sort();
      links.parentIds.sort();
      links.childIds.sort();
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
    const links = this.linksByEntry(id).get(id) ?? NO_LINKS();
    return {
      ...toSummary(row, categories, links),
      content: row.content ?? null,
    };
  }

  entrySummaries(): StoredEntrySummary[] {
    const rows = this.all<EntryRow>(
      `SELECT ${SUMMARY_COLUMNS} FROM entries
       WHERE owner_id = ? ORDER BY added_at, seq`,
      this.owner,
    );
    const categories = this.categoriesByEntry();
    const links = this.linksByEntry();
    return rows.map((row) =>
      toSummary(
        row,
        categories.get(row.id) ?? [],
        links.get(row.id) ?? NO_LINKS(),
      ),
    );
  }

  entryIdByDedupKey(dedupKey: string): string | undefined {
    return this.get<{ id: string }>(
      'SELECT id FROM entries WHERE owner_id = ? AND dedup_key = ?',
      this.owner,
      dedupKey,
    )?.id;
  }

  parentIdsOf(id: string): string[] {
    return this.all<{ from_id: string }>(
      `SELECT l.from_id FROM links l
       JOIN entries e ON e.id = l.to_id
       WHERE e.owner_id = ? AND l.type = 'parent' AND l.to_id = ?
       ORDER BY l.from_id`,
      this.owner,
      id,
    ).map((row) => row.from_id);
  }

  rejections(): StoredRejection[] {
    return this.all<RejectionRow>(
      `SELECT id, op, element, reasons, dedup_key, batch_schema_version,
         rejected_at FROM rejections WHERE owner_id = ?
       ORDER BY rejected_at, rowid`,
      this.owner,
    ).map((row) => ({
      id: row.id,
      op: row.op,
      element: JSON.parse(row.element) as Record<string, unknown>,
      reasons: JSON.parse(row.reasons) as VerdictReason[],
      dedupKey: row.dedup_key,
      batchSchemaVersion: row.batch_schema_version,
      rejectedAt: row.rejected_at,
    }));
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
           verification_notes, dedup_key, forced, added_at, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        entry.forced ? 1 : 0,
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

  updateEntry(entry: EntryUpdateRow): void {
    // my_notes, owner_id and added_at are deliberately absent: an update
    // never touches the author's fields (AD-6). `forced` is sticky: it is
    // only ever raised, never reset.
    const result = this.db
      .prepare(
        `UPDATE entries SET kind = ?, name = ?, url = ?, resource_type = ?,
           what_it_does = ?, situations = ?, keywords = ?, sources = ?,
           content = ?, verification_notes = ?, dedup_key = ?,
           forced = forced OR ?, verified_at = ?, revision = revision + 1
         WHERE owner_id = ? AND id = ?`,
      )
      .run(
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
        entry.forced ? 1 : 0,
        entry.verifiedAt,
        this.owner,
        entry.id,
      );
    if (Number(result.changes) !== 1) {
      throw new WhenkitError('INTERNAL', {
        detail: `no entry ${entry.id} to update`,
      });
    }
  }

  replaceEntryCategories(
    entryId: string,
    categoryIds: readonly string[],
  ): void {
    this.db
      .prepare('DELETE FROM entry_categories WHERE entry_id = ?')
      .run(entryId);
    for (const categoryId of categoryIds) {
      this.addEntryCategory(entryId, categoryId);
    }
  }

  insertLink(type: LinkType, fromId: string, toId: string): void {
    const [from, to] =
      type === 'related' && fromId > toId ? [toId, fromId] : [fromId, toId];
    this.db
      .prepare(
        'INSERT INTO links (type, from_id, to_id) VALUES (?, ?, ?) ON CONFLICT (type, from_id, to_id) DO NOTHING',
      )
      .run(type, from, to);
  }

  deleteRelatedLinks(id: string): void {
    this.db
      .prepare(
        "DELETE FROM links WHERE type = 'related' AND (from_id = ? OR to_id = ?)",
      )
      .run(id, id);
  }

  deleteChildLinks(parentId: string): void {
    this.db
      .prepare("DELETE FROM links WHERE type = 'parent' AND from_id = ?")
      .run(parentId);
  }

  deleteParentLinks(id: string): string[] {
    const others = this.all<{ other: string }>(
      `SELECT CASE WHEN from_id = ?1 THEN to_id ELSE from_id END AS other
       FROM links WHERE type = 'parent' AND (from_id = ?1 OR to_id = ?1)
       ORDER BY other`,
      id,
    ).map((row) => row.other);
    this.db
      .prepare(
        "DELETE FROM links WHERE type = 'parent' AND (from_id = ? OR to_id = ?)",
      )
      .run(id, id);
    return [...new Set(others)];
  }

  insertRejection(rejection: NewRejectionRow): void {
    this.deleteRejections(rejection.dedupKey);
    this.db
      .prepare(
        `INSERT INTO rejections (id, owner_id, dedup_key, op, element, reasons,
           batch_schema_version, rejected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        rejection.id,
        this.owner,
        rejection.dedupKey,
        rejection.op,
        JSON.stringify(rejection.element),
        JSON.stringify(rejection.reasons),
        rejection.batchSchemaVersion,
        rejection.rejectedAt,
      );
  }

  deleteRejections(dedupKey: string): void {
    this.db
      .prepare('DELETE FROM rejections WHERE owner_id = ? AND dedup_key = ?')
      .run(this.owner, dedupKey);
  }

  deleteUpdateRejections(entryId: string): void {
    this.db
      .prepare(
        `DELETE FROM rejections
         WHERE owner_id = ? AND op = 'update'
           AND json_extract(element, '$.id') = ?`,
      )
      .run(this.owner, entryId);
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
