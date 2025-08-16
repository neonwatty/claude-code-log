import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared')
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0'
  }
});