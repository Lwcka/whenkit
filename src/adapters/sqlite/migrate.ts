import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { WhenkitError } from '../../core/errors';
import { fileTimestamp } from '../../core/file-stamp';
import type { Clock } from '../../core/ports';

// Safe, append-only migrations (AD-4). Files are named NNNN-<name>.sql; the
// number is fixed when the file is merged into main and never reused.

export interface Migration {
  version: number;
  name: string;
  sql: string;
  /** Runs inside the migration transaction, right after `sql`. */
  afterApply?: (db: DatabaseSync) => void;
}

const MIGRATION_FILE = /(?:^|\/)(\d{4})-([a-z0-9-]+)\.sql$/;

/** Builds the migration list from `{ path: sql }`, sorted by version. */
export function parseMigrationFiles(
  files: Record<string, string>,
): Migration[] {
  const migrations = Object.entries(files).map(([file, sql]) => {
    const match = MIGRATION_FILE.exec(file);
    if (!match) {
      throw new WhenkitError('INTERNAL', {
        detail: `bad migration file name ${file}`,
      });
    }
    return { version: Number(match[1]), name: match[2], sql };
  });
  return sortMigrations(migrations);
}

function sortMigrations(migrations: Migration[]): Migration[] {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  sorted.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new WhenkitError('INTERNAL', {
        detail: `migrations must be numbered 1..n without gaps (got ${migration.version})`,
      });
    }
  });
  return sorted;
}

/** The migrations shipped with the code, bundled at build time. */
export function bundledMigrations(): Migration[] {
  return parseMigrationFiles(
    import.meta.glob<string>('./migrations/*.sql', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  );
}

/**
 * sha256 of the migration SQL with line endings normalized, so a checkout
 * with CRLF (git autocrlf on Windows) hashes the same as one with LF.
 */
export function migrationHash(sql: string): string {
  return createHash('sha256').update(sql.replace(/\r\n?/g, '\n')).digest('hex');
}

interface AppliedRow {
  version: number;
  name: string;
  sha256: string;
}

function readApplied(db: DatabaseSync): AppliedRow[] {
  const table = db
    .prepare(
      "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'schema_migrations'",
    )
    .get();
  if (table === undefined) return [];
  return db
    .prepare(
      'SELECT version, name, sha256 FROM schema_migrations ORDER BY version',
    )
    .all() as unknown as AppliedRow[];
}

/** Throws unless every applied migration is known and unchanged. */
function checkApplied(applied: AppliedRow[], known: Migration[]): void {
  const byVersion = new Map(known.map((m) => [m.version, m]));
  for (const row of applied) {
    const migration = byVersion.get(row.version);
    if (migration === undefined) {
      throw new WhenkitError('DATABASE_TOO_NEW', {
        detail: `unknown migration ${row.version}`,
      });
    }
    if (migrationHash(migration.sql) !== row.sha256) {
      throw new WhenkitError('MIGRATION_MISMATCH', {
        detail: `migration ${row.version} (${row.name}) differs from the code`,
      });
    }
  }
}

function currentVersion(applied: AppliedRow[]): number {
  return applied.reduce((max, row) => Math.max(max, row.version), 0);
}

/** Consistent copy of the database (WAL included) before a migration. */
function backup(
  db: DatabaseSync,
  dbPath: string,
  version: number,
  clock: Clock,
): string {
  const dir = path.join(path.dirname(dbPath), 'backups');
  mkdirSync(dir, { recursive: true });
  const base = `${path.basename(dbPath, path.extname(dbPath))}-v${version}-${fileTimestamp(clock.now())}`;
  let target = path.join(dir, `${base}.sqlite`);
  for (let n = 2; existsSync(target); n++) {
    target = path.join(dir, `${base}-${n}.sqlite`);
  }
  db.prepare('VACUUM INTO ?').run(target);
  return target;
}

/**
 * Read-only counterpart of migrate(): returns the applied version, refusing
 * an unknown or altered migration (DATABASE_TOO_NEW, MIGRATION_MISMATCH) or
 * pending ones (DATABASE_NEEDS_MIGRATION). Writes nothing.
 */
export function checkMigrated(
  db: DatabaseSync,
  migrations: Migration[],
): number {
  const known = sortMigrations(migrations);
  const latest = known.length === 0 ? 0 : known[known.length - 1].version;
  const applied = readApplied(db);
  checkApplied(applied, known);
  const version = currentVersion(applied);
  if (version < latest) {
    throw new WhenkitError('DATABASE_NEEDS_MIGRATION', {
      detail: `database at v${version}, code at v${latest}`,
    });
  }
  return version;
}

export interface MigrateOptions {
  dbPath: string;
  clock: Clock;
  migrations: Migration[];
}

/**
 * Brings the database to the newest known version and returns it. Refuses,
 * before writing anything, a database with an unknown or altered migration.
 * Backs up a non-empty database before applying anything, then applies the
 * pending migrations in one BEGIN IMMEDIATE transaction, re-reading the
 * applied versions after taking the lock in case another process migrated
 * in between.
 */
export function migrate(
  db: DatabaseSync,
  { dbPath, clock, migrations }: MigrateOptions,
): number {
  const known = sortMigrations(migrations);
  const latest = known.length === 0 ? 0 : known[known.length - 1].version;

  const applied = readApplied(db);
  checkApplied(applied, known);
  const version = currentVersion(applied);
  if (version === latest) return version;

  if (version >= 1) backup(db, dbPath, version, clock);

  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        sha256 TEXT NOT NULL
      ) STRICT`,
    );
    const appliedNow = readApplied(db);
    checkApplied(appliedNow, known);
    const from = currentVersion(appliedNow);
    const record = db.prepare(
      'INSERT INTO schema_migrations (version, name, sha256) VALUES (?, ?, ?)',
    );
    for (const migration of known) {
      if (migration.version <= from) continue;
      db.exec(migration.sql);
      migration.afterApply?.(db);
      record.run(
        migration.version,
        migration.name,
        migrationHash(migration.sql),
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
  return latest;
}
