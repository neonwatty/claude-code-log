/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  
  // Roots for test discovery
  roots: [
    '<rootDir>/backend/src',
    '<rootDir>/frontend/', 
    '<rootDir>/shared/src'
  ],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@shared$': '<rootDir>/shared/src/index',
    '^@shared/(.*)$': '<rootDir>/shared/src/$1',
    '^@shared/types$': '<rootDir>/shared/types',
    // Map all .js imports in shared schemas to .ts files
    '^../../../../shared/src/schemas/index\\.js$': '<rootDir>/shared/src/schemas/index.ts',
    '^../../src/components/(.*)$': '<rootDir>/frontend/src/components/$1',
    '^../../src/styles/(.*)$': '<rootDir>/frontend/src/styles/$1',
    // Map specific frontend component .js imports to .ts files
    '^../../src/components/(.*)\\.js$': '<rootDir>/frontend/src/components/$1.ts',
    '^../base/(.*)\\.js$': '<rootDir>/frontend/src/components/base/$1.ts',
    // Map WebSocket service imports
    '^../../services/(.*)\\.js$': '<rootDir>/frontend/src/services/$1.ts',
    '^./message-handlers\\.js$': '<rootDir>/frontend/__tests__/__mocks__/message-handlers-mock.js',
    '^./message-types\\.js$': '<rootDir>/frontend/__tests__/__mocks__/message-types-mock.js',
    '^./connection-state\\.js$': '<rootDir>/frontend/__tests__/__mocks__/connection-state-mock.js',
    // Map specific websocket utility imports for integration tests
    '^../../src/utils/websocket/websocket-controller$': '<rootDir>/frontend/__tests__/__mocks__/websocket-controller-mock.js',
    '^../../src/utils/websocket/message-handlers$': '<rootDir>/frontend/__tests__/__mocks__/message-handlers-mock.js',
    '^../../src/utils/websocket/message-types$': '<rootDir>/frontend/__tests__/__mocks__/message-types-mock.js',
    '^../../src/utils/websocket/connection-state$': '<rootDir>/frontend/__tests__/__mocks__/connection-state-mock.js',
    // Mock @open-wc/testing for compatibility
    '@open-wc/testing': '<rootDir>/frontend/__tests__/__mocks__/@open-wc-testing-mock.js',
    // Mock lit and lit-html modules
    '^lit$': '<rootDir>/frontend/__tests__/__mocks__/lit-mock.js',
    '^lit/decorators.js$': '<rootDir>/frontend/__tests__/__mocks__/lit-decorators-mock.js',
    // Handle CSS imports for Lit components
    '\\.css\\?inline$': 'identity-obj-proxy',
    '\\.css$': 'identity-obj-proxy'
  },
  
  // TypeScript transformation
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        allowJs: true,
        moduleResolution: 'node',
        module: 'commonjs',
        baseUrl: '.',
        paths: {
          '@shared': ['<rootDir>/shared/src/index'],
          '@shared/*': ['<rootDir>/shared/src/*'],
          '@shared/types': ['<rootDir>/shared/types']
        }
      }
    }]
  },
  
  // Setup files for different test environments
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'shared/src/**/*.ts',
    'backend/src/**/*.ts',
    'frontend/src/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!frontend/src/styles/**/*.css'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
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
  },
  
  // Test environment configuration for frontend tests
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
    url: 'http://localhost'
  },
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Reset modules between tests
  resetModules: true,
  
  // Force exit to prevent hanging
  forceExit: true,
  
  // Detect open handles
  detectOpenHandles: false,
  
  // Cache directory
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  
  // Verbose output
  verbose: true,
  
  // Handle ES modules properly - disabled for CommonJS compatibility
  // extensionsToTreatAsEsm: ['.ts'],
  
  // Transform ignored patterns - allow ES modules for web testing libraries
  transformIgnorePatterns: [
    'node_modules/(?!(lit|@lit|@lit-labs|lit-html|lit-element|@open-wc|@esm-bundle|@web|chai)/)'
  ],
  
  // Global setup for web components
  globalSetup: undefined,
  globalTeardown: undefined
};