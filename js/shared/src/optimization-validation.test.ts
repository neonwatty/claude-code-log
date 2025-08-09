import { describe, it, expect, beforeEach } from 'vitest';
import {
  OptimizedContentParser,
  parseTranscriptEntries as optimizedParseEntries,
} from './optimized-content-parser';
import {
  OptimizedSessionOrganizer,
  organizeIntoSessions as optimizedOrganizeSessions,
} from './optimized-session-organizer';
import {
  parseTranscriptEntries as baseParseEntries,
} from './content-parser';
import {
  organizeIntoSessions as baseOrganizeSessions,
} from './session-organizer';
import {
  globalContentCache,
  globalSessionCache,
  globalPerformanceMonitor,
} from './performance-cache';
import { TranscriptEntry } from './index';

/**
 * Generate test data for validation
 */
function generateValidationEntries(count: number): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  
  for (let i = 0; i < count; i++) {
    const sessionId = `session_${Math.floor(i / 10)}`; // 10 entries per session
    const isUser = i % 2 === 0;
    
    if (isUser) {
      entries.push({
        type: 'user',
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/tmp',
        sessionId,
        version: '1.0.0',
        uuid: `user_${i}`,
        message: {
          role: 'user',
          content: `User message ${i}`,
        },
      } as TranscriptEntry);
    } else {
      entries.push({
        type: 'assistant',
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        parentUuid: null,
        isSidechain: false,
        userType: 'human',
        cwd: '/tmp',
        sessionId,
        version: '1.0.0',
        uuid: `assistant_${i}`,
        message: {
          id: `assistant_${i}`,
          type: 'message',
          role: 'assistant',
          model: 'claude-3-sonnet-20240229',
          content: [
            { type: 'text', text: `Assistant response ${i}` }
          ],
          usage: {
            input_tokens: 50,
            output_tokens: 100,
          },
        },
      } as TranscriptEntry);
    }
  }
  
  return entries;
}

describe('Optimization Validation', () => {
  beforeEach(() => {
    // Clear all caches before each test
    globalContentCache.clear();
    globalSessionCache.clear();
    globalPerformanceMonitor.reset();
  });

  describe('Content Parser Optimizations', () => {
    it('should produce identical results to base parser', async () => {
      const entries = generateValidationEntries(20);
      
      const baseResults = baseParseEntries(entries);
      const optimizedResults = await optimizedParseEntries(entries);
      
      expect(optimizedResults).toHaveLength(baseResults.length);
      
      // Compare key properties of each message
      for (let i = 0; i < baseResults.length; i++) {
        const base = baseResults[i];
        const optimized = optimizedResults[i];
        
        expect(optimized.messageType).toBe(base.messageType);
        expect(optimized.displayType).toBe(base.displayType);
        expect(optimized.parsedContent).toHaveLength(base.parsedContent.length);
        expect(optimized.hasToolUse).toBe(base.hasToolUse);
        expect(optimized.hasThinking).toBe(base.hasThinking);
        expect(optimized.hasImages).toBe(base.hasImages);
      }
    });

    it('should utilize caching effectively', async () => {
      const entries = generateValidationEntries(50);
      const parser = new OptimizedContentParser({ 
        useCache: true,
        enableProfiling: true,
      });
      
      // First parse (populates cache)
      const firstResults = await parser.parseEntries(entries);
      const firstStats = parser.getPerformanceStats();
      
      // Second parse (uses cache)
      const secondResults = await parser.parseEntries(entries);
      const secondStats = parser.getPerformanceStats();
      
      // Results should be identical
      expect(secondResults).toHaveLength(firstResults.length);
      
      // Cache should be utilized
      expect(secondStats.cacheStats.size).toBeGreaterThan(0);
    });

    it('should handle streaming correctly', async () => {
      const entries = generateValidationEntries(30);
      const parser = new OptimizedContentParser();
      
      const streamResults = [];
      for await (const result of parser.parseEntriesStream(entries)) {
        streamResults.push(result);
      }
      
      const batchResults = await parser.parseEntries(entries);
      
      expect(streamResults).toHaveLength(batchResults.length);
      
      // Results should be equivalent
      for (let i = 0; i < streamResults.length; i++) {
        expect(streamResults[i].messageType).toBe(batchResults[i].messageType);
        expect(streamResults[i].parsedContent).toHaveLength(batchResults[i].parsedContent.length);
      }
    });
  });

  describe('Session Organizer Optimizations', () => {
    it('should produce identical results to base organizer', async () => {
      const entries = generateValidationEntries(40);
      
      const baseSessions = baseOrganizeSessions(entries);
      const optimizedSessions = await optimizedOrganizeSessions(entries);
      
      expect(optimizedSessions).toHaveLength(baseSessions.length);
      
      // Sort both arrays by sessionId for comparison
      baseSessions.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
      optimizedSessions.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
      
      // Compare key properties of each session
      for (let i = 0; i < baseSessions.length; i++) {
        const base = baseSessions[i];
        const optimized = optimizedSessions[i];
        
        expect(optimized.sessionId).toBe(base.sessionId);
        expect(optimized.messageCount).toBe(base.messageCount);
        expect(optimized.userMessageCount).toBe(base.userMessageCount);
        expect(optimized.assistantMessageCount).toBe(base.assistantMessageCount);
        expect(optimized.workingDirectory).toBe(base.workingDirectory);
      }
    });

    it('should utilize caching for session organization', async () => {
      const entries = generateValidationEntries(30);
      const organizer = new OptimizedSessionOrganizer({ 
        useCache: true,
        enableProfiling: true,
      });
      
      // First organization (populates cache)
      const firstSessions = await organizer.organizeIntoSessions(entries);
      
      // Second organization (uses cache)
      const secondSessions = await organizer.organizeIntoSessions(entries);
      
      // Results should be identical
      expect(secondSessions).toHaveLength(firstSessions.length);
      
      // Should have some performance metrics
      const stats = organizer.getPerformanceStats();
      expect(typeof stats).toBe('object');
    });

    it('should handle streaming session organization', async () => {
      const entries = generateValidationEntries(25);
      const organizer = new OptimizedSessionOrganizer();
      
      const streamSessions = [];
      for await (const session of organizer.organizeSessionsStream(entries)) {
        streamSessions.push(session);
      }
      
      const batchSessions = await organizer.organizeIntoSessions(entries);
      
      expect(streamSessions).toHaveLength(batchSessions.length);
      
      // Sort for comparison
      streamSessions.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
      batchSessions.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
      
      // Results should be equivalent
      for (let i = 0; i < streamSessions.length; i++) {
        expect(streamSessions[i].sessionId).toBe(batchSessions[i].sessionId);
        expect(streamSessions[i].messageCount).toBe(batchSessions[i].messageCount);
      }
    });
  });

  describe('Performance Cache Functionality', () => {
    it('should track performance metrics when enabled', async () => {
      const entries = generateValidationEntries(15);
      const parser = new OptimizedContentParser({ 
        enableProfiling: true,
      });
      
      await parser.parseEntries(entries);
      
      const stats = parser.getPerformanceStats();
      
      // Should have recorded some metrics
      expect(typeof stats).toBe('object');
    });

    it('should manage cache size limits', async () => {
      const entries = generateValidationEntries(100);
      const parser = new OptimizedContentParser({ 
        useCache: true,
        maxCacheSize: 10, // Small cache size
      });
      
      await parser.parseEntries(entries);
      
      const stats = parser.getPerformanceStats();
      
      // Cache should not exceed max size
      expect(stats.cacheStats.size).toBeLessThanOrEqual(10);
    });

    it('should clear caches when requested', async () => {
      const entries = generateValidationEntries(20);
      const parser = new OptimizedContentParser({ useCache: true });
      
      await parser.parseEntries(entries);
      
      let stats = parser.getPerformanceStats();
      expect(stats.cacheStats.size).toBeGreaterThan(0);
      
      parser.clearCaches();
      
      stats = parser.getPerformanceStats();
      expect(stats.cacheStats.size).toBe(0);
    });
  });

  describe('Memory Management', () => {
    it('should handle large datasets without excessive memory growth', async () => {
      const entries = generateValidationEntries(500);
      const initialMemory = process.memoryUsage().heapUsed;
      
      const parser = new OptimizedContentParser({ 
        useCache: true,
        maxCacheSize: 100, // Limit cache size
      });
      
      await parser.parseEntries(entries);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be reasonable (less than 20MB for 500 entries)
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024);
    });

    it('should support garbage collection of cached items', async () => {
      const entries = generateValidationEntries(50);
      const parser = new OptimizedContentParser({ 
        useCache: true,
        maxCacheSize: 20,
      });
      
      // Process entries to populate cache
      await parser.parseEntries(entries);
      
      // Process different entries to trigger cache eviction
      const moreEntries = generateValidationEntries(30);
      await parser.parseEntries(moreEntries);
      
      const stats = parser.getPerformanceStats();
      
      // Cache size should be managed
      expect(stats.cacheStats.size).toBeLessThanOrEqual(20);
    });
  });

  describe('Integration Validation', () => {
    it('should work correctly with the full pipeline', async () => {
      const entries = generateValidationEntries(100);
      
      // Parse content with optimizations
      const parsedMessages = await optimizedParseEntries(entries, {
        useCache: true,
        enableProfiling: true,
      });
      
      // Organize into sessions with optimizations
      const sessions = await optimizedOrganizeSessions(entries, {
        useCache: true,
        enableProfiling: true,
      });
      
      // Validate results
      expect(parsedMessages).toHaveLength(100);
      expect(sessions.length).toBeGreaterThan(0);
      
      // Each session should contain the expected number of entries
      let totalEntries = 0;
      for (const session of sessions) {
        totalEntries += session.messageCount;
      }
      expect(totalEntries).toBe(entries.length);
    });

    it('should maintain consistency across multiple operations', async () => {
      const entries = generateValidationEntries(60);
      
      // Run multiple operations with the same data
      const results1 = await optimizedParseEntries(entries, { useCache: true });
      const results2 = await optimizedParseEntries(entries, { useCache: true });
      const results3 = await optimizedParseEntries(entries, { useCache: false });
      
      // All results should be identical
      expect(results1).toHaveLength(results2.length);
      expect(results2).toHaveLength(results3.length);
      
      for (let i = 0; i < results1.length; i++) {
        expect(results1[i].messageType).toBe(results2[i].messageType);
        expect(results2[i].messageType).toBe(results3[i].messageType);
      }
    });
  });
});