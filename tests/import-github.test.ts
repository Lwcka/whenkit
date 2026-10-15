import { describe, expect, it } from 'vitest';
import {
  importReportSchema,
  type ImportReport,
} from '../src/core/import-report-schema';
import type { GitHubClient, GitHubResult, HttpClient } from '../src/core/ports';
import {
  batch,
  importReport,
  runCli,
  setup as baseSetup,
  show,
  writeBatch,
  type CliSetup,
} from './cli-harness';
import { fixedClock } from './helpers';

// GitHub metadata (CAP-5, AD-6, AD-7) end to end through main(): a fake
// HttpClient for the link checks and a fake GitHubClient, so nothing reaches
// the real GitHub.

const PUSHED_AT = '2026-09-01T10:00:00Z';

const active: GitHubResult = {
  kind: 'ok',
  stars: 1200,
  pushedAt: PUSHED_AT,
  archived: false,
};
const archived: GitHubResult = { ...active, stars: 30, archived: true };

/** `github.com/o/gone` answers 404 to the link check; the rest answers 200. */
const fakeHttp: HttpClient = {
  check: (url) =>
    Promise.resolve(
      url.includes('/o/gone')
        ? { kind: 'httpError', status: 404, finalUrl: url }
        : { kind: 'ok', status: 200, finalUrl: url },
    ),
};

/** Answers each `owner/repo` with its script, `notFound` otherwise; logs calls. */
class FakeGithub implements GitHubClient {
  readonly calls: string[] = [];

  constructor(public script: Record<string, GitHubResult> = {}) {}

  repo(owner: string, repo: string): Promise<GitHubResult> {
    this.calls.push(`${owner}/${repo}`);
    return Promise.resolve(
      this.script[`${owner}/${repo}`] ?? { kind: 'notFound' },
    );
  }
}

interface Setup extends CliSetup {
  github: FakeGithub;
}

async function setup(script: Record<string, GitHubResult>): Promise<Setup> {
  const github = new FakeGithub(script);
  const s: Setup = {
    ...baseSetup({
      clock: fixedClock(new Date('2026-10-14T09:00:00.000Z')),
      http: fakeHttp,
      github,
      retryDelayMs: 0,
    }),
    github,
  };
  expect((await runCli(s, ['init'])).exitCode).toBe(0);
  return s;
}

function tool(ref: string, url: string, overrides = {}) {
  return {
    ref,
    op: 'add',
    kind: 'tool',
    name: `Tool ${ref}`,
    url,
    resourceType: 'repo',
    categories: ['Imagini & video'],
    whatItDoes: 'Face ceva util.',
    situations: ['Când am nevoie de el'],
    keywords: ['util'],
    ...overrides,
  };
}

function importItems(s: Setup, items: unknown[]): Promise<ImportReport> {
  return importReport(s, batch(items));
}

const NO_GITHUB = {
  githubStars: null,
  githubPushedAt: null,
  githubArchived: null,
};

describe('import with GitHub metadata', () => {
  it('stores stars and last push; only an archived repo gets the flag and the note', async () => {
    const s = await setup({ 'o/live': active, 'o/old': archived });
    const report = await importItems(s, [
      tool('live', 'https://github.com/o/live'),
      tool('old', 'https://github.com/o/old'),
    ]);

    expect(report.items.map((i) => i.outcome)).toEqual(['added', 'added']);
    expect(report.items[0].reasons).toEqual([]);
    expect(report.items[1].reasons).toEqual([{ code: 'github_archived' }]);

    const live = await show(s, report.items[0].id);
    expect(live).toMatchObject({
      githubStars: 1200,
      githubPushedAt: PUSHED_AT,
      githubArchived: false,
      verificationNotes: [],
    });
    const old = await show(s, report.items[1].id);
    expect(old).toMatchObject({
      githubStars: 30,
      githubPushedAt: PUSHED_AT,
      githubArchived: true,
      verificationNotes: [{ code: 'github_archived' }],
    });
  });

  it('notes a repo with no push for more than 24 months as abandoned, and still adds it', async () => {
    // The clock is 2026-10-14: 2024-09-01 is 25 months back, 2024-11-20 is 23.
    const s = await setup({
      'o/stale': { ...active, pushedAt: '2024-09-01T10:00:00Z' },
      'o/quiet': { ...active, pushedAt: '2024-11-20T10:00:00Z' },
      'o/both': { ...archived, pushedAt: '2024-09-01T10:00:00Z' },
    });
    const report = await importItems(s, [
      tool('stale', 'https://github.com/o/stale'),
      tool('quiet', 'https://github.com/o/quiet'),
      tool('both', 'https://github.com/o/both'),
    ]);

    expect(report.items.map((i) => i.outcome)).toEqual([
      'added',
      'added',
      'added',
    ]);
    const abandoned = {
      code: 'github_abandoned',
      params: { pushedAt: '2024-09-01' },
    };
    expect(report.items[0].reasons).toEqual([abandoned]);
    expect(report.items[1].reasons).toEqual([]);
    // Archived says more: no second note.
    expect(report.items[2].reasons).toEqual([{ code: 'github_archived' }]);
    expect(await show(s, report.items[0].id)).toMatchObject({
      verificationNotes: [abandoned],
    });

    const text = await runCli(s, ['show', String(report.items[0].id)]);
    expect(text.stdout).toContain(
      'repo abandonat pe GitHub: ultimul push pe 2024-09-01',
    );
  });

  it.each<[string, GitHubResult]>([
    ['the rate limit', { kind: 'rateLimited' }],
    ['a failure (5xx, timeout, malformed body)', { kind: 'failed' }],
    ['a 404', { kind: 'notFound' }],
  ])(
    'adds the entry without data when the API answers %s',
    async (_n, answer) => {
      const s = await setup({ 'o/r': answer });
      const report = await importItems(s, [
        tool('r', 'https://github.com/o/r'),
      ]);
      expect(report.items[0]).toMatchObject({ outcome: 'added', reasons: [] });
      expect(await show(s, report.items[0].id)).toMatchObject(NO_GITHUB);
      expect(s.github.calls).toEqual(['o/r']);
    },
  );

  it('makes no API call for a URL that is not a repo', async () => {
    const s = await setup({ 'o/r': active, 'u/1': active });
    const report = await importItems(s, [
      tool('site', 'https://example.com/'),
      tool('topic', 'https://github.com/topics/x'),
      tool('gist', 'https://gist.github.com/u/1'),
      tool('owner', 'https://github.com/o'),
    ]);
    expect(report.items.map((i) => i.outcome)).toEqual([
      'added',
      'added',
      'added',
      'added',
    ]);
    expect(s.github.calls).toEqual([]);
    for (const item of report.items) {
      expect(await show(s, item.id)).toMatchObject(NO_GITHUB);
    }
  });

  it('reads the repo of a subpath and of a .git URL', async () => {
    const s = await setup({ 'O/R': active, 'o/r2': archived });
    const report = await importItems(s, [
      tool('tree', 'https://github.com/O/R/tree/main/docs'),
      tool('git', 'https://github.com/o/r2.git'),
    ]);
    expect([...s.github.calls].sort()).toEqual(['O/R', 'o/r2']);
    expect(await show(s, report.items[0].id)).toMatchObject({
      githubStars: 1200,
    });
    expect(await show(s, report.items[1].id)).toMatchObject({
      githubStars: 30,
      githubArchived: true,
    });
  });

  it('rejects a dead repo link without asking the API', async () => {
    const s = await setup({ 'o/gone': active });
    const report = await importItems(s, [
      tool('gone', 'https://github.com/o/gone'),
    ]);
    expect(report.items[0].outcome).toBe('rejected');
    expect(s.github.calls).toEqual([]);
  });

  it('recomputes the fields on update and bumps the revision', async () => {
    const s = await setup({ 'o/r': active });
    const added = await importItems(s, [tool('r', 'https://github.com/o/r')]);
    const id = String(added.items[0].id);
    expect(await show(s, id)).toMatchObject({ githubStars: 1200, revision: 1 });

    s.github.script = { 'o/r': { ...archived, stars: 1300 } };
    const updated = await importItems(s, [
      tool('r', 'https://github.com/o/r', { op: 'update', id }),
    ]);
    expect(updated.items[0].outcome).toBe('updated');
    expect(await show(s, id)).toMatchObject({
      githubStars: 1300,
      githubArchived: true,
      revision: 2,
      verificationNotes: [{ code: 'github_archived' }],
    });
  });

  it('nulls the fields when the update is off GitHub or the API does not answer', async () => {
    const s = await setup({ 'o/r': active });
    const added = await importItems(s, [tool('r', 'https://github.com/o/r')]);
    const id = String(added.items[0].id);

    s.github.script = { 'o/r': { kind: 'rateLimited' } };
    await importItems(s, [
      tool('r', 'https://github.com/o/r', { op: 'update', id }),
    ]);
    expect(await show(s, id)).toMatchObject({ ...NO_GITHUB, revision: 2 });

    s.github.script = { 'o/r': active };
    await importItems(s, [
      tool('r', 'https://github.com/o/r', { op: 'update', id }),
    ]);
    expect(await show(s, id)).toMatchObject({ githubStars: 1200, revision: 3 });

    const calls = s.github.calls.length;
    await importItems(s, [
      tool('r', 'https://example.com/r', { op: 'update', id }),
    ]);
    expect(await show(s, id)).toMatchObject({ ...NO_GITHUB, revision: 4 });
    expect(s.github.calls).toHaveLength(calls);
  });

  it('writes the fields of a forced item, whose link works', async () => {
    const s = await setup({ 'o/r': active });
    const file = writeBatch(
      s,
      batch([
        tool('r', 'https://github.com/o/r', { flaggedByClaude: 'dubios' }),
      ]),
    );
    const result = await runCli(s, ['import', file, '--json', '--force', 'r']);
    expect(result.exitCode).toBe(0);
    const report = importReportSchema.parse(JSON.parse(result.stdout));
    expect(report.items[0].outcome).toBe('warned');
    expect(await show(s, report.items[0].id)).toMatchObject({
      forced: true,
      githubStars: 1200,
    });
  });
});
