import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Global test setup file
    setupFiles: ['./src/test-setup.ts'],
    // Aggressive timeouts to prevent hanging tests
    testTimeout: 10000, // 10 seconds max per test
    hookTimeout: 5000,  // 5 seconds max for hooks
    // Force sequential execution to prevent resource conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests in single fork to avoid port conflicts
      }
    },
    // Ensure cleanup
    restoreMocks: true,
    clearMocks: true,
    // Force process exit
    teardownTimeout: 5000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@app/shared': resolve(__dirname, '../shared/src'),
    },
  },
});
