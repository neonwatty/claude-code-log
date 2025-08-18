/**
 * Test setup and configuration for WebSocket Lit integration tests
 * Provides shared mocks, utilities, and test data
 */

import { jest, describe, it, expect } from '@jest/globals';

// Mock WebSocket in the global scope for all tests
export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocol: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private eventListeners: Map<string, Function[]> = new Map();

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocol = Array.isArray(protocols) ? protocols[0] || '' : protocols || '';
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event('open'));
    }, 10);
  }

  addEventListener(type: string, listener: Function): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: Function): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(listener => listener(event));

    // Also call legacy event handlers
    switch (event.type) {
      case 'open':
        this.onopen?.(event);
        break;
      case 'close':
        this.onclose?.(event as CloseEvent);
        break;
      case 'error':
        this.onerror?.(event);
        break;
      case 'message':
        this.onmessage?.(event as MessageEvent);
        break;
    }

    return true;
  }

  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // In tests, we'll simulate the response elsewhere
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      const closeEvent = new CloseEvent('close', { code: code || 1000, reason: reason || '' });
      this.dispatchEvent(closeEvent);
    }, 10);
  }

  // Test utilities
  simulateMessage(data: any): void {
    if (this.readyState === MockWebSocket.OPEN) {
      const messageEvent = new MessageEvent('message', { data: JSON.stringify(data) });
      this.dispatchEvent(messageEvent);
    }
  }

  simulateError(): void {
    const errorEvent = new Event('error');
    this.dispatchEvent(errorEvent);
  }

  simulateClose(code = 1000, reason = ''): void {
    this.close(code, reason);
  }
}

// Mock crypto.randomUUID for consistent test UUIDs
let uuidCounter = 0;
export const mockUUID = () => `test-uuid-${++uuidCounter}`;

// Test data factories
export const createTestSessionData = (overrides: Partial<any> = {}) => ({
  sessionId: `test-session-${Date.now()}`,
  title: 'Test Session',
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-01T10:00:00Z',
  status: 'active',
  ...overrides
});

export const createTestSessionCreatedMessage = (sessionData?: any) => ({
  type: 'SESSION_CREATED',
  timestamp: '2024-01-01T10:00:00Z',
  id: mockUUID(),
  payload: {
    session: sessionData || createTestSessionData()
  }
});

export const createTestSessionUpdatedMessage = (sessionData?: any, changes?: any) => ({
  type: 'SESSION_UPDATED',
  timestamp: '2024-01-01T10:00:00Z',
  id: mockUUID(),
  payload: {
    session: sessionData || createTestSessionData(),
    changes: changes || {
      fields: ['title'],
      previousValues: { title: 'Previous Title' }
    }
  }
});

export const createTestSessionDeletedMessage = (sessionId?: string) => ({
  type: 'SESSION_DELETED',
  timestamp: '2024-01-01T10:00:00Z',
  id: mockUUID(),
  payload: {
    sessionId: sessionId || 'test-session-id',
    deletedAt: '2024-01-01T10:00:00Z'
  }
});

export const createTestCacheInvalidatedMessage = (scope = 'all', sessionIds?: string[]) => ({
  type: 'CACHE_INVALIDATED',
  timestamp: '2024-01-01T10:00:00Z',
  id: mockUUID(),
  payload: {
    scope,
    sessionIds,
    reason: 'test invalidation'
  }
});

// Setup global mocks
export function setupWebSocketMocks() {
  // Mock WebSocket
  Object.defineProperty(global, 'WebSocket', {
    value: MockWebSocket,
    writable: true
  });

  // Mock crypto.randomUUID
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: mockUUID
    },
    writable: true
  });

  // Mock performance.now for consistent timing
  Object.defineProperty(global, 'performance', {
    value: {
      now: jest.fn(() => Date.now())
    },
    writable: true
  });

  // Mock console methods to reduce test noise
  const consoleMethods = ['log', 'warn', 'error', 'info', 'debug'];
  consoleMethods.forEach(method => {
    jest.spyOn(console, method as any).mockImplementation(() => {});
  });
}

// Cleanup function
export function cleanupWebSocketMocks() {
  jest.restoreAllMocks();
  uuidCounter = 0;
}

// Test utilities for async operations
export function waitForNextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export function waitForTime(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mock reactive controller host for standalone controller tests
export class MockReactiveControllerHost {
  private controllers = new Set<any>();
  public updateCallCount = 0;

  addController(controller: any): void {
    this.controllers.add(controller);
    if (controller.hostConnected) {
      controller.hostConnected();
    }
  }

  removeController(controller: any): void {
    if (controller.hostDisconnected) {
      controller.hostDisconnected();
    }
    this.controllers.delete(controller);
  }

  requestUpdate(name?: PropertyKey, oldValue?: unknown, options?: any): Promise<boolean> {
    this.updateCallCount++;
    return Promise.resolve(true);
  }

  get updateComplete(): Promise<boolean> {
    return Promise.resolve(true);
  }

  // Test utilities
  getAllControllers(): any[] {
    return Array.from(this.controllers);
  }

  disconnectAllControllers(): void {
    this.controllers.forEach(controller => {
      if (controller.hostDisconnected) {
        controller.hostDisconnected();
      }
    });
  }
}

// Performance test utilities
export class PerformanceMonitor {
  private startTime = 0;
  private measurements: number[] = [];

  start(): void {
    this.startTime = performance.now();
  }

  end(): number {
    const duration = performance.now() - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  getAverage(): number {
    if (this.measurements.length === 0) return 0;
    return this.measurements.reduce((sum, duration) => sum + duration, 0) / this.measurements.length;
  }

  getMax(): number {
    return Math.max(...this.measurements);
  }

  getMin(): number {
    return Math.min(...this.measurements);
  }

  reset(): void {
    this.measurements = [];
    this.startTime = 0;
  }
}

// Memory usage utilities
export function getApproximateMemoryUsage(): number {
  // Simple heuristic for testing - in real scenarios you'd use more sophisticated methods
  return performance.now(); // Placeholder
}

export function simulateMemoryPressure(iterations = 1000): void {
  // Create and destroy objects to simulate memory pressure
  const objects: any[] = [];
  for (let i = 0; i < iterations; i++) {
    objects.push({ data: new Array(100).fill(Math.random()) });
  }
  // Let GC clean up
  objects.length = 0;
}

// Assertion helpers
export function expectEventually(
  condition: () => boolean,
  timeout = 1000,
  interval = 10
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function check() {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Condition not met within ${timeout}ms`));
      } else {
        setTimeout(check, interval);
      }
    }
    
    check();
  });
}

// Export default setup for easy import
export default {
  setupWebSocketMocks,
  cleanupWebSocketMocks,
  MockWebSocket,
  MockReactiveControllerHost,
  PerformanceMonitor,
  createTestSessionData,
  createTestSessionCreatedMessage,
  createTestSessionUpdatedMessage,
  createTestSessionDeletedMessage,
  createTestCacheInvalidatedMessage,
  waitForNextTick,
  waitForTime,
  expectEventually
};

// Basic tests to verify utilities work correctly
describe('WebSocket Test Setup Utilities', () => {
  it('should create test session data with defaults', () => {
    const sessionData = createTestSessionData();
    expect(sessionData.title).toBe('Test Session');
    expect(sessionData.status).toBe('active');
    expect(sessionData.sessionId).toMatch(/test-session-/);
  });

  it('should create test session data with overrides', () => {
    const sessionData = createTestSessionData({ title: 'Custom Title', status: 'inactive' });
    expect(sessionData.title).toBe('Custom Title');
    expect(sessionData.status).toBe('inactive');
  });

  it('should create mock UUID consistently', () => {
    const uuid1 = mockUUID();
    const uuid2 = mockUUID();
    expect(uuid1).toMatch(/test-uuid-/);
    expect(uuid2).toMatch(/test-uuid-/);
    expect(uuid1).not.toBe(uuid2);
  });

  it('should create MockWebSocket with proper initial state', () => {
    const ws = new MockWebSocket('ws://test.com');
    expect(ws.url).toBe('ws://test.com');
    expect(ws.readyState).toBe(MockWebSocket.CONNECTING);
  });

  it('should create MockReactiveControllerHost with update tracking', () => {
    const host = new MockReactiveControllerHost();
    expect(host.updateCallCount).toBe(0);
    
    host.requestUpdate();
    expect(host.updateCallCount).toBe(1);
  });
});