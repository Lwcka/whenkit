import { describe, expect, it } from 'vitest';
import { isValidHttpUrl } from './url-syntax';

describe('isValidHttpUrl', () => {
  it.each([
    'https://gutenberg.org',
    'http://example.com/a?b=c#d',
    'https://127.0.0.1:8080/x',
    'https://[::1]/',
    'HTTPS://Example.com',
  ])('accepts %s', (url) => {
    expect(isValidHttpUrl(url)).toBe(true);
  });

  it.each([
    'httpss://gutenberg.org',
    'https:/gutenberg.org',
    'https:gutenberg.org',
    'https:\\\\gutenberg.org',
    'https:///gutenberg.org',
    'htp://gutenberg.org',
    'ftp://example.com',
    'mailto:a@b.com',
    'gutenberg.org',
    'https://',
    'https://exa mple.com',
    'https://example.com/a b',
    ' https://example.com',
    '',
  ])('rejects %j', (url) => {
    expect(isValidHttpUrl(url)).toBe(false);
  });
});
