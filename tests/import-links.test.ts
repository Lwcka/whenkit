import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Ajv2020 } from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import { nodeFileSystem } from '../src/adapters/fs/node-file-system';
import { main, type CliDeps } from '../src/cli/main';
import { errorOutputSchema, showOutputSchema } from '../src/core/cli-schemas';
import type { EntryDto } from '../src/core/dto';
import {
  importReportSchema,
  type ImportReport,
} from '../src/core/import-report-schema';
import type { HttpClient } from '../src/core/ports';
import {
  fakeAppRoot,
  fakeEnvironment,
  fixedClock,
  notFoundGithub,
  sequentialIds,
  tempDir,
  testStoreOpener,
} from './helpers';

// Links between entries (AD-5, AD-6) end to end through main(), on a temp
// development workspace: every row of the ticket's matrix. dead.dev answers
// 404, everything else 200.

const MISSING = '6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f';

const fakeHttp: HttpClient = {
  check: (url) =>
    Promise.resolve(
      new URL(url).hostname === 'dead.dev'
        ? { kind: 'httpError', status: 404, finalUrl: url }
        : { kind: 'ok', status: 200, finalUrl: url },
    ),
};

interface Setup {
  root: string;
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
    dbPath: path.join(workspace, 'data', 'catalog.sqlite'),
    deps: {
      env: fakeEnvironment(
        { APPDATA: appData, WHENKIT_WORKSPACE: workspace },
        appRoot,
      ),
      fs: nodeFileSystem,
      clock: fixedClock(new Date('2026-10-14T08:30:00.000Z')),
      ids: sequentialIds(),
      openStore: testStoreOpener(),
      http: fakeHttp,
      github: notFoundGithub,
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
    ...overrides,
  };
}

function concept(ref: string, overrides: Record<string, unknown> = {}) {
  return {
    ref,
    op: 'add',
    kind: 'concept',
    name: `Concept ${ref}`,
    categories: ['Backend & API-uri'],
    whatItDoes: 'Explică ceva.',
    situations: ['Când aleg'],
    content: `# ${ref}`,
    ...overrides,
  };
}

function batch(items: unknown[]) {
  return { schemaVersion: 1, items };
}

async function importReport(s: Setup, content: unknown): Promise<ImportReport> {
  const result = await runCli(s, ['import', writeBatch(s, content), '--json']);
  expect(result.exitCode).toBe(0);
  return importReportSchema.parse(JSON.parse(result.stdout));
}

/** The ids of the items of a report, by ref. */
function idsOf(report: ImportReport): Record<string, string> {
  return Object.fromEntries(
    report.items.map((item) => [item.ref, String(item.id)]),
  );
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

async function initialized(): Promise<Setup> {
  const s = setup();
  expect((await runCli(s, ['init'])).exitCode).toBe(0);
  return s;
}

describe('whenkit import with links', () => {
  it('hangs the children under an umbrella listed before them', async () => {
    const s = await initialized();
    const report = await importReport(
      s,
      batch([
        concept('api', { children: ['rest', 'graphql'] }),
        concept('rest'),
        concept('graphql'),
      ]),
    );
    expect(report.ignoredLinks).toEqual([]);
    const ids = idsOf(report);

    expect((await show(s, ids.api)).childIds).toEqual(
      [ids.rest, ids.graphql].sort(),
    );
    expect((await show(s, ids.rest)).parentIds).toEqual([ids.api]);
    expect((await show(s, ids.graphql)).parentIds).toEqual([ids.api]);

    const text = await runCli(s, ['show', ids.api]);
    expect(text.stdout).toContain(ids.rest);
    expect(text.stdout).toContain('Copii (id)');
    expect(count(s.dbPath, 'links')).toBe(2);
  });

  it('lists the id lists in `list --json` too', async () => {
    const s = await initialized();
    const ids = idsOf(
      await importReport(
        s,
        batch([concept('u', { children: ['c'] }), concept('c')]),
      ),
    );
    const list = JSON.parse((await runCli(s, ['list', '--json'])).stdout) as {
      entries: { id: string; childIds: string[]; parentIds: string[] }[];
    };
    expect(list.entries.find((e) => e.id === ids.u)?.childIds).toEqual([ids.c]);
    expect(list.entries.find((e) => e.id === ids.c)?.parentIds).toEqual([
      ids.u,
    ]);
  });

  it('relates a new entry to an existing one by id', async () => {
    const s = await initialized();
    const { a } = idsOf(await importReport(s, batch([tool('a')])));
    const { b } = idsOf(
      await importReport(s, batch([tool('b', { related: [a] })])),
    );
    expect((await show(s, a)).relatedIds).toEqual([b]);
    expect((await show(s, b)).relatedIds).toEqual([a]);
    expect(count(s.dbPath, 'links')).toBe(1);
  });

  it('stores one link for a mutual related pair', async () => {
    const s = await initialized();
    const report = await importReport(
      s,
      batch([tool('a', { related: ['b'] }), tool('b', { related: ['a'] })]),
    );
    const ids = idsOf(report);
    expect(count(s.dbPath, 'links')).toBe(1);
    expect((await show(s, ids.a)).relatedIds).toEqual([ids.b]);
    expect((await show(s, ids.b)).relatedIds).toEqual([ids.a]);
  });

  it('skips a link to a rejected or duplicate item, keeping the entry', async () => {
    const s = await initialized();
    await importReport(s, batch([tool('x', { url: 'https://dup.dev' })]));
    const report = await importReport(
      s,
      batch([
        tool('a', { related: ['dead', 'dup'] }),
        tool('dead', { url: 'https://dead.dev' }),
        tool('dup', { url: 'https://dup.dev' }),
      ]),
    );
    expect(report.items.map((i) => i.outcome)).toEqual([
      'added',
      'rejected',
      'duplicate',
    ]);
    expect(report.ignoredLinks).toEqual([
      {
        fromRef: 'a',
        to: 'dead',
        reason: { code: 'link_target_not_written', params: { ref: 'dead' } },
      },
      {
        fromRef: 'a',
        to: 'dup',
        reason: { code: 'link_target_not_written', params: { ref: 'dup' } },
      },
    ]);
    expect((await show(s, String(report.items[0].id))).relatedIds).toEqual([]);
    expect(count(s.dbPath, 'links')).toBe(0);
  });

  it('skips an unknown id', async () => {
    const s = await initialized();
    const report = await importReport(
      s,
      batch([tool('a', { related: [MISSING] })]),
    );
    expect(report.items[0].outcome).toBe('added');
    expect(report.ignoredLinks).toEqual([
      {
        fromRef: 'a',
        to: MISSING,
        reason: { code: 'unknown_id', params: { id: MISSING } },
      },
    ]);
    expect(count(s.dbPath, 'links')).toBe(0);
  });

  it('skips a child that is the id of a tool, and says so in the text output', async () => {
    const s = await initialized();
    const { a } = idsOf(await importReport(s, batch([tool('a')])));
    const result = await runCli(s, [
      'import',
      writeBatch(s, batch([concept('u', { children: [a] })])),
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Legături ignorate:');
    expect(result.stdout).toContain(`u → ${a}`);
    expect(count(s.dbPath, 'links')).toBe(0);

    const report = await importReport(
      s,
      batch([concept('u2', { children: [a] })]),
    );
    expect(report.ignoredLinks).toEqual([
      {
        fromRef: 'u2',
        to: a,
        reason: { code: 'parent_requires_concept', params: { id: a } },
      },
    ]);
  });

  it('never writes a link that closes a cycle', async () => {
    const s = await initialized();
    const ids = idsOf(
      await importReport(
        s,
        batch([concept('x', { children: ['y'] }), concept('y')]),
      ),
    );
    const report = await importReport(
      s,
      batch([concept('y', { op: 'update', id: ids.y, children: [ids.x] })]),
    );
    expect(report.items[0].outcome).toBe('updated');
    expect(report.ignoredLinks).toEqual([
      {
        fromRef: 'y',
        to: ids.x,
        reason: { code: 'parent_cycle', params: { id: ids.x } },
      },
    ]);
    expect((await show(s, ids.y)).childIds).toEqual([]);
    expect((await show(s, ids.x)).childIds).toEqual([ids.y]);
  });

  it('replaces the related set of an update', async () => {
    const s = await initialized();
    const ids = idsOf(
      await importReport(
        s,
        batch([
          tool('a', { related: ['e1', 'e2'] }),
          tool('e1'),
          tool('e2'),
          tool('e3'),
        ]),
      ),
    );
    expect((await show(s, ids.a)).relatedIds).toEqual([ids.e1, ids.e2].sort());
    await importReport(
      s,
      batch([tool('a', { op: 'update', id: ids.a, related: [ids.e3] })]),
    );
    expect((await show(s, ids.a)).relatedIds).toEqual([ids.e3]);
    expect((await show(s, ids.e1)).relatedIds).toEqual([]);
    expect((await show(s, ids.e3)).relatedIds).toEqual([ids.a]);
  });

  it('keeps the child links of an update that omits children', async () => {
    const s = await initialized();
    const ids = idsOf(
      await importReport(
        s,
        batch([concept('u', { children: ['c'] }), concept('c')]),
      ),
    );
    await importReport(
      s,
      batch([concept('u', { op: 'update', id: ids.u, name: 'Umbrelă nouă' })]),
    );
    expect((await show(s, ids.u)).childIds).toEqual([ids.c]);
    await importReport(
      s,
      batch([concept('u', { op: 'update', id: ids.u, children: [] })]),
    );
    expect((await show(s, ids.u)).childIds).toEqual([]);
  });

  it('removes the parent links of a concept turned into a tool', async () => {
    const s = await initialized();
    const ids = idsOf(
      await importReport(
        s,
        batch([concept('u', { children: ['c'] }), concept('c')]),
      ),
    );
    const report = await importReport(
      s,
      batch([tool('c', { op: 'update', id: ids.c })]),
    );
    expect(report.items[0].outcome).toBe('updated');
    expect(report.ignoredLinks).toEqual([
      {
        fromRef: 'c',
        to: ids.u,
        reason: { code: 'parent_requires_concept', params: { id: ids.c } },
      },
    ]);
    expect((await show(s, ids.u)).childIds).toEqual([]);
    expect((await show(s, ids.c)).kind).toBe('tool');
  });

  describe('a bad target is a bad batch', () => {
    it.each([
      ['neither a ref nor an id', [tool('a', { related: ['nope'] })]],
      ['the item itself', [tool('a', { related: ['a'] })]],
      [
        'a child ref naming a tool',
        [concept('u', { children: ['a'] }), tool('a')],
      ],
    ])(
      'refuses %s with BATCH_INVALID and writes nothing',
      async (_l, items) => {
        const s = await initialized();
        const before = readFileSync(s.dbPath);
        const result = await runCli(s, [
          'import',
          writeBatch(s, batch(items)),
          '--json',
        ]);
        expect(result.exitCode).toBe(1);
        const doc = errorOutputSchema.parse(JSON.parse(result.stdout));
        expect(doc.error.code).toBe('BATCH_INVALID');
        expect(readFileSync(s.dbPath).equals(before)).toBe(true);
      },
    );
  });
});

describe('whenkit schema', () => {
  it('prints a JSON Schema that tells a correct batch from a wrong one', async () => {
    const s = setup(); // no init: `schema` needs no workspace
    s.deps.env = fakeEnvironment({}, s.deps.env.appRoot());
    const result = await runCli(s, ['schema']);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');

    const validate = new Ajv2020({ strict: false }).compile(
      JSON.parse(result.stdout) as object,
    );
    const update = { ...tool('u'), op: 'update', id: MISSING };
    const good = batch([
      concept('c', { children: ['u'], related: [MISSING] }),
      update,
    ]);
    expect(validate(good)).toBe(true);
    expect(validate(batch([{ ...tool('a'), nope: 1 }]))).toBe(false);
    expect(validate(batch([{ ...tool('a'), op: 'update' }]))).toBe(false);
    expect(validate(batch([{ ...tool('a'), id: MISSING }]))).toBe(false);
  });
});
