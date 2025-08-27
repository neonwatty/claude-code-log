// Mock for lit/decorators.js to work with Jest

// Mock customElement decorator
const customElement = (tagName) => {
  return (cls) => {
    cls.tagName = tagName;
    return cls;
  };
};

// Mock property decorator
const property = (options = {}) => {
  return (target, propertyKey) => {
    if (!target.constructor.properties) {
      target.constructor.properties = {};
    }
    target.constructor.properties[propertyKey] = options;
  };
};

// Mock state decorator
const state = (options = {}) => {
  return (target, propertyKey) => {
    if (!target.constructor.properties) {
      target.constructor.properties = {};
    }
    target.constructor.properties[propertyKey] = { ...options, state: true };
  };
};

// Mock query decorator
const query = (selector) => {
  return (target, propertyKey) => {
    // Store selector for potential use in tests
    target[`_${propertyKey}_selector`] = selector;
  };
};

// Mock queryAll decorator
const queryAll = (selector) => {
  return (target, propertyKey) => {
    // Store selector for potential use in tests
    target[`_${propertyKey}_selector`] = selector;
  };
};

module.exports = {
  customElement,
  property,
  state,
  query,
  queryAll,
};
