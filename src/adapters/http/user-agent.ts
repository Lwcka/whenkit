/**
 * A current desktop Chrome on Windows. Many sites answer programs with a
 * generic User-Agent differently from browsers (403, captcha pages), and
 * verification must see what the user would see (AD-7). Bump the version
 * now and then; the exact number matters less than looking like a browser.
 */
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
