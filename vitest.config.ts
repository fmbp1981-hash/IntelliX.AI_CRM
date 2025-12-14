import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.{test,spec}.ts'],
    exclude: ['node_modules', '.next', 'dist', 'tmp'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
