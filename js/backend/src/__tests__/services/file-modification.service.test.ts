import { FileModificationService } from '../../services/file-modification.service';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFsSync = fsSync as jest.Mocked<typeof fsSync>;

describe('FileModificationService', () => {
  let service: FileModificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = FileModificationService.getInstance();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = FileModificationService.getInstance();
      const instance2 = FileModificationService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('File Tracking', () => {
    it('should track a single file', async () => {
      const filePath = '/test/file.jsonl';
      const mockStats = {
        size: 1024,
        mtime: new Date('2023-01-01T10:00:00Z')
      };

      mockFs.stat = jest.fn().mockResolvedValue(mockStats);

      const result = await service.trackFile(filePath);

      expect(result.filePath).toBe(path.resolve(filePath));
      expect(result.size).toBe(1024);
      expect(result.mtime).toBe(mockStats.mtime.getTime());
      expect(result.exists).toBe(true);
    });

    it('should handle non-existent files', async () => {
      const filePath = '/test/missing.jsonl';

      mockFs.stat = jest.fn().mockRejectedValue(new Error('File not found'));

      const result = await service.trackFile(filePath);

      expect(result.exists).toBe(false);
      expect(result.size).toBe(0);
      expect(result.mtime).toBe(0);
    });

    it('should emit file_deleted event for missing files', async () => {
      const filePath = '/test/missing.jsonl';
      const eventSpy = jest.fn();

      service.on('fileModificationEvent', eventSpy);
      mockFs.stat = jest.fn().mockRejectedValue(new Error('File not found'));

      await service.trackFile(filePath);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'file_deleted',
          filePath: path.resolve(filePath)
        })
      );
    });
  });

  describe('Directory Tracking', () => {
    it('should track files in a directory', async () => {
      const dirPath = '/test/dir';
      const mockEntries = [
        { name: 'file1.jsonl', isFile: () => true, isDirectory: () => false },
        { name: 'file2.jsonl', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true }
      ];
      const mockStats = {
        size: 512,
        mtime: new Date('2023-01-01T10:00:00Z')
      };

      mockFs.readdir = jest.fn().mockResolvedValue(mockEntries as any);
      mockFs.stat = jest.fn().mockResolvedValue(mockStats);

      const options = { recursive: false, pattern: /\.jsonl$/ };
      const files = await service.trackDirectory(dirPath, options);

      expect(files).toHaveLength(2);
      expect(files).toContain(path.join(dirPath, 'file1.jsonl'));
      expect(files).toContain(path.join(dirPath, 'file2.jsonl'));
    });

    it('should respect ignore patterns', async () => {
      const dirPath = '/test/dir';
      const mockEntries = [
        { name: 'file1.jsonl', isFile: () => true, isDirectory: () => false },
        { name: 'temp.jsonl', isFile: () => true, isDirectory: () => false },
        { name: 'backup.jsonl', isFile: () => true, isDirectory: () => false }
      ];
      const mockStats = {
        size: 512,
        mtime: new Date('2023-01-01T10:00:00Z')
      };

      mockFs.readdir = jest.fn().mockResolvedValue(mockEntries as any);
      mockFs.stat = jest.fn().mockResolvedValue(mockStats);

      const options = {
        recursive: false,
        pattern: /\.jsonl$/,
        ignorePatterns: [/temp/, /backup/]
      };
      const files = await service.trackDirectory(dirPath, options);

      expect(files).toHaveLength(1);
      expect(files).toContain(path.join(dirPath, 'file1.jsonl'));
    });

    it('should handle recursive directory traversal', async () => {
      const dirPath = '/test/dir';
      const rootEntries = [
        { name: 'file1.jsonl', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true }
      ];
      const subEntries = [
        { name: 'file2.jsonl', isFile: () => true, isDirectory: () => false }
      ];
      const mockStats = {
        size: 512,
        mtime: new Date('2023-01-01T10:00:00Z')
      };

      mockFs.readdir = jest.fn()
        .mockResolvedValueOnce(rootEntries as any)
        .mockResolvedValueOnce(subEntries as any);
      mockFs.stat = jest.fn().mockResolvedValue(mockStats);

      const options = { recursive: true, pattern: /\.jsonl$/ };
      const files = await service.trackDirectory(dirPath, options);

      expect(files).toHaveLength(2);
      expect(files).toContain(path.join(dirPath, 'file1.jsonl'));
      expect(files).toContain(path.join(dirPath, 'subdir', 'file2.jsonl'));
    });
  });

  describe('File Modification Detection', () => {
    it('should detect when file is modified', async () => {
      const filePath = '/test/file.jsonl';
      const oldStats = {
        size: 1024,
        mtime: new Date('2023-01-01T10:00:00Z')
      };
      const newStats = {
        size: 2048,
        mtime: new Date('2023-01-01T11:00:00Z')
      };

      // First call - track the file
      mockFs.stat = jest.fn().mockResolvedValueOnce(oldStats);
      await service.trackFile(filePath);

      // Second call - file has changed
      mockFs.stat = jest.fn().mockResolvedValueOnce(newStats);
      const result = await service.checkFileModification(filePath);

      expect(result.hasChanged).toBe(true);
      expect(result.changeType).toBe('modified');
      expect(result.currentStats?.size).toBe(2048);
    });

    it('should detect when file is created', async () => {
      const filePath = '/test/newfile.jsonl';
      const newStats = {
        size: 1024,
        mtime: new Date('2023-01-01T10:00:00Z')
      };

      mockFs.stat = jest.fn().mockResolvedValue(newStats);

      const result = await service.checkFileModification(filePath);

      expect(result.hasChanged).toBe(true);
      expect(result.changeType).toBe('created');
    });

    it('should detect when file is deleted', async () => {
      const filePath = '/test/file.jsonl';
      const oldStats = {
        size: 1024,
        mtime: new Date('2023-01-01T10:00:00Z')
      };

      // First call - track the file
      mockFs.stat = jest.fn().mockResolvedValueOnce(oldStats);
      await service.trackFile(filePath);

      // Second call - file no longer exists
      mockFs.stat = jest.fn().mockRejectedValueOnce(new Error('File not found'));
      const result = await service.checkFileModification(filePath);

      expect(result.hasChanged).toBe(true);
      expect(result.changeType).toBe('deleted');
    });

    it('should return unchanged for identical files', async () => {
      const filePath = '/test/file.jsonl';
      const stats = {
        size: 1024,
        mtime: new Date('2023-01-01T10:00:00Z')
      };

      // Track the file twice with same stats
      mockFs.stat = jest.fn().mockResolvedValue(stats);
      await service.trackFile(filePath);

      const result = await service.checkFileModification(filePath);

      expect(result.hasChanged).toBe(false);
      expect(result.changeType).toBe('unchanged');
    });

    it('should emit file modification events', async () => {
      const filePath = '/test/file.jsonl';
      const eventSpy = jest.fn();
      const oldStats = {
        size: 1024,
        mtime: new Date('2023-01-01T10:00:00Z')
      };
      const newStats = {
        size: 2048,
        mtime: new Date('2023-01-01T11:00:00Z')
      };

      service.on('fileModificationEvent', eventSpy);

      // Track the file
      mockFs.stat = jest.fn().mockResolvedValueOnce(oldStats);
      await service.trackFile(filePath);

      // Modify the file
      mockFs.stat = jest.fn().mockResolvedValueOnce(newStats);
      await service.checkFileModification(filePath);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'file_changed',
          filePath: path.resolve(filePath)
        })
      );
    });
  });

  describe('Batch File Checking', () => {
    it('should check multiple files in batch', async () => {
      const filePaths = ['/test/file1.jsonl', '/test/file2.jsonl', '/test/file3.jsonl'];
      const stats1 = { size: 1024, mtime: new Date('2023-01-01T10:00:00Z') };
      const stats2 = { size: 2048, mtime: new Date('2023-01-01T11:00:00Z') };
      const stats3 = { size: 512, mtime: new Date('2023-01-01T12:00:00Z') };

      // Track files first
      mockFs.stat = jest.fn()
        .mockResolvedValueOnce(stats1)
        .mockResolvedValueOnce(stats2)
        .mockResolvedValueOnce(stats3);

      for (const filePath of filePaths) {
        await service.trackFile(filePath);
      }

      // Modify file2
      const newStats2 = { size: 4096, mtime: new Date('2023-01-01T13:00:00Z') };
      mockFs.stat = jest.fn()
        .mockResolvedValueOnce(stats1) // file1 unchanged
        .mockResolvedValueOnce(newStats2) // file2 changed
        .mockResolvedValueOnce(stats3); // file3 unchanged

      const result = await service.batchCheckFiles(filePaths);

      expect(result.totalChecked).toBe(3);
      expect(result.changedFiles).toHaveLength(1);
      expect(result.unchangedFiles).toHaveLength(2);
      expect(result.changedFiles[0]).toBe(filePaths[1]);
    });

    it('should handle batch check with Promise.allSettled', async () => {
      const filePaths = ['/test/file1.jsonl', '/test/error.jsonl'];
      const stats1 = { size: 1024, mtime: new Date('2023-01-01T10:00:00Z') };

      // Track files first
      mockFs.stat = jest.fn()
        .mockResolvedValueOnce(stats1)
        .mockRejectedValueOnce(new Error('Permission denied'));

      await service.trackFile(filePaths[0]);

      // Batch check with one error
      mockFs.stat = jest.fn()
        .mockResolvedValueOnce(stats1)
        .mockRejectedValueOnce(new Error('Permission denied'));

      const result = await service.batchCheckFiles(filePaths);

      expect(result.totalChecked).toBe(2);
      expect(result.unchangedFiles).toContain(filePaths[0]);
    });

    it('should emit batch_complete event', async () => {
      const filePaths = ['/test/file1.jsonl'];
      const eventSpy = jest.fn();
      const stats = { size: 1024, mtime: new Date('2023-01-01T10:00:00Z') };

      service.on('fileModificationEvent', eventSpy);

      mockFs.stat = jest.fn().mockResolvedValue(stats);
      await service.trackFile(filePaths[0]);

      const result = await service.batchCheckFiles(filePaths);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'batch_complete',
          batchResult: result
        })
      );
    });
  });

  describe('Synchronous Batch Checking', () => {
    it('should perform synchronous batch check', () => {
      const filePaths = ['/test/file1.jsonl', '/test/file2.jsonl'];
      const stats1 = { size: 1024, mtime: { getTime: () => 1640995200000 } };
      const stats2 = { size: 2048, mtime: { getTime: () => 1640995300000 } };

      // Mock sync stats
      (mockFsSync.statSync as jest.Mock) = jest.fn()
        .mockReturnValueOnce(stats1 as any)
        .mockReturnValueOnce(stats2 as any);

      const result = service.batchCheckFilesSync(filePaths);

      expect(result.totalChecked).toBe(2);
      expect(result.newFiles).toHaveLength(2);
      expect(result.checkDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle sync errors gracefully', () => {
      const filePaths = ['/test/file1.jsonl', '/test/error.jsonl'];
      const stats1 = { size: 1024, mtime: { getTime: () => 1640995200000 } };

      (mockFsSync.statSync as jest.Mock) = jest.fn()
        .mockReturnValueOnce(stats1 as any)
        .mockImplementationOnce(() => {
          throw new Error('Permission denied');
        });

      const result = service.batchCheckFilesSync(filePaths);

      expect(result.totalChecked).toBe(2);
      expect(result.newFiles).toHaveLength(1);
    });
  });

  describe('Cache Invalidation Support', () => {
    it('should determine if cache invalidation is needed', () => {
      const filePath = '/test/file.jsonl';
      const currentMtime = 1640995200000;
      const cachedMtime = 1640995100000; // Earlier

      service['fileStats'].set(path.resolve(filePath), {
        filePath: path.resolve(filePath),
        size: 1024,
        mtime: currentMtime,
        exists: true,
        lastChecked: Date.now()
      });

      const needsInvalidation = service.needsCacheInvalidation(filePath, cachedMtime);

      expect(needsInvalidation).toBe(true);
    });

    it('should return true for non-existent files', () => {
      const filePath = '/test/missing.jsonl';
      const cachedMtime = 1640995200000;

      const needsInvalidation = service.needsCacheInvalidation(filePath, cachedMtime);

      expect(needsInvalidation).toBe(true);
    });

    it('should return false when mtimes match', () => {
      const filePath = '/test/file.jsonl';
      const mtime = 1640995200000;

      service['fileStats'].set(path.resolve(filePath), {
        filePath: path.resolve(filePath),
        size: 1024,
        mtime,
        exists: true,
        lastChecked: Date.now()
      });

      const needsInvalidation = service.needsCacheInvalidation(filePath, mtime);

      expect(needsInvalidation).toBe(false);
    });

    it('should get file modification time', () => {
      const filePath = '/test/file.jsonl';
      const mtime = 1640995200000;

      service['fileStats'].set(path.resolve(filePath), {
        filePath: path.resolve(filePath),
        size: 1024,
        mtime,
        exists: true,
        lastChecked: Date.now()
      });

      const retrievedMtime = service.getFileModificationTime(filePath);

      expect(retrievedMtime).toBe(mtime);
    });

    it('should return null for non-tracked files', () => {
      const filePath = '/test/unknown.jsonl';

      const retrievedMtime = service.getFileModificationTime(filePath);

      expect(retrievedMtime).toBeNull();
    });
  });

  describe('Tracking Management', () => {
    it('should untrack files', () => {
      const filePath = '/test/file.jsonl';

      service['fileStats'].set(path.resolve(filePath), {
        filePath: path.resolve(filePath),
        size: 1024,
        mtime: 1640995200000,
        exists: true,
        lastChecked: Date.now()
      });

      const removed = service.untrackFile(filePath);

      expect(removed).toBe(true);
      expect(service.getTrackedFiles()).not.toContain(path.resolve(filePath));
    });

    it('should untrack directories', () => {
      const dirPath = '/test/dir';
      const filePath1 = path.join(dirPath, 'file1.jsonl');
      const filePath2 = path.join(dirPath, 'file2.jsonl');

      service['trackedDirectories'].set(path.resolve(dirPath), { recursive: true });
      service['fileStats'].set(path.resolve(filePath1), {
        filePath: path.resolve(filePath1),
        size: 1024,
        mtime: 1640995200000,
        exists: true,
        lastChecked: Date.now()
      });
      service['fileStats'].set(path.resolve(filePath2), {
        filePath: path.resolve(filePath2),
        size: 512,
        mtime: 1640995300000,
        exists: true,
        lastChecked: Date.now()
      });

      const removed = service.untrackDirectory(dirPath);

      expect(removed).toBe(true);
      expect(service.getTrackedDirectories()).not.toContain(path.resolve(dirPath));
      expect(service.getTrackedFiles()).not.toContain(path.resolve(filePath1));
      expect(service.getTrackedFiles()).not.toContain(path.resolve(filePath2));
    });

    it('should get tracking statistics', () => {
      const filePath = '/test/file.jsonl';
      const dirPath = '/test/dir';

      service['fileStats'].set(path.resolve(filePath), {
        filePath: path.resolve(filePath),
        size: 1024,
        mtime: 1640995200000,
        exists: true,
        lastChecked: Date.now()
      });
      service['trackedDirectories'].set(path.resolve(dirPath), { recursive: true });

      const stats = service.getTrackingStats();

      expect(stats.trackedFiles).toBe(1);
      expect(stats.trackedDirectories).toBe(1);
    });

    it('should clear all tracking data', () => {
      const filePath = '/test/file.jsonl';
      const dirPath = '/test/dir';

      service['fileStats'].set(path.resolve(filePath), {
        filePath: path.resolve(filePath),
        size: 1024,
        mtime: 1640995200000,
        exists: true,
        lastChecked: Date.now()
      });
      service['trackedDirectories'].set(path.resolve(dirPath), { recursive: true });

      service.clearAllTracking();

      const stats = service.getTrackingStats();
      expect(stats.trackedFiles).toBe(0);
      expect(stats.trackedDirectories).toBe(0);
    });
  });
});