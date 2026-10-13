import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { nodeFileSystem } from '../src/adapters/fs/node-file-system';
import { bundledMigrations } from '../src/adapters/sqlite/migrate';
import { openCatalogStore } from '../src/adapters/sqlite/sqlite-catalog-store';
import { main, type CliDeps } from '../src/cli/main';
import {
  errorOutputSchema,
  listOutputSchema,
  showOutputSchema,
} from '../src/core/cli-schemas';
import { importReportSchema } from '../src/core/import-report-schema';
import type { CatalogStoreOpener, HttpClient } from '../src/core/ports';
import { errorMessages } from '../src/shared/strings.ro';
import {
  fakeAppRoot,
  fakeEnvironment,
  fixedClock,
  okHttp,
  sequentialIds,
  tempDir,
  testStoreOpener,
} from './helpers';

// `whenkit import`, `list` and `show` end to end through main(), on a temp
// development workspace created by `whenkit init` (WHENKIT_WORKSPACE set, so
// no config.json is ever written).

interface Setup {
  root: string;
  workspace: string;
  dbPath: string;
  deps: CliDeps;
}

function setup(
  options: {
    workspaceEnv?: boolean;
    openStore?: CatalogStoreOpener;
    http?: HttpClient;
  } = {},
): Setup {
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
        {
          APPDATA: appData,
          WHENKIT_WORKSPACE:
            options.workspaceEnv === false ? undefined : workspace,
        },
        appRoot,
      ),
      fs: nodeFileSystem,
      clock: fixedClock(new Date('2026-10-13T12:00:00.000Z')),
      ids: sequentialIds(),
      openStore: options.openStore ?? testStoreOpener(),
      http: options.http ?? okHttp,
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

async function initialized(options?: Parameters<typeof setup>[0]) {
  const s = setup(options);
  expect((await runCli(s, ['init'])).exitCode).toBe(0);
  return s;
}

let batchCount = 0;

/** Writes a batch file in the temp root and returns its relative path. */
function writeBatch(s: Setup, content: unknown): string {
  const file = `batch-${++batchCount}.json`;
  writeFileSync(
    path.join(s.root, file),
    typeof content === 'string' ? content : JSON.stringify(content),
  );
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

function batch(items: unknown[], extra: Record<string, unknown> = {}) {
  return { schemaVersion: 1, items, ...extra };
}

async function importJson(s: Setup, content: unknown) {
  const result = await runCli(s, ['import', writeBatch(s, content), '--json']);
  return { ...result, json: JSON.parse(result.stdout) as unknown };
}

function count(dbPath: string, table: string): number {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return (
      db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as {
        n: number;
      }
    ).n;
  } finally {
    db.close();
  }
}

describe('whenkit import, list and show', () => {
  it('adds a resource that list --json and show --json then return', async () => {
    const s = await initialized();
    const imported = await importJson(s, batch([tool('a')]));

    expect(imported.exitCode).toBe(0);
    expect(imported.stderr).toBe('');
    const report = importReportSchema.parse(imported.json);
    expect(report.workspace).toBe(s.workspace);
    expect(report.items).toEqual([
      {
        ref: 'a',
        op: 'add',
        outcome: 'added',
        id: expect.any(String),
        reasons: [],
      },
    ]);
    const id = report.items[0].id;

    const listed = await runCli(s, ['list', '--json']);
    expect(listed.exitCode).toBe(0);
    const list = listOutputSchema.parse(JSON.parse(listed.stdout));
    expect(list.workspace).toBe(s.workspace);
    expect(list.entries).toHaveLength(1);
    expect(list.entries[0]).toMatchObject({
      id,
      kind: 'tool',
      zone: 'toolbox',
      name: 'Tool a',
      url: 'https://a.dev',
      categories: [{ id: expect.any(String), name: 'Imagini & video' }],
      addedAt: '2026-10-13T12:00:00.000Z',
      verifiedAt: '2026-10-13T12:00:00.000Z',
    });
    expect(list.entries[0]).not.toHaveProperty('content');

    const shown = await runCli(s, ['show', String(id), '--json']);
    expect(shown.exitCode).toBe(0);
    const show = showOutputSchema.parse(JSON.parse(shown.stdout));
    expect(show.entry).toMatchObject({
      id,
      content: null,
      situations: ['Când am nevoie de el'],
      keywords: ['util'],
    });
  });

  it('prints the same results as text without --json', async () => {
    const s = await initialized();
    const imported = await runCli(s, [
      'import',
      writeBatch(
        s,
        batch([tool('a'), tool('b', { categories: ['Nicăieri'] })]),
      ),
    ]);
    expect(imported.exitCode).toBe(0);
    expect(imported.stdout).toContain('a: adăugată');
    expect(imported.stdout).toContain('b: respinsă');
    expect(imported.stdout).toContain('„Nicăieri”');

    const listed = await runCli(s, ['list']);
    expect(listed.stdout).toContain('[unealtă] Tool a — Imagini & video');
    const id = listed.stdout.split(' ')[0];
    const shown = await runCli(s, ['show', id]);
    expect(shown.stdout).toContain('Când o folosesc:');
    expect(shown.stdout).toContain('Link: https://a.dev');
  });

  it.each([
    ['an unknown field', batch([tool('a', { myNotes: 'x' })]), ['items', 0]],
    [
      'a missing required field',
      batch([tool('a', { whatItDoes: undefined })]),
      ['items', 0, 'whatItDoes'],
    ],
    ['a bad kind', batch([tool('a', { kind: 'carte' })]), ['items', 0, 'kind']],
  ])(
    'refuses a batch with %s: exit 1, nothing written',
    async (_label, content, issuePath) => {
      const s = await initialized();
      const before = readFileSync(s.dbPath);
      const result = await importJson(s, content);

      expect(result.exitCode).toBe(1);
      const doc = errorOutputSchema.parse(result.json);
      expect(doc.workspace).toBe(s.workspace);
      expect(doc.error.code).toBe('BATCH_INVALID');
      expect(doc.error.message).toBe(errorMessages.BATCH_INVALID);
      expect(doc.error.issues?.map((issue) => issue.path)).toContainEqual(
        issuePath,
      );
      expect(count(s.dbPath, 'entries')).toBe(0);
      expect(readFileSync(s.dbPath).equals(before)).toBe(true);
    },
  );

  it('refuses a missing batch file and one that is not JSON', async () => {
    const s = await initialized();
    const missing = await runCli(s, ['import', 'nope.json', '--json']);
    expect(missing.exitCode).toBe(1);
    expect(errorOutputSchema.parse(JSON.parse(missing.stdout)).error.code).toBe(
      'BATCH_INVALID',
    );

    const garbage = await importJson(s, '{ "schemaVersion": 1, ');
    expect(garbage.exitCode).toBe(1);
    expect(errorOutputSchema.parse(garbage.json).error.code).toBe(
      'BATCH_INVALID',
    );
    expect(count(s.dbPath, 'entries')).toBe(0);
  });

  it('refuses an outdated schemaVersion with BATCH_SCHEMA_OUTDATED', async () => {
    const s = await initialized();
    const result = await importJson(s, {
      ...batch([tool('a')]),
      schemaVersion: 0,
    });
    expect(result.exitCode).toBe(1);
    const doc = errorOutputSchema.parse(result.json);
    expect(doc.error.code).toBe('BATCH_SCHEMA_OUTDATED');
    expect(doc.error.message).toContain('whenkit init');
    expect(count(s.dbPath, 'entries')).toBe(0);
  });

  it('rejects an item with an unknown category and adds the others', async () => {
    const s = await initialized();
    const result = await importJson(
      s,
      batch([tool('a', { categories: ['Nicăieri'] }), tool('b')]),
    );
    expect(result.exitCode).toBe(0);
    const report = importReportSchema.parse(result.json);
    expect(report.items[0]).toEqual({
      ref: 'a',
      op: 'add',
      outcome: 'rejected',
      reasons: [{ code: 'unknown_category', params: { name: 'Nicăieri' } }],
    });
    expect(report.items[1].outcome).toBe('added');
    expect(count(s.dbPath, 'entries')).toBe(1);
  });

  it('creates a declared category once and reuses it on the next import', async () => {
    const s = await initialized();
    const declared = { newCategories: [{ zone: 'toolbox', name: 'Fonturi' }] };
    const first = importReportSchema.parse(
      (
        await importJson(
          s,
          batch(
            [
              tool('a', { categories: ['Fonturi'] }),
              tool('b', { categories: ['fonturi'] }),
            ],
            declared,
          ),
        )
      ).json,
    );
    expect(first.newCategories).toEqual([
      {
        id: expect.any(String),
        zone: 'toolbox',
        name: 'Fonturi',
        created: true,
      },
    ]);
    expect(count(s.dbPath, 'categories')).toBe(17);

    const second = importReportSchema.parse(
      (
        await importJson(
          s,
          batch([tool('c', { categories: ['FONTURI'] })], declared),
        )
      ).json,
    );
    expect(second.newCategories).toEqual([
      { ...first.newCategories[0], created: false },
    ]);
    expect(count(s.dbPath, 'categories')).toBe(17);
  });

  it('marks duplicates of the catalog and of the same batch', async () => {
    const s = await initialized();
    const first = importReportSchema.parse(
      (await importJson(s, batch([tool('a')]))).json,
    );
    const result = await importJson(
      s,
      batch([
        tool('again', { url: 'http://www.a.dev/' }),
        tool('b'),
        tool('b2', { url: 'https://B.dev/#top' }),
      ]),
    );
    expect(result.exitCode).toBe(0);
    const report = importReportSchema.parse(result.json);
    expect(report.items[0]).toMatchObject({
      outcome: 'duplicate',
      duplicateOfId: first.items[0].id,
    });
    expect(report.items[1].outcome).toBe('added');
    expect(report.items[2]).toEqual({
      ref: 'b2',
      op: 'add',
      outcome: 'duplicate',
      reasons: [{ code: 'duplicate', params: { ref: 'b' } }],
    });
    expect(count(s.dbPath, 'entries')).toBe(2);
  });

  it('adds a concept without a link and marks a same-title concept as duplicate', async () => {
    const s = await initialized();
    const concept = (ref: string, name: string) => ({
      ref,
      op: 'add',
      kind: 'concept',
      name,
      categories: ['Backend & API-uri'],
      whatItDoes: 'Stil de arhitectură pentru API-uri.',
      situations: ['Când aleg forma unui API'],
      content: '# Arhitectură\n\n| a | b |\n|---|---|',
    });

    const first = importReportSchema.parse(
      (await importJson(s, batch([concept('c1', 'Arhitectură REST')]))).json,
    );
    expect(first.items[0].outcome).toBe('added');
    const id = String(first.items[0].id);

    const shown = await runCli(s, ['show', id, '--json']);
    expect(shown.exitCode).toBe(0);
    expect(
      showOutputSchema.parse(JSON.parse(shown.stdout)).entry,
    ).toMatchObject({
      id,
      kind: 'concept',
      zone: 'learn',
      url: null,
      resourceType: null,
      content: '# Arhitectură\n\n| a | b |\n|---|---|',
      sources: [],
      categories: [{ id: expect.any(String), name: 'Backend & API-uri' }],
    });

    const second = await importJson(
      s,
      batch([concept('c2', '  ARHITECTURA   rest ')]),
    );
    expect(second.exitCode).toBe(0);
    expect(importReportSchema.parse(second.json).items).toEqual([
      {
        ref: 'c2',
        op: 'add',
        outcome: 'duplicate',
        duplicateOfId: id,
        reasons: [{ code: 'duplicate' }],
      },
    ]);
    expect(count(s.dbPath, 'entries')).toBe(1);
  });

  it('rejects an item Claude flagged, keeping its text', async () => {
    const s = await initialized();
    const report = importReportSchema.parse(
      (
        await importJson(
          s,
          batch([tool('a', { flaggedByClaude: 'Pare piratat.' })]),
        )
      ).json,
    );
    expect(report.items[0]).toEqual({
      ref: 'a',
      op: 'add',
      outcome: 'rejected',
      reasons: [
        { code: 'flagged_by_claude', params: { text: 'Pare piratat.' } },
      ],
    });
    expect(count(s.dbPath, 'entries')).toBe(0);
  });

  it.each([
    [['import', 'x.json', '--json']],
    [['list', '--json']],
    [['show', 'some-id', '--json']],
  ])(
    '%j without a workspace prints an error document, exit 2',
    async (args) => {
      const s = setup({ workspaceEnv: false });
      const result = await runCli(s, args);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toBe('');
      expect(errorOutputSchema.parse(JSON.parse(result.stdout))).toEqual({
        schemaVersion: 1,
        workspace: null,
        error: {
          code: 'WORKSPACE_NOT_CONFIGURED',
          message: errorMessages.WORKSPACE_NOT_CONFIGURED,
        },
      });
    },
  );

  it.each([
    [['import', '<batch>', '--json']],
    [['list', '--json']],
    [['show', 'some-id', '--json']],
  ])('%j without a catalog exits 2 and creates nothing', async (args) => {
    const s = setup();
    mkdirSync(path.join(s.workspace, 'data'), { recursive: true });
    const file = writeBatch(s, batch([tool('a')]));
    const result = await runCli(
      s,
      args.map((arg) => (arg === '<batch>' ? file : arg)),
    );
    expect(result.exitCode).toBe(2);
    const doc = errorOutputSchema.parse(JSON.parse(result.stdout));
    expect(doc.workspace).toBe(s.workspace);
    expect(doc.error.code).toBe('CATALOG_NOT_FOUND');
    expect(existsSync(s.dbPath)).toBe(false);
  });

  it('show with an unknown id exits 1 with ENTRY_NOT_FOUND', async () => {
    const s = await initialized();
    const result = await runCli(s, ['show', 'missing', '--json']);
    expect(result.exitCode).toBe(1);
    expect(errorOutputSchema.parse(JSON.parse(result.stdout)).error.code).toBe(
      'ENTRY_NOT_FOUND',
    );

    const text = await runCli(s, ['show', 'missing']);
    expect(text.exitCode).toBe(1);
    expect(text.stdout).toBe('');
    expect(text.stderr).toContain(errorMessages.ENTRY_NOT_FOUND);
  });

  it('list and show leave the catalog file byte for byte unchanged', async () => {
    const s = await initialized();
    const report = importReportSchema.parse(
      (await importJson(s, batch([tool('a'), tool('b')]))).json,
    );
    const before = readFileSync(s.dbPath);

    expect((await runCli(s, ['list', '--json'])).exitCode).toBe(0);
    expect((await runCli(s, ['list'])).exitCode).toBe(0);
    expect(
      (await runCli(s, ['show', String(report.items[0].id), '--json']))
        .exitCode,
    ).toBe(0);
    expect((await runCli(s, ['show', 'missing'])).exitCode).toBe(1);

    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
  });

  it('list refuses a catalog that needs a migration, without migrating it', async () => {
    const s = await initialized();
    const before = readFileSync(s.dbPath);
    const withV2: CatalogStoreOpener = (dbPath, options) =>
      openCatalogStore(dbPath, {
        ...options,
        clock: fixedClock(),
        ids: sequentialIds('9000'),
        busyTimeoutMs: 100,
        migrations: [
          ...bundledMigrations(),
          {
            version: 2,
            name: 'test-extra',
            sql: 'CREATE TABLE extra (id INTEGER) STRICT;',
          },
        ],
      });
    s.deps.openStore = withV2;

    const result = await runCli(s, ['list', '--json']);
    expect(result.exitCode).toBe(3);
    expect(errorOutputSchema.parse(JSON.parse(result.stdout)).error.code).toBe(
      'DATABASE_NEEDS_MIGRATION',
    );
    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
  });

  it('import migrates a catalog that needs it, then writes', async () => {
    const s = await initialized();
    s.deps.openStore = (dbPath, options) =>
      openCatalogStore(dbPath, {
        ...options,
        clock: fixedClock(),
        ids: sequentialIds('9000'),
        busyTimeoutMs: 100,
        migrations: [
          ...bundledMigrations(),
          {
            version: 2,
            name: 'test-extra',
            sql: 'CREATE TABLE extra (id INTEGER) STRICT;',
          },
        ],
      });
    const result = await importJson(s, batch([tool('a')]));
    expect(result.exitCode).toBe(0);
    expect(count(s.dbPath, 'schema_migrations')).toBe(2);
  });

  it.each([
    [['import', '--json'], 'import'],
    [['import', 'a.json', 'b.json', '--json'], 'import'],
    [['list', '--force', '--json'], '--force'],
    [['show', '--json'], 'show'],
  ])(
    '%j is a usage error: one JSON document, exit 1',
    async (args, mention) => {
      const s = setup();
      const result = await runCli(s, args);
      expect(result.exitCode).toBe(1);
      const doc = errorOutputSchema.parse(JSON.parse(result.stdout));
      expect(doc.workspace).toBeNull();
      expect(doc.error.code).toBe('ARGUMENTS_INVALID');
      expect(doc.error.message).toContain(mention);
      expect(existsSync(s.workspace)).toBe(false);
    },
  );

  it.each([
    [['lst', '--json'], 'lst'],
    [['--json', 'list'], '--json'],
  ])(
    'unknown command %j with --json prints one error document, exit 1',
    async (args, mention) => {
      const s = setup();
      const result = await runCli(s, args);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('');
      const doc = errorOutputSchema.parse(JSON.parse(result.stdout));
      expect(doc.workspace).toBeNull();
      expect(doc.error.code).toBe('ARGUMENTS_INVALID');
      expect(doc.error.message).toContain(mention);
    },
  );

  it('prints a usage error on stderr without --json', async () => {
    const s = setup();
    const result = await runCli(s, ['list', 'extra']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('list');
  });

  it('prints the issues of an invalid batch on stderr without --json', async () => {
    const s = await initialized();
    const result = await runCli(s, [
      'import',
      writeBatch(s, batch([tool('a', { kind: 'carte' })])),
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(errorMessages.BATCH_INVALID);
    expect(result.stderr).toContain('items[0].kind');
  });
});
