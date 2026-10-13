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
