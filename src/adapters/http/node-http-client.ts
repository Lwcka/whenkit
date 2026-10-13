import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import type { HttpClient, HttpResult } from '../../core/ports';
import { BROWSER_USER_AGENT } from './user-agent';

// HttpClient on node:http/node:https (AD-7). Not fetch: only these take an
// injectable `lookup`, which lets tests fake DNS without the real internet.

export interface HttpClientOptions {
  /** Deadline for one whole check: every redirect hop and the GET retry. */
  timeoutMs?: number;
  /** Name resolution with `dns.lookup`'s signature; IP literals skip it. */
  lookup?: LookupFunction;
  /**
   * A host that must exist. When a name is not found, resolving this host
   * tells a missing domain (it resolves) from no network (it does not):
   * Windows answers ENOTFOUND for both.
   */
  probeHost?: string;
  /**
   * Time the probe lookup gets, on its own budget: a check that spent most
   * of its deadline on slow hops must not turn a dead domain into `offline`,
   * which stops a whole import.
   */
  probeTimeoutMs?: number;
  /** Redirects followed before giving up with `connectionError`. */
  maxRedirects?: number;
}

type Method = 'HEAD' | 'GET';

/** One request's answer: its status and Location, or the error's code. */
type Hop =
  | { status: number; location: string | undefined }
  | { errorCode: string | undefined };

interface CheckContext {
  lookup: LookupFunction;
  probeHost: string;
  probeTimeoutMs: number;
  maxRedirects: number;
  /** Aborted when the check's deadline passes. */
  signal: AbortSignal;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const NAME_NOT_FOUND_CODES = new Set(['ENOTFOUND', 'ENODATA']);
const OFFLINE_CODES = new Set(['EAI_AGAIN', 'ENETUNREACH', 'ENETDOWN']);
/** OpenSSL certificate codes and Node's TLS/SSL error codes. */
const TLS_CODE =
  /^(CERT_|UNABLE_TO_VERIFY_|UNABLE_TO_GET_ISSUER_CERT|ERR_TLS_|ERR_SSL_)|SELF_SIGNED/;

const REQUEST_HEADERS = {
  'User-Agent': BROWSER_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

export function createHttpClient({
  timeoutMs = 10_000,
  lookup = dns.lookup,
  probeHost = 'example.com',
  probeTimeoutMs = 3_000,
  maxRedirects = 10,
}: HttpClientOptions = {}): HttpClient {
  return {
    async check(rawUrl) {
      const url = parseHttpUrl(rawUrl);
      if (!url) return { kind: 'connectionError', lastUrl: rawUrl };

      const deadline = new AbortController();
      const timer = setTimeout(() => deadline.abort(), timeoutMs);
      const context: CheckContext = {
        lookup,
        probeHost,
        probeTimeoutMs,
        maxRedirects,
        signal: deadline.signal,
      };
      try {
        const head = await follow(url, 'HEAD', context);
        // Many servers answer HEAD wrongly (405, 403, even 404), so any
        // HEAD error status is retried with GET, and GET's answer wins.
        if (head.kind !== 'httpError') return head;
        return await follow(url, 'GET', context);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** The URL when it parses (against `base`) and is http(s); else undefined. */
function parseHttpUrl(input: string, base?: URL): URL | undefined {
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    return undefined;
  }
  return url.protocol === 'http:' || url.protocol === 'https:'
    ? url
    : undefined;
}

/** `input` resolved against `base`, or `input` itself when it does not parse. */
function resolveHref(input: string, base: URL): string {
  try {
    return new URL(input, base).href;
  } catch {
    return input;
  }
}

/** Requests `start` with `method`, following redirects up to the limit. */
async function follow(
  start: URL,
  method: Method,
  context: CheckContext,
): Promise<HttpResult> {
  let current = start;
  for (let redirects = 0; ; redirects++) {
    const hop = await send(current, method, context);
    if ('errorCode' in hop) {
      return classifyError(hop.errorCode, current.href, context);
    }

    if (REDIRECT_STATUSES.has(hop.status) && hop.location !== undefined) {
      if (redirects >= context.maxRedirects) {
        return { kind: 'connectionError', lastUrl: current.href };
      }
      const next = parseHttpUrl(hop.location, current);
      if (!next) {
        return {
          kind: 'connectionError',
          lastUrl: resolveHref(hop.location, current),
        };
      }
      current = next;
      continue;
    }

    const finalUrl = current.href;
    return hop.status < 400
      ? { kind: 'ok', status: hop.status, finalUrl }
      : { kind: 'httpError', status: hop.status, finalUrl };
  }
}

/**
 * One request. Resolves on the response headers and destroys the response
 * right away (the body is never read), so no socket stays open. `agent:
 * false` keeps sockets out of any shared keep-alive pool.
 */
function send(url: URL, method: Method, context: CheckContext): Promise<Hop> {
  return new Promise((resolve) => {
    const transport = url.protocol === 'https:' ? https : http;
    let request: http.ClientRequest;
    try {
      request = transport.request(url, {
        method,
        headers: REQUEST_HEADERS,
        lookup: context.lookup,
        signal: context.signal,
        agent: false,
      });
    } catch (error) {
      resolve({ errorCode: codeOf(error) });
      return;
    }
    request.on('response', (response) => {
      response.on('error', () => {});
      resolve({
        status: response.statusCode ?? 0,
        location: response.headers.location,
      });
      response.destroy();
    });
    request.on('error', (error) => resolve({ errorCode: codeOf(error) }));
    request.end();
  });
}

/** Maps a failed request for `lastUrl` to its result. */
async function classifyError(
  code: string | undefined,
  lastUrl: string,
  context: CheckContext,
): Promise<HttpResult> {
  if (context.signal.aborted) return { kind: 'timeout', lastUrl };
  if (code === undefined) return { kind: 'connectionError', lastUrl };
  if (NAME_NOT_FOUND_CODES.has(code)) {
    return (await probeResolves(context))
      ? { kind: 'dnsNotFound', lastUrl }
      : { kind: 'offline' };
  }
  if (OFFLINE_CODES.has(code)) return { kind: 'offline' };
  if (TLS_CODE.test(code)) return { kind: 'tlsError', lastUrl };
  return { kind: 'connectionError', lastUrl };
}

/**
 * Whether the probe host resolves within `probeTimeoutMs`, a budget of its
 * own, independent of the check's deadline. A lookup cannot be cancelled,
 * so the timer just stops waiting for it.
 */
function probeResolves(context: CheckContext): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), context.probeTimeoutMs);
    const settle = (resolves: boolean) => {
      clearTimeout(timer);
      resolve(resolves);
    };
    try {
      context.lookup(context.probeHost, {}, (error) => settle(!error));
    } catch {
      settle(false);
    }
  });
}

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}
