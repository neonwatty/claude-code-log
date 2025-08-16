import {
  CacheDirectoryService,
  CacheValidationService,
  FileModificationService,
  JsonlCacheBuilderService,
  CacheInvalidationService,
  CacheAggregationService
} from '../../services';
import fs from 'fs/promises';
import path from 'path';
import { CACHE_FORMAT_VERSION } from '../../utils/cache';

// Mock filesystem
jest.mock('fs/promises');
jest.mock('../../parsers/jsonl-parser', () => ({
  findJsonlFiles: jest.fn(() => ['/test/project/session1.jsonl', '/test/project/session2.jsonl']),
  loadTranscriptAsync: jest.fn(() => Promise.resolve({
    entries: [
      {
        type: 'user',
        sessionId: 'test-session-1',
        timestamp: '2023-01-01T10:00:00.000Z',
        message: { role: 'user', content: 'Hello' },
        cwd: '/test/project'
      },
      {
        type: 'assistant',
        sessionId: 'test-session-1',
        timestamp: '2023-01-01T10:01:00.000Z',
        message: {
          id: 'msg1',
          type: 'message',
          role: 'assistant',
          model: 'claude-3',
          content: [{ type: 'text', text: 'Hi there!' }],
          usage: { input_tokens: 10, output_tokens: 15 }
        }
      }
    ],
    errors: []
  })),
  extractTextContent: jest.fn((content) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map(item => item.text || '').join(' ');
    }
    return '';
  }),
  parseJsonlLine: jest.fn()
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('Cache System End-to-End Integration', () => {
  let services: {
    directory: CacheDirectoryService;
    validation: CacheValidationService;
    fileModification: FileModificationService;
    builder: JsonlCacheBuilderService;
    invalidation: CacheInvalidationService;
    aggregation: CacheAggregationService;
  };

  const testProjectPath = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    services = {
      directory: CacheDirectoryService.getInstance(),
      validation: CacheValidationService.getInstance(),
      fileModification: FileModificationService.getInstance(),
      builder: JsonlCacheBuilderService.getInstance(),
      invalidation: CacheInvalidationService.getInstance(),
      aggregation: CacheAggregationService.getInstance()
    };

    // Setup default filesystem mocks
    mockFs.mkdir = jest.fn().mockResolvedValue(undefined);
    mockFs.writeFile = jest.fn().mockResolvedValue(undefined);
    mockFs.rename = jest.fn().mockResolvedValue(undefined);
    // Setup conditional readFile mock based on file path
    const validCacheStructure = {
      version: CACHE_FORMAT_VERSION,
      cache_created: '2023-01-01T10:00:00.000Z',
      last_updated: '2023-01-01T11:00:00.000Z',
      project_path: testProjectPath,
      cached_files: {
        'session1.jsonl': {
          file_path: 'session1.jsonl',
          source_mtime: 1672574400000,
          cached_mtime: 1672578000000,
          message_count: 2,
          session_ids: ['test-session-1']
        },
        'session2.jsonl': {
          file_path: 'session2.jsonl',
          source_mtime: 1672574400000,
          cached_mtime: 1672578000000,
          message_count: 2,
          session_ids: ['test-session-1']
        }
      },
      sessions: {
        'test-session-1': {
          session_id: 'test-session-1',
          summary: '',
          first_timestamp: '2023-01-01T10:00:00.000Z',
          last_timestamp: '2023-01-01T10:01:00.000Z',
          message_count: 2,
          first_user_message: 'Hello',
          cwd: '/test/project',
          total_input_tokens: 10,
          total_output_tokens: 15,
          total_cache_creation_tokens: 0,
          total_cache_read_tokens: 0
        }
      },
      total_message_count: 2,
      total_input_tokens: 10,
      total_output_tokens: 15,
      total_cache_creation_tokens: 0,
      total_cache_read_tokens: 0,
      working_directories: [testProjectPath],
      earliest_timestamp: '2023-01-01T10:00:00.000Z',
      latest_timestamp: '2023-01-01T10:01:00.000Z'
    };

    mockFs.readFile = jest.fn().mockImplementation((path: string) => {
      if (path.includes('index.json')) {
        return Promise.resolve(JSON.stringify(validCacheStructure));
      }
      return Promise.resolve('{}');
    });
    mockFs.stat = jest.fn().mockResolvedValue({
      size: 1024,
      mtime: new Date(1672574400000) // Same as source_mtime in cache structure
    } as any);
    mockFs.readdir = jest.fn().mockResolvedValue([]);
  });

  afterEach(async () => {
    await Promise.all(Object.values(services).map(service => service.shutdown()));
  });

  describe('Complete Cache Lifecycle', () => {
    it('should create, build, validate, and aggregate cache successfully', async () => {
      // Step 1: Create cache directory
      const cacheInfo = await services.directory.createCacheDirectory(testProjectPath);
      
      expect(cacheInfo.exists).toBe(true);
      expect(cacheInfo.isValid).toBe(true);
      expect(cacheInfo.projectPath).toBe(testProjectPath);

      // Step 2: Build cache from JSONL files
      const buildResult = await services.builder.buildCache(testProjectPath, {
        forceRebuild: true,
        parallelProcessing: false
      });

      expect(buildResult.success).toBe(true);
      expect(buildResult.filesProcessed).toBe(2); // Should match mocked findJsonlFiles return value

      // Step 3: Validate the built cache
      const validationResult = await services.validation.validateCache(testProjectPath);
      
      expect(validationResult.is_valid).toBe(true);
      expect(validationResult.version_compatible).toBe(true);

      // Step 4: Get cache statistics
      const stats = await services.directory.getCacheStats(testProjectPath);
      
      expect(stats.cache_enabled).toBe(true);
      expect(stats.total_sessions).toBe(1);
      expect(stats.total_cached_messages).toBe(2);

      // Step 5: Aggregate across projects  
      const cacheContent = await mockFs.readFile('/test/project/.cache/index.json', 'utf-8');
      services.aggregation['aggregatedCache'].set(testProjectPath, JSON.parse(cacheContent as string));
      
      const aggregatedStats = services.aggregation.getAggregatedStats();
      
      expect(aggregatedStats.totalProjects).toBe(1);
      expect(aggregatedStats.totalSessions).toBe(1);
      expect(aggregatedStats.totalMessages).toBe(2);
      expect(aggregatedStats.totalInputTokens).toBe(10);
      expect(aggregatedStats.totalOutputTokens).toBe(15);
    });

    it('should handle cache invalidation workflow', async () => {
      // Setup existing cache
      const existingCache = {
        version: CACHE_FORMAT_VERSION,
        cache_created: '2023-01-01T10:00:00.000Z',
        last_updated: '2023-01-01T11:00:00.000Z',
        project_path: testProjectPath,
        cached_files: {
          'session1.jsonl': {
            file_path: 'session1.jsonl',
            source_mtime: 1672574400000, // 2023-01-01T10:00:00Z
            cached_mtime: 1672578000000,
            message_count: 2,
            session_ids: ['test-session-1']
          }
        },
        sessions: {
          'test-session-1': {
            session_id: 'test-session-1',
            message_count: 2,
            total_input_tokens: 10,
            total_output_tokens: 15,
            total_cache_creation_tokens: 0,
            total_cache_read_tokens: 0
          }
        },
        total_message_count: 2,
        total_input_tokens: 10,
        total_output_tokens: 15,
        total_cache_creation_tokens: 0,
        total_cache_read_tokens: 0
      };

      mockFs.readFile = jest.fn().mockImplementation((path: string) => {
        if (path.includes('index.json')) {
          return Promise.resolve(JSON.stringify(existingCache));
        }
        return Promise.resolve('{}');
      });

      // File has been modified (different mtime) - this will be called during validation
      mockFs.stat = jest.fn().mockResolvedValue({
        mtime: new Date('2023-01-01T12:00:00Z'), // Later than cached (1672578000000)
        size: 1024
      } as any);

      // Step 1: Check for invalidation needs
      const invalidationResult = await services.invalidation.checkAndInvalidate(testProjectPath);

      expect(invalidationResult.success).toBe(true);
      expect(invalidationResult.updatedFiles.length).toBeGreaterThan(0);

      // Step 2: Validate cache after invalidation
      const postInvalidationValidation = await services.validation.validateCache(testProjectPath);
      
      // After successful invalidation, validation should show cache is valid and no files need recaching
      expect(postInvalidationValidation.is_valid).toBe(true);
      expect(postInvalidationValidation.files_to_recache.length).toBe(0);
    });

    it('should handle file modification tracking integration', async () => {
      const filePaths = [
        '/test/project/session1.jsonl',
        '/test/project/session2.jsonl',
        '/test/project/session3.jsonl'
      ];

      // Step 1: Track files with initial mtime
      const initialMtime = new Date('2023-01-01T10:00:00Z');
      mockFs.stat = jest.fn().mockResolvedValue({
        size: 1024,
        mtime: initialMtime
      } as any);

      const trackingPromises = filePaths.map(fp => services.fileModification.trackFile(fp));
      const trackingResults = await Promise.all(trackingPromises);

      expect(trackingResults).toHaveLength(3);
      expect(trackingResults.every(r => r.exists)).toBe(true);

      // Step 2: Simulate file changes
      mockFs.stat = jest.fn()
        .mockResolvedValueOnce({ size: 1024, mtime: new Date('2023-01-01T10:00:00Z') } as any) // unchanged
        .mockResolvedValueOnce({ size: 2048, mtime: new Date('2023-01-01T11:00:00Z') } as any) // modified
        .mockRejectedValueOnce(new Error('File not found')); // deleted

      // Step 3: Batch check for modifications
      const batchResult = await services.fileModification.batchCheckFiles(filePaths);

      expect(batchResult.totalChecked).toBe(3);
      expect(batchResult.unchangedFiles).toHaveLength(1);
      expect(batchResult.changedFiles).toHaveLength(1);
      expect(batchResult.deletedFiles).toHaveLength(1);

      // Step 4: Use modification results for cache invalidation
      // Use the timestamp from initial tracking (convert to millis)
      const cachedMtime = initialMtime.getTime();
      const needsInvalidation = filePaths.map(fp => 
        services.fileModification.needsCacheInvalidation(fp, cachedMtime)
      );

      expect(needsInvalidation[0]).toBe(false); // unchanged
      expect(needsInvalidation[1]).toBe(true);  // modified
      expect(needsInvalidation[2]).toBe(true);  // deleted
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should gracefully handle corrupted cache files', async () => {
      // Corrupted cache file
      mockFs.readFile = jest.fn().mockResolvedValue('invalid json');

      const validationResult = await services.validation.validateCache(testProjectPath);

      expect(validationResult.is_valid).toBe(false);
      expect(validationResult.reason).toBe('Failed to parse index file');

      // Should be able to repair
      mockFs.rm = jest.fn().mockResolvedValue(undefined);
      const repairResult = await services.validation.repairCache(testProjectPath);

      expect(repairResult).toBe(true);
    });

    it('should handle file system permission errors', async () => {
      mockFs.mkdir = jest.fn().mockRejectedValue(new Error('Permission denied'));

      await expect(services.directory.createCacheDirectory(testProjectPath))
        .rejects.toThrow('Failed to create cache directory');
    });

    it('should handle network/disk failures during cache building', async () => {
      // Simulate disk full during build
      mockFs.writeFile = jest.fn().mockRejectedValue(new Error('No space left on device'));

      const buildResult = await services.builder.buildCache(testProjectPath);

      expect(buildResult.success).toBe(false);
      expect(buildResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Access Scenarios', () => {
    it('should handle multiple concurrent cache operations', async () => {
      const concurrentProjects = [
        '/test/project1',
        '/test/project2',
        '/test/project3'
      ];

      // Simulate concurrent cache creation
      const creationPromises = concurrentProjects.map(projectPath =>
        services.directory.createCacheDirectory(projectPath)
      );

      const creationResults = await Promise.allSettled(creationPromises);

      expect(creationResults.every(r => r.status === 'fulfilled')).toBe(true);

      // Simulate concurrent validation
      mockFs.readFile = jest.fn().mockResolvedValue(JSON.stringify({
        version: CACHE_FORMAT_VERSION,
        cache_created: '2023-01-01T10:00:00.000Z',
        last_updated: '2023-01-01T11:00:00.000Z',
        project_path: 'test',
        cached_files: {},
        sessions: {},
        total_message_count: 0
      }));

      const validationPromises = concurrentProjects.map(projectPath =>
        services.validation.validateCache(projectPath)
      );

      const validationResults = await Promise.allSettled(validationPromises);

      expect(validationResults.every(r => r.status === 'fulfilled')).toBe(true);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with large datasets', async () => {
      // Create a large cache structure
      const largeCache = {
        version: CACHE_FORMAT_VERSION,
        cache_created: '2023-01-01T00:00:00.000Z',
        last_updated: '2023-01-01T12:00:00.000Z',
        project_path: testProjectPath,
        cached_files: {},
        sessions: {},
        total_message_count: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cache_creation_tokens: 0,
        total_cache_read_tokens: 0,
        working_directories: [testProjectPath],
        earliest_timestamp: '2023-01-01T00:00:00.000Z',
        latest_timestamp: '2023-01-01T12:00:00.000Z'
      };

      // Generate 1000 sessions
      for (let i = 0; i < 1000; i++) {
        const sessionId = `load_test_session_${i}`;
        largeCache.sessions[sessionId] = {
          session_id: sessionId,
          first_timestamp: `2023-01-01T${(i % 24).toString().padStart(2, '0')}:00:00.000Z`,
          last_timestamp: `2023-01-01T${(i % 24).toString().padStart(2, '0')}:01:00.000Z`,
          message_count: 10,
          first_user_message: `Load test message ${i}`,
          cwd: testProjectPath,
          total_input_tokens: 100,
          total_output_tokens: 150,
          total_cache_creation_tokens: 10,
          total_cache_read_tokens: 5
        };
      }

      mockFs.readFile = jest.fn().mockResolvedValue(JSON.stringify(largeCache));
      mockFs.stat = jest.fn().mockResolvedValue({
        mtime: new Date('2023-01-01T10:00:00Z')
      });

      const startTime = Date.now();

      // Test validation performance
      const validationResult = await services.validation.validateCache(testProjectPath);
      
      // Test aggregation performance
      services.aggregation['aggregatedCache'].set(testProjectPath, largeCache as any);
      const aggregatedStats = services.aggregation.getAggregatedStats();
      
      // Test query performance
      const queryResult = await services.aggregation.querySessions({
        minTokens: 200,
        sortBy: 'tokens',
        sortOrder: 'desc',
        limit: 50
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(validationResult.is_valid).toBe(true);
      expect(aggregatedStats.totalSessions).toBe(1000);
      expect(queryResult.length).toBe(50);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Large dataset operations completed in ${totalTime}ms`);
    });
  });

  describe('Cross-Service Integration', () => {
    it('should integrate all services in a real workflow', async () => {
      const workflow = async () => {
        // 1. Initialize file tracking
        await services.fileModification.trackDirectory(testProjectPath, {
          recursive: true,
          pattern: /\.jsonl$/
        });

        // 2. Create cache directory
        const cacheInfo = await services.directory.createCacheDirectory(testProjectPath);

        // 3. Build initial cache
        const buildResult = await services.builder.buildCache(testProjectPath, {
          forceRebuild: true
        });

        // 4. Validate cache
        mockFs.readFile = jest.fn().mockResolvedValue(JSON.stringify({
          version: CACHE_FORMAT_VERSION,
          cache_created: '2023-01-01T10:00:00.000Z',
          last_updated: '2023-01-01T11:00:00.000Z',
          project_path: testProjectPath,
          cached_files: {
            'session1.jsonl': {
              file_path: 'session1.jsonl',
              source_mtime: 1672574400000,
              cached_mtime: 1672578000000,
              message_count: 2,
              session_ids: ['test-session-1']
            }
          },
          sessions: {
            'test-session-1': {
              session_id: 'test-session-1',
              message_count: 2,
              total_input_tokens: 10,
              total_output_tokens: 15,
              total_cache_creation_tokens: 0,
              total_cache_read_tokens: 0
            }
          },
          total_message_count: 2,
          total_input_tokens: 10,
          total_output_tokens: 15,
          total_cache_creation_tokens: 0,
          total_cache_read_tokens: 0
        }));

        const validationResult = await services.validation.validateCache(testProjectPath);

        // 5. Setup invalidation rules and check
        const invalidationResult = await services.invalidation.checkAndInvalidate(testProjectPath);

        // 6. Aggregate results
        const cacheContent = await mockFs.readFile('/test/project/.cache/index.json', 'utf-8');
        services.aggregation['aggregatedCache'].set(testProjectPath, JSON.parse(cacheContent as string));
        const aggregatedStats = services.aggregation.getAggregatedStats();

        return {
          cacheInfo,
          buildResult,
          validationResult,
          invalidationResult,
          aggregatedStats
        };
      };

      const results = await workflow();

      expect(results.cacheInfo.exists).toBe(true);
      expect(results.buildResult.success).toBe(true);
      expect(results.validationResult.is_valid).toBe(true);
      expect(results.invalidationResult.success).toBe(true);
      expect(results.aggregatedStats.totalProjects).toBe(1);
    });
  });
});