import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

// The CLI is bundled on its own (AD-19), not by the Forge plugin, into a
// single ESM file that Node 24 runs directly and `npm link` exposes as
// `whenkit`. Dependencies are bundled; only Node built-ins stay external.
export default defineConfig({
  build: {
    ssr: 'src/cli/bin.ts',
    outDir: 'dist/cli',
    emptyOutDir: true,
    target: 'node24',
    minify: false,
    sourcemap: true,
    rolldownOptions: {
      external: [...builtinModules, /^node:/],
      output: {
        format: 'esm',
        entryFileNames: 'whenkit.mjs',
        banner: '#!/usr/bin/env node',
      },
    },
  },
  ssr: {
    target: 'node',
    noExternal: true,
  },
});
