import { describe, expect, it } from 'vitest';
import { dedupKey, normalizeUrl } from './url';

describe('normalizeUrl', () => {
  it.each([
    ['https://www.Remove.BG/', 'remove.bg'],
    ['http://remove.bg', 'remove.bg'],
    ['  https://remove.bg/  ', 'remove.bg'],
    ['https://GitHub.com/Owner/Repo/', 'github.com/Owner/Repo'],
    ['https://github.com/owner/repo#readme', 'github.com/owner/repo'],
    [
      'https://example.com/a?utm_source=x&id=7&UTM_medium=y',
      'example.com/a?id=7',
    ],
    ['https://example.com/?utm_source=x', 'example.com'],
    ['https://user:pw@example.com:8080/x/', 'example.com:8080/x'],
    ['https://example.com:443/x', 'example.com/x'],
    ['https://wwwx.example.com', 'wwwx.example.com'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  it.each([
    ['not a url', 'not a url'],
    ['  GitHub.com/Owner  ', 'github.com/owner'],
    ['ftp://Files.Example.com/x', 'files.example.com/x'],
    ['Example.com:8080/x', 'example.com:8080/x'],
    ['localhost:3000', 'localhost:3000'],
  ])('falls back for %j', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  it('keeps the host of scheme-less host:port inputs apart', () => {
    expect(normalizeUrl('example.com:8080/x')).not.toBe(
      normalizeUrl('other.org:8080/x'),
    );
  });

  it('gives http and https, www and trailing slash the same form', () => {
    const forms = [
      'https://www.remove.bg/',
      'http://remove.bg',
      'https://remove.bg/#top',
      'https://remove.bg?utm_campaign=launch',
    ].map(normalizeUrl);
    expect(new Set(forms)).toEqual(new Set(['remove.bg']));
  });
});

describe('dedupKey', () => {
  it('uses the normalized URL when there is one', () => {
    expect(dedupKey({ url: 'https://www.remove.bg/', name: 'remove.bg' })).toBe(
      'url:remove.bg',
    );
  });

  it('uses the name_key of the title for a concept without a link', () => {
    expect(dedupKey({ name: '  Tipuri de   API ' })).toBe(
      'title:tipuri de api',
    );
    expect(dedupKey({ url: null, name: 'Arhitectură' })).toBe(
      'title:arhitectura',
    );
  });
});
