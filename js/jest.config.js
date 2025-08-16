/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Roots for test discovery
  roots: [
    '<rootDir>/backend/src',
    '<rootDir>/frontend/src', 
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
    '^@shared/types$': '<rootDir>/shared/types'
  },
  
  // TypeScript transformation
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
        baseUrl: '.',
        paths: {
          '@shared': ['<rootDir>/shared/src/index'],
          '@shared/*': ['<rootDir>/shared/src/*'],
          '@shared/types': ['<rootDir>/shared/types']
        }
      },
      isolatedModules: true,
      useESM: false
    }]
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'shared/src/**/*.ts',
    'backend/src/**/*.ts',
    'frontend/src/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  
  // Test environment setup
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
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
  verbose: true
};