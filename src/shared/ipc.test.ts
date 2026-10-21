import { describe, expect, it } from 'vitest';
import {
  isExternalUrl,
  isZoomIntent,
  WORKSPACE_ARGUMENT_PREFIX,
  workspaceFromArgv,
} from './ipc';

describe('workspaceFromArgv', () => {
  it.each([
    [
      'the workspace argument',
      ['electron', `${WORKSPACE_ARGUMENT_PREFIX}D:\\ws`],
      'D:\\ws',
    ],
    ['no arguments', [], null],
    ['an absent argument', ['electron', '--other'], null],
    ['an empty value', [WORKSPACE_ARGUMENT_PREFIX], null],
    [
      'an empty value before a valid one',
      [WORKSPACE_ARGUMENT_PREFIX, `${WORKSPACE_ARGUMENT_PREFIX}C:\\w`],
      'C:\\w',
    ],
  ])('%s', (_label, argv, expected) => {
    expect(workspaceFromArgv(argv)).toBe(expected);
  });
});

describe('isZoomIntent', () => {
  it.each(['in', 'out', 'reset'])('accepts %s', (value) => {
    expect(isZoomIntent(value)).toBe(true);
  });

  it.each(['big', '', 'IN', 2, 1.1, null, undefined, {}, ['in']])(
    'refuses %j',
    (value) => {
      expect(isZoomIntent(value)).toBe(false);
    },
  );
});

describe('isExternalUrl', () => {
  it.each(['https://react.dev', 'http://a.b/c?d=1#e', 'HTTPS://A.B'])(
    'accepts %s',
    (value) => {
      expect(isExternalUrl(value)).toBe(true);
    },
  );

  it.each([
    'javascript:alert(1)',
    'file:///C:/a',
    'mailto:a@b',
    'ftp://a.b',
    'data:text/html,x',
    'not a url',
    '/relative/path',
    '',
    42,
    null,
    undefined,
    { href: 'https://a.b' },
  ])('refuses %j', (value) => {
    expect(isExternalUrl(value)).toBe(false);
  });
});
