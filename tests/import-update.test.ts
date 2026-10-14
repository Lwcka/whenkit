import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { nodeFileSystem } from '../src/adapters/fs/node-file-system';
import { bundledMigrations } from '../src/adapters/sqlite/migrate';
import { openCatalogStore } from '../src/adapters/sqlite/sqlite-catalog-store';
import { main, type CliDeps } from '../src/cli/main';
import { errorOutputSchema, showOutputSchema } from '../src/core/cli-schemas';
import type { EntryDto } from '../src/core/dto';
import {
  importReportSchema,
  type ImportReport,
} from '../src/core/import-report-schema';
import type {
  CatalogStore,
  CatalogStoreOpener,
  CatalogWriter,
  HttpClient,
} from '../src/core/ports';
import { errorMessages } from '../src/shared/strings.ro';
import {
  fakeAppRoot,
  fakeEnvironment,
  fixedClock,
  sequentialIds,
  tempDir,
  testStoreOpener,
} from './helpers';

// `op: update` and the integrity of a batch (AD-6, AD-11, AD-14, AD-16) end
// to end through main(), on a temp development workspace. Links are checked
// by a fake HttpClient: dead.dev answers 404, slow.dev 503, the rest 200.

const ADDED_AT = '2026-10-13T12:00:00.000Z';
const UPDATED_AT = '2026-10-14T08:30:00.000Z';

const fakeHttp: HttpClient = {
  check: (url) => {
    const host = new URL(url).hostname;
    if (host === 'dead.dev') {
      return Promise.resolve({ kind: 'httpError', status: 404, finalUrl: url });
    }
    if (host === 'slow.dev') {
      return Promise.resolve({ kind: 'httpError', status: 503, finalUrl: url });
    }
    return Promise.resolve({ kind: 'ok', status: 200, finalUrl: url });
  },
};

interface Setup {
  root: string;
  workspace: string;
  dbPath: string;
  deps: CliDeps;
}

function setup(): Setup {
  const root = tempDir();
  const appRoot = fakeAppRoot(path.join(root, 'repo'));
  const appData = path.join(root, 'AppData');
  mkdirSync(appData);
  const workspace = path.join(root, 'ws');
  return {
    root,
    workspace,
    dbPath: path.join(workspace, 'data', 'catalog.sqlite'),
    deps: {
      env: fakeEnvironment(
        { APPDATA: appData, WHENKIT_WORKSPACE: workspace },
        appRoot,
      ),
      fs: nodeFileSystem,
      clock: fixedClock(new Date(ADDED_AT)),
      ids: sequentialIds(),
      openStore: testStoreOpener(),
      http: fakeHttp,
      retryDelayMs: 0,
      cwd: root,
    },
  };
}

async function runCli(s: Setup, args: string[]) {
  let stdout = '';
  let stderr = '';
  const exitCode = await main(
    args,
    {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    },
    s.deps,
  );
  return { exitCode, stdout, stderr };
}

let batchCount = 0;

function writeBatch(s: Setup, content: unknown): string {
  const file = `batch-${++batchCount}.json`;
  writeFileSync(path.join(s.root, file), JSON.stringify(content));
  return file;
}

function tool(ref: string, overrides: Record<string, unknown> = {}) {
  return {
    ref,
    op: 'add',
    kind: 'tool',
    name: `Tool ${ref}`,
    url: `https://${ref}.dev`,
    resourceType: 'site',
    categories: ['Imagini & video'],
    whatItDoes: 'Face ceva util.',
    situations: ['Când am nevoie de el'],
    keywords: ['util'],
    ...overrides,
  };
}

function update(ref: string, id: string, overrides = {}) {
  return tool(ref, { op: 'update', id, ...overrides });
}

function batch(items: unknown[], extra: Record<string, unknown> = {}) {
  return { schemaVersion: 1, items, ...extra };
}

async function importJson(s: Setup, content: unknown) {
  const result = await runCli(s, ['import', writeBatch(s, content), '--json']);
  return { ...result, json: JSON.parse(result.stdout) as unknown };
}

async function importReport(s: Setup, content: unknown): Promise<ImportReport> {
  const result = await importJson(s, content);
  expect(result.exitCode).toBe(0);
  return importReportSchema.parse(result.json);
}

async function show(s: Setup, id: string): Promise<EntryDto> {
  const result = await runCli(s, ['show', id, '--json']);
  expect(result.exitCode).toBe(0);
  return showOutputSchema.parse(JSON.parse(result.stdout)).entry;
}

function count(dbPath: string, table: string): number {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return (
      db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }
    ).n;
  } finally {
    db.close();
  }
}

/**
 * An initialized workspace holding tools `a` and `b`, added at ADDED_AT;
 * the author wrote notes on `a` and once forced it. Later writes happen at
 * UPDATED_AT.
 */
async function catalogWithTwoTools() {
  const s = setup();
  expect((await runCli(s, ['init'])).exitCode).toBe(0);
  const added = await importReport(s, batch([tool('a'), tool('b')]));
  const [a, b] = added.items.map((item) => String(item.id));
  // What the window (entries:setNotes) and `--force` (ticket 8) will write.
  const db = new DatabaseSync(s.dbPath);
  try {
    db.prepare(
      "UPDATE entries SET my_notes = 'Merge și pe PNG mari.', forced = 1 WHERE id = ?",
    ).run(a);
  } finally {
    db.close();
  }
  s.deps.clock = fixedClock(new Date(UPDATED_AT));
  return { s, a, b };
}

/** Opens the real store, but the writer's `writes`-th entry write throws. */
function failingOnWrite(writes: number): CatalogStoreOpener {
  const open = testStoreOpener();
  return (dbPath, options) => {
    const store = open(dbPath, options);
    let count = 0;
    const failing = (writer: CatalogWriter): CatalogWriter =>
      new Proxy(writer, {
        get(target, property) {
          const value: unknown = Reflect.get(target, property);
          if (typeof value !== 'function') return value;
          const method = value as (...args: unknown[]) => unknown;
          if (property !== 'insertEntry' && property !== 'updateEntry') {
            return method.bind(target);
          }
          return (...args: unknown[]) => {
            count += 1;
            if (count >= writes) throw new Error('injected failure');
            return method.apply(target, args);
          };
        },
      });
    const wrapped: CatalogStore = {
      ownerId: () => store.ownerId(),
      schemaVersion: () => store.schemaVersion(),
      categoriesInZone: (zone) => store.categoriesInZone(zone),
      entryById: (id) => store.entryById(id),
      entrySummaries: () => store.entrySummaries(),
      entryIdByDedupKey: (key) => store.entryIdByDedupKey(key),
      writeTransaction: (fn) =>
        store.writeTransaction((writer) => fn(failing(writer))),
      close: () => store.close(),
    };
    return wrapped;
  };
}

describe('whenkit import with op update', () => {
  it('replaces Claude fields and keeps the author fields', async () => {
    const { s, a } = await catalogWithTwoTools();
    const before = await show(s, a);

    const report = await importReport(
      s,
      batch(
        [
          update('a', a, {
            name: 'Tool A rescris',
            url: 'https://a-nou.dev',
            resourceType: 'repo',
            categories: ['Securitate', 'Fonturi'],
            whatItDoes: 'Face altceva, mai bine.',
            situations: ['Când am altă problemă'],
            keywords: ['nou', 'new'],
          }),
        ],
        { newCategories: [{ zone: 'toolbox', name: 'Fonturi' }] },
      ),
    );
    expect(report.items).toEqual([
      { ref: 'a', op: 'update', outcome: 'updated', id: a, reasons: [] },
    ]);

    const after = await show(s, a);
    expect(after).toEqual({
      ...before,
      name: 'Tool A rescris',
      url: 'https://a-nou.dev',
      resourceType: 'repo',
      categories: [
        { id: report.newCategories[0].id, name: 'Fonturi' },
        { id: expect.any(String), name: 'Securitate' },
      ],
      whatItDoes: 'Face altceva, mai bine.',
      situations: ['Când am altă problemă'],
      keywords: ['nou', 'new'],
      revision: before.revision + 1,
      verifiedAt: UPDATED_AT,
    });
    // The author's fields, as the acceptance criterion names them.
    expect(after).toMatchObject({
      myNotes: 'Merge și pe PNG mari.',
      forced: true,
      ownerId: before.ownerId,
      addedAt: ADDED_AT,
    });
    expect(count(s.dbPath, 'entries')).toBe(2);
  });

  it('is not a duplicate of itself when it keeps its URL', async () => {
    const { s, a } = await catalogWithTwoTools();
    const report = await importReport(
      s,
      batch([update('a', a, { url: 'http://www.A.dev/', name: 'Alt nume' })]),
    );
    expect(report.items[0]).toMatchObject({ outcome: 'updated', id: a });
    expect((await show(s, a)).name).toBe('Alt nume');
  });

  it('is a duplicate when its new URL is another entry, leaving it unchanged', async () => {
    const { s, a, b } = await catalogWithTwoTools();
    const before = await show(s, a);
    const report = await importReport(
      s,
      batch([update('a', a, { url: 'https://b.dev/' })]),
    );
    expect(report.items).toEqual([
      {
        ref: 'a',
        op: 'update',
        outcome: 'duplicate',
        duplicateOfId: b,
        reasons: [{ code: 'duplicate' }],
      },
    ]);
    expect(await show(s, a)).toEqual(before);
  });

  it('rejects an update of an id that is not in the catalog', async () => {
    const { s } = await catalogWithTwoTools();
    const missing = '6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f';
    const report = await importReport(s, batch([update('x', missing)]));
    expect(report.items).toEqual([
      {
        ref: 'x',
        op: 'update',
        outcome: 'rejected',
        reasons: [{ code: 'unknown_id', params: { id: missing } }],
      },
    ]);
    expect(count(s.dbPath, 'entries')).toBe(2);
  });

  it('leaves the entry and its revision unchanged when the new link is dead', async () => {
    const { s, a } = await catalogWithTwoTools();
    const before = await show(s, a);
    const report = await importReport(
      s,
      batch([update('a', a, { url: 'https://dead.dev/page' })]),
    );
    expect(report.items).toEqual([
      {
        ref: 'a',
        op: 'update',
        outcome: 'rejected',
        reasons: [{ code: 'http_error', params: { status: '404' } }],
      },
    ]);
    expect(await show(s, a)).toEqual(before);
    expect(before.revision).toBe(1);
  });

  it('refuses a batch that updates the same id twice: exit 1, nothing written', async () => {
    const { s, a } = await catalogWithTwoTools();
    const before = readFileSync(s.dbPath);
    const result = await importJson(
      s,
      batch([
        update('a1', a, { name: 'Unu' }),
        update('a2', a, { name: 'Doi', url: 'https://c.dev' }),
      ]),
    );
    expect(result.exitCode).toBe(1);
    const doc = errorOutputSchema.parse(result.json);
    expect(doc.error.code).toBe('BATCH_INVALID');
    expect(doc.error.issues?.map((issue) => issue.path)).toEqual([
      ['items', 1, 'id'],
    ]);
    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
  });

  it('creates a category declared twice once, used by an add and an update', async () => {
    const { s, a } = await catalogWithTwoTools();
    const categories = count(s.dbPath, 'categories');
    const report = await importReport(
      s,
      batch(
        [
          update('a', a, { categories: ['Unelte de bază'] }),
          tool('c', { categories: ['unelte de baza'] }),
        ],
        {
          newCategories: [
            { zone: 'toolbox', name: 'Unelte de bază' },
            { zone: 'toolbox', name: 'UNELTE DE BAZA' },
          ],
        },
      ),
    );
    expect(report.items.map((item) => item.outcome)).toEqual([
      'updated',
      'added',
    ]);
    expect(report.newCategories).toEqual([
      {
        id: expect.any(String),
        zone: 'toolbox',
        name: 'Unelte de bază',
        created: true,
      },
    ]);
    expect(count(s.dbPath, 'categories')).toBe(categories + 1);
    const id = report.newCategories[0].id;
    expect((await show(s, a)).categories).toEqual([
      { id, name: 'Unelte de bază' },
    ]);
    expect((await show(s, String(report.items[1].id))).categories).toEqual([
      { id, name: 'Unelte de bază' },
    ]);
  });

  it('reports every item exactly once with its outcome, and the proposed domains', async () => {
    const { s, a, b } = await catalogWithTwoTools();
    const content = batch(
      [
        tool('new'),
        update('upd', a, { name: 'A actualizat' }),
        update('slow', b, { url: 'https://slow.dev' }),
        tool('dead', { url: 'https://dead.dev' }),
        tool('dup', { url: 'https://www.new.dev/' }),
      ],
      { proposedBlockedDomains: ['libgen.is', 'z-lib.org'] },
    );
    const report = await importReport(s, content);
    expect(report.items).toEqual([
      {
        ref: 'new',
        op: 'add',
        outcome: 'added',
        id: expect.any(String),
        reasons: [],
      },
      { ref: 'upd', op: 'update', outcome: 'updated', id: a, reasons: [] },
      {
        ref: 'slow',
        op: 'update',
        outcome: 'warned',
        id: b,
        reasons: [{ code: 'no_response_at_import' }],
      },
      {
        ref: 'dead',
        op: 'add',
        outcome: 'rejected',
        reasons: [{ code: 'http_error', params: { status: '404' } }],
      },
      {
        ref: 'dup',
        op: 'add',
        outcome: 'duplicate',
        reasons: [{ code: 'duplicate', params: { ref: 'new' } }],
      },
    ]);
    expect(report.proposedBlockedDomains).toEqual(['libgen.is', 'z-lib.org']);
    expect((await show(s, b)).verificationNotes).toEqual([
      { code: 'no_response_at_import' },
    ]);
  });

  it('prints update lines and counts in the text report', async () => {
    const { s, a, b } = await catalogWithTwoTools();
    const result = await runCli(s, [
      'import',
      writeBatch(
        s,
        batch([
          update('upd', a, { name: 'A actualizat' }),
          update('slow', b, { url: 'https://slow.dev' }),
          tool('c'),
        ]),
      ),
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`upd (actualizare): actualizată (id ${a})`);
    expect(result.stdout).toContain(
      `slow (actualizare): actualizată cu avertisment (id ${b})`,
    );
    expect(result.stdout).toContain(
      'Rezumat: 1 adăugate, 1 actualizate, 1 cu avertisment, 0 respinse, 0 duplicate.',
    );
  });

  it('updates an entry named by its id in uppercase', async () => {
    const { s, a } = await catalogWithTwoTools();
    const report = await importReport(
      s,
      batch([update('a', a.toUpperCase(), { name: 'Alt nume' })]),
    );
    expect(report.items[0]).toMatchObject({ outcome: 'updated', id: a });
    expect((await show(s, a)).name).toBe('Alt nume');
  });

  it('does not call an unknown id an unchanged entry in the text report', async () => {
    const { s } = await catalogWithTwoTools();
    const result = await runCli(s, [
      'import',
      writeBatch(
        s,
        batch([update('x', '6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f')]),
      ),
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('x (actualizare): respinsă\n');
    expect(result.stdout).not.toContain('fișa rămâne neschimbată');
  });

  it('says a rejected update left the entry unchanged in the text report', async () => {
    const { s, a } = await catalogWithTwoTools();
    const result = await runCli(s, [
      'import',
      writeBatch(s, batch([update('a', a, { url: 'https://dead.dev' })])),
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      'a (actualizare): respinsă (fișa rămâne neschimbată)',
    );
  });
});

describe('whenkit import writes nothing when it fails', () => {
  it('exits 3 with DATABASE_BUSY while another process holds the write lock', async () => {
    const { s, a } = await catalogWithTwoTools();
    const before = readFileSync(s.dbPath);
    const locker = new DatabaseSync(s.dbPath);
    let result;
    try {
      locker.exec('PRAGMA busy_timeout = 0');
      locker.exec('BEGIN IMMEDIATE');
      result = await importJson(
        s,
        batch([update('a', a, { name: 'Nou' }), tool('c')]),
      );
      locker.exec('ROLLBACK');
    } finally {
      locker.close();
    }
    expect(result.exitCode).toBe(3);
    const doc = errorOutputSchema.parse(result.json);
    expect(doc.error).toEqual({
      code: 'DATABASE_BUSY',
      message: errorMessages.DATABASE_BUSY,
    });
    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
    expect((await show(s, a)).name).toBe('Tool a');
  });

  it('exits 3 with MIGRATION_MISMATCH when an applied migration changed', async () => {
    const { s, a } = await catalogWithTwoTools();
    const before = readFileSync(s.dbPath);
    s.deps.openStore = (dbPath, options) =>
      openCatalogStore(dbPath, {
        ...options,
        clock: fixedClock(),
        ids: sequentialIds('9000'),
        busyTimeoutMs: 100,
        migrations: bundledMigrations().map((m) =>
          m.version === 1 ? { ...m, sql: `${m.sql}\n-- edited` } : m,
        ),
      });
    const result = await importJson(
      s,
      batch([update('a', a, { name: 'Nou' }), tool('c')]),
    );
    expect(result.exitCode).toBe(3);
    expect(errorOutputSchema.parse(result.json).error.code).toBe(
      'MIGRATION_MISMATCH',
    );
    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
  });

  it('exits 4 with INTERNAL and rolls back the items already written', async () => {
    const { s, a } = await catalogWithTwoTools();
    const before = readFileSync(s.dbPath);
    // The add of `c` and the update of `a` succeed; the add of `d` throws.
    s.deps.openStore = failingOnWrite(3);
    const result = await importJson(
      s,
      batch(
        [
          tool('c', { categories: ['Fonturi'] }),
          update('a', a, { name: 'Nou' }),
          tool('d'),
        ],
        { newCategories: [{ zone: 'toolbox', name: 'Fonturi' }] },
      ),
    );
    expect(result.exitCode).toBe(4);
    expect(errorOutputSchema.parse(result.json).error).toEqual({
      code: 'INTERNAL',
      message: errorMessages.INTERNAL,
    });
    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
  });
});
