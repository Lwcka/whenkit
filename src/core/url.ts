import { nameKey } from './name-key';

// URL normalization and the duplicate key (AD-5, AD-7). These exist only
// here; the catalog stores the URL as submitted and compares normalized keys.

// Only `scheme://` counts as a scheme: in `example.com:8080/x` the part
// before the colon is a host, not a scheme.
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Drops `utm_*` parameters from a raw query string (without the `?`). */
function withoutTracking(query: string): string {
  return query
    .split('&')
    .filter((pair) => pair !== '' && !/^utm_/i.test(pair.split('=')[0]))
    .join('&');
}

/**
 * The comparable form of a URL: host lowercased and without `www.`, no
 * scheme, credentials, fragment, trailing slash or `utm_*` parameters; path
 * and remaining query kept as written. Input that does not parse as an
 * http(s) URL is trimmed, lowercased and stripped of its scheme.
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return fallback(trimmed);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return fallback(trimmed);
  }
  const host = url.host.replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '');
  const query = withoutTracking(url.search.replace(/^\?/, ''));
  return `${host}${path}${query === '' ? '' : `?${query}`}`;
}

function fallback(trimmed: string): string {
  return trimmed.toLowerCase().replace(SCHEME, '');
}

/**
 * The duplicate key of an entry (AD-5): `url:<normalized URL>`, or, for a
 * concept without a link, `title:<name_key of its name>`.
 */
export function dedupKey(entry: { url?: string | null; name: string }): string {
  return entry.url === undefined || entry.url === null
    ? `title:${nameKey(entry.name)}`
    : `url:${normalizeUrl(entry.url)}`;
}

/** First path segments of github.com that are site pages, not account names. */
const GITHUB_RESERVED = new Set([
  'about',
  'account',
  'advisories',
  'apps',
  'codespaces',
  'collections',
  'contact',
  'copilot',
  'customer-stories',
  'dashboard',
  'enterprise',
  'events',
  'explore',
  'features',
  'issues',
  'join',
  'login',
  'logout',
  'marketplace',
  'new',
  'notifications',
  'orgs',
  'organizations',
  'premium-support',
  'pricing',
  'pulls',
  'readme',
  'resources',
  'search',
  'security',
  'sessions',
  'settings',
  'signup',
  'site',
  'solutions',
  'sponsors',
  'stars',
  'team',
  'topics',
  'trending',
  'users',
  'watching',
]);

const GITHUB_OWNER = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
const GITHUB_REPO = /^[a-z0-9._-]+$/i;

/**
 * The repository a URL points at (AD-7): the first two path segments of a
 * `github.com` or `www.github.com` http(s) URL, `.git` stripped from the
 * repo name, case kept as written. Subpaths (`/tree/main/docs`) still name
 * their repo. Anything else (other hosts, gists, `/topics/x`, an account
 * page) is undefined.
 */
export function githubRepo(
  input: string,
): { owner: string; repo: string } | undefined {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
    return undefined;
  }
  const [owner, rawRepo] = url.pathname.split('/').filter((s) => s !== '');
  if (owner === undefined || rawRepo === undefined) return undefined;
  if (GITHUB_RESERVED.has(owner.toLowerCase())) return undefined;
  const repo = rawRepo.replace(/\.git$/i, '');
  if (!GITHUB_OWNER.test(owner) || !GITHUB_REPO.test(repo)) return undefined;
  if (repo === '.' || repo === '..') return undefined;
  return { owner, repo };
}
