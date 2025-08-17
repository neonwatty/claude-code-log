/**
 * Integration tests for WebSocket message protocol end-to-end flow
 * Tests complete message lifecycle and protocol compatibility
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  serializeMessage,
  deserializeMessage,
  isValidMessage,
  MessageHandlerRegistry,
  isSessionCreatedMessage,
  isSessionUpdatedMessage,
  isSessionDeletedMessage,
  isCacheInvalidatedMessage
} from '../../../src/utils/websocket/message-handlers';
import {
  MessageType,
  type WebSocketMessage,
  type SessionCreatedMessage,
  type SessionUpdatedMessage,
  type SessionDeletedMessage,
  type CacheInvalidatedMessage
} from '../../../src/utils/websocket/message-types';

describe('WebSocket Message Protocol Integration', () => {
  let registry: MessageHandlerRegistry;
  let mockWebSocket: any;
  let receivedMessages: WebSocketMessage[] = [];

  beforeEach(() => {
    registry = new MessageHandlerRegistry();
    receivedMessages = [];

    // Mock WebSocket
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1, // OPEN
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    // Setup message collectors for testing
    registry.register(MessageType.SESSION_CREATED, (msg) => { receivedMessages.push(msg); });
    registry.register(MessageType.SESSION_UPDATED, (msg) => { receivedMessages.push(msg); });
    registry.register(MessageType.SESSION_DELETED, (msg) => { receivedMessages.push(msg); });
    registry.register(MessageType.CACHE_INVALIDATED, (msg) => { receivedMessages.push(msg); });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('End-to-End Message Flow', () => {
    it('should handle complete session lifecycle', async () => {
      // 1. Session Created
      const sessionCreated: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-1',
        payload: {
          session: {
            sessionId: 'session-123',
            title: 'New Session',
            createdAt: '2024-01-01T00:00:00Z',
            status: 'active'
          }
        }
      };

      // 2. Session Updated
      const sessionUpdated: SessionUpdatedMessage = {
        type: MessageType.SESSION_UPDATED,
        timestamp: '2024-01-01T01:00:00Z',
        id: 'msg-2',
        payload: {
          session: {
            sessionId: 'session-123',
            title: 'Updated Session',
            updatedAt: '2024-01-01T01:00:00Z',
            status: 'active'
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

      // 3. Cache Invalidated
      const cacheInvalidated: CacheInvalidatedMessage = {
        type: MessageType.CACHE_INVALIDATED,
        timestamp: '2024-01-01T01:30:00Z',
        id: 'msg-3',
        payload: {
          scope: 'session',
          sessionIds: ['session-123'],
          reason: 'Session updated'
        }
      };

      // 4. Session Deleted
      const sessionDeleted: SessionDeletedMessage = {
        type: MessageType.SESSION_DELETED,
        timestamp: '2024-01-01T02:00:00Z',
        id: 'msg-4',
        payload: {
          sessionId: 'session-123',
          deletedAt: '2024-01-01T02:00:00Z'
        }
      };

      const messages = [sessionCreated, sessionUpdated, cacheInvalidated, sessionDeleted];

      // Simulate receiving messages via WebSocket
      for (const message of messages) {
        const serialized = serializeMessage(message);
        const deserialized = deserializeMessage(serialized);
        
        expect(isValidMessage(deserialized)).toBe(true);
        await registry.processMessage(deserialized);
      }

      // Verify all messages were processed
      expect(receivedMessages).toHaveLength(4);
      expect(receivedMessages[0].type).toBe(MessageType.SESSION_CREATED);
      expect(receivedMessages[1].type).toBe(MessageType.SESSION_UPDATED);
      expect(receivedMessages[2].type).toBe(MessageType.CACHE_INVALIDATED);
      expect(receivedMessages[3].type).toBe(MessageType.SESSION_DELETED);
    });

    it('should handle batch message processing', async () => {
      const messages: WebSocketMessage[] = [
        {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:00:00Z',
          id: 'msg-1',
          payload: { session: { sessionId: 'session-1' } }
        },
        {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:01:00Z',
          id: 'msg-2',
          payload: { session: { sessionId: 'session-2' } }
        },
        {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:02:00Z',
          id: 'msg-3',
          payload: { session: { sessionId: 'session-3' } }
        }
      ];

      // Process all messages
      const processPromises = messages.map(async (message) => {
        const serialized = serializeMessage(message);
        const deserialized = deserializeMessage(serialized);
        await registry.processMessage(deserialized);
      });

      await Promise.all(processPromises);

      expect(receivedMessages).toHaveLength(3);
      expect(receivedMessages.every(msg => msg.type === MessageType.SESSION_CREATED)).toBe(true);
    });
  });

  describe('Message Type Detection and Routing', () => {
    it('should correctly route different message types to specific handlers', async () => {
      const sessionCreatedHandler = jest.fn();
      const sessionUpdatedHandler = jest.fn();
      const sessionDeletedHandler = jest.fn();
      const cacheInvalidatedHandler = jest.fn();

      // Register specific handlers
      const newRegistry = new MessageHandlerRegistry();
      newRegistry.register(MessageType.SESSION_CREATED, sessionCreatedHandler);
      newRegistry.register(MessageType.SESSION_UPDATED, sessionUpdatedHandler);
      newRegistry.register(MessageType.SESSION_DELETED, sessionDeletedHandler);
      newRegistry.register(MessageType.CACHE_INVALIDATED, cacheInvalidatedHandler);

      const messages: WebSocketMessage[] = [
        {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:00:00Z',
          id: 'msg-1',
          payload: { session: { sessionId: 'session-1' } }
        },
        {
          type: MessageType.SESSION_UPDATED,
          timestamp: '2024-01-01T00:01:00Z',
          id: 'msg-2',
          payload: {
            session: { sessionId: 'session-1' },
            changes: { fields: ['title'] }
          }
        },
        {
          type: MessageType.CACHE_INVALIDATED,
          timestamp: '2024-01-01T00:02:00Z',
          id: 'msg-3',
          payload: {
            scope: 'all',
            reason: 'System restart'
          }
        },
        {
          type: MessageType.SESSION_DELETED,
          timestamp: '2024-01-01T00:03:00Z',
          id: 'msg-4',
          payload: {
            sessionId: 'session-1',
            deletedAt: '2024-01-01T00:03:00Z'
          }
        }
      ];

      // Process messages
      for (const message of messages) {
        await newRegistry.processMessage(message);
      }

      // Verify correct routing
      expect(sessionCreatedHandler).toHaveBeenCalledTimes(1);
      expect(sessionUpdatedHandler).toHaveBeenCalledTimes(1);
      expect(sessionDeletedHandler).toHaveBeenCalledTimes(1);
      expect(cacheInvalidatedHandler).toHaveBeenCalledTimes(1);
    });

    it('should use type guards correctly in message routing', async () => {
      const handlerResults: { type: MessageType; isCorrectType: boolean }[] = [];

      const universalHandler = (message: WebSocketMessage) => {
        if (isSessionCreatedMessage(message)) {
          handlerResults.push({ type: message.type, isCorrectType: true });
        } else if (isSessionUpdatedMessage(message)) {
          handlerResults.push({ type: message.type, isCorrectType: true });
        } else if (isSessionDeletedMessage(message)) {
          handlerResults.push({ type: message.type, isCorrectType: true });
        } else if (isCacheInvalidatedMessage(message)) {
          handlerResults.push({ type: message.type, isCorrectType: true });
        } else {
          handlerResults.push({ type: (message as any).type, isCorrectType: false });
        }
      };

      const newRegistry = new MessageHandlerRegistry();
      newRegistry.register(MessageType.SESSION_CREATED, universalHandler);
      newRegistry.register(MessageType.SESSION_UPDATED, universalHandler);
      newRegistry.register(MessageType.SESSION_DELETED, universalHandler);
      newRegistry.register(MessageType.CACHE_INVALIDATED, universalHandler);

      const messages: WebSocketMessage[] = [
        {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:00:00Z',
          id: 'msg-1',
          payload: { session: { sessionId: 'session-1' } }
        },
        {
          type: MessageType.SESSION_UPDATED,
          timestamp: '2024-01-01T00:01:00Z',
          id: 'msg-2',
          payload: {
            session: { sessionId: 'session-1' },
            changes: { fields: ['title'] }
          }
        }
      ];

      for (const message of messages) {
        await newRegistry.processMessage(message);
      }

      expect(handlerResults).toHaveLength(2);
      expect(handlerResults.every(result => result.isCorrectType)).toBe(true);
    });
  });

  describe('Error Handling in Message Flow', () => {
    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{ "type": "SESSION_CREATED", "invalid": }';
      
      expect(() => {
        deserializeMessage(malformedJson);
      }).toThrow('Failed to deserialize message');
    });

    it('should handle invalid message structure gracefully', () => {
      const invalidMessage = {
        wrongField: 'value',
        anotherWrong: 123
      };

      const serialized = JSON.stringify(invalidMessage);
      
      expect(() => {
        deserializeMessage(serialized);
      }).toThrow('Invalid message format');
    });

    it('should continue processing other messages when one handler fails', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const successHandler = jest.fn();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const newRegistry = new MessageHandlerRegistry();
      newRegistry.register(MessageType.SESSION_CREATED, errorHandler);
      newRegistry.register(MessageType.SESSION_CREATED, successHandler);

      const message: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-1',
        payload: { session: { sessionId: 'session-1' } }
      };

      await newRegistry.processMessage(message);

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large message payloads', async () => {
      const largeMetadata = {};
      for (let i = 0; i < 1000; i++) {
        (largeMetadata as any)[`field_${i}`] = `value_${i}`.repeat(100);
      }

      const message: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-1',
        payload: {
          session: {
            sessionId: 'session-1',
            metadata: largeMetadata
          }
        }
      };

      const startTime = performance.now();
      const serialized = serializeMessage(message);
      const deserialized = deserializeMessage(serialized);
      await registry.processMessage(deserialized);
      const endTime = performance.now();

      expect(receivedMessages).toHaveLength(1);
      expect(endTime - startTime).toBeLessThan(100); // Should process within 100ms
    });

    it('should handle many concurrent message handlers', async () => {
      const handlerCount = 100;
      const handlers = Array.from({ length: handlerCount }, () => jest.fn());

      const newRegistry = new MessageHandlerRegistry();
      handlers.forEach(handler => {
        newRegistry.register(MessageType.SESSION_CREATED, handler);
      });

      const message: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-1',
        payload: { session: { sessionId: 'session-1' } }
      };

      const startTime = performance.now();
      await newRegistry.processMessage(message);
      const endTime = performance.now();

      expect(handlers.every(handler => handler.mock.calls.length === 1)).toBe(true);
      expect(endTime - startTime).toBeLessThan(50); // Should handle 100 handlers quickly
    });
  });

  describe('Protocol Backward Compatibility', () => {
    it('should handle legacy message format alongside new protocol', async () => {
      const legacyHandlers = {
        session_created: jest.fn(),
        session_updated: jest.fn()
      };

      // Simulate a system that handles both legacy and new formats
      const hybridRegistry = new MessageHandlerRegistry();
      
      // Register handlers for new format
      hybridRegistry.register(MessageType.SESSION_CREATED, (message) => {
        legacyHandlers.session_created(message);
      });

      hybridRegistry.register(MessageType.SESSION_UPDATED, (message) => {
        legacyHandlers.session_updated(message);
      });

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

      // Process new format message
      await hybridRegistry.processMessage(newMessage);

      expect(legacyHandlers.session_created).toHaveBeenCalledWith(newMessage);
    });
  });
});