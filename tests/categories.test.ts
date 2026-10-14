import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { categoriesOutputSchema } from '../src/core/cli-schemas';
import { CATEGORY_SEED } from '../src/core/category-seed';
import { errorMessages, zoneLabels } from '../src/shared/strings.ro';
import { fakeAppRoot, runWhenkit, tempDir } from './helpers';

// `whenkit categories` end to end on a freshly initialized workspace.

async function initialized() {
  const root = tempDir();
  const workspace = path.join(root, 'ws');
  const options = {
    vars: { APPDATA: path.join(root, 'AppData'), WHENKIT_WORKSPACE: workspace },
    appRoot: fakeAppRoot(path.join(root, 'repo')),
    cwd: root,
  };
  expect((await runWhenkit(['init'], options)).exitCode).toBe(0);
  return { workspace, options };
}

describe('whenkit categories', () => {
  it('prints the seeded categories, Toolbox first, by name within a zone', async () => {
    const { workspace, options } = await initialized();
    const result = await runWhenkit(['categories', '--json'], options);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    const output = categoriesOutputSchema.parse(JSON.parse(result.stdout));
    expect(output.workspace).toBe(workspace);
    expect(output.categories).toHaveLength(16);
    expect(output.categories).toHaveLength(CATEGORY_SEED.length);

    const zones = output.categories.map((category) => category.zone);
    const firstLearn = zones.indexOf('learn');
    expect(zones.slice(0, firstLearn)).not.toContain('learn');
    expect(zones.slice(firstLearn)).not.toContain('toolbox');
    expect(zones[0]).toBe('toolbox');
    for (const zone of ['toolbox', 'learn']) {
      const names = output.categories
        .filter((category) => category.zone === zone)
        .map((category) => category.name);
      expect(names.length).toBeGreaterThan(0);
      // The catalog orders by name_key, the name without case and diacritics.
      const collator = new Intl.Collator('ro', { sensitivity: 'base' });
      expect(names).toEqual([...names].sort(collator.compare));
    }
  });

  it('prints text grouped by zone', async () => {
    const { options } = await initialized();
    const result = await runWhenkit(['categories'], options);

    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trimEnd().split('\n');
    const learn = lines.indexOf(`${zoneLabels.learn}:`);
    expect(lines[0]).toBe(`${zoneLabels.toolbox}:`);
    expect(learn).toBeGreaterThan(0);
    // "Securitate" exists in both zones: once before and once after "Learn:".
    expect(lines.indexOf('  Securitate')).toBeLessThan(learn);
    expect(lines.lastIndexOf('  Securitate')).toBeGreaterThan(learn);
  });

  it('rejects an extra argument with exit 1', async () => {
    const { options } = await initialized();
    const result = await runWhenkit(['categories', 'x'], options);
    expect(result.exitCode).toBe(1);
  });

  it('exits 2 with the JSON error document when no workspace is configured', async () => {
    const root = tempDir();
    const result = await runWhenkit(['categories', '--json'], {
      vars: { APPDATA: path.join(root, 'AppData') },
      appRoot: fakeAppRoot(path.join(root, 'repo')),
      cwd: root,
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      schemaVersion: 1,
      workspace: null,
      error: {
        code: 'WORKSPACE_NOT_CONFIGURED',
        message: errorMessages.WORKSPACE_NOT_CONFIGURED,
      },
    });
  });
});
