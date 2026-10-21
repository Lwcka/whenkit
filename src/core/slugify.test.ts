import { describe, expect, it } from 'vitest';
import { slugify, slugMap } from './slugify';

describe('slugify', () => {
  it.each([
    ['remove.bg', 'remove-bg'],
    ['Șabloane & Țâțe', 'sabloane-tate'],
    ['C++', 'c'],
    ['  --Hello   World--  ', 'hello-world'],
    ['Node.js 24', 'node-js-24'],
  ])('turns %s into %s', (text, slug) => {
    expect(slugify(text, 'fisa')).toBe(slug);
  });

  it('cuts to 80 characters without a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(79)} bbbbbbbb`, 'fisa');
    expect(slug).toBe('a'.repeat(79));
    expect(slugify('x'.repeat(120), 'fisa')).toBe('x'.repeat(80));
  });

  it('falls back when nothing is left', () => {
    expect(slugify('日本', 'fisa')).toBe('fisa');
    expect(slugify('', 'fisa')).toBe('fisa');
    expect(slugify('+++', 'fisa')).toBe('fisa');
  });

  it.each([
    ['CON', 'con-1'],
    ['nul', 'nul-1'],
    ['Com1', 'com1-1'],
    ['LPT9', 'lpt9-1'],
    ['aux', 'aux-1'],
    ['com0', 'com0'],
    ['console', 'console'],
  ])('suffixes the Windows reserved name %s', (text, slug) => {
    expect(slugify(text, 'fisa')).toBe(slug);
  });
});

describe('slugMap', () => {
  const entry = (
    id: string,
    name: string,
    addedAt = '2026-10-13T12:00:00.000Z',
  ) => ({
    id,
    name,
    addedAt,
  });

  it('suffixes a collision, the older entry keeps the plain slug', () => {
    const slugs = slugMap(
      [
        entry('b', 'docker', '2026-10-14T00:00:00.000Z'),
        entry('a', 'Dócker', '2026-10-13T00:00:00.000Z'),
        entry('c', 'DOCKER', '2026-10-15T00:00:00.000Z'),
      ],
      'fisa',
    );
    expect(slugs.get('a')).toBe('docker');
    expect(slugs.get('b')).toBe('docker-2');
    expect(slugs.get('c')).toBe('docker-3');
  });

  it('breaks an addedAt tie by id', () => {
    const slugs = slugMap([entry('2', 'Git'), entry('1', 'Git')], 'fisa');
    expect(slugs.get('1')).toBe('git');
    expect(slugs.get('2')).toBe('git-2');
  });

  it('gives a later entry whose own slug is taken a further suffix', () => {
    const slugs = slugMap(
      [
        entry('a', 'Docker', '2026-10-13T00:00:00.000Z'),
        entry('b', 'Docker', '2026-10-14T00:00:00.000Z'),
        entry('c', 'docker-2', '2026-10-15T00:00:00.000Z'),
      ],
      'fisa',
    );
    expect([...slugs.values()]).toEqual(['docker', 'docker-2', 'docker-2-2']);
  });

  it('keeps a suffixed slug within 80 characters', () => {
    const long = 'x'.repeat(120);
    const slugs = slugMap(
      [
        entry('a', long, '2026-10-13T00:00:00.000Z'),
        entry('b', long, '2026-10-14T00:00:00.000Z'),
      ],
      'fisa',
    );
    expect(slugs.get('a')).toBe('x'.repeat(80));
    expect(slugs.get('b')).toBe(`${'x'.repeat(78)}-2`);
  });

  it('numbers the fallback and the reserved names too', () => {
    const slugs = slugMap(
      [
        entry('a', '日本', '2026-10-13T00:00:00.000Z'),
        entry('b', '中国', '2026-10-14T00:00:00.000Z'),
        entry('c', 'CON', '2026-10-15T00:00:00.000Z'),
        entry('d', 'con', '2026-10-16T00:00:00.000Z'),
      ],
      'fisa',
    );
    expect([...slugs.values()]).toEqual(['fisa', 'fisa-2', 'con-1', 'con-1-2']);
  });
});
