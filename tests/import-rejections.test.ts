import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nodeFileSystem } from '../src/adapters/fs/node-file-system';
import { main, type CliDeps } from '../src/cli/main';
import { batchSchema } from '../src/core/batch-schema';
import {
  errorOutputSchema,
  rejectionsOutputSchema,
  showOutputSchema,
} from '../src/core/cli-schemas';
import type { EntryDto, RejectionDto } from '../src/core/dto';
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

// The rejection journal and `--force` (AD-5, AD-7, AD-11) end to end through
// main(), on a temp development workspace. Links are checked by a fake
// HttpClient: dead.dev answers 404, everything else 200. libgen.is is on the
// template's blocked-domain list.

const NOW = '2026-10-13T12:00:00.000Z';
const BLOCKED_URL = 'https://libgen.is/book';

const fakeHttp: HttpClient = {
  check: (url) => {
    if (new URL(url).hostname === 'dead.dev') {
      return Promise.resolve({ kind: 'httpError', status: 404, finalUrl: url });
    }
    return Promise.resolve({ kind: 'ok', status: 200, finalUrl: url });
  },
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
      clock: fixedClock(new Date(NOW)),
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

async function initialized(): Promise<Setup> {
  const s = setup();
  expect((await runCli(s, ['init'])).exitCode).toBe(0);
  return s;
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

function batch(items: unknown[]) {
  return { schemaVersion: 1, items };
}

async function importJson(s: Setup, content: unknown, flags: string[] = []) {
  const result = await runCli(s, [
    'import',
    writeBatch(s, content),
    '--json',
    ...flags,
  ]);
  return { ...result, json: JSON.parse(result.stdout) as unknown };
}

async function importReport(
  s: Setup,
  content: unknown,
  flags: string[] = [],
): Promise<ImportReport> {
  const result = await importJson(s, content, flags);
  expect(result.exitCode).toBe(0);
  return importReportSchema.parse(result.json);
}

async function journal(s: Setup): Promise<RejectionDto[]> {
  const result = await runCli(s, ['rejections', '--json']);
  expect(result.exitCode).toBe(0);
  return rejectionsOutputSchema.parse(JSON.parse(result.stdout)).rejections;
}

async function show(s: Setup, id: string): Promise<EntryDto> {
  const result = await runCli(s, ['show', id, '--json']);
  expect(result.exitCode).toBe(0);
  return showOutputSchema.parse(JSON.parse(result.stdout)).entry;
}

describe('the rejection journal', () => {
  it('lists a rejected item with its element, reasons, key and op', async () => {
    const s = await initialized();
    const item = tool('gutenberg', { url: 'httpss://gutenberg.org' });
    const report = await importReport(s, batch([item]));
    expect(report.items).toEqual([
      {
        ref: 'gutenberg',
        op: 'add',
        outcome: 'rejected',
        reasons: [{ code: 'invalid_url' }],
      },
    ]);

    const rows = await journal(s);
    expect(rows).toEqual([
      {
        id: expect.any(String),
        op: 'add',
        // As it passed the schema: the defaults are filled in.
        element: { ...item, related: [] },
        reasons: [{ code: 'invalid_url' }],
        dedupKey: 'url:gutenberg.org',
        batchSchemaVersion: 1,
        rejectedAt: NOW,
      },
    ]);
  });

  it('gives an element that imports again as a batch item', async () => {
    const s = await initialized();
    await importReport(
      s,
      batch([
        tool('a', { url: 'httpss://a.dev' }),
        {
          ref: 'c',
          op: 'add',
          kind: 'concept',
          name: 'REST',
          categories: ['Backend & API-uri'],
          whatItDoes: 'Stil de API.',
          situations: ['Când aleg un API'],
          content: '# REST',
          sources: [BLOCKED_URL],
        },
      ]),
    );
    const rows = await journal(s);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const again = batchSchema.safeParse(batch([row.element]));
      expect(again.success).toBe(true);
    }
  });

  it('clears the row when the same resource is imported with a working link', async () => {
    const s = await initialized();
    await importReport(
      s,
      batch([tool('gutenberg', { url: 'httpss://gutenberg.org' })]),
    );
    expect(await journal(s)).toHaveLength(1);

    const report = await importReport(
      s,
      batch([tool('gutenberg', { url: 'https://gutenberg.org' })]),
    );
    expect(report.items[0]).toMatchObject({ outcome: 'added' });
    expect(await journal(s)).toEqual([]);
  });

  it('keeps one row when the same rejected item is imported twice', async () => {
    const s = await initialized();
    const content = batch([tool('a', { url: 'httpss://a.dev' })]);
    await importReport(s, content);
    const [first] = await journal(s);
    await importReport(s, content);
    const rows = await journal(s);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(first.id);
  });

  it('journals the rejections of Claude, of an unknown category and of an unknown id', async () => {
    const s = await initialized();
    await importReport(
      s,
      batch([
        tool('a', { flaggedByClaude: 'pare piratat' }),
        tool('b', { categories: ['Inexistentă'] }),
        tool('c', { op: 'update', id: '6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f' }),
        tool('d', { url: 'https://dead.dev' }),
      ]),
    );
    const rows = await journal(s);
    expect(rows.map((row) => [row.dedupKey, row.op])).toEqual([
      ['url:a.dev', 'add'],
      ['url:b.dev', 'add'],
      ['url:c.dev', 'update'],
      ['url:dead.dev', 'add'],
    ]);
  });

  it('does not journal a duplicate', async () => {
    const s = await initialized();
    await importReport(s, batch([tool('a')]));
    const report = await importReport(
      s,
      batch([tool('again', { url: 'https://www.a.dev/' })]),
    );
    expect(report.items[0]).toMatchObject({ outcome: 'duplicate' });
    expect(await journal(s)).toEqual([]);
  });

  it('prints one text line per row: name, reasons in Romanian, date', async () => {
    const s = await initialized();
    expect((await runCli(s, ['rejections'])).stdout).toBe(
      'Jurnalul de respinse e gol.\n',
    );
    await importReport(
      s,
      batch([
        tool('gutenberg', { url: 'httpss://gutenberg.org' }),
        tool('dead', { url: 'https://dead.dev' }),
      ]),
    );
    const result = await runCli(s, ['rejections']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      [
        `Tool gutenberg — linkul nu e un URL http(s) valid (de exemplu, o greșeală de scriere) (${NOW})`,
        `Tool dead — linkul nu funcționează: site-ul răspunde cu eroarea HTTP 404 (${NOW})`,
        '',
      ].join('\n'),
    );
  });

  it('never writes', async () => {
    const s = await initialized();
    await importReport(s, batch([tool('a', { url: 'httpss://a.dev' })]));
    const before = readFileSync(s.dbPath);
    await runCli(s, ['rejections', '--json']);
    await runCli(s, ['rejections']);
    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
  });
});

describe('whenkit import --force', () => {
  it('writes an item only the verification rejected, forced, and clears its row', async () => {
    const s = await initialized();
    const content = batch([tool('book', { url: BLOCKED_URL })]);
    const rejected = await importReport(s, content);
    expect(rejected.items[0]).toMatchObject({ outcome: 'rejected' });
    expect(await journal(s)).toHaveLength(1);

    const report = await importReport(s, content, ['--force', 'book']);
    expect(report.items).toEqual([
      {
        ref: 'book',
        op: 'add',
        outcome: 'warned',
        id: expect.any(String),
        reasons: [
          { code: 'blocked_domain', params: { domain: 'libgen.*' } },
          { code: 'forced_by_user' },
        ],
      },
    ]);
    const entry = await show(s, String(report.items[0].id));
    expect(entry.forced).toBe(true);
    expect(entry.verificationNotes).toEqual(report.items[0].reasons);
    expect(await journal(s)).toEqual([]);
  });

  it('forces several refs and prints the notes in the text report', async () => {
    const s = await initialized();
    const result = await runCli(s, [
      'import',
      '--force',
      'one',
      writeBatch(
        s,
        batch([
          tool('one', { url: BLOCKED_URL }),
          tool('two', { flaggedByClaude: 'dubios' }),
          tool('three', { url: 'https://dead.dev' }),
        ]),
      ),
      '--force',
      'two',
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('one: adăugată cu avertisment');
    expect(result.stdout).toContain('two: adăugată cu avertisment');
    expect(result.stdout).toContain('three: respinsă');
    expect(result.stdout).toContain('verificare ocolită de utilizator');
    expect(result.stdout).toContain(
      'Rezumat: 0 adăugate, 0 actualizate, 2 cu avertisment, 1 respinse, 0 duplicate.',
    );
  });

  it('does not force a duplicate: nothing written', async () => {
    const s = await initialized();
    await importReport(s, batch([tool('a')]));
    const report = await importReport(
      s,
      batch([
        tool('x', { url: 'http://www.a.dev/', flaggedByClaude: 'dubios' }),
      ]),
      ['--force', 'x'],
    );
    expect(report.items[0]).toMatchObject({ outcome: 'duplicate' });
    expect(await journal(s)).toEqual([]);
  });

  it('does not force an unknown category: rejected with both reasons, journaled', async () => {
    const s = await initialized();
    const report = await importReport(
      s,
      batch([
        tool('x', { url: 'https://dead.dev', categories: ['Inexistentă'] }),
      ]),
      ['--force', 'x'],
    );
    expect(report.items).toEqual([
      {
        ref: 'x',
        op: 'add',
        outcome: 'rejected',
        reasons: [
          { code: 'http_error', params: { status: '404' } },
          { code: 'unknown_category', params: { name: 'Inexistentă' } },
        ],
      },
    ]);
    expect(await journal(s)).toHaveLength(1);
  });

  it('has no effect on an item that was not rejected', async () => {
    const s = await initialized();
    const report = await importReport(s, batch([tool('a')]), ['--force', 'a']);
    expect(report.items[0]).toMatchObject({ outcome: 'added', reasons: [] });
    expect((await show(s, String(report.items[0].id))).forced).toBe(false);
  });

  it('refuses a ref that is not in the batch: exit 1, nothing written', async () => {
    const s = await initialized();
    await importReport(s, batch([tool('a', { url: 'httpss://a.dev' })]));
    const before = readFileSync(s.dbPath);
    const result = await importJson(s, batch([tool('b')]), ['--force', 'nope']);
    expect(result.exitCode).toBe(1);
    const doc = errorOutputSchema.parse(result.json);
    expect(doc.error.code).toBe('BATCH_INVALID');
    expect(doc.error.issues?.map((issue) => issue.path)).toEqual([
      ['force', 0],
    ]);
    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
  });

  it.each([
    [['--force']],
    [['--force', '--json']],
    [['--force', '--force', 'a']],
  ])('is a usage error without a ref: %j', async (flags) => {
    const s = await initialized();
    const before = readFileSync(s.dbPath);
    const result = await runCli(s, [
      'import',
      writeBatch(s, batch([tool('a')])),
      ...flags,
      '--json',
    ]);
    expect(result.exitCode).toBe(1);
    expect(errorOutputSchema.parse(JSON.parse(result.stdout)).error.code).toBe(
      'ARGUMENTS_INVALID',
    );
    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
  });

  it('prints the usage error on stderr without --json', async () => {
    const s = await initialized();
    const result = await runCli(s, ['import', 'batch.json', '--force']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('--force');
  });
});

describe('a forced entry stays forced', () => {
  async function forcedEntry(s: Setup) {
    const report = await importReport(
      s,
      batch([tool('book', { url: BLOCKED_URL })]),
      ['--force', 'book'],
    );
    return String(report.items[0].id);
  }

  it('keeps the flag and the note on a later plain update that passes', async () => {
    const s = await initialized();
    const id = await forcedEntry(s);
    const report = await importReport(
      s,
      batch([
        tool('book', { op: 'update', id, url: 'https://ok.dev', name: 'Nou' }),
      ]),
    );
    expect(report.items[0]).toMatchObject({ outcome: 'updated', id });

    const entry = await show(s, id);
    expect(entry).toMatchObject({ name: 'Nou', forced: true, revision: 2 });
    expect(entry.verificationNotes).toEqual([{ code: 'forced_by_user' }]);
  });

  it('rejects a plain update still on the blocked domain, leaving the entry', async () => {
    const s = await initialized();
    const id = await forcedEntry(s);
    const before = await show(s, id);

    const report = await importReport(
      s,
      batch([
        tool('book', { op: 'update', id, url: BLOCKED_URL, name: 'Nou' }),
      ]),
    );
    expect(report.items[0]).toMatchObject({ outcome: 'rejected' });
    expect(await show(s, id)).toEqual(before);

    const rows = await journal(s);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ op: 'update' });
    expect(rows[0].element).toMatchObject({ id, name: 'Nou' });
  });

  it('writes the note once when an update is forced again', async () => {
    const s = await initialized();
    const id = await forcedEntry(s);
    await importReport(
      s,
      batch([tool('book', { op: 'update', id, url: BLOCKED_URL })]),
      ['--force', 'book'],
    );
    const entry = await show(s, id);
    expect(entry.forced).toBe(true);
    expect(entry.verificationNotes).toEqual([
      { code: 'blocked_domain', params: { domain: 'libgen.*' } },
      { code: 'forced_by_user' },
    ]);
  });
});

function concept(ref: string, overrides: Record<string, unknown> = {}) {
  return {
    ref,
    op: 'add',
    kind: 'concept',
    name: `Concept ${ref}`,
    categories: ['Backend & API-uri'],
    whatItDoes: 'Explică ceva.',
    situations: ['Când învăț ceva nou'],
    content: `# ${ref}`,
    ...overrides,
  };
}

describe('retrying from the journal', () => {
  it('retries a rejected umbrella alone: refs become ids or are dropped', async () => {
    const s = await initialized();
    const report = await importReport(
      s,
      batch([
        concept('umbrella', {
          url: 'httpss://umbrella.dev',
          children: ['child', 'lost'],
          related: ['tool'],
        }),
        concept('child'),
        concept('lost', { url: 'https://dead.dev' }),
        tool('tool'),
      ]),
    );
    const ids = new Map(report.items.map((item) => [item.ref, item.id]));
    const rows = await journal(s);
    const umbrella = rows.find((row) => row.dedupKey === 'url:umbrella.dev');
    expect(umbrella?.element).toMatchObject({
      children: [ids.get('child')],
      related: [ids.get('tool')],
    });
    for (const row of rows) {
      expect(batchSchema.safeParse(batch([row.element])).success).toBe(true);
    }

    // Retried alone with a working link: written, row cleared, links made.
    const retry = await importReport(
      s,
      batch([{ ...umbrella?.element, url: 'https://umbrella.dev' }]),
    );
    expect(retry.items[0]).toMatchObject({ outcome: 'added' });
    expect(retry.ignoredLinks).toEqual([]);
    expect((await journal(s)).map((row) => row.dedupKey)).toEqual([
      'url:dead.dev',
    ]);
  });

  it('does not journal a rejected add whose url is already in the catalog, in either order', async () => {
    const s = await initialized();
    const clone = tool('clone', {
      url: 'https://a.dev/',
      flaggedByClaude: 'x',
    });

    // Existing in the catalog.
    await importReport(s, batch([tool('a')]));
    await importReport(s, batch([clone]));
    expect(await journal(s)).toEqual([]);

    // Written earlier, then rejected, in one batch.
    const first = await initialized();
    await importReport(first, batch([tool('a'), clone]));
    expect(await journal(first)).toEqual([]);

    // Rejected first, written later, in one batch.
    const second = await initialized();
    await importReport(second, batch([clone, tool('a')]));
    expect(await journal(second)).toEqual([]);
  });
});

describe('a stale journaled update', () => {
  it('disappears once a later update of the same entry is written', async () => {
    const s = await initialized();
    const added = await importReport(s, batch([tool('a')]));
    const id = String(added.items[0].id);

    const rejected = await importReport(
      s,
      batch([tool('a', { op: 'update', id, url: 'https://dead.dev' })]),
    );
    expect(rejected.items[0]).toMatchObject({ outcome: 'rejected' });
    expect(await journal(s)).toHaveLength(1);

    const updated = await importReport(
      s,
      batch([tool('a', { op: 'update', id, url: 'https://other.dev' })]),
    );
    expect(updated.items[0]).toMatchObject({ outcome: 'updated', id });
    expect(await journal(s)).toEqual([]);
  });
});

describe('the journal across rejected updates', () => {
  it('keeps only the latest rejected update of an entry', async () => {
    const s = await initialized();
    const added = await importReport(s, batch([tool('a')]));
    const id = String(added.items[0].id);

    await importReport(
      s,
      batch([tool('a', { op: 'update', id, url: 'https://dead.dev' })]),
    );
    await importReport(
      s,
      batch([tool('a', { op: 'update', id, url: BLOCKED_URL })]),
    );

    const rows = await journal(s);
    expect(rows).toHaveLength(1);
    expect(rows[0].dedupKey).toBe('url:libgen.is/book');
    expect(rows[0].element).toMatchObject({ id, url: BLOCKED_URL });
  });

  it('rewrites a link to a rejected update into the id of its existing entry', async () => {
    const s = await initialized();
    const added = await importReport(s, batch([tool('a')]));
    const id = String(added.items[0].id);

    const report = await importReport(
      s,
      batch([
        tool('a', { op: 'update', id, url: 'https://dead.dev' }),
        tool('b', { flaggedByClaude: 'x', related: ['a'] }),
      ]),
    );
    expect(report.items.map((i) => i.outcome)).toEqual([
      'rejected',
      'rejected',
    ]);

    const rows = await journal(s);
    const element = rows.find((r) => r.op === 'add')?.element;
    expect(element).toMatchObject({ ref: 'b', related: [id] });
    expect(batchSchema.safeParse(batch([element])).success).toBe(true);
  });
});

describe('--force on what the verification would have checked', () => {
  it('verifies a forced flagged item: the flag and the invalid url are both listed', async () => {
    const s = await initialized();
    const report = await importReport(
      s,
      batch([
        tool('a', { url: 'httpss://a.dev', flaggedByClaude: 'pare dubios' }),
      ]),
      ['--force', 'a'],
    );
    expect(report.items[0]).toMatchObject({
      outcome: 'warned',
      reasons: [
        { code: 'flagged_by_claude', params: { text: 'pare dubios' } },
        { code: 'invalid_url' },
        { code: 'forced_by_user' },
      ],
    });
    const entry = await show(s, String(report.items[0].id));
    expect(entry.forced).toBe(true);
    expect(entry.verificationNotes).toEqual(report.items[0].reasons);
  });

  it('keeps the blocked source of a forced concept and notes the dead one', async () => {
    const s = await initialized();
    const report = await importReport(
      s,
      batch([
        concept('rest', {
          sources: [BLOCKED_URL, 'https://dead.dev/page', 'https://ok.dev/'],
        }),
      ]),
      ['--force', 'rest'],
    );
    expect(report.items[0]).toMatchObject({
      outcome: 'warned',
      reasons: [
        {
          code: 'source_blocked_domain',
          params: { url: BLOCKED_URL, domain: 'libgen.*' },
        },
        {
          code: 'source_link_removed',
          params: { url: 'https://dead.dev/page' },
        },
        { code: 'forced_by_user' },
      ],
    });
    const entry = await show(s, String(report.items[0].id));
    expect(entry.sources).toEqual([BLOCKED_URL, 'https://ok.dev/']);
    expect(entry.forced).toBe(true);
  });
});
