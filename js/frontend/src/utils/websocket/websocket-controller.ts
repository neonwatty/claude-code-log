/**
 * WebSocket Controller for Lit Components
 * Provides reactive property updates when receiving WebSocket messages
 */

import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { getWebSocketService, WebSocketService } from '../../services/websocket-service.js';
import { 
  MessageHandlerRegistry,
  isSessionCreatedMessage,
  isSessionUpdatedMessage,
  isSessionDeletedMessage,
  isCacheInvalidatedMessage,
  type MessageHandler
} from './message-handlers.js';
import type { 
  WebSocketMessage, 
  SessionCreatedMessage, 
  SessionUpdatedMessage, 
  SessionDeletedMessage,
  CacheInvalidatedMessage,
  SessionData
} from './message-types.js';
import { ConnectionState } from './connection-state.js';

/**
 * Configuration options for WebSocket controller
 */
export interface WebSocketControllerConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Debounce delay for rapid updates (ms) */
  debounceMs?: number;
  /** Enable optimistic updates */
  optimisticUpdates?: boolean;
  /** Auto-connect on controller init */
  autoConnect?: boolean;
  /** Message types to subscribe to */
  messageTypes?: Array<'SESSION_CREATED' | 'SESSION_UPDATED' | 'SESSION_DELETED' | 'CACHE_INVALIDATED'>;
}

/**
 * Subscription configuration for specific message handlers
 */
export interface MessageSubscription<T extends WebSocketMessage = WebSocketMessage> {
  messageType: string;
  handler: MessageHandler<T>;
  priority?: number;
}

/**
 * Reactive property update configuration
 */
export interface PropertyUpdate {
  propertyName: string;
  value: any;
  source: 'websocket' | 'optimistic';
  timestamp: number;
}

/**
 * WebSocket Controller Class
 * Implements Lit's ReactiveController interface to manage WebSocket subscriptions
 * and automatically update component properties based on incoming messages
 */
export class WebSocketController implements ReactiveController {
  private host: ReactiveControllerHost;
  private webSocketService: WebSocketService;
  private messageRegistry: MessageHandlerRegistry;
  private config: Required<WebSocketControllerConfig>;
  private subscriptions: MessageSubscription[] = [];
  private unsubscribeFunctions: Array<() => void> = [];
  private debounceTimers: Map<string, number> = new Map();
  private pendingUpdates: Map<string, PropertyUpdate> = new Map();
  private optimisticOperations: Map<string, { originalValue: any; timeout: number }> = new Map();

  constructor(
    host: ReactiveControllerHost,
    webSocketService?: WebSocketService,
    config: WebSocketControllerConfig = {}
  ) {
    this.host = host;
    this.webSocketService = webSocketService || getWebSocketService();
    this.messageRegistry = new MessageHandlerRegistry();
    
    // Set default config
    this.config = {
      debug: false,
      debounceMs: 100,
      optimisticUpdates: true,
      autoConnect: true,
      messageTypes: ['SESSION_CREATED', 'SESSION_UPDATED', 'SESSION_DELETED', 'CACHE_INVALIDATED'],
      ...config
    };

    this.log('WebSocket controller initialized');
    
    // Register with the host
    host.addController(this);
  }

  /**
   * Lit ReactiveController lifecycle - called when host connects to DOM
   */
  hostConnected(): void {
    this.log('Host connected - setting up WebSocket subscriptions');
    this.setupSubscriptions();
    
    if (this.config.autoConnect && !this.webSocketService.isConnected()) {
      this.webSocketService.connect();
    }
  }

  /**
   * Lit ReactiveController lifecycle - called when host disconnects from DOM
   */
  hostDisconnected(): void {
    this.log('Host disconnected - cleaning up subscriptions');
    this.cleanup();
  }

  /**
   * Subscribe to session created messages
   */
  onSessionCreated(handler: (session: SessionData) => void): void {
    this.subscribe('SESSION_CREATED', (message: SessionCreatedMessage) => {
      if (isSessionCreatedMessage(message)) {
        handler(message.payload.session);
      }
    });
  }

  /**
   * Subscribe to session updated messages
   */
  onSessionUpdated(handler: (session: SessionData, changes: SessionUpdatedMessage['payload']['changes']) => void): void {
    this.subscribe('SESSION_UPDATED', (message: SessionUpdatedMessage) => {
      if (isSessionUpdatedMessage(message)) {
        handler(message.payload.session, message.payload.changes);
      }
    });
  }

  /**
   * Subscribe to session deleted messages
   */
  onSessionDeleted(handler: (sessionId: string, deletedAt: string) => void): void {
    this.subscribe('SESSION_DELETED', (message: SessionDeletedMessage) => {
      if (isSessionDeletedMessage(message)) {
        handler(message.payload.sessionId, message.payload.deletedAt);
      }
    });
  }

  /**
   * Subscribe to cache invalidated messages
   */
  onCacheInvalidated(handler: (payload: CacheInvalidatedMessage['payload']) => void): void {
    this.subscribe('CACHE_INVALIDATED', (message: CacheInvalidatedMessage) => {
      if (isCacheInvalidatedMessage(message)) {
        handler(message.payload);
      }
    });
  }

  /**
   * Update a reactive property with debouncing
   */
  updateProperty(propertyName: string, value: any, source: 'websocket' | 'optimistic' = 'websocket'): void {
    const update: PropertyUpdate = {
      propertyName,
      value,
      source,
      timestamp: Date.now()
    };

    this.log(`Updating property ${propertyName}`, update);

    if (this.config.debounceMs > 0) {
      this.debouncedUpdate(update);
    } else {
      this.applyUpdate(update);
    }
  }

  /**
   * Perform optimistic update that can be rolled back
   */
  optimisticUpdate(propertyName: string, newValue: any, rollbackTimeoutMs = 5000): void {
    if (!this.config.optimisticUpdates) {
      this.log('Optimistic updates disabled');
      return;
    }

    const currentValue = (this.host as any)[propertyName];
    
    // Store original value for potential rollback
    if (this.optimisticOperations.has(propertyName)) {
      clearTimeout(this.optimisticOperations.get(propertyName)!.timeout);
    }

    const timeoutId = window.setTimeout(() => {
      this.log(`Optimistic update timeout for ${propertyName} - rolling back`);
      this.rollbackOptimisticUpdate(propertyName);
    }, rollbackTimeoutMs);

    this.optimisticOperations.set(propertyName, {
      originalValue: currentValue,
      timeout: timeoutId
    });

    // Apply optimistic update
    this.updateProperty(propertyName, newValue, 'optimistic');
  }

  /**
   * Confirm an optimistic update (prevents rollback)
   */
  confirmOptimisticUpdate(propertyName: string): void {
    const operation = this.optimisticOperations.get(propertyName);
    if (operation) {
      clearTimeout(operation.timeout);
      this.optimisticOperations.delete(propertyName);
      this.log(`Optimistic update confirmed for ${propertyName}`);
    }
  }

  /**
   * Rollback an optimistic update
   */
  rollbackOptimisticUpdate(propertyName: string): void {
    const operation = this.optimisticOperations.get(propertyName);
    if (operation) {
      clearTimeout(operation.timeout);
      this.updateProperty(propertyName, operation.originalValue, 'websocket');
      this.optimisticOperations.delete(propertyName);
      this.log(`Optimistic update rolled back for ${propertyName}`);
    }
  }

  /**
   * Get WebSocket connection state
   */
  getConnectionState(): ConnectionState {
    // Map WebSocket service states to our connection states
    const serviceState = this.webSocketService.getConnectionState();
    switch (serviceState) {
      case 'CONNECTING':
        return ConnectionState.CONNECTING;
      case 'CONNECTED':
        return ConnectionState.CONNECTED;
      case 'RECONNECTING':
        return ConnectionState.RECONNECTING;
      case 'DISCONNECTED':
        return ConnectionState.DISCONNECTED;
      case 'ERROR':
        return ConnectionState.ERROR;
      default:
        return ConnectionState.DISCONNECTED;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.webSocketService.isConnected();
  }

  /**
   * Force reconnection
   */
  reconnect(): void {
    this.webSocketService.forceReconnect();
  }

  /**
   * Subscribe to a specific message type
   */
  private subscribe<T extends WebSocketMessage>(
    messageType: string,
    handler: MessageHandler<T>,
    priority = 0
  ): void {
    const subscription: MessageSubscription<T> = {
      messageType,
      handler: handler as MessageHandler,
      priority
    };

    this.subscriptions.push(subscription as MessageSubscription);
    this.messageRegistry.register(messageType as any, handler as MessageHandler);
    
    this.log(`Subscribed to message type: ${messageType}`);
  }

  /**
   * Setup WebSocket subscriptions
   */
  private setupSubscriptions(): void {
    // Subscribe to WebSocket service events
    const unsubscribeMessage = this.webSocketService.on('message', (message) => {
      if (message && typeof message === 'object' && 'type' in message) {
        this.messageRegistry.processMessage(message as any);
      } else {
        this.log('Received invalid message, ignoring:', message);
      }
    });

    const unsubscribeStateChange = this.webSocketService.on('state:changed', (stateChange) => {
      this.log('WebSocket state changed', stateChange);
      this.host.requestUpdate();
    });

    const unsubscribeError = this.webSocketService.on('error', (error) => {
      this.log('WebSocket error', error);
      this.host.requestUpdate();
    });

    // Store unsubscribe functions
    this.unsubscribeFunctions.push(
      unsubscribeMessage,
      unsubscribeStateChange,
      unsubscribeError
    );
  }

  /**
   * Apply debounced property update
   */
  private debouncedUpdate(update: PropertyUpdate): void {
    const key = update.propertyName;
    
    // Clear existing timer
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key)!);
    }

    // Store the latest update
    this.pendingUpdates.set(key, update);

    // Set new timer
    const timerId = window.setTimeout(() => {
      const pendingUpdate = this.pendingUpdates.get(key);
      if (pendingUpdate) {
        this.applyUpdate(pendingUpdate);
        this.pendingUpdates.delete(key);
      }
      this.debounceTimers.delete(key);
    }, this.config.debounceMs);

    this.debounceTimers.set(key, timerId);
  }

  /**
   * Apply property update to host component
   */
  private applyUpdate(update: PropertyUpdate): void {
    const { propertyName, value } = update;
    
    // Update the property on the host
    (this.host as any)[propertyName] = value;
    
    // Request update to trigger re-render
    this.host.requestUpdate();
    
    this.log(`Applied update to ${propertyName}:`, value);
  }

  /**
   * Cleanup subscriptions and timers
   */
  private cleanup(): void {
    // Clear all unsubscribe functions
    this.unsubscribeFunctions.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        this.log('Error during unsubscribe:', error);
      }
    });
    this.unsubscribeFunctions = [];

    // Clear all message handlers
    this.messageRegistry.clearAllHandlers();
    this.subscriptions = [];

    // Clear all timers
    this.debounceTimers.forEach(timerId => clearTimeout(timerId));
    this.debounceTimers.clear();
    this.pendingUpdates.clear();

    // Clear optimistic operations
    this.optimisticOperations.forEach(operation => clearTimeout(operation.timeout));
    this.optimisticOperations.clear();

    this.log('Cleanup completed');
  }

  /**
   * Destroy the controller and cleanup resources
   */
  destroy(): void {
    this.cleanup();
    this.log('Controller destroyed');
  }

  /**
   * Debug logging helper
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      if (data !== undefined) {
        console.log(`[WebSocketController] ${message}`, data);
      } else {
        console.log(`[WebSocketController] ${message}`);
      }
    }
  }
}

/**
 * Higher Order Component (HOC) pattern helper
 * Creates a mixin for Lit components that includes WebSocket functionality
 */
export function withWebSocket<T extends new (...args: any[]) => ReactiveControllerHost>(
  Base: T,
  config?: WebSocketControllerConfig
) {
  return class extends Base {
    protected webSocketController: WebSocketController;

    constructor(...args: any[]) {
      super(...args);
      this.webSocketController = new WebSocketController(this, undefined, config);
    }

    /**
     * Convenience method to update properties from WebSocket messages
     */
    protected updateFromWebSocket(propertyName: string, value: any): void {
      this.webSocketController.updateProperty(propertyName, value);
    }

    /**
     * Convenience method for optimistic updates
     */
    protected optimisticUpdate(propertyName: string, value: any, timeoutMs?: number): void {
      this.webSocketController.optimisticUpdate(propertyName, value, timeoutMs);
    }

    /**
     * Convenience method to confirm optimistic updates
     */
    protected confirmOptimisticUpdate(propertyName: string): void {
      this.webSocketController.confirmOptimisticUpdate(propertyName);
    }

    /**
     * Get WebSocket connection state
     */
    protected getWebSocketState(): ConnectionState {
      return this.webSocketController.getConnectionState();
    }

    /**
     * Check if WebSocket is connected
     */
    protected isWebSocketConnected(): boolean {
      return this.webSocketController.isConnected();
    }
  };
}

/**
 * Decorator for automatically subscribing to WebSocket messages
 * Usage: @webSocketProperty('sessions', 'SESSION_CREATED')
 */
export function webSocketProperty(propertyName: string, messageType: string) {
  return function <T extends { webSocketController: WebSocketController }>(
    target: T,
    propertyKey: string | symbol,
    descriptor?: PropertyDescriptor
  ) {
    // This would be implemented as a property decorator in a full implementation
    // For now, it serves as a marker for future enhancement
  };
}