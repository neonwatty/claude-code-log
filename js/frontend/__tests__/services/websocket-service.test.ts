/**
 * Unit tests for WebSocketService
 * Tests singleton pattern, connection lifecycle, and event emission
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WebSocketService } from '../../src/services/websocket-service';
import { WebSocketConnectionState, WebSocketMessageType, MessageType } from '../../src/types/websocket';
import { serializeMessage } from '../../src/utils/websocket/message-handlers';
import {
  type SessionCreatedMessage,
  type SessionUpdatedMessage,
  type SessionDeletedMessage,
  type CacheInvalidatedMessage
} from '../../src/utils/websocket/message-types';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  protocols?: string | string[];
  readyState: number = MockWebSocket.CONNECTING;
  
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
  }

  addEventListener(type: string, listener: Function) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Function) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: any): boolean {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
    
    // Also call direct handlers
    if (event.type === 'open' && this.onopen) this.onopen(event);
    if (event.type === 'close' && this.onclose) this.onclose(event);
    if (event.type === 'error' && this.onerror) this.onerror(event);
    if (event.type === 'message' && this.onmessage) this.onmessage(event);
    
    return true;
  }

  send = jest.fn();
  close = jest.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    const closeEvent = new CloseEvent('close', { code, reason });
    this.dispatchEvent(closeEvent);
  });
}

describe('WebSocketService', () => {
  let service: WebSocketService;
  let mockWebSocket: MockWebSocket;
  let lastCreatedMockWebSocket: MockWebSocket | null = null;

  beforeEach(() => {
    // Reset singleton
    (WebSocketService as any).instance = null;
    lastCreatedMockWebSocket = null;
    
    // Create jest mock constructor that captures the created instance
    const WebSocketMock = jest.fn((url: string, protocols?: string | string[]) => {
      const instance = new MockWebSocket(url, protocols);
      lastCreatedMockWebSocket = instance;
      return instance;
    });
    
    // Add static constants to mock
    (WebSocketMock as any).CONNECTING = MockWebSocket.CONNECTING;
    (WebSocketMock as any).OPEN = MockWebSocket.OPEN;
    (WebSocketMock as any).CLOSING = MockWebSocket.CLOSING;
    (WebSocketMock as any).CLOSED = MockWebSocket.CLOSED;
    
    (global as any).WebSocket = WebSocketMock;
    
    // Mock timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    
    // Clean up service
    if (service) {
      service.destroy();
    }
  });

  describe('Singleton Pattern', () => {
    it('should create a singleton instance', () => {
      const config = { url: 'ws://localhost:3001/ws' };
      const instance1 = WebSocketService.getInstance(config);
      const instance2 = WebSocketService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should throw error if no config provided on first initialization', () => {
      expect(() => WebSocketService.getInstance()).toThrow(
        'WebSocketService requires configuration on first initialization'
      );
    });

    it('should update config on subsequent calls with config', () => {
      const config1 = { url: 'ws://localhost:3001/ws' };
      const config2 = { url: 'ws://localhost:3002/ws', debug: true };
      
      const instance1 = WebSocketService.getInstance(config1);
      const instance2 = WebSocketService.getInstance(config2);
      
      expect(instance1).toBe(instance2);
      expect((instance2 as any).config.url).toBe('ws://localhost:3002/ws');
      expect((instance2 as any).config.debug).toBe(true);
    });
  });

  describe('Connection Lifecycle', () => {
    beforeEach(() => {
      service = WebSocketService.getInstance({ 
        url: 'ws://localhost:3001/ws',
        connectionTimeout: 5000
      });
    });

    it('should establish connection when connect() is called', () => {
      service.connect();
      
      expect(jest.getTimerCount()).toBeGreaterThan(0); // Connection timeout timer
      
      // Get the created WebSocket instance
      const WebSocketMock = (global as any).WebSocket as jest.MockedFunction<any>;
      expect(WebSocketMock).toHaveBeenCalledTimes(1);
      expect(lastCreatedMockWebSocket).not.toBeNull();
      mockWebSocket = lastCreatedMockWebSocket!;
      
      expect(mockWebSocket.url).toBe('ws://localhost:3001/ws');
      expect(service.getConnectionState()).toBe(WebSocketConnectionState.CONNECTING);
    });

    it('should handle successful connection', () => {
      const openHandler = jest.fn();
      service.on('connection:open', openHandler);
      
      service.connect();
      mockWebSocket = lastCreatedMockWebSocket!;
      
      // Simulate connection open
      mockWebSocket.readyState = MockWebSocket.OPEN;
      mockWebSocket.dispatchEvent(new Event('open'));
      
      expect(service.getConnectionState()).toBe(WebSocketConnectionState.CONNECTED);
      expect(service.isConnected()).toBe(true);
      expect(openHandler).toHaveBeenCalled();
    });

    it('should handle welcome message with client ID', () => {
      service.connect();
      mockWebSocket = lastCreatedMockWebSocket!;
      
      // Simulate connection and welcome message
      mockWebSocket.readyState = MockWebSocket.OPEN;
      mockWebSocket.dispatchEvent(new Event('open'));
      
      const welcomeMessage = {
        type: WebSocketMessageType.CONNECT,
        timestamp: new Date().toISOString(),
        data: {
          clientId: 'test-client-123',
          message: 'Connected',
          endpoints: {}
        }
      };
      
      mockWebSocket.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(welcomeMessage)
      }));
      
      expect(service.getClientId()).toBe('test-client-123');
    });

    it('should handle connection timeout', () => {
      service.connect();
      mockWebSocket = lastCreatedMockWebSocket!;
      
      // Advance time to trigger timeout
      jest.advanceTimersByTime(5000);
      
      expect(mockWebSocket.close).toHaveBeenCalled();
      // With enhanced reconnection logic, it should be in RECONNECTING state after timeout
      expect(service.getConnectionState()).toBe(WebSocketConnectionState.RECONNECTING);
    });

    it('should handle disconnection', () => {
      const closeHandler = jest.fn();
      service.on('connection:close', closeHandler);
      
      service.connect();
      mockWebSocket = lastCreatedMockWebSocket!;
      mockWebSocket.readyState = MockWebSocket.OPEN;
      mockWebSocket.dispatchEvent(new Event('open'));
      
      service.disconnect();
      
      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Client disconnect');
      expect(service.getConnectionState()).toBe(WebSocketConnectionState.DISCONNECTED);
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      service = WebSocketService.getInstance({ url: 'ws://localhost:3001/ws' });
      service.connect();
      mockWebSocket = lastCreatedMockWebSocket!;
      mockWebSocket.readyState = MockWebSocket.OPEN;
      mockWebSocket.dispatchEvent(new Event('open'));
    });

    it('should emit session:created events', () => {
      const handler = jest.fn();
      service.on('session:created', handler);
      
      const message = {
        type: WebSocketMessageType.SESSION_CREATED,
        timestamp: new Date().toISOString(),
        data: {
          sessionId: 'session-123',
          cwd: '/test/path',
          timestamp: new Date().toISOString()
        }
      };
      
      mockWebSocket.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(message)
      }));
      
      expect(handler).toHaveBeenCalledWith(message.data);
    });

    it('should emit session:updated events', () => {
      const handler = jest.fn();
      service.on('session:updated', handler);
      
      const message = {
        type: WebSocketMessageType.SESSION_UPDATED,
        timestamp: new Date().toISOString(),
        data: {
          sessionId: 'session-123',
          cwd: '/test/path',
          entryCount: 10,
          lastActivity: new Date().toISOString()
        }
      };
      
      mockWebSocket.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(message)
      }));
      
      expect(handler).toHaveBeenCalledWith(message.data);
    });

    it('should handle once listeners correctly', () => {
      const handler = jest.fn();
      service.once('session:deleted', handler);
      
      const message = {
        type: WebSocketMessageType.SESSION_DELETED,
        timestamp: new Date().toISOString(),
        data: { sessionId: 'session-123' }
      };
      
      // Emit twice
      mockWebSocket.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(message)
      }));
      mockWebSocket.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(message)
      }));
      
      // Should only be called once
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should allow unsubscribing from events', () => {
      const handler = jest.fn();
      const unsubscribe = service.on('error', handler);
      
      const message = {
        type: WebSocketMessageType.ERROR,
        timestamp: new Date().toISOString(),
        data: { message: 'Test error', code: 'TEST_ERROR' }
      };
      
      mockWebSocket.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(message)
      }));
      
      expect(handler).toHaveBeenCalledTimes(1);
      
      // Unsubscribe
      unsubscribe();
      
      mockWebSocket.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(message)
      }));
      
      // Should still be called only once
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Heartbeat Mechanism', () => {
    beforeEach(() => {
      service = WebSocketService.getInstance({ 
        url: 'ws://localhost:3001/ws',
        heartbeatInterval: 30000
      });
    });

    it('should start heartbeat on connection', () => {
      service.connect();
      mockWebSocket = lastCreatedMockWebSocket!;
      mockWebSocket.readyState = MockWebSocket.OPEN;
      mockWebSocket.dispatchEvent(new Event('open'));
      
      // Advance timer to trigger heartbeat
      jest.advanceTimersByTime(30000);
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining(WebSocketMessageType.HEARTBEAT)
      );
    });

    it('should respond to server heartbeat with pong', () => {
      service.connect();
      mockWebSocket = lastCreatedMockWebSocket!;
      mockWebSocket.readyState = MockWebSocket.OPEN;
      mockWebSocket.dispatchEvent(new Event('open'));
      
      const heartbeatMessage = {
        type: WebSocketMessageType.HEARTBEAT,
        timestamp: new Date().toISOString()
      };
      
      mockWebSocket.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(heartbeatMessage)
      }));
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining(WebSocketMessageType.PONG)
      );
    });
  });

  describe('Message Sending', () => {
    beforeEach(() => {
      service = WebSocketService.getInstance({ url: 'ws://localhost:3001/ws' });
      service.connect();
      mockWebSocket = lastCreatedMockWebSocket!;
    });

    it('should send messages when connected', () => {
      mockWebSocket.readyState = MockWebSocket.OPEN;
      mockWebSocket.dispatchEvent(new Event('open'));
      
      const message = {
        type: WebSocketMessageType.HEARTBEAT,
        timestamp: new Date().toISOString(),
        data: { test: 'data' }
      } as any;
      
      const result = service.send(message);
      
      expect(result).toBe(true);
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should queue messages when not connected', () => {
      // Still in CONNECTING state
      const message = {
        type: WebSocketMessageType.HEARTBEAT,
        timestamp: new Date().toISOString(),
        data: { test: 'data' }
      } as any;
      
      const result = service.send(message);
      
      expect(result).toBe(false);
      expect(mockWebSocket.send).not.toHaveBeenCalled();
      
      // Connect and check if queued message is sent
      mockWebSocket.readyState = MockWebSocket.OPEN;
      mockWebSocket.dispatchEvent(new Event('open'));
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      service = WebSocketService.getInstance({ url: 'ws://localhost:3001/ws' });
    });

    it('should track connection state changes', () => {
      const stateHandler = jest.fn();
      service.on('state:changed', stateHandler);
      
      expect(service.getConnectionState()).toBe(WebSocketConnectionState.DISCONNECTED);
      
      service.connect();
      expect(service.getConnectionState()).toBe(WebSocketConnectionState.CONNECTING);
      expect(stateHandler).toHaveBeenCalledWith({
        oldState: WebSocketConnectionState.DISCONNECTED,
        newState: WebSocketConnectionState.CONNECTING
      });
      
      mockWebSocket = lastCreatedMockWebSocket!;
      mockWebSocket.readyState = MockWebSocket.OPEN;
      mockWebSocket.dispatchEvent(new Event('open'));
      
      expect(service.getConnectionState()).toBe(WebSocketConnectionState.CONNECTED);
      expect(stateHandler).toHaveBeenCalledWith({
        oldState: WebSocketConnectionState.CONNECTING,
        newState: WebSocketConnectionState.CONNECTED
      });
    });
  });

  describe('New Message Protocol Integration', () => {
    beforeEach(() => {
      service = WebSocketService.getInstance({ url: 'ws://localhost:3001/ws' });
      service.connect();
      mockWebSocket = lastCreatedMockWebSocket!;
      mockWebSocket.readyState = MockWebSocket.OPEN;
      mockWebSocket.dispatchEvent(new Event('open'));
    });

    describe('Session Message Handling', () => {
      it('should handle SESSION_CREATED messages', () => {
        const sessionCreatedHandler = jest.fn();
        service.on('session:created', sessionCreatedHandler);

        const message: SessionCreatedMessage = {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:00:00Z',
          id: 'msg-123',
          payload: {
            session: {
              sessionId: 'session-123',
              title: 'New Session',
              createdAt: '2024-01-01T00:00:00Z',
              status: 'active'
            }
          }
        };

        const messageEvent = new MessageEvent('message', {
          data: serializeMessage(message)
        });

        mockWebSocket.dispatchEvent(messageEvent);

        expect(sessionCreatedHandler).toHaveBeenCalledWith(message.payload.session);
      });

      it('should handle SESSION_UPDATED messages', () => {
        const sessionUpdatedHandler = jest.fn();
        service.on('session:updated', sessionUpdatedHandler);

        const message: SessionUpdatedMessage = {
          type: MessageType.SESSION_UPDATED,
          timestamp: '2024-01-01T01:00:00Z',
          id: 'msg-124',
          payload: {
            session: {
              sessionId: 'session-123',
              title: 'Updated Session',
              updatedAt: '2024-01-01T01:00:00Z'
            },
            changes: {
              fields: ['title', 'updatedAt'],
              previousValues: {
                title: 'New Session',
                updatedAt: '2024-01-01T00:00:00Z'
              }
            }
          }
        };

        const messageEvent = new MessageEvent('message', {
          data: serializeMessage(message)
        });

        mockWebSocket.dispatchEvent(messageEvent);

        expect(sessionUpdatedHandler).toHaveBeenCalledWith({
          sessionId: 'session-123',
          title: 'Updated Session',
          updatedAt: '2024-01-01T01:00:00Z',
          changes: {
            fields: ['title', 'updatedAt'],
            previousValues: {
              title: 'New Session',
              updatedAt: '2024-01-01T00:00:00Z'
            }
          }
        });
      });

      it('should handle SESSION_DELETED messages', () => {
        const sessionDeletedHandler = jest.fn();
        service.on('session:deleted', sessionDeletedHandler);

        const message: SessionDeletedMessage = {
          type: MessageType.SESSION_DELETED,
          timestamp: '2024-01-01T02:00:00Z',
          id: 'msg-125',
          payload: {
            sessionId: 'session-123',
            deletedAt: '2024-01-01T02:00:00Z'
          }
        };

        const messageEvent = new MessageEvent('message', {
          data: serializeMessage(message)
        });

        mockWebSocket.dispatchEvent(messageEvent);

        expect(sessionDeletedHandler).toHaveBeenCalledWith(message.payload);
      });

      it('should handle CACHE_INVALIDATED messages', () => {
        const cacheInvalidatedHandler = jest.fn();
        (service as any).on('cache:invalidated', cacheInvalidatedHandler);

        const message: CacheInvalidatedMessage = {
          type: MessageType.CACHE_INVALIDATED,
          timestamp: '2024-01-01T03:00:00Z',
          id: 'msg-126',
          payload: {
            scope: 'session',
            sessionIds: ['session-123'],
            reason: 'Session updated'
          }
        };

        const messageEvent = new MessageEvent('message', {
          data: serializeMessage(message)
        });

        mockWebSocket.dispatchEvent(messageEvent);

        expect(cacheInvalidatedHandler).toHaveBeenCalledWith(message.payload);
      });
    });

    describe('Message Validation and Error Handling', () => {
      it('should handle malformed JSON messages gracefully', () => {
        const errorHandler = jest.fn();
        const messageHandler = jest.fn();
        
        service.on('error', errorHandler);
        service.on('message', messageHandler);

        const malformedMessage = '{ "type": "SESSION_CREATED", "invalid": }';
        const messageEvent = new MessageEvent('message', {
          data: malformedMessage
        });

        mockWebSocket.dispatchEvent(messageEvent);

        // Should not call message handler for invalid JSON
        expect(messageHandler).not.toHaveBeenCalled();
        // Should call error handler
        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Failed to parse message')
          })
        );
      });

      it('should handle invalid message format gracefully', () => {
        const errorHandler = jest.fn();
        service.on('error', errorHandler);

        const invalidMessage = JSON.stringify({
          randomField: 'value',
          anotherField: 123
        });

        const messageEvent = new MessageEvent('message', {
          data: invalidMessage
        });

        mockWebSocket.dispatchEvent(messageEvent);

        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Invalid message format')
          })
        );
      });

      it('should handle unknown message types gracefully', () => {
        const errorHandler = jest.fn();
        service.on('error', errorHandler);

        const unknownMessage = JSON.stringify({
          type: 'UNKNOWN_TYPE',
          timestamp: '2024-01-01T00:00:00Z',
          id: 'msg-999',
          payload: {}
        });

        const messageEvent = new MessageEvent('message', {
          data: unknownMessage
        });

        mockWebSocket.dispatchEvent(messageEvent);

        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Unknown message type')
          })
        );
      });
    });

    describe('Backward Compatibility', () => {
      it('should still handle legacy message format', () => {
        const sessionCreatedHandler = jest.fn();
        service.on('session:created', sessionCreatedHandler);

        // Legacy format (lowercase with underscores)
        const legacyMessage = {
          type: 'session_created',
          timestamp: '2024-01-01T00:00:00Z',
          data: {
            sessionId: 'legacy-session-123',
            cwd: '/test/path',
            timestamp: '2024-01-01T00:00:00Z'
          }
        };

        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify(legacyMessage)
        });

        mockWebSocket.dispatchEvent(messageEvent);

        expect(sessionCreatedHandler).toHaveBeenCalledWith(legacyMessage.data);
      });

      it('should handle both new and legacy message formats in same session', () => {
        const sessionCreatedHandler = jest.fn();
        const sessionUpdatedHandler = jest.fn();
        
        service.on('session:created', sessionCreatedHandler);
        service.on('session:updated', sessionUpdatedHandler);

        // New format message
        const newMessage: SessionCreatedMessage = {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:00:00Z',
          id: 'msg-new',
          payload: {
            session: {
              sessionId: 'new-session-123',
              title: 'New Format Session'
            }
          }
        };

        // Legacy format message
        const legacyMessage = {
          type: 'session_updated',
          timestamp: '2024-01-01T01:00:00Z',
          data: {
            sessionId: 'legacy-session-123',
            cwd: '/test/path',
            entryCount: 5,
            lastActivity: '2024-01-01T01:00:00Z'
          }
        };

        // Send both messages
        mockWebSocket.dispatchEvent(new MessageEvent('message', {
          data: serializeMessage(newMessage)
        }));

        mockWebSocket.dispatchEvent(new MessageEvent('message', {
          data: JSON.stringify(legacyMessage)
        }));

        expect(sessionCreatedHandler).toHaveBeenCalledWith(newMessage.payload.session);
        expect(sessionUpdatedHandler).toHaveBeenCalledWith(legacyMessage.data);
      });
    });

    describe('Message Type Guards Integration', () => {
      it('should use type guards to ensure type safety in handlers', () => {
        const universalHandler = jest.fn();
        
        // Register a handler that uses type guards
        service.on('message', (message) => {
          if ((message as any).type === MessageType.SESSION_CREATED) {
            universalHandler('session_created', message);
          } else if ((message as any).type === MessageType.SESSION_UPDATED) {
            universalHandler('session_updated', message);
          }
        });

        const sessionCreated: SessionCreatedMessage = {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:00:00Z',
          id: 'msg-1',
          payload: { session: { sessionId: 'test-123' } }
        };

        const sessionUpdated: SessionUpdatedMessage = {
          type: MessageType.SESSION_UPDATED,
          timestamp: '2024-01-01T01:00:00Z',
          id: 'msg-2',
          payload: {
            session: { sessionId: 'test-123' },
            changes: { fields: ['title'] }
          }
        };

        mockWebSocket.dispatchEvent(new MessageEvent('message', {
          data: serializeMessage(sessionCreated)
        }));

        mockWebSocket.dispatchEvent(new MessageEvent('message', {
          data: serializeMessage(sessionUpdated)
        }));

        expect(universalHandler).toHaveBeenCalledWith('session_created', sessionCreated);
        expect(universalHandler).toHaveBeenCalledWith('session_updated', sessionUpdated);
        expect(universalHandler).toHaveBeenCalledTimes(2);
      });
    });

    describe('Performance with New Protocol', () => {
      it('should handle rapid message processing efficiently', async () => {
        const messageHandler = jest.fn();
        service.on('session:created', messageHandler);

        const messageCount = 100;
        const messages: SessionCreatedMessage[] = [];

        // Create many messages
        for (let i = 0; i < messageCount; i++) {
          messages.push({
            type: MessageType.SESSION_CREATED,
            timestamp: new Date().toISOString(),
            id: `msg-${i}`,
            payload: {
              session: {
                sessionId: `session-${i}`,
                title: `Session ${i}`
              }
            }
          });
        }

        const startTime = performance.now();

        // Send all messages rapidly
        messages.forEach(message => {
          mockWebSocket.dispatchEvent(new MessageEvent('message', {
            data: serializeMessage(message)
          }));
        });

        const endTime = performance.now();
        const processingTime = endTime - startTime;

        expect(messageHandler).toHaveBeenCalledTimes(messageCount);
        expect(processingTime).toBeLessThan(100); // Should process 100 messages in under 100ms
      });

      it('should handle large message payloads efficiently', () => {
        const sessionCreatedHandler = jest.fn();
        service.on('session:created', sessionCreatedHandler);

        // Create message with large metadata
        const largeMetadata: Record<string, string> = {};
        for (let i = 0; i < 1000; i++) {
          largeMetadata[`field_${i}`] = `value_${i}`.repeat(50);
        }

        const largeMessage: SessionCreatedMessage = {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:00:00Z',
          id: 'large-msg',
          payload: {
            session: {
              sessionId: 'large-session',
              metadata: largeMetadata
            }
          }
        };

        const startTime = performance.now();
        
        mockWebSocket.dispatchEvent(new MessageEvent('message', {
          data: serializeMessage(largeMessage)
        }));

        const endTime = performance.now();

        expect(sessionCreatedHandler).toHaveBeenCalledWith(largeMessage.payload.session);
        expect(endTime - startTime).toBeLessThan(50); // Should handle large message quickly
      });
    });
  });
});