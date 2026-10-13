import { describe, expect, it } from 'vitest';
import { isBlocked, parseBlockedDomains } from './blocked-domains';

describe('parseBlockedDomains', () => {
  it('trims, lowercases, drops www., comments and blank lines', () => {
    const text = [
      '﻿# Domenii interzise',
      '',
      '  LibGen.*  ',
      'www.PdfDrive.com # inline comment',
      '   # indented comment',
      '12ft.io\r',
      'pdfdrive.com',
    ].join('\n');
    expect(parseBlockedDomains(text)).toEqual([
      'libgen.*',
      'pdfdrive.com',
      '12ft.io',
    ]);
  });

  it.each([
    'https://pdfdrive.com',
    'http://www.pdfdrive.com/',
    'pdfdrive.com/',
    'pdfdrive.com/path?x=1',
    '*.pdfdrive.com',
    'pdfdrive.com.',
    'pdfdrive.com:443',
    'HTTPS://*.PDFDrive.com:443/books/',
  ])(
    'normalizes the rule %j so it blocks the domain and its subdomains',
    (written) => {
      const rules = parseBlockedDomains(written);
      expect(rules).toEqual(['pdfdrive.com']);
      expect(isBlocked('https://pdfdrive.com/a', rules)).toBe('pdfdrive.com');
      expect(isBlocked('https://x.pdfdrive.com/a', rules)).toBe('pdfdrive.com');
    },
  );

  it('keeps a wildcard rule written with a scheme or a slash', () => {
    expect(parseBlockedDomains('https://libgen.*/\nsci-hub.*.')).toEqual([
      'libgen.*',
      'sci-hub.*',
    ]);
  });

  it('returns no rules for an empty or comment-only file', () => {
    expect(parseBlockedDomains('')).toEqual([]);
    expect(parseBlockedDomains('# nimic\n\n')).toEqual([]);
  });
});

describe('isBlocked', () => {
  const rules = parseBlockedDomains(
    'libgen.*\nsci-hub.*\nz-lib.*\npdfdrive.com\n12ft.io\n',
  );

  it.each([
    ['https://libgen.is/book', 'libgen.*'],
    ['http://libgen.co.uk', 'libgen.*'],
    ['https://mirror.libgen.rs/x', 'libgen.*'],
    ['https://www.sci-hub.se', 'sci-hub.*'],
    ['https://z-lib.org', 'z-lib.*'],
    ['https://pdfdrive.com/a', 'pdfdrive.com'],
    ['https://www.PDFDrive.com/', 'pdfdrive.com'],
    ['https://en.pdfdrive.com', 'pdfdrive.com'],
    ['https://12ft.io/proxy?q=x', '12ft.io'],
    ['https://pdfdrive.com./', 'pdfdrive.com'],
  ])('blocks %s by %s', (url, rule) => {
    expect(isBlocked(url, rules)).toBe(rule);
  });

  it.each([
    'https://gutenberg.org',
    'https://notlibgen.is',
    'https://libgen.example.com.evil.net',
    'https://libgen',
    'https://mypdfdrive.com',
    'https://pdfdrive.com.evil.net',
    'https://12ft.io.example',
    'not a url',
    'ftp://libgen.is',
  ])('does not block %s', (url) => {
    expect(isBlocked(url, rules)).toBeUndefined();
  });

  it('blocks nothing without rules', () => {
    expect(isBlocked('https://libgen.is', [])).toBeUndefined();
  });
});
