import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Without a cap Vitest starts one worker per core, and some crash at start with out-of-memory.
    maxWorkers: 2,
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
        },
      },
      {
        // Renderer components (React Testing Library) need a DOM.
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
        },
      },
    ],
  },
});
