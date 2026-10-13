import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WhenkitError } from '../../core/errors';
import type { Environment } from '../../core/ports';

const PACKAGE_NAME = 'whenkit';

/**
 * The app's root: the nearest ancestor of `startFile` holding whenkit's
 * package.json. Works from the sources (src/adapters/env) and from the
 * bundled CLI (dist/cli), since `npm link` resolves to the repo's real path.
 */
export function findAppRoot(startFile: string): string {
  let dir = path.dirname(startFile);
  for (;;) {
    const manifest = path.join(dir, 'package.json');
    if (existsSync(manifest)) {
      try {
        const { name } = JSON.parse(readFileSync(manifest, 'utf8')) as {
          name?: unknown;
        };
        if (name === PACKAGE_NAME) return dir;
      } catch {
        // Not our manifest; keep climbing.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new WhenkitError('INTERNAL', {
        detail: `no ${PACKAGE_NAME} package.json above ${startFile}`,
      });
    }
    dir = parent;
  }
}

/** Environment backed by `process.env` and the running file's location. */
export function createProcessEnvironment(
  startFile: string = fileURLToPath(import.meta.url),
): Environment {
  let root: string | undefined;
  return {
    get: (name) => process.env[name],
    appRoot: () => (root ??= findAppRoot(startFile)),
  };
}
