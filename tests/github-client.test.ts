import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createGitHubClient } from '../src/adapters/github/node-github-client';

// The GitHub adapter against a local server (AD-7): nothing here reaches the
// real api.github.com.

type Handler = (
  request: http.IncomingMessage,
  response: http.ServerResponse,
) => void;

interface LocalServer {
  /** e.g. `http://127.0.0.1:54321` (no trailing slash). */
  origin: string;
  /** `METHOD path` of every request received. */
  requests: string[];
  headers: http.IncomingHttpHeaders[];
  server: http.Server;
}

const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          // Drops the requests a hanging handler never answered.
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

async function startServer(handler: Handler): Promise<LocalServer> {
  const requests: string[] = [];
  const headers: http.IncomingHttpHeaders[] = [];
  const server = http.createServer((request, response) => {
    requests.push(`${request.method} ${request.url}`);
    headers.push(request.headers);
    handler(request, response);
  });
  servers.push(server);
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  return { origin: `http://127.0.0.1:${port}`, requests, headers, server };
}

function json(
  response: http.ServerResponse,
  status: number,
  body: unknown,
  headers: http.OutgoingHttpHeaders = {},
) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    ...headers,
  });
  response.end(typeof body === 'string' ? body : JSON.stringify(body));
}

const REPO_BODY = {
  stargazers_count: 1200,
  pushed_at: '2026-09-01T10:00:00Z',
  archived: false,
  full_name: 'o/r',
};

function clientFor(server: LocalServer, timeoutMs = 2_000) {
  return createGitHubClient({ baseUrl: server.origin, timeoutMs });
}

describe('createGitHubClient', () => {
  it('reads stars, pushed_at and archived, with the API headers', async () => {
    const server = await startServer((_req, res) => json(res, 200, REPO_BODY));
    expect(await clientFor(server).repo('o', 'r')).toEqual({
      kind: 'ok',
      stars: 1200,
      pushedAt: '2026-09-01T10:00:00.000Z',
      archived: false,
    });
    expect(server.requests).toEqual(['GET /repos/o/r']);
    expect(server.headers[0]).toMatchObject({
      accept: 'application/vnd.github+json',
      'x-github-api-version': expect.any(String),
      'user-agent': expect.any(String),
    });
    expect(server.headers[0].authorization).toBeUndefined();
  });

  it('reports an archived repo', async () => {
    const server = await startServer((_req, res) =>
      json(res, 200, { ...REPO_BODY, archived: true }),
    );
    expect(await clientFor(server).repo('o', 'r')).toMatchObject({
      kind: 'ok',
      archived: true,
    });
  });

  it('normalizes pushed_at to UTC ISO with milliseconds', async () => {
    const server = await startServer((_req, res) =>
      json(res, 200, { ...REPO_BODY, pushed_at: '2026-09-01T12:00:00+02:00' }),
    );
    expect(await clientFor(server).repo('o', 'r')).toMatchObject({
      pushedAt: '2026-09-01T10:00:00.000Z',
    });
  });

  it('accepts a repo that was never pushed to', async () => {
    const server = await startServer((_req, res) =>
      json(res, 200, { ...REPO_BODY, pushed_at: null }),
    );
    expect(await clientFor(server).repo('o', 'r')).toMatchObject({
      kind: 'ok',
      pushedAt: null,
    });
  });

  it('answers rateLimited for 403 with no requests left, and for 429', async () => {
    const forbidden = await startServer((_req, res) =>
      json(res, 403, {}, { 'x-ratelimit-remaining': '0' }),
    );
    expect(await clientFor(forbidden).repo('o', 'r')).toEqual({
      kind: 'rateLimited',
    });
    const tooMany = await startServer((_req, res) => json(res, 429, {}));
    expect(await clientFor(tooMany).repo('o', 'r')).toEqual({
      kind: 'rateLimited',
    });
  });

  it('answers failed for a 403 that is not the rate limit', async () => {
    const server = await startServer((_req, res) =>
      json(res, 403, {}, { 'x-ratelimit-remaining': '42' }),
    );
    expect(await clientFor(server).repo('o', 'r')).toEqual({ kind: 'failed' });
  });

  it('answers notFound for 404', async () => {
    const server = await startServer((_req, res) => json(res, 404, {}));
    expect(await clientFor(server).repo('o', 'gone')).toEqual({
      kind: 'notFound',
    });
  });

  it.each([500, 503, 418])('answers failed for %i', async (status) => {
    const server = await startServer((_req, res) => json(res, status, {}));
    expect(await clientFor(server).repo('o', 'r')).toEqual({ kind: 'failed' });
  });

  it.each([
    ['malformed JSON', '{ nope'],
    ['a missing field', JSON.stringify({ stargazers_count: 3 })],
    [
      'a wrong type',
      JSON.stringify({ ...REPO_BODY, stargazers_count: 'many' }),
    ],
    ['an array', '[]'],
    [
      'a pushed_at that is not a date',
      JSON.stringify({ ...REPO_BODY, pushed_at: 'yesterday' }),
    ],
  ])('answers failed for %s', async (_name, body) => {
    const server = await startServer((_req, res) => json(res, 200, body));
    expect(await clientFor(server).repo('o', 'r')).toEqual({ kind: 'failed' });
  });

  it('answers failed on a timeout', async () => {
    const server = await startServer(() => {
      // Never answers.
    });
    expect(await clientFor(server, 150).repo('o', 'r')).toEqual({
      kind: 'failed',
    });
  });

  it('answers failed when the connection is cut mid-body', async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Length': '500' });
      res.write('{"stargazers_count":');
      setTimeout(() => res.destroy(), 20);
    });
    expect(await clientFor(server).repo('o', 'r')).toEqual({ kind: 'failed' });
  });

  it('answers failed when nothing listens', async () => {
    const server = await startServer((_req, res) => json(res, 200, REPO_BODY));
    const client = clientFor(server);
    await new Promise<void>((resolve) => {
      server.server.closeAllConnections();
      server.server.close(() => resolve());
    });
    expect(await client.repo('o', 'r')).toEqual({ kind: 'failed' });
  });

  it('answers failed, without throwing, for an unusable base URL', async () => {
    const client = createGitHubClient({ baseUrl: 'not a url' });
    expect(await client.repo('o', 'r')).toEqual({ kind: 'failed' });
  });

  describe('redirects (renamed repos)', () => {
    it('follows a 301 to another API URL', async () => {
      const server = await startServer((req, res) => {
        if (req.url === '/repos/o/old') {
          res.writeHead(301, { Location: '/repositories/42' });
          res.end();
        } else {
          json(res, 200, REPO_BODY);
        }
      });
      expect(await clientFor(server).repo('o', 'old')).toMatchObject({
        kind: 'ok',
        stars: 1200,
      });
      expect(server.requests).toEqual([
        'GET /repos/o/old',
        'GET /repositories/42',
      ]);
    });

    it.each([302, 307])('follows a %i', async (status) => {
      const server = await startServer((req, res) => {
        if (req.url === '/repos/o/old') {
          res.writeHead(status, { Location: '/repositories/42' });
          res.end();
        } else {
          json(res, 200, REPO_BODY);
        }
      });
      expect(await clientFor(server).repo('o', 'old')).toMatchObject({
        kind: 'ok',
      });
    });

    it('gives up after three followed redirects', async () => {
      let hops = 0;
      const server = await startServer((_req, res) => {
        hops += 1;
        res.writeHead(301, { Location: `/repositories/${hops}` });
        res.end();
      });
      expect(await clientFor(server).repo('o', 'loop')).toEqual({
        kind: 'failed',
      });
      // The first request plus three followed redirects.
      expect(server.requests).toHaveLength(4);
    });

    it('follows exactly three redirects to a repo', async () => {
      let hops = 0;
      const server = await startServer((_req, res) => {
        hops += 1;
        if (hops <= 3) {
          res.writeHead(301, { Location: `/repositories/${hops}` });
          res.end();
        } else {
          json(res, 200, REPO_BODY);
        }
      });
      expect(await clientFor(server).repo('o', 'r')).toMatchObject({
        kind: 'ok',
      });
    });

    it('does not follow a redirect out of the API', async () => {
      const other = await startServer((_req, res) => json(res, 200, REPO_BODY));
      const server = await startServer((_req, res) => {
        res.writeHead(301, { Location: `${other.origin}/repos/o/r` });
        res.end();
      });
      expect(await clientFor(server).repo('o', 'r')).toEqual({
        kind: 'failed',
      });
      expect(other.requests).toEqual([]);
    });
  });
});
