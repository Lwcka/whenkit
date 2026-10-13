import { main } from './main';

// Process entry of the `whenkit` command (bundled to dist/cli/whenkit.mjs).
process.exitCode = main(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
