import type { Batch, BatchItem } from '../batch-schema';
import { WhenkitError } from '../errors';
import type { GitHubClient, HttpClient, HttpResult } from '../ports';
import { githubRepo } from '../url';
import { isBlocked } from './blocked-domains';
import type { VerdictReason } from './reason-codes';
import { isValidHttpUrl } from './url-syntax';

// Verification (AD-7): phase 2 of the import. Deterministic rules over the
// HttpClient port; every outcome is a value. The only exception is OFFLINE,
// which is not a verdict on an item: it stops the whole import (exit 3).

/** Statuses of a site that refuses programs; the link counts as working. */
const BLOCKS_AUTOMATION_STATUSES = new Set([401, 403, 429]);

/** Checks of one link: the first one plus two retries on 5xx or timeout. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_000;
/** Link checks running at the same time, across the whole batch. */
const MAX_CONCURRENT_CHECKS = 4;

export interface VerificationContext {
  http: HttpClient;
  /** Reads repository metadata for an item whose own URL is a GitHub repo. */
  github: GitHubClient;
  /** Rules from parseBlockedDomains(). */
  blockedDomains: readonly string[];
  /** Waits before a retry; tests inject one that does not sleep. */
  wait?: (ms: number) => Promise<void>;
  /** Pause before each retry; 1 s by default. */
  retryDelayMs?: number;
}

/** What one link's check concluded. */
export type LinkVerdict =
  /** Works; `note` is `blocks_automation` for 401/403/429. */
  | { kind: 'accepted'; note?: VerdictReason }
  /** 5xx or timeout on every attempt. */
  | { kind: 'warned' }
  | { kind: 'rejected'; reason: VerdictReason }
  /** No network: the import must stop. */
  | { kind: 'offline' };

/** What the GitHub API said about an item's repository (only on `ok`). */
export interface GithubMetadata {
  stars: number;
  pushedAt: string | null;
  archived: boolean;
}

export type ItemOutcome = 'accepted' | 'warned' | 'rejected';

export interface ItemVerdict {
  outcome: ItemOutcome;
  /**
   * Rejected: the rejection reasons. Warned or accepted: the warnings and
   * notes, which the entry stores as its verification notes.
   */
  reasons: VerdictReason[];
  /** The concept's sources that stay (all but the removed ones); [] otherwise. */
  sources: string[];
  /**
   * Rejected only: what a forced write needs besides the rejection reasons
   * (AD-7). `warnings`: the warnings and notes the item would have had.
   * `forcedSources`: the sources that stay when forcing, all but the dead or
   * invalid ones; a source on a blocked domain is kept, since forcing
   * bypasses exactly that rejection.
   */
  warnings?: VerdictReason[];
  forcedSources?: string[];
  /**
   * Present only when the item's own URL is a GitHub repo, its link check
   * was accepted or warned and the API answered. Absent otherwise, even on
   * a rate limit: GitHub data never decides an outcome (AD-7).
   */
  github?: GithubMetadata;
}

/** Verdicts of a batch, by item `ref`. */
export type BatchVerdicts = ReadonlyMap<string, ItemVerdict>;

const defaultWait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs at most `limit` tasks at a time, in the order they ask. */
function limiter(limit: number) {
  let running = 0;
  const queue: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (running >= limit) {
      await new Promise<void>((resolve) => queue.push(resolve));
    } else {
      running += 1;
    }
    try {
      return await task();
    } finally {
      // The slot passes straight to the next waiting task, if any.
      const next = queue.shift();
      if (next === undefined) running -= 1;
      else next();
    }
  };
}

type Limit = ReturnType<typeof limiter>;

interface CheckContext extends VerificationContext {
  limit: Limit;
  /**
   * Set by the first `offline` answer (or failure); every later check then
   * answers offline without reaching the port. Shared by one batch.
   */
  stop: { stopped: boolean };
}

function checkContext(ctx: VerificationContext): CheckContext {
  return {
    ...ctx,
    limit: limiter(MAX_CONCURRENT_CHECKS),
    stop: { stopped: false },
  };
}

/** One request through the shared limit, honouring the stop flag. */
function request(url: string, ctx: CheckContext): Promise<HttpResult> {
  return ctx.limit(async () => {
    if (ctx.stop.stopped) return { kind: 'offline' };
    const result = await ctx.http.check(url);
    // Set inside the slot, before it passes to the next waiting check.
    if (result.kind === 'offline') ctx.stop.stopped = true;
    return result;
  });
}

function blocked(rule: string): LinkVerdict {
  return {
    kind: 'rejected',
    reason: { code: 'blocked_domain', params: { domain: rule } },
  };
}

/** The URL a result reached: `finalUrl` or `lastUrl`. */
function reachedUrl(result: HttpResult): string | undefined {
  if ('finalUrl' in result) return result.finalUrl;
  if ('lastUrl' in result) return result.lastUrl;
  return undefined;
}

/** One result → a verdict, or `retry` for 5xx and timeouts. */
function classify(result: HttpResult): LinkVerdict | 'retry' {
  switch (result.kind) {
    case 'ok':
      return { kind: 'accepted' };
    case 'httpError':
      if (BLOCKS_AUTOMATION_STATUSES.has(result.status)) {
        return { kind: 'accepted', note: { code: 'blocks_automation' } };
      }
      if (result.status >= 500 && result.status <= 599) return 'retry';
      return {
        kind: 'rejected',
        reason: {
          code: 'http_error',
          params: { status: String(result.status) },
        },
      };
    case 'timeout':
      return 'retry';
    case 'dnsNotFound':
      return { kind: 'rejected', reason: { code: 'dns_not_found' } };
    case 'tlsError':
      return { kind: 'rejected', reason: { code: 'tls_error' } };
    case 'connectionError':
      return { kind: 'rejected', reason: { code: 'connection_error' } };
    case 'offline':
      return { kind: 'offline' };
  }
}

async function check(url: string, ctx: CheckContext): Promise<LinkVerdict> {
  if (!isValidHttpUrl(url)) {
    return { kind: 'rejected', reason: { code: 'invalid_url' } };
  }
  // Before the request: a blocked site is never contacted.
  const submittedRule = isBlocked(url, ctx.blockedDomains);
  if (submittedRule !== undefined) return blocked(submittedRule);

  const wait = ctx.wait ?? defaultWait;
  for (let attempt = 1; ; attempt++) {
    const result = await request(url, ctx);
    if (result.kind === 'offline') return { kind: 'offline' };
    const reached = reachedUrl(result);
    const reachedRule =
      reached === undefined
        ? undefined
        : isBlocked(reached, ctx.blockedDomains);
    if (reachedRule !== undefined) return blocked(reachedRule);

    const verdict = classify(result);
    if (verdict !== 'retry') return verdict;
    if (attempt >= MAX_ATTEMPTS) return { kind: 'warned' };
    // The wait holds no check slot, so other links go on meanwhile.
    await wait(ctx.retryDelayMs ?? RETRY_DELAY_MS);
  }
}

/** One GitHub lookup through the shared limit, honouring the stop flag. */
async function fetchGithub(
  url: string,
  ctx: CheckContext,
): Promise<GithubMetadata | undefined> {
  const repo = githubRepo(url);
  if (repo === undefined) return undefined;
  return ctx.limit(async () => {
    if (ctx.stop.stopped) return undefined;
    const result = await ctx.github.repo(repo.owner, repo.repo);
    if (result.kind !== 'ok') return undefined;
    return {
      stars: result.stars,
      pushedAt: result.pushedAt,
      archived: result.archived,
    };
  });
}

/**
 * Checks one link by the AD-7 table: syntax, the blocked domains (on the
 * submitted URL, then on the URL the check reached), then the HTTP result,
 * with two retries on 5xx or timeout.
 */
export function checkLink(
  url: string,
  ctx: VerificationContext,
): Promise<LinkVerdict> {
  return check(url, checkContext(ctx));
}

function offline(): WhenkitError {
  return new WhenkitError('OFFLINE', {
    detail: 'a link check found no network',
  });
}

async function verify(
  item: BatchItem,
  ctx: CheckContext,
  forced: boolean,
): Promise<ItemVerdict> {
  const sources = item.kind === 'concept' ? item.sources : [];
  const flag: VerdictReason[] =
    item.flaggedByClaude === undefined
      ? []
      : [{ code: 'flagged_by_claude', params: { text: item.flaggedByClaude } }];
  // Claude's verdict decides alone: a flagged item is never contacted, unless
  // `--force` asks for it. Then its links are checked like any other's, so a
  // forced write never stores an unchecked URL or source (AD-3).
  if (flag.length > 0 && !forced) {
    return {
      outcome: 'rejected',
      reasons: flag,
      sources,
      warnings: [],
      forcedSources: sources,
    };
  }

  const [own, ...sourceVerdicts] = await Promise.all([
    item.url === undefined ? undefined : check(item.url, ctx),
    ...sources.map((source) => check(source, ctx)),
  ]);

  const rejections: VerdictReason[] = [...flag];
  const warnings: VerdictReason[] = [];
  const notes: VerdictReason[] = [];
  const kept: string[] = [];
  /** `kept` plus the sources on blocked domains, for a forced write. */
  const forcedKept: string[] = [];

  if (own !== undefined) {
    if (own.kind === 'offline') throw offline();
    if (own.kind === 'rejected') rejections.push(own.reason);
    else if (own.kind === 'warned')
      warnings.push({ code: 'no_response_at_import' });
    else if (own.note !== undefined) notes.push(own.note);
  }

  // GitHub data (AD-7) only for a link that works; it never changes the
  // outcome, an archived repo only gains a note.
  const github =
    item.url !== undefined &&
    (own?.kind === 'accepted' || own?.kind === 'warned')
      ? await fetchGithub(item.url, ctx)
      : undefined;
  if (github?.archived === true) notes.push({ code: 'github_archived' });

  sources.forEach((url, index) => {
    const verdict = sourceVerdicts[index] as LinkVerdict;
    if (verdict.kind === 'offline') throw offline();
    if (verdict.kind === 'rejected') {
      if (verdict.reason.code === 'blocked_domain') {
        rejections.push({
          code: 'source_blocked_domain',
          params: { url, domain: verdict.reason.params?.domain ?? '' },
        });
        forcedKept.push(url);
      } else {
        // A dead or invalid source goes; the concept stays, warned.
        warnings.push({ code: 'source_link_removed', params: { url } });
      }
      return;
    }
    kept.push(url);
    forcedKept.push(url);
    if (verdict.kind === 'warned') {
      warnings.push({ code: 'no_response_at_import', params: { url } });
    }
  });

  if (rejections.length > 0) {
    return {
      outcome: 'rejected',
      reasons: rejections,
      sources: kept,
      warnings: [...warnings, ...notes],
      forcedSources: forcedKept,
      ...(github === undefined ? {} : { github }),
    };
  }
  return {
    outcome: warnings.length > 0 ? 'warned' : 'accepted',
    reasons: [...warnings, ...notes],
    sources: kept,
    ...(github === undefined ? {} : { github }),
  };
}

/**
 * Verifies one batch item: Claude's flag first (rejected, no request; when
 * `forced` the links are checked too and the flag is the first rejection),
 * then its URL, when it has one, and a concept's sources. A rejected source
 * is removed (`source_link_removed`, warned) unless it is on a blocked
 * domain, which rejects the concept (`source_blocked_domain`). Throws
 * OFFLINE when a check finds no network.
 */
export function verifyItem(
  item: BatchItem,
  ctx: VerificationContext,
  forced = false,
): Promise<ItemVerdict> {
  return verify(item, checkContext(ctx), forced);
}

/**
 * Phase 2 (AD-6): verifies every item of a batch, at most four link checks
 * at a time, and returns the verdicts by ref. Holds no transaction. The refs
 * in `force` are verified as forced (see verifyItem). On the first `offline`
 * it starts no new item, lets the running checks finish and throws OFFLINE:
 * nothing may be written or rejected.
 */
export async function verifyBatch(
  batch: Batch,
  ctx: VerificationContext,
  force: readonly string[] = [],
): Promise<BatchVerdicts> {
  const forceRefs = new Set(force);
  const checkCtx = checkContext(ctx);
  let failure: { error: unknown } | undefined;

  // Every item starts at once; the shared limit keeps four checks in flight.
  // Settling them all before throwing leaves no request running behind.
  const results = await Promise.all(
    batch.items.map(async (item) => {
      try {
        return await verify(item, checkCtx, forceRefs.has(item.ref));
      } catch (error) {
        checkCtx.stop.stopped = true;
        failure ??= { error };
        return undefined;
      }
    }),
  );

  if (failure !== undefined) throw failure.error;
  return new Map(
    batch.items.map((item, index) => [item.ref, results[index] as ItemVerdict]),
  );
}
