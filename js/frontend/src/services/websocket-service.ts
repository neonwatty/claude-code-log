/**
 * WebSocket Service - Centralized WebSocket client for real-time communication
 * Implements singleton pattern for single instance management across the application
 */

import { EventEmitter } from '../utils/event-emitter';
import {
  IWebSocketConfig,
  IWebSocketEventMap,
  WebSocketConnectionState,
  WebSocketEventMessage,
  WebSocketMessageType,
  IHeartbeatMessage,
  IConnectMessage,
  ISessionCreatedMessage,
  ISessionUpdatedMessage,
  ISessionDeletedMessage,
  IProjectUpdatedMessage,
  IFileChangedMessage,
  IErrorMessage
} from '../types/websocket';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<IWebSocketConfig> = {
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
  connectionTimeout: 10000,
  debug: false
};

/**
 * WebSocket Service Class
 * Manages WebSocket connections, reconnection logic, and message distribution
 */
export class WebSocketService {
  private static instance: WebSocketService | null = null;
  
  private socket: WebSocket | null = null;
  private config: IWebSocketConfig;
  private eventEmitter: EventEmitter<IWebSocketEventMap>;
  private connectionState: WebSocketConnectionState = WebSocketConnectionState.DISCONNECTED;
  
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private connectionTimer: number | null = null;
  
  private clientId: string | null = null;
  private messageQueue: WebSocketEventMessage[] = [];
  private isIntentionalDisconnect = false;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(config: IWebSocketConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventEmitter = new EventEmitter<IWebSocketEventMap>();
    
    if (this.config.debug) {
      console.log('[WebSocketService] Initialized with config:', this.config);
    }
  }

  /**
   * Get singleton instance of WebSocketService
   */
  public static getInstance(config?: IWebSocketConfig): WebSocketService {
    if (!WebSocketService.instance) {
      if (!config) {
        throw new Error('WebSocketService requires configuration on first initialization');
      }
      WebSocketService.instance = new WebSocketService(config);
    } else if (config && WebSocketService.instance) {
      // Update configuration if provided
      WebSocketService.instance.config = { ...DEFAULT_CONFIG, ...config };
    }
    
    return WebSocketService.instance;
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.log('Already connected');
      return;
    }

    if (this.socket?.readyState === WebSocket.CONNECTING) {
      this.log('Connection already in progress');
      return;
    }

    this.isIntentionalDisconnect = false;
    this.createConnection();
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.isIntentionalDisconnect = true;
    this.cleanup();
    
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    
    this.updateConnectionState(WebSocketConnectionState.DISCONNECTED);
  }

  /**
   * Send a message through WebSocket
   */
  public send(message: WebSocketEventMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.log('Cannot send message - not connected', 'warn');
      this.messageQueue.push(message);
      return false;
    }

    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.log(`Failed to send message: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Subscribe to WebSocket events
   */
  public on<K extends keyof IWebSocketEventMap>(
    event: K,
    handler: (data: IWebSocketEventMap[K]) => void
  ): () => void {
    return this.eventEmitter.on(event, handler);
  }

  /**
   * Subscribe to an event once
   */
  public once<K extends keyof IWebSocketEventMap>(
    event: K,
    handler: (data: IWebSocketEventMap[K]) => void
  ): () => void {
    return this.eventEmitter.once(event, handler);
  }

  /**
   * Unsubscribe from WebSocket events
   */
  public off<K extends keyof IWebSocketEventMap>(
    event: K,
    handler?: (data: IWebSocketEventMap[K]) => void
  ): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): WebSocketConnectionState {
    return this.connectionState;
  }

  /**
   * Get client ID assigned by server
   */
  public getClientId(): string | null {
    return this.clientId;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connectionState === WebSocketConnectionState.CONNECTED;
  }

  /**
   * Create WebSocket connection
   */
  private createConnection(): void {
    try {
      const url = typeof this.config.url === 'function' 
        ? this.config.url() 
        : this.config.url;

      this.updateConnectionState(WebSocketConnectionState.CONNECTING);
      
      this.socket = new WebSocket(url, this.config.protocols);
      this.setupEventHandlers();
      this.startConnectionTimeout();
      
      this.log(`Connecting to ${url}...`);
    } catch (error) {
      this.log(`Failed to create connection: ${error}`, 'error');
      this.handleConnectionError(error as Error);
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.addEventListener('open', this.handleOpen.bind(this));
    this.socket.addEventListener('close', this.handleClose.bind(this));
    this.socket.addEventListener('error', this.handleError.bind(this));
    this.socket.addEventListener('message', this.handleMessage.bind(this));
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(event: Event): void {
    this.log('Connection established');
    
    this.clearConnectionTimeout();
    this.reconnectAttempt = 0;
    this.updateConnectionState(WebSocketConnectionState.CONNECTED);
    
    this.startHeartbeat();
    this.flushMessageQueue();
    
    this.eventEmitter.emit('connection:open', event);
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    this.log(`Connection closed - Code: ${event.code}, Reason: ${event.reason}`);
    
    this.cleanup();
    this.updateConnectionState(WebSocketConnectionState.DISCONNECTED);
    
    this.eventEmitter.emit('connection:close', event);
    
    // Attempt reconnection if not intentional disconnect
    if (!this.isIntentionalDisconnect && 
        this.reconnectAttempt < (this.config.maxReconnectAttempts || 10)) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    this.log('Connection error occurred', 'error');
    
    this.updateConnectionState(WebSocketConnectionState.ERROR);
    this.eventEmitter.emit('connection:error', event);
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as WebSocketEventMessage;
      
      // Validate message format
      if (!message || typeof message !== 'object' || !message.type) {
        this.eventEmitter.emit('error', { message: 'Invalid message format' });
        return;
      }
      
      // Check for unknown message types (including legacy formats)
      const legacyTypes = ['session_created', 'session_updated', 'session_deleted'];
      const newTypes = ['SESSION_CREATED', 'SESSION_UPDATED', 'SESSION_DELETED', 'CACHE_INVALIDATED'];
      
      if (!Object.values(WebSocketMessageType).includes(message.type as WebSocketMessageType) &&
          !newTypes.includes(message.type) &&
          !legacyTypes.includes(message.type)) {
        this.eventEmitter.emit('error', { message: `Unknown message type: ${message.type}` });
        return;
      }
      
      if (this.config.debug) {
        this.log(`Received message: ${message.type}`);
      }
      
      // Process specific message types
      this.processMessage(message);
      
      // Emit raw message event
      this.eventEmitter.emit('message', message);
      
    } catch (error) {
      this.log(`Failed to parse message: ${error}`, 'error');
      this.eventEmitter.emit('error', { message: `Failed to parse message: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  }

  /**
   * Process specific message types
   */
  private processMessage(message: any): void {
    switch (message.type) {
      // Legacy format handling
      case 'session_created':
        const legacySessionCreated = message as any;
        this.eventEmitter.emit('session:created', legacySessionCreated.data);
        break;

      case 'session_updated':
        const legacySessionUpdated = message as any;
        this.eventEmitter.emit('session:updated', legacySessionUpdated.data);
        break;

      case 'session_deleted':
        const legacySessionDeleted = message as any;
        this.eventEmitter.emit('session:deleted', legacySessionDeleted.data);
        break;
      case WebSocketMessageType.CONNECT:
        const connectMsg = message as IConnectMessage;
        this.clientId = connectMsg.data.clientId;
        this.log(`Assigned client ID: ${this.clientId}`);
        break;

      case WebSocketMessageType.HEARTBEAT:
        // Respond with PONG
        this.sendPong();
        break;

      case WebSocketMessageType.SESSION_CREATED:
        const sessionCreated = message as ISessionCreatedMessage;
        // Handle both legacy format (.data) and new format (.payload)
        const sessionCreatedData = (sessionCreated as any).payload ? 
          (sessionCreated as any).payload.session : sessionCreated.data;
        this.eventEmitter.emit('session:created', sessionCreatedData);
        break;

      case WebSocketMessageType.SESSION_UPDATED:
        const sessionUpdated = message as ISessionUpdatedMessage;
        // Handle both legacy format (.data) and new format (.payload)
        const sessionUpdatedData = (sessionUpdated as any).payload ? 
          { ...(sessionUpdated as any).payload.session, changes: (sessionUpdated as any).payload.changes } : 
          sessionUpdated.data;
        this.eventEmitter.emit('session:updated', sessionUpdatedData);
        break;

      case WebSocketMessageType.SESSION_DELETED:
        const sessionDeleted = message as ISessionDeletedMessage;
        // Handle both legacy format (.data) and new format (.payload)
        const sessionDeletedData = (sessionDeleted as any).payload || sessionDeleted.data;
        this.eventEmitter.emit('session:deleted', sessionDeletedData);
        break;

      case WebSocketMessageType.PROJECT_UPDATED:
        const projectUpdated = message as IProjectUpdatedMessage;
        this.eventEmitter.emit('project:updated', projectUpdated.data);
        break;

      case WebSocketMessageType.FILE_CHANGED:
        const fileChanged = message as IFileChangedMessage;
        this.eventEmitter.emit('file:changed', fileChanged.data);
        break;

      case WebSocketMessageType.CACHE_INVALIDATED:
        const cacheInvalidated = message as any;
        // Handle both legacy format (.data) and new format (.payload)
        const cacheInvalidatedData = cacheInvalidated.payload || cacheInvalidated.data;
        this.eventEmitter.emit('cache:invalidated', cacheInvalidatedData);
        break;

      case WebSocketMessageType.ERROR:
        const errorMsg = message as IErrorMessage;
        this.eventEmitter.emit('error', errorMsg.data);
        break;
    }
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = window.setInterval(() => {
      if (this.isConnected()) {
        this.sendHeartbeat();
      }
    }, this.config.heartbeatInterval || 30000);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send heartbeat message
   */
  private sendHeartbeat(): void {
    const heartbeat: IHeartbeatMessage = {
      type: WebSocketMessageType.HEARTBEAT,
      timestamp: new Date().toISOString()
    };
    
    this.send(heartbeat);
  }

  /**
   * Send pong response
   */
  private sendPong(): void {
    const pong: WebSocketEventMessage = {
      type: WebSocketMessageType.PONG,
      timestamp: new Date().toISOString()
    };
    
    this.send(pong);
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectAttempt++;
    const delay = Math.min(
      this.config.reconnectInterval! * Math.pow(1.5, this.reconnectAttempt - 1),
      30000 // Max 30 seconds
    );
    
    this.log(`Scheduling reconnection attempt ${this.reconnectAttempt} in ${delay}ms`);
    
    this.updateConnectionState(WebSocketConnectionState.RECONNECTING);
    this.eventEmitter.emit('connection:reconnecting', {
      attempt: this.reconnectAttempt,
      maxAttempts: this.config.maxReconnectAttempts!
    });
    
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.createConnection();
    }, delay);
  }

  /**
   * Start connection timeout
   */
  private startConnectionTimeout(): void {
    this.clearConnectionTimeout();
    
    this.connectionTimer = window.setTimeout(() => {
      if (this.socket?.readyState === WebSocket.CONNECTING) {
        this.log('Connection timeout', 'error');
        this.socket.close();
        this.handleConnectionError(new Error('Connection timeout'));
      }
    }, this.config.connectionTimeout || 10000);
  }

  /**
   * Clear connection timeout
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(error: Error): void {
    this.cleanup();
    
    // Connection timeouts should result in disconnected state, not error
    if (error.message.includes('timeout')) {
      this.updateConnectionState(WebSocketConnectionState.DISCONNECTED);
    } else {
      this.updateConnectionState(WebSocketConnectionState.ERROR);
    }
    
    if (!this.isIntentionalDisconnect && 
        !error.message.includes('timeout') &&
        this.reconnectAttempt < (this.config.maxReconnectAttempts || 10)) {
      this.scheduleReconnect();
    }
  }

  /**
   * Update connection state and emit event
   */
  private updateConnectionState(newState: WebSocketConnectionState): void {
    const oldState = this.connectionState;
    
    if (oldState === newState) return;
    
    this.connectionState = newState;
    this.log(`State changed: ${oldState} -> ${newState}`);
    
    this.eventEmitter.emit('state:changed', { oldState, newState });
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;
    
    this.log(`Flushing ${this.messageQueue.length} queued messages`);
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  /**
   * Cleanup timers and resources
   */
  private cleanup(): void {
    this.stopHeartbeat();
    this.clearConnectionTimeout();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Log helper
   */
  private log(message: string, level: 'log' | 'warn' | 'error' = 'log'): void {
    if (this.config.debug) {
      console[level](`[WebSocketService] ${message}`);
    }
  }

  /**
   * Destroy the service and clean up
   */
  public destroy(): void {
    this.disconnect();
    this.eventEmitter.removeAllListeners();
    WebSocketService.instance = null;
  }
}

/**
 * Export singleton getter for convenience
 */
export function getWebSocketService(config?: IWebSocketConfig): WebSocketService {
  return WebSocketService.getInstance(config);
}