import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    test: {
      // Test environment
      environment: 'jsdom',
      
      // Make test globals available
      globals: true,
      
      // Test file patterns
      include: [
        'backend/src/**/__tests__/**/*.{test,spec}.ts',
        'backend/src/**/*.{test,spec}.ts',
        'frontend/__tests__/**/*.{test,spec}.ts',
        'frontend/**/*.{test,spec}.ts',
        'shared/src/**/__tests__/**/*.{test,spec}.ts',
        'shared/src/**/*.{test,spec}.ts'
      ],
      
      // Global setup files
      setupFiles: ['./vitest.setup.ts'],
      
      // Coverage configuration
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'clover', 'lcov'],
        include: [
          'shared/src/**/*.ts',
          'backend/src/**/*.ts',
          'frontend/src/**/*.ts'
        ],
        exclude: [
          '**/*.d.ts',
          '**/node_modules/**',
          '**/dist/**',
          'frontend/src/styles/**/*.css',
          '**/__tests__/**',
          '**/__mocks__/**'
        ],
        thresholds: {
          global: {
            branches: 60,
            functions: 60,
            lines: 60,
            statements: 60
          },
          'frontend/src/components/**/*.ts': {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
          }
        }
      },
      
      // Test timeout
      testTimeout: 10000,
      
      // Hook timeouts
      hookTimeout: 10000,
      
      // Clear mocks between tests
      clearMocks: true,
      
      // Reset modules between tests
      resetModules: true,
      
      // Pool options for better performance
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false
        }
      }
    },
    
    // Resolve configuration for tests
    resolve: {
      alias: {
        // Shared module aliases
        '@shared$': resolve(__dirname, './shared/src/index'),
        '@shared/(.*)': resolve(__dirname, './shared/src/$1'),
        '@shared/types': resolve(__dirname, './shared/types'),
        
        // Frontend aliases
        '@frontend': resolve(__dirname, './frontend/src'),
        
        // Shared schema mappings (map .js imports to .ts files)
        '../../../../shared/src/schemas/index.js': resolve(__dirname, './shared/src/schemas/index.ts'),
        
        // Frontend component mappings
        '../../src/components/(.*)$': resolve(__dirname, './frontend/src/components/$1'),
        '../../src/styles/(.*)$': resolve(__dirname, './frontend/src/styles/$1'),
        '../../src/components/(.*).js$': resolve(__dirname, './frontend/src/components/$1.ts'),
        '../base/(.*).js$': resolve(__dirname, './frontend/src/components/base/$1.ts'),
        
        // WebSocket service mappings
        '../../services/(.*).js$': resolve(__dirname, './frontend/src/services/$1.ts'),
        
        // WebSocket utility mappings with mocks
        './message-handlers.js': resolve(__dirname, './frontend/__tests__/__mocks__/message-handlers-mock.js'),
        './message-types.js': resolve(__dirname, './frontend/__tests__/__mocks__/message-types-mock.js'),
        './connection-state.js': resolve(__dirname, './frontend/__tests__/__mocks__/connection-state-mock.js'),
        
        // Integration test WebSocket mappings
        '../../src/utils/websocket/websocket-controller': resolve(__dirname, './frontend/__tests__/__mocks__/websocket-controller-mock.js'),
        '../../src/utils/websocket/message-handlers': resolve(__dirname, './frontend/__tests__/__mocks__/message-handlers-mock.js'),
        '../../src/utils/websocket/message-types': resolve(__dirname, './frontend/__tests__/__mocks__/message-types-mock.js'),
        '../../src/utils/websocket/connection-state': resolve(__dirname, './frontend/__tests__/__mocks__/connection-state-mock.js'),
        
        // Mock library mappings
        '@open-wc/testing': resolve(__dirname, './frontend/__tests__/__mocks__/@open-wc-testing-mock.js'),
        'lit$': resolve(__dirname, './frontend/__tests__/__mocks__/lit-mock.js'),
        'lit/decorators.js': resolve(__dirname, './frontend/__tests__/__mocks__/lit-decorators-mock.js')
      }
    }
});