import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { nodeFileSystem } from '../src/adapters/fs/node-file-system';
import {
  bundledMigrations,
  type Migration,
} from '../src/adapters/sqlite/migrate';
import { catalogSnapshot } from '../src/core/catalog-snapshot';
import { catalogSnapshotDtoSchema } from '../src/core/dto';
import type { CatalogStore, OpenStoreOptions } from '../src/core/ports';
import {
  openDesktopCatalog,
  snapshotResult,
} from '../src/desktop/main/catalog';
import {
  batch,
  concept,
  importReport,
  initialized,
  material,
  tool,
  type CliSetup,
} from './cli-harness';
import {
  errorCodeOf,
  fakeEnvironment,
  fixedClock,
  tempDir,
  testStoreOpener,
} from './helpers';

// The window's read path: core's catalogSnapshot, the `migrate: false` open
// mode and main's electron-free wrapper (AD-4, AD-10, AD-18).

const FIRST_BATCH_AT = '2026-10-13T12:00:00.000Z';
const SECOND_BATCH_AT = '2026-10-14T09:30:00.000Z';

const v2: Migration = {
  version: 2,
  name: 'test-extra',
  sql: 'CREATE TABLE extra (id INTEGER PRIMARY KEY) STRICT;',
};

/** A workspace with a first batch (a, b, m1) and a newer one (c, k1). */
async function catalogWithTwoBatches(): Promise<CliSetup> {
  const s = await initialized();
  s.deps.clock = fixedClock(new Date(FIRST_BATCH_AT));
  await importReport(s, batch([tool('a'), tool('b'), material('m1')]));
  s.deps.clock = fixedClock(new Date(SECOND_BATCH_AT));
  await importReport(
    s,
    batch([
      tool('c'),
      concept('k1', {
        whatItDoes: 'Explică o idee.',
        situations: ['Când aleg o arhitectură'],
        content: '# k1\n\nText lung.',
      }),
    ]),
  );
  return s;
}

function open(
  dbPath: string,
  options: OpenStoreOptions,
  migrations?: Migration[],
) {
  return testStoreOpener({ migrations })(dbPath, options);
}

/** File names next to the catalog plus its bytes: any write shows up. */
function fingerprint(dbPath: string) {
  return {
    files: readdirSync(path.dirname(dbPath)).sort(),
    bytes: readFileSync(dbPath),
  };
}

describe('catalogSnapshot', () => {
  it('returns both zones with content, newest batch first, batch order kept', async () => {
    const s = await catalogWithTwoBatches();
    const store = open(s.dbPath, { migrate: false });
    const snapshot = catalogSnapshot(store);
    store.close();

    expect(catalogSnapshotDtoSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.entries.map((entry) => entry.name)).toEqual([
      'Tool c',
      'Concept k1',
      'Tool a',
      'Tool b',
      'Material m1',
    ]);
    expect(snapshot.entries.map((entry) => entry.zone)).toEqual([
      'toolbox',
      'learn',
      'toolbox',
      'toolbox',
      'learn',
    ]);
    expect(snapshot.entries[1].content).toBe('# k1\n\nText lung.');
    expect(snapshot.entries[0].content).toBeNull();
    expect(snapshot.entries[0].categories).toEqual([
      { id: expect.any(String), name: 'Imagini & video' },
    ]);
  });

  it('returns every category of both zones', async () => {
    const s = await catalogWithTwoBatches();
    const store = open(s.dbPath, { migrate: false });
    const { categories } = catalogSnapshot(store);
    const expectedIds = [
      ...store.categoriesInZone('learn'),
      ...store.categoriesInZone('toolbox'),
    ].map((category) => category.id);
    store.close();

    expect(categories).toHaveLength(16);
    const zones = categories.map((category) => category.zone);
    expect(new Set(zones)).toEqual(new Set(['toolbox', 'learn']));
    expect(zones).toEqual([...zones].sort());
    // Inside each zone the order is name_key (categoriesInZone's order).
    expect(categories.map((category) => category.id)).toEqual(expectedIds);
  });

  it('reads inside one transaction and refuses nesting', async () => {
    const s = await catalogWithTwoBatches();
    const store = open(s.dbPath, { migrate: false });
    let nested = '';
    store.readTransaction(() => {
      nested = errorCodeOf(() => store.readTransaction(() => 1));
    });
    expect(nested).toBe('INTERNAL');
    expect(() =>
      store.readTransaction(() => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    // The failed transaction was rolled back: the store is usable again.
    expect(store.readTransaction((reader) => reader.allEntries().length)).toBe(
      5,
    );
    store.close();
  });
});

describe('opening with migrate: false', () => {
  it('opens a current catalog for writing', async () => {
    const s = await catalogWithTwoBatches();
    const store = open(s.dbPath, { migrate: false });
    expect(store.schemaVersion()).toBe(1);
    expect(store.writeTransaction((writer) => writer.allEntries().length)).toBe(
      5,
    );
    store.close();
  });

  it('refuses pending migrations and leaves the file untouched', async () => {
    const s = await catalogWithTwoBatches();
    const before = fingerprint(s.dbPath);

    expect(
      errorCodeOf(() =>
        open(s.dbPath, { migrate: false }, [...bundledMigrations(), v2]),
      ),
    ).toBe('DATABASE_NEEDS_MIGRATION');

    const after = fingerprint(s.dbPath);
    expect(after.files).toEqual(before.files);
    expect(after.bytes.equals(before.bytes)).toBe(true);
    // init creates the folder; a refused open must not put a backup in it.
    expect(readdirSync(path.join(path.dirname(s.dbPath), 'backups'))).toEqual(
      [],
    );
    const db = new DatabaseSync(s.dbPath, { readOnly: true });
    expect(db.prepare('SELECT version FROM schema_migrations').all()).toEqual([
      { version: 1 },
    ]);
    db.close();
  });

  it('refuses a v0 file (no schema) without writing to it', () => {
    const dbPath = path.join(tempDir(), 'catalog.sqlite');
    new DatabaseSync(dbPath).close();
    const before = fingerprint(dbPath);

    expect(errorCodeOf(() => open(dbPath, { migrate: false }))).toBe(
      'DATABASE_NEEDS_MIGRATION',
    );

    const after = fingerprint(dbPath);
    expect(after.files).toEqual(before.files);
    expect(after.bytes.equals(before.bytes)).toBe(true);
  });

  it('refuses a missing file even with create, and creates nothing', () => {
    const dir = tempDir();
    const dbPath = path.join(dir, 'none.sqlite');
    expect(
      errorCodeOf(() => open(dbPath, { migrate: false, create: true })),
    ).toBe('CATALOG_NOT_FOUND');
    expect(readdirSync(dir)).toEqual([]);
  });

  it('refuses a missing file, a newer database and an altered migration', async () => {
    const s = await catalogWithTwoBatches();
    expect(
      errorCodeOf(() =>
        open(path.join(tempDir(), 'none.sqlite'), { migrate: false }),
      ),
    ).toBe('CATALOG_NOT_FOUND');

    const tooNew = await initialized();
    open(tooNew.dbPath, {}, [...bundledMigrations(), v2]).close();
    expect(errorCodeOf(() => open(tooNew.dbPath, { migrate: false }))).toBe(
      'DATABASE_TOO_NEW',
    );

    const altered = bundledMigrations().map((m) => ({
      ...m,
      sql: `${m.sql}\n-- edited`,
    }));
    const before = fingerprint(s.dbPath);
    expect(errorCodeOf(() => open(s.dbPath, { migrate: false }, altered))).toBe(
      'MIGRATION_MISMATCH',
    );
    expect(fingerprint(s.dbPath).bytes.equals(before.bytes)).toBe(true);
  });
});

describe('openDesktopCatalog and snapshotResult', () => {
  function ports(s: CliSetup, migrations?: Migration[]) {
    return {
      env: s.deps.env,
      fs: nodeFileSystem,
      openStore: (dbPath: string, options: OpenStoreOptions) =>
        open(dbPath, options, migrations),
    };
  }

  it('answers the snapshot of a configured workspace', async () => {
    const s = await catalogWithTwoBatches();
    const opened = openDesktopCatalog(ports(s));
    const result = snapshotResult(opened);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.entries).toHaveLength(5);
    if (opened.ok) opened.store.close();
  });

  it('refuses without a workspace and creates no file', () => {
    const root = tempDir();
    const appData = path.join(root, 'AppData');
    mkdirSync(appData);
    const opened = openDesktopCatalog({
      env: fakeEnvironment({ APPDATA: appData }, root),
      fs: nodeFileSystem,
      openStore: (dbPath, options) => open(dbPath, options),
    });
    expect(snapshotResult(opened)).toEqual({
      ok: false,
      error: { code: 'WORKSPACE_NOT_CONFIGURED' },
    });
    expect(readdirSync(appData)).toEqual([]);
  });

  it('refuses an invalid config.json', () => {
    const root = tempDir();
    const appData = path.join(root, 'AppData');
    mkdirSync(path.join(appData, 'whenkit'), { recursive: true });
    writeFileSync(path.join(appData, 'whenkit', 'config.json'), '{ nope');
    const opened = openDesktopCatalog({
      env: fakeEnvironment({ APPDATA: appData }, root),
      fs: nodeFileSystem,
      openStore: (dbPath, options) => open(dbPath, options),
    });
    expect(snapshotResult(opened)).toEqual({
      ok: false,
      error: { code: 'CONFIG_INVALID' },
    });
  });

  it('refuses a workspace without a catalog', () => {
    const root = tempDir();
    const workspace = path.join(root, 'ws');
    mkdirSync(workspace);
    const opened = openDesktopCatalog({
      env: fakeEnvironment({ WHENKIT_WORKSPACE: workspace }, root),
      fs: nodeFileSystem,
      openStore: (dbPath, options) => open(dbPath, options),
    });
    expect(snapshotResult(opened)).toEqual({
      ok: false,
      error: { code: 'CATALOG_NOT_FOUND' },
    });
    expect(readdirSync(workspace)).toEqual([]);
  });

  it('refuses pending migrations, too new and mismatch, writing nothing', async () => {
    const s = await catalogWithTwoBatches();
    const before = fingerprint(s.dbPath);

    const pending = openDesktopCatalog(ports(s, [...bundledMigrations(), v2]));
    expect(snapshotResult(pending)).toEqual({
      ok: false,
      error: { code: 'DATABASE_NEEDS_MIGRATION' },
    });

    const mismatch = openDesktopCatalog(
      ports(
        s,
        bundledMigrations().map((m) => ({ ...m, sql: `${m.sql}\n-- edited` })),
      ),
    );
    expect(snapshotResult(mismatch)).toEqual({
      ok: false,
      error: { code: 'MIGRATION_MISMATCH' },
    });

    const after = fingerprint(s.dbPath);
    expect(after.files).toEqual(before.files);
    expect(after.bytes.equals(before.bytes)).toBe(true);

    const newer = await initialized();
    open(newer.dbPath, {}, [...bundledMigrations(), v2]).close();
    expect(snapshotResult(openDesktopCatalog(ports(newer)))).toEqual({
      ok: false,
      error: { code: 'DATABASE_TOO_NEW' },
    });
  });

  it('turns an unexpected throw at open into INTERNAL and logs it', async () => {
    const s = await catalogWithTwoBatches();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const opened = openDesktopCatalog({
      ...ports(s),
      openStore: () => {
        throw new Error('disk on fire');
      },
    });
    expect(snapshotResult(opened)).toEqual({
      ok: false,
      error: { code: 'INTERNAL' },
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('turns an unexpected throw while reading into INTERNAL and logs it', async () => {
    const s = await catalogWithTwoBatches();
    const real = open(s.dbPath, { migrate: false });
    const broken: CatalogStore = {
      ownerId: () => real.ownerId(),
      schemaVersion: () => real.schemaVersion(),
      categoriesInZone: (zone) => real.categoriesInZone(zone),
      entryById: (id) => real.entryById(id),
      entrySummaries: () => real.entrySummaries(),
      allEntries: () => real.allEntries(),
      searchEntryIds: (text) => real.searchEntryIds(text),
      allCategories: () => real.allCategories(),
      categoryById: (id) => real.categoryById(id),
      entryIdsWithCategory: (id) => real.entryIdsWithCategory(id),
      entryIdByDedupKey: (key) => real.entryIdByDedupKey(key),
      parentIdsOf: (id) => real.parentIdsOf(id),
      rejections: () => real.rejections(),
      writeTransaction: (fn) => real.writeTransaction(fn),
      dataVersion: () => real.dataVersion(),
      close: () => real.close(),
      readTransaction: () => {
        throw new Error('torn read');
      },
    };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      snapshotResult({ ok: true, store: broken, workspace: 'D:\\ws' }),
    ).toEqual({
      ok: false,
      error: { code: 'INTERNAL' },
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
    real.close();
  });
});
