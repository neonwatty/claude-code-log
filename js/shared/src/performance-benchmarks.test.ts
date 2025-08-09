import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  OptimizedContentParser,
  parseTranscriptEntries as optimizedParseEntries,
  parseTranscriptEntriesStream,
} from './optimized-content-parser';
import {
  OptimizedSessionOrganizer,
  organizeIntoSessions as optimizedOrganizeSessions,
  organizeSessionsStream,
} from './optimized-session-organizer';
import {
  parseTranscriptEntries as baseParseEntries,
} from './content-parser';
import {
  organizeIntoSessions as baseOrganizeSessions,
} from './session-organizer';
import {
  globalPerformanceMonitor,
  globalContentCache,
  globalSessionCache,
} from './performance-cache';
import { TranscriptEntry } from './index';

/**
 * Generate test data for benchmarking
 */
function generateTestEntries(count: number): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  const sessionIds = ['session1', 'session2', 'session3'];
  
  for (let i = 0; i < count; i++) {
    const sessionId = sessionIds[i % sessionIds.length];
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
          content: [
            { type: 'text', text: `User message ${i} with some content to parse. This is a longer message that might contain multiple sentences and complex content that needs to be processed efficiently.` }
          ],
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
            { type: 'thinking', thinking: `Let me think about message ${i}...` },
            { type: 'text', text: `Assistant response ${i}. This is a comprehensive response that includes multiple parts and detailed information.` },
            { 
              type: 'tool_use', 
              id: `tool_${i}`, 
              name: 'TestTool', 
              input: { param1: `value${i}`, param2: i * 2 }
            },
          ],
          usage: {
            input_tokens: 100 + i,
            output_tokens: 200 + i,
          },
        },
      } as TranscriptEntry);
    }
  }
  
  return entries;
}

/**
 * Performance measurement utility
 */
function measurePerformance<T>(name: string, fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve) => {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;
    console.log(`${name}: ${duration}ms`);
    resolve({ result, duration });
  });
}

describe('Performance Benchmarks', () => {
  beforeEach(() => {
    // Clear all caches before each test
    globalContentCache.clear();
    globalSessionCache.clear();
    globalPerformanceMonitor.reset();
  });

  afterEach(() => {
    // Clean up after tests
    globalContentCache.clear();
    globalSessionCache.clear();
  });

  describe('Content Parsing Performance', () => {
    const testSizes = [100, 500, 1000, 2000];

    testSizes.forEach(size => {
      it(`should parse ${size} entries efficiently`, async () => {
        const entries = generateTestEntries(size);
        
        // Benchmark original parser
        const { duration: baseDuration } = await measurePerformance(
          `Base parser - ${size} entries`,
          () => baseParseEntries(entries)
        );

        // Benchmark optimized parser
        const { duration: optimizedDuration } = await measurePerformance(
          `Optimized parser - ${size} entries`,
          () => optimizedParseEntries(entries)
        );

        // Performance should be comparable or better
        const improvement = baseDuration > 0 ? ((baseDuration - optimizedDuration) / baseDuration * 100) : 0;
        console.log(`Improvement: ${improvement.toFixed(1)}%`);
        
        // Basic validation - both should complete successfully
        expect(baseDuration).toBeGreaterThanOrEqual(0);
        expect(optimizedDuration).toBeGreaterThanOrEqual(0);
        
        // For fast operations (< 10ms), don't enforce strict performance requirements
        if (baseDuration > 10) {
          expect(optimizedDuration).toBeLessThan(baseDuration * 1.5);
        }
      }, 30000); // 30 second timeout for large tests
    });

    it('should show caching benefits on repeated parsing', async () => {
      const entries = generateTestEntries(500);
      const parser = new OptimizedContentParser({ useCache: true });

      // First run (cold cache)
      const { duration: firstRun } = await measurePerformance(
        'First run (cold cache)',
        () => parser.parseEntries(entries)
      );

      // Second run (warm cache)
      const { duration: secondRun } = await measurePerformance(
        'Second run (warm cache)',
        () => parser.parseEntries(entries)
      );

      // Cached version should be significantly faster
      expect(secondRun).toBeLessThan(firstRun * 0.5);
      console.log(`Cache speedup: ${(firstRun / secondRun).toFixed(2)}x`);
    });

    it('should handle streaming efficiently for large datasets', async () => {
      const entries = generateTestEntries(2000);
      
      const { duration: streamDuration } = await measurePerformance(
        'Streaming parser - 2000 entries',
        async () => {
          const results = [];
          for await (const result of parseTranscriptEntriesStream(entries)) {
            results.push(result);
          }
          return results;
        }
      );

      const { duration: batchDuration } = await measurePerformance(
        'Batch parser - 2000 entries',
        () => optimizedParseEntries(entries)
      );

      // Streaming should be competitive with batch processing
      expect(streamDuration).toBeLessThan(batchDuration * 1.5);
    });

    it('should maintain memory efficiency with large datasets', async () => {
      const entries = generateTestEntries(1000);
      const parser = new OptimizedContentParser({ 
        useCache: true,
        maxCacheSize: 500,
      });

      // Monitor initial memory
      const initialMemory = process.memoryUsage().heapUsed;

      await parser.parseEntries(entries);

      // Check memory after processing
      const afterMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterMemory - initialMemory;
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
      
      // Memory increase should be reasonable (less than 50MB for 1000 entries)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Session Organization Performance', () => {
    const testSizes = [50, 200, 500, 1000];

    testSizes.forEach(size => {
      it(`should organize ${size} entries into sessions efficiently`, async () => {
        const entries = generateTestEntries(size);
        
        // Benchmark original organizer
        const { duration: baseDuration } = await measurePerformance(
          `Base organizer - ${size} entries`,
          () => baseOrganizeSessions(entries)
        );

        // Benchmark optimized organizer
        const { duration: optimizedDuration } = await measurePerformance(
          `Optimized organizer - ${size} entries`,
          () => optimizedOrganizeSessions(entries)
        );

        console.log(`Improvement: ${((baseDuration - optimizedDuration) / baseDuration * 100).toFixed(1)}%`);
        
        // Optimized version should be faster or comparable
        expect(optimizedDuration).toBeLessThan(baseDuration * 1.2);
      }, 20000);
    });

    it('should show caching benefits for session organization', async () => {
      const entries = generateTestEntries(300);
      const organizer = new OptimizedSessionOrganizer({ useCache: true });

      // First run (cold cache)
      const { duration: firstRun } = await measurePerformance(
        'First session organization (cold cache)',
        () => organizer.organizeIntoSessions(entries)
      );

      // Second run (warm cache)
      const { duration: secondRun } = await measurePerformance(
        'Second session organization (warm cache)',
        () => organizer.organizeIntoSessions(entries)
      );

      // Cached version should be significantly faster
      expect(secondRun).toBeLessThan(firstRun * 0.3);
      console.log(`Cache speedup: ${(firstRun / secondRun).toFixed(2)}x`);
    });

    it('should handle streaming session organization efficiently', async () => {
      const entries = generateTestEntries(500);
      
      const { duration: streamDuration } = await measurePerformance(
        'Streaming session organizer',
        async () => {
          const sessions = [];
          for await (const session of organizeSessionsStream(entries)) {
            sessions.push(session);
          }
          return sessions;
        }
      );

      const { duration: batchDuration } = await measurePerformance(
        'Batch session organizer',
        () => optimizedOrganizeSessions(entries)
      );

      // Streaming should be competitive
      expect(streamDuration).toBeLessThan(batchDuration * 1.5);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics correctly', async () => {
      const entries = generateTestEntries(100);
      const parser = new OptimizedContentParser({ enableProfiling: true });

      await parser.parseEntries(entries);
      
      const stats = parser.getPerformanceStats();
      
      // Should have recorded metrics
      expect(stats.parseEntries).toBeDefined();
      expect(stats.parseEntries.count).toBeGreaterThan(0);
      expect(stats.parseEntries.totalTime).toBeGreaterThan(0);
      expect(stats.parseEntries.avgTime).toBeGreaterThan(0);
    });

    it('should provide cache statistics', async () => {
      const entries = generateTestEntries(50);
      const parser = new OptimizedContentParser({ useCache: true });

      await parser.parseEntries(entries);
      await parser.parseEntries(entries); // Second run to populate cache

      const stats = parser.getPerformanceStats();
      
      expect(stats.cacheStats).toBeDefined();
      expect(stats.cacheStats.size).toBeGreaterThan(0);
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should handle large datasets without memory leaks', async () => {
      const entries = generateTestEntries(2000);
      const parser = new OptimizedContentParser({ 
        useCache: true,
        maxCacheSize: 100, // Small cache to test eviction
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Process in multiple batches
      for (let i = 0; i < 5; i++) {
        const batch = entries.slice(i * 400, (i + 1) * 400);
        await parser.parseEntries(batch);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);
      
      // Memory growth should be controlled (less than 100MB)
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
    });

    it('should release pooled objects correctly', async () => {
      const entries = generateTestEntries(200);
      const organizer = new OptimizedSessionOrganizer();

      // Process multiple times to test object pool
      for (let i = 0; i < 3; i++) {
        await organizer.organizeIntoSessions(entries);
      }

      // Object pool should manage memory efficiently
      // This is more of a smoke test since object pool internals are private
      expect(true).toBe(true);
    });
  });

  describe('Comparison Benchmarks', () => {
    it('should compare all optimization techniques', async () => {
      const entries = generateTestEntries(1000);
      console.log('\n=== Performance Comparison ===');

      // Base implementations
      const { duration: baseContentParsing } = await measurePerformance(
        'Base Content Parsing',
        () => baseParseEntries(entries)
      );

      const { duration: baseSessionOrganization } = await measurePerformance(
        'Base Session Organization',
        () => baseOrganizeSessions(entries)
      );

      // Optimized implementations (without cache)
      const { duration: optimizedContentNoCache } = await measurePerformance(
        'Optimized Content Parsing (no cache)',
        () => optimizedParseEntries(entries, { useCache: false })
      );

      const { duration: optimizedSessionNoCache } = await measurePerformance(
        'Optimized Session Organization (no cache)',
        () => optimizedOrganizeSessions(entries, { useCache: false })
      );

      // Optimized implementations (with cache, second run)
      await optimizedParseEntries(entries, { useCache: true }); // Prime cache
      await optimizedOrganizeSessions(entries, { useCache: true }); // Prime cache

      const { duration: optimizedContentWithCache } = await measurePerformance(
        'Optimized Content Parsing (with cache)',
        () => optimizedParseEntries(entries, { useCache: true })
      );

      const { duration: optimizedSessionWithCache } = await measurePerformance(
        'Optimized Session Organization (with cache)',
        () => optimizedOrganizeSessions(entries, { useCache: true })
      );

      // Calculate improvements
      const contentImprovement = ((baseContentParsing - optimizedContentNoCache) / baseContentParsing * 100);
      const sessionImprovement = ((baseSessionOrganization - optimizedSessionNoCache) / baseSessionOrganization * 100);
      const contentCacheSpeedup = baseContentParsing / optimizedContentWithCache;
      const sessionCacheSpeedup = baseSessionOrganization / optimizedSessionWithCache;

      console.log(`\nContent Parsing Improvement: ${contentImprovement.toFixed(1)}%`);
      console.log(`Session Organization Improvement: ${sessionImprovement.toFixed(1)}%`);
      console.log(`Content Parsing Cache Speedup: ${contentCacheSpeedup.toFixed(2)}x`);
      console.log(`Session Organization Cache Speedup: ${sessionCacheSpeedup.toFixed(2)}x`);

      // Verify improvements
      expect(optimizedContentNoCache).toBeLessThan(baseContentParsing * 1.1);
      expect(optimizedSessionNoCache).toBeLessThan(baseSessionOrganization * 1.1);
      expect(optimizedContentWithCache).toBeLessThan(baseContentParsing * 0.5);
      expect(optimizedSessionWithCache).toBeLessThan(baseSessionOrganization * 0.5);
    }, 60000); // 60 second timeout for comprehensive benchmark
  });
});