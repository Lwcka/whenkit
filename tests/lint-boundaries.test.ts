import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// Runs the real oxlint config against a throwaway src/core file, so the
// hexagon's boundary rules (AD-2) are checked by the test suite, not by hand.
// The probe lives in a fresh temp dir outside the repo, so an interrupted run
// never leaves a file importing `electron` in the source tree.
const root = path.resolve(__dirname, '..');
const oxlintBin = path.join(root, 'node_modules', 'oxlint', 'bin', 'oxlint');
const tempDirs: string[] = [];

function lintCoreFile(source: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'whenkit-lint-'));
  tempDirs.push(dir);
  const config = path.join(dir, '.oxlintrc.json');
  copyFileSync(path.join(root, '.oxlintrc.json'), config);
  mkdirSync(path.join(dir, 'src', 'core'), { recursive: true });
  const file = path.join('src', 'core', 'probe.ts');
  writeFileSync(path.join(dir, file), source);
  const result = spawnSync(process.execPath, [oxlintBin, '-c', config, file], {
    cwd: dir,
    encoding: 'utf8',
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('hexagon boundaries in src/core', () => {
  it.each(['electron', 'react', 'node:fs', 'dns'])(
    'fails lint when core imports %s',
    (specifier) => {
      const result = lintCoreFile(`import '${specifier}';\n`);
      expect(result.status).not.toBe(0);
      expect(result.output).toContain('no-restricted-imports');
    },
  );

  it('fails lint when core uses the fetch global', () => {
    const result = lintCoreFile(`export const load = () => fetch('x');\n`);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain('no-restricted-globals');
  });

  it('accepts an import between core modules', () => {
    const result = lintCoreFile(`import './catalog';\n`);
    expect(result.status).toBe(0);
  });
});
