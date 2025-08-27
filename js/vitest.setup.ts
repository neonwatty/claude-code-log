import { vi } from "vitest";

// Global test environment setup
global.fetch = vi.fn();
global.WebSocket = vi.fn();
global.URL.createObjectURL = vi.fn();
global.URL.revokeObjectURL = vi.fn();

// Make vi globally available for jest.* replacements
globalThis.vi = vi;

// Mock console methods to reduce noise in tests
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

// Set up DOM globals for jsdom - use real customElements for proper component registration
// We need to let the real custom elements registry work in tests

// Don't override customElements if it already exists and works
if (!window.customElements || typeof window.customElements.define !== 'function') {
  const customElementsRegistry = new Map();
  
  const customElementsImpl = {
    define: (name: string, constructor: any) => {
      // Store in our registry
      customElementsRegistry.set(name, constructor);
      
      // Try to register with the actual DOM if possible
      try {
        if (typeof HTMLElement !== 'undefined') {
          // In jsdom, we can try to call the native define method
          const nativeCustomElements = globalThis.customElements;
          if (nativeCustomElements && nativeCustomElements.define && nativeCustomElements !== customElementsImpl) {
            nativeCustomElements.define(name, constructor);
            return;
          }
        }
        
        // Fallback: just store in our map
        console.debug(`Custom element '${name}' registered in test registry`);
      } catch (error) {
        // Silent fallback
      }
    },
    get: (name: string) => customElementsRegistry.get(name) || null,
    whenDefined: vi.fn().mockResolvedValue(undefined),
  };

  Object.defineProperty(window, "customElements", {
    value: customElementsImpl,
    writable: false,
    configurable: true,
  });

  // Also set global customElements to match window
  Object.defineProperty(global, "customElements", {
    value: customElementsImpl,
    writable: false,
    configurable: true,
  });
}

// Mock performance API
Object.defineProperty(window, "performance", {
  value: {
    now: vi.fn(() => Date.now()),
  },
});

// Setup CSS import handling
vi.mock("*.css?inline", () => "");
vi.mock("*.css", () => ({}));

// Setup Node.js module mocks - moved to individual test files for better control

// Set up test environment for Lit components
process.env.NODE_ENV = "test";
