import { ZodSession, ZodTranscriptEntry } from "@shared";

/**
 * Analytics event types
 */
export type AnalyticsEventType =
  | "session_view"
  | "search_performed"
  | "export_completed"
  | "preference_changed"
  | "claude_integration_used"
  | "filter_applied"
  | "page_navigation"
  | "error_occurred";

/**
 * Analytics event data
 */
export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  timestamp: string;
  sessionId?: string;
  properties: Record<string, any>;
  userAgent?: string;
  location?: string;
}

/**
 * Usage statistics aggregation
 */
export interface UsageStatistics {
  totalSessions: number;
  totalTokens: number;
  totalSearches: number;
  totalExports: number;
  averageSessionDuration: number;
  mostUsedFeatures: Array<{ feature: string; count: number }>;
  timeSpentInApp: number; // in milliseconds
  dailyActiveUsage: Record<string, number>; // date -> minutes
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  averagePageLoadTime: number;
  averageSearchTime: number;
  averageExportTime: number;
  memoryUsage?: number;
  cacheHitRate: number;
  errorRate: number;
}

/**
 * Feature usage tracking
 */
export interface FeatureUsage {
  feature: string;
  count: number;
  lastUsed: string;
  averageTimeSpent: number;
  errorCount: number;
}

/**
 * Analytics service for usage tracking and insights
 */
export class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private sessionStartTime: number = Date.now();
  private featureUsage: Map<string, FeatureUsage> = new Map();
  private performanceData: Map<string, number[]> = new Map();
  private readonly STORAGE_KEY = "claude-code-analytics";
  private readonly MAX_EVENTS = 10000; // Prevent memory bloat

  constructor() {
    this.loadAnalyticsData();
    this.startSessionTracking();
    this.setupPerformanceObserver();
  }

  /**
   * Track an analytics event
   */
  trackEvent(
    type: AnalyticsEventType,
    properties: Record<string, any> = {},
    sessionId?: string,
  ): void {
    const event: AnalyticsEvent = {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      sessionId,
      properties,
      userAgent: navigator.userAgent,
      location: window.location.pathname,
    };

    this.events.push(event);
    this.updateFeatureUsage(type, properties);

    // Prevent memory bloat
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    this.saveAnalyticsData();
    this.emitEvent("analyticsEvent", event);
  }

  /**
   * Track page view
   */
  trackPageView(page: string, sessionId?: string): void {
    this.trackEvent("page_navigation", { page }, sessionId);
  }

  /**
   * Track search usage
   */
  trackSearch(query: string, resultsCount: number, searchTime: number): void {
    this.trackEvent("search_performed", {
      queryLength: query.length,
      resultsCount,
      searchTime,
      hasResults: resultsCount > 0,
    });

    this.recordPerformanceMetric("searchTime", searchTime);
  }

  /**
   * Track export usage
   */
  trackExport(
    format: string,
    recordCount: number,
    exportTime: number,
    success: boolean,
  ): void {
    this.trackEvent("export_completed", {
      format,
      recordCount,
      exportTime,
      success,
    });

    this.recordPerformanceMetric("exportTime", exportTime);
  }

  /**
   * Track errors
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.trackEvent("error_occurred", {
      message: error.message,
      stack: error.stack,
      context: context || {},
    });
  }

  /**
   * Get usage statistics
   */
  getUsageStatistics(): UsageStatistics {
    const sessionEvents = this.events.filter((e) => e.type === "session_view");
    const searchEvents = this.events.filter(
      (e) => e.type === "search_performed",
    );
    const exportEvents = this.events.filter(
      (e) => e.type === "export_completed",
    );

    // Calculate feature usage
    const featureUsageArray = Array.from(this.featureUsage.values()).sort(
      (a, b) => b.count - a.count,
    );

    // Calculate daily usage
    const dailyUsage = this.calculateDailyUsage();

    return {
      totalSessions: sessionEvents.length,
      totalTokens: this.calculateTotalTokensFromEvents(),
      totalSearches: searchEvents.length,
      totalExports: exportEvents.length,
      averageSessionDuration: this.calculateAverageSessionDuration(),
      mostUsedFeatures: featureUsageArray.slice(0, 10).map((f) => ({
        feature: f.feature,
        count: f.count,
      })),
      timeSpentInApp: Date.now() - this.sessionStartTime,
      dailyActiveUsage: dailyUsage,
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const searchTimes = this.performanceData.get("searchTime") || [];
    const exportTimes = this.performanceData.get("exportTime") || [];
    const loadTimes = this.performanceData.get("pageLoadTime") || [];

    const errorEvents = this.events.filter((e) => e.type === "error_occurred");
    const totalEvents = this.events.length;

    return {
      averagePageLoadTime: this.calculateAverage(loadTimes),
      averageSearchTime: this.calculateAverage(searchTimes),
      averageExportTime: this.calculateAverage(exportTimes),
      cacheHitRate: this.calculateCacheHitRate(),
      errorRate: totalEvents > 0 ? (errorEvents.length / totalEvents) * 100 : 0,
    };
  }

  /**
   * Get feature usage statistics
   */
  getFeatureUsage(): FeatureUsage[] {
    return Array.from(this.featureUsage.values()).sort(
      (a, b) => b.count - a.count,
    );
  }

  /**
   * Get events by type
   */
  getEventsByType(type: AnalyticsEventType): AnalyticsEvent[] {
    return this.events.filter((event) => event.type === type);
  }

  /**
   * Get events by date range
   */
  getEventsByDateRange(startDate: string, endDate: string): AnalyticsEvent[] {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.events.filter((event) => {
      const eventDate = new Date(event.timestamp);
      return eventDate >= start && eventDate <= end;
    });
  }

  /**
   * Clear all analytics data
   */
  clearAnalytics(): void {
    this.events = [];
    this.featureUsage.clear();
    this.performanceData.clear();
    this.saveAnalyticsData();
  }

  /**
   * Export analytics data
   */
  exportAnalytics(): string {
    return JSON.stringify(
      {
        events: this.events,
        featureUsage: Array.from(this.featureUsage.entries()),
        performanceData: Array.from(this.performanceData.entries()),
        statistics: this.getUsageStatistics(),
        performanceMetrics: this.getPerformanceMetrics(),
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  /**
   * Update feature usage tracking
   */
  private updateFeatureUsage(
    type: AnalyticsEventType,
    properties: Record<string, any>,
  ): void {
    const existing = this.featureUsage.get(type) || {
      feature: type,
      count: 0,
      lastUsed: new Date().toISOString(),
      averageTimeSpent: 0,
      errorCount: 0,
    };

    existing.count++;
    existing.lastUsed = new Date().toISOString();

    if (type === "error_occurred") {
      existing.errorCount++;
    }

    // Update average time if time data is provided
    if (properties.duration && typeof properties.duration === "number") {
      existing.averageTimeSpent =
        (existing.averageTimeSpent * (existing.count - 1) +
          properties.duration) /
        existing.count;
    }

    this.featureUsage.set(type, existing);
  }

  /**
   * Record performance metric
   */
  private recordPerformanceMetric(metric: string, value: number): void {
    if (!this.performanceData.has(metric)) {
      this.performanceData.set(metric, []);
    }

    const data = this.performanceData.get(metric)!;
    data.push(value);

    // Keep only last 1000 measurements
    if (data.length > 1000) {
      data.splice(0, data.length - 1000);
    }
  }

  /**
   * Calculate average from array of numbers
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Calculate cache hit rate (placeholder)
   */
  private calculateCacheHitRate(): number {
    // This would integrate with the cache services to get real metrics
    return 85; // Placeholder
  }

  /**
   * Calculate total tokens from events
   */
  private calculateTotalTokensFromEvents(): number {
    // This would aggregate token usage from session events
    return this.events
      .filter((e) => e.properties.tokenUsage)
      .reduce((total, e) => total + (e.properties.tokenUsage || 0), 0);
  }

  /**
   * Calculate average session duration
   */
  private calculateAverageSessionDuration(): number {
    const sessionEvents = this.events.filter((e) => e.type === "session_view");
    if (sessionEvents.length === 0) return 0;

    // This would be more sophisticated with session start/end tracking
    return 1800000; // 30 minutes placeholder
  }

  /**
   * Calculate daily usage patterns
   */
  private calculateDailyUsage(): Record<string, number> {
    const usage: Record<string, number> = {};

    for (const event of this.events) {
      const date = event.timestamp.split("T")[0]; // Get date part
      usage[date] = (usage[date] || 0) + 1;
    }

    return usage;
  }

  /**
   * Start session tracking
   */
  private startSessionTracking(): void {
    this.sessionStartTime = Date.now();

    // Track page visibility changes
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.trackEvent("page_navigation", { action: "focus" });
      } else {
        this.trackEvent("page_navigation", { action: "blur" });
      }
    });

    // Track window close
    window.addEventListener("beforeunload", () => {
      const sessionDuration = Date.now() - this.sessionStartTime;
      this.trackEvent("page_navigation", {
        action: "session_end",
        duration: sessionDuration,
      });
    });
  }

  /**
   * Setup performance observer
   */
  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver !== "undefined") {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === "navigation") {
              this.recordPerformanceMetric("pageLoadTime", entry.duration);
            }
          }
        });

        observer.observe({ entryTypes: ["navigation"] });
      } catch (error) {
        console.warn("Performance observer not supported:", error);
      }
    }
  }

  /**
   * Emit custom events
   */
  private emitEvent(eventName: string, data: any): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }
  }

  /**
   * Save analytics data to localStorage
   */
  private saveAnalyticsData(): void {
    try {
      const data = {
        events: this.events,
        featureUsage: Array.from(this.featureUsage.entries()),
        performanceData: Array.from(this.performanceData.entries()),
        lastSaved: new Date().toISOString(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("Could not save analytics data:", error);
    }
  }


  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    const totalEvents = this.events.length;
    const errorEvents = this.events.filter(e => e.type === "error_occurred").length;
    return totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
  }

  /**
   * Load analytics data from localStorage
   */
  private loadAnalyticsData(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this.events = data.events || [];
        this.featureUsage = new Map(data.featureUsage || []);
        this.performanceData = new Map(data.performanceData || []);
      }
    } catch (error) {
      console.warn("Could not load analytics data:", error);
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
