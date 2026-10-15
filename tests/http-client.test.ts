import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo, LookupFunction } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '../src/adapters/http/node-http-client';
import { BROWSER_USER_AGENT } from '../src/adapters/http/user-agent';

// The HTTP adapter against local servers on 127.0.0.1 (AD-7). IP literals
// skip name resolution, and every test that uses a host name injects a fake
// resolver, so nothing here touches the internet or the real DNS.

type Handler = (
  request: http.IncomingMessage,
  response: http.ServerResponse,
) => void;

interface LocalServer {
  /** e.g. `http://127.0.0.1:54321` (no trailing slash). */
  origin: string;
  port: number;
  /** `METHOD path` of every request received, in order. */
  requests: string[];
  userAgents: (string | undefined)[];
}

const servers: http.Server[] = [];

// Plain close (no closeAllConnections): it only finishes once every
// connection is gone, so a socket left open by the client fails the hook.
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

async function listen(
  server: http.Server,
  scheme: 'http' | 'https',
  log: { requests: string[]; userAgents: (string | undefined)[] },
): Promise<LocalServer> {
  servers.push(server);
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  return { origin: `${scheme}://127.0.0.1:${port}`, port, ...log };
}

function startServer(handler: Handler): Promise<LocalServer> {
  const log = {
    requests: [] as string[],
    userAgents: [] as (string | undefined)[],
  };
  const server = http.createServer((request, response) => {
    log.requests.push(`${request.method} ${request.url}`);
    log.userAgents.push(request.headers['user-agent']);
    handler(request, response);
  });
  return listen(server, 'http', log);
}

function reply(
  response: http.ServerResponse,
  status: number,
  location?: string,
) {
  response.writeHead(status, location ? { Location: location } : {});
  response.end('body that the client never reads');
}

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

/**
 * A resolver with `dns.lookup`'s signature: names in `known` resolve to
 * 127.0.0.1, every other name fails with `failCode`.
 */
function fakeLookup(
  known: string[],
  failCode = 'ENOTFOUND',
  asked: string[] = [],
): LookupFunction {
  return (hostname, options, callback) => {
    asked.push(hostname);
    process.nextTick(() => {
      if (!known.includes(hostname)) {
        const error: NodeJS.ErrnoException = new Error(
          `getaddrinfo ${failCode} ${hostname}`,
        );
        error.code = failCode;
        callback(error, '', 0);
      } else if (options.all) {
        callback(null, [{ address: '127.0.0.1', family: 4 }]);
      } else {
        callback(null, '127.0.0.1', 4);
      }
    });
  };
}

const quick = { timeoutMs: 2_000 };

describe('createHttpClient', () => {
  it('reports ok with the status and URL for a 200, using HEAD only', async () => {
    const server = await startServer((_, response) => reply(response, 200));
    const result = await createHttpClient(quick).check(`${server.origin}/page`);

    expect(result).toEqual({
      kind: 'ok',
      status: 200,
      finalUrl: `${server.origin}/page`,
    });
    expect(server.requests).toEqual(['HEAD /page']);
  });

  it('sends a browser User-Agent', async () => {
    const server = await startServer((_, response) => reply(response, 200));
    await createHttpClient(quick).check(`${server.origin}/`);

    expect(server.userAgents).toEqual([BROWSER_USER_AGENT]);
    expect(BROWSER_USER_AGENT).toMatch(/^Mozilla\/5\.0 \(Windows/);
  });

  it('follows 301 and 302 redirects, relative Location included, to the final URL', async () => {
    const server = await startServer((request, response) => {
      if (request.url === '/a') reply(response, 301, `${server.origin}/b/`);
      else if (request.url === '/b/') reply(response, 302, '../c');
      else reply(response, 200);
    });
    const result = await createHttpClient(quick).check(`${server.origin}/a`);

    expect(result).toEqual({
      kind: 'ok',
      status: 200,
      finalUrl: `${server.origin}/c`,
    });
    expect(server.requests).toEqual(['HEAD /a', 'HEAD /b/', 'HEAD /c']);
  });

  it.each([303, 307, 308])('follows a %i redirect', async (status) => {
    const server = await startServer((request, response) => {
      if (request.url === '/from') reply(response, status, '/to');
      else reply(response, 200);
    });
    const result = await createHttpClient(quick).check(`${server.origin}/from`);

    expect(result).toEqual({
      kind: 'ok',
      status: 200,
      finalUrl: `${server.origin}/to`,
    });
  });

  it('retries with one GET when HEAD is refused, and the GET result wins', async () => {
    const server = await startServer((request, response) =>
      reply(response, request.method === 'HEAD' ? 405 : 200),
    );
    const result = await createHttpClient(quick).check(`${server.origin}/x`);

    expect(result).toEqual({
      kind: 'ok',
      status: 200,
      finalUrl: `${server.origin}/x`,
    });
    expect(server.requests).toEqual(['HEAD /x', 'GET /x']);
  });

  it('reports the GET error when HEAD fails and GET fails differently', async () => {
    const server = await startServer((request, response) =>
      reply(response, request.method === 'HEAD' ? 404 : 500),
    );
    const result = await createHttpClient(quick).check(`${server.origin}/x`);

    expect(result).toEqual({
      kind: 'httpError',
      status: 500,
      finalUrl: `${server.origin}/x`,
    });
  });

  it.each([404, 410, 403, 429, 500])(
    'reports httpError %i when HEAD and GET both fail',
    async (status) => {
      const server = await startServer((_, response) =>
        reply(response, status),
      );
      const result = await createHttpClient(quick).check(
        `${server.origin}/gone`,
      );

      expect(result).toEqual({
        kind: 'httpError',
        status,
        finalUrl: `${server.origin}/gone`,
      });
      expect(server.requests).toEqual(['HEAD /gone', 'GET /gone']);
    },
  );

  it('reports the final URL of an error reached through a redirect', async () => {
    const server = await startServer((request, response) => {
      if (request.url === '/old') reply(response, 301, '/missing');
      else reply(response, 404);
    });
    const result = await createHttpClient(quick).check(`${server.origin}/old`);

    expect(result).toEqual({
      kind: 'httpError',
      status: 404,
      finalUrl: `${server.origin}/missing`,
    });
  });

  it('follows exactly the redirect limit', async () => {
    const server = await startServer((request, response) => {
      const n = Number(request.url?.slice(1));
      if (n < 10) reply(response, 302, `/${n + 1}`);
      else reply(response, 200);
    });
    const result = await createHttpClient(quick).check(`${server.origin}/0`);

    expect(result).toEqual({
      kind: 'ok',
      status: 200,
      finalUrl: `${server.origin}/10`,
    });
  });

  it('reports connectionError on more than 10 redirects (a loop)', async () => {
    const server = await startServer((_, response) =>
      reply(response, 302, '/loop'),
    );
    const result = await createHttpClient(quick).check(`${server.origin}/loop`);

    expect(result).toEqual({
      kind: 'connectionError',
      lastUrl: `${server.origin}/loop`,
    });
    // 11 HEADs: the first and 10 followed redirects. No GET retry.
    expect(server.requests).toHaveLength(11);
  });

  it('reports connectionError on a redirect to a non-http(s) URL', async () => {
    const server = await startServer((_, response) =>
      reply(response, 302, 'ftp://files.example/x'),
    );
    const result = await createHttpClient(quick).check(`${server.origin}/`);

    expect(result).toEqual({
      kind: 'connectionError',
      lastUrl: 'ftp://files.example/x',
    });
  });

  it('reports timeout within the limit when the server never answers', async () => {
    const server = await startServer(() => {
      // Accepts the request and never answers.
    });
    const started = Date.now();
    const result = await createHttpClient({ timeoutMs: 200 }).check(
      `${server.origin}/slow`,
    );

    expect(result).toEqual({
      kind: 'timeout',
      lastUrl: `${server.origin}/slow`,
    });
    expect(Date.now() - started).toBeLessThan(1_500);
  });

  it('gives up after 10 s when no timeout is given', async () => {
    const server = await startServer(() => {
      // Accepts the request and never answers.
    });
    // Only the deadline's timer is faked; the sockets stay real.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      let settled = false;
      const pending = createHttpClient()
        .check(`${server.origin}/slow`)
        .finally(() => {
          settled = true;
        });
      while (server.requests.length === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }

      await vi.advanceTimersByTimeAsync(9_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toEqual({
        kind: 'timeout',
        lastUrl: `${server.origin}/slow`,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports connectionError when nothing listens on the port', async () => {
    const port = await closedPort();
    const result = await createHttpClient(quick).check(
      `http://127.0.0.1:${port}/`,
    );

    expect(result).toEqual({
      kind: 'connectionError',
      lastUrl: `http://127.0.0.1:${port}/`,
    });
  });

  it('reports timeout with the redirect target that never answers', async () => {
    const silent = await startServer(() => {
      // Accepts the request and never answers.
    });
    const server = await startServer((_, response) =>
      reply(response, 302, `${silent.origin}/hang`),
    );
    const result = await createHttpClient({ timeoutMs: 200 }).check(
      `${server.origin}/start`,
    );

    expect(result).toEqual({
      kind: 'timeout',
      lastUrl: `${silent.origin}/hang`,
    });
  });

  it('reports connectionError with the redirect target that refuses', async () => {
    const port = await closedPort();
    const server = await startServer((_, response) =>
      reply(response, 302, `http://127.0.0.1:${port}/refused`),
    );
    const result = await createHttpClient(quick).check(
      `${server.origin}/start`,
    );

    expect(result).toEqual({
      kind: 'connectionError',
      lastUrl: `http://127.0.0.1:${port}/refused`,
    });
  });

  it('reports tlsError for a self-signed certificate', async () => {
    const fixtures = new URL('./fixtures/tls/', import.meta.url);
    const log = { requests: [] as string[], userAgents: [] };
    const server = await listen(
      https.createServer(
        {
          cert: readFileSync(new URL('cert.pem', fixtures)),
          key: readFileSync(new URL('key.pem', fixtures)),
        },
        (request, response) => {
          log.requests.push(`${request.method} ${request.url}`);
          reply(response, 200);
        },
      ),
      'https',
      log,
    );
    const result = await createHttpClient(quick).check(`${server.origin}/`);

    expect(result).toEqual({ kind: 'tlsError', lastUrl: `${server.origin}/` });
    expect(log.requests).toEqual([]);
  });

  it('resolves host names through the injected lookup', async () => {
    const server = await startServer((_, response) => reply(response, 200));
    const asked: string[] = [];
    const client = createHttpClient({
      ...quick,
      lookup: fakeLookup(['site.test'], 'ENOTFOUND', asked),
    });
    const result = await client.check(`http://site.test:${server.port}/`);

    expect(result).toEqual({
      kind: 'ok',
      status: 200,
      finalUrl: `http://site.test:${server.port}/`,
    });
    expect(asked).toContain('site.test');
  });

  it('reports dnsNotFound when the host is missing but the probe host resolves', async () => {
    const asked: string[] = [];
    const client = createHttpClient({
      ...quick,
      lookup: fakeLookup(['probe.test'], 'ENOTFOUND', asked),
      probeHost: 'probe.test',
    });
    const result = await client.check('https://missing.test/page');

    expect(result).toEqual({
      kind: 'dnsNotFound',
      lastUrl: 'https://missing.test/page',
    });
    expect(asked).toEqual(['missing.test', 'probe.test']);
  });

  it('treats ENODATA like a missing name', async () => {
    const client = createHttpClient({
      ...quick,
      lookup: fakeLookup(['probe.test'], 'ENODATA'),
      probeHost: 'probe.test',
    });

    expect(await client.check('http://missing.test/')).toEqual({
      kind: 'dnsNotFound',
      lastUrl: 'http://missing.test/',
    });
  });

  it('gives the probe its own budget when the check deadline is nearly used up', async () => {
    // The name fails at 100 ms of a 300 ms deadline; the probe answers at
    // ~500 ms, after the deadline but within its own budget.
    const lookup: LookupFunction = (hostname, _options, callback) => {
      if (hostname === 'probe.test') {
        setTimeout(() => callback(null, '127.0.0.1', 4), 400);
        return;
      }
      setTimeout(() => {
        const error: NodeJS.ErrnoException = new Error(
          `getaddrinfo ENOTFOUND ${hostname}`,
        );
        error.code = 'ENOTFOUND';
        callback(error, '', 0);
      }, 100);
    };
    const client = createHttpClient({
      timeoutMs: 300,
      lookup,
      probeHost: 'probe.test',
      probeTimeoutMs: 2_000,
    });

    expect(await client.check('https://slow-missing.test/')).toEqual({
      kind: 'dnsNotFound',
      lastUrl: 'https://slow-missing.test/',
    });
  });

  it('reports offline when every lookup fails, the probe included', async () => {
    const asked: string[] = [];
    const client = createHttpClient({
      ...quick,
      lookup: fakeLookup([], 'ENOTFOUND', asked),
      probeHost: 'probe.test',
    });
    const result = await client.check('https://missing.test/page');

    expect(result).toEqual({ kind: 'offline' });
    expect(asked).toEqual(['missing.test', 'probe.test']);
  });

  it('reports offline when DNS cannot answer at all (EAI_AGAIN)', async () => {
    const asked: string[] = [];
    const client = createHttpClient({
      ...quick,
      lookup: fakeLookup(['probe.test'], 'EAI_AGAIN', asked),
      probeHost: 'probe.test',
    });
    const result = await client.check('https://somewhere.test/');

    expect(result).toEqual({ kind: 'offline' });
    expect(asked).toEqual(['somewhere.test']);
  });

  it.each(['ftp://x', 'httpss://example.test', 'not a url', 'mailto:a@b.test'])(
    'reports connectionError for %s without making a request',
    async (url) => {
      const asked: string[] = [];
      const client = createHttpClient({
        ...quick,
        lookup: fakeLookup(['x', 'example.test'], 'ENOTFOUND', asked),
      });

      expect(await client.check(url)).toEqual({
        kind: 'connectionError',
        lastUrl: url,
      });
      expect(asked).toEqual([]);
    },
  );
});
