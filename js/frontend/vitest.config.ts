import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    // Add compatibility for jest-style mocking
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  },
  // Remove esbuild config and rely on TypeScript configuration
  // which already has proper decorator settings
  define: {
    // Ensure proper decorator support and test environment
    'process.env.NODE_ENV': '"test"',
    // Lit development mode configuration for tests
    'process.env.LIT_DEV_MODE': 'true',
  },
  resolve: {
    alias: {
      '@app/shared': resolve(__dirname, '../shared/src'),
    },
  },
});
