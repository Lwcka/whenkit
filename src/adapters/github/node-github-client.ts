import http from 'node:http';
import https from 'node:https';
import { z } from 'zod';
import type { GitHubClient, GitHubResult } from '../../core/ports';

// GitHubClient on the public GitHub REST API, without a token (AD-7, spec
// Constraints). Every outcome is a value; this client never throws.

export interface GitHubClientOptions {
  /** API root, without a trailing slash. Tests point it at a local server. */
  baseUrl?: string;
  /** Deadline for one lookup, every redirect hop included. */
  timeoutMs?: number;
}

const API_VERSION = '2022-11-28';
const USER_AGENT = 'whenkit';
/** Renamed repos answer with a redirect; more hops than this is a failure. */
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 307]);
/** A repository document is a few KB; anything beyond this is not one. */
const MAX_BODY_BYTES = 1_000_000;

const repoSchema = z.object({
  stargazers_count: z.number().int().nonnegative(),
  pushed_at: z.iso.datetime({ offset: true }).nullable(),
  archived: z.boolean(),
});

/** One response: status, the headers read here, and the body for a 200. */
type Hop =
  | {
      status: number;
      location: string | undefined;
      rateRemaining: string | undefined;
      body: string | undefined;
    }
  | { failed: true };

export function createGitHubClient({
  baseUrl = 'https://api.github.com',
  timeoutMs = 10_000,
}: GitHubClientOptions = {}): GitHubClient {
  return {
    async repo(owner, repo) {
      const deadline = new AbortController();
      const timer = setTimeout(() => deadline.abort(), timeoutMs);
      try {
        return await lookup(baseUrl, owner, repo, deadline.signal);
      } catch {
        return { kind: 'failed' };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

async function lookup(
  baseUrl: string,
  owner: string,
  repo: string,
  signal: AbortSignal,
): Promise<GitHubResult> {
  const root = baseUrl.replace(/\/+$/, '');
  let current = new URL(
    `${root}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
  for (let redirects = 0; ; redirects++) {
    const hop = await send(current, signal);
    if ('failed' in hop) return { kind: 'failed' };

    if (REDIRECT_STATUSES.has(hop.status) && hop.location !== undefined) {
      if (redirects >= MAX_REDIRECTS) return { kind: 'failed' };
      const next = new URL(hop.location, current);
      // Only a move inside the API is followed.
      if (!next.href.startsWith(`${root}/`)) return { kind: 'failed' };
      current = next;
      continue;
    }
    return classify(hop);
  }
}

function classify(hop: Exclude<Hop, { failed: true }>): GitHubResult {
  if (hop.status === 200) return parseRepo(hop.body);
  if (hop.status === 429) return { kind: 'rateLimited' };
  if (hop.status === 403 && hop.rateRemaining === '0') {
    return { kind: 'rateLimited' };
  }
  if (hop.status === 404) return { kind: 'notFound' };
  return { kind: 'failed' };
}

function parseRepo(body: string | undefined): GitHubResult {
  if (body === undefined) return { kind: 'failed' };
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return { kind: 'failed' };
  }
  const parsed = repoSchema.safeParse(data);
  if (!parsed.success) return { kind: 'failed' };
  return {
    kind: 'ok',
    stars: parsed.data.stargazers_count,
    // UTC ISO with milliseconds, like every moment the catalog stores.
    pushedAt:
      parsed.data.pushed_at === null
        ? null
        : new Date(parsed.data.pushed_at).toISOString(),
    archived: parsed.data.archived,
  };
}

/**
 * One GET. Only a 200 has its body read; any other answer is destroyed right
 * after the headers. `agent: false` keeps sockets out of a shared pool.
 */
function send(url: URL, signal: AbortSignal): Promise<Hop> {
  return new Promise((resolve) => {
    const transport = url.protocol === 'https:' ? https : http;
    let request: http.ClientRequest;
    try {
      request = transport.request(url, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': API_VERSION,
          'User-Agent': USER_AGENT,
        },
        signal,
        agent: false,
      });
    } catch {
      resolve({ failed: true });
      return;
    }
    request.on('error', () => resolve({ failed: true }));
    request.on('response', (response) => {
      const status = response.statusCode ?? 0;
      const header = (name: string): string | undefined => {
        const value = response.headers[name];
        return Array.isArray(value) ? value[0] : value;
      };
      const answer = {
        status,
        location: header('location'),
        rateRemaining: header('x-ratelimit-remaining'),
      };
      response.on('error', () => resolve({ failed: true }));
      if (status !== 200) {
        resolve({ ...answer, body: undefined });
        response.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          resolve({ failed: true });
          response.destroy();
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () =>
        resolve({ ...answer, body: Buffer.concat(chunks).toString('utf8') }),
      );
      // A connection cut mid-body ends without 'end'.
      response.on('close', () => resolve({ failed: true }));
    });
    request.end();
  });
}
