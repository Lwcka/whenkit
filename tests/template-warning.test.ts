import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BATCH_SCHEMA_VERSION, TEMPLATE_VERSION } from '../src/core/versions';
import { cliStrings } from '../src/shared/strings.ro';
import { fakeAppRoot, runWhenkit, tempDir } from './helpers';

// Every command that resolves a workspace warns on stderr when the
// workspace's template is outdated, and only on stderr (AD-17).

async function setup() {
  const root = tempDir();
  const workspace = path.join(root, 'ws');
  const options = {
    vars: { APPDATA: path.join(root, 'AppData'), WHENKIT_WORKSPACE: workspace },
    appRoot: fakeAppRoot(path.join(root, 'repo')),
    cwd: root,
  };
  expect((await runWhenkit(['init'], options)).exitCode).toBe(0);
  // An empty batch would be BATCH_INVALID; the warning is what matters here,
  // and it is printed before the batch is read.
  const batch = path.join(root, 'batch.json');
  writeFileSync(batch, '{}');
  return { workspace, options, batch };
}

const marker = (workspace: string) =>
  path.join(workspace, '.whenkit-template.json');

const commands = (batch: string) => [
  ['list'],
  ['list', '--json'],
  ['show', 'missing-id'],
  ['rejections'],
  ['categories'],
  ['import', batch],
];

describe('the outdated-template warning', () => {
  it('stays silent right after init, on every command', async () => {
    const { options, batch } = await setup();
    for (const args of commands(batch)) {
      const result = await runWhenkit(args, options);
      expect(result.stderr).not.toContain(cliStrings.templateOutdated);
    }
    const quiet = await runWhenkit(['list', '--json'], options);
    expect(quiet.stderr).toBe('');
    expect(quiet.exitCode).toBe(0);
  });

  it.each([
    ['without a marker', (workspace: string) => rmSync(marker(workspace))],
    [
      'with templateVersion 0',
      (workspace: string) =>
        writeFileSync(
          marker(workspace),
          JSON.stringify({
            templateVersion: 0,
            batchSchemaVersion: BATCH_SCHEMA_VERSION,
          }),
        ),
    ],
    [
      'with the previous templateVersion (an old workspace)',
      (workspace: string) =>
        writeFileSync(
          marker(workspace),
          JSON.stringify({
            templateVersion: TEMPLATE_VERSION - 1,
            batchSchemaVersion: BATCH_SCHEMA_VERSION,
          }),
        ),
    ],
    [
      'with another batchSchemaVersion',
      (workspace: string) =>
        writeFileSync(
          marker(workspace),
          JSON.stringify({
            templateVersion: TEMPLATE_VERSION,
            batchSchemaVersion: BATCH_SCHEMA_VERSION + 1,
          }),
        ),
    ],
    [
      'with an unreadable marker',
      (workspace: string) => {
        rmSync(marker(workspace));
        mkdirSync(marker(workspace));
      },
    ],
  ])(
    'warns on stderr and keeps stdout and the exit code (%s)',
    async (_label, outdate) => {
      const { workspace, options } = await setup();
      const before = await runWhenkit(['list', '--json'], options);
      outdate(workspace);
      const after = await runWhenkit(['list', '--json'], options);

      expect(after.exitCode).toBe(0);
      expect(after.stdout).toBe(before.stdout);
      expect(JSON.parse(after.stdout).entries).toEqual([]);
      expect(after.stderr).toContain(cliStrings.templateOutdated);
      expect(after.stderr).toContain('whenkit init');
    },
  );

  it('warns on every command that resolves a workspace', async () => {
    const { workspace, options, batch } = await setup();
    rmSync(marker(workspace));
    for (const args of commands(batch)) {
      const result = await runWhenkit(args, options);
      expect(result.stderr).toContain(cliStrings.templateOutdated);
    }
  });

  it('never prints it for init or schema, and init fixes it', async () => {
    const { workspace, options } = await setup();
    rmSync(marker(workspace));
    expect((await runWhenkit(['schema'], options)).stderr).toBe('');
    const init = await runWhenkit(['init'], options);
    expect(init.stderr).toBe('');
    expect((await runWhenkit(['list'], options)).stderr).toBe('');
  });
});
