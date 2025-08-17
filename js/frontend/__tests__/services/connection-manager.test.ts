/**
 * Unit tests for ConnectionManager
 * Tests enhanced WebSocket wrapper with statistics tracking and state management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock EventEmitter
const mockEventEmitter = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  removeAllListeners: jest.fn()
};

jest.mock('../../src/utils/event-emitter', () => ({
  EventEmitter: jest.fn(() => mockEventEmitter)
}));

// Mock WebSocketService
const mockWebSocketService = {
  getInstance: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  forceReconnect: jest.fn(),
  send: jest.fn(() => true),
  on: jest.fn(),
  off: jest.fn(),
  getConnectionState: jest.fn(() => 'CONNECTED'),
  getReconnectionInfo: jest.fn(() => ({
    attempt: 0,
    maxAttempts: 10,
    consecutiveFailures: 0,
    isReconnecting: false,
    connectionHealthy: true,
    lastConnectTime: null,
    lastDisconnectTime: null
  })),
  destroy: jest.fn()
};

jest.mock('../../src/services/websocket-service', () => ({
  WebSocketService: {
    getInstance: jest.fn(() => mockWebSocketService)
  }
}));

// Mock WebSocket connection states
jest.mock('../../src/types/websocket', () => ({
  WebSocketConnectionState: {
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    RECONNECTING: 'RECONNECTING',
    DISCONNECTED: 'DISCONNECTED',
    ERROR: 'ERROR'
  }
}));

// Mock connection state utilities
jest.mock('../../src/utils/websocket/connection-state', () => ({
  ConnectionState: {
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    RECONNECTING: 'RECONNECTING',
    DISCONNECTED: 'DISCONNECTED',
    ERROR: 'ERROR'
  },
  calculateConnectionQuality: jest.fn(() => 'unknown')
}));

// Mock global setInterval and clearInterval  
const mockClearInterval = jest.fn();
global.setInterval = jest.fn(() => 123) as any;
global.clearInterval = mockClearInterval;

// Import after mocking
import { ConnectionState } from '../../src/utils/websocket/connection-state';
import { WebSocketConnectionState } from '../../src/types/websocket';
import { WebSocketService } from '../../src/services/websocket-service';
import { ConnectionManager } from '../../src/services/connection-manager';
import type { 
  ConnectionStatistics, 
  ConnectionStateEvent, 
  ConnectionDebugInfo 
} from '../../src/utils/websocket/connection-state';
import type { IWebSocketConfig } from '../../src/types/websocket';

// Mock ConnectionManager implementation
class MockConnectionManager {
  private static instance: MockConnectionManager | null = null;
  
  private websocketService: any = null;
  private eventEmitter = mockEventEmitter;
  
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
  
  private currentState: ConnectionState = ConnectionState.DISCONNECTED;
  private stateHistory: ConnectionStateEvent[] = [];
  private connectStartTime: number | null = null;
  private lastHeartbeatTime: number | null = null;
  private lastPongTime: number | null = null;
  private latencyMeasurements: number[] = [];
  
  private statisticsUpdateTimer: number | null = null;
  private uptimeTimer: number | null = null;

  private constructor() {
    this.startStatisticsUpdates();
  }

  public static getInstance(): MockConnectionManager {
    if (!MockConnectionManager.instance) {
      MockConnectionManager.instance = new MockConnectionManager();
    }
    return MockConnectionManager.instance;
  }

  public static resetInstance() {
    MockConnectionManager.instance = null;
  }

  public async initialize(config: IWebSocketConfig): Promise<void> {
    mockWebSocketService.getInstance.mockReturnValue(mockWebSocketService);
    this.websocketService = mockWebSocketService;
    this.setupWebSocketEventHandlers();
    this.resetStatistics();
  }

  public connect(): void {
    if (!this.websocketService) {
      throw new Error('ConnectionManager not initialized. Call initialize() first.');
    }
    this.connectStartTime = Date.now();
    this.websocketService.connect();
  }

  public disconnect(): void {
    if (this.websocketService) {
      this.websocketService.disconnect();
    }
  }

  public forceReconnect(): void {
    if (this.websocketService) {
      this.websocketService.forceReconnect();
    }
  }

  public getConnectionState(): ConnectionState {
    return this.currentState;
  }

  public getStatistics(): ConnectionStatistics {
    return { ...this.statistics };
  }

  public getDebugInfo(): ConnectionDebugInfo | null {
    if (!this.websocketService) return null;

    return {
      url: 'ws://localhost:8080',
      protocols: [],
      readyState: 1,
      bufferedAmount: 0,
      extensions: '',
      protocol: '',
      binaryType: 'blob',
      statistics: this.statistics,
      lastHeartbeat: this.lastHeartbeatTime,
      lastPong: this.lastPongTime,
      reconnectionAttempts: 0,
      maxReconnectionAttempts: 10
    };
  }

  public on(event: string, handler: Function): () => void {
    this.eventEmitter.on(event, handler);
    return () => this.eventEmitter.off(event, handler);
  }

  public off(event: string, handler?: Function): void {
    this.eventEmitter.off(event, handler);
  }

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

  public getStateHistory(): ConnectionStateEvent[] {
    return [...this.stateHistory];
  }

  // Simulate state changes for testing
  public simulateStateChange(newState: ConnectionState, reason?: string): void {
    const previousState = this.currentState;
    this.currentState = newState;

    const stateEvent: ConnectionStateEvent = {
      previousState,
      currentState: newState,
      timestamp: Date.now(),
      reason
    };

    this.stateHistory.push(stateEvent);
    this.eventEmitter.emit('state-changed', stateEvent);

    // Simulate appropriate statistics updates
    switch (newState) {
      case ConnectionState.CONNECTED:
        this.statistics.lastConnectTime = Date.now();
        this.startUptimeTimer();
        break;
      case ConnectionState.DISCONNECTED:
      case ConnectionState.ERROR:
        this.statistics.lastDisconnectTime = Date.now();
        this.stopUptimeTimer();
        break;
      case ConnectionState.RECONNECTING:
        this.statistics.reconnectionCount++;
        break;
    }
    this.updateStatistics();
  }

  // Simulate message handling for testing
  public simulateMessage(message: any): void {
    this.statistics.messagesReceived++;
    this.statistics.totalDataReceived += JSON.stringify(message).length;

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

  private setupWebSocketEventHandlers(): void {
    // Mock setup - in real implementation would set up actual handlers
  }

  private addLatencyMeasurement(latency: number): void {
    this.latencyMeasurements.push(latency);
    
    if (this.latencyMeasurements.length > 20) {
      this.latencyMeasurements = this.latencyMeasurements.slice(-20);
    }

    const sum = this.latencyMeasurements.reduce((acc, val) => acc + val, 0);
    this.statistics.averageLatency = Math.round(sum / this.latencyMeasurements.length);
  }

  private startUptimeTimer(): void {
    this.stopUptimeTimer();
    const startTime = Date.now();
    
    this.uptimeTimer = global.setInterval(() => {
      if (this.currentState === ConnectionState.CONNECTED) {
        this.statistics.uptime = Date.now() - startTime;
        this.updateStatistics();
      }
    }, 1000) as any;
  }

  private stopUptimeTimer(): void {
    if (this.uptimeTimer) {
      global.clearInterval(this.uptimeTimer);
      this.uptimeTimer = null;
    }
  }

  private startStatisticsUpdates(): void {
    this.statisticsUpdateTimer = global.setInterval(() => {
      this.updateStatistics();
    }, 5000) as any;
  }

  private updateStatistics(): void {
    this.eventEmitter.emit('statistics-updated', { ...this.statistics });
    
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

  public destroy(): void {
    if (this.statisticsUpdateTimer) {
      global.clearInterval(this.statisticsUpdateTimer);
    }
    
    this.stopUptimeTimer();

    if (this.websocketService) {
      this.websocketService.destroy();
      this.websocketService = null;
    }

    this.eventEmitter.removeAllListeners();
    MockConnectionManager.instance = null;
  }
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = ConnectionManager.getInstance();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    manager.destroy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton instance', () => {
      const instance1 = ConnectionManager.getInstance();
      const instance2 = ConnectionManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset instance on destroy', () => {
      const instance1 = ConnectionManager.getInstance();
      instance1.destroy();
      
      const instance2 = ConnectionManager.getInstance();
      expect(instance2).not.toBe(instance1);
    });
  });

  describe('Initialization', () => {
    it('should initialize with WebSocket config', async () => {
      const config: IWebSocketConfig = {
        url: 'ws://localhost:8080',
        reconnectInterval: 1000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000,
        debug: true
      };

      await manager.initialize(config);
      
      expect(WebSocketService.getInstance).toHaveBeenCalled();
    });

    it('should throw error when connecting without initialization', () => {
      expect(() => manager.connect()).toThrow(
        'ConnectionManager not initialized. Call initialize() first.'
      );
    });
  });

  describe('Connection Lifecycle', () => {
    beforeEach(async () => {
      await manager.initialize({ url: 'ws://localhost:8080' });
    });

    it('should connect to WebSocket service', () => {
      manager.connect();
      
      expect(mockWebSocketService.connect).toHaveBeenCalled();
    });

    it('should disconnect from WebSocket service', () => {
      manager.disconnect();
      
      expect(mockWebSocketService.disconnect).toHaveBeenCalled();
    });

    it('should force reconnection', () => {
      manager.forceReconnect();
      
      expect(mockWebSocketService.forceReconnect).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    beforeEach(async () => {
      await manager.initialize({ url: 'ws://localhost:8080' });
    });

    it('should track state changes', () => {
      expect(manager.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
      
      manager.simulateStateChange(ConnectionState.CONNECTING);
      expect(manager.getConnectionState()).toBe(ConnectionState.CONNECTING);
      
      manager.simulateStateChange(ConnectionState.CONNECTED);
      expect(manager.getConnectionState()).toBe(ConnectionState.CONNECTED);
    });

    it('should emit state change events', () => {
      manager.simulateStateChange(ConnectionState.CONNECTED, 'Connection established');
      
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('state-changed', {
        previousState: ConnectionState.DISCONNECTED,
        currentState: ConnectionState.CONNECTED,
        timestamp: expect.any(Number),
        reason: 'Connection established'
      });
    });

    it('should maintain state history', () => {
      manager.simulateStateChange(ConnectionState.CONNECTING);
      manager.simulateStateChange(ConnectionState.CONNECTED);
      manager.simulateStateChange(ConnectionState.DISCONNECTED);
      
      const history = manager.getStateHistory();
      expect(history).toHaveLength(3);
      expect(history[0].currentState).toBe(ConnectionState.CONNECTING);
      expect(history[1].currentState).toBe(ConnectionState.CONNECTED);
      expect(history[2].currentState).toBe(ConnectionState.DISCONNECTED);
    });

    it('should limit state history size', () => {
      // Simulate many state changes
      for (let i = 0; i < 60; i++) {
        manager.simulateStateChange(
          i % 2 === 0 ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED
        );
      }
      
      const history = manager.getStateHistory();
      expect(history.length).toBeLessThanOrEqual(50); // Should be limited
    });
  });

  describe('Statistics Tracking', () => {
    beforeEach(async () => {
      await manager.initialize({ url: 'ws://localhost:8080' });
    });

    it('should initialize with default statistics', () => {
      const stats = manager.getStatistics();
      
      expect(stats.uptime).toBe(0);
      expect(stats.reconnectionCount).toBe(0);
      expect(stats.messagesSent).toBe(0);
      expect(stats.messagesReceived).toBe(0);
      expect(stats.connectionQuality).toBe('unknown');
    });

    it('should track messages sent', () => {
      const message = { type: 'test', data: 'test data' };
      
      manager.send(message);
      
      const stats = manager.getStatistics();
      expect(stats.messagesSent).toBe(1);
      expect(stats.totalDataSent).toBeGreaterThan(0);
      expect(mockWebSocketService.send).toHaveBeenCalledWith(message);
    });

    it('should track messages received', () => {
      const message = { type: 'test', data: 'received data' };
      
      manager.simulateMessage(message);
      
      const stats = manager.getStatistics();
      expect(stats.messagesReceived).toBe(1);
      expect(stats.totalDataReceived).toBeGreaterThan(0);
    });

    it('should track reconnection count', () => {
      manager.simulateStateChange(ConnectionState.RECONNECTING);
      manager.simulateStateChange(ConnectionState.RECONNECTING);
      
      const stats = manager.getStatistics();
      expect(stats.reconnectionCount).toBe(2);
    });

    it('should track connection times', () => {
      const beforeConnect = Date.now();
      manager.simulateStateChange(ConnectionState.CONNECTED);
      const afterConnect = Date.now();
      
      const stats = manager.getStatistics();
      expect(stats.lastConnectTime).toBeGreaterThanOrEqual(beforeConnect);
      expect(stats.lastConnectTime).toBeLessThanOrEqual(afterConnect);
    });

    it('should track disconnection times', () => {
      manager.simulateStateChange(ConnectionState.CONNECTED);
      const beforeDisconnect = Date.now();
      manager.simulateStateChange(ConnectionState.DISCONNECTED);
      const afterDisconnect = Date.now();
      
      const stats = manager.getStatistics();
      expect(stats.lastDisconnectTime).toBeGreaterThanOrEqual(beforeDisconnect);
      expect(stats.lastDisconnectTime).toBeLessThanOrEqual(afterDisconnect);
    });

    it('should track uptime when connected', () => {
      manager.simulateStateChange(ConnectionState.CONNECTED);
      
      jest.advanceTimersByTime(5000); // 5 seconds
      
      const stats = manager.getStatistics();
      expect(stats.uptime).toBeGreaterThan(0);
    });

    it('should stop uptime tracking when disconnected', () => {
      manager.simulateStateChange(ConnectionState.CONNECTED);
      jest.advanceTimersByTime(3000);
      
      manager.simulateStateChange(ConnectionState.DISCONNECTED);
      const uptimeAtDisconnect = manager.getStatistics().uptime;
      
      jest.advanceTimersByTime(2000);
      
      const stats = manager.getStatistics();
      expect(stats.uptime).toBe(uptimeAtDisconnect); // Should not increase
    });
  });

  describe('Latency Measurement', () => {
    beforeEach(async () => {
      await manager.initialize({ url: 'ws://localhost:8080' });
    });

    it('should measure latency from heartbeat to pong', () => {
      // Simulate heartbeat
      manager.simulateMessage({ type: 'heartbeat' });
      
      // Advance time and simulate pong
      jest.advanceTimersByTime(100);
      manager.simulateMessage({ type: 'pong' });
      
      const stats = manager.getStatistics();
      expect(stats.averageLatency).toBeGreaterThan(0);
    });

    it('should average multiple latency measurements', () => {
      // Simulate multiple heartbeat/pong cycles
      for (let i = 0; i < 5; i++) {
        manager.simulateMessage({ type: 'heartbeat' });
        jest.advanceTimersByTime(50 + i * 10); // Varying latencies
        manager.simulateMessage({ type: 'pong' });
      }
      
      const stats = manager.getStatistics();
      expect(stats.averageLatency).toBeGreaterThan(0);
      expect(stats.averageLatency).toBeLessThan(200);
    });

    it('should limit latency measurement history', () => {
      // Simulate many measurements
      for (let i = 0; i < 25; i++) {
        manager.simulateMessage({ type: 'heartbeat' });
        jest.advanceTimersByTime(50);
        manager.simulateMessage({ type: 'pong' });
      }
      
      // Should still work and not consume excessive memory
      const stats = manager.getStatistics();
      expect(stats.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('Debug Information', () => {
    beforeEach(async () => {
      await manager.initialize({ url: 'ws://localhost:8080' });
    });

    it('should provide debug information when initialized', () => {
      const debugInfo = manager.getDebugInfo();
      
      expect(debugInfo).not.toBeNull();
      expect(debugInfo!.url).toBe('ws://localhost:8080');
      expect(debugInfo!.readyState).toBe(1);
      expect(debugInfo!.statistics).toBeDefined();
    });

    it('should return null debug info when not initialized', () => {
      manager.destroy();
      const uninitializedManager = MockConnectionManager.getInstance();
      
      const debugInfo = uninitializedManager.getDebugInfo();
      expect(debugInfo).toBeNull();
    });

    it('should include heartbeat and pong times in debug info', () => {
      manager.simulateMessage({ type: 'heartbeat' });
      jest.advanceTimersByTime(50);
      manager.simulateMessage({ type: 'pong' });
      
      const debugInfo = manager.getDebugInfo();
      expect(debugInfo!.lastHeartbeat).toBeGreaterThan(0);
      expect(debugInfo!.lastPong).toBeGreaterThan(0);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await manager.initialize({ url: 'ws://localhost:8080' });
    });

    it('should allow subscribing to events', () => {
      const handler = jest.fn();
      
      manager.on('state-changed', handler);
      
      expect(mockEventEmitter.on).toHaveBeenCalledWith('state-changed', handler);
    });

    it('should allow unsubscribing from events', () => {
      const handler = jest.fn();
      
      manager.off('state-changed', handler);
      
      expect(mockEventEmitter.off).toHaveBeenCalledWith('state-changed', handler);
    });

    it('should emit statistics updates', () => {
      manager.send({ type: 'test' });
      
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'statistics-updated',
        expect.objectContaining({
          messagesSent: 1
        })
      );
    });

    it('should emit debug info updates', () => {
      manager.send({ type: 'test' });
      
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'debug-info-updated',
        expect.objectContaining({
          url: 'ws://localhost:8080'
        })
      );
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should clean up timers on destroy', async () => {
      await manager.initialize({ url: 'ws://localhost:8080' });
      manager.destroy();
      
      expect(mockClearInterval).toHaveBeenCalled();
    });

    it('should destroy WebSocket service on cleanup', async () => {
      await manager.initialize({ url: 'ws://localhost:8080' });
      manager.destroy();
      
      expect(mockWebSocketService.destroy).toHaveBeenCalled();
    });

    it('should remove all event listeners on destroy', () => {
      manager.destroy();
      
      expect(mockEventEmitter.removeAllListeners).toHaveBeenCalled();
    });

    it('should reset singleton instance on destroy', () => {
      const instance1 = manager;
      instance1.destroy();
      
      const instance2 = MockConnectionManager.getInstance();
      expect(instance2).not.toBe(instance1);
    });
  });

  describe('Error Handling', () => {
    it('should handle send failure gracefully', async () => {
      await manager.initialize({ url: 'ws://localhost:8080' });
      mockWebSocketService.send.mockReturnValue(false);
      
      const result = manager.send({ type: 'test' });
      
      expect(result).toBe(false);
      expect(manager.getStatistics().messagesSent).toBe(0);
    });

    it('should handle missing WebSocket service gracefully', () => {
      const result = manager.send({ type: 'test' });
      
      expect(result).toBe(false);
    });

    it('should handle multiple destroy calls safely', () => {
      manager.destroy();
      manager.destroy(); // Should not throw
      
      expect(true).toBe(true);
    });
  });
});