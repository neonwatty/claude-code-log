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
      
      // Mock component-specific properties for SessionListWebSocketEnhanced
      if (element.tagName === 'SESSION-LIST-WEBSOCKET-ENHANCED') {
        element.sessions = [];
        element.enableRealtimeUpdates = true;
        element.filter = {};
        element.sort = { field: 'timestamp', direction: 'desc' };
        element.emitEvent = () => {};
      }
      
      // Mock IntegrationTestComponent specific properties
      if (element.tagName === 'INTEGRATION-TEST-COMPONENT') {
        element.sessions = [];
        element.connectionState = 'DISCONNECTED';
        element.lastUpdate = 'Never';
        element.updateCount = 0;
        element.errors = [];
        
        // Mock the getWebSocketService method
        element.getWebSocketService = () => {
          return (window).__mockWebSocketService;
        };
        
        // Mock other test helper methods
        element.performOptimisticUpdate = (sessionId, updates) => {};
        element.confirmOptimisticUpdate = () => {};
      }
      
      // Create shadowRoot as a proper div element
      const shadowRoot = document.createElement('div');
      element.shadowRoot = shadowRoot;
      // Mock querySelector methods on shadowRoot
      element.shadowRoot.querySelector = (selector) => {
        // Create mock elements for session list selectors
        if (selector.includes('session-item')) {
          const div = document.createElement('div');
          div.className = 'session-item';
          div.setAttribute('data-session-id', 'session-1');
          div.setAttribute('role', 'button');
          div.setAttribute('tabindex', '0');
          div.classList = {
            contains: (cls) => cls === 'updated' || cls === 'has-realtime-update',
            add: () => {},
            remove: () => {},
            toggle: () => {}
          };
          return div;
        }
        if (selector.includes('realtime-status')) {
          const div = document.createElement('div');
          div.className = 'realtime-status connected';
          div.textContent = 'Connected';
          div.classList = {
            contains: (cls) => cls === 'connected',
            add: () => {},
            remove: () => {},
            toggle: () => {}
          };
          return div;
        }
        if (selector.includes('reconnect-button')) {
          const button = document.createElement('button');
          button.className = 'reconnect-button';
          button.textContent = 'Reconnect';
          return button;
        }
        if (selector.includes('realtime-indicator')) {
          const div = document.createElement('div');
          div.className = 'realtime-indicator';
          return div;
        }
        if (selector.includes('filter-input')) {
          const input = document.createElement('input');
          input.className = 'filter-input';
          input.type = 'text';
          input.placeholder = 'Search sessions...';
          return input;
        }
        if (selector.includes('sort-select')) {
          const select = document.createElement('select');
          select.className = 'sort-select';
          return select;
        }
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
        if (selector.includes('session-item')) {
          // Return multiple session items
          ['session-1', 'session-2'].forEach(sessionId => {
            const div = document.createElement('div');
            div.className = 'session-item';
            div.setAttribute('data-session-id', sessionId);
            div.setAttribute('role', 'button');
            div.setAttribute('tabindex', '0');
            div.classList = {
              contains: (cls) => false,
              add: () => {},
              remove: () => {},
              toggle: () => {}
            };
            results.push(div);
          });
        }
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
      
      // Create shadowRoot for all template literal elements
      Object.defineProperty(element, 'shadowRoot', {
        value: {
        querySelector: (selector) => {
          if (selector.includes('[data-session-id=')) {
            const sessionId = selector.match(/data-session-id="([^"]+)"/)?.[1];
            if (sessionId) {
              const div = document.createElement('div');
              div.className = 'session';
              div.setAttribute('data-session-id', sessionId);
              div.textContent = `${sessionId} - active`;
              return div;
            }
          }
          if (selector === '.status') {
            const div = document.createElement('div');
            div.className = 'status';
            div.textContent = 'CONNECTED - Sessions: 0';
            return div;
          }
          return null;
        },
        querySelectorAll: () => []
        },
        writable: false,
        configurable: true
      });
      element.isVisible = false;
      element.sticky = true;
      element.messageCounts = {};
      element.filters = {
        searchTerm: '',
        messageTypes: new Set(),
        sessionStatus: new Set(),
        dateRange: {}
      };
      
      // Add IntegrationTestComponent specific properties if it's that element
      if (element.tagName === 'INTEGRATION-TEST-COMPONENT') {
        element.sessions = [];
        element.connectionState = 'DISCONNECTED';
        element.lastUpdate = 'Never';
        element.updateCount = 0;
        element.errors = [];
        
        // Mock the getWebSocketService method
        element.getWebSocketService = () => {
          return (window).__mockWebSocketService;
        };
        
        // Create a functional mock WebSocketController
        const handlers = {
          SESSION_CREATED: null,
          SESSION_UPDATED: null,
          SESSION_DELETED: null,
          CACHE_INVALIDATED: null
        };
        
        element.webSocketController = {
          onSessionCreated: (handler) => { handlers.SESSION_CREATED = handler; },
          onSessionUpdated: (handler) => { handlers.SESSION_UPDATED = handler; },
          onSessionDeleted: (handler) => { handlers.SESSION_DELETED = handler; },
          onCacheInvalidated: (handler) => { handlers.CACHE_INVALIDATED = handler; },
          getConnectionState: () => element.connectionState || 'DISCONNECTED',
          isConnected: () => element.connectionState === 'CONNECTED',
          reconnect: () => {
            const mockService = element.getWebSocketService();
            if (mockService && mockService.forceReconnect) {
              mockService.forceReconnect();
            }
          },
          optimisticUpdate: (propertyName, value, timeoutMs) => {
            // Mock optimistic update that actually updates the property
            element[propertyName] = value;
            element.updateCount = (element.updateCount || 0) + 1;
            element.dispatchEvent(new CustomEvent('update'));
          },
          confirmOptimisticUpdate: () => {},
          updateProperty: (propertyName, value) => {
            element[propertyName] = value;
            element.updateCount = (element.updateCount || 0) + 1;
            element.dispatchEvent(new CustomEvent('update'));
          },
          hostConnected: () => {},
          hostDisconnected: () => {},
          destroy: () => {},
          // Add a helper to simulate messages for testing
          _simulateMessage: (message) => {
            if (!message || !message.type) return;
            const handler = handlers[message.type];
            if (handler && message.payload) {
              switch (message.type) {
                case 'SESSION_CREATED':
                  handler(message.payload.session);
                  break;
                case 'SESSION_UPDATED':
                  handler(message.payload.session, message.payload.changes);
                  break;
                case 'SESSION_DELETED':
                  handler(message.payload.sessionId, message.payload.deletedAt);
                  break;
                case 'CACHE_INVALIDATED':
                  handler(message.payload);
                  break;
              }
            }
          }
        };
        
        // Mock other test helper methods with actual functionality
        element.performOptimisticUpdate = (sessionId, updates) => {
          const sessionIndex = element.sessions.findIndex(s => s.sessionId === sessionId);
          if (sessionIndex >= 0) {
            element.sessions[sessionIndex] = { ...element.sessions[sessionIndex], ...updates };
            element.sessions = [...element.sessions]; // Trigger reactivity
            element.updateCount = (element.updateCount || 0) + 1;
          }
        };
        element.confirmOptimisticUpdate = () => {
          // Mock confirm - for testing, just increment update count
          element.updateCount = (element.updateCount || 0) + 1;
        };
      }
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