// The blocked-domain list (AD-7, conventions table): one rule per line in
// <workspace>/data/blocked-domains.txt, edited only by the user. This is the
// only parser of that file and the only matcher of its rules.
//
// A plain rule (`pdfdrive.com`) matches that domain and its subdomains. A
// rule ending in `.*` (`libgen.*`) matches its labels followed by one or two
// more labels, i.e. any TLD (`libgen.is`, `libgen.co.uk`), subdomains
// included (`mirror.libgen.is`).

const WILDCARD_SUFFIX = '.*';

/**
 * One rule as the user may write it → its matchable form: lowercased,
 * without scheme, path, port, trailing dot, `www.` or a leading `*.` (a
 * plain domain already covers its subdomains).
 */
function normalizeRule(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?].*$/, '')
    .replace(/:\d*$/, '')
    .replace(/\.+$/, '')
    .replace(/^\*\./, '')
    .replace(/^www\./, '');
}

/**
 * The rules of a blocked-domains file, normalized by normalizeRule(); `#`
 * starts a comment, blank lines are skipped.
 */
export function parseBlockedDomains(text: string): string[] {
  const rules: string[] = [];
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const hash = line.indexOf('#');
    const rule = normalizeRule(hash === -1 ? line : line.slice(0, hash));
    if (rule !== '' && !rules.includes(rule)) rules.push(rule);
  }
  return rules;
}

/** The host of an http(s) URL, lowercased, without a trailing dot. */
function hostOf(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return undefined;
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  return host === '' ? undefined : host;
}

function matches(labels: readonly string[], rule: string): boolean {
  if (!rule.endsWith(WILDCARD_SUFFIX)) {
    const ruleLabels = rule.split('.');
    const start = labels.length - ruleLabels.length;
    return (
      start >= 0 && ruleLabels.every((label, i) => labels[start + i] === label)
    );
  }
  const prefix = rule.slice(0, -WILDCARD_SUFFIX.length).split('.');
  // The prefix may start at any label (subdomains), and one or two labels
  // (the TLD, e.g. `is` or `co.uk`) must follow it.
  for (let start = 0; start + prefix.length < labels.length; start++) {
    const rest = labels.length - start - prefix.length;
    if (rest <= 2 && prefix.every((label, i) => labels[start + i] === label)) {
      return true;
    }
  }
  return false;
}

/**
 * The first rule that blocks `url`'s host, or undefined when none does (or
 * when `url` is not an http(s) URL).
 */
export function isBlocked(
  url: string,
  rules: readonly string[],
): string | undefined {
  const host = hostOf(url);
  if (host === undefined) return undefined;
  const labels = host.split('.');
  return rules.find((rule) => matches(labels, rule));
}
