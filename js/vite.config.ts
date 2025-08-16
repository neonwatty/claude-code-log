import { defineConfig } from 'vite';
import { resolve } from 'path';
import { hmrPlugin, presets } from 'vite-plugin-web-components-hmr';

export default defineConfig({
  // Set root to frontend subdirectory  
  root: 'frontend',
  
  // Development server configuration
  server: {
    port: 5173,
    host: '0.0.0.0',
    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },

  // Build configuration
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Code splitting and optimizations
    rollupOptions: {
      output: {
        manualChunks: {
          lit: ['lit']
        }
      }
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Generate sourcemaps for development
    sourcemap: true
  },

  // Path aliases
  resolve: {
    alias: {
      '@shared': resolve(__dirname, './shared'),
      '@frontend': resolve(__dirname, './frontend/src')
    }
  },

  // Plugin configuration
  plugins: [
    // HMR support for Lit web components
    hmrPlugin({
      include: ['./frontend/src/**/*.ts'],
      presets: [presets.lit]
    })
  ],

  // TypeScript configuration
  define: {
    // Enable experimental decorators support for Lit
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')
  },

  // CSS configuration
  css: {
    devSourcemap: true
  }
});