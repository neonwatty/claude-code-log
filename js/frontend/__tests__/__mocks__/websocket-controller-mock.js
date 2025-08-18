// Mock for WebSocketController

class MockWebSocketController {
  constructor(host, webSocketService, config = {}) {
    this.host = host;
    this.webSocketService = webSocketService;
    this.config = config;
    this._handlers = new Map();
    
    // Mock addController on host
    if (host && host.addController) {
      host.addController(this);
    }
  }

  hostConnected() {
    // Mock host connected lifecycle
  }

  hostDisconnected() {
    // Mock host disconnected lifecycle
  }

  onSessionCreated(handler) {
    this._handlers.set('SESSION_CREATED', handler);
  }

  onSessionUpdated(handler) {
    this._handlers.set('SESSION_UPDATED', handler);
  }

  onSessionDeleted(handler) {
    this._handlers.set('SESSION_DELETED', handler);
  }

  onCacheInvalidated(handler) {
    this._handlers.set('CACHE_INVALIDATED', handler);
  }

  getConnectionState() {
    return this.webSocketService?.getConnectionState() || 'DISCONNECTED';
  }

  isConnected() {
    return this.webSocketService?.isConnected() || false;
  }

  reconnect() {
    this.webSocketService?.forceReconnect();
  }

  optimisticUpdate(propertyName, value, timeoutMs) {
    // Mock optimistic update
  }

  confirmOptimisticUpdate(propertyName) {
    // Mock confirm optimistic update
  }

  updateProperty(propertyName, value) {
    // Mock update property
  }

  // Simulate message processing for tests
  simulateMessage(message) {
    const handler = this._handlers.get(message.type);
    if (handler) {
      handler(message);
    }
  }
}

module.exports = { WebSocketController: MockWebSocketController };