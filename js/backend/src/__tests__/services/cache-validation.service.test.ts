import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheValidationService } from '../../services/cache-validation.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CACHE_FORMAT_VERSION, CACHE_INDEX_FILENAME } from '../../utils/cache';

// Mock dependencies
vi.mock('fs/promises');

const mockFs = vi.mocked(fs);

describe('CacheValidationService', () => {
  let service: CacheValidationService;
  let mockProjectPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    service = CacheValidationService.getInstance();
    mockProjectPath = '/test/project';
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CacheValidationService.getInstance();
      const instance2 = CacheValidationService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Cache Validation', () => {
    const createValidCache = () => ({
      version: CACHE_FORMAT_VERSION,
      cache_created: '2023-01-01T00:00:00.000Z',
      last_updated: '2023-01-02T00:00:00.000Z',
      project_path: mockProjectPath,
      cached_files: {
        'file1.jsonl': {
          file_path: 'file1.jsonl',
          source_mtime: 1640995200000,
          cached_mtime: 1640995300000,
          message_count: 10,
          session_ids: ['session1']
        }
      },
      total_message_count: 10,
      total_input_tokens: 100,
      total_output_tokens: 200,
      total_cache_creation_tokens: 50,
      total_cache_read_tokens: 25,
      sessions: {
        session1: {
          session_id: 'session1',
          first_timestamp: '2023-01-01T00:00:00.000Z',
          last_timestamp: '2023-01-01T01:00:00.000Z',
          message_count: 10,
          first_user_message: 'Hello',
          total_input_tokens: 100,
          total_output_tokens: 200,
          total_cache_creation_tokens: 50,
          total_cache_read_tokens: 25
        }
      },
      working_directories: [mockProjectPath],
      earliest_timestamp: '2023-01-01T00:00:00.000Z',
      latest_timestamp: '2023-01-01T01:00:00.000Z'
    });

    it('should validate a valid cache', async () => {
      const validCache = createValidCache();
      const indexPath = path.join(mockProjectPath, '.cache', CACHE_INDEX_FILENAME);

      mockFs.readFile.mockResolvedValue(JSON.stringify(validCache));
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1640995200000) // Same as cached
      } as any);

      const result = await service.validateCache(mockProjectPath);

      expect(result.is_valid).toBe(true);
      expect(result.version_compatible).toBe(true);
      expect(result.files_to_recache).toEqual([]);
    });

    it('should detect missing cache index', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await service.validateCache(mockProjectPath);

      expect(result.is_valid).toBe(false);
      expect(result.reason).toBe('Cache index file not found');
      expect(result.version_compatible).toBe(false);
    });

    it('should detect invalid JSON', async () => {
      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue('invalid json');

      const result = await service.validateCache(mockProjectPath);

      expect(result.is_valid).toBe(false);
      expect(result.reason).toBe('Failed to parse index file');
    });

    it('should detect missing required fields', async () => {
      const invalidCache = {
        version: CACHE_FORMAT_VERSION,
        // Missing required fields
      };

      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidCache));

      const result = await service.validateCache(mockProjectPath);

      expect(result.is_valid).toBe(false);
      expect(result.reason).toContain('Missing required field');
    });

    it('should detect version incompatibility', async () => {
      const oldCache = {
        ...createValidCache(),
        version: '0.5.0'
      };

      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(JSON.stringify(oldCache));

      const result = await service.validateCache(mockProjectPath, {
        enableVersionMigration: false
      });

      expect(result.is_valid).toBe(false);
      expect(result.version_compatible).toBe(false);
      expect(result.reason).toContain('Version 0.5.0 incompatible');
    });

    it('should detect file modifications', async () => {
      const cache = createValidCache();

      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(JSON.stringify(cache));
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1640995300000) // Different from cached
      } as any);

      const result = await service.validateCache(mockProjectPath);

      expect(result.is_valid).toBe(false);
      expect(result.files_to_recache).toContain('file1.jsonl');
    });

    it('should emit validation events', async () => {
      const cache = createValidCache();
      const eventSpy = vi.fn();

      service.on('validationEvent', eventSpy);

      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(JSON.stringify(cache));
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1640995200000)
      } as any);

      await service.validateCache(mockProjectPath);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'validation_started'
        })
      );
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'validation_completed'
        })
      );
    });
  });

  describe('Structure Validation', () => {
    it('should validate correct structure', () => {
      const validData = {
        version: CACHE_FORMAT_VERSION,
        cache_created: '2023-01-01T00:00:00.000Z',
        last_updated: '2023-01-02T00:00:00.000Z',
        project_path: mockProjectPath,
        cached_files: {},
        sessions: {},
        total_message_count: 0
      };

      const result = (service as any).validateStructure(validData);

      expect(result.isValid).toBe(true);
    });

    it('should reject null or undefined data', () => {
      const result1 = (service as any).validateStructure(null);
      const result2 = (service as any).validateStructure(undefined);

      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        version: CACHE_FORMAT_VERSION,
        // Missing other required fields
      };

      const result = (service as any).validateStructure(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Missing required field');
    });

    it('should reject invalid field types', () => {
      const invalidData = {
        version: CACHE_FORMAT_VERSION,
        cache_created: '2023-01-01T00:00:00.000Z',
        last_updated: '2023-01-02T00:00:00.000Z',
        project_path: 123, // Should be string
        cached_files: {},
        sessions: {},
        total_message_count: 0
      };

      const result = (service as any).validateStructure(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Invalid project_path field type');
    });

    it('should reject array instead of object for cached_files', () => {
      const invalidData = {
        version: CACHE_FORMAT_VERSION,
        cache_created: '2023-01-01T00:00:00.000Z',
        last_updated: '2023-01-02T00:00:00.000Z',
        project_path: mockProjectPath,
        cached_files: [], // Should be object
        sessions: {},
        total_message_count: 0
      };

      const result = (service as any).validateStructure(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Invalid cached_files field type');
    });
  });

  describe('Version Compatibility', () => {
    it('should accept current version', () => {
      const result = (service as any).validateVersion(CACHE_FORMAT_VERSION);

      expect(result.isCompatible).toBe(true);
      expect(result.needsMigration).toBe(false);
    });

    it('should detect supported older versions', () => {
      const result = (service as any).validateVersion('0.9.0');

      expect(result.isCompatible).toBe(false);
      expect(result.needsMigration).toBe(true);
    });

    it('should reject unsupported versions', () => {
      const result = (service as any).validateVersion('0.1.0');

      expect(result.isCompatible).toBe(false);
      expect(result.needsMigration).toBe(false);
    });
  });

  describe('Cache Migration', () => {
    it('should migrate from version 0.9.0', async () => {
      const oldCache = {
        version: '0.9.0',
        cache_created: '2023-01-01T00:00:00.000Z',
        project_path: mockProjectPath,
        cached_files: {},
        sessions: {},
        total_message_count: 10,
        total_input_tokens: 100,
        total_output_tokens: 200
        // Missing some fields that should be added
      };

      const indexPath = path.join(mockProjectPath, '.cache', CACHE_INDEX_FILENAME);

      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(JSON.stringify(oldCache));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1640995200000)
      } as any);

      const result = await service.validateCache(mockProjectPath, {
        enableVersionMigration: true
      });


      expect(result.is_valid).toBe(true);
      expect(result.version_compatible).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockFs.rename).toHaveBeenCalled();
    });

    it('should migrate from version 0.8.0', async () => {
      const oldCache = {
        version: '0.8.0',
        created: '2023-01-01T00:00:00.000Z',
        project_path: mockProjectPath,
        files: {},
        session_data: {
          session1: {
            message_count: 5,
            first_timestamp: '2023-01-01T00:00:00.000Z',
            last_timestamp: '2023-01-01T01:00:00.000Z'
          }
        },
        message_count: 5
      };

      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(JSON.stringify(oldCache));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1640995200000)
      } as any);

      const result = await service.validateCache(mockProjectPath, {
        enableVersionMigration: true
      });

      expect(result.is_valid).toBe(true);
      expect(result.version_compatible).toBe(true);
    });

    it('should handle migration failure', async () => {
      const oldCache = {
        version: '0.9.0',
        project_path: mockProjectPath
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(oldCache));
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const result = await service.validateCache(mockProjectPath, {
        enableVersionMigration: true
      });

      expect(result.is_valid).toBe(false);
      expect(result.reason).toContain('migration failed');
    });

    it('should emit migration event', async () => {
      const oldCache = {
        version: '0.9.0',
        cache_created: '2023-01-01T00:00:00.000Z',
        project_path: mockProjectPath,
        cached_files: {},
        sessions: {},
        total_message_count: 0
      };

      const eventSpy = vi.fn();
      service.on('validationEvent', eventSpy);

      mockFs.readFile.mockResolvedValue(JSON.stringify(oldCache));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1640995200000)
      } as any);

      await service.validateCache(mockProjectPath, {
        enableVersionMigration: true
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'migration_performed'
        })
      );
    });
  });

  describe('Quick Validation', () => {
    it('should perform quick validation', async () => {
      const validCache = {
        version: CACHE_FORMAT_VERSION,
        cache_created: '2023-01-01T00:00:00.000Z',
        last_updated: '2023-01-02T00:00:00.000Z',
        project_path: mockProjectPath,
        cached_files: {},
        sessions: {},
        total_message_count: 0
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(validCache));

      const result = await service.quickValidate(mockProjectPath);

      expect(result).toBe(true);
    });

    it('should return false for missing cache', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await service.quickValidate(mockProjectPath);

      expect(result).toBe(false);
    });

    it('should return false for invalid structure', async () => {
      const invalidCache = { invalid: 'data' };

      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidCache));

      const result = await service.quickValidate(mockProjectPath);

      expect(result).toBe(false);
    });
  });

  describe('Cache Repair', () => {
    it('should repair corrupted cache', async () => {
      const eventSpy = vi.fn();
      service.on('validationEvent', eventSpy);

      mockFs.rm.mockResolvedValue(undefined);

      const result = await service.repairCache(mockProjectPath);

      expect(result).toBe(true);
      expect(mockFs.rm).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.cache'),
        { recursive: true, force: true }
      );
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'fallback_triggered'
        })
      );
    });

    it('should handle repair failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      mockFs.rm.mockRejectedValue(new Error('Permission denied'));

      const result = await service.repairCache(mockProjectPath);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to repair cache for ${mockProjectPath}:`,
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Validation Details', () => {
    it('should provide detailed validation information', async () => {
      const cache = {
        version: CACHE_FORMAT_VERSION,
        last_updated: '2023-01-02T00:00:00.000Z',
        cached_files: { 'file1.jsonl': {}, 'file2.jsonl': {} },
        sessions: { session1: {}, session2: {}, session3: {} }
      };

      // Mock file existence checks
      mockFs.readFile.mockResolvedValue(JSON.stringify(cache));

      const details = await service.getValidationDetails(mockProjectPath);

      expect(details.cacheExists).toBe(true);
      expect(details.indexExists).toBe(true);
      expect(details.version).toBe(CACHE_FORMAT_VERSION);
      expect(details.structureValid).toBe(false); // Missing required fields
      expect(details.fileCount).toBe(2);
      expect(details.sessionCount).toBe(3);
      expect(details.lastUpdated).toBe('2023-01-02T00:00:00.000Z');
    });

    it('should handle non-existent cache gracefully', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const details = await service.getValidationDetails(mockProjectPath);

      expect(details.cacheExists).toBe(false);
      expect(details.indexExists).toBe(false);
      expect(details.structureValid).toBe(false);
      expect(details.fileCount).toBe(0);
      expect(details.sessionCount).toBe(0);
    });
  });

  describe('Checksum Validation', () => {
    it('should validate checksums when enabled', async () => {
      const cache = {
        version: CACHE_FORMAT_VERSION,
        cache_created: '2023-01-01T00:00:00.000Z',
        last_updated: '2023-01-02T00:00:00.000Z',
        project_path: mockProjectPath,
        cached_files: {},
        sessions: {},
        total_message_count: 0
      };

      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(JSON.stringify(cache));
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1640995200000)
      } as any);

      const result = await service.validateCache(mockProjectPath, {
        enableChecksumValidation: true
      });

      expect(result.is_valid).toBe(true);
    });

    it('should detect corruption in strict mode', async () => {
      const cache = {
        version: CACHE_FORMAT_VERSION,
        cache_created: '2023-01-01T00:00:00.000Z',
        last_updated: '2023-01-02T00:00:00.000Z',
        project_path: mockProjectPath,
        cached_files: {},
        sessions: {},
        total_message_count: 0
      };

      // Mock checksum validation to fail
      const originalValidateChecksums = (service as any).validateChecksums;
      (service as any).validateChecksums = vi.fn().mockResolvedValue({
        isValid: false,
        corruptedFields: ['sessions']
      });

      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.readFile.mockResolvedValue(JSON.stringify(cache));
      mockFs.stat.mockResolvedValue({
        mtime: new Date(1640995200000)
      } as any);

      const result = await service.validateCache(mockProjectPath, {
        enableChecksumValidation: true,
        strictValidation: true
      });

      expect(result.is_valid).toBe(false);
      expect(result.reason).toBe('Cache corruption detected');

      // Restore original method
      (service as any).validateChecksums = originalValidateChecksums;
    });
  });
});