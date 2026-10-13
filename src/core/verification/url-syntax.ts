// URL syntax check (AD-7): the first verification step, before any request.
// A typo such as `httpss://` is rejected here instead of being repaired.

/**
 * The scheme and `//` as written, then a host character. Checked on the raw
 * input because the URL parser repairs `https:/x`, `https:x`, `https:\\x`
 * and `https:///x` into valid URLs.
 */
const WRITTEN_PREFIX = /^https?:\/\/[^/\\\s]/i;

/**
 * True when `input` is an absolute http(s) URL, written as such, with a
 * host and no whitespace anywhere.
 */
export function isValidHttpUrl(input: string): boolean {
  if (/\s/.test(input) || !WRITTEN_PREFIX.test(input)) return false;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.hostname !== ''
  );
}
