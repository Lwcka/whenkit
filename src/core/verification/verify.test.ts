import { describe, expect, it } from 'vitest';
import { parseBatch } from '../import-batch';
import { WhenkitError } from '../errors';
import type {
  GitHubClient,
  GitHubResult,
  HttpClient,
  HttpResult,
} from '../ports';
import {
  checkLink,
  verifyBatch,
  verifyItem,
  type VerificationContext,
} from './verify';

// Verification on a fake HttpClient (AD-2): every answer is scripted per
// URL, so no test reaches the network, and waits are recorded, not slept.

const ok = (url: string): HttpResult => ({
  kind: 'ok',
  status: 200,
  finalUrl: url,
});
const status = (code: number, url: string): HttpResult => ({
  kind: 'httpError',
  status: code,
  finalUrl: url,
});

/**
 * Answers each URL with its scripted results in turn (the last one repeats);
 * an unscripted URL answers 200. Records every check and the peak number of
 * checks in flight.
 */
class FakeHttp implements HttpClient {
  readonly calls: string[] = [];
  inFlight = 0;
  peak = 0;

  constructor(
    private readonly script: Record<string, HttpResult[]> = {},
    private readonly delayMs = 0,
  ) {}

  async check(url: string): Promise<HttpResult> {
    const attempt = this.calls.filter((u) => u === url).length;
    this.calls.push(url);
    this.inFlight += 1;
    this.peak = Math.max(this.peak, this.inFlight);
    try {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      const results = this.script[url];
      if (results === undefined) return ok(url);
      return results[Math.min(attempt, results.length - 1)];
    } finally {
      this.inFlight -= 1;
    }
  }
}

/** Answers each `owner/repo` with its scripted result; records every call. */
class FakeGithub implements GitHubClient {
  readonly calls: string[] = [];

  constructor(private readonly script: Record<string, GitHubResult> = {}) {}

  repo(owner: string, repo: string): Promise<GitHubResult> {
    this.calls.push(`${owner}/${repo}`);
    return Promise.resolve(
      this.script[`${owner}/${repo}`] ?? { kind: 'notFound' },
    );
  }
}

const RULES = ['libgen.*', 'pdfdrive.com'];

function context(
  http: HttpClient,
  waits: number[] = [],
  github: GitHubClient = new FakeGithub(),
): VerificationContext {
  return {
    http,
    github,
    blockedDomains: RULES,
    wait: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

const URL_A = 'https://a.dev/';

describe('checkLink (AD-7 table)', () => {
  it('rejects bad syntax without a request', async () => {
    const http = new FakeHttp();
    expect(await checkLink('httpss://gutenberg.org', context(http))).toEqual({
      kind: 'rejected',
      reason: { code: 'invalid_url' },
    });
    expect(http.calls).toEqual([]);
  });

  it('rejects a blocked submitted URL without a request', async () => {
    const http = new FakeHttp();
    expect(await checkLink('https://www.libgen.is/x', context(http))).toEqual({
      kind: 'rejected',
      reason: { code: 'blocked_domain', params: { domain: 'libgen.*' } },
    });
    expect(http.calls).toEqual([]);
  });

  it('accepts 2xx and 3xx', async () => {
    const http = new FakeHttp({
      [URL_A]: [{ kind: 'ok', status: 304, finalUrl: URL_A }],
    });
    expect(await checkLink(URL_A, context(http))).toEqual({ kind: 'accepted' });
    expect(await checkLink('https://b.dev/', context(http))).toEqual({
      kind: 'accepted',
    });
  });

  it.each([401, 403, 429])(
    'accepts %i with blocks_automation',
    async (code) => {
      const http = new FakeHttp({ [URL_A]: [status(code, URL_A)] });
      expect(await checkLink(URL_A, context(http))).toEqual({
        kind: 'accepted',
        note: { code: 'blocks_automation' },
      });
      expect(http.calls).toHaveLength(1);
    },
  );

  it.each([
    ['500', status(500, URL_A)],
    ['503', status(503, URL_A)],
    ['a timeout', { kind: 'timeout', lastUrl: URL_A } as HttpResult],
  ])(
    'warns after three attempts on %s, waiting 1 s between them',
    async (_label, result) => {
      const http = new FakeHttp({ [URL_A]: [result] });
      const waits: number[] = [];
      expect(await checkLink(URL_A, context(http, waits))).toEqual({
        kind: 'warned',
      });
      expect(http.calls).toEqual([URL_A, URL_A, URL_A]);
      expect(waits).toEqual([1000, 1000]);
    },
  );

  it('accepts a link that recovers after a 5xx', async () => {
    const http = new FakeHttp({ [URL_A]: [status(502, URL_A), ok(URL_A)] });
    expect(await checkLink(URL_A, context(http))).toEqual({ kind: 'accepted' });
    expect(http.calls).toHaveLength(2);
  });

  it.each([
    [status(404, URL_A), { code: 'http_error', params: { status: '404' } }],
    [status(410, URL_A), { code: 'http_error', params: { status: '410' } }],
    [status(400, URL_A), { code: 'http_error', params: { status: '400' } }],
    [{ kind: 'dnsNotFound', lastUrl: URL_A }, { code: 'dns_not_found' }],
    [{ kind: 'tlsError', lastUrl: URL_A }, { code: 'tls_error' }],
    [{ kind: 'connectionError', lastUrl: URL_A }, { code: 'connection_error' }],
  ] as [HttpResult, unknown][])(
    'rejects %j with %j, no retry',
    async (result, reason) => {
      const http = new FakeHttp({ [URL_A]: [result] });
      expect(await checkLink(URL_A, context(http))).toEqual({
        kind: 'rejected',
        reason,
      });
      expect(http.calls).toHaveLength(1);
    },
  );

  it.each([
    ['a final URL', ok('https://pdfdrive.com/book'), 'pdfdrive.com'],
    [
      'a last URL',
      { kind: 'timeout', lastUrl: 'https://libgen.rs/' } as HttpResult,
      'libgen.*',
    ],
    [
      'an error final URL',
      status(404, 'https://en.pdfdrive.com/'),
      'pdfdrive.com',
    ],
  ])(
    'rejects a redirect to a blocked domain in %s',
    async (_label, result, domain) => {
      const http = new FakeHttp({ [URL_A]: [result] });
      expect(await checkLink(URL_A, context(http))).toEqual({
        kind: 'rejected',
        reason: { code: 'blocked_domain', params: { domain } },
      });
      expect(http.calls).toHaveLength(1);
    },
  );

  it('reports offline, without retrying', async () => {
    const http = new FakeHttp({ [URL_A]: [{ kind: 'offline' }] });
    expect(await checkLink(URL_A, context(http))).toEqual({ kind: 'offline' });
    expect(http.calls).toHaveLength(1);
  });
});

function item(overrides: Record<string, unknown> = {}) {
  return {
    ref: 'x',
    op: 'add',
    kind: 'tool',
    name: 'X',
    url: URL_A,
    resourceType: 'site',
    categories: ['Imagini & video'],
    whatItDoes: 'Face ceva.',
    situations: ['Când'],
    ...overrides,
  };
}

function concept(sources: string[], overrides: Record<string, unknown> = {}) {
  return item({
    kind: 'concept',
    url: undefined,
    resourceType: undefined,
    content: '# C',
    sources,
    ...overrides,
  });
}

function batchOf(...items: unknown[]) {
  return parseBatch(JSON.stringify({ schemaVersion: 1, items }));
}

function single(raw: unknown) {
  return batchOf(raw).items[0];
}

describe('verifyItem', () => {
  it('accepts a working link with no reasons', async () => {
    expect(await verifyItem(single(item()), context(new FakeHttp()))).toEqual({
      outcome: 'accepted',
      reasons: [],
      sources: [],
    });
  });

  it('keeps blocks_automation as a note on an accepted item', async () => {
    const http = new FakeHttp({ [URL_A]: [status(403, URL_A)] });
    expect(await verifyItem(single(item()), context(http))).toEqual({
      outcome: 'accepted',
      reasons: [{ code: 'blocks_automation' }],
      sources: [],
    });
  });

  it('warns a link with no response', async () => {
    const http = new FakeHttp({ [URL_A]: [status(500, URL_A)] });
    expect(await verifyItem(single(item()), context(http))).toEqual({
      outcome: 'warned',
      reasons: [{ code: 'no_response_at_import' }],
      sources: [],
    });
  });

  it('rejects a flagged item without any request', async () => {
    const http = new FakeHttp();
    expect(
      await verifyItem(
        single(item({ flaggedByClaude: 'Piratat.' })),
        context(http),
      ),
    ).toEqual({
      outcome: 'rejected',
      reasons: [{ code: 'flagged_by_claude', params: { text: 'Piratat.' } }],
      sources: [],
      warnings: [],
      forcedSources: [],
    });
    expect(http.calls).toEqual([]);
  });

  it('still verifies a forced flagged item, the flag first', async () => {
    const http = new FakeHttp();
    const verdict = await verifyItem(
      single(item({ flaggedByClaude: 'Piratat.', url: 'httpss://a.dev' })),
      context(http),
      true,
    );
    expect(verdict.outcome).toBe('rejected');
    expect(verdict.reasons).toEqual([
      { code: 'flagged_by_claude', params: { text: 'Piratat.' } },
      { code: 'invalid_url' },
    ]);
    expect(verdict.warnings).toEqual([]);
  });

  it('contacts a forced flagged item and its sources', async () => {
    const dead = 'https://dead.dev/';
    const http = new FakeHttp({ [dead]: [status(404, dead)] });
    const verdict = await verifyItem(
      single(concept([dead, 'https://live.dev/'], { flaggedByClaude: 'Rău.' })),
      context(http),
      true,
    );
    expect(http.calls.sort()).toEqual([dead, 'https://live.dev/']);
    expect(verdict).toEqual({
      outcome: 'rejected',
      reasons: [{ code: 'flagged_by_claude', params: { text: 'Rău.' } }],
      sources: ['https://live.dev/'],
      warnings: [{ code: 'source_link_removed', params: { url: dead } }],
      forcedSources: ['https://live.dev/'],
    });
  });

  it('skips URL checks for a concept without url or sources', async () => {
    const http = new FakeHttp();
    expect(await verifyItem(single(concept([])), context(http))).toEqual({
      outcome: 'accepted',
      reasons: [],
      sources: [],
    });
    expect(http.calls).toEqual([]);
  });

  it('removes dead and invalid sources and warns the concept', async () => {
    const dead = 'https://dead.dev/';
    const http = new FakeHttp({ [dead]: [status(404, dead)] });
    const verdict = await verifyItem(
      single(concept([dead, 'https://live.dev/', 'httpss://typo.dev'])),
      context(http),
    );
    expect(verdict).toEqual({
      outcome: 'warned',
      reasons: [
        { code: 'source_link_removed', params: { url: dead } },
        { code: 'source_link_removed', params: { url: 'httpss://typo.dev' } },
      ],
      sources: ['https://live.dev/'],
    });
  });

  it('keeps a source that does not respond, warning with its url', async () => {
    const slow = 'https://slow.dev/';
    const http = new FakeHttp({ [slow]: [{ kind: 'timeout', lastUrl: slow }] });
    expect(await verifyItem(single(concept([slow])), context(http))).toEqual({
      outcome: 'warned',
      reasons: [{ code: 'no_response_at_import', params: { url: slow } }],
      sources: [slow],
    });
  });

  it('keeps a source that blocks automation, with no reason', async () => {
    const s = 'https://bots-no.dev/';
    const http = new FakeHttp({ [s]: [status(429, s)] });
    expect(await verifyItem(single(concept([s])), context(http))).toEqual({
      outcome: 'accepted',
      reasons: [],
      sources: [s],
    });
  });

  it('rejects a concept with a source on a blocked domain', async () => {
    const dead = 'https://dead.dev/';
    const http = new FakeHttp({ [dead]: [status(404, dead)] });
    const verdict = await verifyItem(
      single(concept(['https://libgen.is/x', dead])),
      context(http),
    );
    // Rejected: only the rejection is reported, not the removed source; a
    // forced write gets the warnings and keeps the blocked source.
    expect(verdict.outcome).toBe('rejected');
    expect(verdict.reasons).toEqual([
      {
        code: 'source_blocked_domain',
        params: { url: 'https://libgen.is/x', domain: 'libgen.*' },
      },
    ]);
    expect(verdict.sources).toEqual([]);
    expect(verdict.warnings).toEqual([
      { code: 'source_link_removed', params: { url: dead } },
    ]);
    expect(verdict.forcedSources).toEqual(['https://libgen.is/x']);
    expect(http.calls).toEqual([dead]);
  });

  it('checks a concept url and its sources', async () => {
    const http = new FakeHttp({ [URL_A]: [status(404, URL_A)] });
    const verdict = await verifyItem(
      single(concept(['https://live.dev/'], { url: URL_A })),
      context(http),
    );
    expect(verdict).toEqual({
      outcome: 'rejected',
      reasons: [{ code: 'http_error', params: { status: '404' } }],
      sources: ['https://live.dev/'],
      warnings: [],
      forcedSources: ['https://live.dev/'],
    });
    expect(http.calls.sort()).toEqual([URL_A, 'https://live.dev/']);
  });

  it('throws OFFLINE when a check finds no network', async () => {
    const http = new FakeHttp({ 'https://s.dev/': [{ kind: 'offline' }] });
    await expect(
      verifyItem(single(concept(['https://s.dev/'])), context(http)),
    ).rejects.toMatchObject({ code: 'OFFLINE' });
  });
});

describe('verifyItem GitHub data (AD-7)', () => {
  const REPO = 'https://github.com/o/r';
  const active: GitHubResult = {
    kind: 'ok',
    stars: 1200,
    pushedAt: '2026-09-01T10:00:00Z',
    archived: false,
  };

  it('puts the metadata of an active repo on the verdict, without a note', async () => {
    const github = new FakeGithub({ 'o/r': active });
    const verdict = await verifyItem(
      single(item({ url: REPO })),
      context(new FakeHttp(), [], github),
    );
    expect(verdict).toEqual({
      outcome: 'accepted',
      reasons: [],
      sources: [],
      github: {
        stars: 1200,
        pushedAt: '2026-09-01T10:00:00Z',
        archived: false,
      },
    });
    expect(github.calls).toEqual(['o/r']);
  });

  it('keeps an archived repo accepted and adds the github_archived note', async () => {
    const github = new FakeGithub({ 'o/r': { ...active, archived: true } });
    const verdict = await verifyItem(
      single(item({ url: REPO })),
      context(new FakeHttp(), [], github),
    );
    expect(verdict.outcome).toBe('accepted');
    expect(verdict.reasons).toEqual([{ code: 'github_archived' }]);
    expect(verdict.github?.archived).toBe(true);
  });

  it('reads the repo of a subpath or a .git URL', async () => {
    const github = new FakeGithub({ 'O/R': active });
    await verifyItem(
      single(item({ url: 'https://github.com/O/R/tree/main/docs' })),
      context(new FakeHttp(), [], github),
    );
    await verifyItem(
      single(item({ url: 'https://github.com/O/R.git' })),
      context(new FakeHttp(), [], github),
    );
    expect(github.calls).toEqual(['O/R', 'O/R']);
  });

  it.each([
    { kind: 'rateLimited' },
    { kind: 'notFound' },
    { kind: 'failed' },
  ] as const)('leaves no metadata and no note on %j', async (answer) => {
    const github = new FakeGithub({ 'o/r': answer });
    const verdict = await verifyItem(
      single(item({ url: REPO })),
      context(new FakeHttp(), [], github),
    );
    expect(verdict).toEqual({ outcome: 'accepted', reasons: [], sources: [] });
  });

  it.each([
    'https://example.com/',
    'https://github.com/topics/x',
    'https://gist.github.com/u/1',
    'https://github.com/o',
  ])('makes no API call for %s', async (url) => {
    const github = new FakeGithub({ 'o/r': active });
    const verdict = await verifyItem(
      single(item({ url })),
      context(new FakeHttp(), [], github),
    );
    expect(github.calls).toEqual([]);
    expect(verdict.github).toBeUndefined();
  });

  it('fetches for a warned link', async () => {
    const http = new FakeHttp({ [REPO]: [status(500, REPO)] });
    const github = new FakeGithub({ 'o/r': active });
    const verdict = await verifyItem(
      single(item({ url: REPO })),
      context(http, [], github),
    );
    expect(verdict.outcome).toBe('warned');
    expect(verdict.github?.stars).toBe(1200);
  });

  it('makes no API call for a rejected link', async () => {
    const http = new FakeHttp({ [REPO]: [status(404, REPO)] });
    const github = new FakeGithub({ 'o/r': active });
    const verdict = await verifyItem(
      single(item({ url: REPO })),
      context(http, [], github),
    );
    expect(verdict.outcome).toBe('rejected');
    expect(github.calls).toEqual([]);
  });

  it('makes no API call for an item Claude flagged', async () => {
    const github = new FakeGithub({ 'o/r': active });
    await verifyItem(
      single(item({ url: REPO, flaggedByClaude: 'dubios' })),
      context(new FakeHttp(), [], github),
    );
    expect(github.calls).toEqual([]);
  });

  it('keeps the metadata on a forced item that is rejected for another reason', async () => {
    const github = new FakeGithub({ 'o/r': { ...active, archived: true } });
    const verdict = await verifyItem(
      single(item({ url: REPO, flaggedByClaude: 'dubios' })),
      context(new FakeHttp(), [], github),
      true,
    );
    expect(verdict.outcome).toBe('rejected');
    expect(verdict.github?.stars).toBe(1200);
    expect(verdict.warnings).toEqual([{ code: 'github_archived' }]);
  });
});

describe('verifyBatch', () => {
  it('returns a verdict for every item, by ref', async () => {
    const http = new FakeHttp({
      'https://b.dev/': [status(404, 'https://b.dev/')],
    });
    const verdicts = await verifyBatch(
      batchOf(item({ ref: 'a' }), item({ ref: 'b', url: 'https://b.dev/' })),
      context(http),
    );
    expect([...verdicts.keys()]).toEqual(['a', 'b']);
    expect(verdicts.get('a')?.outcome).toBe('accepted');
    expect(verdicts.get('b')?.outcome).toBe('rejected');
  });

  it('verifies the forced refs as forced', async () => {
    const http = new FakeHttp();
    const verdicts = await verifyBatch(
      batchOf(
        item({ ref: 'a', flaggedByClaude: 'Rău.', url: 'https://a.dev/' }),
        item({ ref: 'b', flaggedByClaude: 'Rău.', url: 'https://b.dev/' }),
      ),
      context(http),
      ['b'],
    );
    expect(http.calls).toEqual(['https://b.dev/']);
    expect(verdicts.get('a')?.reasons).toHaveLength(1);
    expect(verdicts.get('b')?.reasons).toHaveLength(1);
  });

  it('checks at most four links at a time', async () => {
    const http = new FakeHttp({}, 5);
    const items = Array.from({ length: 10 }, (_, i) =>
      item({ ref: `r${i}`, url: `https://site${i}.dev/` }),
    );
    await verifyBatch(batchOf(...items), context(http));
    expect(http.calls).toHaveLength(10);
    expect(http.peak).toBe(4);
  });

  it('throws OFFLINE and starts no check after the first offline', async () => {
    const http = new FakeHttp(
      { 'https://site0.dev/': [{ kind: 'offline' }] },
      5,
    );
    const items = Array.from({ length: 12 }, (_, i) =>
      item({ ref: `r${i}`, url: `https://site${i}.dev/` }),
    );
    const error = await verifyBatch(batchOf(...items), context(http)).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(WhenkitError);
    expect((error as WhenkitError).code).toBe('OFFLINE');
    // The first four were already running; the rest never reached the port.
    expect(http.calls.length).toBeLessThanOrEqual(4);
  });
});
