import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { CATEGORY_SEED } from '../src/core/category-seed';
import { nameKey } from '../src/core/name-key';
import {
  bundledMigrations,
  migrationHash,
  type Migration,
} from '../src/adapters/sqlite/migrate';
import {
  configureConnection,
  openCatalogStore,
} from '../src/adapters/sqlite/sqlite-catalog-store';
import { errorCodeOf, fixedClock, sequentialIds, tempDir } from './helpers';

/** A catalog path whose data/ folder exists (init creates it in real use). */
function newDbPath() {
  const data = path.join(tempDir(), 'data');
  mkdirSync(data);
  return path.join(data, 'catalog.sqlite');
}

function backupsOf(dbPath: string) {
  return path.join(path.dirname(dbPath), 'backups');
}

function open(dbPath: string, migrations?: Migration[]) {
  return openCatalogStore(dbPath, {
    clock: fixedClock(),
    ids: sequentialIds(),
    busyTimeoutMs: 100,
    migrations,
  });
}

/** Opens the same file raw, to inspect or tamper with it. */
function withRawDb<T>(dbPath: string, action: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(dbPath);
  try {
    return action(db);
  } finally {
    db.close();
  }
}

const v2: Migration = {
  version: 2,
  name: 'test-extra',
  sql: 'CREATE TABLE extra (id INTEGER PRIMARY KEY) STRICT;',
};

describe('SqliteCatalogStore', () => {
  it('creates schema v1 with WAL, an owner and the 16 start categories', () => {
    const dbPath = newDbPath();
    const store = open(dbPath);
    const owner = store.ownerId();
    expect(store.schemaVersion()).toBe(1);
    expect(owner).toMatch(/^[0-9a-f-]{36}$/);
    store.close();

    withRawDb(dbPath, (db) => {
      expect(db.prepare('PRAGMA journal_mode').get()).toEqual({
        journal_mode: 'wal',
      });
      const rows = db
        .prepare(
          'SELECT zone, name, name_key, owner_id FROM categories ORDER BY rowid',
        )
        .all();
      expect(rows).toHaveLength(16);
      expect(rows).toEqual(
        CATEGORY_SEED.map((c) => ({
          zone: c.zone,
          name: c.name,
          name_key: nameKey(c.name),
          owner_id: owner,
        })),
      );
      expect(db.prepare('SELECT * FROM schema_migrations').all()).toEqual([
        {
          version: 1,
          name: 'initial',
          sha256: migrationHash(bundledMigrations()[0].sql),
        },
      ]);
    });
  });

  it('reopens without re-migrating: one migration row, same owner, 16 categories', () => {
    const dbPath = newDbPath();
    const first = open(dbPath);
    const owner = first.ownerId();
    first.close();

    const second = open(dbPath);
    expect(second.ownerId()).toBe(owner);
    expect(second.schemaVersion()).toBe(1);
    second.close();

    withRawDb(dbPath, (db) => {
      const count = (table: string) =>
        db.prepare(`SELECT count(*) AS n FROM ${table}`).get();
      expect(count('schema_migrations')).toEqual({ n: 1 });
      expect(count('categories')).toEqual({ n: 16 });
      expect(count('meta')).toEqual({ n: 1 });
    });
    expect(existsSync(backupsOf(dbPath))).toBe(false);
  });

  it('refuses an applied migration whose SQL changed, writing nothing', () => {
    const dbPath = newDbPath();
    open(dbPath).close();
    const before = withRawDb(dbPath, (db) =>
      db.prepare('SELECT * FROM schema_migrations').all(),
    );

    const altered = bundledMigrations().map((m) =>
      m.version === 1 ? { ...m, sql: `${m.sql}\n-- edited` } : m,
    );
    expect(errorCodeOf(() => open(dbPath, [...altered, v2]))).toBe(
      'MIGRATION_MISMATCH',
    );

    withRawDb(dbPath, (db) => {
      expect(db.prepare('SELECT * FROM schema_migrations').all()).toEqual(
        before,
      );
      expect(
        db.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'extra'").get(),
      ).toBeUndefined();
    });
    expect(existsSync(backupsOf(dbPath))).toBe(false);
  });

  it('hashes CRLF and LF checkouts of a migration the same', () => {
    const dbPath = newDbPath();
    open(dbPath).close();
    const crlf = bundledMigrations().map((m) => ({
      ...m,
      sql: m.sql.replace(/\r?\n/g, '\r\n'),
    }));
    const store = open(dbPath, crlf);
    expect(store.schemaVersion()).toBe(1);
    store.close();
  });

  it('refuses a database with a migration unknown to the code', () => {
    const dbPath = newDbPath();
    open(dbPath, [...bundledMigrations(), v2]).close();
    expect(errorCodeOf(() => open(dbPath))).toBe('DATABASE_TOO_NEW');
  });

  it('backs up the v1 database before applying v2', () => {
    const dbPath = newDbPath();
    const first = open(dbPath);
    const owner = first.ownerId();
    first.close();

    let seenDuringV2: string[] = [];
    const store = open(dbPath, [
      ...bundledMigrations(),
      {
        ...v2,
        afterApply: () => {
          seenDuringV2 = readdirSync(backupsOf(dbPath));
        },
      },
    ]);
    expect(store.schemaVersion()).toBe(2);
    expect(store.ownerId()).toBe(owner);
    store.close();

    expect(seenDuringV2).toEqual(['catalog-v1-2026-10-13_140509.sqlite']);
    withRawDb(path.join(backupsOf(dbPath), seenDuringV2[0]), (db) => {
      expect(
        db.prepare('SELECT max(version) AS v FROM schema_migrations').get(),
      ).toEqual({ v: 1 });
      expect(db.prepare('SELECT owner_id FROM meta').get()).toEqual({
        owner_id: owner,
      });
    });
    withRawDb(dbPath, (db) => {
      expect(db.prepare('SELECT version FROM schema_migrations').all()).toEqual(
        [{ version: 1 }, { version: 2 }],
      );
    });
  });

  it('maps a locked database to DATABASE_BUSY', () => {
    const dbPath = newDbPath();
    open(dbPath).close();
    withRawDb(dbPath, (locker) => {
      locker.exec('BEGIN EXCLUSIVE');
      try {
        expect(
          errorCodeOf(() => open(dbPath, [...bundledMigrations(), v2])),
        ).toBe('DATABASE_BUSY');
      } finally {
        locker.exec('ROLLBACK');
      }
    });
  });

  it('finds an entry by an unaccented word prefix from its situations', () => {
    const dbPath = newDbPath();
    open(dbPath).close();
    withRawDb(dbPath, (db) => {
      const insert = db.prepare(
        `INSERT INTO entries (id, owner_id, kind, name, url, what_it_does,
           situations, keywords, dedup_key, added_at)
         VALUES (?, 'o', 'tool', ?, ?, ?, ?, ?, ?, '2026-10-13T12:00:00.000Z')`,
      );
      insert.run(
        'e1',
        'remove.bg',
        'https://remove.bg',
        'Elimină automat fundalul unei imagini.',
        JSON.stringify(['Când vreau să șterg fundalul unei poze de produs']),
        JSON.stringify(['background', 'fundal']),
        'url:remove.bg',
      );
      insert.run(
        'e2',
        'squoosh',
        'https://squoosh.app',
        'Comprimă imagini în browser.',
        JSON.stringify(['Când o imagine e prea mare pentru site']),
        JSON.stringify(['compresie']),
        'url:squoosh.app',
      );
      const search = (query: string) =>
        db
          .prepare(
            `SELECT e.id FROM entries_fts
             JOIN entries e ON e.seq = entries_fts.rowid
             WHERE entries_fts MATCH ? ORDER BY e.id`,
          )
          .all(query)
          .map((row) => row.id);

      // "ster" finds "șterg" in situations although it lacks the diacritic.
      expect(search('situations : "ster"*')).toEqual(['e1']);
      expect(search('"poz"*')).toEqual(['e1']);

      db.prepare('UPDATE entries SET situations = ? WHERE id = ?').run(
        JSON.stringify(['Când trebuie să micșorez o fotografie']),
        'e1',
      );
      expect(search('"poz"*')).toEqual([]);
      expect(search('"micsor"*')).toEqual(['e1']);

      db.prepare('DELETE FROM entries WHERE id = ?').run('e1');
      expect(search('"micsor"*')).toEqual([]);
      expect(search('"compres"*')).toEqual(['e2']);
      db.exec(
        "INSERT INTO entries_fts (entries_fts, rank) VALUES ('integrity-check', 1)",
      );
    });
  });

  it('keeps the index consistent with its source for JSON-escaped text', () => {
    const dbPath = newDbPath();
    open(dbPath).close();
    withRawDb(dbPath, (db) => {
      db.prepare(
        `INSERT INTO entries (id, owner_id, kind, name, url, what_it_does,
           situations, keywords, dedup_key, added_at)
         VALUES ('e1', 'o', 'tool', 'carbon', 'https://carbon.now.sh', 'x',
           ?, ?, 'url:carbon.now.sh', '2026-10-13T12:00:00.000Z')`,
      ).run(
        JSON.stringify(['Când vreau\nsă arăt „cod” "frumos"']),
        JSON.stringify(['captură\tcod']),
      );
      const found = () =>
        db
          .prepare(
            `SELECT rowid FROM entries_fts WHERE entries_fts MATCH '"frumo"*'`,
          )
          .all().length;
      const check = () =>
        db.exec(
          "INSERT INTO entries_fts (entries_fts, rank) VALUES ('integrity-check', 1)",
        );

      expect(found()).toBe(1);
      check();
      db.exec("INSERT INTO entries_fts (entries_fts) VALUES ('rebuild')");
      expect(found()).toBe(1);
      check();
    });
  });

  it('drops the old terms when INSERT OR REPLACE rewrites an entry', () => {
    const dbPath = newDbPath();
    open(dbPath).close();
    withRawDb(dbPath, (db) => {
      configureConnection(db, 100);
      const upsert = db.prepare(
        `INSERT OR REPLACE INTO entries (id, owner_id, kind, name, url,
           what_it_does, situations, dedup_key, added_at)
         VALUES ('e1', 'o', 'tool', 'x', 'https://x.dev', ?, ?, 'url:x.dev',
           '2026-10-13T12:00:00.000Z')`,
      );
      const found = (term: string) =>
        db
          .prepare('SELECT rowid FROM entries_fts WHERE entries_fts MATCH ?')
          .all(`"${term}"*`).length;

      upsert.run('Vechi', JSON.stringify(['Când caut ceva vechi']));
      upsert.run('Nou', JSON.stringify(['Când caut ceva proaspăt']));

      expect(found('vechi')).toBe(0);
      expect(found('proaspat')).toBe(1);
      db.exec(
        "INSERT INTO entries_fts (entries_fts, rank) VALUES ('integrity-check', 1)",
      );
    });
  });

  it('enforces the entry and link invariants of the schema', () => {
    const dbPath = newDbPath();
    open(dbPath).close();
    withRawDb(dbPath, (db) => {
      db.exec('PRAGMA foreign_keys = ON');
      const add = db.prepare(
        `INSERT INTO entries (id, owner_id, kind, name, url, what_it_does,
           dedup_key, added_at)
         VALUES (?, 'o', ?, ?, ?, 'x', ?, '2026-10-13T12:00:00.000Z')`,
      );
      add.run('a', 'concept', 'A', null, 'title:a');
      add.run('b', 'concept', 'B', null, 'title:b');
      expect(() => add.run('c', 'tool', 'C', null, 'url:c')).toThrow(/CHECK/);
      expect(() => add.run('d', 'concept', 'D', null, 'title:a')).toThrow(
        /UNIQUE/,
      );

      const link = db.prepare(
        'INSERT INTO links (type, from_id, to_id) VALUES (?, ?, ?)',
      );
      link.run('related', 'a', 'b');
      expect(() => link.run('related', 'b', 'a')).toThrow(/CHECK/);
      expect(() => link.run('related', 'a', 'b')).toThrow(/UNIQUE/);
      expect(() => link.run('parent', 'a', 'a')).toThrow(/CHECK/);
      link.run('parent', 'b', 'a');

      db.prepare('DELETE FROM entries WHERE id = ?').run('a');
      expect(db.prepare('SELECT count(*) AS n FROM links').get()).toEqual({
        n: 0,
      });
      expect(
        db
          .prepare(
            "SELECT my_notes, revision, forced, sources FROM entries WHERE id = 'b'",
          )
          .get(),
      ).toEqual({ my_notes: '', revision: 1, forced: 0, sources: '[]' });
    });
  });
});
