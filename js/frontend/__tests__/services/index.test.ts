/**
 * Unit tests for services module exports
 * Tests module export structure and accessibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Services Module Exports", () => {
  beforeEach(() => {
    // Module resetting and mock clearing is handled automatically by Vitest config
    // (resetModules: true, clearMocks: true in vitest.config.ts)
  });

  afterEach(() => {
    // Mocks are cleared automatically by Vitest config
  });

  it("should export WebSocketService class", async () => {
    const { WebSocketService } = await import("../../src/services/index");

    expect(WebSocketService).toBeDefined();
    expect(typeof WebSocketService).toBe("function");
    expect(WebSocketService.name).toBe("WebSocketService");
  });

  it("should export getWebSocketService function", async () => {
    const { getWebSocketService } = await import("../../src/services/index");

    expect(getWebSocketService).toBeDefined();
    expect(typeof getWebSocketService).toBe("function");
  });

  it("should export IWebSocketConfig type", async () => {
    // Type exports can't be tested at runtime, but we can verify the module loads
    const module = await import("../../src/services/index");

    expect(module).toBeDefined();
    expect(Object.keys(module)).toContain("WebSocketService");
    expect(Object.keys(module)).toContain("getWebSocketService");
  });

  it("should provide working WebSocketService singleton through getWebSocketService", async () => {
    const { getWebSocketService, WebSocketService } = await import(
      "../../src/services/index"
    );

    const config = { url: "ws://test:8080/ws" };
    const service1 = getWebSocketService(config);
    const service2 = getWebSocketService();

    expect(service1).toBeInstanceOf(WebSocketService);
    expect(service2).toBeInstanceOf(WebSocketService);
    expect(service1).toBe(service2); // Should be the same singleton instance
  });

  it("should create new WebSocketService instance directly", async () => {
    const { WebSocketService } = await import("../../src/services/index");

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

    const config = { url: "ws://test:8080/ws" };
    const service = WebSocketService.getInstance(config);

    expect(service).toBeInstanceOf(WebSocketService);
    expect(service.getConnectionState()).toBeDefined();
  });

  it("should export ConnectionManager class and factory function", async () => {
    const { ConnectionManager, getConnectionManager } = await import(
      "../../src/services/index"
    );

    expect(ConnectionManager).toBeDefined();
    expect(typeof ConnectionManager).toBe("function");
    expect(ConnectionManager.name).toBe("ConnectionManager");

    expect(getConnectionManager).toBeDefined();
    expect(typeof getConnectionManager).toBe("function");
  });

  it("should export AccessibilityService class and factory function", async () => {
    const { AccessibilityService, getAccessibilityService } = await import(
      "../../src/services/index"
    );

    expect(AccessibilityService).toBeDefined();
    expect(typeof AccessibilityService).toBe("function");
    expect(AccessibilityService.name).toBe("AccessibilityService");

    expect(getAccessibilityService).toBeDefined();
    expect(typeof getAccessibilityService).toBe("function");
  });

  it("should export ClaudeIntegrationService class and factory function", async () => {
    const { ClaudeIntegrationService, getClaudeIntegrationService } =
      await import("../../src/services/index");

    expect(ClaudeIntegrationService).toBeDefined();
    expect(typeof ClaudeIntegrationService).toBe("function");
    expect(ClaudeIntegrationService.name).toBe("ClaudeIntegrationService");

    expect(getClaudeIntegrationService).toBeDefined();
    expect(typeof getClaudeIntegrationService).toBe("function");
  });

  it("should export Claude integration utility functions", async () => {
    const { isProcessActive, isProcessFinished, getProcessStateLabel } =
      await import("../../src/services/index");

    expect(isProcessActive).toBeDefined();
    expect(typeof isProcessActive).toBe("function");

    expect(isProcessFinished).toBeDefined();
    expect(typeof isProcessFinished).toBe("function");

    expect(getProcessStateLabel).toBeDefined();
    expect(typeof getProcessStateLabel).toBe("function");
  });

  it("should export SearchService class and singleton instance", async () => {
    const { SearchService, searchService } = await import(
      "../../src/services/index"
    );

    expect(SearchService).toBeDefined();
    expect(typeof SearchService).toBe("function");
    expect(SearchService.name).toBe("SearchService");

    expect(searchService).toBeDefined();
    expect(searchService).toBeInstanceOf(SearchService);
  });

  it("should export ExportService class and singleton instance", async () => {
    const { ExportService, exportService } = await import(
      "../../src/services/index"
    );

    expect(ExportService).toBeDefined();
    expect(typeof ExportService).toBe("function");
    expect(ExportService.name).toBe("ExportService");

    expect(exportService).toBeDefined();
    expect(exportService).toBeInstanceOf(ExportService);
  });

  it("should export PreferencesService class and singleton instance", async () => {
    const { PreferencesService, preferencesService } = await import(
      "../../src/services/index"
    );

    expect(PreferencesService).toBeDefined();
    expect(typeof PreferencesService).toBe("function");
    expect(PreferencesService.name).toBe("PreferencesService");

    expect(preferencesService).toBeDefined();
    expect(preferencesService).toBeInstanceOf(PreferencesService);
  });

  it("should export AnalyticsService class and singleton instance", async () => {
    const { AnalyticsService, analyticsService } = await import(
      "../../src/services/index"
    );

    expect(AnalyticsService).toBeDefined();
    expect(typeof AnalyticsService).toBe("function");
    expect(AnalyticsService.name).toBe("AnalyticsService");

    expect(analyticsService).toBeDefined();
    expect(analyticsService).toBeInstanceOf(AnalyticsService);
  });

  it("should export OfflineService class and singleton instance", async () => {
    const { OfflineService, offlineService } = await import(
      "../../src/services/index"
    );

    expect(OfflineService).toBeDefined();
    expect(typeof OfflineService).toBe("function");
    expect(OfflineService.name).toBe("OfflineService");

    expect(offlineService).toBeDefined();
    expect(offlineService).toBeInstanceOf(OfflineService);
  });

  it("should maintain module structure integrity", async () => {
    const module = await import("../../src/services/index");
    const exportedKeys = Object.keys(module);

    // Verify core exports are present
    expect(exportedKeys).toContain("WebSocketService");
    expect(exportedKeys).toContain("getWebSocketService");
    expect(exportedKeys).toContain("ConnectionManager");
    expect(exportedKeys).toContain("getConnectionManager");
    expect(exportedKeys).toContain("AccessibilityService");
    expect(exportedKeys).toContain("getAccessibilityService");
    expect(exportedKeys).toContain("ClaudeIntegrationService");
    expect(exportedKeys).toContain("getClaudeIntegrationService");
    expect(exportedKeys).toContain("isProcessActive");
    expect(exportedKeys).toContain("isProcessFinished");
    expect(exportedKeys).toContain("getProcessStateLabel");
    expect(exportedKeys).toContain("SearchService");
    expect(exportedKeys).toContain("searchService");

    // Verify additional service exports are present
    expect(exportedKeys).toContain("ExportService");
    expect(exportedKeys).toContain("exportService");
    expect(exportedKeys).toContain("PreferencesService");
    expect(exportedKeys).toContain("preferencesService");
    expect(exportedKeys).toContain("AnalyticsService");
    expect(exportedKeys).toContain("analyticsService");
    expect(exportedKeys).toContain("OfflineService");
    expect(exportedKeys).toContain("offlineService");

    // Verify expected number of exports (21 classes/functions - type exports don't appear in Object.keys)
    // Core services: 13 exports + Additional services: 8 exports = 21 total
    expect(exportedKeys).toHaveLength(21);
  });
});
