import { ZodSession, ZodTranscriptEntry, ZodUsageInfo } from "../../../shared/dist/src/index.js";
import { EventEmitter } from "events";

/**
 * Token consumption patterns over time
 */
export interface TokenConsumptionPattern {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  sessionId: string;
  messageType: "user" | "assistant";
}

/**
 * Usage insights and optimization opportunities
 */
export interface UsageInsights {
  totalTokensUsed: number;
  averageTokensPerSession: number;
  peakUsageHours: Array<{ hour: number; tokens: number }>;
  topTokenConsumingSessions: Array<{
    sessionId: string;
    title: string;
    tokens: number;
    duration: number;
  }>;
  tokenEfficiencyScore: number; // 0-100 score based on usage patterns
  recommendations: Array<{
    type: "optimization" | "usage" | "performance";
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
    impact: string;
  }>;
  trends: {
    daily: Array<{ date: string; tokens: number; sessions: number }>;
    weekly: Array<{ week: string; tokens: number; sessions: number }>;
    monthly: Array<{ month: string; tokens: number; sessions: number }>;
  };
}

/**
 * Real-time analytics metrics
 */
export interface RealTimeMetrics {
  currentSessionCount: number;
  activeConnections: number;
  tokensPerMinute: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  systemLoad: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

/**
 * Token usage analytics with detailed breakdowns
 */
export interface TokenUsageAnalytics {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  sessionsAnalyzed: number;
  timeRange: {
    start: string;
    end: string;
  };
  breakdown: {
    byMessageType: {
      user: number;
      assistant: number;
      system: number;
    };
    byHour: Array<{ hour: number; tokens: number }>;
    byDay: Array<{ date: string; tokens: number }>;
    bySession: Array<{
      sessionId: string;
      title: string;
      tokens: number;
      messages: number;
    }>;
  };
  patterns: TokenConsumptionPattern[];
}

/**
 * Analytics event types for real-time updates
 */
export type AnalyticsEventType =
  | "token_usage_update"
  | "session_analytics_update" 
  | "performance_metrics_update"
  | "insights_generated";

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  timestamp: string;
  data: any;
}

/**
 * Backend Analytics Service
 * Provides server-side analytics calculations and real-time updates
 */
export class AnalyticsService extends EventEmitter {
  private tokenConsumptionCache: Map<string, TokenConsumptionPattern[]> = new Map();
  private realTimeMetrics: RealTimeMetrics;
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

  constructor() {
    super();
    this.tokenConsumptionCache = new Map();
    this.realTimeMetrics = this.initializeRealTimeMetrics();
  }


  /**
   * Filter sessions by time range
   */
  private filterSessionsByTimeRange(
    sessions: ZodSession[],
    timeRange?: { start: string; end: string }
  ): ZodSession[] {
    if (!timeRange) return sessions;
    
    const startTime = new Date(timeRange.start).getTime();
    const endTime = new Date(timeRange.end).getTime();
    
    return sessions.filter(session => {
      const sessionTime = new Date(session.firstTimestamp || '').getTime();
      return sessionTime >= startTime && sessionTime <= endTime;
    });
  }

  /**
   * Calculate comprehensive token usage analytics from sessions
   */
  async calculateTokenUsageAnalytics(
    sessions: ZodSession[],
    timeRange?: { start: string; end: string }
  ): Promise<TokenUsageAnalytics> {
    const filteredSessions = this.filterSessionsByTimeRange(sessions, timeRange);
    const patterns: TokenConsumptionPattern[] = [];
    
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;

    const byMessageType = { user: 0, assistant: 0, system: 0 };
    const byHourMap = new Map<number, number>();
    const byDayMap = new Map<string, number>();
    const bySessionMap = new Map<string, { title: string; tokens: number; messages: number }>();

    for (const session of filteredSessions) {
      let sessionTokens = 0;
      let sessionMessages = 0;

      for (const entry of session.entries) {
        // Check for usage information - it could be on the entry directly (test structure) 
        // or on the message for assistant entries (schema structure)
        let usage: any = null;
        if (entry.type === 'assistant' && 'message' in entry && entry.message.usage) {
          usage = entry.message.usage;
        } else if ('usage' in entry && (entry as any).usage) {
          usage = (entry as any).usage;
        }
        
        if (usage) {
          const entryInputTokens = usage.input_tokens || 0;
          const entryOutputTokens = usage.output_tokens || 0;
          const entryTokens = entryInputTokens + entryOutputTokens;
          
          totalTokens += entryTokens;
          inputTokens += entryInputTokens;
          outputTokens += entryOutputTokens;
          sessionTokens += entryTokens;
          sessionMessages++;

          // Track by message type
          if (entry.type === "user") {
            byMessageType.user += entryTokens;
          } else if (entry.type === "assistant") {
            byMessageType.assistant += entryTokens;
          } else {
            byMessageType.system += entryTokens;
          }

          // Track by hour - only entries with timestamp property
          if ('timestamp' in entry) {
            const hour = new Date(entry.timestamp).getHours();
            byHourMap.set(hour, (byHourMap.get(hour) || 0) + entryTokens);
          }

          // Track by day - only entries with timestamp property
          if ('timestamp' in entry) {
            const day = entry.timestamp.split("T")[0];
            byDayMap.set(day, (byDayMap.get(day) || 0) + entryTokens);
          }

          // Create consumption pattern - only entries with timestamp property
          if ('timestamp' in entry) {
            patterns.push({
              timestamp: entry.timestamp,
            inputTokens: entryInputTokens,
            outputTokens: entryOutputTokens,
            totalTokens: entryTokens,
            sessionId: session.id,
              messageType: entry.type as "user" | "assistant",
            });
          }
        }
      }

      if (sessionTokens > 0) {
        bySessionMap.set(session.id, {
          title: `Session ${session.id.slice(0, 8)}`,  // Sessions don't have titles
          tokens: sessionTokens,
          messages: sessionMessages,
        });
      }
    }


    const analytics: TokenUsageAnalytics = {
      totalTokens,
      inputTokens,
      outputTokens,
      sessionsAnalyzed: filteredSessions.length,
      timeRange: timeRange || {
        start: this.getEarliestTimestamp(filteredSessions),
        end: new Date().toISOString(),
      },
      breakdown: {
        byMessageType,
        byHour: Array.from(byHourMap.entries()).map(([hour, tokens]) => ({
          hour,
          tokens,
        })).sort((a, b) => a.hour - b.hour),
        byDay: Array.from(byDayMap.entries()).map(([date, tokens]) => ({
          date,
          tokens,
        })).sort((a, b) => a.date.localeCompare(b.date)),
        bySession: Array.from(bySessionMap.entries()).map(([sessionId, data]) => ({
          sessionId,
          ...data,
        })).sort((a, b) => b.tokens - a.tokens),
      },
      patterns,
    };

    // Emit analytics update event
    this.emit("analytics_update", {
      type: "token_usage_update",
      timestamp: new Date().toISOString(),
      data: analytics,
    });

    return analytics;
  }

  /**
   * Generate usage insights and optimization recommendations
   */
  async generateUsageInsights(sessions: ZodSession[]): Promise<UsageInsights> {
    const tokenAnalytics = await this.calculateTokenUsageAnalytics(sessions);
    const insights = this.analyzeUsagePatterns(sessions, tokenAnalytics);
    
    const usageInsights: UsageInsights = {
      totalTokensUsed: tokenAnalytics.totalTokens,
      averageTokensPerSession: tokenAnalytics.totalTokens / Math.max(sessions.length, 1),
      peakUsageHours: this.identifyPeakUsageHours(tokenAnalytics.breakdown.byHour),
      topTokenConsumingSessions: this.getTopTokenConsumingSessions(sessions),
      tokenEfficiencyScore: this.calculateEfficiencyScore(insights),
      recommendations: this.generateRecommendations(insights),
      trends: await this.calculateUsageTrends(sessions),
    };

    // Emit insights update event
    this.emit("analytics_update", {
      type: "insights_generated",
      timestamp: new Date().toISOString(),
      data: usageInsights,
    });

    return usageInsights;
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics(): RealTimeMetrics {
    return { ...this.realTimeMetrics };
  }

  /**
   * Update real-time metrics (called by external systems)
   */
  updateRealTimeMetrics(updates: Partial<RealTimeMetrics>): void {
    this.realTimeMetrics = { ...this.realTimeMetrics, ...updates };
    
    this.emit("analytics_update", {
      type: "performance_metrics_update",
      timestamp: new Date().toISOString(),
      data: this.realTimeMetrics,
    });
  }

  /**
   * Clear analytics cache
   */
  clearCache(): void {
    this.tokenConsumptionCache.clear();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }
    this.removeAllListeners();
    this.clearCache();
  }

  // Private methods

  private initializeRealTimeMetrics(): RealTimeMetrics {
    return {
      currentSessionCount: 0,
      activeConnections: 0,
      tokensPerMinute: 0,
      averageResponseTime: 0,
      cacheHitRate: 85,
      errorRate: 0,
      systemLoad: {
        cpu: 0,
        memory: 0,
        disk: 0,
      },
    };
  }

  private startRealTimeMonitoring(): void {
    // Update metrics periodically
    this.metricsUpdateInterval = setInterval(() => {
      this.updateSystemMetrics();
    }, 30000); // Every 30 seconds
  }

  private updateSystemMetrics(): void {
    // This would integrate with system monitoring in production
    // For now, we'll simulate some metrics
    this.realTimeMetrics.systemLoad = {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
    };
  }


  private generateCacheKey(type: string, timeRange?: { start: string; end: string }): string {
    const timeKey = timeRange ? `_${timeRange.start}_${timeRange.end}` : "_all";
    return `${type}${timeKey}`;
  }

  private isCacheValid(cacheKey: string): boolean {
    // Simple time-based cache validation
    // In production, this would be more sophisticated
    return true; // Placeholder
  }

  private buildTokenAnalyticsFromCache(
    patterns: TokenConsumptionPattern[],
    sessions: ZodSession[],
    timeRange?: { start: string; end: string }
  ): TokenUsageAnalytics {
    // Rebuild analytics from cached patterns
    const totalTokens = patterns.reduce((sum, p) => sum + p.totalTokens, 0);
    const inputTokens = patterns.reduce((sum, p) => sum + p.inputTokens, 0);
    const outputTokens = patterns.reduce((sum, p) => sum + p.outputTokens, 0);

    return {
      totalTokens,
      inputTokens,
      outputTokens,
      sessionsAnalyzed: sessions.length,
      timeRange: timeRange || {
        start: this.getEarliestTimestamp(sessions),
        end: new Date().toISOString(),
      },
      breakdown: {
        byMessageType: { user: 0, assistant: 0, system: 0 }, // Would recalculate
        byHour: [],
        byDay: [],
        bySession: [],
      },
      patterns,
    };
  }


  private analyzeUsagePatterns(sessions: ZodSession[], analytics: TokenUsageAnalytics): any {
    // Analyze patterns for insights generation
    return {
      heavyUsageSessions: analytics.breakdown.bySession.filter(s => s.tokens > 10000),
      peakHours: analytics.breakdown.byHour.filter(h => h.tokens > analytics.totalTokens * 0.1),
      avgTokensPerMessage: analytics.totalTokens / sessions.reduce((sum, s) => sum + s.entries.length, 0),
    };
  }

  private identifyPeakUsageHours(hourlyData: Array<{ hour: number; tokens: number }>): Array<{ hour: number; tokens: number }> {
    return hourlyData
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5); // Top 5 peak hours
  }

  private getTopTokenConsumingSessions(sessions: ZodSession[]): Array<{
    sessionId: string;
    title: string;
    tokens: number;
    duration: number;
  }> {
    return sessions
      .map(session => {
        const totalTokens = session.entries.reduce((sum, entry) => {
          // Check for usage information on entry directly or on message for assistant entries
          let usage: any = null;
          if (entry.type === 'assistant' && 'message' in entry && entry.message.usage) {
            usage = entry.message.usage;
          } else if ('usage' in entry && (entry as any).usage) {
            usage = (entry as any).usage;
          }
          
          if (usage) {
            return sum + ((usage.input_tokens || 0) + (usage.output_tokens || 0));
          }
          return sum;
        }, 0);

        const startTime = new Date(session.firstTimestamp);
        const endTime = new Date(session.lastTimestamp);
        const duration = endTime.getTime() - startTime.getTime();

        return {
          sessionId: session.id,
          title: `Session ${session.id.slice(0, 8)}`,  // Sessions don't have titles
          tokens: totalTokens,
          duration,
        };
      })
      .filter(s => s.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10); // Top 10 sessions
  }

  private calculateEfficiencyScore(insights: any): number {
    // Calculate efficiency score based on various factors
    // This is a simplified calculation
    let score = 100;

    // Deduct points for very high token usage sessions
    if (insights.heavyUsageSessions.length > 0) {
      score -= insights.heavyUsageSessions.length * 5;
    }

    // Add points for consistent usage patterns
    if (insights.peakHours.length < 3) {
      score += 10; // Good distribution
    }

    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(insights: any): Array<{
    type: "optimization" | "usage" | "performance";
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
    impact: string;
  }> {
    const recommendations = [];

    if (insights.heavyUsageSessions.length > 0) {
      recommendations.push({
        type: "optimization" as const,
        priority: "high" as const,
        title: "Optimize High Token Usage Sessions",
        description: `You have ${insights.heavyUsageSessions.length} sessions consuming excessive tokens. Consider breaking them into smaller interactions.`,
        impact: "Could reduce token usage by 15-30%",
      });
    }

    if (insights.peakHours.length > 5) {
      recommendations.push({
        type: "usage" as const,
        priority: "medium" as const,
        title: "Distribute Usage Throughout Day",
        description: "Your usage is heavily concentrated in specific hours. Spreading usage could improve performance.",
        impact: "Better system responsiveness during peak hours",
      });
    }

    if (insights.avgTokensPerMessage > 1000) {
      recommendations.push({
        type: "optimization" as const,
        priority: "medium" as const,
        title: "Optimize Message Length",
        description: "Your average message length is quite high. Consider more concise interactions.",
        impact: "Could reduce token costs by 10-20%",
      });
    }

    return recommendations;
  }

  private async calculateUsageTrends(sessions: ZodSession[]): Promise<{
    daily: Array<{ date: string; tokens: number; sessions: number }>;
    weekly: Array<{ week: string; tokens: number; sessions: number }>;
    monthly: Array<{ month: string; tokens: number; sessions: number }>;
  }> {
    const dailyMap = new Map<string, { tokens: number; sessions: number }>();
    const weeklyMap = new Map<string, { tokens: number; sessions: number }>();
    const monthlyMap = new Map<string, { tokens: number; sessions: number }>();

    for (const session of sessions) {
      const sessionTokens = session.entries.reduce((sum, entry) => {
        // Check for usage information on entry directly or on message for assistant entries
        let usage: any = null;
        if (entry.type === 'assistant' && 'message' in entry && entry.message.usage) {
          usage = entry.message.usage;
        } else if ('usage' in entry && (entry as any).usage) {
          usage = (entry as any).usage;
        }
        
        if (usage) {
          return sum + ((usage.input_tokens || 0) + (usage.output_tokens || 0));
        }
        return sum;
      }, 0);

      const date = new Date(session.firstTimestamp);
      const dayKey = date.toISOString().split("T")[0];
      const weekKey = this.getWeekKey(date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      // Daily
      const daily = dailyMap.get(dayKey) || { tokens: 0, sessions: 0 };
      daily.tokens += sessionTokens;
      daily.sessions += 1;
      dailyMap.set(dayKey, daily);

      // Weekly
      const weekly = weeklyMap.get(weekKey) || { tokens: 0, sessions: 0 };
      weekly.tokens += sessionTokens;
      weekly.sessions += 1;
      weeklyMap.set(weekKey, weekly);

      // Monthly
      const monthly = monthlyMap.get(monthKey) || { tokens: 0, sessions: 0 };
      monthly.tokens += sessionTokens;
      monthly.sessions += 1;
      monthlyMap.set(monthKey, monthly);
    }

    return {
      daily: Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        ...data,
      })).sort((a, b) => a.date.localeCompare(b.date)),
      weekly: Array.from(weeklyMap.entries()).map(([week, data]) => ({
        week,
        ...data,
      })).sort((a, b) => a.week.localeCompare(b.week)),
      monthly: Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        ...data,
      })).sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  public getWeekKey(date: Date): string {
    const { year, week } = this.getISOWeekNumber(date);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  private getISOWeekNumber(date: Date): { year: number; week: number } {
    const tempDate = new Date(date.getTime());
    tempDate.setHours(0, 0, 0, 0);
    // Set to the Thursday of the current week (ISO week date system)
    tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
    // January 4 is always in week 1
    const week1 = new Date(tempDate.getFullYear(), 0, 4);
    // Calculate the week number
    const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return { year: tempDate.getFullYear(), week: weekNum };
  }

  public getEarliestTimestamp(sessions: ZodSession[]): string {
    const timestamps = sessions
      .map(s => s.firstTimestamp)
      .filter(Boolean)
      .sort();
    
    return timestamps[0] || new Date().toISOString();
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();