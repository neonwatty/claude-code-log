/**
 * Unit tests for WebSocket Controller for Lit Components
 * Tests reactive property updates, optimistic UI updates, debouncing, and connection management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReactiveControllerHost } from 'lit';
import { WebSocketController, type WebSocketControllerConfig } from '../../../src/utils/websocket/websocket-controller';
import type { WebSocketService } from '../../../src/services/websocket-service';
import { getWebSocketService } from '../../../src/services/websocket-service';

// Mock the getWebSocketService function
vi.mock('../../../src/services/websocket-service', () => ({
  getWebSocketService: vi.fn(),
  WebSocketService: vi.fn()
}));
import type { SessionData, SessionCreatedMessage, SessionUpdatedMessage, SessionDeletedMessage, CacheInvalidatedMessage } from '../../../src/utils/websocket/message-types';
import { MessageType } from '../../../src/utils/websocket/message-types';
import { ConnectionState } from '../../../src/utils/websocket/connection-state';

// Mock ReactiveControllerHost
class MockReactiveControllerHost implements ReactiveControllerHost {
  public controllers: Set<any> = new Set();
  public requestUpdateCallCount = 0;
  public properties: Map<string, any> = new Map();

  addController(controller: any): void {
    this.controllers.add(controller);
  }

  removeController(controller: any): void {
    this.controllers.delete(controller);
  }

  requestUpdate(name?: PropertyKey, oldValue?: unknown): Promise<boolean> {
    this.requestUpdateCallCount++;
    return Promise.resolve(true);
  }

  updateComplete: Promise<boolean> = Promise.resolve(true);

  // Helper methods for testing
  setProperty(name: string, value: any): void {
    this.properties.set(name, value);
  }

  getProperty(name: string): any {
    return this.properties.get(name);
  }
}

// Mock WebSocket Service
class MockWebSocketService {
  private eventHandlers: Map<string, Function[]> = new Map();
  private _isConnected = false;
  private _connectionState = 'DISCONNECTED';

  on(event: string, handler: Function): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
    
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  isConnected(): boolean {
    return this._isConnected;
  }

  getConnectionState(): string {
    return this._connectionState;
  }

  connect(): void {
    this._isConnected = true;
    this._connectionState = 'CONNECTED';
  }

  forceReconnect(): void {
    this._isConnected = false;
    this._connectionState = 'RECONNECTING';
    setTimeout(() => {
      this._isConnected = true;
      this._connectionState = 'CONNECTED';
    }, 100);
  }

  // Test helpers
  setConnectionState(state: string, connected: boolean): void {
    this._connectionState = state;
    this._isConnected = connected;
  }

  simulateMessage(message: any): void {
    this.emit('message', message);
  }

  simulateStateChange(oldState: string, newState: string): void {
    this.emit('state:changed', { oldState, newState });
  }

  simulateError(error: any): void {
    this.emit('error', error);
  }
}

describe('WebSocketController', () => {
  let host: MockReactiveControllerHost;
  let mockWebSocketService: MockWebSocketService;
  let controller: WebSocketController;
  let config: WebSocketControllerConfig;

  beforeEach(() => {
    // Try to clear any existing timer configuration first
    try {
      vi.useRealTimers();
    } catch (e) {
      // Ignore if timers weren't fake
    }
    
    // Configure fake timers with limited scope to avoid performance conflicts
    vi.useFakeTimers({ 
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] 
    });
    
    host = new MockReactiveControllerHost();
    mockWebSocketService = new MockWebSocketService();
    
    // Configure the mock to return our mockWebSocketService
    vi.mocked(getWebSocketService).mockReturnValue(mockWebSocketService as any);
    
    config = {
      debug: false,
      debounceMs: 100,
      optimisticUpdates: true,
      autoConnect: false,
      messageTypes: ['SESSION_CREATED', 'SESSION_UPDATED', 'SESSION_DELETED', 'CACHE_INVALIDATED']
    };
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default config', () => {
      controller = new WebSocketController(host);
      
      expect(host.controllers.size).toBe(1);
      expect(host.controllers.has(controller)).toBe(true);
    });

    it('should initialize with custom config', () => {
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      
      expect(host.controllers.has(controller)).toBe(true);
    });

    it('should register with host as reactive controller', () => {
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      
      expect(host.controllers.has(controller)).toBe(true);
    });
  });

  describe('Lit ReactiveController Lifecycle', () => {
    beforeEach(() => {
      controller = new WebSocketController(host, mockWebSocketService as any, config);
    });

    it('should setup subscriptions on hostConnected', () => {
      const setupSpy = vi.spyOn(controller as any, 'setupSubscriptions');
      
      controller.hostConnected();
      
      expect(setupSpy).toHaveBeenCalled();
    });

    it('should auto-connect when autoConnect is true', () => {
      config.autoConnect = true;
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      mockWebSocketService.setConnectionState('DISCONNECTED', false);
      
      const connectSpy = vi.spyOn(mockWebSocketService, 'connect');
      controller.hostConnected();
      
      expect(connectSpy).toHaveBeenCalled();
    });

    it('should cleanup on hostDisconnected', () => {
      const cleanupSpy = vi.spyOn(controller as any, 'cleanup');
      
      controller.hostConnected();
      controller.hostDisconnected();
      
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Message Subscriptions', () => {
    beforeEach(() => {
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      controller.hostConnected();
    });

    it('should handle session created messages', () => {
      const sessionData: SessionData = {
        sessionId: 'test-session-123',
        title: 'Test Session',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      let receivedSession: SessionData | null = null;
      controller.onSessionCreated((session) => {
        receivedSession = session;
      });

      const message: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: { session: sessionData }
      };

      mockWebSocketService.simulateMessage(message);

      expect(receivedSession).toEqual(sessionData);
    });

    it('should handle session updated messages', () => {
      const sessionData: SessionData = {
        sessionId: 'test-session-123',
        title: 'Updated Session',
        updatedAt: '2024-01-01T01:00:00Z'
      };

      let receivedSession: SessionData | null = null;
      let receivedChanges: any = null;
      controller.onSessionUpdated((session, changes) => {
        receivedSession = session;
        receivedChanges = changes;
      });

      const message: SessionUpdatedMessage = {
        type: MessageType.SESSION_UPDATED,
        timestamp: '2024-01-01T01:00:00Z',
        id: 'msg-124',
        payload: {
          session: sessionData,
          changes: {
            fields: ['title', 'updatedAt'],
            previousValues: { title: 'Test Session' }
          }
        }
      };

      mockWebSocketService.simulateMessage(message);

      expect(receivedSession).toEqual(sessionData);
      expect(receivedChanges.fields).toEqual(['title', 'updatedAt']);
    });

    it('should handle session deleted messages', () => {
      let deletedSessionId: string | null = null;
      let deletedAt: string | null = null;
      controller.onSessionDeleted((sessionId, deletedAtTime) => {
        deletedSessionId = sessionId;
        deletedAt = deletedAtTime;
      });

      const message: SessionDeletedMessage = {
        type: MessageType.SESSION_DELETED,
        timestamp: '2024-01-01T02:00:00Z',
        id: 'msg-125',
        payload: {
          sessionId: 'test-session-123',
          deletedAt: '2024-01-01T02:00:00Z'
        }
      };

      mockWebSocketService.simulateMessage(message);

      expect(deletedSessionId).toBe('test-session-123');
      expect(deletedAt).toBe('2024-01-01T02:00:00Z');
    });

    it('should handle cache invalidated messages', () => {
      let receivedPayload: any = null;
      controller.onCacheInvalidated((payload) => {
        receivedPayload = payload;
      });

      const message: CacheInvalidatedMessage = {
        type: MessageType.CACHE_INVALIDATED,
        timestamp: '2024-01-01T03:00:00Z',
        id: 'msg-126',
        payload: {
          scope: 'session',
          sessionIds: ['test-session-123'],
          reason: 'manual refresh'
        }
      };

      mockWebSocketService.simulateMessage(message);

      expect(receivedPayload.scope).toBe('session');
      expect(receivedPayload.sessionIds).toEqual(['test-session-123']);
      expect(receivedPayload.reason).toBe('manual refresh');
    });
  });

  describe('Property Updates and Debouncing', () => {
    beforeEach(() => {
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      controller.hostConnected();
    });

    it('should update property immediately when debouncing is disabled', () => {
      config.debounceMs = 0;
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      controller.hostConnected();

      const initialRequestCount = host.requestUpdateCallCount;
      
      controller.updateProperty('testProp', 'testValue');
      
      expect(host.requestUpdateCallCount).toBe(initialRequestCount + 1);
    });

    it('should debounce rapid property updates', () => {
      const initialRequestCount = host.requestUpdateCallCount;
      
      // Fire multiple rapid updates
      controller.updateProperty('testProp', 'value1');
      controller.updateProperty('testProp', 'value2');
      controller.updateProperty('testProp', 'value3');
      
      // Should not have triggered updates yet
      expect(host.requestUpdateCallCount).toBe(initialRequestCount);
      
      // Fast forward through debounce period
      vi.advanceTimersByTime(100);
      
      // Should now have triggered exactly one update
      expect(host.requestUpdateCallCount).toBe(initialRequestCount + 1);
    });

    it('should handle multiple property debouncing independently', () => {
      const initialRequestCount = host.requestUpdateCallCount;
      
      controller.updateProperty('prop1', 'value1');
      controller.updateProperty('prop2', 'value2');
      
      vi.advanceTimersByTime(100);
      
      // Should trigger 2 updates (one for each property)
      expect(host.requestUpdateCallCount).toBe(initialRequestCount + 2);
    });
  });

  describe('Optimistic Updates', () => {
    beforeEach(() => {
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      controller.hostConnected();
    });

    it('should perform optimistic update and allow confirmation', () => {
      const originalValue = ['item1', 'item2'];
      const newValue = ['item1', 'item2', 'item3'];
      
      controller.optimisticUpdate('sessions', newValue, 1000);
      
      // Advance timers to trigger debounced update
      vi.advanceTimersByTime(100);
      
      // Should immediately update the property
      expect(host.requestUpdateCallCount).toBeGreaterThan(0);
      
      // Confirm the update
      controller.confirmOptimisticUpdate('sessions');
      
      // Fast forward past rollback time - should not rollback
      vi.advanceTimersByTime(1000);
      
      // No additional updates should occur
      const updateCountAfterConfirm = host.requestUpdateCallCount;
      vi.advanceTimersByTime(100);
      expect(host.requestUpdateCallCount).toBe(updateCountAfterConfirm);
    });

    it('should rollback optimistic update after timeout', () => {
      const originalValue = ['item1', 'item2'];
      const newValue = ['item1', 'item2', 'item3'];
      
      // Mock getting the original value
      (host as any).sessions = originalValue;
      
      const initialRequestCount = host.requestUpdateCallCount;
      
      controller.optimisticUpdate('sessions', newValue, 500);
      
      // Advance timers to trigger debounced update
      vi.advanceTimersByTime(100);
      
      // Should trigger initial update
      expect(host.requestUpdateCallCount).toBe(initialRequestCount + 1);
      
      // Fast forward past rollback time
      vi.advanceTimersByTime(500);
      
      // Should trigger rollback update
      expect(host.requestUpdateCallCount).toBe(initialRequestCount + 2);
    });

    it('should handle multiple optimistic updates on same property', () => {
      controller.optimisticUpdate('sessions', ['a'], 1000);
      controller.optimisticUpdate('sessions', ['a', 'b'], 1000);
      
      // Should clear previous timeout and set new one
      controller.confirmOptimisticUpdate('sessions');
      
      // Fast forward - should not rollback since confirmed
      vi.advanceTimersByTime(1000);
      
      // Should not trigger additional updates
      const finalCount = host.requestUpdateCallCount;
      vi.advanceTimersByTime(100);
      expect(host.requestUpdateCallCount).toBe(finalCount);
    });

    it('should skip optimistic updates when disabled', () => {
      config.optimisticUpdates = false;
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      controller.hostConnected();
      
      const initialRequestCount = host.requestUpdateCallCount;
      
      controller.optimisticUpdate('sessions', ['new']);
      
      // Should not trigger any updates
      expect(host.requestUpdateCallCount).toBe(initialRequestCount);
    });
  });

  describe('Connection State Management', () => {
    beforeEach(() => {
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      controller.hostConnected();
    });

    it('should return correct connection state', () => {
      mockWebSocketService.setConnectionState('CONNECTED', true);
      expect(controller.getConnectionState()).toBe(ConnectionState.CONNECTED);
      
      mockWebSocketService.setConnectionState('CONNECTING', false);
      expect(controller.getConnectionState()).toBe(ConnectionState.CONNECTING);
      
      mockWebSocketService.setConnectionState('DISCONNECTED', false);
      expect(controller.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
      
      mockWebSocketService.setConnectionState('ERROR', false);
      expect(controller.getConnectionState()).toBe(ConnectionState.ERROR);
    });

    it('should return correct connection status', () => {
      mockWebSocketService.setConnectionState('CONNECTED', true);
      expect(controller.isConnected()).toBe(true);
      
      mockWebSocketService.setConnectionState('DISCONNECTED', false);
      expect(controller.isConnected()).toBe(false);
    });

    it('should trigger reconnection', () => {
      const reconnectSpy = vi.spyOn(mockWebSocketService, 'forceReconnect');
      
      controller.reconnect();
      
      expect(reconnectSpy).toHaveBeenCalled();
    });

    it('should handle state change events', () => {
      const initialRequestCount = host.requestUpdateCallCount;
      
      mockWebSocketService.simulateStateChange('DISCONNECTED', 'CONNECTED');
      
      // Should trigger component update
      expect(host.requestUpdateCallCount).toBe(initialRequestCount + 1);
    });

    it('should handle error events', () => {
      const initialRequestCount = host.requestUpdateCallCount;
      
      mockWebSocketService.simulateError({ message: 'Connection error' });
      
      // Should trigger component update
      expect(host.requestUpdateCallCount).toBe(initialRequestCount + 1);
    });
  });

  describe('Memory Management and Cleanup', () => {
    beforeEach(() => {
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      controller.hostConnected();
    });

    it('should clean up subscriptions on disconnect', () => {
      // Add some subscriptions
      controller.onSessionCreated(() => {});
      controller.onSessionUpdated(() => {});
      controller.onSessionDeleted(() => {});
      
      const cleanupSpy = vi.spyOn(controller as any, 'cleanup');
      
      controller.hostDisconnected();
      
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should clear all timers on cleanup', () => {
      // Create some debounced updates
      controller.updateProperty('prop1', 'value1');
      controller.updateProperty('prop2', 'value2');
      
      // Create optimistic updates
      controller.optimisticUpdate('sessions', ['test'], 1000);
      
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      controller.hostDisconnected();
      
      // Should clear timers (exact count may vary based on implementation)
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should properly destroy controller', () => {
      const cleanupSpy = vi.spyOn(controller as any, 'cleanup');
      
      controller.destroy();
      
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      controller.hostConnected();
    });

    it('should handle malformed messages gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Simulate malformed message
      mockWebSocketService.simulateMessage({ invalid: 'message' });
      
      // Should not throw errors
      expect(() => {
        mockWebSocketService.simulateMessage(null);
        mockWebSocketService.simulateMessage(undefined);
        mockWebSocketService.simulateMessage('not an object');
      }).not.toThrow();
      
      consoleSpy.mockRestore();
    });

    it('should handle subscription errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Add handler that throws
      controller.onSessionCreated(() => {
        throw new Error('Handler error');
      });
      
      const sessionData: SessionData = {
        sessionId: 'test-session',
        title: 'Test Session'
      };

      const message: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: { session: sessionData }
      };
      
      // Should not throw even if handler throws
      expect(() => {
        mockWebSocketService.simulateMessage(message);
      }).not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Debug Mode', () => {
    beforeEach(() => {
      config.debug = true;
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      controller.hostConnected();
    });

    it('should log debug information when debug mode is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      controller.updateProperty('testProp', 'testValue');
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should not log when debug mode is disabled', () => {
      config.debug = false;
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      controller.hostConnected();
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      controller.updateProperty('testProp', 'testValue');
      
      // Should not log when debug is false
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration with Existing Message Handlers', () => {
    beforeEach(() => {
      controller = new WebSocketController(host, mockWebSocketService as any, config);
      controller.hostConnected();
    });

    it('should work with MessageHandlerRegistry', () => {
      const handlerCallCount = { count: 0 };
      
      controller.onSessionCreated(() => {
        handlerCallCount.count++;
      });
      
      // Simulate multiple messages
      const sessionData: SessionData = { sessionId: 'test', title: 'Test' };
      const message: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: { session: sessionData }
      };
      
      mockWebSocketService.simulateMessage(message);
      mockWebSocketService.simulateMessage(message);
      
      expect(handlerCallCount.count).toBe(2);
    });

    it('should process messages through existing validation', () => {
      let receivedValidMessage = false;
      
      controller.onSessionCreated(() => {
        receivedValidMessage = true;
      });
      
      // Valid message should be processed
      const validMessage: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: { session: { sessionId: 'test', title: 'Test' } }
      };
      
      mockWebSocketService.simulateMessage(validMessage);
      expect(receivedValidMessage).toBe(true);
    });
  });
});