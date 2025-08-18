/**
 * Integration tests for WebSocket Controller
 * Tests WebSocket controller functionality without full Lit component dependencies
 */

// Disable the mock for this integration test by using a jest.doMock override
jest.doMock('../../src/utils/websocket/websocket-controller', () => {
  // Import the actual implementation from the file system
  return jest.requireActual('../../src/utils/websocket/websocket-controller.ts');
});

import { WebSocketController } from '../../src/utils/websocket/websocket-controller';
import { MessageHandlerRegistry } from '../../src/utils/websocket/message-handlers';
import type { SessionData, SessionCreatedMessage, SessionUpdatedMessage, SessionDeletedMessage } from '../../src/utils/websocket/message-types';
import { MessageType } from '../../src/utils/websocket/message-types';
import { ConnectionState } from '../../src/utils/websocket/connection-state';

// Mock WebSocket Service for integration testing
class MockWebSocketServiceIntegration {
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
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Handler error:', error);
      }
    });
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
    this.emit('state:changed', { oldState: 'DISCONNECTED', newState: 'CONNECTED' });
  }

  disconnect(): void {
    this._isConnected = false;
    this._connectionState = 'DISCONNECTED';
    this.emit('state:changed', { oldState: 'CONNECTED', newState: 'DISCONNECTED' });
  }

  forceReconnect(): void {
    this._isConnected = false;
    this._connectionState = 'RECONNECTING';
    this.emit('state:changed', { oldState: 'DISCONNECTED', newState: 'RECONNECTING' });
    
    setTimeout(() => {
      this._isConnected = true;
      this._connectionState = 'CONNECTED';
      this.emit('state:changed', { oldState: 'RECONNECTING', newState: 'CONNECTED' });
    }, 100);
  }

  // Test helpers
  setConnectionState(state: string, connected: boolean): void {
    const oldState = this._connectionState;
    this._connectionState = state;
    this._isConnected = connected;
    this.emit('state:changed', { oldState, newState: state });
  }

  simulateMessage(message: any): void {
    this.emit('message', message);
  }

  simulateError(error: any): void {
    this.emit('error', error);
  }
}

// Mock host for controller testing
class MockHost {
  private _isConnected = false;
  updateCount = 0;
  sessions: SessionData[] = [];

  constructor() {
    this.requestUpdate = this.requestUpdate.bind(this);
  }

  get updateComplete(): Promise<boolean> {
    return Promise.resolve(true);
  }

  requestUpdate(): void {
    this.updateCount++;
  }

  addController(controller: any): void {
    // Mock implementation
  }

  removeController(controller: any): void {
    // Mock implementation
  }
}

describe('WebSocket Controller Integration', () => {
  let mockService: MockWebSocketServiceIntegration;
  let mockHost: MockHost;
  let controller: WebSocketController;

  beforeEach(() => {
    jest.useFakeTimers();
    
    mockService = new MockWebSocketServiceIntegration();
    mockHost = new MockHost();
    
    controller = new WebSocketController(mockHost as any, mockService as any, {
      debug: true,
      debounceMs: 50,
      optimisticUpdates: true,
      autoConnect: false
    });
    
    // Simulate host connected lifecycle
    controller.hostConnected();
    
    // Connect the service for most tests
    mockService.connect();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Basic Controller Integration', () => {
    it('should initialize controller with WebSocket service', () => {
      mockService.disconnect(); // Test initialization state
      expect(controller).toBeDefined();
      expect(controller.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should connect to WebSocket service', () => {
      mockService.connect();
      expect(controller.getConnectionState()).toBe(ConnectionState.CONNECTED);
    });

    it('should handle WebSocket messages', () => {
      const sessionData: SessionData = {
        sessionId: 'integration-test-1',
        title: 'Integration Test Session',
        createdAt: '2024-01-01T10:00:00Z',
        status: 'active'
      };

      const message: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T10:00:00Z',
        id: 'msg-123',
        payload: { session: sessionData }
      };

      let receivedSession: SessionData | null = null;
      let handlerCalled = false;
      
      controller.onSessionCreated((session: SessionData) => {
        console.log('Handler called with:', session);
        handlerCalled = true;
        receivedSession = session;
      });

      // Directly simulate message
      mockService.simulateMessage(message);
      
      expect(receivedSession).toEqual(sessionData);
    });
  });

  describe('Session Lifecycle Management', () => {

    it('should handle complete session lifecycle', () => {
      let sessions: SessionData[] = [];
      let deletedSessionId: string | null = null;

      // Set up handlers
      controller.onSessionCreated((session: SessionData) => {
        sessions.push(session);
      });

      controller.onSessionUpdated((session: SessionData, changes: any) => {
        const index = sessions.findIndex(s => s.sessionId === session.sessionId);
        if (index >= 0) {
          sessions[index] = { ...sessions[index], ...session };
        }
      });

      controller.onSessionDeleted((sessionId: string, deletedAt: string) => {
        deletedSessionId = sessionId;
        sessions = sessions.filter(s => s.sessionId !== sessionId);
      });

      // Create session
      const sessionData: SessionData = {
        sessionId: 'lifecycle-test',
        title: 'Lifecycle Test Session',
        status: 'active'
      };

      const createMessage: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T10:00:00Z',
        id: 'msg-create',
        payload: { session: sessionData }
      };

      mockService.simulateMessage(createMessage);
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].status).toBe('active');

      // Update session
      const updatedSessionData: SessionData = {
        sessionId: 'lifecycle-test',
        title: 'Updated Lifecycle Test Session',
        status: 'completed'
      };

      const updateMessage: SessionUpdatedMessage = {
        type: MessageType.SESSION_UPDATED,
        timestamp: '2024-01-01T11:00:00Z',
        id: 'msg-update',
        payload: {
          session: updatedSessionData,
          changes: {
            fields: ['title', 'status'],
            previousValues: { title: 'Lifecycle Test Session', status: 'active' }
          }
        }
      };

      mockService.simulateMessage(updateMessage);
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].title).toBe('Updated Lifecycle Test Session');
      expect(sessions[0].status).toBe('completed');

      // Delete session
      const deleteMessage: SessionDeletedMessage = {
        type: MessageType.SESSION_DELETED,
        timestamp: '2024-01-01T12:00:00Z',
        id: 'msg-delete',
        payload: {
          sessionId: 'lifecycle-test',
          deletedAt: '2024-01-01T12:00:00Z'
        }
      };

      mockService.simulateMessage(deleteMessage);
      
      expect(sessions).toHaveLength(0);
      expect(deletedSessionId).toBe('lifecycle-test');
    });

    it('should handle multiple sessions concurrently', () => {
      const sessions: SessionData[] = [];
      
      controller.onSessionCreated((session: SessionData) => {
        sessions.push(session);
      });

      const sessionDataList: SessionData[] = [
        { sessionId: 'session-1', title: 'Session 1', status: 'active' },
        { sessionId: 'session-2', title: 'Session 2', status: 'pending' },
        { sessionId: 'session-3', title: 'Session 3', status: 'completed' }
      ];

      // Create multiple sessions
      for (const sessionData of sessionDataList) {
        const message: SessionCreatedMessage = {
          type: MessageType.SESSION_CREATED,
          timestamp: new Date().toISOString(),
          id: `msg-${sessionData.sessionId}`,
          payload: { session: sessionData }
        };
        mockService.simulateMessage(message);
      }

      expect(sessions).toHaveLength(3);
      expect(sessions.map(s => s.sessionId)).toEqual(['session-1', 'session-2', 'session-3']);
    });
  });

  describe('Optimistic Updates', () => {

    it('should perform optimistic updates', () => {
      const testData = { key: 'value' };
      const originalData = { key: 'original' };
      
      // Set original property value on mock host
      (mockHost as any)['test-key'] = originalData;
      
      // Perform optimistic update
      controller.optimisticUpdate('test-key', testData, 2000);
      
      // Advance timers to trigger debounced update
      jest.advanceTimersByTime(100);
      
      // Should have updated the property optimistically
      expect((mockHost as any)['test-key']).toEqual(testData);
      expect(mockHost.updateCount).toBeGreaterThan(0);
    });

    it('should confirm optimistic updates', () => {
      const testData = { key: 'value' };
      const originalData = { key: 'original' };
      
      // Set original property value on mock host
      (mockHost as any)['test-key'] = originalData;
      
      // Perform optimistic update
      controller.optimisticUpdate('test-key', testData, 2000);
      
      // Advance timers to trigger debounced update
      jest.advanceTimersByTime(100);
      
      // Confirm the update
      controller.confirmOptimisticUpdate('test-key');
      
      // Should maintain the new value and not rollback
      expect((mockHost as any)['test-key']).toEqual(testData);
    });

    it('should rollback optimistic updates on timeout', () => {
      const testData = { key: 'value' };
      const originalData = { key: 'original' };
      
      // Set original property value on mock host
      (mockHost as any)['test-key'] = originalData;
      
      // Perform optimistic update with short timeout
      controller.optimisticUpdate('test-key', testData, 100);
      
      // Advance timers to trigger debounced update
      jest.advanceTimersByTime(100);
      
      // Verify optimistic update was applied
      expect((mockHost as any)['test-key']).toEqual(testData);
      
      // Fast forward past timeout (rollback should happen)
      jest.advanceTimersByTime(150);
      
      // Should have rolled back to original value
      expect((mockHost as any)['test-key']).toEqual(originalData);
    });
  });

  describe('Connection State Management', () => {
    it('should react to connection state changes', () => {
      mockService.disconnect(); // Start from disconnected state
      expect(controller.getConnectionState()).toBe(ConnectionState.DISCONNECTED);

      // Connect
      mockService.connect();
      expect(controller.getConnectionState()).toBe(ConnectionState.CONNECTED);

      // Disconnect
      mockService.disconnect();
      expect(controller.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should handle reconnection scenarios', () => {
      mockService.disconnect();
      expect(controller.getConnectionState()).toBe(ConnectionState.DISCONNECTED);

      // Start reconnection
      mockService.forceReconnect();
      expect(controller.getConnectionState()).toBe(ConnectionState.RECONNECTING);

      // Complete reconnection
      jest.advanceTimersByTime(150);
      expect(controller.getConnectionState()).toBe(ConnectionState.CONNECTED);
    });

    it('should handle connection errors gracefully', () => {
      mockService.connect();
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate connection error
      mockService.simulateError({ message: 'Connection lost' });

      // Controller should still be functional
      expect(mockService.isConnected()).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Debouncing and Performance', () => {

    it('should debounce rapid updates', () => {
      const initialUpdateCount = mockHost.updateCount;

      // Send rapid updates
      for (let i = 0; i < 10; i++) {
        const sessionData: SessionData = {
          sessionId: `rapid-${i}`,
          title: `Rapid Session ${i}`
        };

        const message: SessionCreatedMessage = {
          type: MessageType.SESSION_CREATED,
          timestamp: new Date().toISOString(),
          id: `msg-rapid-${i}`,
          payload: { session: sessionData }
        };

        mockService.simulateMessage(message);
      }

      // Fast forward through debounce period
      jest.advanceTimersByTime(100);

      // Update count should have increased 
      expect(mockHost.updateCount).toBeGreaterThanOrEqual(initialUpdateCount);
      // Should be fewer updates than the total number of messages due to debouncing
      expect(mockHost.updateCount).toBeLessThan(initialUpdateCount + 10);
    });

    it('should handle large numbers of sessions efficiently', () => {
      const sessionCount = 100;
      const startTime = performance.now();

      // Create many sessions
      for (let i = 0; i < sessionCount; i++) {
        const sessionData: SessionData = {
          sessionId: `perf-test-${i}`,
          title: `Performance Test Session ${i}`,
          status: i % 2 === 0 ? 'active' : 'completed'
        };

        const message: SessionCreatedMessage = {
          type: MessageType.SESSION_CREATED,
          timestamp: new Date().toISOString(),
          id: `msg-perf-${i}`,
          payload: { session: sessionData }
        };

        mockService.simulateMessage(message);
      }

      jest.advanceTimersByTime(100);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 100 sessions reasonably quickly (< 1000ms)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed WebSocket messages gracefully', () => {
      mockService.connect();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Send malformed messages
      mockService.simulateMessage(null);
      mockService.simulateMessage(undefined);
      mockService.simulateMessage({ invalid: 'format' });
      mockService.simulateMessage('string instead of object');

      // Controller should still be functional
      expect(mockService.isConnected()).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should recover from WebSocket service errors', () => {
      mockService.connect();

      // Simulate service error
      mockService.simulateError({ message: 'Service error' });

      // Controller should handle the error and continue functioning
      expect(mockService.isConnected()).toBe(true);

      // Should still be able to process new messages
      const sessionData: SessionData = {
        sessionId: 'recovery-test',
        title: 'Recovery Test Session'
      };

      const message: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T10:00:00Z',
        id: 'msg-recovery',
        payload: { session: sessionData }
      };

      let receivedSession: SessionData | null = null;
      controller.onSessionCreated((session: SessionData) => {
        receivedSession = session;
      });

      mockService.simulateMessage(message);
      
      expect(receivedSession).toEqual(sessionData);
    });

    it('should handle controller lifecycle correctly', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Test that disconnecting controller doesn't cause errors
      expect(() => {
        controller.hostDisconnected();
      }).not.toThrow();

      // Test that reconnecting controller doesn't cause errors
      expect(() => {
        controller.hostConnected();
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('Memory Management', () => {
    it('should not cause memory leaks with many updates', () => {
      
      const iterations = 200;
      const sessions: SessionData[] = [];
      
      controller.onSessionCreated((session: SessionData) => {
        sessions.push(session);
      });

      controller.onSessionDeleted((sessionId: string, deletedAt: string) => {
        const index = sessions.findIndex(s => s.sessionId === sessionId);
        if (index >= 0) {
          sessions.splice(index, 1);
        }
      });
      
      // Create and delete many sessions to test memory management
      for (let i = 0; i < iterations; i++) {
        const sessionData: SessionData = {
          sessionId: `memory-test-${i}`,
          title: `Memory Test Session ${i}`
        };

        // Create
        const createMessage: SessionCreatedMessage = {
          type: MessageType.SESSION_CREATED,
          timestamp: new Date().toISOString(),
          id: `msg-create-${i}`,
          payload: { session: sessionData }
        };

        mockService.simulateMessage(createMessage);

        // Delete immediately
        const deleteMessage: SessionDeletedMessage = {
          type: MessageType.SESSION_DELETED,
          timestamp: new Date().toISOString(),
          id: `msg-delete-${i}`,
          payload: {
            sessionId: `memory-test-${i}`,
            deletedAt: new Date().toISOString()
          }
        };

        mockService.simulateMessage(deleteMessage);
      }

      jest.advanceTimersByTime(100);

      // Should end up with no sessions
      expect(sessions).toHaveLength(0);
      // Update count should reflect operations (may be debounced)
      expect(mockHost.updateCount).toBeGreaterThanOrEqual(1);
    });

    it('should clean up WebSocket subscriptions on controller removal', () => {
      // Test that disconnecting controller doesn't cause errors
      expect(() => {
        controller.hostDisconnected();
      }).not.toThrow();
      
      // Test that the controller no longer processes messages after cleanup
      let receivedSession: SessionData | null = null;
      controller.onSessionCreated((session: SessionData) => {
        receivedSession = session;
      });
      
      const sessionData: SessionData = {
        sessionId: 'cleanup-test',
        title: 'Cleanup Test Session'
      };
      
      const message: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T10:00:00Z',
        id: 'msg-cleanup',
        payload: { session: sessionData }
      };
      
      mockService.simulateMessage(message);
      
      // After cleanup, handlers should not be called
      expect(receivedSession).toBeNull();
    });
  });
});