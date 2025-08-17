// Jest setup file for global test configuration
const { TextEncoder, TextDecoder } = require('util');

// Polyfill TextEncoder/TextDecoder for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock ResizeObserver for web component tests
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver for web component tests
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock console.log in tests to reduce noise
if (process.env.NODE_ENV === 'test') {
  // You can add global test setup here
}

// Add custom Jest matchers to support Chai-style assertions
expect.extend({
  toBe: function(received, expected) {
    return {
      message: () => `expected ${received} to be ${expected}`,
      pass: Object.is(received, expected)
    };
  },
  toBeTrue: function(received) {
    return {
      message: () => `expected ${received} to be true`,
      pass: received === true
    };
  },
  toBeFalse: function(received) {
    return {
      message: () => `expected ${received} to be false`,
      pass: received === false
    };
  },
  toBeNull: function(received) {
    return {
      message: () => `expected ${received} to be null`,
      pass: received === null
    };
  },
  toEqual: function(received, expected) {
    return {
      message: () => `expected ${received} to equal ${expected}`,
      pass: this.equals(received, expected)
    };
  },
  toInclude: function(received, expected) {
    const pass = received && typeof received.includes === 'function' 
      ? received.includes(expected)
      : false;
    return {
      message: () => `expected ${received} to include ${expected}`,
      pass
    };
  }
});

// Store Jest's original expect methods before wrapping
const originalExpect = global.expect;
const originalObjectContaining = originalExpect.objectContaining;
const originalStringContaining = originalExpect.stringContaining;
const originalAny = originalExpect.any;

// Mock the Chai-style expect with jest-compatible methods
global.expect = function(actual) {
  const jestExpect = originalExpect(actual);
  
  // Add Chai-style methods while preserving Jest methods
  jestExpect.to = {
    be: {
      true: () => jestExpect.toBe(true),
      false: () => jestExpect.toBe(false),
      null: () => jestExpect.toBeNull(),
      greaterThan: (expected) => jestExpect.toBeGreaterThan(expected),
      greaterThanOrEqual: (expected) => jestExpect.toBeGreaterThanOrEqual(expected),
      lessThan: (expected) => jestExpect.toBeLessThan(expected),
      lessThanOrEqual: (expected) => jestExpect.toBeLessThanOrEqual(expected),
      instanceOf: (expected) => jestExpect.toBeInstanceOf(expected)
    },
    equal: (expected) => jestExpect.toBe(expected),
    include: (expected) => jestExpect.toContain(expected),
    deep: {
      equal: (expected) => {
        try {
          jestExpect.toEqual(expected);
          return true;
        } catch (error) {
          throw error;
        }
      }
    },
    have: {
      lengthOf: (expected) => jestExpect.toHaveLength(expected),
      property: (prop, value) => value !== undefined 
        ? jestExpect.toHaveProperty(prop, value)
        : jestExpect.toHaveProperty(prop)
    }
  };
  
  // Add `not` support
  jestExpect.to.not = {
    be: {
      null: () => jestExpect.not.toBeNull(),
      true: () => jestExpect.not.toBe(true),
      false: () => jestExpect.not.toBe(false),
      empty: () => jestExpect.not.toBe(''),
      greaterThan: (expected) => jestExpect.not.toBeGreaterThan(expected)
    },
    equal: (expected) => jestExpect.not.toBe(expected),
    include: (expected) => jestExpect.not.toContain(expected)
  };
  
  return jestExpect;
};

// Preserve Jest's static methods
global.expect.objectContaining = originalObjectContaining;
global.expect.stringContaining = originalStringContaining;
global.expect.any = originalAny;