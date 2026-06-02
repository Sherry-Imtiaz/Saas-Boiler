import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/utils/**/*.test.ts'],
    testTimeout: 10_000,
    pool: 'forks',
    fileParallelism: false
  }
});
