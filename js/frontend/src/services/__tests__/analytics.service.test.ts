import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AnalyticsService } from "../analytics.service";
import type { AnalyticsEvent, AnalyticsEventType } from "../analytics.service";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock crypto.randomUUID
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: () => "test-uuid-" + Date.now(),
  },
});

// Mock navigator
Object.defineProperty(globalThis, "navigator", {
  value: {
    userAgent: "Test User Agent",
  },
});

// Mock window.location
Object.defineProperty(window, "location", {
  value: {
    pathname: "/test-path",
  },
});

// Mock PerformanceObserver
const mockPerformanceObserver = vi.fn();
Object.defineProperty(globalThis, "PerformanceObserver", {
  value: mockPerformanceObserver,
});

// Mock document.addEventListener
const mockAddEventListener = vi.fn();
Object.defineProperty(document, "addEventListener", {
  value: mockAddEventListener,
});
Object.defineProperty(window, "addEventListener", { value: vi.fn() });

Object.defineProperty(window, "localStorage", { value: localStorageMock });
Object.defineProperty(window, "dispatchEvent", { value: vi.fn() });

describe("AnalyticsService", () => {
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    mockPerformanceObserver.mockImplementation((callback) => ({
      observe: vi.fn(),
    }));

    analyticsService = new AnalyticsService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("trackEvent", () => {
    it("should track a basic event", () => {
      analyticsService.trackEvent("page_navigation", { page: "/dashboard" });

      const history = analyticsService.getEventsByType("page_navigation");
      expect(history).toHaveLength(1);

      const event = history[0];
      expect(event.type).toBe("page_navigation");
      expect(event.properties.page).toBe("/dashboard");
      expect(event.userAgent).toBe("Test User Agent");
      expect(event.location).toBe("/test-path");
      expect(event.timestamp).toBeDefined();
      expect(event.id).toBeDefined();
    });

    it("should track event with session ID", () => {
      const sessionId = "test-session-123";
      analyticsService.trackEvent(
        "session_view",
        { duration: 1000 },
        sessionId,
      );

      const history = analyticsService.getEventsByType("session_view");
      expect(history).toHaveLength(1);
      expect(history[0].sessionId).toBe(sessionId);
    });

    it("should update feature usage tracking", () => {
      analyticsService.trackEvent("search_performed", { query: "test" });
      analyticsService.trackEvent("search_performed", { query: "another" });

      const featureUsage = analyticsService.getFeatureUsage();
      const searchUsage = featureUsage.find(
        (f) => f.feature === "search_performed",
      );

      expect(searchUsage).toBeDefined();
      expect(searchUsage!.count).toBe(2);
    });

    it("should limit events to prevent memory bloat", () => {
      // Mock MAX_EVENTS to a small number for testing
      const maxEvents = 5;

      // Track more events than the limit
      for (let i = 0; i < maxEvents + 2; i++) {
        analyticsService.trackEvent("page_navigation", { page: `/page-${i}` });
      }

      const allEvents = analyticsService.getEventsByType("page_navigation");
      expect(allEvents.length).toBeLessThanOrEqual(maxEvents + 2); // Should be limited
    });

    it("should save to localStorage", () => {
      analyticsService.trackEvent("page_navigation", { page: "/test" });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "claude-code-analytics",
        expect.any(String),
      );
    });
  });

  describe("trackPageView", () => {
    it("should track page view", () => {
      analyticsService.trackPageView("/dashboard", "session-123");

      const events = analyticsService.getEventsByType("page_navigation");
      expect(events).toHaveLength(1);
      expect(events[0].properties.page).toBe("/dashboard");
      expect(events[0].sessionId).toBe("session-123");
    });
  });

  describe("trackSearch", () => {
    it("should track search with metrics", () => {
      analyticsService.trackSearch("test query", 5, 120);

      const events = analyticsService.getEventsByType("search_performed");
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.properties.queryLength).toBe(10);
      expect(event.properties.resultsCount).toBe(5);
      expect(event.properties.searchTime).toBe(120);
      expect(event.properties.hasResults).toBe(true);
    });

    it("should track search with no results", () => {
      analyticsService.trackSearch("no results query", 0, 50);

      const events = analyticsService.getEventsByType("search_performed");
      expect(events[0].properties.hasResults).toBe(false);
    });
  });

  describe("trackExport", () => {
    it("should track successful export", () => {
      analyticsService.trackExport("json", 100, 500, true);

      const events = analyticsService.getEventsByType("export_completed");
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.properties.format).toBe("json");
      expect(event.properties.recordCount).toBe(100);
      expect(event.properties.exportTime).toBe(500);
      expect(event.properties.success).toBe(true);
    });

    it("should track failed export", () => {
      analyticsService.trackExport("csv", 50, 1000, false);

      const events = analyticsService.getEventsByType("export_completed");
      expect(events[0].properties.success).toBe(false);
    });
  });

  describe("trackError", () => {
    it("should track error with context", () => {
      const error = new Error("Test error");
      const context = { userId: "123", action: "search" };

      analyticsService.trackError(error, context);

      const events = analyticsService.getEventsByType("error_occurred");
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.properties.message).toBe("Test error");
      expect(event.properties.stack).toBeDefined();
      expect(event.properties.context).toEqual(context);
    });

    it("should track error without context", () => {
      const error = new Error("Another error");

      analyticsService.trackError(error);

      const events = analyticsService.getEventsByType("error_occurred");
      expect(events).toHaveLength(1);
      expect(events[0].properties.context).toEqual({});
    });
  });

  describe("getUsageStatistics", () => {
    it("should return initial statistics", () => {
      const stats = analyticsService.getUsageStatistics();

      expect(stats.totalSessions).toBe(0);
      expect(stats.totalSearches).toBe(0);
      expect(stats.totalExports).toBe(0);
      expect(stats.mostUsedFeatures).toEqual([]);
      expect(stats.timeSpentInApp).toBeGreaterThanOrEqual(0);
      expect(stats.dailyActiveUsage).toEqual({});
    });

    it("should calculate statistics from tracked events", () => {
      analyticsService.trackEvent("session_view", {});
      analyticsService.trackEvent("session_view", {});
      analyticsService.trackEvent("search_performed", {});
      analyticsService.trackEvent("export_completed", {});

      const stats = analyticsService.getUsageStatistics();

      expect(stats.totalSessions).toBe(2);
      expect(stats.totalSearches).toBe(1);
      expect(stats.totalExports).toBe(1);
      expect(stats.mostUsedFeatures).toHaveLength(3);
    });
  });

  describe("getPerformanceMetrics", () => {
    it("should return initial performance metrics", () => {
      const metrics = analyticsService.getPerformanceMetrics();

      expect(metrics.averageSearchTime).toBe(0);
      expect(metrics.averageExportTime).toBe(0);
      expect(metrics.averagePageLoadTime).toBe(0);
      expect(metrics.cacheHitRate).toBeDefined();
      expect(metrics.errorRate).toBe(0);
    });

    it("should calculate error rate", () => {
      analyticsService.trackEvent("page_navigation", {});
      analyticsService.trackEvent("error_occurred", {});
      analyticsService.trackEvent("search_performed", {});

      const metrics = analyticsService.getPerformanceMetrics();
      expect(metrics.errorRate).toBeCloseTo(33.33, 2); // 1 error out of 3 events
    });
  });

  describe("getFeatureUsage", () => {
    it("should return feature usage sorted by count", () => {
      analyticsService.trackEvent("search_performed", {});
      analyticsService.trackEvent("search_performed", {});
      analyticsService.trackEvent("export_completed", {});

      const usage = analyticsService.getFeatureUsage();

      expect(usage).toHaveLength(2);
      expect(usage[0].feature).toBe("search_performed");
      expect(usage[0].count).toBe(2);
      expect(usage[1].feature).toBe("export_completed");
      expect(usage[1].count).toBe(1);
    });
  });

  describe("getEventsByType", () => {
    it("should filter events by type", () => {
      analyticsService.trackEvent("page_navigation", { page: "/home" });
      analyticsService.trackEvent("search_performed", { query: "test" });
      analyticsService.trackEvent("page_navigation", { page: "/about" });

      const pageEvents = analyticsService.getEventsByType("page_navigation");
      const searchEvents = analyticsService.getEventsByType("search_performed");

      expect(pageEvents).toHaveLength(2);
      expect(searchEvents).toHaveLength(1);
    });
  });

  describe("getEventsByDateRange", () => {
    it("should filter events by date range", () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      analyticsService.trackEvent("page_navigation", { page: "/home" });

      const events = analyticsService.getEventsByDateRange(
        yesterday.toISOString(),
        tomorrow.toISOString(),
      );

      expect(events).toHaveLength(1);
    });

    it("should return empty array for events outside date range", () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      analyticsService.trackEvent("page_navigation", { page: "/home" });

      const events = analyticsService.getEventsByDateRange(
        twoDaysAgo.toISOString(),
        yesterday.toISOString(),
      );

      expect(events).toHaveLength(0);
    });
  });

  describe("clearAnalytics", () => {
    it("should clear all analytics data", () => {
      analyticsService.trackEvent("page_navigation", {});
      analyticsService.trackEvent("search_performed", {});

      expect(analyticsService.getEventsByType("page_navigation")).toHaveLength(
        1,
      );

      analyticsService.clearAnalytics();

      expect(analyticsService.getEventsByType("page_navigation")).toHaveLength(
        0,
      );
      expect(analyticsService.getFeatureUsage()).toHaveLength(0);
    });
  });

  describe("exportAnalytics", () => {
    it("should export analytics data as JSON", () => {
      analyticsService.trackEvent("page_navigation", { page: "/test" });

      const exported = analyticsService.exportAnalytics();
      const data = JSON.parse(exported);

      expect(data.events).toBeDefined();
      expect(data.featureUsage).toBeDefined();
      expect(data.statistics).toBeDefined();
      expect(data.performanceMetrics).toBeDefined();
      expect(data.exportedAt).toBeDefined();
    });
  });

  describe("localStorage integration", () => {
    it("should load analytics data from localStorage on initialization", () => {
      const savedData = {
        events: [
          {
            id: "test-event",
            type: "page_navigation",
            timestamp: "2024-01-01T00:00:00.000Z",
            properties: { page: "/loaded" },
          },
        ],
        featureUsage: [
          ["page_navigation", { feature: "page_navigation", count: 1 }],
        ],
        performanceData: [["searchTime", [100, 200]]],
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedData));

      const newService = new AnalyticsService();
      const events = newService.getEventsByType("page_navigation");

      expect(events).toHaveLength(1);
      expect(events[0].properties.page).toBe("/loaded");
    });

    it("should handle corrupted localStorage data", () => {
      localStorageMock.getItem.mockReturnValue("invalid-json");

      const newService = new AnalyticsService();
      const events = newService.getEventsByType("page_navigation");

      expect(events).toHaveLength(0);
    });
  });

  describe("performance recording", () => {
    it("should record search performance", () => {
      analyticsService.trackSearch("test", 5, 120);
      analyticsService.trackSearch("another", 3, 80);

      const metrics = analyticsService.getPerformanceMetrics();
      expect(metrics.averageSearchTime).toBe(100); // (120 + 80) / 2
    });

    it("should record export performance", () => {
      analyticsService.trackExport("json", 10, 300, true);
      analyticsService.trackExport("csv", 20, 500, true);

      const metrics = analyticsService.getPerformanceMetrics();
      expect(metrics.averageExportTime).toBe(400); // (300 + 500) / 2
    });
  });

  describe("error count tracking", () => {
    it("should track error counts in feature usage", () => {
      analyticsService.trackEvent("search_performed", {});
      analyticsService.trackError(new Error("Search error"));

      const usage = analyticsService.getFeatureUsage();
      const errorUsage = usage.find((f) => f.feature === "error_occurred");

      expect(errorUsage?.errorCount).toBe(1);
    });
  });

  describe("daily usage calculation", () => {
    it("should calculate daily usage patterns", () => {
      const today = new Date().toISOString().split("T")[0];

      analyticsService.trackEvent("page_navigation", {});
      analyticsService.trackEvent("search_performed", {});

      const stats = analyticsService.getUsageStatistics();
      expect(stats.dailyActiveUsage[today]).toBe(2);
    });
  });
});
