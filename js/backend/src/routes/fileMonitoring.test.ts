import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fileMonitoringRoutes from './fileMonitoring';
import FileSystemMonitor from '../services/fileSystemMonitor';

// Mock FileSystemMonitor
const mockFileSystemMonitor = {
  getStatus: vi.fn(),
  rescan: vi.fn(),
  addWatchPath: vi.fn(),
  removeWatchPath: vi.fn(),
};

describe('File Monitoring Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create Express app with routes
    app = express();
    app.use(express.json());
    
    // Mock the FileSystemMonitor in app.locals
    app.locals.fileSystemMonitor = mockFileSystemMonitor;
    
    app.use('/api/file-monitoring', fileMonitoringRoutes);
  });

  describe('GET /status', () => {
    it('should return status when monitor is enabled', async () => {
      const mockStatus = {
        isRunning: true,
        watchPaths: ['/test/path1', '/test/path2'],
        watchedFiles: 5,
        activeWatchers: 2,
      };

      mockFileSystemMonitor.getStatus.mockReturnValue(mockStatus);

      const response = await request(app)
        .get('/api/file-monitoring/status')
        .expect(200);

      expect(response.body).toEqual({
        enabled: true,
        status: mockStatus,
      });

      expect(mockFileSystemMonitor.getStatus).toHaveBeenCalledOnce();
    });

    it('should return disabled status when monitor is not available', async () => {
      // Remove monitor from app.locals
      app.locals.fileSystemMonitor = null;

      const response = await request(app)
        .get('/api/file-monitoring/status')
        .expect(200);

      expect(response.body).toEqual({
        enabled: false,
        message: 'File system monitoring is not enabled',
      });

      expect(mockFileSystemMonitor.getStatus).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockFileSystemMonitor.getStatus.mockImplementation(() => {
        throw new Error('Status error');
      });

      const response = await request(app)
        .get('/api/file-monitoring/status')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Failed to get file monitoring status',
        message: 'Status error',
      });
    });
  });

  describe('POST /rescan', () => {
    it('should trigger rescan when monitor is available', async () => {
      mockFileSystemMonitor.rescan.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/file-monitoring/rescan')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Rescan completed successfully',
      });

      expect(mockFileSystemMonitor.rescan).toHaveBeenCalledOnce();
    });

    it('should return error when monitor is not available', async () => {
      app.locals.fileSystemMonitor = null;

      const response = await request(app)
        .post('/api/file-monitoring/rescan')
        .expect(400);

      expect(response.body).toEqual({
        error: 'File system monitoring is not enabled',
      });

      expect(mockFileSystemMonitor.rescan).not.toHaveBeenCalled();
    });

    it('should handle rescan errors', async () => {
      mockFileSystemMonitor.rescan.mockRejectedValue(new Error('Rescan failed'));

      const response = await request(app)
        .post('/api/file-monitoring/rescan')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Failed to rescan directories',
        message: 'Rescan failed',
      });
    });
  });

  describe('POST /watch-path', () => {
    it('should add new watch path successfully', async () => {
      const newPath = '/test/new/path';
      const mockStatus = {
        isRunning: true,
        watchPaths: ['/test/path1', newPath],
        watchedFiles: 6,
        activeWatchers: 2,
      };

      mockFileSystemMonitor.addWatchPath.mockResolvedValue(undefined);
      mockFileSystemMonitor.getStatus.mockReturnValue(mockStatus);

      const response = await request(app)
        .post('/api/file-monitoring/watch-path')
        .send({ path: newPath })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: `Added watch path: ${newPath}`,
        status: mockStatus,
      });

      expect(mockFileSystemMonitor.addWatchPath).toHaveBeenCalledWith(newPath);
      expect(mockFileSystemMonitor.getStatus).toHaveBeenCalledOnce();
    });

    it('should validate path parameter', async () => {
      const response = await request(app)
        .post('/api/file-monitoring/watch-path')
        .send({}) // No path provided
        .expect(400);

      expect(response.body).toEqual({
        error: 'Path is required and must be a string',
      });

      expect(mockFileSystemMonitor.addWatchPath).not.toHaveBeenCalled();
    });

    it('should validate path is string', async () => {
      const response = await request(app)
        .post('/api/file-monitoring/watch-path')
        .send({ path: 123 }) // Invalid path type
        .expect(400);

      expect(response.body).toEqual({
        error: 'Path is required and must be a string',
      });

      expect(mockFileSystemMonitor.addWatchPath).not.toHaveBeenCalled();
    });

    it('should handle monitor not available', async () => {
      app.locals.fileSystemMonitor = null;

      const response = await request(app)
        .post('/api/file-monitoring/watch-path')
        .send({ path: '/test/path' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'File system monitoring is not enabled',
      });
    });

    it('should handle add path errors', async () => {
      mockFileSystemMonitor.addWatchPath.mockRejectedValue(new Error('Permission denied'));

      const response = await request(app)
        .post('/api/file-monitoring/watch-path')
        .send({ path: '/restricted/path' })
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Failed to add watch path',
        message: 'Permission denied',
      });
    });
  });

  describe('DELETE /watch-path', () => {
    it('should remove watch path successfully', async () => {
      const pathToRemove = '/test/remove/path';
      const mockStatus = {
        isRunning: true,
        watchPaths: ['/test/path1'],
        watchedFiles: 3,
        activeWatchers: 1,
      };

      mockFileSystemMonitor.removeWatchPath.mockReturnValue(undefined);
      mockFileSystemMonitor.getStatus.mockReturnValue(mockStatus);

      const response = await request(app)
        .delete('/api/file-monitoring/watch-path')
        .send({ path: pathToRemove })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: `Removed watch path: ${pathToRemove}`,
        status: mockStatus,
      });

      expect(mockFileSystemMonitor.removeWatchPath).toHaveBeenCalledWith(pathToRemove);
      expect(mockFileSystemMonitor.getStatus).toHaveBeenCalledOnce();
    });

    it('should validate path parameter for removal', async () => {
      const response = await request(app)
        .delete('/api/file-monitoring/watch-path')
        .send({}) // No path provided
        .expect(400);

      expect(response.body).toEqual({
        error: 'Path is required and must be a string',
      });

      expect(mockFileSystemMonitor.removeWatchPath).not.toHaveBeenCalled();
    });

    it('should handle monitor not available for removal', async () => {
      app.locals.fileSystemMonitor = null;

      const response = await request(app)
        .delete('/api/file-monitoring/watch-path')
        .send({ path: '/test/path' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'File system monitoring is not enabled',
      });
    });

    it('should handle remove path errors', async () => {
      mockFileSystemMonitor.removeWatchPath.mockImplementation(() => {
        throw new Error('Path not found');
      });

      const response = await request(app)
        .delete('/api/file-monitoring/watch-path')
        .send({ path: '/nonexistent/path' })
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Failed to remove watch path',
        message: 'Path not found',
      });
    });
  });

  describe('Request validation', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/file-monitoring/watch-path')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // Express should handle JSON parsing errors
    });

    it('should handle missing Content-Type', async () => {
      const response = await request(app)
        .post('/api/file-monitoring/watch-path')
        .send('path=/test/path')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Path is required and must be a string',
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle monitor starting and stopping', async () => {
      // Initially stopped
      mockFileSystemMonitor.getStatus.mockReturnValue({
        isRunning: false,
        watchPaths: ['/test/path'],
        watchedFiles: 0,
        activeWatchers: 0,
      });

      let response = await request(app)
        .get('/api/file-monitoring/status')
        .expect(200);

      expect(response.body.status.isRunning).toBe(false);

      // Simulate starting
      mockFileSystemMonitor.getStatus.mockReturnValue({
        isRunning: true,
        watchPaths: ['/test/path'],
        watchedFiles: 2,
        activeWatchers: 1,
      });

      response = await request(app)
        .get('/api/file-monitoring/status')
        .expect(200);

      expect(response.body.status.isRunning).toBe(true);
    });

    it('should handle concurrent path operations', async () => {
      const paths = ['/path1', '/path2', '/path3'];
      
      mockFileSystemMonitor.addWatchPath.mockResolvedValue(undefined);
      mockFileSystemMonitor.getStatus.mockReturnValue({
        isRunning: true,
        watchPaths: paths,
        watchedFiles: 5,
        activeWatchers: 3,
      });

      // Add multiple paths
      const addPromises = paths.map(path =>
        request(app)
          .post('/api/file-monitoring/watch-path')
          .send({ path })
      );

      const responses = await Promise.all(addPromises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(mockFileSystemMonitor.addWatchPath).toHaveBeenCalledTimes(3);
    });
  });
});