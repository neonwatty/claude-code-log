import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@app/shared': resolve(__dirname, '../shared/src')
    }
  },
  server: {
    port: 5173,
    open: true
  }
});