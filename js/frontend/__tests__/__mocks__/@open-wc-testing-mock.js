// Mock for @open-wc/testing to work with Jest
const { JSDOM } = require('jsdom');

// Setup JSDOM environment
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;
global.CustomEvent = dom.window.CustomEvent;
global.Event = dom.window.Event;
global.KeyboardEvent = dom.window.KeyboardEvent;

// Mock fixture function
const fixture = async (template) => {
  let container = document.getElementById('test-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  }
  
  if (typeof template === 'string') {
    container.innerHTML = template;
    const element = container.firstElementChild;
    
    // Simulate Lit component setup
    if (element && element.updateComplete === undefined) {
      element.updateComplete = Promise.resolve();
      element.shadowRoot = document.createElement('div');
      // Mock querySelector methods on shadowRoot
      element.shadowRoot.querySelector = (selector) => {
        // Create mock elements for common filter bar selectors
        if (selector.includes('filter-bar-search-input')) {
          const input = document.createElement('input');
          input.className = 'filter-bar-search-input';
          input.type = 'text';
          return input;
        }
        if (selector.includes('filter-bar-action-btn')) {
          const button = document.createElement('button');
          button.className = 'filter-bar-action-btn';
          if (selector.includes('Clear search')) button.title = 'Clear search';
          if (selector.includes('Select all')) button.title = 'Select all';
          if (selector.includes('Select none')) button.title = 'Select none';
          if (selector.includes('Clear all filters')) button.title = 'Clear all filters';
          return button;
        }
        if (selector.includes('filter-bar-main-container')) {
          const div = document.createElement('div');
          div.className = 'filter-bar-main-container hidden';
          div.classList = {
            contains: (cls) => cls === 'hidden',
            add: () => {},
            remove: () => {},
            toggle: () => {}
          };
          return div;
        }
        if (selector.includes('filter-bar-toggle')) {
          const button = document.createElement('button');
          button.className = 'filter-bar-toggle';
          return button;
        }
        if (selector.includes('filter-bar-preset')) {
          const button = document.createElement('button');
          button.className = 'filter-bar-preset';
          return button;
        }
        if (selector.includes('filter-bar-advanced-toggle')) {
          const button = document.createElement('button');
          button.className = 'filter-bar-advanced-toggle';
          return button;
        }
        if (selector.includes('filter-bar-advanced-content')) {
          const div = document.createElement('div');
          div.className = 'filter-bar-advanced-content hidden';
          div.classList = {
            contains: (cls) => cls === 'hidden',
            add: () => {},
            remove: () => {},
            toggle: () => {}
          };
          return div;
        }
        if (selector.includes('data-type=')) {
          const button = document.createElement('button');
          const type = selector.match(/data-type="([^"]+)"/)?.[1] || 'user';
          button.setAttribute('data-type', type);
          button.classList = {
            contains: () => false,
            add: () => {},
            remove: () => {},
            toggle: () => {}
          };
          return button;
        }
        if (selector.includes('data-preset=')) {
          const button = document.createElement('button');
          const preset = selector.match(/data-preset="([^"]+)"/)?.[1] || 'conversations';
          button.setAttribute('data-preset', preset);
          button.classList = {
            contains: () => false,
            add: () => {},
            remove: () => {},
            toggle: () => {}
          };
          return button;
        }
        if (selector.includes('input[type="date"]')) {
          const input = document.createElement('input');
          input.type = 'date';
          return input;
        }
        if (selector.includes('input[placeholder="Min tokens"]')) {
          const input = document.createElement('input');
          input.placeholder = 'Min tokens';
          return input;
        }
        if (selector.includes('input[placeholder="Max tokens"]')) {
          const input = document.createElement('input');
          input.placeholder = 'Max tokens';
          return input;
        }
        return null;
      };
      
      element.shadowRoot.querySelectorAll = (selector) => {
        const results = [];
        if (selector.includes('filter-bar-toggle')) {
          // Return multiple toggle buttons
          ['user', 'assistant', 'system'].forEach(type => {
            const button = document.createElement('button');
            button.className = 'filter-bar-toggle';
            button.setAttribute('data-type', type);
            button.setAttribute('role', 'button');
            button.setAttribute('aria-pressed', 'false');
            button.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            results.push(button);
          });
        }
        if (selector.includes('filter-bar-preset')) {
          // Return multiple preset buttons
          ['conversations', 'tools'].forEach(preset => {
            const button = document.createElement('button');
            button.className = 'filter-bar-preset';
            button.setAttribute('data-preset', preset);
            button.setAttribute('role', 'button');
            button.textContent = preset.charAt(0).toUpperCase() + preset.slice(1);
            results.push(button);
          });
        }
        return results;
      };
    }
    
    return element;
  }
  
  // Handle template result objects (like from lit-html)
  if (template && template.strings && template.values) {
    // Simple template literal processing
    let html = '';
    for (let i = 0; i < template.strings.length; i++) {
      html += template.strings[i];
      if (i < template.values.length) {
        const value = template.values[i];
        html += typeof value === 'object' ? JSON.stringify(value) : value;
      }
    }
    container.innerHTML = html;
    const element = container.firstElementChild;
    
    // Add Lit component mock properties and methods
    if (element) {
      element.updateComplete = Promise.resolve();
      element.isVisible = false;
      element.sticky = true;
      element.messageCounts = {};
      element.filters = {
        searchTerm: '',
        messageTypes: new Set(),
        sessionStatus: new Set(),
        dateRange: {}
      };
      
      // Mock shadowRoot with comprehensive querySelector support
      element.shadowRoot = {
        querySelector: (selector) => {
          // Create mock elements for common filter bar selectors
          if (selector.includes('filter-bar-search-input')) {
            const input = document.createElement('input');
            input.className = 'filter-bar-search-input';
            input.type = 'text';
            input.value = '';
            return input;
          }
          if (selector.includes('filter-bar-action-btn')) {
            const button = document.createElement('button');
            button.className = 'filter-bar-action-btn';
            if (selector.includes('Clear search')) button.title = 'Clear search';
            if (selector.includes('Select all')) button.title = 'Select all';
            if (selector.includes('Select none')) button.title = 'Select none';
            if (selector.includes('Clear all filters')) button.title = 'Clear all filters';
            return button;
          }
          if (selector.includes('filter-bar-main-container')) {
            const div = document.createElement('div');
            div.className = 'filter-bar-main-container';
            div.classList = {
              contains: (cls) => cls === 'hidden',
              add: () => {},
              remove: () => {},
              toggle: () => {}
            };
            return div;
          }
          return null;
        },
        querySelectorAll: (selector) => []
      };
    }
    
    return element;
  }
  
  return container;
};

// Mock html template function
const html = (strings, ...values) => {
  return { strings, values };
};

// Mock expect function (use Jest's expect)
const expect = global.expect;

// Mock oneEvent function
const oneEvent = (element, eventType) => {
  return new Promise((resolve) => {
    const handler = (event) => {
      element.removeEventListener(eventType, handler);
      resolve(event);
    };
    element.addEventListener(eventType, handler);
  });
};

module.exports = {
  fixture,
  html,
  expect,
  oneEvent
};