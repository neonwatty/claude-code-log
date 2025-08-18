// Mock for message handlers

class MockMessageHandlerRegistry {
  constructor() {
    this.handlers = new Map();
  }

  register(messageType, handler) {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, []);
    }
    this.handlers.get(messageType).push(handler);
  }

  processMessage(message) {
    const handlers = this.handlers.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Handler error:', error);
      }
    });
  }

  clearAllHandlers() {
    this.handlers.clear();
  }
}

// Mock serialization functions
const serializeMessage = (message) => JSON.stringify(message);
const deserializeMessage = (data) => JSON.parse(data);

// Mock type guard functions
const isSessionCreatedMessage = (message) => message?.type === 'SESSION_CREATED';
const isSessionUpdatedMessage = (message) => message?.type === 'SESSION_UPDATED';
const isSessionDeletedMessage = (message) => message?.type === 'SESSION_DELETED';
const isCacheInvalidatedMessage = (message) => message?.type === 'CACHE_INVALIDATED';

module.exports = {
  MessageHandlerRegistry: MockMessageHandlerRegistry,
  serializeMessage,
  deserializeMessage,
  isSessionCreatedMessage,
  isSessionUpdatedMessage,
  isSessionDeletedMessage,
  isCacheInvalidatedMessage
};