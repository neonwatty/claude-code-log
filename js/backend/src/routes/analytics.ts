import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { 
  JsonlParser,
  aggregateUsage,
  organizeIntoSessionsOptimized,
  parseTranscriptEntriesOptimized,
  SessionInfo,
  ExtendedUsageInfo,
  SessionTokenUsage,
} from '@app/shared';
import { 
  validateSchema, 
  sessionValidationSchemas, 
  sessionErrorHandler
} from '../middleware/sessionValidation';

const router = Router();

/**
 * Analytics service for processing session and usage data
 */
export class AnalyticsService {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  /**
   * Check if cache entry is valid
   */
  private static isCacheValid(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Set cache entry with TTL
   */
  private static setCache(key: string, data: any, ttl: number = 10 * 60 * 1000): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  /**
   * Get cached data or return null
   */
  private static getCache(key: string): any | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key)?.data || null;
    }
    return null;
  }

  /**
   * Parse JSONL files from directory
   */
  static async parseJsonlFiles(directoryPath: string) {
    const parser = new JsonlParser({ 
      skipInvalidLines: true,
      batchSize: 1000,
    });

    const { promises: fs } = await import('fs');
    const { join } = await import('path');
    
    const files = await fs.readdir(directoryPath);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) {
      throw new Error(`No JSONL files found in directory: ${directoryPath}`);
    }

    let allEntries: any[] = [];
    let allErrors: any[] = [];

    for (const file of jsonlFiles) {
      const filePath = join(directoryPath, file);
      try {
        const result = await parser.parseFile(filePath);
        if (result.entries && Array.isArray(result.entries)) {
          allEntries.push(...result.entries);
        }
        if (result.errors && Array.isArray(result.errors)) {
          allErrors.push(...result.errors.map((err: any) => ({ ...err, file })));
        }
      } catch (error) {
        allErrors.push({
          file,
          error: error instanceof Error ? error.message : String(error),
          lineNumber: 0,
          line: '',
        });
      }
    }

    return { entries: allEntries || [], errors: allErrors || [], fileCount: jsonlFiles.length };
  }

  /**
   * Calculate comprehensive token usage analytics
   */
  static async calculateTokenAnalytics(entries: any[]): Promise<{
    totalUsage: SessionTokenUsage;
    sessionBreakdown: Array<{
      sessionId: string;
      usage: SessionTokenUsage;
      messageCount: number;
      timeRange: { start: Date | null; end: Date | null };
    }>;
    dailyUsage: Array<{
      date: string;
      usage: SessionTokenUsage;
      sessionCount: number;
    }>;
    modelBreakdown: Record<string, SessionTokenUsage>;
    costEstimates: {
      total: number;
      byModel: Record<string, number>;
      byDay: Array<{ date: string; cost: number }>;
    };
  }> {
    const cacheKey = `token-analytics-${entries.length}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      if (!entries || !Array.isArray(entries)) {
        throw new Error(`Invalid entries parameter: expected array, got ${typeof entries}`);
      }
      
      // Organize into sessions
      const sessions = await organizeIntoSessionsOptimized(entries, {
        includeTokenUsage: true,
        useCache: true,
      });
      

      // Calculate total usage
      const validEntries = entries.filter(entry => entry && typeof entry === 'object');
      const totalUsage = aggregateUsage(validEntries);

      // Session breakdown
      const sessionBreakdown = sessions.map((session: any) => ({
        sessionId: session.sessionId,
        usage: session.tokenUsage || {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
        },
        messageCount: session.messageCount,
        timeRange: session.timeRange,
      }));

      // Daily usage aggregation
      const dailyMap = new Map<string, { usage: SessionTokenUsage; sessionIds: Set<string> }>();
      
      sessions.forEach((session: any) => {
        if (session.timeRange.start && session.tokenUsage) {
          const date = session.timeRange.start.toISOString().split('T')[0];
          
          if (!dailyMap.has(date)) {
            dailyMap.set(date, {
              usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
              sessionIds: new Set(),
            });
          }
          
          const dayData = dailyMap.get(date)!;
          dayData.usage.input_tokens += session.tokenUsage.input_tokens || 0;
          dayData.usage.output_tokens += session.tokenUsage.output_tokens || 0;
          dayData.usage.total_tokens += session.tokenUsage.total_tokens || 0;
          dayData.sessionIds.add(session.sessionId);
        }
      });

      const dailyUsage = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        usage: data.usage,
        sessionCount: data.sessionIds.size,
      })).sort((a, b) => a.date.localeCompare(b.date));

      // Model breakdown
      const modelMap = new Map<string, SessionTokenUsage>();
      
      entries.forEach(entry => {
        if (entry.type === 'assistant' && entry.message?.model && entry.message?.usage) {
          const model = entry.message.model;
          const usage = entry.message.usage;
          
          if (!modelMap.has(model)) {
            modelMap.set(model, { input_tokens: 0, output_tokens: 0, total_tokens: 0 });
          }
          
          const modelUsage = modelMap.get(model)!;
          modelUsage.input_tokens += usage.input_tokens || 0;
          modelUsage.output_tokens += usage.output_tokens || 0;
          modelUsage.total_tokens += (usage.input_tokens || 0) + (usage.output_tokens || 0);
        }
      });

      const modelBreakdown = Object.fromEntries(modelMap);

      // Cost estimates (simplified pricing - would need real pricing data)
      const costEstimates = this.calculateCostEstimates(totalUsage, modelBreakdown, dailyUsage);

      const result = {
        totalUsage,
        sessionBreakdown,
        dailyUsage,
        modelBreakdown,
        costEstimates,
      };

      this.setCache(cacheKey, result, 15 * 60 * 1000); // 15 minutes cache
      return result;
    } catch (error) {
      throw new Error(`Failed to calculate token analytics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate usage patterns and insights
   */
  static async calculateUsagePatterns(entries: any[]): Promise<{
    timePatterns: {
      hourlyDistribution: Array<{ hour: number; messageCount: number; tokenCount: number }>;
      dayOfWeekDistribution: Array<{ day: number; dayName: string; messageCount: number }>;
      monthlyTrends: Array<{ month: string; messageCount: number; sessionCount: number }>;
    };
    contentPatterns: {
      avgMessageLength: number;
      toolUsageFrequency: Record<string, number>;
      mostActiveDirectories: Array<{ directory: string; messageCount: number; sessionCount: number }>;
    };
    sessionPatterns: {
      avgSessionLength: number;
      sessionDurationDistribution: Array<{ range: string; count: number }>;
      messagesPerSession: Array<{ range: string; count: number }>;
    };
  }> {
    const cacheKey = `usage-patterns-${entries.length}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const sessions = await organizeIntoSessionsOptimized(entries);
      const messages = await parseTranscriptEntriesOptimized(entries, { extractToolInfo: true });

      // Time patterns
      const hourlyMap = new Map<number, { messageCount: number; tokenCount: number }>();
      const dayOfWeekMap = new Map<number, number>();
      const monthlyMap = new Map<string, { messageCount: number; sessionIds: Set<string> }>();

      entries.forEach(entry => {
        if (entry.timestamp) {
          const date = new Date(entry.timestamp);
          const hour = date.getHours();
          const dayOfWeek = date.getDay();
          const month = date.toISOString().substring(0, 7); // YYYY-MM

          // Hourly
          if (!hourlyMap.has(hour)) {
            hourlyMap.set(hour, { messageCount: 0, tokenCount: 0 });
          }
          const hourData = hourlyMap.get(hour)!;
          hourData.messageCount++;
          if (entry.type === 'assistant' && entry.message?.usage) {
            hourData.tokenCount += entry.message.usage.output_tokens || 0;
          }

          // Day of week
          dayOfWeekMap.set(dayOfWeek, (dayOfWeekMap.get(dayOfWeek) || 0) + 1);

          // Monthly
          if (!monthlyMap.has(month)) {
            monthlyMap.set(month, { messageCount: 0, sessionIds: new Set() });
          }
          const monthData = monthlyMap.get(month)!;
          monthData.messageCount++;
          if (entry.sessionId) {
            monthData.sessionIds.add(entry.sessionId);
          }
        }
      });

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      const timePatterns = {
        hourlyDistribution: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          messageCount: hourlyMap.get(hour)?.messageCount || 0,
          tokenCount: hourlyMap.get(hour)?.tokenCount || 0,
        })),
        dayOfWeekDistribution: Array.from({ length: 7 }, (_, day) => ({
          day,
          dayName: dayNames[day],
          messageCount: dayOfWeekMap.get(day) || 0,
        })),
        monthlyTrends: Array.from(monthlyMap.entries()).map(([month, data]) => ({
          month,
          messageCount: data.messageCount,
          sessionCount: data.sessionIds.size,
        })).sort((a, b) => a.month.localeCompare(b.month)),
      };

      // Content patterns
      const toolUsageMap = new Map<string, number>();
      const directoryMap = new Map<string, { messageCount: number; sessionIds: Set<string> }>();
      let totalMessageLength = 0;
      let messageCount = 0;

      messages.forEach((message: any) => {
        // Tool usage
        if (message.hasToolUse) {
          message.parsedContent.forEach((content: any) => {
            if (content.type === 'tool_use' && content.metadata?.toolName) {
              toolUsageMap.set(
                content.metadata.toolName,
                (toolUsageMap.get(content.metadata.toolName) || 0) + 1
              );
            }
          });
        }

        // Message length
        const textContent = message.parsedContent
          .filter((c: any) => c.type === 'text' || c.type === 'markdown')
          .map((c: any) => c.content)
          .join(' ');
        totalMessageLength += textContent.length;
        messageCount++;
      });

      entries.forEach(entry => {
        if (entry.cwd) {
          if (!directoryMap.has(entry.cwd)) {
            directoryMap.set(entry.cwd, { messageCount: 0, sessionIds: new Set() });
          }
          const dirData = directoryMap.get(entry.cwd)!;
          dirData.messageCount++;
          if (entry.sessionId) {
            dirData.sessionIds.add(entry.sessionId);
          }
        }
      });

      const contentPatterns = {
        avgMessageLength: messageCount > 0 ? Math.round(totalMessageLength / messageCount) : 0,
        toolUsageFrequency: Object.fromEntries(
          Array.from(toolUsageMap.entries()).sort((a, b) => b[1] - a[1])
        ),
        mostActiveDirectories: Array.from(directoryMap.entries())
          .map(([directory, data]) => ({
            directory,
            messageCount: data.messageCount,
            sessionCount: data.sessionIds.size,
          }))
          .sort((a, b) => b.messageCount - a.messageCount)
          .slice(0, 10),
      };

      // Session patterns
      const sessionDurations: number[] = [];
      const sessionMessageCounts: number[] = [];

      sessions.forEach((session: any) => {
        sessionMessageCounts.push(session.messageCount);
        
        if (session.timeRange.start && session.timeRange.end) {
          const duration = session.timeRange.end.getTime() - session.timeRange.start.getTime();
          sessionDurations.push(Math.round(duration / (1000 * 60))); // Duration in minutes
        }
      });

      const avgSessionLength = sessionDurations.length > 0
        ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length)
        : 0;

      const sessionPatterns = {
        avgSessionLength,
        sessionDurationDistribution: this.createDistribution(sessionDurations, [
          { min: 0, max: 5, label: '0-5 min' },
          { min: 5, max: 15, label: '5-15 min' },
          { min: 15, max: 30, label: '15-30 min' },
          { min: 30, max: 60, label: '30-60 min' },
          { min: 60, max: Infinity, label: '60+ min' },
        ]),
        messagesPerSession: this.createDistribution(sessionMessageCounts, [
          { min: 1, max: 5, label: '1-5 messages' },
          { min: 5, max: 10, label: '5-10 messages' },
          { min: 10, max: 20, label: '10-20 messages' },
          { min: 20, max: 50, label: '20-50 messages' },
          { min: 50, max: Infinity, label: '50+ messages' },
        ]),
      };

      const result = {
        timePatterns,
        contentPatterns,
        sessionPatterns,
      };

      this.setCache(cacheKey, result, 20 * 60 * 1000); // 20 minutes cache
      return result;
    } catch (error) {
      throw new Error(`Failed to calculate usage patterns: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create distribution buckets for numeric data
   */
  private static createDistribution(
    values: number[],
    ranges: Array<{ min: number; max: number; label: string }>
  ): Array<{ range: string; count: number }> {
    return ranges.map(range => ({
      range: range.label,
      count: values.filter(v => v >= range.min && v < range.max).length,
    }));
  }

  /**
   * Calculate cost estimates (simplified)
   */
  private static calculateCostEstimates(
    totalUsage: SessionTokenUsage,
    modelBreakdown: Record<string, SessionTokenUsage>,
    dailyUsage: Array<{ date: string; usage: SessionTokenUsage; sessionCount: number }>
  ) {
    // Simplified pricing (would need real pricing data from Claude/OpenAI)
    const pricing = {
      'claude-3-sonnet-20240229': { input: 0.003 / 1000, output: 0.015 / 1000 },
      'claude-3-haiku-20240307': { input: 0.00025 / 1000, output: 0.00125 / 1000 },
      'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
      'gpt-3.5-turbo': { input: 0.0015 / 1000, output: 0.002 / 1000 },
      'default': { input: 0.003 / 1000, output: 0.015 / 1000 },
    };

    const byModel: Record<string, number> = {};
    let total = 0;

    Object.entries(modelBreakdown).forEach(([model, usage]) => {
      const modelPricing = pricing[model as keyof typeof pricing] || pricing.default;
      const cost = 
        (usage.input_tokens * modelPricing.input) + 
        (usage.output_tokens * modelPricing.output);
      byModel[model] = cost;
      total += cost;
    });

    const byDay = dailyUsage.map(day => {
      const defaultPricing = pricing.default;
      const cost = 
        (day.usage.input_tokens * defaultPricing.input) + 
        (day.usage.output_tokens * defaultPricing.output);
      return {
        date: day.date,
        cost,
      };
    });

    return {
      total: Math.round(total * 100) / 100, // Round to 2 decimal places
      byModel: Object.fromEntries(
        Object.entries(byModel).map(([model, cost]) => [model, Math.round(cost * 100) / 100])
      ),
      byDay: byDay.map(day => ({
        ...day,
        cost: Math.round(day.cost * 100) / 100,
      })),
    };
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.cache.clear();
  }
}


/**
 * POST /api/analytics/tokens
 * Get comprehensive token usage analytics
 */
router.post('/tokens', validateSchema(sessionValidationSchemas.directoryPath), async (req: Request, res: Response) => {
  try {
    const { directoryPath } = req.body;
    const parseResult = await AnalyticsService.parseJsonlFiles(directoryPath);
    const analytics = await AnalyticsService.calculateTokenAnalytics(parseResult.entries || []);
    
    res.json({
      success: true,
      data: {
        ...analytics,
        metadata: {
          fileCount: parseResult.fileCount,
          totalEntries: parseResult.entries.length,
          errorCount: parseResult.errors.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate token analytics',
    });
  }
});

/**
 * POST /api/analytics/patterns
 * Get usage patterns and insights
 */
router.post('/patterns', validateSchema(sessionValidationSchemas.directoryPath), async (req: Request, res: Response) => {
  try {
    const { directoryPath } = req.body;
    
    const parseResult = await AnalyticsService.parseJsonlFiles(directoryPath);
    const patterns = await AnalyticsService.calculateUsagePatterns(parseResult.entries);
    
    res.json({
      success: true,
      data: {
        ...patterns,
        metadata: {
          fileCount: parseResult.fileCount,
          totalEntries: parseResult.entries.length,
          analysisDate: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate usage patterns',
    });
  }
});

/**
 * POST /api/analytics/summary
 * Get high-level summary analytics
 */
router.post('/summary', validateSchema(sessionValidationSchemas.directoryPath), async (req: Request, res: Response) => {
  try {
    const { directoryPath } = req.body;
    
    const parseResult = await AnalyticsService.parseJsonlFiles(directoryPath);
    
    // Run both analytics in parallel for better performance
    const [tokenAnalytics, patterns] = await Promise.all([
      AnalyticsService.calculateTokenAnalytics(parseResult.entries),
      AnalyticsService.calculateUsagePatterns(parseResult.entries),
    ]);
    
    // Create summary
    const summary = {
      overview: {
        totalSessions: tokenAnalytics.sessionBreakdown.length,
        totalMessages: parseResult.entries.length,
        totalTokens: tokenAnalytics.totalUsage.total_tokens,
        estimatedCost: tokenAnalytics.costEstimates.total,
        fileCount: parseResult.fileCount,
        timeSpan: {
          start: tokenAnalytics.sessionBreakdown
            .filter(s => s.timeRange.start)
            .sort((a, b) => a.timeRange.start!.getTime() - b.timeRange.start!.getTime())[0]?.timeRange.start,
          end: tokenAnalytics.sessionBreakdown
            .filter(s => s.timeRange.end)
            .sort((a, b) => b.timeRange.end!.getTime() - a.timeRange.end!.getTime())[0]?.timeRange.end,
        },
      },
      highlights: {
        mostUsedModel: Object.entries(tokenAnalytics.modelBreakdown)
          .sort((a, b) => b[1].total_tokens - a[1].total_tokens)[0]?.[0] || 'N/A',
        mostActiveTool: Object.entries(patterns.contentPatterns.toolUsageFrequency)[0]?.[0] || 'N/A',
        avgSessionLength: patterns.sessionPatterns.avgSessionLength,
        avgMessageLength: patterns.contentPatterns.avgMessageLength,
        peakUsageHour: patterns.timePatterns.hourlyDistribution
          .sort((a, b) => b.messageCount - a.messageCount)[0]?.hour || 0,
      },
      trends: {
        dailyUsage: tokenAnalytics.dailyUsage.slice(-7), // Last 7 days
        monthlyTrends: patterns.timePatterns.monthlyTrends.slice(-3), // Last 3 months
      },
    };
    
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate analytics summary',
    });
  }
});

/**
 * DELETE /api/analytics/cache
 * Clear analytics cache
 */
router.delete('/cache', (req: Request, res: Response) => {
  try {
    AnalyticsService.clearCache();
    
    res.json({
      success: true,
      message: 'Analytics cache cleared successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear analytics cache',
    });
  }
});

// Add error handler middleware
router.use(sessionErrorHandler);

export default router;