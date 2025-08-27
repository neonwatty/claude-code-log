/**
 * Unit tests for Connection State Management Utilities
 * Tests enums, interfaces, and utility functions for connection state tracking
 */

import { describe, it, expect } from "vitest";
import {
  ConnectionState,
  ConnectionStatistics,
  ConnectionStateEvent,
  ConnectionDebugInfo,
  getConnectionStateDisplay,
  calculateConnectionQuality,
  formatUptime,
  formatDataSize,
  getStateChangeAnnouncement,
} from "../../../src/utils/websocket/connection-state";

describe("Connection State Management", () => {
  describe("ConnectionState Enum", () => {
    it("should define all required connection states", () => {
      expect(ConnectionState.CONNECTING).toBe("CONNECTING");
      expect(ConnectionState.CONNECTED).toBe("CONNECTED");
      expect(ConnectionState.RECONNECTING).toBe("RECONNECTING");
      expect(ConnectionState.DISCONNECTED).toBe("DISCONNECTED");
      expect(ConnectionState.ERROR).toBe("ERROR");
    });

    it("should have exactly 5 states", () => {
      const states = Object.values(ConnectionState);
      expect(states).toHaveLength(5);
    });
  });

  describe("getConnectionStateDisplay", () => {
    it("should return correct display properties for CONNECTED state", () => {
      const display = getConnectionStateDisplay(ConnectionState.CONNECTED);

      expect(display.label).toBe("Connected");
      expect(display.icon).toBe("🟢");
      expect(display.color).toBe("var(--color-success)");
      expect(display.severity).toBe("success");
    });

    it("should return correct display properties for CONNECTING state", () => {
      const display = getConnectionStateDisplay(ConnectionState.CONNECTING);

      expect(display.label).toBe("Connecting");
      expect(display.icon).toBe("🟡");
      expect(display.color).toBe("var(--color-warning)");
      expect(display.severity).toBe("info");
    });

    it("should return correct display properties for RECONNECTING state", () => {
      const display = getConnectionStateDisplay(ConnectionState.RECONNECTING);

      expect(display.label).toBe("Reconnecting");
      expect(display.icon).toBe("🔄");
      expect(display.color).toBe("var(--color-warning)");
      expect(display.severity).toBe("warning");
    });

    it("should return correct display properties for DISCONNECTED state", () => {
      const display = getConnectionStateDisplay(ConnectionState.DISCONNECTED);

      expect(display.label).toBe("Disconnected");
      expect(display.icon).toBe("🔴");
      expect(display.color).toBe("var(--color-error)");
      expect(display.severity).toBe("error");
    });

    it("should return correct display properties for ERROR state", () => {
      const display = getConnectionStateDisplay(ConnectionState.ERROR);

      expect(display.label).toBe("Error");
      expect(display.icon).toBe("❌");
      expect(display.color).toBe("var(--color-error)");
      expect(display.severity).toBe("error");
    });

    it("should handle unknown states gracefully", () => {
      const display = getConnectionStateDisplay("UNKNOWN" as ConnectionState);

      expect(display.label).toBe("Unknown");
      expect(display.icon).toBe("❓");
      expect(display.color).toBe("var(--color-text-muted)");
      expect(display.severity).toBe("info");
    });
  });

  describe("calculateConnectionQuality", () => {
    it('should return "unknown" for zero uptime', () => {
      const stats: Partial<ConnectionStatistics> = { uptime: 0 };
      expect(calculateConnectionQuality(stats)).toBe("unknown");
    });

    it('should return "poor" for high reconnection rate', () => {
      const stats: Partial<ConnectionStatistics> = {
        uptime: 60000, // 1 minute
        reconnectionCount: 60, // 1 per second = very high rate
        averageLatency: 100,
      };
      expect(calculateConnectionQuality(stats)).toBe("poor");
    });

    it('should return "excellent" for low latency', () => {
      const stats: Partial<ConnectionStatistics> = {
        uptime: 300000, // 5 minutes - longer uptime to avoid poor reconnection rate
        reconnectionCount: 1,
        averageLatency: 25, // Very low latency
      };
      expect(calculateConnectionQuality(stats)).toBe("excellent");
    });

    it('should return "good" for moderate latency', () => {
      const stats: Partial<ConnectionStatistics> = {
        uptime: 300000, // 5 minutes - longer uptime to avoid poor reconnection rate
        reconnectionCount: 1,
        averageLatency: 100, // Moderate latency
      };
      expect(calculateConnectionQuality(stats)).toBe("good");
    });

    it('should return "fair" for higher latency', () => {
      const stats: Partial<ConnectionStatistics> = {
        uptime: 300000, // 5 minutes - longer uptime to avoid poor reconnection rate
        reconnectionCount: 1,
        averageLatency: 200, // Higher latency
      };
      expect(calculateConnectionQuality(stats)).toBe("fair");
    });

    it('should return "poor" for very high latency', () => {
      const stats: Partial<ConnectionStatistics> = {
        uptime: 60000,
        reconnectionCount: 1,
        averageLatency: 500, // Very high latency
      };
      expect(calculateConnectionQuality(stats)).toBe("poor");
    });

    it('should return "unknown" for zero latency', () => {
      const stats: Partial<ConnectionStatistics> = {
        uptime: 300000, // 5 minutes - longer uptime to avoid poor reconnection rate
        reconnectionCount: 1,
        averageLatency: 0, // No latency data
      };
      expect(calculateConnectionQuality(stats)).toBe("unknown");
    });
  });

  describe("formatUptime", () => {
    it("should format zero uptime correctly", () => {
      expect(formatUptime(0)).toBe("0s");
    });

    it("should format seconds correctly", () => {
      expect(formatUptime(45000)).toBe("45s"); // 45 seconds
    });

    it("should format minutes and seconds correctly", () => {
      expect(formatUptime(125000)).toBe("2m 5s"); // 2 minutes 5 seconds
    });

    it("should format hours, minutes and seconds correctly", () => {
      expect(formatUptime(3725000)).toBe("1h 2m 5s"); // 1 hour 2 minutes 5 seconds
    });

    it("should format days, hours and minutes correctly", () => {
      expect(formatUptime(90125000)).toBe("1d 1h 2m"); // 1 day 1 hour 2 minutes 5 seconds
    });

    it("should handle large uptimes", () => {
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const result = formatUptime(sevenDays);
      expect(result).toMatch(/7d \d+h \d+m/);
    });
  });

  describe("formatDataSize", () => {
    it("should format zero bytes correctly", () => {
      expect(formatDataSize(0)).toBe("0 B");
    });

    it("should format bytes correctly", () => {
      expect(formatDataSize(512)).toBe("512 B");
    });

    it("should format kilobytes correctly", () => {
      expect(formatDataSize(1536)).toBe("1.5 KB"); // 1.5 KB
    });

    it("should format megabytes correctly", () => {
      expect(formatDataSize(2621440)).toBe("2.5 MB"); // 2.5 MB
    });

    it("should format gigabytes correctly", () => {
      expect(formatDataSize(3221225472)).toBe("3 GB"); // 3 GB
    });

    it("should handle very large sizes", () => {
      const size = 1024 * 1024 * 1024 * 1024; // 1 TB
      expect(formatDataSize(size)).toBe("1 TB");
    });
  });

  describe("getStateChangeAnnouncement", () => {
    it("should create appropriate announcement for connection", () => {
      const event: ConnectionStateEvent = {
        previousState: ConnectionState.DISCONNECTED,
        currentState: ConnectionState.CONNECTED,
        timestamp: Date.now(),
      };

      const announcement = getStateChangeAnnouncement(event);

      expect(announcement).toContain(
        "WebSocket connection state changed to Connected",
      );
      expect(announcement).toContain("Real-time updates are now available");
    });

    it("should create appropriate announcement for disconnection", () => {
      const event: ConnectionStateEvent = {
        previousState: ConnectionState.CONNECTED,
        currentState: ConnectionState.DISCONNECTED,
        timestamp: Date.now(),
        reason: "Network error",
      };

      const announcement = getStateChangeAnnouncement(event);

      expect(announcement).toContain(
        "WebSocket connection state changed to Disconnected",
      );
      expect(announcement).toContain("due to Network error");
      expect(announcement).toContain("Real-time updates are not available");
    });

    it("should create appropriate announcement for reconnecting", () => {
      const event: ConnectionStateEvent = {
        previousState: ConnectionState.DISCONNECTED,
        currentState: ConnectionState.RECONNECTING,
        timestamp: Date.now(),
      };

      const announcement = getStateChangeAnnouncement(event);

      expect(announcement).toContain(
        "WebSocket connection state changed to Reconnecting",
      );
      expect(announcement).toContain("Attempting to restore connection");
    });

    it("should create appropriate announcement for error", () => {
      const event: ConnectionStateEvent = {
        previousState: ConnectionState.CONNECTED,
        currentState: ConnectionState.ERROR,
        timestamp: Date.now(),
        error: new Error("Connection failed"),
      };

      const announcement = getStateChangeAnnouncement(event);

      expect(announcement).toContain(
        "WebSocket connection state changed to Error",
      );
      expect(announcement).toContain("Connection error occurred");
    });

    it("should handle connecting state", () => {
      const event: ConnectionStateEvent = {
        previousState: ConnectionState.DISCONNECTED,
        currentState: ConnectionState.CONNECTING,
        timestamp: Date.now(),
      };

      const announcement = getStateChangeAnnouncement(event);

      expect(announcement).toContain(
        "WebSocket connection state changed to Connecting",
      );
      expect(announcement).toContain("Attempting to establish connection");
    });
  });

  describe("ConnectionStatistics Interface", () => {
    it("should allow creation of valid statistics object", () => {
      const stats: ConnectionStatistics = {
        uptime: 60000,
        reconnectionCount: 2,
        lastConnectTime: Date.now() - 60000,
        lastDisconnectTime: Date.now() - 120000,
        averageLatency: 150,
        messagesSent: 25,
        messagesReceived: 30,
        totalDataSent: 1024,
        totalDataReceived: 2048,
        connectionQuality: "good",
      };

      expect(stats).toBeDefined();
      expect(stats.connectionQuality).toBe("good");
      expect(stats.uptime).toBe(60000);
      expect(stats.messagesSent).toBeLessThan(stats.messagesReceived);
    });
  });

  describe("ConnectionStateEvent Interface", () => {
    it("should allow creation of valid state event", () => {
      const event: ConnectionStateEvent = {
        previousState: ConnectionState.CONNECTING,
        currentState: ConnectionState.CONNECTED,
        timestamp: Date.now(),
        reason: "Connection established",
      };

      expect(event).toBeDefined();
      expect(event.previousState).toBe(ConnectionState.CONNECTING);
      expect(event.currentState).toBe(ConnectionState.CONNECTED);
      expect(event.reason).toBe("Connection established");
    });

    it("should allow optional properties", () => {
      const event: ConnectionStateEvent = {
        previousState: ConnectionState.CONNECTED,
        currentState: ConnectionState.ERROR,
        timestamp: Date.now(),
      };

      expect(event.reason).toBeUndefined();
      expect(event.error).toBeUndefined();
    });
  });

  describe("ConnectionDebugInfo Interface", () => {
    it("should allow creation of valid debug info", () => {
      const debugInfo: ConnectionDebugInfo = {
        url: "ws://localhost:8080",
        protocols: ["v1", "v2"],
        readyState: 1,
        bufferedAmount: 0,
        extensions: "",
        protocol: "v1",
        binaryType: "blob",
        statistics: {
          uptime: 30000,
          reconnectionCount: 1,
          lastConnectTime: Date.now(),
          lastDisconnectTime: null,
          averageLatency: 100,
          messagesSent: 10,
          messagesReceived: 15,
          totalDataSent: 512,
          totalDataReceived: 768,
          connectionQuality: "excellent",
        },
        lastHeartbeat: Date.now() - 5000,
        lastPong: Date.now() - 3000,
        reconnectionAttempts: 1,
        maxReconnectionAttempts: 10,
      };

      expect(debugInfo).toBeDefined();
      expect(debugInfo.url).toBe("ws://localhost:8080");
      expect(debugInfo.protocols).toHaveLength(2);
      expect(debugInfo.readyState).toBe(1); // WebSocket.OPEN
    });
  });
});
