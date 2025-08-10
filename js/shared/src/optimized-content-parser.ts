/**
 * Optimized content parser with performance enhancements
 */

import {
  TranscriptEntry,
  ContentItem,
} from './index';
import {
  ParsedContent,
  ParsedMessage,
  ContentParsingOptions,
  parseTranscriptEntry as baseParseTranscriptEntry,
  parseTranscriptEntries as baseParseTranscriptEntries,
  parseContentItem,
  analyzeContentTypes,
} from './content-parser';
import {
  globalContentCache,
  globalLazyLoader,
  globalPerformanceMonitor,
  createOptimizedContentParser,
  BatchProcessor,
  ObjectPool,
  ParsedContentCache,
} from './performance-cache';

/**
 * Enhanced options for optimized parsing
 */
export interface OptimizedParsingOptions extends ContentParsingOptions {
  /** Enable caching for parsed content */
  useCache?: boolean;
  /** Use lazy loading for content parsing */
  useLazyLoading?: boolean;
  /** Batch size for processing multiple entries */
  batchSize?: number;
  /** Enable performance monitoring */
  enableProfiling?: boolean;
  /** Maximum cache size */
  maxCacheSize?: number;
}

const DEFAULT_OPTIMIZED_OPTIONS: Required<OptimizedParsingOptions> = {
  maxPreviewLength: 200,
  enableMarkdown: true,
  includeRawContent: false,
  extractToolInfo: true,
  useCache: true,
  useLazyLoading: true,
  batchSize: 50,
  enableProfiling: false,
  maxCacheSize: 2000,
};

/**
 * Object pool for ParsedContent objects
 */
const parsedContentPool = new ObjectPool<ParsedContent>(
  () => ({ type: 'text', content: '', metadata: {} }),
  (obj) => {
    obj.type = 'text';
    obj.content = '';
    obj.metadata = {};
  },
  500
);

/**
 * Optimized content parser with caching and lazy loading
 */
export class OptimizedContentParser {
  private options: Required<OptimizedParsingOptions>;
  private batchProcessor: BatchProcessor<TranscriptEntry, ParsedMessage>;
  private contentItemCache: Map<string, ParsedContent[]> = new Map();
  private cache: ParsedContentCache;
  
  constructor(options: OptimizedParsingOptions = {}) {
    this.options = { ...DEFAULT_OPTIMIZED_OPTIONS, ...options };
    
    // Use custom cache instance if maxCacheSize is different from default
    if (options.maxCacheSize !== undefined && options.maxCacheSize !== DEFAULT_OPTIMIZED_OPTIONS.maxCacheSize) {
      this.cache = new ParsedContentCache(this.options.maxCacheSize);
    } else {
      this.cache = globalContentCache;
    }
    
    this.batchProcessor = new BatchProcessor(
      (batch) => this.processBatch(batch),
      this.options.batchSize
    );
  }

  /**
   * Parse a single transcript entry with optimizations
   */
  parseEntry(entry: TranscriptEntry): ParsedMessage {
    if (this.options.enableProfiling) {
      globalPerformanceMonitor.startTimer('parseEntry');
    }

    try {
      if (this.options.useCache) {
        const cacheKey = this.generateCacheKey(entry);
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const result = this.parseEntryInternal(entry);
      
      if (this.options.useCache) {
        const cacheKey = this.generateCacheKey(entry);
        this.cache.set(cacheKey, result);
      }

      return result;
    } finally {
      if (this.options.enableProfiling) {
        globalPerformanceMonitor.endTimer('parseEntry');
      }
    }
  }

  /**
   * Parse multiple entries efficiently with batching
   */
  async parseEntries(entries: TranscriptEntry[]): Promise<ParsedMessage[]> {
    if (this.options.enableProfiling) {
      globalPerformanceMonitor.startTimer('parseEntries');
    }

    try {
      if (this.options.useLazyLoading && entries.length > this.options.batchSize) {
        return await this.batchProcessor.processAll(entries);
      } else {
        return entries.map(entry => this.parseEntry(entry));
      }
    } finally {
      if (this.options.enableProfiling) {
        globalPerformanceMonitor.endTimer('parseEntries');
      }
    }
  }

  /**
   * Stream parse entries for memory efficiency
   */
  async *parseEntriesStream(entries: TranscriptEntry[]): AsyncGenerator<ParsedMessage, void, unknown> {
    if (this.options.enableProfiling) {
      globalPerformanceMonitor.startTimer('parseEntriesStream');
    }

    try {
      for await (const result of this.batchProcessor.processItems(entries)) {
        yield result;
      }
    } finally {
      if (this.options.enableProfiling) {
        globalPerformanceMonitor.endTimer('parseEntriesStream');
      }
    }
  }

  /**
   * Parse content items with caching
   */
  parseContentItems(items: ContentItem[]): ParsedContent[] {
    if (!items || items.length === 0) return [];

    const cacheKey = this.generateContentCacheKey(items);
    const cached = this.contentItemCache.get(cacheKey);
    if (cached && this.options.useCache) {
      return cached;
    }

    const results = items.map(item => {
      const parsed = parsedContentPool.acquire();
      const result = parseContentItem(item, this.options);
      
      // Copy result to pooled object
      Object.assign(parsed, result);
      return parsed;
    });

    if (this.options.useCache) {
      this.contentItemCache.set(cacheKey, results);
    }

    return results;
  }

  /**
   * Lazy parse with async loading
   */
  async parseEntryLazy(entry: TranscriptEntry): Promise<ParsedMessage> {
    if (!this.options.useLazyLoading) {
      return this.parseEntry(entry);
    }

    return globalLazyLoader.getContent(entry, (e) => this.parseEntryInternal(e));
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...globalPerformanceMonitor.getMetrics(),
      cacheStats: this.cache.getStats(),
      contentCacheSize: this.contentItemCache.size,
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.cache.clear();
    globalLazyLoader.clearCache();
    this.contentItemCache.clear();
  }

  /**
   * Internal parsing logic without caching
   */
  private parseEntryInternal(entry: TranscriptEntry): ParsedMessage {
    return baseParseTranscriptEntry(entry, this.options);
  }

  /**
   * Process a batch of entries
   */
  private async processBatch(batch: TranscriptEntry[]): Promise<ParsedMessage[]> {
    return new Promise((resolve) => {
      setImmediate(() => {
        const results = batch.map(entry => this.parseEntry(entry));
        resolve(results);
      });
    });
  }

  /**
   * Generate cache key for transcript entry
   */
  private generateCacheKey(entry: TranscriptEntry): string {
    // Use a combination of unique identifiers for cache key
    const keyParts = [
      entry.type,
      'uuid' in entry ? entry.uuid : entry.leafUuid || 'no-uuid',
      'timestamp' in entry ? entry.timestamp : 'no-timestamp',
      this.options.enableMarkdown ? 'md' : 'txt',
      this.options.extractToolInfo ? 'tools' : 'notool',
    ];
    return keyParts.join('-');
  }

  /**
   * Generate cache key for content items
   */
  private generateContentCacheKey(items: ContentItem[]): string {
    // Create hash-like key from content structure
    const keyParts = items.map(item => `${item.type}-${JSON.stringify(item).length}`);
    return keyParts.join('|');
  }
}

/**
 * Memory-efficient content analyzer
 */
export class OptimizedContentAnalyzer {
  private analysisCache = new Map<string, ReturnType<typeof analyzeContentTypes>>();

  analyzeContentTypes(content: string | ContentItem[], useCache: boolean = true): ReturnType<typeof analyzeContentTypes> {
    if (!useCache) {
      return analyzeContentTypes(content);
    }

    const cacheKey = typeof content === 'string' 
      ? `str-${content.length}` 
      : `arr-${content.length}-${content.map(c => c.type).join(',')}`;

    const cached = this.analysisCache.get(cacheKey);
    if (cached) return cached;

    const result = analyzeContentTypes(content);
    this.analysisCache.set(cacheKey, result);
    return result;
  }

  clearCache(): void {
    this.analysisCache.clear();
  }
}

/**
 * Global optimized parser instance
 */
export const globalOptimizedParser = new OptimizedContentParser({
  useCache: true,
  useLazyLoading: true,
  enableProfiling: true,
  batchSize: 100,
});

/**
 * Convenience functions using optimized parser
 */
export function parseTranscriptEntry(
  entry: TranscriptEntry,
  options?: OptimizedParsingOptions
): ParsedMessage {
  if (options) {
    const parser = new OptimizedContentParser(options);
    return parser.parseEntry(entry);
  }
  return globalOptimizedParser.parseEntry(entry);
}

export async function parseTranscriptEntries(
  entries: TranscriptEntry[],
  options?: OptimizedParsingOptions
): Promise<ParsedMessage[]> {
  if (options) {
    const parser = new OptimizedContentParser(options);
    return parser.parseEntries(entries);
  }
  return globalOptimizedParser.parseEntries(entries);
}

export async function* parseTranscriptEntriesStream(
  entries: TranscriptEntry[],
  options?: OptimizedParsingOptions
): AsyncGenerator<ParsedMessage, void, unknown> {
  const parser = options ? new OptimizedContentParser(options) : globalOptimizedParser;
  yield* parser.parseEntriesStream(entries);
}

/**
 * Utility for parsing with specific optimizations
 */
export const optimizedParsers = {
  /**
   * Fast parser for preview generation
   */
  createPreviewParser: () => createOptimizedContentParser(
    (entry: TranscriptEntry) => parseTranscriptEntry(entry, {
      maxPreviewLength: 100,
      enableMarkdown: false,
      extractToolInfo: false,
    }),
    (entry) => `preview-${'uuid' in entry ? entry.uuid : entry.leafUuid}`,
    100
  ),

  /**
   * Full parser with all features
   */
  createFullParser: () => createOptimizedContentParser(
    (entry: TranscriptEntry) => parseTranscriptEntry(entry, {
      includeRawContent: true,
      extractToolInfo: true,
      enableMarkdown: true,
    }),
    (entry) => `full-${'uuid' in entry ? entry.uuid : entry.leafUuid}`,
    50
  ),

  /**
   * Memory-efficient parser for large datasets
   */
  createMemoryEfficientParser: () => createOptimizedContentParser(
    (entry: TranscriptEntry) => parseTranscriptEntry(entry, {
      includeRawContent: false,
      maxPreviewLength: 50,
      useCache: true,
    }),
    (entry) => `memory-${'uuid' in entry ? entry.uuid : entry.leafUuid}`,
    200
  ),
};