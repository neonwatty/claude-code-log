/**
 * Unit tests for WebSocket message handlers and utilities
 * Tests serialization, validation, type guards, and handler registry
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  serializeMessage,
  deserializeMessage,
  isValidMessage,
  isSessionCreatedMessage,
  isSessionUpdatedMessage,
  isSessionDeletedMessage,
  isCacheInvalidatedMessage,
  validateMessage,
  createMessageError,
  createBaseMessage,
  MessageHandlerRegistry
} from '../../../src/utils/websocket/message-handlers';
import {
  MessageType,
  MessageErrorCode,
  type WebSocketMessage,
  type SessionCreatedMessage,
  type SessionUpdatedMessage,
  type SessionDeletedMessage,
  type CacheInvalidatedMessage
} from '../../../src/utils/websocket/message-types';

describe('WebSocket Message Handlers', () => {
  // Mock crypto.randomUUID for consistent testing
  const mockUUID = 'test-uuid-123';
  beforeEach(() => {
    Object.defineProperty(global, 'crypto', {
      value: {
        randomUUID: jest.fn(() => mockUUID)
      },
      writable: true
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('serializeMessage', () => {
    it('should serialize valid message to JSON string', () => {
      const message: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: {
          session: {
            sessionId: 'test-session-123',
            title: 'Test Session'
          }
        }
      };

      const serialized = serializeMessage(message);
      const parsed = JSON.parse(serialized);

      expect(parsed.type).toBe(MessageType.SESSION_CREATED);
      expect(parsed.payload.session.sessionId).toBe('test-session-123');
    });

    it('should handle messages with undefined optional fields', () => {
      const message: SessionDeletedMessage = {
        type: MessageType.SESSION_DELETED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-124',
        payload: {
          sessionId: 'test-session-123',
          deletedAt: '2024-01-01T00:00:00Z'
        }
      };

      const serialized = serializeMessage(message);
      expect(() => JSON.parse(serialized)).not.toThrow();
    });

    it('should throw error for non-serializable content', () => {
      const circularRef: any = {};
      circularRef.self = circularRef;

      const invalidMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: { circular: circularRef }
      } as any;

      expect(() => serializeMessage(invalidMessage)).toThrow('Failed to serialize message');
    });
  });

  describe('deserializeMessage', () => {
    it('should deserialize valid JSON to message object', () => {
      const message: SessionCreatedMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: {
          session: {
            sessionId: 'test-session-123'
          }
        }
      };

      const serialized = JSON.stringify(message);
      const deserialized = deserializeMessage(serialized);

      expect(deserialized.type).toBe(MessageType.SESSION_CREATED);
      expect(deserialized.id).toBe('msg-123');
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{ "type": "SESSION_CREATED", "invalid": }';
      expect(() => deserializeMessage(invalidJson)).toThrow('Failed to deserialize message');
    });

    it('should throw error for invalid message format', () => {
      const invalidMessage = JSON.stringify({ random: 'data' });
      expect(() => deserializeMessage(invalidMessage)).toThrow('Invalid message format');
    });
  });

  describe('isValidMessage', () => {
    it('should return true for valid SESSION_CREATED message', () => {
      const message = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: {
          session: {
            sessionId: 'test-session-123'
          }
        }
      };

      expect(isValidMessage(message)).toBe(true);
    });

    it('should return true for valid SESSION_UPDATED message', () => {
      const message = {
        type: MessageType.SESSION_UPDATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-124',
        payload: {
          session: { sessionId: 'test-session-123' },
          changes: { fields: ['title'] }
        }
      };

      expect(isValidMessage(message)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isValidMessage(null)).toBe(false);
      expect(isValidMessage(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(isValidMessage('string')).toBe(false);
      expect(isValidMessage(123)).toBe(false);
      expect(isValidMessage(true)).toBe(false);
    });

    it('should return false for unknown message type', () => {
      const message = {
        type: 'UNKNOWN_TYPE',
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: {}
      };

      expect(isValidMessage(message)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      const message = {
        type: MessageType.SESSION_CREATED,
        // missing timestamp, id, payload
      };

      expect(isValidMessage(message)).toBe(false);
    });

    it('should return false for invalid payload types', () => {
      const message = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: {
          session: 'invalid-not-object' // should be object
        }
      };

      expect(isValidMessage(message)).toBe(false);
    });
  });

  describe('Type Guards', () => {
    const sessionCreatedMessage: SessionCreatedMessage = {
      type: MessageType.SESSION_CREATED,
      timestamp: '2024-01-01T00:00:00Z',
      id: 'msg-123',
      payload: { session: { sessionId: 'test-123' } }
    };

    const sessionUpdatedMessage: SessionUpdatedMessage = {
      type: MessageType.SESSION_UPDATED,
      timestamp: '2024-01-01T00:00:00Z',
      id: 'msg-124',
      payload: {
        session: { sessionId: 'test-123' },
        changes: { fields: ['title'] }
      }
    };

    const sessionDeletedMessage: SessionDeletedMessage = {
      type: MessageType.SESSION_DELETED,
      timestamp: '2024-01-01T00:00:00Z',
      id: 'msg-125',
      payload: {
        sessionId: 'test-123',
        deletedAt: '2024-01-01T00:00:00Z'
      }
    };

    const cacheInvalidatedMessage: CacheInvalidatedMessage = {
      type: MessageType.CACHE_INVALIDATED,
      timestamp: '2024-01-01T00:00:00Z',
      id: 'msg-126',
      payload: {
        scope: 'all',
        reason: 'System restart'
      }
    };

    describe('isSessionCreatedMessage', () => {
      it('should return true for SESSION_CREATED message', () => {
        expect(isSessionCreatedMessage(sessionCreatedMessage)).toBe(true);
      });

      it('should return false for other message types', () => {
        expect(isSessionCreatedMessage(sessionUpdatedMessage)).toBe(false);
        expect(isSessionCreatedMessage(sessionDeletedMessage)).toBe(false);
        expect(isSessionCreatedMessage(cacheInvalidatedMessage)).toBe(false);
      });
    });

    describe('isSessionUpdatedMessage', () => {
      it('should return true for SESSION_UPDATED message', () => {
        expect(isSessionUpdatedMessage(sessionUpdatedMessage)).toBe(true);
      });

      it('should return false for other message types', () => {
        expect(isSessionUpdatedMessage(sessionCreatedMessage)).toBe(false);
        expect(isSessionUpdatedMessage(sessionDeletedMessage)).toBe(false);
        expect(isSessionUpdatedMessage(cacheInvalidatedMessage)).toBe(false);
      });
    });

    describe('isSessionDeletedMessage', () => {
      it('should return true for SESSION_DELETED message', () => {
        expect(isSessionDeletedMessage(sessionDeletedMessage)).toBe(true);
      });

      it('should return false for other message types', () => {
        expect(isSessionDeletedMessage(sessionCreatedMessage)).toBe(false);
        expect(isSessionDeletedMessage(sessionUpdatedMessage)).toBe(false);
        expect(isSessionDeletedMessage(cacheInvalidatedMessage)).toBe(false);
      });
    });

    describe('isCacheInvalidatedMessage', () => {
      it('should return true for CACHE_INVALIDATED message', () => {
        expect(isCacheInvalidatedMessage(cacheInvalidatedMessage)).toBe(true);
      });

      it('should return false for other message types', () => {
        expect(isCacheInvalidatedMessage(sessionCreatedMessage)).toBe(false);
        expect(isCacheInvalidatedMessage(sessionUpdatedMessage)).toBe(false);
        expect(isCacheInvalidatedMessage(sessionDeletedMessage)).toBe(false);
      });
    });
  });

  describe('validateMessage', () => {
    it('should return null for valid message', () => {
      const validMessage = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: {
          session: { sessionId: 'test-123' }
        }
      };

      expect(validateMessage(validMessage)).toBeNull();
    });

    it('should return error for non-object input', () => {
      const error = validateMessage('not an object');
      expect(error).not.toBeNull();
      expect(error?.code).toBe(MessageErrorCode.INVALID_FORMAT);
      expect(error?.message).toBe('Message must be an object');
    });

    it('should return error for missing type', () => {
      const message = {
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: {}
      };

      const error = validateMessage(message);
      expect(error?.code).toBe(MessageErrorCode.MISSING_FIELDS);
      expect(error?.message).toBe('Message type is required');
    });

    it('should return error for unknown type', () => {
      const message = {
        type: 'UNKNOWN_TYPE',
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: {}
      };

      const error = validateMessage(message);
      expect(error?.code).toBe(MessageErrorCode.UNKNOWN_TYPE);
      expect(error?.message).toBe('Unknown message type: UNKNOWN_TYPE');
    });

    it('should return error for missing required fields', () => {
      const message = {
        type: MessageType.SESSION_CREATED,
        // missing timestamp, id, payload
      };

      const error = validateMessage(message);
      expect(error?.code).toBe(MessageErrorCode.MISSING_FIELDS);
      expect(error?.message).toContain('Missing required fields');
    });

    it('should return error for invalid payload type', () => {
      const message = {
        type: MessageType.SESSION_CREATED,
        timestamp: '2024-01-01T00:00:00Z',
        id: 'msg-123',
        payload: {
          session: 'invalid-string' // should be object
        }
      };

      const error = validateMessage(message);
      expect(error?.code).toBe(MessageErrorCode.INVALID_PAYLOAD);
      expect(error?.message).toContain('Invalid type for payload.session');
    });
  });

  describe('createMessageError', () => {
    it('should create message error with all fields', () => {
      const originalMessage = { invalid: 'data' };
      const error = createMessageError(
        MessageErrorCode.INVALID_FORMAT,
        'Test error message',
        originalMessage
      );

      expect(error.code).toBe(MessageErrorCode.INVALID_FORMAT);
      expect(error.message).toBe('Test error message');
      expect(error.originalMessage).toBe(originalMessage);
      expect(error.timestamp).toBeDefined();
    });

    it('should create message error without original message', () => {
      const error = createMessageError(
        MessageErrorCode.PROCESSING_ERROR,
        'Processing failed'
      );

      expect(error.code).toBe(MessageErrorCode.PROCESSING_ERROR);
      expect(error.message).toBe('Processing failed');
      expect(error.originalMessage).toBeUndefined();
    });
  });

  describe('createBaseMessage', () => {
    it('should create base message with correct properties', () => {
      const baseMessage = createBaseMessage(MessageType.SESSION_CREATED);

      expect(baseMessage.type).toBe(MessageType.SESSION_CREATED);
      expect(baseMessage.timestamp).toBeDefined();
      expect(baseMessage.id).toBe(mockUUID);
    });

    it('should generate unique IDs for different calls', () => {
      (global.crypto.randomUUID as jest.Mock)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2');

      const message1 = createBaseMessage(MessageType.SESSION_CREATED);
      const message2 = createBaseMessage(MessageType.SESSION_UPDATED);

      expect(message1.id).toBe('uuid-1');
      expect(message2.id).toBe('uuid-2');
    });
  });

  describe('MessageHandlerRegistry', () => {
    let registry: MessageHandlerRegistry;

    beforeEach(() => {
      registry = new MessageHandlerRegistry();
    });

    describe('register', () => {
      it('should register handler for message type', () => {
        const handler = jest.fn();
        registry.register(MessageType.SESSION_CREATED, handler);

        expect(registry.getRegisteredTypes()).toContain(MessageType.SESSION_CREATED);
      });

      it('should register multiple handlers for same type', () => {
        const handler1 = jest.fn();
        const handler2 = jest.fn();

        registry.register(MessageType.SESSION_CREATED, handler1);
        registry.register(MessageType.SESSION_CREATED, handler2);

        expect(registry.getRegisteredTypes()).toContain(MessageType.SESSION_CREATED);
      });
    });

    describe('unregister', () => {
      it('should unregister specific handler', () => {
        const handler1 = jest.fn();
        const handler2 = jest.fn();

        registry.register(MessageType.SESSION_CREATED, handler1);
        registry.register(MessageType.SESSION_CREATED, handler2);
        registry.unregister(MessageType.SESSION_CREATED, handler1);

        // handler2 should still be registered
        expect(registry.getRegisteredTypes()).toContain(MessageType.SESSION_CREATED);
      });

      it('should handle unregistering non-existent handler', () => {
        const handler = jest.fn();
        expect(() => {
          registry.unregister(MessageType.SESSION_CREATED, handler);
        }).not.toThrow();
      });
    });

    describe('processMessage', () => {
      it('should call registered handlers for message type', async () => {
        const handler1 = jest.fn();
        const handler2 = jest.fn();
        const message: SessionCreatedMessage = {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:00:00Z',
          id: 'msg-123',
          payload: { session: { sessionId: 'test-123' } }
        };

        registry.register(MessageType.SESSION_CREATED, handler1);
        registry.register(MessageType.SESSION_CREATED, handler2);

        await registry.processMessage(message);

        expect(handler1).toHaveBeenCalledWith(message);
        expect(handler2).toHaveBeenCalledWith(message);
      });

      it('should not call handlers for other message types', async () => {
        const sessionCreatedHandler = jest.fn();
        const sessionUpdatedHandler = jest.fn();

        registry.register(MessageType.SESSION_CREATED, sessionCreatedHandler);
        registry.register(MessageType.SESSION_UPDATED, sessionUpdatedHandler);

        const message: SessionCreatedMessage = {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:00:00Z',
          id: 'msg-123',
          payload: { session: { sessionId: 'test-123' } }
        };

        await registry.processMessage(message);

        expect(sessionCreatedHandler).toHaveBeenCalled();
        expect(sessionUpdatedHandler).not.toHaveBeenCalled();
      });

      it('should handle async handlers', async () => {
        const asyncHandler = jest.fn().mockResolvedValue(undefined);
        const message: SessionCreatedMessage = {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:00:00Z',
          id: 'msg-123',
          payload: { session: { sessionId: 'test-123' } }
        };

        registry.register(MessageType.SESSION_CREATED, asyncHandler);

        await registry.processMessage(message);

        expect(asyncHandler).toHaveBeenCalledWith(message);
      });

      it('should handle handler errors without stopping other handlers', async () => {
        const errorHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
        const successHandler = jest.fn();
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const message: SessionCreatedMessage = {
          type: MessageType.SESSION_CREATED,
          timestamp: '2024-01-01T00:00:00Z',
          id: 'msg-123',
          payload: { session: { sessionId: 'test-123' } }
        };

        registry.register(MessageType.SESSION_CREATED, errorHandler);
        registry.register(MessageType.SESSION_CREATED, successHandler);

        await registry.processMessage(message);

        expect(errorHandler).toHaveBeenCalled();
        expect(successHandler).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error in message handler'),
          expect.any(Error)
        );

        consoleSpy.mockRestore();
      });
    });

    describe('clearHandlers', () => {
      it('should clear all handlers for specific type', () => {
        const handler = jest.fn();
        registry.register(MessageType.SESSION_CREATED, handler);
        registry.register(MessageType.SESSION_UPDATED, handler);

        registry.clearHandlers(MessageType.SESSION_CREATED);

        expect(registry.getRegisteredTypes()).not.toContain(MessageType.SESSION_CREATED);
        expect(registry.getRegisteredTypes()).toContain(MessageType.SESSION_UPDATED);
      });
    });

    describe('clearAllHandlers', () => {
      it('should clear all handlers', () => {
        const handler = jest.fn();
        registry.register(MessageType.SESSION_CREATED, handler);
        registry.register(MessageType.SESSION_UPDATED, handler);

        registry.clearAllHandlers();

        expect(registry.getRegisteredTypes()).toHaveLength(0);
      });
    });
  });
});