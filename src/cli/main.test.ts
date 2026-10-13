import { describe, expect, it } from 'vitest';
import { version } from '../../package.json';
import { main } from './main';

function runCli(args: string[]) {
  let stdout = '';
  let stderr = '';
  const exitCode = main(args, {
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { exitCode, stdout, stderr };
}

describe('whenkit CLI', () => {
  it('prints the package version for --version', () => {
    const result = runCli(['--version']);
    expect(result).toEqual({ exitCode: 0, stdout: `${version}\n`, stderr: '' });
  });

  it.each([[[]], [['--help']]])('prints usage for %j', (args) => {
    const result = runCli(args);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--version');
    expect(result.stderr).toBe('');
  });

  it('rejects an unknown command on stderr with exit code 1', () => {
    const result = runCli(['foo']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('foo');
    expect(result.stderr).not.toMatch(/\bat\s.+:\d+:\d+/);
  });
});
