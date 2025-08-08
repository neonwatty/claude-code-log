import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.config.ts',
        '**/*.config.js',
      ]
    }
  },
  resolve: {
    alias: {
      '@app/shared': resolve(__dirname, './shared/src'),
      '@app/backend': resolve(__dirname, './backend/src'),
      '@app/frontend': resolve(__dirname, './frontend/src')
    }
  }
});