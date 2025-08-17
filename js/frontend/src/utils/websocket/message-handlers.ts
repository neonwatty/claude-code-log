/**
 * WebSocket message serialization, deserialization, and handling utilities
 */

import { 
  WebSocketMessage, 
  MessageType, 
  MESSAGE_SCHEMAS, 
  MessageError, 
  MessageErrorCode,
  BaseMessage
} from './message-types';

/**
 * Serializes a WebSocket message to JSON string
 */
export function serializeMessage(message: WebSocketMessage): string {
  try {
    return JSON.stringify(message);
  } catch (error) {
    throw new Error(`Failed to serialize message: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Deserializes a JSON string to a WebSocket message
 */
export function deserializeMessage(data: string): WebSocketMessage {
  try {
    const parsed = JSON.parse(data);
    
    if (!isValidMessage(parsed)) {
      throw new Error('Invalid message format');
    }
    
    return parsed as WebSocketMessage;
  } catch (error) {
    throw new Error(`Failed to deserialize message: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Type guard to check if an object is a valid WebSocket message
 */
export function isValidMessage(obj: unknown): obj is WebSocketMessage {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const message = obj as Record<string, unknown>;

  // Check if type is valid
  if (!Object.values(MessageType).includes(message.type as MessageType)) {
    return false;
  }

  const messageType = message.type as MessageType;
  const schema = MESSAGE_SCHEMAS[messageType];

  // Check required fields
  for (const field of schema.requiredFields) {
    if (!(field in message)) {
      return false;
    }
  }

  // Basic type validation for payload
  if (message.payload && typeof message.payload === 'object') {
    const payload = message.payload as Record<string, unknown>;
    
    for (const [field, expectedType] of Object.entries(schema.payloadSchema)) {
      if (field in payload) {
        const actualType = typeof payload[field];
        if (expectedType === 'object' && payload[field] !== null && actualType !== 'object') {
          return false;
        } else if (expectedType !== 'object' && actualType !== expectedType) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Type guards for specific message types
 */
export function isSessionCreatedMessage(message: WebSocketMessage): message is import('./message-types').SessionCreatedMessage {
  return message.type === MessageType.SESSION_CREATED;
}

export function isSessionUpdatedMessage(message: WebSocketMessage): message is import('./message-types').SessionUpdatedMessage {
  return message.type === MessageType.SESSION_UPDATED;
}

export function isSessionDeletedMessage(message: WebSocketMessage): message is import('./message-types').SessionDeletedMessage {
  return message.type === MessageType.SESSION_DELETED;
}

export function isCacheInvalidatedMessage(message: WebSocketMessage): message is import('./message-types').CacheInvalidatedMessage {
  return message.type === MessageType.CACHE_INVALIDATED;
}

/**
 * Validates a message and returns validation errors if any
 */
export function validateMessage(obj: unknown): MessageError | null {
  const timestamp = new Date().toISOString();

  if (!obj || typeof obj !== 'object') {
    return {
      code: MessageErrorCode.INVALID_FORMAT,
      message: 'Message must be an object',
      originalMessage: obj,
      timestamp
    };
  }

  const message = obj as Record<string, unknown>;

  // Check if type exists and is valid
  if (!message.type) {
    return {
      code: MessageErrorCode.MISSING_FIELDS,
      message: 'Message type is required',
      originalMessage: obj,
      timestamp
    };
  }

  if (!Object.values(MessageType).includes(message.type as MessageType)) {
    return {
      code: MessageErrorCode.UNKNOWN_TYPE,
      message: `Unknown message type: ${message.type}`,
      originalMessage: obj,
      timestamp
    };
  }

  const messageType = message.type as MessageType;
  const schema = MESSAGE_SCHEMAS[messageType];

  // Check required fields
  const missingFields = schema.requiredFields.filter(field => !(field in message));
  if (missingFields.length > 0) {
    return {
      code: MessageErrorCode.MISSING_FIELDS,
      message: `Missing required fields: ${missingFields.join(', ')}`,
      originalMessage: obj,
      timestamp
    };
  }

  // Validate payload structure
  if (message.payload && typeof message.payload === 'object') {
    const payload = message.payload as Record<string, unknown>;
    
    for (const [field, expectedType] of Object.entries(schema.payloadSchema)) {
      if (field in payload) {
        const actualType = typeof payload[field];
        const isValidType = expectedType === 'object' 
          ? payload[field] !== null && actualType === 'object'
          : actualType === expectedType;
          
        if (!isValidType) {
          return {
            code: MessageErrorCode.INVALID_PAYLOAD,
            message: `Invalid type for payload.${field}: expected ${expectedType}, got ${actualType}`,
            originalMessage: obj,
            timestamp
          };
        }
      }
    }
  }

  return null; // No errors
}

/**
 * Creates a standardized message error
 */
export function createMessageError(
  code: MessageErrorCode,
  message: string,
  originalMessage?: unknown
): MessageError {
  return {
    code,
    message,
    originalMessage,
    timestamp: new Date().toISOString()
  };
}

/**
 * Utility to create base message properties
 */
export function createBaseMessage(type: MessageType): BaseMessage {
  return {
    type,
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID()
  };
}

/**
 * Message handler registry type
 */
export type MessageHandler<T extends WebSocketMessage = WebSocketMessage> = (message: T) => void | Promise<void>;

/**
 * Message handler registry for organizing message processing
 */
export class MessageHandlerRegistry {
  private handlers: Map<MessageType, MessageHandler[]> = new Map();

  /**
   * Register a handler for a specific message type
   */
  register<T extends WebSocketMessage>(
    type: MessageType,
    handler: MessageHandler<T>
  ): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler as MessageHandler);
  }

  /**
   * Unregister a handler for a specific message type
   */
  unregister(type: MessageType, handler: MessageHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Process a message through registered handlers
   */
  async processMessage(message: WebSocketMessage): Promise<void> {
    const handlers = this.handlers.get(message.type) || [];
    
    // Execute all handlers for this message type
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(message);
        } catch (error) {
          console.error(`Error in message handler for ${message.type}:`, error);
          // Don't throw - we want other handlers to continue processing
        }
      })
    );
  }

  /**
   * Get all registered message types
   */
  getRegisteredTypes(): MessageType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all handlers for a specific type
   */
  clearHandlers(type: MessageType): void {
    this.handlers.delete(type);
  }

  /**
   * Clear all handlers
   */
  clearAllHandlers(): void {
    this.handlers.clear();
  }
}