import { 
  CacheDirectoryService,
  CacheValidationService,
  FileModificationService,
  JsonlCacheBuilderService,
  CacheInvalidationService,
  CacheAggregationService 
} from '../../services';
import { promises as fs } from 'fs';
import { performance } from 'perf_hooks';

// Mock filesystem for performance testing
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
      readdir: vi.fn(),
      rm: vi.fn()
    },
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    createReadStream: vi.fn(),
    watch: vi.fn(),
  };
});

const mockFs = vi.mocked(fs);

describe('Cache System Performance Tests', () => {
  let services: {
    directory: CacheDirectoryService;
    validation: CacheValidationService;
    fileModification: FileModificationService;
    builder: JsonlCacheBuilderService;
    invalidation: CacheInvalidationService;
    aggregation: CacheAggregationService;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    services = {
      directory: CacheDirectoryService.getInstance(),
      validation: CacheValidationService.getInstance(),
      fileModification: FileModificationService.getInstance(),
      builder: JsonlCacheBuilderService.getInstance(),
      invalidation: CacheInvalidationService.getInstance(),
      aggregation: CacheAggregationService.getInstance()
    };
  });

  afterEach(async () => {
    await Promise.all(Object.values(services).map(service => service.shutdown()));
  });

  describe('File Modification Service Performance', () => {
    it('should handle batch file checking efficiently', async () => {
      const fileCount = 1000;
      const filePaths = Array.from({ length: fileCount }, (_, i) => 
        `/test/project/file_${i.toString().padStart(4, '0')}.jsonl`
      );

      // Mock file stats
      const mockStats = {
        size: 1024,
        mtime: new Date('2023-01-01T10:00:00Z')
      };

      mockFs.stat.mockResolvedValue(mockStats as any);

      // Track all files first
      const trackStart = performance.now();
      await Promise.all(filePaths.map(fp => services.fileModification.trackFile(fp)));
      const trackEnd = performance.now();

      // Batch check performance
      const batchStart = performance.now();
      const result = await services.fileModification.batchCheckFiles(filePaths);
      const batchEnd = performance.now();

      const trackTime = trackEnd - trackStart;
      const batchTime = batchEnd - batchStart;

      expect(result.totalChecked).toBe(fileCount);
      expect(trackTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(batchTime).toBeLessThan(2000); // Batch check should be faster
      expect(result.checkDurationMs).toBeLessThan(batchTime + 100); // Internal timing should be close

      console.log(`File tracking: ${trackTime.toFixed(2)}ms for ${fileCount} files`);
      console.log(`Batch checking: ${batchTime.toFixed(2)}ms for ${fileCount} files`);
      console.log(`Average per file: ${(batchTime / fileCount).toFixed(2)}ms`);
    });

    it('should perform synchronous batch checking faster than async', () => {
      const fileCount = 100;
      const filePaths = Array.from({ length: fileCount }, (_, i) => 
        `/test/project/sync_file_${i}.jsonl`
      );

      // Mock sync stats
      const mockStats = {
        size: 1024,
        mtime: { getTime: () => 1672574400000 }
      };

      require('fs').statSync = vi.fn().mockReturnValue(mockStats);

      const syncStart = performance.now();
      const result = services.fileModification.batchCheckFilesSync(filePaths);
      const syncEnd = performance.now();

      const syncTime = syncEnd - syncStart;

      expect(result.totalChecked).toBe(fileCount);
      expect(syncTime).toBeLessThan(500); // Should be very fast
      expect(result.checkDurationMs).toBeLessThan(syncTime + 50);

      console.log(`Sync batch checking: ${syncTime.toFixed(2)}ms for ${fileCount} files`);
    });
  });

  describe('Cache Validation Performance', () => {
    it.skip('should validate large caches quickly', async () => {
      const createLargeCache = (sessionCount: number) => {
        const cache: any = {
          version: '1.0.0',
          cache_created: '2023-01-01T00:00:00.000Z',
          last_updated: '2023-01-01T12:00:00.000Z',
          project_path: '/test/large-project',
          cached_files: {},
          sessions: {},
          total_message_count: 0,
          total_input_tokens: 0,
          total_output_tokens: 0,
          total_cache_creation_tokens: 0,
          total_cache_read_tokens: 0,
          working_directories: ['/test/large-project'],
          earliest_timestamp: '2023-01-01T00:00:00.000Z',
          latest_timestamp: '2023-01-01T12:00:00.000Z'
        };

        // Generate many sessions
        for (let i = 0; i < sessionCount; i++) {
          const sessionId = `session_${i}`;
          cache.sessions[sessionId] = {
            session_id: sessionId,
            first_timestamp: '2023-01-01T00:00:00.000Z',
            last_timestamp: '2023-01-01T01:00:00.000Z',
            message_count: 10,
            first_user_message: `Message ${i}`,
            total_input_tokens: 100,
            total_output_tokens: 150,
            total_cache_creation_tokens: 10,
            total_cache_read_tokens: 5
          };
        }

        // Generate cached files
        for (let i = 0; i < Math.ceil(sessionCount / 10); i++) {
          const fileName = `batch_${i}.jsonl`;
          cache.cached_files[fileName] = {
            file_path: fileName,
            source_mtime: 1672574400000,
            cached_mtime: 1672578000000,
            message_count: Math.min(100, sessionCount - i * 10),
            session_ids: Array.from({ length: Math.min(10, sessionCount - i * 10) }, 
              (_, j) => `session_${i * 10 + j}`)
          };
        }

        return cache;
      };

      const largeCache = createLargeCache(5000);
      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(JSON.stringify(largeCache));
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1672574400000)
      } as any);

      const validationStart = performance.now();
      const result = await services.validation.validateCache('/test/large-project');
      const validationEnd = performance.now();

      const validationTime = validationEnd - validationStart;

      expect(result.is_valid).toBe(true);
      expect(validationTime).toBeLessThan(3000); // Should validate within 3 seconds

      console.log(`Large cache validation: ${validationTime.toFixed(2)}ms for 5000 sessions`);
    });

    it.skip('should perform quick validation very fast', async () => {
      const cache = {
        version: '1.0.0',
        cache_created: '2023-01-01T00:00:00.000Z',
        last_updated: '2023-01-01T12:00:00.000Z',
        project_path: '/test/quick-project',
        cached_files: {},
        sessions: {},
        total_message_count: 0
      };

      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(JSON.stringify(cache));

      const quickStart = performance.now();
      const result = await services.validation.quickValidate('/test/quick-project');
      const quickEnd = performance.now();

      const quickTime = quickEnd - quickStart;

      expect(result).toBe(true);
      expect(quickTime).toBeLessThan(100); // Should be very fast

      console.log(`Quick validation: ${quickTime.toFixed(2)}ms`);
    });
  });

  describe('Cache Aggregation Performance', () => {
    it('should aggregate multiple large projects efficiently', async () => {
      const projectCount = 10;
      const sessionsPerProject = 500;

      // Setup multiple projects in aggregation service
      for (let p = 0; p < projectCount; p++) {
        const projectPath = `/test/project_${p}`;
        const cache: any = {
          version: '1.0.0',
          cache_created: '2023-01-01T00:00:00.000Z',
          last_updated: '2023-01-01T12:00:00.000Z',
          project_path: projectPath,
          cached_files: {},
          sessions: {},
          total_message_count: sessionsPerProject * 10,
          total_input_tokens: sessionsPerProject * 100,
          total_output_tokens: sessionsPerProject * 150,
          total_cache_creation_tokens: sessionsPerProject * 10,
          total_cache_read_tokens: sessionsPerProject * 5,
          working_directories: [projectPath],
          earliest_timestamp: '2023-01-01T00:00:00.000Z',
          latest_timestamp: '2023-01-01T12:00:00.000Z'
        };

        // Generate sessions for this project
        for (let s = 0; s < sessionsPerProject; s++) {
          const sessionId = `project_${p}_session_${s}`;
          cache.sessions[sessionId] = {
            session_id: sessionId,
            first_timestamp: '2023-01-01T00:00:00.000Z',
            last_timestamp: '2023-01-01T01:00:00.000Z',
            message_count: 10,
            first_user_message: `Project ${p} Session ${s}`,
            cwd: projectPath,
            total_input_tokens: 100,
            total_output_tokens: 150,
            total_cache_creation_tokens: 10,
            total_cache_read_tokens: 5
          };
        }

        services.aggregation['aggregatedCache'].set(projectPath, cache);
      }

      // Test aggregated statistics performance
      const statsStart = performance.now();
      const stats = services.aggregation.getAggregatedStats();
      const statsEnd = performance.now();

      // Test project summaries performance
      const summariesStart = performance.now();
      const summaries = services.aggregation.getProjectSummaries();
      const summariesEnd = performance.now();

      // Test session query performance
      const queryStart = performance.now();
      const sessions = await services.aggregation.querySessions({
        minTokens: 200,
        sortBy: 'tokens',
        sortOrder: 'desc',
        limit: 100
      });
      const queryEnd = performance.now();

      const statsTime = statsEnd - statsStart;
      const summariesTime = summariesEnd - summariesStart;
      const queryTime = queryEnd - queryStart;

      expect(stats.totalProjects).toBe(projectCount);
      expect(stats.totalSessions).toBe(projectCount * sessionsPerProject);
      expect(summaries.length).toBe(projectCount);
      expect(sessions.length).toBeGreaterThan(0);

      expect(statsTime).toBeLessThan(500);
      expect(summariesTime).toBeLessThan(1000);
      expect(queryTime).toBeLessThan(2000);

      console.log(`Stats calculation: ${statsTime.toFixed(2)}ms for ${projectCount} projects`);
      console.log(`Summaries generation: ${summariesTime.toFixed(2)}ms for ${projectCount} projects`);
      console.log(`Session query: ${queryTime.toFixed(2)}ms for ${stats.totalSessions} sessions`);
    });

    it('should handle time-based aggregations efficiently', () => {
      // Setup a project with sessions spread over time
      const projectPath = '/test/time-project';
      const cache: any = {
        version: '1.0.0',
        project_path: projectPath,
        sessions: {},
        earliest_timestamp: '2023-01-01T00:00:00.000Z',
        latest_timestamp: '2023-01-31T23:59:59.000Z'
      };

      // Generate sessions across a month
      for (let day = 1; day <= 31; day++) {
        for (let hour = 0; hour < 24; hour += 4) {
          const sessionId = `day_${day}_hour_${hour}`;
          const timestamp = `2023-01-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:00:00.000Z`;
          
          cache.sessions[sessionId] = {
            session_id: sessionId,
            first_timestamp: timestamp,
            last_timestamp: timestamp,
            message_count: 5,
            first_user_message: `Day ${day} Hour ${hour}`,
            total_input_tokens: 50,
            total_output_tokens: 75,
            total_cache_creation_tokens: 5,
            total_cache_read_tokens: 3
          };
        }
      }

      services.aggregation['aggregatedCache'].set(projectPath, cache);

      // Test different granularities
      const dailyStart = performance.now();
      const dailyAgg = services.aggregation.createTimeBasedAggregation('day', '2023-01-01', '2023-01-31');
      const dailyEnd = performance.now();

      const hourlyStart = performance.now();
      const hourlyAgg = services.aggregation.createTimeBasedAggregation('hour', '2023-01-01', '2023-01-02');
      const hourlyEnd = performance.now();

      const dailyTime = dailyEnd - dailyStart;
      const hourlyTime = hourlyEnd - hourlyStart;

      expect(dailyAgg.dataPoints.length).toBe(31);
      expect(hourlyAgg.dataPoints.length).toBe(25); // 24 hours + 1
      expect(dailyTime).toBeLessThan(1000);
      expect(hourlyTime).toBeLessThan(500);

      console.log(`Daily aggregation: ${dailyTime.toFixed(2)}ms for 31 days`);
      console.log(`Hourly aggregation: ${hourlyTime.toFixed(2)}ms for 25 hours`);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage under load', async () => {
      const getMemoryUsage = () => {
        const usage = process.memoryUsage();
        return {
          heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
          external: Math.round(usage.external / 1024 / 1024)
        };
      };

      const initialMemory = getMemoryUsage();

      // Simulate heavy cache operations
      const projectCount = 50;
      const sessionsPerProject = 100;

      for (let p = 0; p < projectCount; p++) {
        const projectPath = `/test/memory_project_${p}`;
        const cache: any = {
          version: '1.0.0',
          project_path: projectPath,
          sessions: {},
          cached_files: {}
        };

        for (let s = 0; s < sessionsPerProject; s++) {
          cache.sessions[`session_${s}`] = {
            session_id: `session_${s}`,
            first_timestamp: '2023-01-01T00:00:00.000Z',
            last_timestamp: '2023-01-01T01:00:00.000Z',
            message_count: 20,
            first_user_message: 'A'.repeat(1000), // Large message
            total_input_tokens: 500,
            total_output_tokens: 750,
            total_cache_creation_tokens: 50,
            total_cache_read_tokens: 25
          };
        }

        services.aggregation['aggregatedCache'].set(projectPath, cache);
      }

      const peakMemory = getMemoryUsage();

      // Clear cache and force garbage collection
      services.aggregation.clearAggregatedData();
      if (global.gc) {
        global.gc();
      }

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = getMemoryUsage();

      console.log(`Memory usage - Initial: ${initialMemory.heapUsed}MB, Peak: ${peakMemory.heapUsed}MB, Final: ${finalMemory.heapUsed}MB`);

      // Memory should not grow excessively
      expect(peakMemory.heapUsed - initialMemory.heapUsed).toBeLessThan(500); // Less than 500MB increase
      
      // Memory should be cleaned up reasonably well
      expect(finalMemory.heapUsed - initialMemory.heapUsed).toBeLessThan(100); // Less than 100MB retained
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent cache operations efficiently', async () => {
      const concurrentOperations = 50;
      const projectPath = '/test/concurrent-project';

      // Setup concurrent file modification checks
      const fileModificationPromises = Array.from({ length: concurrentOperations }, async (_, i) => {
        const filePath = `/test/concurrent/file_${i}.jsonl`;
        
        mockFs.stat.mockResolvedValue({
          size: 1024 + i,
          mtime: new Date(`2023-01-01T${(i % 24).toString().padStart(2, '0')}:00:00Z`)
        } as any);

        return services.fileModification.trackFile(filePath);
      });

      // Setup concurrent validation operations
      const validationPromises = Array.from({ length: concurrentOperations }, async (_, i) => {
        const cache = {
          version: '1.0.0',
          cache_created: '2023-01-01T00:00:00.000Z',
          last_updated: '2023-01-01T12:00:00.000Z',
          project_path: `${projectPath}_${i}`,
          cached_files: {},
          sessions: {},
          total_message_count: 0
        };

        mockFs.access.mockResolvedValue(undefined); // File exists
        mockFs.readFile.mockResolvedValue(JSON.stringify(cache));
        
        return services.validation.quickValidate(`${projectPath}_${i}`);
      });

      const concurrentStart = performance.now();
      
      const [fileResults, validationResults] = await Promise.all([
        Promise.allSettled(fileModificationPromises),
        Promise.allSettled(validationPromises)
      ]);

      const concurrentEnd = performance.now();
      const concurrentTime = concurrentEnd - concurrentStart;

      const successfulFileOps = fileResults.filter(r => r.status === 'fulfilled').length;
      const successfulValidations = validationResults.filter(r => r.status === 'fulfilled').length;

      expect(successfulFileOps).toBe(concurrentOperations);
      expect(successfulValidations).toBe(concurrentOperations);
      expect(concurrentTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Concurrent operations: ${concurrentTime.toFixed(2)}ms for ${concurrentOperations * 2} operations`);
      console.log(`Average per operation: ${(concurrentTime / (concurrentOperations * 2)).toFixed(2)}ms`);
    });
  });
});