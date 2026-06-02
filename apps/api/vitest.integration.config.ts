import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/modules/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    isolate: false,
    pool: 'forks',
    fileParallelism: false
  }
});
