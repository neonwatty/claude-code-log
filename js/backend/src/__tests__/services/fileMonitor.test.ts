import { FileMonitor } from '../../services/fileMonitor';
import fs from 'fs';
import chokidar from 'chokidar';

// Mock dependencies
jest.mock('fs');
jest.mock('chokidar');
jest.mock('../../websocket/server');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockChokidar = chokidar as jest.Mocked<typeof chokidar>;

// Mock WebSocket manager
const mockWebSocketManager = {
  broadcastFileChanged: jest.fn(),
  broadcastSessionCreated: jest.fn(),
  broadcastSessionUpdated: jest.fn(),
  broadcastSessionDeleted: jest.fn()
};

jest.mock('../../websocket/server', () => ({
  getWebSocketManager: () => mockWebSocketManager
}));

describe('FileMonitor', () => {
  let fileMonitor: FileMonitor;
  let mockWatcher: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Setup mock watcher
    mockWatcher = {
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined)
    };
    
    mockChokidar.watch = jest.fn().mockReturnValue(mockWatcher);
    mockFs.existsSync.mockReturnValue(true);
    
    fileMonitor = new FileMonitor();
  });

  afterEach(() => {
    fileMonitor.stop();
    jest.useRealTimers();
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with correct default settings', () => {
      expect(fileMonitor.getStatus().isActive).toBe(false);
      expect(fileMonitor.getStatus().watcherCount).toBe(0);
    });

    it('should start monitoring with default paths', () => {
      fileMonitor.start();
      
      expect(fileMonitor.getStatus().isActive).toBe(true);
      expect(mockChokidar.watch).toHaveBeenCalled();
    });

    it('should start monitoring with custom paths', () => {
      const customPaths = ['/custom/path1', '/custom/path2'];
      mockFs.existsSync.mockImplementation(path => customPaths.includes(path.toString()));
      
      fileMonitor.start(customPaths);
      
      expect(mockChokidar.watch).toHaveBeenCalledTimes(2);
      expect(fileMonitor.getStatus().isActive).toBe(true);
    });

    it('should handle non-existent paths gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      expect(() => {
        fileMonitor.start(['/nonexistent/path']);
      }).not.toThrow();
      
      expect(fileMonitor.getStatus().watcherCount).toBe(0);
    });

    it('should prevent multiple start calls', () => {
      fileMonitor.start();
      fileMonitor.start(); // Second call
      
      expect(fileMonitor.getStatus().isActive).toBe(true);
      // Should only create watchers once
    });
  });

  describe('File Change Detection', () => {
    beforeEach(() => {
      fileMonitor.start(['/test/path']);
    });

    it('should detect file creation events', () => {
      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')[1];
      
      addHandler('test.jsonl');
      
      // Fast-forward past debounce delay
      jest.advanceTimersByTime(1500);
      
      expect(mockWebSocketManager.broadcastFileChanged).toHaveBeenCalledWith(
        expect.stringContaining('test.jsonl'),
        'created'
      );
    });

    it('should detect file modification events', () => {
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      changeHandler('test.jsonl');
      
      jest.advanceTimersByTime(1500);
      
      expect(mockWebSocketManager.broadcastFileChanged).toHaveBeenCalledWith(
        expect.stringContaining('test.jsonl'),
        'modified'
      );
    });

    it('should detect file deletion events', () => {
      const unlinkHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'unlink')[1];
      
      unlinkHandler('test.jsonl');
      
      jest.advanceTimersByTime(1500);
      
      expect(mockWebSocketManager.broadcastFileChanged).toHaveBeenCalledWith(
        expect.stringContaining('test.jsonl'),
        'deleted'
      );
    });

    it('should debounce rapid file changes', () => {
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      // Trigger multiple rapid changes
      changeHandler('test.jsonl');
      changeHandler('test.jsonl');
      changeHandler('test.jsonl');
      
      // Fast-forward just before debounce completes
      jest.advanceTimersByTime(500);
      expect(mockWebSocketManager.broadcastFileChanged).not.toHaveBeenCalled();
      
      // Complete debounce delay
      jest.advanceTimersByTime(1000);
      
      // Should only fire once
      expect(mockWebSocketManager.broadcastFileChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('JSONL File Parsing', () => {
    beforeEach(() => {
      fileMonitor.start(['/test/path']);
    });

    it('should parse JSONL content and detect new sessions', () => {
      const testJsonlContent = JSON.stringify({
        sessionId: 'new-session-123',
        timestamp: '2024-01-01T00:00:00Z',
        cwd: '/test/project',
        type: 'user',
        message: { role: 'user', content: 'Hello' }
      });
      
      mockFs.readFileSync.mockReturnValue(testJsonlContent);
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('test.jsonl');
      
      jest.advanceTimersByTime(1500);
      
      expect(mockWebSocketManager.broadcastSessionCreated).toHaveBeenCalledWith(
        'new-session-123',
        '/test/project'
      );
    });

    it('should detect session updates for existing sessions', () => {
      const testJsonlContent = [
        {
          sessionId: 'existing-session-456',
          timestamp: '2024-01-01T00:00:00Z',
          cwd: '/test/project',
          type: 'user',
          message: { role: 'user', content: 'First message' }
        },
        {
          sessionId: 'existing-session-456',
          timestamp: '2024-01-01T00:01:00Z',
          cwd: '/test/project',
          type: 'assistant',
          message: { role: 'assistant', content: 'Response' }
        }
      ].map(entry => JSON.stringify(entry)).join('\n');
      
      mockFs.readFileSync.mockReturnValue(testJsonlContent);
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('test.jsonl');
      
      jest.advanceTimersByTime(1500);
      
      expect(mockWebSocketManager.broadcastSessionUpdated).toHaveBeenCalledWith(
        'existing-session-456',
        '/test/project',
        2
      );
    });

    it('should handle corrupted JSONL lines gracefully', () => {
      const testJsonlContent = [
        '{"valid": "json", "sessionId": "test-123", "cwd": "/test"}',
        'invalid-json-line',
        '{"another": "valid", "sessionId": "test-456", "cwd": "/test"}'
      ].join('\n');
      
      mockFs.readFileSync.mockReturnValue(testJsonlContent);
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('test.jsonl');
      
      jest.advanceTimersByTime(1500);
      
      // Should still process valid lines
      expect(mockWebSocketManager.broadcastSessionCreated).toHaveBeenCalledTimes(2);
    });

    it('should handle empty JSONL files', () => {
      mockFs.readFileSync.mockReturnValue('');
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('test.jsonl');
      
      jest.advanceTimersByTime(1500);
      
      expect(mockWebSocketManager.broadcastSessionCreated).not.toHaveBeenCalled();
      expect(mockWebSocketManager.broadcastSessionUpdated).not.toHaveBeenCalled();
    });

    it('should handle file read errors', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      expect(() => {
        changeHandler('test.jsonl');
        jest.advanceTimersByTime(1500);
      }).not.toThrow();
    });
  });

  describe('File State Tracking', () => {
    beforeEach(() => {
      fileMonitor.start(['/test/path']);
    });

    it('should track file modifications to prevent duplicate events', () => {
      const testStats = {
        size: 1024,
        mtime: new Date('2024-01-01T00:00:00Z')
      };
      
      mockFs.statSync.mockReturnValue(testStats as any);
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      // First change
      changeHandler('test.jsonl');
      jest.advanceTimersByTime(1500);
      
      // Same file state - should not trigger again
      changeHandler('test.jsonl');
      jest.advanceTimersByTime(1500);
      
      expect(mockWebSocketManager.broadcastFileChanged).toHaveBeenCalledTimes(1);
    });

    it('should detect actual file changes when stats differ', () => {
      mockFs.statSync
        .mockReturnValueOnce({ size: 1024, mtime: new Date('2024-01-01T00:00:00Z') } as any)
        .mockReturnValueOnce({ size: 2048, mtime: new Date('2024-01-01T00:01:00Z') } as any);
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      // First change
      changeHandler('test.jsonl');
      jest.advanceTimersByTime(1500);
      
      // File actually changed
      changeHandler('test.jsonl');
      jest.advanceTimersByTime(1500);
      
      expect(mockWebSocketManager.broadcastFileChanged).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle watcher errors gracefully', () => {
      fileMonitor.start(['/test/path']);
      
      const errorHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'error')[1];
      
      expect(() => {
        errorHandler(new Error('Watcher error'));
      }).not.toThrow();
    });

    it('should handle chokidar initialization errors', () => {
      mockChokidar.watch.mockImplementation(() => {
        throw new Error('Chokidar initialization failed');
      });
      
      expect(() => {
        fileMonitor.start(['/test/path']);
      }).not.toThrow();
      
      expect(fileMonitor.getStatus().watcherCount).toBe(0);
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should stop monitoring and clean up watchers', async () => {
      fileMonitor.start(['/test/path']);
      
      expect(fileMonitor.getStatus().isActive).toBe(true);
      
      fileMonitor.stop();
      
      expect(fileMonitor.getStatus().isActive).toBe(false);
      expect(fileMonitor.getStatus().watcherCount).toBe(0);
      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('should clear all debounce timers on stop', () => {
      fileMonitor.start(['/test/path']);
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('test.jsonl');
      
      // Stop before debounce completes
      fileMonitor.stop();
      
      jest.advanceTimersByTime(2000);
      
      // Should not fire after stop
      expect(mockWebSocketManager.broadcastFileChanged).not.toHaveBeenCalled();
    });

    it('should handle stop when not started', () => {
      expect(() => {
        fileMonitor.stop();
      }).not.toThrow();
    });

    it('should handle watcher close errors', async () => {
      mockWatcher.close.mockRejectedValue(new Error('Close failed'));
      
      fileMonitor.start(['/test/path']);
      
      expect(() => {
        fileMonitor.stop();
      }).not.toThrow();
    });
  });

  describe('Status Reporting', () => {
    it('should report correct status when inactive', () => {
      const status = fileMonitor.getStatus();
      
      expect(status.isActive).toBe(false);
      expect(status.watcherCount).toBe(0);
      expect(status.monitoredFiles).toBe(0);
    });

    it('should report correct status when active', () => {
      fileMonitor.start(['/test/path1', '/test/path2']);
      
      const status = fileMonitor.getStatus();
      
      expect(status.isActive).toBe(true);
      expect(status.watcherCount).toBe(2);
    });

    it('should track monitored files count', () => {
      fileMonitor.start(['/test/path']);
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      mockFs.statSync.mockReturnValue({ size: 1024, mtime: new Date() } as any);
      
      changeHandler('file1.jsonl');
      changeHandler('file2.jsonl');
      jest.advanceTimersByTime(1500);
      
      const status = fileMonitor.getStatus();
      expect(status.monitoredFiles).toBe(2);
    });
  });

  describe('Event Emission', () => {
    it('should emit fileChanged events', (done) => {
      fileMonitor.on('fileChanged', (event) => {
        expect(event.type).toBe('modified');
        expect(event.filePath).toContain('test.jsonl');
        expect(event.timestamp).toBeDefined();
        done();
      });
      
      fileMonitor.start(['/test/path']);
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('test.jsonl');
      
      jest.advanceTimersByTime(1500);
    });

    it('should emit sessionChanged events', (done) => {
      const testJsonlContent = JSON.stringify({
        sessionId: 'test-session-789',
        timestamp: '2024-01-01T00:00:00Z',
        cwd: '/test/project',
        type: 'user'
      });
      
      mockFs.readFileSync.mockReturnValue(testJsonlContent);
      
      fileMonitor.on('sessionChanged', (event) => {
        expect(event.type).toBe('session_created');
        expect(event.sessionId).toBe('test-session-789');
        expect(event.cwd).toBe('/test/project');
        done();
      });
      
      fileMonitor.start(['/test/path']);
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('test.jsonl');
      
      jest.advanceTimersByTime(1500);
    });
  });
});