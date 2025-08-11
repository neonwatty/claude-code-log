/**
 * Advanced filtering and search engine with performance optimizations
 */

export interface Message {
  id?: string;
  role?: 'user' | 'assistant' | 'system' | 'error';
  content?: string;
  tool_name?: string;
  error?: string;
  timestamp?: Date;
  sessionId?: string;
  tokens?: number;
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  fuzzyThreshold?: number; // 0-1, where 1 is exact match
}

export interface FilterResult<T> {
  items: T[];
  totalCount: number;
  filteredCount: number;
  searchMatches?: Map<string, SearchMatch[]>;
  performance?: {
    duration: number;
    itemsProcessed: number;
    cacheHits: number;
  };
}

export interface SearchMatch {
  field: string;
  start: number;
  end: number;
  text: string;
  context?: string;
}

/**
 * High-performance filtering engine with memoization and optimized algorithms
 */
export class FilterEngine {
  private cache = new Map<string, FilterResult<any>>();
  private fuzzyCache = new Map<string, number>();
  private searchCache = new Map<string, SearchMatch[]>();
  private maxCacheSize = 1000;
  private performance = { cacheHits: 0, totalQueries: 0 };

  /**
   * Filter and search messages with performance optimization
   */
  filterMessages<T extends Message>(
    messages: T[],
    filters: {
      searchQuery?: string;
      searchFields?: string[];
      messageTypes?: string[];
      dateRange?: { start: Date | null; end: Date | null };
      sessionIds?: string[];
    },
    options: SearchOptions = {}
  ): FilterResult<T> {
    const startTime = performance.now();
    this.performance.totalQueries++;

    // Create cache key
    const cacheKey = this.createCacheKey(filters, options);
    const cachedResult = this.cache.get(cacheKey);
    
    if (cachedResult && cachedResult.totalCount === messages.length) {
      this.performance.cacheHits++;
      return {
        ...cachedResult,
        performance: {
          ...cachedResult.performance!,
          cacheHits: this.performance.cacheHits,
        },
      };
    }

    // Apply filters in order of selectivity (most restrictive first)
    let filteredMessages = [...messages];
    const searchMatches = new Map<string, SearchMatch[]>();

    // 1. Session ID filter (most selective)
    if (filters.sessionIds && filters.sessionIds.length > 0) {
      filteredMessages = this.filterBySessionIds(filteredMessages, filters.sessionIds);
    }

    // 2. Date range filter
    if (filters.dateRange && (filters.dateRange.start || filters.dateRange.end)) {
      filteredMessages = this.filterByDateRange(filteredMessages, filters.dateRange);
    }

    // 3. Message type filter
    if (filters.messageTypes && filters.messageTypes.length > 0 && filters.messageTypes.length < 4) {
      filteredMessages = this.filterByMessageTypes(filteredMessages, filters.messageTypes);
    }

    // 4. Search query (potentially expensive, so last)
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const searchResult = this.searchMessages(
        filteredMessages,
        filters.searchQuery.trim(),
        filters.searchFields || ['content'],
        options
      );
      filteredMessages = searchResult.messages;
      
      // Merge search matches
      searchResult.matches.forEach((matches, id) => {
        searchMatches.set(id, matches);
      });
    }

    const result: FilterResult<T> = {
      items: filteredMessages,
      totalCount: messages.length,
      filteredCount: filteredMessages.length,
      searchMatches,
      performance: {
        duration: performance.now() - startTime,
        itemsProcessed: messages.length,
        cacheHits: this.performance.cacheHits,
      },
    };

    // Cache result if it's worth caching
    if (messages.length > 10) {
      this.cacheResult(cacheKey, result);
    }

    return result;
  }

  /**
   * Advanced search with highlighting and fuzzy matching
   */
  private searchMessages<T extends Message>(
    messages: T[],
    query: string,
    fields: string[],
    options: SearchOptions
  ): { messages: T[]; matches: Map<string, SearchMatch[]> } {
    const results: T[] = [];
    const matches = new Map<string, SearchMatch[]>();
    
    // Prepare search patterns
    const patterns = this.prepareSearchPatterns(query, options);

    for (const message of messages) {
      const messageMatches: SearchMatch[] = [];
      let hasMatch = false;

      for (const field of fields) {
        const text = this.getMessageField(message, field);
        if (!text) continue;

        const fieldMatches = this.findMatches(text, patterns, field, options);
        if (fieldMatches.length > 0) {
          messageMatches.push(...fieldMatches);
          hasMatch = true;
        }
      }

      if (hasMatch) {
        results.push(message);
        if (message.id) {
          matches.set(message.id, messageMatches);
        }
      }
    }

    return { messages: results, matches };
  }

  /**
   * Prepare search patterns based on options
   */
  private prepareSearchPatterns(query: string, options: SearchOptions) {
    const patterns: Array<{ pattern: RegExp | string; type: 'exact' | 'fuzzy' | 'regex' }> = [];

    if (options.regex) {
      try {
        const flags = options.caseSensitive ? 'g' : 'gi';
        patterns.push({
          pattern: new RegExp(query, flags),
          type: 'regex',
        });
      } catch (e) {
        // Fallback to exact search if regex is invalid
        patterns.push({
          pattern: options.caseSensitive ? query : query.toLowerCase(),
          type: 'exact',
        });
      }
    } else if (options.wholeWord) {
      const escapedQuery = this.escapeRegExp(query);
      const flags = options.caseSensitive ? 'g' : 'gi';
      patterns.push({
        pattern: new RegExp(`\\b${escapedQuery}\\b`, flags),
        type: 'exact',
      });
    } else {
      patterns.push({
        pattern: options.caseSensitive ? query : query.toLowerCase(),
        type: 'exact',
      });

      // Add fuzzy pattern if threshold is set
      if (options.fuzzyThreshold && options.fuzzyThreshold < 1) {
        patterns.push({
          pattern: query,
          type: 'fuzzy',
        });
      }
    }

    return patterns;
  }

  /**
   * Find matches in text using prepared patterns
   */
  private findMatches(
    text: string,
    patterns: Array<{ pattern: RegExp | string; type: 'exact' | 'fuzzy' | 'regex' }>,
    field: string,
    options: SearchOptions
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];

    for (const { pattern, type } of patterns) {
      if (type === 'regex' && pattern instanceof RegExp) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          matches.push({
            field,
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
            context: this.getContext(text, match.index, match[0].length),
          });
        }
      } else if (type === 'exact') {
        const searchText = typeof pattern === 'string' ? pattern : pattern.source;
        const targetText = options.caseSensitive ? text : text.toLowerCase();
        let startIndex = 0;
        
        while (true) {
          const index = targetText.indexOf(searchText, startIndex);
          if (index === -1) break;
          
          matches.push({
            field,
            start: index,
            end: index + searchText.length,
            text: text.substring(index, index + searchText.length),
            context: this.getContext(text, index, searchText.length),
          });
          
          startIndex = index + 1;
        }
      } else if (type === 'fuzzy') {
        const fuzzyMatches = this.findFuzzyMatches(text, pattern as string, options.fuzzyThreshold || 0.7);
        matches.push(...fuzzyMatches.map(match => ({
          field,
          start: match.start,
          end: match.end,
          text: match.text,
          context: this.getContext(text, match.start, match.end - match.start),
        })));
      }
    }

    return matches;
  }

  /**
   * Fuzzy string matching using Levenshtein distance
   */
  private findFuzzyMatches(
    text: string,
    query: string,
    threshold: number
  ): Array<{ start: number; end: number; text: string; score: number }> {
    const matches: Array<{ start: number; end: number; text: string; score: number }> = [];
    const queryLen = query.length;
    const textLen = text.length;

    // Use sliding window approach for fuzzy matching
    for (let windowSize = queryLen; windowSize <= textLen; windowSize++) {
      for (let i = 0; i <= textLen - windowSize; i++) {
        const window = text.substring(i, i + windowSize);
        const cacheKey = `${query}:${window}`;
        
        let similarity = this.fuzzyCache.get(cacheKey);
        if (similarity === undefined) {
          similarity = this.calculateSimilarity(query, window);
          this.fuzzyCache.set(cacheKey, similarity);
          
          // Limit cache size
          if (this.fuzzyCache.size > this.maxCacheSize) {
            const firstKey = this.fuzzyCache.keys().next().value;
            this.fuzzyCache.delete(firstKey);
          }
        }
        
        if (similarity >= threshold) {
          matches.push({
            start: i,
            end: i + windowSize,
            text: window,
            score: similarity,
          });
        }
      }
    }

    // Sort by score (best matches first) and remove overlaps
    return this.removeOverlappingMatches(
      matches.sort((a, b) => b.score - a.score)
    );
  }

  /**
   * Calculate similarity between two strings using normalized Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Create matrix
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        const cost = str1[j - 1] === str2[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    
    return maxLen === 0 ? 1 : 1 - distance / maxLen;
  }

  /**
   * Remove overlapping matches, keeping the best ones
   */
  private removeOverlappingMatches(
    matches: Array<{ start: number; end: number; text: string; score: number }>
  ): Array<{ start: number; end: number; text: string; score: number }> {
    const result: typeof matches = [];
    
    for (const match of matches) {
      const hasOverlap = result.some(existing => 
        (match.start < existing.end && match.end > existing.start)
      );
      
      if (!hasOverlap) {
        result.push(match);
      }
    }
    
    return result;
  }

  /**
   * Get context around a match for better search result display
   */
  private getContext(text: string, start: number, length: number, contextSize = 50): string {
    const contextStart = Math.max(0, start - contextSize);
    const contextEnd = Math.min(text.length, start + length + contextSize);
    
    let context = text.substring(contextStart, contextEnd);
    
    // Add ellipsis if truncated
    if (contextStart > 0) context = '...' + context;
    if (contextEnd < text.length) context = context + '...';
    
    return context;
  }

  // Filter methods

  private filterBySessionIds<T extends Message>(messages: T[], sessionIds: string[]): T[] {
    const sessionSet = new Set(sessionIds);
    return messages.filter(msg => msg.sessionId && sessionSet.has(msg.sessionId));
  }

  private filterByDateRange<T extends Message>(
    messages: T[],
    dateRange: { start: Date | null; end: Date | null }
  ): T[] {
    return messages.filter(msg => {
      if (!msg.timestamp) return true;
      
      if (dateRange.start && msg.timestamp < dateRange.start) return false;
      if (dateRange.end && msg.timestamp > dateRange.end) return false;
      
      return true;
    });
  }

  private filterByMessageTypes<T extends Message>(messages: T[], types: string[]): T[] {
    const typeSet = new Set(types);
    return messages.filter(msg => !msg.role || typeSet.has(msg.role));
  }

  // Utility methods

  private getMessageField(message: Message, field: string): string | undefined {
    switch (field) {
      case 'content':
        return message.content;
      case 'role':
        return message.role;
      case 'toolName':
        return message.tool_name;
      case 'error':
        return message.error;
      default:
        return undefined;
    }
  }

  private createCacheKey(filters: any, options: SearchOptions): string {
    return JSON.stringify({ filters, options });
  }

  private cacheResult(key: string, result: FilterResult<any>): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, result);
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Clear all caches to free memory
   */
  clearCache(): void {
    this.cache.clear();
    this.fuzzyCache.clear();
    this.searchCache.clear();
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.performance,
      cacheHitRate: this.performance.totalQueries > 0 
        ? this.performance.cacheHits / this.performance.totalQueries 
        : 0,
      cacheSize: this.cache.size,
      fuzzyCacheSize: this.fuzzyCache.size,
    };
  }

  /**
   * Create optimized search index for large datasets
   */
  createSearchIndex<T extends Message>(
    messages: T[],
    fields: string[] = ['content']
  ): SearchIndex<T> {
    return new SearchIndex(messages, fields);
  }
}

/**
 * Search index for very large datasets using inverted index
 */
export class SearchIndex<T extends Message> {
  private index = new Map<string, Set<number>>();
  private documents: T[];
  private fields: string[];

  constructor(documents: T[], fields: string[]) {
    this.documents = documents;
    this.fields = fields;
    this.buildIndex();
  }

  private buildIndex(): void {
    this.documents.forEach((doc, docIndex) => {
      this.fields.forEach(field => {
        const text = this.getDocumentField(doc, field);
        if (text) {
          const words = this.tokenize(text);
          words.forEach(word => {
            if (!this.index.has(word)) {
              this.index.set(word, new Set());
            }
            this.index.get(word)!.add(docIndex);
          });
        }
      });
    });
  }

  search(query: string): T[] {
    const queryWords = this.tokenize(query.toLowerCase());
    
    if (queryWords.length === 0) return [];
    
    // Get documents that contain all query words (AND operation)
    let candidateIndices: Set<number> | undefined;
    
    for (const word of queryWords) {
      const wordIndices = this.index.get(word);
      if (!wordIndices || wordIndices.size === 0) {
        return []; // If any word is not found, no results
      }
      
      if (!candidateIndices) {
        candidateIndices = new Set(wordIndices);
      } else {
        candidateIndices = new Set([...candidateIndices].filter(i => wordIndices.has(i)));
      }
      
      if (candidateIndices.size === 0) return [];
    }
    
    return candidateIndices 
      ? Array.from(candidateIndices).map(i => this.documents[i])
      : [];
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  private getDocumentField(doc: T, field: string): string | undefined {
    switch (field) {
      case 'content':
        return doc.content;
      case 'role':
        return doc.role;
      case 'toolName':
        return doc.tool_name;
      case 'error':
        return doc.error;
      default:
        return undefined;
    }
  }
}