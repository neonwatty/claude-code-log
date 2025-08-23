import { CacheDirectoryService } from '../../services/cache-directory.service';
import { CacheValidationService } from '../../services/cache-validation.service';
import { JsonlCacheBuilderService } from '../../services/jsonl-cache-builder.service';
import { CacheAggregationService } from '../../services/cache-aggregation.service';
import { promises as fs } from 'fs';
import * as path from 'path';
import { CACHE_FORMAT_VERSION } from '../../utils/cache';

// Mock filesystem for testing
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      readFileSync: vi.fn(),
      readdirSync: vi.fn(),
      statSync: vi.fn(),
      createReadStream: vi.fn(),
      watch: vi.fn(),
    },
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      rename: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn()
    },
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    createReadStream: vi.fn(),
    watch: vi.fn(),
  };
});

const mockFs = vi.mocked(fs);

describe('Python Cache Compatibility Integration', () => {
  let cacheDirectoryService: CacheDirectoryService;
  let cacheValidationService: CacheValidationService;
  let cacheBuilderService: JsonlCacheBuilderService;
  let aggregationService: CacheAggregationService;
  
  const testProjectPath = '/test/python-compat-project';

  beforeEach(() => {
    vi.clearAllMocks();
    cacheDirectoryService = CacheDirectoryService.getInstance();
    cacheValidationService = CacheValidationService.getInstance();
    cacheBuilderService = JsonlCacheBuilderService.getInstance();
    aggregationService = CacheAggregationService.getInstance();
  });

  afterEach(async () => {
    await Promise.all([
      cacheDirectoryService.shutdown(),
      cacheValidationService.shutdown(),
      cacheBuilderService.shutdown(),
      aggregationService.shutdown()
    ]);
  });

  describe('Python-generated Cache Compatibility', () => {
    const createPythonGeneratedCache = () => ({
      version: "1.0.0",
      cache_created: "2023-01-01T10:00:00.000Z",
      last_updated: "2023-01-01T12:00:00.000Z",
      project_path: testProjectPath,
      cached_files: {
        "session_20230101_100000.jsonl": {
          file_path: "session_20230101_100000.jsonl",
          source_mtime: 1672574400000,
          cached_mtime: 1672581600000,
          message_count: 25,
          session_ids: ["abc123", "def456"]
        },
        "session_20230101_110000.jsonl": {
          file_path: "session_20230101_110000.jsonl",
          source_mtime: 1672578000000,
          cached_mtime: 1672581600000,
          message_count: 18,
          session_ids: ["ghi789"]
        }
      },
      total_message_count: 43,
      total_input_tokens: 2150,
      total_output_tokens: 3200,
      total_cache_creation_tokens: 150,
      total_cache_read_tokens: 75,
      sessions: {
        "abc123": {
          session_id: "abc123",
          summary: "Discussion about Python cache implementation",
          first_timestamp: "2023-01-01T10:00:00.000Z",
          last_timestamp: "2023-01-01T10:15:00.000Z",
          message_count: 15,
          first_user_message: "How do I implement caching in Python?",
          cwd: "/home/user/projects/python-cache",
          total_input_tokens: 750,
          total_output_tokens: 1200,
          total_cache_creation_tokens: 50,
          total_cache_read_tokens: 25
        },
        "def456": {
          session_id: "def456",
          summary: "Cache validation and consistency checks",
          first_timestamp: "2023-01-01T10:20:00.000Z",
          last_timestamp: "2023-01-01T10:35:00.000Z",
          message_count: 10,
          first_user_message: "How can I validate cache integrity?",
          cwd: "/home/user/projects/python-cache",
          total_input_tokens: 500,
          total_output_tokens: 800,
          total_cache_creation_tokens: 30,
          total_cache_read_tokens: 20
        },
        "ghi789": {
          session_id: "ghi789",
          summary: "Performance optimization strategies",
          first_timestamp: "2023-01-01T11:00:00.000Z",
          last_timestamp: "2023-01-01T11:25:00.000Z",
          message_count: 18,
          first_user_message: "What are the best practices for cache performance?",
          cwd: "/home/user/projects/python-cache",
          total_input_tokens: 900,
          total_output_tokens: 1200,
          total_cache_creation_tokens: 70,
          total_cache_read_tokens: 30
        }
      },
      working_directories: [
        "/home/user/projects/python-cache"
      ],
      earliest_timestamp: "2023-01-01T10:00:00.000Z",
      latest_timestamp: "2023-01-01T11:25:00.000Z"
    });

    it.skip('should successfully read and validate Python-generated cache', async () => {
      const pythonCache = createPythonGeneratedCache();
      
      // Mock the expected file path that the service will access
      const expectedPath = path.join(testProjectPath, '.cache', 'index.json');
      
      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(JSON.stringify(pythonCache));
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1672574400000) // Match the cache source_mtime for first file
      } as any);

      const validationResult = await cacheValidationService.validateCache(testProjectPath, {
        enableVersionMigration: true
      });

      console.log('Validation result:', JSON.stringify(validationResult, null, 2));

      expect(validationResult.is_valid).toBe(true);
      expect(validationResult.version_compatible).toBe(true);
      expect(validationResult.files_to_recache).toEqual([]);
    });

    it.skip('should correctly parse Python cache statistics', async () => {
      // TODO: Fix cache directory service mock for stats parsing
      const pythonCache = createPythonGeneratedCache();
      
      // Setup cache directory
      const cacheInfo = {
        projectPath: testProjectPath,
        cachePath: path.join(testProjectPath, '.cache'),
        indexPath: path.join(testProjectPath, '.cache', 'index.json'),
        exists: true,
        isValid: true
      };
      
      cacheDirectoryService['cacheDirectories'].set(testProjectPath, cacheInfo);
      mockFs.readFile.mockResolvedValue(JSON.stringify(pythonCache));

      const stats = await cacheDirectoryService.getCacheStats(testProjectPath);

      expect(stats.cache_enabled).toBe(true);
      expect(stats.cached_files_count).toBe(2);
      expect(stats.total_cached_messages).toBe(43);
      expect(stats.total_sessions).toBe(3);
      expect(stats.cache_created).toBe("2023-01-01T10:00:00.000Z");
      expect(stats.last_updated).toBe("2023-01-01T12:00:00.000Z");
    });

    it('should handle Python cache aggregation correctly', async () => {
      const pythonCache = createPythonGeneratedCache();
      
      // Mock aggregation service cache loading
      aggregationService['aggregatedCache'].set(testProjectPath, pythonCache as any);

      const aggregatedStats = aggregationService.getAggregatedStats();

      expect(aggregatedStats.totalProjects).toBe(1);
      expect(aggregatedStats.totalSessions).toBe(3);
      expect(aggregatedStats.totalMessages).toBe(43);
      expect(aggregatedStats.totalFiles).toBe(2);
      expect(aggregatedStats.totalInputTokens).toBe(2150);
      expect(aggregatedStats.totalOutputTokens).toBe(3200);
      expect(aggregatedStats.averageMessagesPerSession).toBe(Math.round(43 / 3));
    });

    it('should query Python cache sessions correctly', async () => {
      const pythonCache = createPythonGeneratedCache();
      
      aggregationService['aggregatedCache'].set(testProjectPath, pythonCache as any);

      const sessions = await aggregationService.querySessions({
        projects: [testProjectPath],
        minTokens: 1000,
        sortBy: 'tokens',
        sortOrder: 'desc'
      });

      expect(sessions.length).toBe(3); // abc123, def456, and ghi789 all have >1000 total tokens
      expect(sessions[0].totalTokens).toBeGreaterThan(sessions[1].totalTokens);
      expect(sessions.every(s => s.projectPath === testProjectPath)).toBe(true);
    });
  });

  describe('Legacy Python Cache Migration', () => {
    const createLegacyPythonCache_090 = () => ({
      version: "0.9.0",
      cache_created: "2023-01-01T10:00:00.000Z",
      last_updated: "2023-01-01T10:00:00.000Z",
      project_path: testProjectPath,
      cached_files: {
        "old_session.jsonl": {
          file_path: "old_session.jsonl",
          source_mtime: 1672574400000,
          cached_mtime: 1672581600000,
          message_count: 10,
          session_ids: ["old123"]
        }
      },
      sessions: {
        "old123": {
          session_id: "old123",
          first_timestamp: "2023-01-01T10:00:00.000Z",
          last_timestamp: "2023-01-01T10:15:00.000Z",
          message_count: 10,
          first_user_message: "Legacy session",
          total_input_tokens: 100,
          total_output_tokens: 200,
          total_cache_creation_tokens: 10,
          total_cache_read_tokens: 5
          // Missing some fields that should be added in migration
        }
      },
      total_message_count: 10,
      total_input_tokens: 100,
      total_output_tokens: 200,
      total_cache_creation_tokens: 10,
      total_cache_read_tokens: 5,
      working_directories: [testProjectPath],
      earliest_timestamp: "2023-01-01T10:00:00.000Z",
      latest_timestamp: "2023-01-01T10:15:00.000Z"
      // Missing newer fields
    });

    const createLegacyPythonCache_080 = () => ({
      version: "0.8.0",
      created: "2023-01-01T10:00:00.000Z", // Different field name  
      project_path: testProjectPath,
      files: { // Different field name
        "legacy.jsonl": {
          file_path: "legacy.jsonl", 
          source_mtime: 1672574400000,
          message_count: 5
        }
      },
      session_data: { // Different field name
        "legacy456": {
          message_count: 5,
          first_timestamp: "2023-01-01T10:00:00.000Z",
          last_timestamp: "2023-01-01T10:10:00.000Z"
        }
      },
      message_count: 5, // Different field name
      input_tokens: 50, // Different field name
      output_tokens: 100 // Different field name
    });

    it.skip('should migrate 0.9.0 Python cache to current version', async () => {
      // TODO: Fix migration validation mock setup
      const legacyCache = createLegacyPythonCache_090();
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(legacyCache));
      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1672574400000)
      } as any);

      const result = await cacheValidationService.validateCache(testProjectPath, {
        enableVersionMigration: true
      });

      expect(result.is_valid).toBe(true);
      expect(result.version_compatible).toBe(true);
      
      // Verify migration was performed
      const writeCall = mockFs.writeFile.mock.calls[0];
      const migratedData = JSON.parse(writeCall[1] as string);
      
      expect(migratedData.version).toBe(CACHE_FORMAT_VERSION);
      expect(migratedData.total_cache_creation_tokens).toBeDefined();
      expect(migratedData.total_cache_read_tokens).toBeDefined();
      expect(migratedData.working_directories).toBeDefined();
      expect(migratedData.earliest_timestamp).toBeDefined();
      expect(migratedData.latest_timestamp).toBeDefined();
    });

    it.skip('should migrate 0.8.0 Python cache to current version', async () => {
      const legacyCache = createLegacyPythonCache_080();
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(legacyCache));
      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1672574400000)
      } as any);

      const result = await cacheValidationService.validateCache(testProjectPath, {
        enableVersionMigration: true
      });

      expect(result.is_valid).toBe(true);
      expect(result.version_compatible).toBe(true);
      
      // Verify migration was performed
      const writeCall = mockFs.writeFile.mock.calls[0];
      const migratedData = JSON.parse(writeCall[1] as string);
      
      expect(migratedData.version).toBe(CACHE_FORMAT_VERSION);
      expect(migratedData.cache_created).toBe(legacyCache.created);
      expect(migratedData.cached_files).toEqual(legacyCache.files);
      expect(migratedData.total_message_count).toBe(legacyCache.message_count);
      expect(migratedData.total_input_tokens).toBe(legacyCache.input_tokens);
      expect(migratedData.total_output_tokens).toBe(legacyCache.output_tokens);
      
      // Check session migration
      expect(migratedData.sessions.legacy456).toBeDefined();
      expect(migratedData.sessions.legacy456.session_id).toBe('legacy456');
      expect(migratedData.sessions.legacy456.total_cache_creation_tokens).toBe(0);
      expect(migratedData.sessions.legacy456.total_cache_read_tokens).toBe(0);
    });

    it.skip('should handle migration failure gracefully', async () => {
      // TODO: Fix migration failure mock setup
      const legacyCache = createLegacyPythonCache_090();
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(legacyCache));
      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      const result = await cacheValidationService.validateCache(testProjectPath, {
        enableVersionMigration: true
      });

      expect(result.is_valid).toBe(false);
      expect(result.reason).toContain('Disk full');
    });
  });

  describe('Python Cache Structure Validation', () => {
    it('should validate Python cache with snake_case field names', async () => {
      const pythonStyleCache = {
        version: CACHE_FORMAT_VERSION,
        cache_created: "2023-01-01T10:00:00.000Z",
        last_updated: "2023-01-01T12:00:00.000Z",
        project_path: testProjectPath,
        cached_files: {
          "test.jsonl": {
            file_path: "test.jsonl",
            source_mtime: 1672574400000,
            cached_mtime: 1672581600000,
            message_count: 5,
            session_ids: ["test123"]
          }
        },
        total_message_count: 5,
        total_input_tokens: 100,
        total_output_tokens: 200,
        total_cache_creation_tokens: 10,
        total_cache_read_tokens: 5,
        sessions: {
          "test123": {
            session_id: "test123",
            first_timestamp: "2023-01-01T10:00:00.000Z",
            last_timestamp: "2023-01-01T10:05:00.000Z",
            message_count: 5,
            first_user_message: "Test message",
            total_input_tokens: 100,
            total_output_tokens: 200,
            total_cache_creation_tokens: 10,
            total_cache_read_tokens: 5
          }
        },
        working_directories: [testProjectPath],
        earliest_timestamp: "2023-01-01T10:00:00.000Z",
        latest_timestamp: "2023-01-01T10:05:00.000Z"
      };

      const validationResult = (cacheValidationService as any).validateStructure(pythonStyleCache);

      expect(validationResult.isValid).toBe(true);
    });

    it('should detect Python cache corruption', async () => {
      const corruptedPythonCache = {
        version: CACHE_FORMAT_VERSION,
        cache_created: "2023-01-01T10:00:00.000Z",
        last_updated: "2023-01-01T10:00:00.000Z",
        project_path: testProjectPath,
        cached_files: "invalid", // Should be object
        sessions: {},
        total_message_count: 0
      };

      const validationResult = (cacheValidationService as any).validateStructure(corruptedPythonCache);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.reason).toContain('Invalid cached_files field type');
    });
  });

  describe('Cross-language Token Calculations', () => {
    it('should calculate totals consistently with Python implementation', async () => {
      const testCache = createPythonGeneratedCache();
      
      aggregationService['aggregatedCache'].set(testProjectPath, testCache as any);

      const stats = aggregationService.getAggregatedStats();

      // Verify token calculations match Python implementation
      const expectedInputTokens = Object.values(testCache.sessions)
        .reduce((sum, session) => sum + session.total_input_tokens, 0);
      const expectedOutputTokens = Object.values(testCache.sessions)
        .reduce((sum, session) => sum + session.total_output_tokens, 0);
      const expectedCacheCreationTokens = Object.values(testCache.sessions)
        .reduce((sum, session) => sum + session.total_cache_creation_tokens, 0);
      const expectedCacheReadTokens = Object.values(testCache.sessions)
        .reduce((sum, session) => sum + session.total_cache_read_tokens, 0);

      expect(stats.totalInputTokens).toBe(expectedInputTokens);
      expect(stats.totalOutputTokens).toBe(expectedOutputTokens);
      expect(stats.totalCacheCreationTokens).toBe(expectedCacheCreationTokens);
      expect(stats.totalCacheReadTokens).toBe(expectedCacheReadTokens);

      // Verify averages
      expect(stats.averageTokensPerMessage).toBe(
        Math.round((expectedInputTokens + expectedOutputTokens) / stats.totalMessages)
      );
    });
  });

  describe('Time-based Compatibility', () => {
    it('should handle Python ISO timestamp formats correctly', async () => {
      const pythonCache = createPythonGeneratedCache();
      
      aggregationService['aggregatedCache'].set(testProjectPath, pythonCache as any);

      const timeAggregation = aggregationService.createTimeBasedAggregation(
        'day',
        '2023-01-01T00:00:00.000Z',
        '2023-01-02T00:00:00.000Z'
      );

      expect(timeAggregation.dataPoints.length).toBeGreaterThan(0);
      expect(timeAggregation.dataPoints[0].sessionCount).toBeGreaterThan(0);
      expect(timeAggregation.granularity).toBe('day');
    });

    it('should correctly parse Python datetime strings', () => {
      const pythonTimestamp = "2023-01-01T10:00:00.000Z";
      const jsDate = new Date(pythonTimestamp);

      expect(jsDate.getTime()).toBe(1672567200000);
      expect(jsDate.toISOString()).toBe(pythonTimestamp);
    });
  });

  describe('Performance Compatibility', () => {
    it('should handle large Python-generated caches efficiently', async () => {
      // Create a large cache similar to what Python might generate
      const largePythonCache = {
        version: CACHE_FORMAT_VERSION,
        cache_created: "2023-01-01T00:00:00.000Z",
        last_updated: "2023-01-01T23:59:59.000Z",
        project_path: testProjectPath,
        cached_files: {},
        sessions: {},
        total_message_count: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cache_creation_tokens: 0,
        total_cache_read_tokens: 0,
        working_directories: [testProjectPath],
        earliest_timestamp: "2023-01-01T00:00:00.000Z",
        latest_timestamp: "2023-01-01T23:59:59.000Z"
      };

      // Generate 1000 sessions
      for (let i = 0; i < 1000; i++) {
        const sessionId = `session_${i.toString().padStart(4, '0')}`;
        largePythonCache.sessions[sessionId] = {
          session_id: sessionId,
          first_timestamp: `2023-01-01T${Math.floor(i / 42).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}:00.000Z`,
          last_timestamp: `2023-01-01T${Math.floor(i / 42).toString().padStart(2, '0')}:${((i % 60) + 1).toString().padStart(2, '0')}:00.000Z`,
          message_count: Math.floor(Math.random() * 50) + 1,
          first_user_message: `Test message ${i}`,
          total_input_tokens: Math.floor(Math.random() * 1000),
          total_output_tokens: Math.floor(Math.random() * 1500),
          total_cache_creation_tokens: Math.floor(Math.random() * 100),
          total_cache_read_tokens: Math.floor(Math.random() * 50)
        };
      }

      // Calculate totals
      largePythonCache.total_message_count = Object.values(largePythonCache.sessions)
        .reduce((sum: number, session: any) => sum + session.message_count, 0) as number;
      largePythonCache.total_input_tokens = Object.values(largePythonCache.sessions)
        .reduce((sum: number, session: any) => sum + session.total_input_tokens, 0) as number;

      aggregationService['aggregatedCache'].set(testProjectPath, largePythonCache as any);

      const startTime = Date.now();
      const stats = aggregationService.getAggregatedStats();
      const endTime = Date.now();

      expect(stats.totalSessions).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  function createPythonGeneratedCache() {
    return {
      version: "1.0.0",
      cache_created: "2023-01-01T10:00:00.000Z",
      last_updated: "2023-01-01T12:00:00.000Z",
      project_path: testProjectPath,
      cached_files: {
        "session_20230101_100000.jsonl": {
          file_path: "session_20230101_100000.jsonl",
          source_mtime: 1672574400000,
          cached_mtime: 1672581600000,
          message_count: 25,
          session_ids: ["abc123", "def456"]
        }
      },
      total_message_count: 25,
      total_input_tokens: 1250,
      total_output_tokens: 2000,
      total_cache_creation_tokens: 80,
      total_cache_read_tokens: 45,
      sessions: {
        "abc123": {
          session_id: "abc123",
          summary: "Python compatibility test session",
          first_timestamp: "2023-01-01T10:00:00.000Z",
          last_timestamp: "2023-01-01T10:15:00.000Z",
          message_count: 25,
          first_user_message: "Testing Python cache compatibility",
          cwd: "/home/user/projects/python-cache",
          total_input_tokens: 1250,
          total_output_tokens: 2000,
          total_cache_creation_tokens: 80,
          total_cache_read_tokens: 45
        }
      },
      working_directories: ["/home/user/projects/python-cache"],
      earliest_timestamp: "2023-01-01T10:00:00.000Z",
      latest_timestamp: "2023-01-01T10:15:00.000Z"
    };
  }
});