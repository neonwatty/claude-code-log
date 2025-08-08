import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
    minify: mode === 'production',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'lit': ['lit'],
          'shared': ['@app/shared'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@app/shared': resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  define: {
    __DEV__: mode === 'development',
    __PROD__: mode === 'production',
  },
}));
