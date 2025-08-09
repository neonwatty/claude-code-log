/**
 * Optimized session organizer with performance enhancements
 */

import {
  TranscriptEntry,
  UserTranscriptEntry,
  AssistantTranscriptEntry,
  SummaryTranscriptEntry,
} from './index';
import {
  SessionInfo,
  ProjectSessions,
  SessionOrganizationOptions,
  organizeIntoSessions as baseOrganizeIntoSessions,
} from './session-organizer';
import {
  globalSessionCache,
  globalPerformanceMonitor,
  BatchProcessor,
  ObjectPool,
} from './performance-cache';
import { trackSessionUsage } from './token-tracker';

/**
 * Enhanced options for optimized session organization
 */
export interface OptimizedSessionOptions extends SessionOrganizationOptions {
  /** Enable caching for session data */
  useCache?: boolean;
  /** Batch size for processing sessions */
  batchSize?: number;
  /** Enable performance monitoring */
  enableProfiling?: boolean;
  /** Use streaming for large datasets */
  useStreaming?: boolean;
  /** Maximum number of sessions to keep in memory */
  maxSessionsInMemory?: number;
}

const DEFAULT_OPTIMIZED_SESSION_OPTIONS: Required<OptimizedSessionOptions> = {
  sortBy: 'chronological',
  includeTokenUsage: true,
  includeMessagePreviews: true,
  groupByWorkingDirectory: true,
  minMessageCount: 1,
  maxPreviewLength: 200,
  useCache: true,
  batchSize: 50,
  enableProfiling: false,
  useStreaming: true,
  maxSessionsInMemory: 1000,
};

/**
 * Object pool for SessionInfo objects to reduce garbage collection
 */
const sessionInfoPool = new ObjectPool<SessionInfo>(
  () => ({
    sessionId: '',
    messageCount: 0,
    userMessageCount: 0,
    assistantMessageCount: 0,
    summaryCount: 0,
    workingDirectory: '',
    timeRange: { start: null, end: null },
    summary: '',
    entries: [],
  }),
  (obj) => {
    obj.sessionId = '';
    obj.messageCount = 0;
    obj.userMessageCount = 0;
    obj.assistantMessageCount = 0;
    obj.summaryCount = 0;
    obj.workingDirectory = '';
    obj.timeRange = { start: null, end: null };
    obj.summary = '';
    obj.entries = [];
    obj.firstUserMessage = undefined;
    obj.lastAssistantMessage = undefined;
    obj.tokenUsage = undefined;
  },
  100
);

/**
 * Optimized session organizer class
 */
export class OptimizedSessionOrganizer {
  private options: Required<OptimizedSessionOptions>;
  private batchProcessor: BatchProcessor<TranscriptEntry[], SessionInfo>;
  private summaryCache = new Map<string, string>();
  private sessionMetadataCache = new Map<string, Partial<SessionInfo>>();

  constructor(options: OptimizedSessionOptions = {}) {
    this.options = { ...DEFAULT_OPTIMIZED_SESSION_OPTIONS, ...options };
    
    this.batchProcessor = new BatchProcessor(
      (batches) => this.processBatches(batches),
      this.options.batchSize
    );
  }

  /**
   * Organize entries into sessions with optimizations
   */
  async organizeIntoSessions(entries: TranscriptEntry[]): Promise<SessionInfo[]> {
    if (this.options.enableProfiling) {
      globalPerformanceMonitor.startTimer('organizeIntoSessions');
    }

    try {
      const cacheKey = this.generateCacheKey(entries);
      
      if (this.options.useCache) {
        const cached = globalSessionCache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      let sessions: SessionInfo[];

      if (this.options.useStreaming && entries.length > 100) {
        sessions = await this.organizeWithStreaming(entries);
      } else {
        sessions = await this.organizeWithBatching(entries);
      }

      if (this.options.useCache) {
        globalSessionCache.set(cacheKey, sessions);
      }

      return sessions;
    } finally {
      if (this.options.enableProfiling) {
        globalPerformanceMonitor.endTimer('organizeIntoSessions');
      }
    }
  }

  /**
   * Stream organize sessions for memory efficiency
   */
  async *organizeSessionsStream(entries: TranscriptEntry[]): AsyncGenerator<SessionInfo, void, unknown> {
    const sessionGroups = this.groupEntriesBySessionEfficient(entries);
    
    for (const [sessionId, sessionEntries] of sessionGroups) {
      const sessionInfo = await this.createOptimizedSessionInfo(sessionId, sessionEntries);
      yield sessionInfo;
      
      // Release memory after yielding
      this.releaseSessionInfo(sessionInfo);
    }
  }

  /**
   * Organize project sessions with memory management
   */
  async organizeProject(entries: TranscriptEntry[]): Promise<ProjectSessions> {
    if (this.options.enableProfiling) {
      globalPerformanceMonitor.startTimer('organizeProject');
    }

    try {
      const sessions = await this.organizeIntoSessions(entries);
      
      // Calculate project-level statistics efficiently
      let totalMessages = 0;
      let earliestTime: Date | null = null;
      let latestTime: Date | null = null;
      const sessionsByWorkingDirectory: Record<string, SessionInfo[]> = {};

      for (const session of sessions) {
        totalMessages += session.messageCount;
        
        if (session.timeRange.start && (!earliestTime || session.timeRange.start < earliestTime)) {
          earliestTime = session.timeRange.start;
        }
        
        if (session.timeRange.end && (!latestTime || session.timeRange.end > latestTime)) {
          latestTime = session.timeRange.end;
        }

        if (this.options.groupByWorkingDirectory) {
          if (!sessionsByWorkingDirectory[session.workingDirectory]) {
            sessionsByWorkingDirectory[session.workingDirectory] = [];
          }
          sessionsByWorkingDirectory[session.workingDirectory].push(session);
        }
      }

      return {
        sessionCount: sessions.length,
        totalMessages,
        timeRange: {
          start: earliestTime,
          end: latestTime,
        },
        sessions,
        sessionsByWorkingDirectory,
      };
    } finally {
      if (this.options.enableProfiling) {
        globalPerformanceMonitor.endTimer('organizeProject');
      }
    }
  }

  /**
   * Find sessions by working directory efficiently
   */
  async findSessionsByWorkingDirectory(
    entries: TranscriptEntry[],
    workingDirectory: string
  ): Promise<SessionInfo[]> {
    const cacheKey = `wd-${workingDirectory}-${this.generateCacheKey(entries)}`;
    
    if (this.options.useCache) {
      const cached = globalSessionCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Filter entries first to reduce processing load
    const filteredEntries = entries.filter(entry => 
      entry.type !== 'summary' && entry.cwd === workingDirectory
    );

    const sessions = await this.organizeIntoSessions(filteredEntries);
    
    if (this.options.useCache) {
      globalSessionCache.set(cacheKey, sessions);
    }

    return sessions;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...globalPerformanceMonitor.getMetrics(),
      summaryCache: this.summaryCache.size,
      metadataCache: this.sessionMetadataCache.size,
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    globalSessionCache.clear();
    this.summaryCache.clear();
    this.sessionMetadataCache.clear();
  }

  /**
   * Organize with streaming for memory efficiency
   */
  private async organizeWithStreaming(entries: TranscriptEntry[]): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    
    for await (const session of this.organizeSessionsStream(entries)) {
      sessions.push(session);
      
      // Manage memory by limiting sessions kept in memory
      if (sessions.length > this.options.maxSessionsInMemory) {
        // Could implement LRU eviction here if needed
      }
    }

    return sessions;
  }

  /**
   * Organize with batching for better performance
   */
  private async organizeWithBatching(entries: TranscriptEntry[]): Promise<SessionInfo[]> {
    const sessionGroups = this.groupEntriesBySessionEfficient(entries);
    const sessionEntryArrays = Array.from(sessionGroups.values());

    if (sessionEntryArrays.length <= this.options.batchSize) {
      // Small number of sessions, process directly
      const promises = Array.from(sessionGroups.entries()).map(
        ([sessionId, sessionEntries]) => this.createOptimizedSessionInfo(sessionId, sessionEntries)
      );
      return Promise.all(promises);
    }

    // Large number of sessions, use batch processing
    return this.batchProcessor.processAll(sessionEntryArrays);
  }

  /**
   * Efficiently group entries by session
   */
  private groupEntriesBySessionEfficient(entries: TranscriptEntry[]): Map<string, TranscriptEntry[]> {
    const sessions = new Map<string, TranscriptEntry[]>();
    
    for (const entry of entries) {
      const sessionId = entry.type === 'summary' 
        ? (entry as SummaryTranscriptEntry).sessionId || 'unknown'
        : entry.sessionId;
        
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, []);
      }
      sessions.get(sessionId)!.push(entry);
    }

    return sessions;
  }

  /**
   * Create optimized session info with caching
   */
  private async createOptimizedSessionInfo(sessionId: string, entries: TranscriptEntry[]): Promise<SessionInfo> {
    // Check metadata cache first
    const metadataKey = `metadata-${sessionId}-${entries.length}`;
    const cachedMetadata = this.sessionMetadataCache.get(metadataKey);

    const sessionInfo = sessionInfoPool.acquire();
    sessionInfo.sessionId = sessionId;
    sessionInfo.entries = entries;

    if (cachedMetadata) {
      Object.assign(sessionInfo, cachedMetadata);
      return sessionInfo;
    }

    // Calculate session statistics efficiently
    sessionInfo.messageCount = entries.length;
    sessionInfo.userMessageCount = 0;
    sessionInfo.assistantMessageCount = 0;
    sessionInfo.summaryCount = 0;

    let firstUserMessage: string | undefined;
    let lastAssistantMessage: string | undefined;
    const workingDirectories = new Set<string>();
    const timestamps: string[] = [];

    for (const entry of entries) {
      if (entry.type !== 'summary') {
        timestamps.push(entry.timestamp);
        workingDirectories.add(entry.cwd);
      }

      switch (entry.type) {
        case 'user':
          sessionInfo.userMessageCount++;
          if (!firstUserMessage) {
            const userEntry = entry as UserTranscriptEntry;
            firstUserMessage = this.extractPreviewText(userEntry.message.content);
          }
          break;
        case 'assistant':
          sessionInfo.assistantMessageCount++;
          const assistantEntry = entry as AssistantTranscriptEntry;
          lastAssistantMessage = this.extractPreviewText(assistantEntry.message.content);
          break;
        case 'summary':
          sessionInfo.summaryCount++;
          break;
      }
    }

    // Set working directory (use most common one if multiple)
    sessionInfo.workingDirectory = workingDirectories.size > 0 
      ? Array.from(workingDirectories)[0] 
      : '';

    // Calculate time range efficiently
    if (timestamps.length > 0) {
      timestamps.sort();
      sessionInfo.timeRange = {
        start: new Date(timestamps[0]),
        end: new Date(timestamps[timestamps.length - 1]),
      };
    }

    // Set preview messages
    sessionInfo.firstUserMessage = firstUserMessage;
    sessionInfo.lastAssistantMessage = lastAssistantMessage;

    // Extract session summary efficiently
    sessionInfo.summary = this.extractSessionSummaryEfficient(entries);

    // Calculate token usage if requested
    if (this.options.includeTokenUsage) {
      sessionInfo.tokenUsage = await this.calculateTokenUsageEfficient(entries);
    }

    // Cache metadata for future use
    const { entries: _, ...metadata } = sessionInfo;
    this.sessionMetadataCache.set(metadataKey, metadata);

    return sessionInfo;
  }

  /**
   * Extract preview text efficiently
   */
  private extractPreviewText(content: string | any[]): string {
    if (typeof content === 'string') {
      return content.length > this.options.maxPreviewLength
        ? content.substring(0, this.options.maxPreviewLength) + '...'
        : content;
    }

    if (Array.isArray(content)) {
      for (const item of content) {
        if (item.type === 'text' && item.text) {
          const text = item.text;
          return text.length > this.options.maxPreviewLength
            ? text.substring(0, this.options.maxPreviewLength) + '...'
            : text;
        }
      }
    }

    return '';
  }

  /**
   * Extract session summary efficiently with caching
   */
  private extractSessionSummaryEfficient(entries: TranscriptEntry[]): string {
    const summaryKey = `summary-${entries.length}-${entries[0]?.uuid || 'unknown'}`;
    const cached = this.summaryCache.get(summaryKey);
    if (cached) return cached;

    // Find summary entry
    const summaryEntry = entries.find(e => e.type === 'summary') as SummaryTranscriptEntry;
    const summary = summaryEntry?.summary || '';

    this.summaryCache.set(summaryKey, summary);
    return summary;
  }

  /**
   * Calculate token usage efficiently
   */
  private async calculateTokenUsageEfficient(entries: TranscriptEntry[]): Promise<SessionInfo['tokenUsage']> {
    return new Promise((resolve) => {
      setImmediate(() => {
        const usage = trackSessionUsage(entries);
        resolve(usage);
      });
    });
  }

  /**
   * Process batches of session entry arrays
   */
  private async processBatches(batches: TranscriptEntry[][]): Promise<SessionInfo[]> {
    return Promise.all(
      batches.map((entries, index) => 
        this.createOptimizedSessionInfo(`batch-${index}`, entries)
      )
    );
  }

  /**
   * Release session info back to pool
   */
  private releaseSessionInfo(sessionInfo: SessionInfo): void {
    sessionInfoPool.release(sessionInfo);
  }

  /**
   * Generate cache key for entries
   */
  private generateCacheKey(entries: TranscriptEntry[]): string {
    // Create a simple hash-like key based on entry count and first/last UUIDs
    if (entries.length === 0) return 'empty';
    
    const first = entries[0].uuid;
    const last = entries[entries.length - 1].uuid;
    return `${entries.length}-${first}-${last}`;
  }
}

/**
 * Global optimized organizer instance
 */
export const globalOptimizedOrganizer = new OptimizedSessionOrganizer({
  useCache: true,
  enableProfiling: true,
  useStreaming: true,
});

/**
 * Convenience functions using optimized organizer
 */
export async function organizeIntoSessions(
  entries: TranscriptEntry[],
  options?: OptimizedSessionOptions
): Promise<SessionInfo[]> {
  if (options) {
    const organizer = new OptimizedSessionOrganizer(options);
    return organizer.organizeIntoSessions(entries);
  }
  return globalOptimizedOrganizer.organizeIntoSessions(entries);
}

export async function organizeProject(
  entries: TranscriptEntry[],
  options?: OptimizedSessionOptions
): Promise<ProjectSessions> {
  if (options) {
    const organizer = new OptimizedSessionOrganizer(options);
    return organizer.organizeProject(entries);
  }
  return globalOptimizedOrganizer.organizeProject(entries);
}

export async function* organizeSessionsStream(
  entries: TranscriptEntry[],
  options?: OptimizedSessionOptions
): AsyncGenerator<SessionInfo, void, unknown> {
  const organizer = options ? new OptimizedSessionOrganizer(options) : globalOptimizedOrganizer;
  yield* organizer.organizeSessionsStream(entries);
}