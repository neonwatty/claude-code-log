import { vi } from 'vitest';

// Global test environment setup
global.fetch = vi.fn();
global.WebSocket = vi.fn();
global.URL.createObjectURL = vi.fn();
global.URL.revokeObjectURL = vi.fn();

// Make vi globally available for jest.* replacements
globalThis.vi = vi;

// Mock console methods to reduce noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Set up DOM globals for jsdom
Object.defineProperty(window, 'customElements', {
  value: {
    define: vi.fn(),
    get: vi.fn(),
    whenDefined: vi.fn().mockResolvedValue(undefined)
  },
  writable: true,
  configurable: true
});

// Also set global customElements
Object.defineProperty(global, 'customElements', {
  value: {
    define: vi.fn(),
    get: vi.fn(),
    whenDefined: vi.fn().mockResolvedValue(undefined)
  },
  writable: true,
  configurable: true
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now())
  }
});

// Setup CSS import handling
vi.mock('*.css?inline', () => '');
vi.mock('*.css', () => ({}));

// Setup Node.js module mocks - moved to individual test files for better control

// Set up test environment for Lit components
process.env.NODE_ENV = 'test';