/**
 * Performance optimization utilities for JSONL parser
 * Provides caching, lazy loading, and memory management
 */

import { TranscriptEntry } from './index';
import { ParsedMessage, ParsedContent } from './content-parser';
import { SessionInfo } from './session-organizer';

/**
 * LRU Cache for parsed content with memory management
 */
export class ParsedContentCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private maxAge: number;

  constructor(maxSize: number = 1000, maxAge: number = 5 * 60 * 1000) { // 5 minutes
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  get(key: string): ParsedMessage | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, { ...entry, timestamp: Date.now() });
    
    return entry.data;
  }

  set(key: string, value: ParsedMessage): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): CacheStats {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }
}

/**
 * Session cache for organized session data
 */
export class SessionCache {
  private cache = new Map<string, SessionCacheEntry>();
  private maxSize: number = 100;
  private maxAge: number = 10 * 60 * 1000; // 10 minutes

  get(key: string): SessionInfo[] | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  set(key: string, value: SessionInfo[]): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Lazy loader for content parsing
 */
export class LazyContentLoader {
  private contentCache = new ParsedContentCache();
  private loadingPromises = new Map<string, Promise<ParsedMessage>>();

  /**
   * Get parsed content with lazy loading and caching
   */
  async getContent(
    entry: TranscriptEntry,
    parser: (entry: TranscriptEntry) => ParsedMessage
  ): Promise<ParsedMessage> {
    const key = this.generateKey(entry);
    
    // Check cache first
    const cached = this.contentCache.get(key);
    if (cached) {
      return cached;
    }

    // Check if already loading
    const existingPromise = this.loadingPromises.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    // Start loading
    const loadPromise = this.loadContent(entry, parser, key);
    this.loadingPromises.set(key, loadPromise);

    try {
      const result = await loadPromise;
      this.contentCache.set(key, result);
      return result;
    } finally {
      this.loadingPromises.delete(key);
    }
  }

  private async loadContent(
    entry: TranscriptEntry,
    parser: (entry: TranscriptEntry) => ParsedMessage,
    key: string
  ): Promise<ParsedMessage> {
    // Simulate async loading for heavy parsing operations
    return new Promise((resolve) => {
      setImmediate(() => {
        const result = parser(entry);
        resolve(result);
      });
    });
  }

  private generateKey(entry: TranscriptEntry): string {
    // Generate unique key based on entry content
    return `${entry.type}-${'uuid' in entry ? entry.uuid : entry.leafUuid || 'no-uuid'}-${'timestamp' in entry ? entry.timestamp : 'no-timestamp'}`;
  }

  clearCache(): void {
    this.contentCache.clear();
    this.loadingPromises.clear();
  }
}

/**
 * Memory pool for reusing objects
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  constructor(createFn: () => T, resetFn: (obj: T) => void, maxSize: number = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }
}

/**
 * Batch processor for handling large datasets efficiently
 */
export class BatchProcessor<TInput, TOutput> {
  private batchSize: number;
  private processor: (batch: TInput[]) => Promise<TOutput[]>;

  constructor(
    processor: (batch: TInput[]) => Promise<TOutput[]>,
    batchSize: number = 100
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
  }

  async *processItems(items: TInput[]): AsyncGenerator<TOutput, void, unknown> {
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      const results = await this.processor(batch);
      
      for (const result of results) {
        yield result;
      }

      // Yield control to event loop
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  async processAll(items: TInput[]): Promise<TOutput[]> {
    const results: TOutput[] = [];
    
    for await (const result of this.processItems(items)) {
      results.push(result);
    }
    
    return results;
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private timers = new Map<string, number>();
  private metrics = new Map<string, PerformanceMetric>();

  startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      throw new Error(`Timer ${name} not started`);
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    // Update metrics
    const metric = this.metrics.get(name) || { count: 0, totalTime: 0, avgTime: 0, minTime: Infinity, maxTime: 0 };
    metric.count++;
    metric.totalTime += duration;
    metric.avgTime = metric.totalTime / metric.count;
    metric.minTime = Math.min(metric.minTime, duration);
    metric.maxTime = Math.max(metric.maxTime, duration);
    this.metrics.set(name, metric);

    return duration;
  }

  getMetrics(): Record<string, PerformanceMetric> {
    return Object.fromEntries(this.metrics);
  }

  reset(): void {
    this.timers.clear();
    this.metrics.clear();
  }
}

// Type definitions
interface CacheEntry {
  data: ParsedMessage;
  timestamp: number;
}

interface SessionCacheEntry {
  data: SessionInfo[];
  timestamp: number;
}

interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
}

interface PerformanceMetric {
  count: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
}

/**
 * Global performance cache instances
 */
export const globalContentCache = new ParsedContentCache(2000, 10 * 60 * 1000);
export const globalSessionCache = new SessionCache();
export const globalLazyLoader = new LazyContentLoader();
export const globalPerformanceMonitor = new PerformanceMonitor();

/**
 * Utility function to create optimized content parsers
 */
export function createOptimizedContentParser<T, R>(
  parser: (item: T) => R,
  cacheKeyFn: (item: T) => string,
  batchSize: number = 50
) {
  const cache = new Map<string, R>();
  
  return {
    parseItem: (item: T): R => {
      const key = cacheKeyFn(item);
      const cached = cache.get(key);
      if (cached) return cached;
      
      const result = parser(item);
      cache.set(key, result);
      return result;
    },
    
    parseBatch: async (items: T[]): Promise<R[]> => {
      const processor = new BatchProcessor(
        async (batch: T[]) => batch.map(item => {
          const key = cacheKeyFn(item);
          const cached = cache.get(key);
          if (cached) return cached;
          
          const result = parser(item);
          cache.set(key, result);
          return result;
        }),
        batchSize
      );
      
      return processor.processAll(items);
    },
    
    clearCache: () => cache.clear(),
    getCacheSize: () => cache.size,
  };
}