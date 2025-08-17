/**
 * Connection Manager
 * Enhanced wrapper around WebSocketService with connection state management,
 * statistics tracking, and UI integration
 */

import { EventEmitter } from '../utils/event-emitter';
import { WebSocketService } from './websocket-service';
import type { IWebSocketConfig } from '../types/websocket';
import { WebSocketConnectionState } from '../types/websocket';
import { 
  ConnectionState,
  calculateConnectionQuality
} from '../utils/websocket/connection-state';
import type { 
  ConnectionStatistics, 
  ConnectionStateEvent, 
  ConnectionDebugInfo
} from '../utils/websocket/connection-state';

export interface ConnectionManagerEvents {
  'state-changed': ConnectionStateEvent;
  'statistics-updated': ConnectionStatistics;
  'debug-info-updated': ConnectionDebugInfo;
}

export class ConnectionManager {
  private static instance: ConnectionManager | null = null;
  
  private websocketService: WebSocketService | null = null;
  private eventEmitter = new EventEmitter<ConnectionManagerEvents>();
  private config: IWebSocketConfig | null = null;
  
  // Statistics tracking
  private statistics: ConnectionStatistics = {
    uptime: 0,
    reconnectionCount: 0,
    lastConnectTime: null,
    lastDisconnectTime: null,
    averageLatency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    totalDataSent: 0,
    totalDataReceived: 0,
    connectionQuality: 'unknown'
  };
  
  // State tracking
  private currentState: ConnectionState = ConnectionState.DISCONNECTED;
  private stateHistory: ConnectionStateEvent[] = [];
  private connectStartTime: number | null = null;
  private lastHeartbeatTime: number | null = null;
  private lastPongTime: number | null = null;
  private latencyMeasurements: number[] = [];
  
  // Timers
  private statisticsUpdateTimer: number | null = null;
  private uptimeTimer: number | null = null;

  private constructor() {
    this.startStatisticsUpdates();
  }

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /**
   * Initialize connection with WebSocket service
   */
  public async initialize(config: IWebSocketConfig): Promise<void> {
    if (this.websocketService) {
      this.websocketService.destroy();
    }

    this.config = config;
    this.websocketService = WebSocketService.getInstance(config);
    this.setupWebSocketEventHandlers();
    
    // Reset statistics on new initialization
    this.resetStatistics();
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): void {
    if (!this.websocketService) {
      throw new Error('ConnectionManager not initialized. Call initialize() first.');
    }

    this.connectStartTime = Date.now();
    this.websocketService.connect();
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    if (this.websocketService) {
      this.websocketService.disconnect();
    }
  }

  /**
   * Force reconnection
   */
  public forceReconnect(): void {
    if (this.websocketService) {
      this.websocketService.forceReconnect();
    }
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.currentState;
  }

  /**
   * Get current statistics
   */
  public getStatistics(): ConnectionStatistics {
    return { ...this.statistics };
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): ConnectionDebugInfo | null {
    if (!this.websocketService) return null;

    const reconnectionInfo = this.websocketService.getReconnectionInfo();
    const wsState = this.websocketService.getConnectionState();

    // Map WebSocket states to our connection states
    let readyState = 3; // CLOSED by default
    if (wsState === WebSocketConnectionState.CONNECTING) readyState = 0;
    if (wsState === WebSocketConnectionState.CONNECTED) readyState = 1;

    const url = this.config?.url 
      ? (typeof this.config.url === 'function' ? this.config.url() : this.config.url)
      : 'WebSocket URL';

    return {
      url,
      protocols: [],
      readyState,
      bufferedAmount: 0,
      extensions: '',
      protocol: '',
      binaryType: 'blob',
      statistics: this.statistics,
      lastHeartbeat: this.lastHeartbeatTime,
      lastPong: this.lastPongTime,
      reconnectionAttempts: reconnectionInfo.attempt,
      maxReconnectionAttempts: reconnectionInfo.maxAttempts
    };
  }

  /**
   * Subscribe to connection manager events
   */
  public on<K extends keyof ConnectionManagerEvents>(
    event: K,
    handler: (data: ConnectionManagerEvents[K]) => void
  ): () => void {
    return this.eventEmitter.on(event, handler);
  }

  /**
   * Unsubscribe from connection manager events
   */
  public off<K extends keyof ConnectionManagerEvents>(
    event: K,
    handler?: (data: ConnectionManagerEvents[K]) => void
  ): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Send message through WebSocket
   */
  public send(message: any): boolean {
    if (!this.websocketService) return false;

    const success = this.websocketService.send(message);
    if (success) {
      this.statistics.messagesSent++;
      this.statistics.totalDataSent += JSON.stringify(message).length;
      this.updateStatistics();
    }
    return success;
  }

  private setupWebSocketEventHandlers(): void {
    if (!this.websocketService) return;

    // Connection state changes
    this.websocketService.on('state:changed', (event) => {
      this.handleStateChange(event.newState, event.oldState);
    });

    // Connection events
    this.websocketService.on('connection:open', () => {
      this.handleConnectionOpen();
    });

    this.websocketService.on('connection:close', (event) => {
      this.handleConnectionClose(event);
    });

    this.websocketService.on('connection:error', (event) => {
      this.handleConnectionError(event);
    });

    this.websocketService.on('connection:reconnecting', (event) => {
      this.handleReconnecting(event);
    });

    // Message events
    this.websocketService.on('message', (message) => {
      this.handleMessage(message);
    });
  }

  private handleStateChange(newState: WebSocketConnectionState, oldState: WebSocketConnectionState): void {
    const previousConnectionState = this.currentState;
    this.currentState = this.mapWebSocketState(newState);

    const stateEvent: ConnectionStateEvent = {
      previousState: previousConnectionState,
      currentState: this.currentState,
      timestamp: Date.now()
    };

    this.stateHistory.push(stateEvent);
    
    // Keep only last 50 state changes
    if (this.stateHistory.length > 50) {
      this.stateHistory = this.stateHistory.slice(-50);
    }

    this.eventEmitter.emit('state-changed', stateEvent);
  }

  private handleConnectionOpen(): void {
    this.statistics.lastConnectTime = Date.now();
    this.startUptimeTimer();
    
    if (this.connectStartTime) {
      const connectDuration = Date.now() - this.connectStartTime;
      this.addLatencyMeasurement(connectDuration);
    }
  }

  private handleConnectionClose(event: CloseEvent): void {
    this.statistics.lastDisconnectTime = Date.now();
    this.stopUptimeTimer();
  }

  private handleConnectionError(event: Event): void {
    this.statistics.lastDisconnectTime = Date.now();
    this.stopUptimeTimer();
  }

  private handleReconnecting(event: any): void {
    this.statistics.reconnectionCount = event.attempt;
    this.updateStatistics();
  }

  private handleMessage(message: any): void {
    this.statistics.messagesReceived++;
    this.statistics.totalDataReceived += JSON.stringify(message).length;

    // Track heartbeat/pong for latency measurement
    if (message.type === 'heartbeat') {
      this.lastHeartbeatTime = Date.now();
    } else if (message.type === 'pong') {
      this.lastPongTime = Date.now();
      
      if (this.lastHeartbeatTime) {
        const latency = this.lastPongTime - this.lastHeartbeatTime;
        this.addLatencyMeasurement(latency);
      }
    }

    this.updateStatistics();
  }

  private mapWebSocketState(wsState: WebSocketConnectionState): ConnectionState {
    switch (wsState) {
      case WebSocketConnectionState.CONNECTING:
        return ConnectionState.CONNECTING;
      case WebSocketConnectionState.CONNECTED:
        return ConnectionState.CONNECTED;
      case WebSocketConnectionState.RECONNECTING:
        return ConnectionState.RECONNECTING;
      case WebSocketConnectionState.DISCONNECTED:
        return ConnectionState.DISCONNECTED;
      case WebSocketConnectionState.ERROR:
        return ConnectionState.ERROR;
      default:
        return ConnectionState.DISCONNECTED;
    }
  }

  private addLatencyMeasurement(latency: number): void {
    this.latencyMeasurements.push(latency);
    
    // Keep only last 20 measurements for average calculation
    if (this.latencyMeasurements.length > 20) {
      this.latencyMeasurements = this.latencyMeasurements.slice(-20);
    }

    // Calculate average latency
    const sum = this.latencyMeasurements.reduce((acc, val) => acc + val, 0);
    this.statistics.averageLatency = Math.round(sum / this.latencyMeasurements.length);
  }

  private startUptimeTimer(): void {
    this.stopUptimeTimer();
    const startTime = Date.now();
    
    this.uptimeTimer = window.setInterval(() => {
      if (this.currentState === ConnectionState.CONNECTED) {
        this.statistics.uptime = Date.now() - startTime;
        this.updateStatistics();
      }
    }, 1000); // Update every second
  }

  private stopUptimeTimer(): void {
    if (this.uptimeTimer) {
      clearInterval(this.uptimeTimer);
      this.uptimeTimer = null;
    }
  }

  private startStatisticsUpdates(): void {
    this.statisticsUpdateTimer = window.setInterval(() => {
      this.updateStatistics();
    }, 5000); // Update every 5 seconds
  }

  private updateStatistics(): void {
    // Update connection quality
    this.statistics.connectionQuality = calculateConnectionQuality(this.statistics);
    
    // Emit updated statistics
    this.eventEmitter.emit('statistics-updated', { ...this.statistics });
    
    // Emit updated debug info
    const debugInfo = this.getDebugInfo();
    if (debugInfo) {
      this.eventEmitter.emit('debug-info-updated', debugInfo);
    }
  }

  private resetStatistics(): void {
    this.statistics = {
      uptime: 0,
      reconnectionCount: 0,
      lastConnectTime: null,
      lastDisconnectTime: null,
      averageLatency: 0,
      messagesSent: 0,
      messagesReceived: 0,
      totalDataSent: 0,
      totalDataReceived: 0,
      connectionQuality: 'unknown'
    };
    
    this.stateHistory = [];
    this.latencyMeasurements = [];
    this.updateStatistics();
  }

  /**
   * Get connection state history
   */
  public getStateHistory(): ConnectionStateEvent[] {
    return [...this.stateHistory];
  }

  /**
   * Simulate state change for testing purposes
   */
  public simulateStateChange(newState: ConnectionState, reason?: string): void {
    const previousState = this.currentState;
    this.currentState = newState;
    
    const stateEvent: ConnectionStateEvent = {
      currentState: newState,
      previousState,
      timestamp: Date.now(),
      reason: reason || 'Simulated state change'
    };

    this.stateHistory.push(stateEvent);
    
    // Keep only last 50 state changes
    if (this.stateHistory.length > 50) {
      this.stateHistory = this.stateHistory.slice(-50);
    }

    this.eventEmitter.emit('state-changed', stateEvent);
    
    // Update statistics based on state change
    if (newState === ConnectionState.CONNECTED) {
      this.statistics.lastConnectTime = Date.now();
      this.startUptimeTimer();
    } else if (newState === ConnectionState.DISCONNECTED) {
      this.statistics.lastDisconnectTime = Date.now();
      this.stopUptimeTimer();
    } else if (newState === ConnectionState.RECONNECTING) {
      this.statistics.reconnectionCount++;
    }
    
    this.updateStatistics();
  }

  /**
   * Simulate message for testing purposes
   */
  public simulateMessage(message: any): void {
    this.handleMessage(message);
  }

  /**
   * Destroy the connection manager
   */
  public destroy(): void {
    if (this.statisticsUpdateTimer) {
      clearInterval(this.statisticsUpdateTimer);
    }
    
    this.stopUptimeTimer();

    if (this.websocketService) {
      this.websocketService.destroy();
      this.websocketService = null;
    }

    this.eventEmitter.removeAllListeners();
    ConnectionManager.instance = null;
  }
}

// Export singleton getter for convenience
export function getConnectionManager(): ConnectionManager {
  return ConnectionManager.getInstance();
}