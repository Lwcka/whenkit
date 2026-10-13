import { DatabaseSync } from 'node:sqlite';
import { CATEGORY_SEED } from '../../core/category-seed';
import { WhenkitError, isWhenkitError } from '../../core/errors';
import { nameKey } from '../../core/name-key';
import type { CatalogStore, Clock, IdGenerator } from '../../core/ports';
import { bundledMigrations, migrate, type Migration } from './migrate';

// The only way to the catalog database (AD-4). snake_case ↔ camelCase
// mapping happens here and nowhere else.

export interface OpenCatalogStoreOptions {
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

class SqliteCatalogStore implements CatalogStore {
  constructor(
    private readonly db: DatabaseSync,
    private readonly owner: string,
    private readonly version: number,
  ) {}

  ownerId(): string {
    return this.owner;
  }

  schemaVersion(): number {
    return this.version;
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
 * Opens the catalog at `dbPath` (creating the file when missing), sets the
 * connection pragmas and migrates it. Throws a WhenkitError when the
 * database is refused (MIGRATION_MISMATCH, DATABASE_TOO_NEW) or locked
 * (DATABASE_BUSY); the connection is closed in that case.
 */
export function openCatalogStore(
  dbPath: string,
  options: OpenCatalogStoreOptions,
): CatalogStore {
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
    db = new DatabaseSync(dbPath);
    configureConnection(db, options.busyTimeoutMs);
    const version = migrate(db, { dbPath, clock: options.clock, migrations });
    const meta = db.prepare('SELECT owner_id FROM meta WHERE id = 1').get() as
      | { owner_id: string }
      | undefined;
    if (meta === undefined) {
      throw new WhenkitError('INTERNAL', {
        detail: 'meta.owner_id is missing',
      });
    }
    return new SqliteCatalogStore(db, meta.owner_id, version);
  } catch (error) {
    if (db?.isOpen) db.close();
    throw toWhenkitError(error);
  }
}
