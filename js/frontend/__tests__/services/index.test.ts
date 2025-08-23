/**
 * Unit tests for services module exports
 * Tests module export structure and accessibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Services Module Exports', () => {
  beforeEach(() => {
    // Module resetting and mock clearing is handled automatically by Vitest config
    // (resetModules: true, clearMocks: true in vitest.config.ts)
  });

  afterEach(() => {
    // Mocks are cleared automatically by Vitest config
  });

  it('should export WebSocketService class', async () => {
    const { WebSocketService } = await import('../../src/services/index');
    
    expect(WebSocketService).toBeDefined();
    expect(typeof WebSocketService).toBe('function');
    expect(WebSocketService.name).toBe('WebSocketService');
  });

  it('should export getWebSocketService function', async () => {
    const { getWebSocketService } = await import('../../src/services/index');
    
    expect(getWebSocketService).toBeDefined();
    expect(typeof getWebSocketService).toBe('function');
  });

  it('should export IWebSocketConfig type', async () => {
    // Type exports can't be tested at runtime, but we can verify the module loads
    const module = await import('../../src/services/index');
    
    expect(module).toBeDefined();
    expect(Object.keys(module)).toContain('WebSocketService');
    expect(Object.keys(module)).toContain('getWebSocketService');
  });

  it('should provide working WebSocketService singleton through getWebSocketService', async () => {
    const { getWebSocketService, WebSocketService } = await import('../../src/services/index');
    
    const config = { url: 'ws://test:8080/ws' };
    const service1 = getWebSocketService(config);
    const service2 = getWebSocketService();
    
    expect(service1).toBeInstanceOf(WebSocketService);
    expect(service2).toBeInstanceOf(WebSocketService);
    expect(service1).toBe(service2); // Should be the same singleton instance
  });

  it('should create new WebSocketService instance directly', async () => {
    const { WebSocketService } = await import('../../src/services/index');
    
    // Mock global WebSocket for this test
    (global as any).WebSocket = class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      
      readyState = MockWebSocket.CONNECTING;
      url: string;
      
      constructor(url: string) {
        this.url = url;
      }
      
      send = vi.fn();
      close = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    };
    
    const config = { url: 'ws://test:8080/ws' };
    const service = WebSocketService.getInstance(config);
    
    expect(service).toBeInstanceOf(WebSocketService);
    expect(service.getConnectionState()).toBeDefined();
  });

  it('should export ConnectionManager class and factory function', async () => {
    const { ConnectionManager, getConnectionManager } = await import('../../src/services/index');
    
    expect(ConnectionManager).toBeDefined();
    expect(typeof ConnectionManager).toBe('function');
    expect(ConnectionManager.name).toBe('ConnectionManager');
    
    expect(getConnectionManager).toBeDefined();
    expect(typeof getConnectionManager).toBe('function');
  });

  it('should export AccessibilityService class and factory function', async () => {
    const { AccessibilityService, getAccessibilityService } = await import('../../src/services/index');
    
    expect(AccessibilityService).toBeDefined();
    expect(typeof AccessibilityService).toBe('function');
    expect(AccessibilityService.name).toBe('AccessibilityService');
    
    expect(getAccessibilityService).toBeDefined();
    expect(typeof getAccessibilityService).toBe('function');
  });

  it('should maintain module structure integrity', async () => {
    const module = await import('../../src/services/index');
    const exportedKeys = Object.keys(module);
    
    // Verify expected exports are present
    expect(exportedKeys).toContain('WebSocketService');
    expect(exportedKeys).toContain('getWebSocketService');
    expect(exportedKeys).toContain('ConnectionManager');
    expect(exportedKeys).toContain('getConnectionManager');
    expect(exportedKeys).toContain('AccessibilityService');
    expect(exportedKeys).toContain('getAccessibilityService');
    
    // Verify expected number of exports (6 classes/functions - type exports don't appear in Object.keys)
    expect(exportedKeys).toHaveLength(6);
  });
});