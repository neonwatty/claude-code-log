import { CacheDirectoryService } from '../../services/cache-directory.service';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { CACHE_FORMAT_VERSION, CACHE_INDEX_FILENAME } from '../../utils/cache';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('fs');

const mockFs = vi.mocked(fs);
const mockFsSync = vi.mocked(fsSync);

describe('CacheDirectoryService', () => {
  let service: CacheDirectoryService;
  let mockProjectPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    service = CacheDirectoryService.getInstance();
    mockProjectPath = '/test/project';
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CacheDirectoryService.getInstance();
      const instance2 = CacheDirectoryService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Cache Directory Creation', () => {
    it('should create cache directory and index file', async () => {
      const mockStats = { mtime: new Date('2023-01-01') };
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      const result = await service.createCacheDirectory(mockProjectPath);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.cache'),
        { recursive: true }
      );
      expect(result.projectPath).toBe(mockProjectPath);
      expect(result.exists).toBe(true);
      expect(result.isValid).toBe(true);
    });

    it('should handle existing cache directory', async () => {
      const existingIndex = {
        version: CACHE_FORMAT_VERSION,
        cache_created: '2023-01-01T00:00:00.000Z',
        project_path: mockProjectPath,
        cached_files: {},
        sessions: {},
        total_message_count: 0
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingIndex));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      const result = await service.createCacheDirectory(mockProjectPath);

      expect(result.projectPath).toBe(mockProjectPath);
      expect(result.exists).toBe(true);
    });

    it('should emit creation event', async () => {
      const eventSpy = vi.fn();
      service.on('directoryEvent', eventSpy);

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await service.createCacheDirectory(mockProjectPath);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'created',
          projectPath: mockProjectPath
        })
      );
    });
  });

  describe('Cache Discovery', () => {
    it('should discover existing cache directories', async () => {
      const mockSearchPaths = ['/search/path1', '/search/path2'];
      const mockEntries = [
        { name: '.cache', isDirectory: () => true },
        { name: 'other', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false }
      ];

      mockFs.readdir.mockResolvedValue(mockEntries as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        version: CACHE_FORMAT_VERSION,
        project_path: '/search/path1',
        sessions: {}
      }));

      const result = await service.discoverCacheDirectories(mockSearchPaths);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].cachePath).toContain('.cache');
    });

    it('should handle discovery errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await service.discoverCacheDirectories(['/invalid/path']);

      expect(result).toEqual([]);
    });
  });

  describe('Cache Validation', () => {
    it('should validate cache directory structure', async () => {
      const validIndex = {
        version: CACHE_FORMAT_VERSION,
        project_path: mockProjectPath,
        sessions: {}
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(validIndex));

      const isValid = await service.validateCacheDirectory('/cache/path');

      expect(isValid).toBe(true);
    });

    it('should return false for invalid cache structure', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const isValid = await service.validateCacheDirectory('/invalid/path');

      expect(isValid).toBe(false);
    });

    it('should return false for malformed JSON', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');

      const isValid = await service.validateCacheDirectory('/cache/path');

      expect(isValid).toBe(false);
    });
  });

  describe('Cache Metadata Updates', () => {
    it('should update cache metadata', async () => {
      const existingCache = {
        version: CACHE_FORMAT_VERSION,
        cache_created: '2023-01-01T00:00:00.000Z',
        last_updated: '2023-01-01T00:00:00.000Z',
        project_path: mockProjectPath,
        cached_files: {},
        sessions: {},
        total_message_count: 5
      };

      const updates = {
        total_message_count: 10,
        total_input_tokens: 1000
      };

      // Setup existing cache directory
      service['cacheDirectories'].set(mockProjectPath, {
        projectPath: mockProjectPath,
        cachePath: path.join(mockProjectPath, '.cache'),
        indexPath: path.join(mockProjectPath, '.cache', CACHE_INDEX_FILENAME),
        exists: true,
        isValid: true
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify(existingCache));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await service.updateCacheMetadata(mockProjectPath, updates);

      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockFs.rename).toHaveBeenCalled();
    });

    it('should throw error for non-existent cache', async () => {
      await expect(service.updateCacheMetadata('/non/existent', {}))
        .rejects.toThrow('No cache directory found');
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics', async () => {
      const mockCache = {
        version: CACHE_FORMAT_VERSION,
        cached_files: { 'file1.jsonl': {}, 'file2.jsonl': {} },
        sessions: { 'session1': {}, 'session2': {}, 'session3': {} },
        total_message_count: 100,
        cache_created: '2023-01-01T00:00:00.000Z',
        last_updated: '2023-01-02T00:00:00.000Z'
      };

      service['cacheDirectories'].set(mockProjectPath, {
        projectPath: mockProjectPath,
        cachePath: path.join(mockProjectPath, '.cache'),
        indexPath: path.join(mockProjectPath, '.cache', CACHE_INDEX_FILENAME),
        exists: true,
        isValid: true
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCache));

      const stats = await service.getCacheStats(mockProjectPath);

      expect(stats.cache_enabled).toBe(true);
      expect(stats.cached_files_count).toBe(2);
      expect(stats.total_sessions).toBe(3);
      expect(stats.total_cached_messages).toBe(100);
    });

    it('should return disabled stats for non-existent cache', async () => {
      const stats = await service.getCacheStats('/non/existent');

      expect(stats.cache_enabled).toBe(false);
      expect(stats.cached_files_count).toBeUndefined();
    });
  });

  describe('Cache Consistency Validation', () => {
    it('should validate cache consistency', async () => {
      const mockCache = {
        version: CACHE_FORMAT_VERSION,
        project_path: mockProjectPath,
        cached_files: {
          'file1.jsonl': {
            file_path: 'file1.jsonl',
            source_mtime: 1640995200000 // 2022-01-01
          }
        }
      };

      service['cacheDirectories'].set(mockProjectPath, {
        projectPath: mockProjectPath,
        cachePath: path.join(mockProjectPath, '.cache'),
        indexPath: path.join(mockProjectPath, '.cache', CACHE_INDEX_FILENAME),
        exists: true,
        isValid: true
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCache));
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1640995200000) // Same time
      } as any);

      const result = await service.validateCacheConsistency(mockProjectPath);

      expect(result.is_valid).toBe(true);
      expect(result.version_compatible).toBe(true);
      expect(result.files_to_recache).toEqual([]);
    });

    it('should detect files that need recaching', async () => {
      const mockCache = {
        version: CACHE_FORMAT_VERSION,
        project_path: mockProjectPath,
        cached_files: {
          'file1.jsonl': {
            file_path: 'file1.jsonl',
            source_mtime: 1640995200000 // 2022-01-01
          }
        }
      };

      service['cacheDirectories'].set(mockProjectPath, {
        projectPath: mockProjectPath,
        cachePath: path.join(mockProjectPath, '.cache'),
        indexPath: path.join(mockProjectPath, '.cache', CACHE_INDEX_FILENAME),
        exists: true,
        isValid: true
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCache));
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1641081600000) // Different time
      } as any);

      const result = await service.validateCacheConsistency(mockProjectPath);

      expect(result.is_valid).toBe(false);
      expect(result.files_to_recache).toContain('file1.jsonl');
    });

    it('should handle version incompatibility', async () => {
      const mockCache = {
        version: '0.5.0', // Old version
        cached_files: {}
      };

      service['cacheDirectories'].set(mockProjectPath, {
        projectPath: mockProjectPath,
        cachePath: path.join(mockProjectPath, '.cache'),
        indexPath: path.join(mockProjectPath, '.cache', CACHE_INDEX_FILENAME),
        exists: true,
        isValid: true
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCache));

      const result = await service.validateCacheConsistency(mockProjectPath);

      expect(result.version_compatible).toBe(false);
      expect(result.is_valid).toBe(false);
    });
  });

  describe('Cache Removal', () => {
    it('should remove cache directory', async () => {
      service['cacheDirectories'].set(mockProjectPath, {
        projectPath: mockProjectPath,
        cachePath: path.join(mockProjectPath, '.cache'),
        indexPath: path.join(mockProjectPath, '.cache', CACHE_INDEX_FILENAME),
        exists: true,
        isValid: true
      });

      mockFs.rm.mockResolvedValue(undefined);

      await service.removeCacheDirectory(mockProjectPath);

      expect(mockFs.rm).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.cache'),
        { recursive: true, force: true }
      );
      expect(service.hasCacheDirectory(mockProjectPath)).toBe(false);
    });

    it('should emit deletion event', async () => {
      const eventSpy = vi.fn();
      service.on('directoryEvent', eventSpy);

      service['cacheDirectories'].set(mockProjectPath, {
        projectPath: mockProjectPath,
        cachePath: path.join(mockProjectPath, '.cache'),
        indexPath: path.join(mockProjectPath, '.cache', CACHE_INDEX_FILENAME),
        exists: true,
        isValid: true
      });

      mockFs.rm.mockResolvedValue(undefined);

      await service.removeCacheDirectory(mockProjectPath);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'deleted',
          projectPath: mockProjectPath
        })
      );
    });
  });

  describe('Atomic Write Operations', () => {
    it('should perform atomic writes', async () => {
      const testData = { test: 'data' };
      const filePath = '/test/file.json';
      const tempPath = `${filePath}.tmp`;

      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      // Access private method for testing
      await (service as any).atomicWriteJson(filePath, testData);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        tempPath,
        JSON.stringify(testData, null, 2),
        'utf-8'
      );
      expect(mockFs.rename).toHaveBeenCalledWith(tempPath, filePath);
    });

    it('should cleanup temp file on error', async () => {
      const testData = { test: 'data' };
      const filePath = '/test/file.json';
      const tempPath = `${filePath}.tmp`;

      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));
      mockFs.unlink.mockResolvedValue(undefined);

      await expect((service as any).atomicWriteJson(filePath, testData))
        .rejects.toThrow('Write failed');

      expect(mockFs.unlink).toHaveBeenCalledWith(tempPath);
    });
  });

  describe('Service Management', () => {
    it('should initialize service with search paths', async () => {
      const searchPaths = ['/path1', '/path2'];

      mockFs.readdir.mockResolvedValue([]);

      await service.initialize(searchPaths);

      expect(mockFs.readdir).toHaveBeenCalledTimes(searchPaths.length);
    });

    it('should get all cache directories', () => {
      const mockCacheInfo = {
        projectPath: mockProjectPath,
        cachePath: path.join(mockProjectPath, '.cache'),
        indexPath: path.join(mockProjectPath, '.cache', CACHE_INDEX_FILENAME),
        exists: true,
        isValid: true
      };

      service['cacheDirectories'].set(mockProjectPath, mockCacheInfo);

      const directories = service.getAllCacheDirectories();

      expect(directories).toContain(mockCacheInfo);
    });

    it('should check if cache directory exists', () => {
      service['cacheDirectories'].set(mockProjectPath, {
        projectPath: mockProjectPath,
        cachePath: path.join(mockProjectPath, '.cache'),
        indexPath: path.join(mockProjectPath, '.cache', CACHE_INDEX_FILENAME),
        exists: true,
        isValid: true
      });

      expect(service.hasCacheDirectory(mockProjectPath)).toBe(true);
      expect(service.hasCacheDirectory('/non/existent')).toBe(false);
    });
  });
});