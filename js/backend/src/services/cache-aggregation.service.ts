import fs from "fs/promises";
import path from "path";
import { EventEmitter } from "events";
import {
  ProjectCache,
  SessionCacheData,
  CachedFileInfo,
  CacheStats,
} from "../utils/cache";
import { getCacheDirectoryService } from "./cache-directory.service";

export interface AggregatedStats {
  totalProjects: number;
  totalSessions: number;
  totalMessages: number;
  totalFiles: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  earliestTimestamp: string;
  latestTimestamp: string;
  averageSessionLength: number;
  averageMessagesPerSession: number;
  averageTokensPerMessage: number;
  totalCacheSizeMB: number;
}

export interface ProjectSummary {
  projectPath: string;
  projectName: string;
  sessionCount: number;
  messageCount: number;
  fileCount: number;
  totalTokens: number;
  averageSessionLength: number;
  lastActivity: string;
  cacheSize: number;
  topSessions: SessionSummary[];
}

export interface SessionSummary {
  sessionId: string;
  projectPath: string;
  messageCount: number;
  firstTimestamp: string;
  lastTimestamp: string;
  totalTokens: number;
  duration: number;
  cwd: string;
  summary?: string;
  firstUserMessage: string;
}

export interface TimeBasedAggregation {
  timeRange: string;
  granularity: "hour" | "day" | "week" | "month";
  dataPoints: Array<{
    timestamp: string;
    messageCount: number;
    sessionCount: number;
    tokenCount: number;
    activeProjects: number;
  }>;
}

export interface QueryOptions {
  projects?: string[];
  sessionIds?: string[];
  fromDate?: string;
  toDate?: string;
  minTokens?: number;
  maxTokens?: number;
  minMessages?: number;
  maxMessages?: number;
  searchText?: string;
  sortBy?: "timestamp" | "tokens" | "messages" | "duration";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface AggregationEvent {
  type:
    | "aggregation_started"
    | "project_processed"
    | "aggregation_completed"
    | "query_executed";
  timestamp: string;
  metadata?: any;
}

export interface CachePerformanceMetrics {
  hitRate: number;
  missRate: number;
  avgQueryTime: number;
  totalQueries: number;
  cacheEfficiency: number;
  memoryUsage: number;
  diskUsage: number;
  buildTime: number;
  lastBuildTime: string;
}

export class CacheAggregationService extends EventEmitter {
  private static instance: CacheAggregationService | null = null;
  private aggregatedCache: Map<string, ProjectCache> = new Map();
  private queryMetrics: Map<
    string,
    { count: number; totalTime: number; lastAccess: number }
  > = new Map();
  private performanceMetrics: CachePerformanceMetrics = {
    hitRate: 0,
    missRate: 0,
    avgQueryTime: 0,
    totalQueries: 0,
    cacheEfficiency: 0,
    memoryUsage: 0,
    diskUsage: 0,
    buildTime: 0,
    lastBuildTime: new Date().toISOString(),
  };

  constructor() {
    super();
  }

  public static getInstance(): CacheAggregationService {
    if (!CacheAggregationService.instance) {
      CacheAggregationService.instance = new CacheAggregationService();
    }
    return CacheAggregationService.instance;
  }

  /**
   * Loads and aggregates cache data from all discovered projects
   */
  public async aggregateAllProjects(
    rootPaths: string[] = [process.cwd()],
  ): Promise<AggregatedStats> {
    const startTime = Date.now();

    this.emit("aggregationEvent", {
      type: "aggregation_started",
      timestamp: new Date().toISOString(),
      metadata: { rootPaths },
    } as AggregationEvent);

    try {
      // Clear existing cache
      this.aggregatedCache.clear();

      // Discover all cache directories
      const cacheDirectoryService = getCacheDirectoryService();
      const allCacheDirectories: any[] = [];

      for (const rootPath of rootPaths) {
        const directories =
          await cacheDirectoryService.discoverCacheDirectories([rootPath]);
        allCacheDirectories.push(...directories);
      }

      // Load cache data from each project
      for (const cacheInfo of allCacheDirectories) {
        try {
          const projectCache = await this.loadProjectCache(
            cacheInfo.projectPath,
          );
          if (projectCache) {
            this.aggregatedCache.set(cacheInfo.projectPath, projectCache);

            this.emit("aggregationEvent", {
              type: "project_processed",
              timestamp: new Date().toISOString(),
              metadata: {
                projectPath: cacheInfo.projectPath,
                sessionCount: Object.keys(projectCache.sessions).length,
                messageCount: projectCache.total_message_count,
              },
            } as AggregationEvent);
          }
        } catch (error) {
          console.warn(
            `Failed to load cache for project ${cacheInfo.projectPath}:`,
            error,
          );
        }
      }

      // Calculate aggregated statistics
      const stats = this.calculateAggregatedStats();

      // Update performance metrics
      this.performanceMetrics.buildTime = Date.now() - startTime;
      this.performanceMetrics.lastBuildTime = new Date().toISOString();

      this.emit("aggregationEvent", {
        type: "aggregation_completed",
        timestamp: new Date().toISOString(),
        metadata: {
          totalProjects: stats.totalProjects,
          totalSessions: stats.totalSessions,
          buildTimeMs: this.performanceMetrics.buildTime,
        },
      } as AggregationEvent);

      return stats;
    } catch (error) {
      throw new Error(`Aggregation failed: ${error}`);
    }
  }

  /**
   * Gets comprehensive statistics across all aggregated projects
   */
  public getAggregatedStats(): AggregatedStats {
    return this.calculateAggregatedStats();
  }

  /**
   * Gets summary information for each project
   */
  public getProjectSummaries(): ProjectSummary[] {
    const summaries: ProjectSummary[] = [];

    for (const [projectPath, cache] of this.aggregatedCache) {
      const projectName = path.basename(projectPath);
      const sessions = Object.values(cache.sessions);

      // Calculate top sessions by token usage
      const topSessions = sessions
        .sort(
          (a, b) =>
            b.total_input_tokens +
            b.total_output_tokens -
            (a.total_input_tokens + a.total_output_tokens),
        )
        .slice(0, 5)
        .map((session) => this.createSessionSummary(session, projectPath));

      const summary: ProjectSummary = {
        projectPath,
        projectName,
        sessionCount: sessions.length,
        messageCount: cache.total_message_count,
        fileCount: Object.keys(cache.cached_files).length,
        totalTokens: cache.total_input_tokens + cache.total_output_tokens,
        averageSessionLength:
          sessions.length > 0
            ? Math.round(cache.total_message_count / sessions.length)
            : 0,
        lastActivity: cache.latest_timestamp,
        cacheSize: this.estimateCacheSize(cache),
        topSessions,
      };

      summaries.push(summary);
    }

    return summaries.sort(
      (a, b) =>
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
    );
  }

  /**
   * Queries sessions with flexible filtering options
   */
  public async querySessions(
    options: QueryOptions = {},
  ): Promise<SessionSummary[]> {
    const startTime = Date.now();
    let sessions: SessionSummary[] = [];

    // Collect all sessions
    for (const [projectPath, cache] of this.aggregatedCache) {
      for (const sessionData of Object.values(cache.sessions)) {
        sessions.push(this.createSessionSummary(sessionData, projectPath));
      }
    }

    // Apply filters
    if (options.projects) {
      sessions = sessions.filter((s) =>
        options.projects!.includes(s.projectPath),
      );
    }

    if (options.sessionIds) {
      sessions = sessions.filter((s) =>
        options.sessionIds!.includes(s.sessionId),
      );
    }

    if (options.fromDate) {
      const fromDate = new Date(options.fromDate);
      sessions = sessions.filter((s) => new Date(s.firstTimestamp) >= fromDate);
    }

    if (options.toDate) {
      const toDate = new Date(options.toDate);
      sessions = sessions.filter((s) => new Date(s.lastTimestamp) <= toDate);
    }

    if (options.minTokens) {
      sessions = sessions.filter((s) => s.totalTokens >= options.minTokens!);
    }

    if (options.maxTokens) {
      sessions = sessions.filter((s) => s.totalTokens <= options.maxTokens!);
    }

    if (options.minMessages) {
      sessions = sessions.filter((s) => s.messageCount >= options.minMessages!);
    }

    if (options.maxMessages) {
      sessions = sessions.filter((s) => s.messageCount <= options.maxMessages!);
    }

    if (options.searchText) {
      const searchLower = options.searchText.toLowerCase();
      sessions = sessions.filter(
        (s) =>
          s.firstUserMessage.toLowerCase().includes(searchLower) ||
          (s.summary && s.summary.toLowerCase().includes(searchLower)) ||
          s.cwd.toLowerCase().includes(searchLower),
      );
    }

    // Apply sorting
    if (options.sortBy) {
      sessions.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (options.sortBy) {
          case "timestamp":
            aValue = new Date(a.firstTimestamp).getTime();
            bValue = new Date(b.firstTimestamp).getTime();
            break;
          case "tokens":
            aValue = a.totalTokens;
            bValue = b.totalTokens;
            break;
          case "messages":
            aValue = a.messageCount;
            bValue = b.messageCount;
            break;
          case "duration":
            aValue = a.duration;
            bValue = b.duration;
            break;
          default:
            return 0;
        }

        const result = aValue - bValue;
        return options.sortOrder === "desc" ? -result : result;
      });
    }

    // Apply pagination
    if (options.offset) {
      sessions = sessions.slice(options.offset);
    }

    if (options.limit) {
      sessions = sessions.slice(0, options.limit);
    }

    // Update query metrics
    const queryTime = Date.now() - startTime;
    this.updateQueryMetrics("querySessions", queryTime);

    this.emit("aggregationEvent", {
      type: "query_executed",
      timestamp: new Date().toISOString(),
      metadata: {
        queryType: "sessions",
        resultCount: sessions.length,
        queryTime,
        options,
      },
    } as AggregationEvent);

    return sessions;
  }

  /**
   * Creates time-based aggregations for trend analysis
   */
  public createTimeBasedAggregation(
    granularity: "hour" | "day" | "week" | "month" = "day",
    fromDate?: string,
    toDate?: string,
  ): TimeBasedAggregation {
    const startDate = fromDate
      ? new Date(fromDate)
      : this.getEarliestTimestamp();
    const endDate = toDate ? new Date(toDate) : new Date();

    const dataPoints = this.generateTimeDataPoints(
      startDate,
      endDate,
      granularity,
    );

    return {
      timeRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      granularity,
      dataPoints,
    };
  }

  /**
   * Gets cache performance metrics
   */
  public getCachePerformanceMetrics(): CachePerformanceMetrics {
    // Calculate hit rate from query metrics
    const totalQueries = Array.from(this.queryMetrics.values()).reduce(
      (sum, metric) => sum + metric.count,
      0,
    );

    const avgQueryTime =
      totalQueries > 0
        ? Array.from(this.queryMetrics.values()).reduce(
            (sum, metric) => sum + metric.totalTime,
            0,
          ) / totalQueries
        : 0;

    // Estimate cache efficiency based on aggregated data size vs disk usage
    const estimatedDataSize = Array.from(this.aggregatedCache.values()).reduce(
      (sum, cache) => sum + this.estimateCacheSize(cache),
      0,
    );

    return {
      ...this.performanceMetrics,
      totalQueries,
      avgQueryTime,
      cacheEfficiency:
        estimatedDataSize > 0
          ? Math.min(
              100,
              (estimatedDataSize /
                (this.performanceMetrics.diskUsage || estimatedDataSize)) *
                100,
            )
          : 100,
      memoryUsage: this.getMemoryUsageMB(),
    };
  }

  /**
   * Gets top sessions by various criteria
   */
  public getTopSessions(
    criteria: "tokens" | "messages" | "duration" = "tokens",
    limit: number = 10,
  ): SessionSummary[] {
    const allSessions: SessionSummary[] = [];

    for (const [projectPath, cache] of this.aggregatedCache) {
      for (const sessionData of Object.values(cache.sessions)) {
        allSessions.push(this.createSessionSummary(sessionData, projectPath));
      }
    }

    switch (criteria) {
      case "tokens":
        allSessions.sort((a, b) => b.totalTokens - a.totalTokens);
        break;
      case "messages":
        allSessions.sort((a, b) => b.messageCount - a.messageCount);
        break;
      case "duration":
        allSessions.sort((a, b) => b.duration - a.duration);
        break;
    }

    return allSessions.slice(0, limit);
  }

  /**
   * Gets usage statistics by time period
   */
  public getUsageByPeriod(
    period: "daily" | "weekly" | "monthly" = "daily",
    days: number = 30,
  ): Array<{
    date: string;
    sessionCount: number;
    messageCount: number;
    tokenCount: number;
    activeProjects: Set<string>;
  }> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const usage = new Map<
      string,
      {
        sessionCount: number;
        messageCount: number;
        tokenCount: number;
        activeProjects: Set<string>;
      }
    >();

    // Initialize time buckets
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateKey = d.toISOString().split("T")[0];
      usage.set(dateKey, {
        sessionCount: 0,
        messageCount: 0,
        tokenCount: 0,
        activeProjects: new Set(),
      });
    }

    // Aggregate data by date
    for (const [projectPath, cache] of this.aggregatedCache) {
      for (const sessionData of Object.values(cache.sessions)) {
        const sessionDate = new Date(sessionData.first_timestamp)
          .toISOString()
          .split("T")[0];
        const bucket = usage.get(sessionDate);

        if (bucket) {
          bucket.sessionCount++;
          bucket.messageCount += sessionData.message_count;
          bucket.tokenCount +=
            sessionData.total_input_tokens + sessionData.total_output_tokens;
          bucket.activeProjects.add(projectPath);
        }
      }
    }

    return Array.from(usage.entries()).map(([date, data]) => ({
      date,
      sessionCount: data.sessionCount,
      messageCount: data.messageCount,
      tokenCount: data.tokenCount,
      activeProjects: data.activeProjects,
    }));
  }

  /**
   * Private helper methods
   */
  private async loadProjectCache(
    projectPath: string,
  ): Promise<ProjectCache | null> {
    try {
      const cachePath = path.join(projectPath, ".cache", "index.json");
      const content = await fs.readFile(cachePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  private calculateAggregatedStats(): AggregatedStats {
    let totalSessions = 0;
    let totalMessages = 0;
    let totalFiles = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheCreationTokens = 0;
    let totalCacheReadTokens = 0;
    let earliestTimestamp = new Date().toISOString();
    let latestTimestamp = new Date(0).toISOString();
    let totalCacheSizeMB = 0;

    for (const cache of this.aggregatedCache.values()) {
      totalSessions += Object.keys(cache.sessions).length;
      totalMessages += cache.total_message_count;
      totalFiles += Object.keys(cache.cached_files).length;
      totalInputTokens += cache.total_input_tokens;
      totalOutputTokens += cache.total_output_tokens;
      totalCacheCreationTokens += cache.total_cache_creation_tokens;
      totalCacheReadTokens += cache.total_cache_read_tokens;
      totalCacheSizeMB += this.estimateCacheSize(cache);

      if (cache.earliest_timestamp < earliestTimestamp) {
        earliestTimestamp = cache.earliest_timestamp;
      }
      if (cache.latest_timestamp > latestTimestamp) {
        latestTimestamp = cache.latest_timestamp;
      }
    }

    return {
      totalProjects: this.aggregatedCache.size,
      totalSessions,
      totalMessages,
      totalFiles,
      totalInputTokens,
      totalOutputTokens,
      totalCacheCreationTokens,
      totalCacheReadTokens,
      earliestTimestamp,
      latestTimestamp,
      averageSessionLength:
        totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0,
      averageMessagesPerSession:
        totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0,
      averageTokensPerMessage:
        totalMessages > 0
          ? Math.round((totalInputTokens + totalOutputTokens) / totalMessages)
          : 0,
      totalCacheSizeMB,
    };
  }

  private createSessionSummary(
    sessionData: SessionCacheData,
    projectPath: string,
  ): SessionSummary {
    const duration =
      new Date(sessionData.last_timestamp).getTime() -
      new Date(sessionData.first_timestamp).getTime();

    return {
      sessionId: sessionData.session_id,
      projectPath,
      messageCount: sessionData.message_count,
      firstTimestamp: sessionData.first_timestamp,
      lastTimestamp: sessionData.last_timestamp,
      totalTokens:
        sessionData.total_input_tokens + sessionData.total_output_tokens,
      duration,
      cwd: sessionData.cwd || "",
      summary: sessionData.summary,
      firstUserMessage: sessionData.first_user_message,
    };
  }

  private estimateCacheSize(cache: ProjectCache): number {
    // Rough estimation based on JSON size
    const jsonSize = JSON.stringify(cache).length;
    return Math.round((jsonSize / 1024 / 1024) * 100) / 100; // MB with 2 decimal places
  }

  private getEarliestTimestamp(): Date {
    let earliest = new Date();

    for (const cache of this.aggregatedCache.values()) {
      const cacheEarliest = new Date(cache.earliest_timestamp);
      if (cacheEarliest < earliest) {
        earliest = cacheEarliest;
      }
    }

    return earliest;
  }

  private generateTimeDataPoints(
    startDate: Date,
    endDate: Date,
    granularity: "hour" | "day" | "week" | "month",
  ): TimeBasedAggregation["dataPoints"] {
    const dataPoints: TimeBasedAggregation["dataPoints"] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const timestamp = current.toISOString();
      let messageCount = 0;
      let sessionCount = 0;
      let tokenCount = 0;
      const activeProjects = new Set<string>();

      // Count data for this time period
      for (const [projectPath, cache] of this.aggregatedCache) {
        for (const sessionData of Object.values(cache.sessions)) {
          const sessionDate = new Date(sessionData.first_timestamp);

          if (this.isInTimePeriod(sessionDate, current, granularity)) {
            sessionCount++;
            messageCount += sessionData.message_count;
            tokenCount +=
              sessionData.total_input_tokens + sessionData.total_output_tokens;
            activeProjects.add(projectPath);
          }
        }
      }

      dataPoints.push({
        timestamp,
        messageCount,
        sessionCount,
        tokenCount,
        activeProjects: activeProjects.size,
      });

      // Advance to next period
      this.advanceDate(current, granularity);
    }

    return dataPoints;
  }

  private isInTimePeriod(
    date: Date,
    periodStart: Date,
    granularity: "hour" | "day" | "week" | "month",
  ): boolean {
    const periodEnd = new Date(periodStart);
    this.advanceDate(periodEnd, granularity);

    return date >= periodStart && date < periodEnd;
  }

  private advanceDate(
    date: Date,
    granularity: "hour" | "day" | "week" | "month",
  ): void {
    switch (granularity) {
      case "hour":
        date.setHours(date.getHours() + 1);
        break;
      case "day":
        date.setDate(date.getDate() + 1);
        break;
      case "week":
        date.setDate(date.getDate() + 7);
        break;
      case "month":
        date.setMonth(date.getMonth() + 1);
        break;
    }
  }

  private updateQueryMetrics(queryType: string, queryTime: number): void {
    const metric = this.queryMetrics.get(queryType) || {
      count: 0,
      totalTime: 0,
      lastAccess: 0,
    };
    metric.count++;
    metric.totalTime += queryTime;
    metric.lastAccess = Date.now();
    this.queryMetrics.set(queryType, metric);
  }

  private getMemoryUsageMB(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024;
  }

  /**
   * Clears all aggregated data
   */
  public clearAggregatedData(): void {
    this.aggregatedCache.clear();
    this.queryMetrics.clear();
  }

  /**
   * Shuts down the service and cleans up resources
   */
  public async shutdown(): Promise<void> {
    this.clearAggregatedData();
    this.removeAllListeners();
  }
}

// Singleton instance getter
export function getCacheAggregationService(): CacheAggregationService {
  return CacheAggregationService.getInstance();
}
