import { createProcessEnvironment } from '../adapters/env/process-environment';
import { nodeFileSystem } from '../adapters/fs/node-file-system';
import { createGitHubClient } from '../adapters/github/node-github-client';
import { createHttpClient } from '../adapters/http/node-http-client';
import { openCatalogStore } from '../adapters/sqlite/sqlite-catalog-store';
import { randomIdGenerator, systemClock } from '../adapters/system';
import { main } from './main';

// Process entry of the `whenkit` command (bundled to dist/cli/whenkit.mjs):
// the only place that wires the real adapters into the CLI.

/** A CLI process may wait longer for a lock than the desktop main (AD-4). */
const CLI_BUSY_TIMEOUT_MS = 5000;

process.exitCode = await main(
  process.argv.slice(2),
  {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  },
  {
    env: createProcessEnvironment(),
    fs: nodeFileSystem,
    clock: systemClock,
    ids: randomIdGenerator,
    openStore: (dbPath, options) =>
      openCatalogStore(dbPath, {
        ...options,
        clock: systemClock,
        ids: randomIdGenerator,
        busyTimeoutMs: CLI_BUSY_TIMEOUT_MS,
      }),
    http: createHttpClient(),
    github: createGitHubClient(),
    cwd: process.cwd(),
  },
);
