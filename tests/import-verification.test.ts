import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo, LookupFunction } from 'node:net';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { nodeFileSystem } from '../src/adapters/fs/node-file-system';
import { createHttpClient } from '../src/adapters/http/node-http-client';
import { main, type CliDeps } from '../src/cli/main';
import {
  errorOutputSchema,
  listOutputSchema,
  showOutputSchema,
} from '../src/core/cli-schemas';
import { importReportSchema } from '../src/core/import-report-schema';
import type { HttpClient } from '../src/core/ports';
import {
  entryStrings,
  errorMessages,
  reasonTexts,
} from '../src/shared/strings.ro';
import {
  fakeAppRoot,
  fakeEnvironment,
  fixedClock,
  okHttp,
  sequentialIds,
  tempDir,
  testStoreOpener,
} from './helpers';

// `whenkit import` with phase 2 (AD-6, AD-7) end to end: the real HTTP
// adapter against a local server on 127.0.0.1. Host names resolve through a
// fake lookup, so nothing here reaches the internet or the real DNS.

const servers: (http.Server | https.Server)[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          // Drops the requests `/hang` never answered.
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

/** A port on 127.0.0.1 that nothing listens on. */
async function closedPort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

/** An HTTPS server with the test-only self-signed certificate. */
async function startSelfSignedSite(): Promise<string> {
  const fixtures = new URL('./fixtures/tls/', import.meta.url);
  const server = https.createServer(
    {
      cert: readFileSync(new URL('cert.pem', fixtures)),
      key: readFileSync(new URL('key.pem', fixtures)),
    },
    (_request, response) => {
      response.writeHead(200);
      response.end();
    },
  );
  servers.push(server);
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  return `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

interface Site {
  port: number;
  origin: string;
  /** `METHOD path` of every request received. */
  requests: string[];
}

/** The local site every matrix link points at. */
async function startSite(): Promise<Site> {
  const requests: string[] = [];
  let recoverCalls = 0;
  const server = http.createServer((request, response) => {
    const url = request.url ?? '/';
    requests.push(`${request.method} ${url}`);
    const send = (status: number, headers: http.OutgoingHttpHeaders = {}) => {
      response.writeHead(status, headers);
      response.end();
    };
    switch (url) {
      case '/unauthorized':
        return send(401);
      case '/forbidden':
        return send(403);
      case '/too-many':
        return send(429);
      case '/missing':
      case '/missing-source':
        return send(404);
      case '/gone':
        return send(410);
      case '/hang':
        // Never answers: the client's deadline turns it into a timeout.
        return undefined;
      case '/down':
        return send(500);
      case '/recovers':
        // HEAD and the GET retry fail on the first attempt, then it works.
        recoverCalls += 1;
        return send(recoverCalls <= 2 ? 500 : 200);
      case '/to-libgen':
        return send(302, { Location: `http://libgen.is:${site.port}/book` });
      case '/to-dead-blocked':
        // The target is blocked and its name does not resolve: lastUrl.
        return send(302, {
          Location: `http://sci-hub.invalid:${site.port}/paper`,
        });
      default:
        return send(200);
    }
  });
  servers.push(server);
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  const site: Site = { port, origin: `http://127.0.0.1:${port}`, requests };
  return site;
}

/**
 * Names under `.invalid` do not exist (ENOTFOUND); every other name,
 * the adapter's probe host included, resolves to 127.0.0.1.
 */
const localLookup: LookupFunction = (hostname, options, callback) => {
  process.nextTick(() => {
    if (hostname.endsWith('.invalid')) {
      const error: NodeJS.ErrnoException = new Error(
        `getaddrinfo ENOTFOUND ${hostname}`,
      );
      error.code = 'ENOTFOUND';
      callback(error, '', 0);
    } else if (options.all) {
      callback(null, [{ address: '127.0.0.1', family: 4 }]);
    } else {
      callback(null, '127.0.0.1', 4);
    }
  });
};

interface Setup {
  root: string;
  workspace: string;
  dbPath: string;
  deps: CliDeps;
}

async function initialized(httpClient: HttpClient): Promise<Setup> {
  const root = tempDir();
  const appData = path.join(root, 'AppData');
  mkdirSync(appData);
  const workspace = path.join(root, 'ws');
  const s: Setup = {
    root,
    workspace,
    dbPath: path.join(workspace, 'data', 'catalog.sqlite'),
    deps: {
      env: fakeEnvironment(
        { APPDATA: appData, WHENKIT_WORKSPACE: workspace },
        fakeAppRoot(path.join(root, 'repo')),
      ),
      fs: nodeFileSystem,
      clock: fixedClock(new Date('2026-10-14T09:00:00.000Z')),
      ids: sequentialIds(),
      openStore: testStoreOpener(),
      http: httpClient,
      // Retries happen at once; the 1 s default is covered in core.
      retryDelayMs: 0,
      cwd: root,
    },
  };
  expect((await runCli(s, ['init'])).exitCode).toBe(0);
  return s;
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

async function importJson(s: Setup, items: unknown[]) {
  writeFileSync(
    path.join(s.root, 'batch.json'),
    JSON.stringify({ schemaVersion: 1, items }),
  );
  const result = await runCli(s, ['import', 'batch.json', '--json']);
  return { ...result, json: JSON.parse(result.stdout) as unknown };
}

function tool(ref: string, url: string, extra: Record<string, unknown> = {}) {
  return {
    ref,
    op: 'add',
    kind: 'tool',
    name: `Tool ${ref}`,
    url,
    resourceType: 'site',
    categories: ['Imagini & video'],
    whatItDoes: 'Face ceva util.',
    situations: ['Când am nevoie de el'],
    ...extra,
  };
}

function concept(ref: string, sources: string[]) {
  return {
    ref,
    op: 'add',
    kind: 'concept',
    name: `Concept ${ref}`,
    categories: ['Backend & API-uri'],
    whatItDoes: 'Explică ceva.',
    situations: ['Când învăț'],
    content: '# Concept',
    sources,
  };
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

describe('whenkit import verification', () => {
  it('gives every matrix case its verdict and lists only added and warned items', async () => {
    const site = await startSite();
    const tlsOrigin = await startSelfSignedSite();
    const refusedPort = await closedPort();
    // A short deadline, so `/hang` times out quickly on each attempt.
    const s = await initialized(
      createHttpClient({ timeoutMs: 500, lookup: localLookup }),
    );
    const o = site.origin;

    const result = await importJson(s, [
      tool('syntax', 'httpss://gutenberg.org'),
      tool('ok', `${o}/ok`),
      tool('unauthorized', `${o}/unauthorized`),
      tool('bots', `${o}/forbidden`),
      tool('too-many', `${o}/too-many`),
      tool('flaky', `${o}/down`),
      tool('hangs', `${o}/hang`),
      tool('recovers', `${o}/recovers`),
      tool('dead', `${o}/missing`),
      tool('gone', `${o}/gone`),
      tool('refused', `http://127.0.0.1:${refusedPort}/`),
      tool('no-dns', `http://nowhere.invalid:${site.port}/`),
      tool('bad-cert', `${tlsOrigin}/`),
      tool('blocked', `http://pdfdrive.com:${site.port}/never`),
      tool('redirected', `${o}/to-libgen`),
      tool('redirected-dead', `${o}/to-dead-blocked`),
      tool('flagged', `${o}/flagged`, { flaggedByClaude: 'Pare piratat.' }),
      concept('no-url', []),
      concept('sources', [
        `${o}/missing-source`,
        'httpss://typo.dev',
        `${o}/ok`,
      ]),
      concept('blocked-source', ['https://sci-hub.se/paper']),
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    const report = importReportSchema.parse(result.json);
    const byRef = Object.fromEntries(
      report.items.map(({ ref, outcome, reasons }) => [
        ref,
        { outcome, reasons },
      ]),
    );
    expect(report.items).toHaveLength(20);
    expect(byRef).toEqual({
      syntax: { outcome: 'rejected', reasons: [{ code: 'invalid_url' }] },
      ok: { outcome: 'added', reasons: [] },
      unauthorized: {
        outcome: 'added',
        reasons: [{ code: 'blocks_automation' }],
      },
      bots: { outcome: 'added', reasons: [{ code: 'blocks_automation' }] },
      'too-many': {
        outcome: 'added',
        reasons: [{ code: 'blocks_automation' }],
      },
      flaky: {
        outcome: 'warned',
        reasons: [{ code: 'no_response_at_import' }],
      },
      hangs: {
        outcome: 'warned',
        reasons: [{ code: 'no_response_at_import' }],
      },
      recovers: { outcome: 'added', reasons: [] },
      dead: {
        outcome: 'rejected',
        reasons: [{ code: 'http_error', params: { status: '404' } }],
      },
      gone: {
        outcome: 'rejected',
        reasons: [{ code: 'http_error', params: { status: '410' } }],
      },
      refused: { outcome: 'rejected', reasons: [{ code: 'connection_error' }] },
      'no-dns': { outcome: 'rejected', reasons: [{ code: 'dns_not_found' }] },
      'bad-cert': { outcome: 'rejected', reasons: [{ code: 'tls_error' }] },
      'redirected-dead': {
        outcome: 'rejected',
        reasons: [{ code: 'blocked_domain', params: { domain: 'sci-hub.*' } }],
      },
      blocked: {
        outcome: 'rejected',
        reasons: [
          { code: 'blocked_domain', params: { domain: 'pdfdrive.com' } },
        ],
      },
      redirected: {
        outcome: 'rejected',
        reasons: [{ code: 'blocked_domain', params: { domain: 'libgen.*' } }],
      },
      flagged: {
        outcome: 'rejected',
        reasons: [
          { code: 'flagged_by_claude', params: { text: 'Pare piratat.' } },
        ],
      },
      'no-url': { outcome: 'added', reasons: [] },
      sources: {
        outcome: 'warned',
        reasons: [
          {
            code: 'source_link_removed',
            params: { url: `${o}/missing-source` },
          },
          {
            code: 'source_link_removed',
            params: { url: 'httpss://typo.dev' },
          },
        ],
      },
      'blocked-source': {
        outcome: 'rejected',
        reasons: [
          {
            code: 'source_blocked_domain',
            params: { url: 'https://sci-hub.se/paper', domain: 'sci-hub.*' },
          },
        ],
      },
    });

    // Never contacted: a bad URL, a blocked submitted URL, a flagged item.
    expect(site.requests).not.toContainEqual(
      expect.stringMatching(/never|flagged/),
    );
    // Three attempts at most: HEAD then GET on each of them.
    expect(site.requests.filter((r) => r.endsWith(' /down'))).toHaveLength(6);
    // A timeout leaves no time for the GET retry: one HEAD per attempt.
    expect(site.requests.filter((r) => r.endsWith(' /hang'))).toHaveLength(3);

    const listed = listOutputSchema.parse(
      JSON.parse((await runCli(s, ['list', '--json'])).stdout),
    );
    expect(listed.entries.map((entry) => entry.name).sort()).toEqual(
      [
        'Concept no-url',
        'Concept sources',
        'Tool bots',
        'Tool flaky',
        'Tool hangs',
        'Tool ok',
        'Tool recovers',
        'Tool too-many',
        'Tool unauthorized',
      ].sort(),
    );
    for (const entry of listed.entries) {
      expect(entry.verifiedAt).toBe('2026-10-14T09:00:00.000Z');
    }

    const id = (ref: string) =>
      String(report.items.find((item) => item.ref === ref)?.id);
    const shown = showOutputSchema.parse(
      JSON.parse((await runCli(s, ['show', id('sources'), '--json'])).stdout),
    ).entry;
    expect(shown.sources).toEqual([`${o}/ok`]);
    expect(shown.verificationNotes).toEqual([
      { code: 'source_link_removed', params: { url: `${o}/missing-source` } },
      { code: 'source_link_removed', params: { url: 'httpss://typo.dev' } },
    ]);
    const flaky = showOutputSchema.parse(
      JSON.parse((await runCli(s, ['show', id('flaky'), '--json'])).stdout),
    ).entry;
    expect(flaky.verificationNotes).toEqual([
      { code: 'no_response_at_import' },
    ]);

    // The text card shows the warning too (verification-rules.md).
    const card = await runCli(s, ['show', id('flaky')]);
    expect(card.exitCode).toBe(0);
    expect(card.stdout).toContain(
      `${entryStrings.verificationNotes}:\n  - ${reasonTexts.no_response_at_import({})}`,
    );
    const sourcesCard = await runCli(s, ['show', id('sources')]);
    expect(sourcesCard.stdout).toContain(
      reasonTexts.source_link_removed({ url: 'httpss://typo.dev' }),
    );
    const okCard = await runCli(s, ['show', id('ok')]);
    expect(okCard.stdout).not.toContain(entryStrings.verificationNotes);
  }, 20_000);

  it('prints the verdicts as text, with the warned count', async () => {
    const s = await initialized(okHttp);
    writeFileSync(
      path.join(s.root, 'batch.json'),
      JSON.stringify({
        schemaVersion: 1,
        items: [tool('a', 'https://a.dev'), tool('b', 'https://libgen.is/x')],
      }),
    );
    const result = await runCli(s, ['import', 'batch.json']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('b: respinsă');
    expect(result.stdout).toContain('domeniu interzis (regula „libgen.*”');
    expect(result.stdout).toContain('0 cu avertisment');
  });

  it('stops offline with exit 3, writing and rejecting nothing', async () => {
    const offline: HttpClient = {
      check: () => Promise.resolve({ kind: 'offline' }),
    };
    const s = await initialized(offline);
    const before = readFileSync(s.dbPath);

    const result = await importJson(s, [
      tool('a', 'https://a.dev'),
      concept('c', []),
    ]);
    expect(result.exitCode).toBe(3);
    const doc = errorOutputSchema.parse(result.json);
    expect(doc.workspace).toBe(s.workspace);
    expect(doc.error).toEqual({
      code: 'OFFLINE',
      message: errorMessages.OFFLINE,
    });
    expect(count(s.dbPath, 'entries')).toBe(0);
    expect(count(s.dbPath, 'rejections')).toBe(0);
    expect(readFileSync(s.dbPath).equals(before)).toBe(true);
  });

  it('recreates a missing blocked-domains.txt from the template and uses it', async () => {
    const s = await initialized(okHttp);
    const list = path.join(s.workspace, 'data', 'blocked-domains.txt');
    rmSync(list);

    const result = await importJson(s, [tool('a', 'https://www.libgen.is/x')]);
    expect(result.exitCode).toBe(0);
    expect(importReportSchema.parse(result.json).items[0]).toMatchObject({
      outcome: 'rejected',
      reasons: [{ code: 'blocked_domain', params: { domain: 'libgen.*' } }],
    });
    expect(existsSync(list)).toBe(true);
    expect(readFileSync(list, 'utf8')).toBe(
      readFileSync(
        path.join(
          s.root,
          'repo',
          'workspace-template',
          'data',
          'blocked-domains.txt',
        ),
        'utf8',
      ),
    );
  });

  it('uses the user-edited list as it is', async () => {
    const s = await initialized(okHttp);
    writeFileSync(
      path.join(s.workspace, 'data', 'blocked-domains.txt'),
      '# my list\nexemplu.com\n',
    );
    const result = await importJson(s, [
      tool('a', 'https://libgen.is/x'),
      tool('b', 'https://docs.exemplu.com/'),
    ]);
    const items = importReportSchema.parse(result.json).items;
    expect(items.map((item) => item.outcome)).toEqual(['added', 'rejected']);
  });
});
