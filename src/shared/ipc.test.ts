import { describe, expect, it } from 'vitest';
import { WORKSPACE_ARGUMENT_PREFIX, workspaceFromArgv } from './ipc';

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
