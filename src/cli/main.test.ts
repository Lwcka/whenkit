import { describe, expect, it } from 'vitest';
import { version } from '../../package.json';
import { main, type CliDeps } from './main';

// These commands must not touch any port; every port throws if they do.
const untouched = (): never => {
  throw new Error('port used');
};
const noDeps: CliDeps = {
  env: { get: untouched, appRoot: untouched },
  fs: {
    exists: untouched,
    mkdir: untouched,
    readText: untouched,
    writeText: untouched,
    joinPath: untouched,
  },
  clock: { now: untouched },
  ids: { newId: untouched },
  openStore: untouched,
  http: { check: untouched },
  cwd: '',
};

async function runCli(args: string[]) {
  let stdout = '';
  let stderr = '';
  const exitCode = await main(
    args,
    {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    },
    noDeps,
  );
  return { exitCode, stdout, stderr };
}

describe('whenkit CLI', () => {
  it('prints the package version for --version', async () => {
    const result = await runCli(['--version']);
    expect(result).toEqual({ exitCode: 0, stdout: `${version}\n`, stderr: '' });
  });

  it.each([[[]], [['--help']]])('prints usage for %j', async (args) => {
    const result = await runCli(args);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--version');
    expect(result.stdout).toContain('init [cale]');
    expect(result.stderr).toBe('');
  });

  it('rejects an unknown command on stderr with exit code 1', async () => {
    const result = await runCli(['foo']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('foo');
    expect(result.stderr).not.toMatch(/\bat\s.+:\d+:\d+/);
  });

  it('rejects init with more than one path', async () => {
    const result = await runCli(['init', 'a', 'b']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
  });

  // Every port throws if touched, so passing proves nothing was created.
  it.each([
    [['init', '--help']],
    [['init', '-h']],
    [['init', '--json']],
    [['init', 'ws', '--json']],
  ])('rejects the unknown option in %j with exit 1', async (args) => {
    const result = await runCli(args);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(args[args.length - 1]);
    expect(result.stderr).not.toMatch(/\bat\s.+:\d+:\d+/);
  });
});

describe('whenkit schema', () => {
  it('prints the batch JSON Schema without touching any port', async () => {
    const result = await runCli(['schema']);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    const schema = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.type).toBe('object');
    expect(result.stdout).toBe(`${JSON.stringify(schema, null, 2)}\n`);
  });

  it.each([[['schema', '--json']], [['schema', 'x']]])(
    'rejects %j with exit 1',
    async (args) => {
      const result = await runCli(args);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('');
    },
  );

  it('is listed in the usage', async () => {
    expect((await runCli(['--help'])).stdout).toContain('schema');
  });
});
