import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';
import { WhenkitError } from '../src/core/errors';
import type { Clock, Environment, IdGenerator } from '../src/core/ports';

// Shared test fixtures: temp dirs under the OS temp folder and injected
// environments, so no test ever touches the real %APPDATA% or workspace.

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

export function tempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'whenkit-test-'));
  tempDirs.push(dir);
  return dir;
}

/** A clock fixed at a local date-time, so file names are predictable. */
export function fixedClock(date = new Date(2026, 9, 13, 14, 5, 9)): Clock {
  return { now: () => new Date(date) };
}

/** Sequential ids that still look like UUID v4. */
export function sequentialIds(): IdGenerator {
  let n = 0;
  return {
    newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  };
}

export function fakeEnvironment(
  vars: Record<string, string | undefined>,
  appRoot: string,
): Environment {
  return { get: (name) => vars[name], appRoot: () => appRoot };
}

/** The code of the WhenkitError that `action` throws. */
export function errorCodeOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof WhenkitError) return error.code;
    throw error;
  }
  throw new Error('expected a WhenkitError');
}
