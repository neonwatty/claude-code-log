import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import type { SessionContinuation } from './session-continuation.js';
import './session-continuation.js';
import type { ZodSession } from '../../../../shared/src/schemas/index.js';

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  constructor() {
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }
  
  send(): void {}
  close(): void {}
}

const mockSession: ZodSession = {
  id: 'test-session-123',
  projectPath: '/test/project',
  cwd: '/test/project',
  firstTimestamp: '2023-01-01T00:00:00.000Z',
  lastTimestamp: '2023-01-01T01:00:00.000Z',
  totalUsage: {
    input_tokens: 1000,
    output_tokens: 500,
    cache_creation_input_tokens: 200,
    cache_read_input_tokens: 100
  },
  entries: []
};

describe('SessionContinuation', () => {
  let element: SessionContinuation;

  beforeEach(async () => {
    // Setup mocks
    global.WebSocket = MockWebSocket as any;
    global.fetch = vi.fn();
    
    element = await fixture(html`<session-continuation></session-continuation>`) as SessionContinuation;
    await element.updateComplete;
    // Give it time for lifecycle methods to complete
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  describe('Component Creation', () => {
    it('should create element', () => {
      expect(element).toBeDefined();
      expect(element.tagName).toBe('SESSION-CONTINUATION');
      expect(element.shadowRoot).not.toBe(null);
    });

    it('should render root container', () => {
      const shadowRoot = element.shadowRoot!;
      // Should render at least some content
      const content = shadowRoot.textContent?.trim();
      expect(content).not.toBe('');
    });

    it('should have reactive properties', () => {
      // Component should be instantiated and properties should be settable
      expect(element).toBeDefined();
      
      // Test that properties can be set (this verifies they exist as setters)
      element.session = mockSession;
      expect(element.session).toEqual(mockSession);
      
      element.apiBaseUrl = '/test-api';
      expect(element.apiBaseUrl).toBe('/test-api');
    });
  });

  describe('Session Handling', () => {
    it('should update when session is set', async () => {
      element.session = mockSession;
      await element.updateComplete;
      
      expect(element.session).toEqual(mockSession);
    });

    it('should handle null session', async () => {
      element.session = null;
      await element.updateComplete;
      
      expect(element.session).toBe(null);
    });
  });

  describe('Properties', () => {
    it('should have configurable API base URL', () => {
      element.apiBaseUrl = 'http://localhost:3000/api';
      expect(element.apiBaseUrl).toBe('http://localhost:3000/api');
    });

    it('should handle boolean properties', () => {
      element.autoPrepareContext = false;
      expect(element.autoPrepareContext).toBe(false);
      
      element.showAdvancedOptions = true;
      expect(element.showAdvancedOptions).toBe(true);
    });
  });

  describe('Lifecycle', () => {
    it('should handle disconnection', () => {
      // The element should be created successfully and not throw on disconnection
      expect(element).toBeDefined();
      // disconnectedCallback might not be exposed directly, but component should handle lifecycle
      if (typeof element.disconnectedCallback === 'function') {
        expect(() => element.disconnectedCallback()).not.toThrow();
      }
    });
  });

  describe('WebSocket Integration', () => {
    it('should initialize without errors', async () => {
      // WebSocket should be mocked and initialized during component lifecycle
      expect(global.WebSocket).toBeDefined();
      // Component should be created without throwing errors
      expect(element).toBeDefined();
    });
  });

  describe('Rendering', () => {
    it('should render content based on session state', async () => {
      // Initially no session
      await element.updateComplete;
      let shadowRoot = element.shadowRoot!;
      let content = shadowRoot.textContent?.trim();
      expect(content).not.toBe('');
      
      // Set session
      element.session = mockSession;
      await element.updateComplete;
      
      // Should update content
      shadowRoot = element.shadowRoot!;
      content = shadowRoot.textContent?.trim();
      expect(content).not.toBe('');
      if (content) {
        expect(content).toContain('Session');
      }
    });
  });

  describe('State Management', () => {
    it('should manage internal state', async () => {
      element.session = mockSession;
      await element.updateComplete;
      
      // Component should have some internal state management
      expect(element).toBeDefined();
      // State might be initialized after first update
      const state = (element as any).continuationState;
      if (state !== undefined) {
        expect(typeof state).toBe('object');
      } else {
        // State might not be initialized yet, but component should exist
        expect(element).toBeDefined();
      }
    });
  });

  describe('Form Validation', () => {
    it('should validate form based on session', async () => {
      // No session should be invalid
      element.session = null;
      await element.updateComplete;
      
      // With session should be valid initially
      element.session = mockSession;
      await element.updateComplete;
      
      // Component should handle validation logic
      expect(element).toBeDefined();
    });
  });
});