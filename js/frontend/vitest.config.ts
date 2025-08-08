import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  },
  resolve: {
    alias: {
      '@app/shared': resolve(__dirname, '../shared/src')
    }
  }
});