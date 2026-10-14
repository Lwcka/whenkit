import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { CATEGORY_SEED } from '../src/core/category-seed';
import type {
  NewEntryRow,
  OpenStoreOptions,
  StoredRejection,
} from '../src/core/ports';
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

function open(
  dbPath: string,
  migrations?: Migration[],
  options: OpenStoreOptions = { create: true },
) {
  return openCatalogStore(dbPath, {
    ...options,
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

function entryRow(overrides: Partial<NewEntryRow> = {}): NewEntryRow {
  return {
    id: 'e1',
    kind: 'tool',
    name: 'remove.bg',
    url: 'https://remove.bg',
    resourceType: 'site',
    whatItDoes: 'Elimină fundalul.',
    situations: ['Când vreau fundal transparent'],
    keywords: ['fundal'],
    sources: [],
    content: null,
    verificationNotes: [],
    dedupKey: 'url:remove.bg',
    forced: false,
    githubStars: null,
    githubPushedAt: null,
    githubArchived: null,
    addedAt: '2026-10-13T12:00:00.000Z',
    verifiedAt: null,
    ...overrides,
  };
}

describe('SqliteCatalogStore open modes', () => {
  it('refuses a missing file with CATALOG_NOT_FOUND unless asked to create it', () => {
    const dbPath = newDbPath();
    expect(errorCodeOf(() => open(dbPath, undefined, {}))).toBe(
      'CATALOG_NOT_FOUND',
    );
    expect(errorCodeOf(() => open(dbPath, undefined, { readOnly: true }))).toBe(
      'CATALOG_NOT_FOUND',
    );
    expect(existsSync(dbPath)).toBe(false);
  });

  it('opens an existing catalog read-only and refuses to write through it', () => {
    const dbPath = newDbPath();
    const writer = open(dbPath);
    const owner = writer.ownerId();
    writer.close();

    const reader = open(dbPath, undefined, { readOnly: true });
    expect(reader.ownerId()).toBe(owner);
    expect(reader.schemaVersion()).toBe(1);
    expect(reader.categoriesInZone('learn')).toHaveLength(7);
    expect(errorCodeOf(() => reader.writeTransaction(() => 0))).toBe(
      'INTERNAL',
    );
    reader.close();
  });

  it('refuses read-only a database with a pending migration, writing nothing', () => {
    const dbPath = newDbPath();
    open(dbPath).close();
    expect(
      errorCodeOf(() =>
        open(dbPath, [...bundledMigrations(), v2], { readOnly: true }),
      ),
    ).toBe('DATABASE_NEEDS_MIGRATION');
    withRawDb(dbPath, (db) => {
      expect(
        db.prepare('SELECT max(version) AS v FROM schema_migrations').get(),
      ).toEqual({ v: 1 });
    });
    expect(existsSync(backupsOf(dbPath))).toBe(false);
  });
});

describe('SqliteCatalogStore reads and writes', () => {
  it('writes an entry with its categories and reads it back camelCased', () => {
    const dbPath = newDbPath();
    const store = open(dbPath);
    const [design] = store
      .categoriesInZone('toolbox')
      .filter((c) => c.name === 'Design & UI');
    store.writeTransaction((tx) => {
      tx.insertCategory({
        id: 'c-new',
        zone: 'toolbox',
        name: 'Fonturi',
        nameKey: 'fonturi',
      });
      tx.insertEntry(entryRow());
      tx.addEntryCategory('e1', design.id);
      tx.addEntryCategory('e1', 'c-new');
    });

    expect(store.entryIdByDedupKey('url:remove.bg')).toBe('e1');
    expect(store.entryIdByDedupKey('url:other')).toBeUndefined();
    const entry = store.entryById('e1');
    expect(entry).toMatchObject({
      id: 'e1',
      ownerId: store.ownerId(),
      kind: 'tool',
      resourceType: 'site',
      situations: ['Când vreau fundal transparent'],
      keywords: ['fundal'],
      sources: [],
      content: null,
      myNotes: '',
      githubArchived: null,
      verificationNotes: [],
      forced: false,
      revision: 1,
      verifiedAt: null,
    });
    expect(entry?.categories.map((c) => c.name)).toEqual([
      'Design & UI',
      'Fonturi',
    ]);
    const summaries = store.entrySummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).not.toHaveProperty('content');
    expect(store.entryById('missing')).toBeUndefined();
    store.close();
  });

  it('updates Claude fields and categories, keeping the author fields', () => {
    const dbPath = newDbPath();
    const store = open(dbPath);
    const toolbox = store.categoriesInZone('toolbox');
    const [design, security] = ['Design & UI', 'Securitate'].map(
      (name) => toolbox.find((c) => c.name === name)?.id ?? '',
    );
    store.writeTransaction((tx) => {
      tx.insertEntry(entryRow());
      tx.addEntryCategory('e1', design);
    });
    withRawDb(dbPath, (db) => {
      db.prepare(
        "UPDATE entries SET my_notes = 'Notițele mele', forced = 1 WHERE id = 'e1'",
      ).run();
    });

    store.writeTransaction((tx) => {
      tx.updateEntry({
        ...entryRow({
          name: 'Squoosh',
          url: 'https://squoosh.app',
          situations: ['Când o imagine e prea mare'],
          keywords: ['compresie'],
          verificationNotes: [{ code: 'blocks_automation' }],
          dedupKey: 'url:squoosh.app',
          verifiedAt: '2026-10-14T08:00:00.000Z',
        }),
      });
      tx.replaceEntryCategories('e1', [security]);
    });

    expect(store.entryById('e1')).toMatchObject({
      name: 'Squoosh',
      url: 'https://squoosh.app',
      situations: ['Când o imagine e prea mare'],
      keywords: ['compresie'],
      verificationNotes: [{ code: 'blocks_automation' }],
      dedupKey: 'url:squoosh.app',
      verifiedAt: '2026-10-14T08:00:00.000Z',
      categories: [{ id: security, name: 'Securitate' }],
      myNotes: 'Notițele mele',
      forced: true,
      ownerId: store.ownerId(),
      addedAt: '2026-10-13T12:00:00.000Z',
      revision: 2,
    });
    expect(store.entryIdByDedupKey('url:remove.bg')).toBeUndefined();
    store.close();

    withRawDb(dbPath, (db) => {
      const found = (term: string) =>
        db
          .prepare('SELECT rowid FROM entries_fts WHERE entries_fts MATCH ?')
          .all(`"${term}"*`).length;
      expect(found('transparent')).toBe(0);
      expect(found('compres')).toBe(1);
      db.exec(
        "INSERT INTO entries_fts (entries_fts, rank) VALUES ('integrity-check', 1)",
      );
    });
  });

  it('stores the GitHub fields on insert and replaces or clears them on update', () => {
    const store = open(newDbPath());
    store.writeTransaction((tx) =>
      tx.insertEntry(
        entryRow({
          githubStars: 1200,
          githubPushedAt: '2026-09-01T10:00:00Z',
          githubArchived: true,
        }),
      ),
    );
    expect(store.entryById('e1')).toMatchObject({
      githubStars: 1200,
      githubPushedAt: '2026-09-01T10:00:00Z',
      githubArchived: true,
    });

    store.writeTransaction((tx) =>
      tx.updateEntry(
        entryRow({
          githubStars: 5,
          githubPushedAt: '2026-10-01T00:00:00Z',
          githubArchived: false,
        }),
      ),
    );
    expect(store.entryById('e1')).toMatchObject({
      githubStars: 5,
      githubPushedAt: '2026-10-01T00:00:00Z',
      githubArchived: false,
      revision: 2,
    });

    store.writeTransaction((tx) => tx.updateEntry(entryRow()));
    expect(store.entryById('e1')).toMatchObject({
      githubStars: null,
      githubPushedAt: null,
      githubArchived: null,
    });
    store.close();
  });

  it('refuses to update an entry that does not exist', () => {
    const dbPath = newDbPath();
    const store = open(dbPath);
    expect(
      errorCodeOf(() =>
        store.writeTransaction((tx) => tx.updateEntry(entryRow())),
      ),
    ).toBe('INTERNAL');
    store.close();
  });

  it('rolls the whole transaction back when it throws', () => {
    const dbPath = newDbPath();
    const store = open(dbPath);
    expect(() =>
      store.writeTransaction((tx) => {
        tx.insertEntry(entryRow());
        tx.insertEntry(entryRow({ id: 'e2' })); // same dedup_key: UNIQUE
      }),
    ).toThrow(/UNIQUE/);
    expect(store.entrySummaries()).toEqual([]);
    store.close();
  });

  it('maps a lock held by another process to DATABASE_BUSY', () => {
    const dbPath = newDbPath();
    const store = open(dbPath);
    withRawDb(dbPath, (locker) => {
      locker.exec('BEGIN IMMEDIATE');
      try {
        expect(errorCodeOf(() => store.writeTransaction(() => 0))).toBe(
          'DATABASE_BUSY',
        );
      } finally {
        locker.exec('ROLLBACK');
      }
    });
    store.close();
  });
});

describe('SqliteCatalogStore links', () => {
  /** A catalog holding concepts and tools `e1`..`e4`, no links yet. */
  function withEntries() {
    const dbPath = newDbPath();
    const store = open(dbPath);
    store.writeTransaction((tx) => {
      for (const n of [1, 2, 3, 4]) {
        tx.insertEntry(
          entryRow({
            id: `e${n}`,
            kind: n === 4 ? 'tool' : 'concept',
            dedupKey: `title:e${n}`,
          }),
        );
      }
    });
    return { dbPath, store };
  }

  it('stores related canonically and ignores an existing link', () => {
    const { dbPath, store } = withEntries();
    store.writeTransaction((tx) => {
      tx.insertLink('related', 'e2', 'e1');
      tx.insertLink('related', 'e1', 'e2');
      tx.insertLink('related', 'e2', 'e1');
    });
    expect(
      withRawDb(dbPath, (db) =>
        db.prepare('SELECT type, from_id, to_id FROM links').all(),
      ),
    ).toEqual([{ type: 'related', from_id: 'e1', to_id: 'e2' }]);
    expect(store.entryById('e1')?.relatedIds).toEqual(['e2']);
    expect(store.entryById('e2')?.relatedIds).toEqual(['e1']);
    store.close();
  });

  it('lists related, parent and child ids on entries and summaries', () => {
    const { store } = withEntries();
    store.writeTransaction((tx) => {
      tx.insertLink('parent', 'e1', 'e3');
      tx.insertLink('parent', 'e2', 'e3');
      tx.insertLink('parent', 'e3', 'e4');
      tx.insertLink('related', 'e3', 'e1');
    });
    expect(store.entryById('e3')).toMatchObject({
      parentIds: ['e1', 'e2'],
      childIds: ['e4'],
      relatedIds: ['e1'],
    });
    const summaries = store.entrySummaries();
    expect(summaries.find((e) => e.id === 'e1')).toMatchObject({
      parentIds: [],
      childIds: ['e3'],
      relatedIds: ['e3'],
    });
    expect(summaries.find((e) => e.id === 'e4')).toMatchObject({
      parentIds: ['e3'],
    });
    expect(store.parentIdsOf('e3')).toEqual(['e1', 'e2']);
    expect(store.parentIdsOf('e1')).toEqual([]);
    store.close();
  });

  it('refuses a self-link: the CHECK is not ignored', () => {
    const { store } = withEntries();
    try {
      expect(() =>
        store.writeTransaction((tx) => tx.insertLink('parent', 'e1', 'e1')),
      ).toThrow(/CHECK/);
      expect(store.entryById('e1')?.parentIds).toEqual([]);
    } finally {
      store.close();
    }
  });

  it('deletes related links in both directions, and child links of an umbrella', () => {
    const { store } = withEntries();
    store.writeTransaction((tx) => {
      tx.insertLink('related', 'e1', 'e2');
      tx.insertLink('related', 'e2', 'e3');
      tx.insertLink('related', 'e3', 'e4');
      tx.insertLink('parent', 'e2', 'e1');
      tx.insertLink('parent', 'e2', 'e3');
      tx.insertLink('parent', 'e1', 'e4');
    });
    store.writeTransaction((tx) => {
      tx.deleteRelatedLinks('e2');
      tx.deleteChildLinks('e2');
    });
    expect(store.entryById('e2')).toMatchObject({
      relatedIds: [],
      childIds: [],
    });
    expect(store.entryById('e3')?.relatedIds).toEqual(['e4']);
    // The parent link e1 → e4 and the unrelated related link survive.
    expect(store.entryById('e1')?.childIds).toEqual(['e4']);
    store.close();
  });

  it('deletes the parent links of an entry as umbrella and as child', () => {
    const { store } = withEntries();
    store.writeTransaction((tx) => {
      tx.insertLink('parent', 'e1', 'e2');
      tx.insertLink('parent', 'e2', 'e3');
      tx.insertLink('parent', 'e1', 'e3');
      tx.insertLink('related', 'e2', 'e3');
    });
    const others = store.writeTransaction((tx) => tx.deleteParentLinks('e2'));
    expect(others).toEqual(['e1', 'e3']);
    expect(store.entryById('e2')).toMatchObject({
      parentIds: [],
      childIds: [],
      relatedIds: ['e3'],
    });
    expect(store.entryById('e3')?.parentIds).toEqual(['e1']);
    store.close();
  });

  it('removes the links of a deleted entry (cascade)', () => {
    const { dbPath, store } = withEntries();
    store.writeTransaction((tx) => tx.insertLink('related', 'e1', 'e2'));
    store.close();
    withRawDb(dbPath, (db) => {
      db.exec('PRAGMA foreign_keys = ON');
      db.exec("DELETE FROM entries WHERE id = 'e1'");
      expect(db.prepare('SELECT count(*) AS n FROM links').get()).toEqual({
        n: 0,
      });
    });
  });
});

describe('SqliteCatalogStore forced flag and rejection journal', () => {
  function rejectionRow(overrides: Partial<StoredRejection> = {}) {
    return {
      id: 'r1',
      op: 'add' as const,
      element: { ref: 'a', name: 'Tool a', url: 'httpss://a.dev' },
      reasons: [{ code: 'invalid_url' as const }],
      dedupKey: 'url:a.dev',
      batchSchemaVersion: 1,
      rejectedAt: '2026-10-14T08:00:00.000Z',
      ...overrides,
    };
  }

  it('inserts a forced entry and only ever raises the flag on update', () => {
    const store = open(newDbPath());
    store.writeTransaction((tx) => tx.insertEntry(entryRow({ forced: true })));
    expect(store.entryById('e1')?.forced).toBe(true);

    store.writeTransaction((tx) => tx.updateEntry(entryRow({ forced: false })));
    expect(store.entryById('e1')).toMatchObject({ forced: true, revision: 2 });

    store.writeTransaction((tx) => {
      tx.insertEntry(entryRow({ id: 'e2', dedupKey: 'url:e2' }));
      tx.updateEntry(entryRow({ id: 'e2', dedupKey: 'url:e2', forced: true }));
    });
    expect(store.entryById('e2')?.forced).toBe(true);
    store.close();
  });

  it('journals a rejection and reads it back, oldest first', () => {
    const store = open(newDbPath());
    expect(store.rejections()).toEqual([]);
    store.writeTransaction((tx) => {
      tx.insertRejection(
        rejectionRow({
          id: 'r2',
          dedupKey: 'url:b',
          rejectedAt: '2026-10-14T09:00:00.000Z',
        }),
      );
      tx.insertRejection(rejectionRow());
    });
    expect(store.rejections()).toEqual([
      rejectionRow(),
      rejectionRow({
        id: 'r2',
        dedupKey: 'url:b',
        rejectedAt: '2026-10-14T09:00:00.000Z',
      }),
    ]);
    store.close();
  });

  it('keeps one row per dedup key: a new rejection replaces the older', () => {
    const store = open(newDbPath());
    store.writeTransaction((tx) => tx.insertRejection(rejectionRow()));
    store.writeTransaction((tx) =>
      tx.insertRejection(
        rejectionRow({
          id: 'r9',
          op: 'update',
          reasons: [{ code: 'tls_error' }],
          rejectedAt: '2026-10-15T09:00:00.000Z',
        }),
      ),
    );
    expect(store.rejections()).toEqual([
      rejectionRow({
        id: 'r9',
        op: 'update',
        reasons: [{ code: 'tls_error' }],
        rejectedAt: '2026-10-15T09:00:00.000Z',
      }),
    ]);
    store.close();
  });

  it('deletes the rows of a dedup key and leaves the others', () => {
    const store = open(newDbPath());
    store.writeTransaction((tx) => {
      tx.insertRejection(rejectionRow());
      tx.insertRejection(rejectionRow({ id: 'r2', dedupKey: 'url:b' }));
      tx.deleteRejections('url:a.dev');
      tx.deleteRejections('url:none');
    });
    expect(store.rejections().map((r) => r.id)).toEqual(['r2']);
    store.close();
  });

  it('deletes the journaled updates of an entry and leaves the rest', () => {
    const store = open(newDbPath());
    store.writeTransaction((tx) => {
      tx.insertRejection(
        rejectionRow({
          id: 'r1',
          op: 'update',
          element: { ref: 'a', id: 'e1', name: 'A' },
          dedupKey: 'url:a',
        }),
      );
      tx.insertRejection(
        rejectionRow({
          id: 'r2',
          op: 'update',
          element: { ref: 'b', id: 'e2', name: 'B' },
          dedupKey: 'url:b',
        }),
      );
      tx.insertRejection(
        rejectionRow({
          id: 'r3',
          op: 'add',
          element: { ref: 'c', id: 'e1', name: 'C' },
          dedupKey: 'url:c',
        }),
      );
      tx.deleteUpdateRejections('e1');
    });
    expect(store.rejections().map((r) => r.id)).toEqual(['r2', 'r3']);
    store.close();
  });

  it('rolls the journal back with the transaction', () => {
    const store = open(newDbPath());
    expect(() =>
      store.writeTransaction((tx) => {
        tx.insertRejection(rejectionRow());
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(store.rejections()).toEqual([]);
    store.close();
  });
});
