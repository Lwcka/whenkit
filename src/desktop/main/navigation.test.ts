import { describe, expect, it } from 'vitest';
import { isAppNavigation } from './navigation';

const DEV = 'http://localhost:5173/';
const FILE =
  'file:///C:/Apps/WhenKit/resources/app/.vite/renderer/main_window/index.html';

describe('isAppNavigation with the dev server', () => {
  it.each([
    ['the same page', 'http://localhost:5173/', true],
    [
      'another path of the same origin',
      'http://localhost:5173/other?x=1#h',
      true,
    ],
    ['another port', 'http://localhost:5174/', false],
    ['another host', 'http://example.com/', false],
    ['https on the same host and port', 'https://localhost:5173/', false],
    ['a file URL', FILE, false],
    ['javascript:', 'javascript:alert(1)', false],
    ['not a URL', 'not a url', false],
    ['an empty string', '', false],
  ])('%s', (_label, target, expected) => {
    expect(isAppNavigation(target, DEV)).toBe(expected);
  });
});

describe('isAppNavigation with the packaged page', () => {
  it.each([
    ['the same page', FILE, true],
    ['the same page with query and hash', `${FILE}?a=1#top`, true],
    ['another file', FILE.replace('index.html', 'other.html'), false],
    ['a dev server URL', DEV, false],
    ['a remote page', 'https://example.com/', false],
    ['data:', 'data:text/html,hi', false],
  ])('%s', (_label, target, expected) => {
    expect(isAppNavigation(target, FILE)).toBe(expected);
  });

  it('is false when the app URL itself is unusable', () => {
    expect(isAppNavigation(FILE, 'nonsense')).toBe(false);
    expect(isAppNavigation('about:blank', 'about:blank')).toBe(false);
  });
});
