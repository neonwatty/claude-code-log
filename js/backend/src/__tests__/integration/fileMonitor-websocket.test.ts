import { WebSocketManager } from '../../websocket/server';
import { FileMonitor } from '../../services/fileMonitor';
import fs from 'fs';
import chokidar from 'chokidar';

// Mock dependencies
jest.mock('fs');
jest.mock('chokidar');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockChokidar = chokidar as jest.Mocked<typeof chokidar>;

describe('FileMonitor + WebSocket Integration', () => {
  let fileMonitor: FileMonitor;
  let wsManager: WebSocketManager;
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

    // Create instances
    fileMonitor = new FileMonitor();
    wsManager = new WebSocketManager();

    // Mock WebSocket manager methods
    wsManager.broadcastFileChanged = jest.fn();
    wsManager.broadcastSessionCreated = jest.fn();
    wsManager.broadcastSessionUpdated = jest.fn();
    wsManager.broadcastSessionDeleted = jest.fn();
  });

  afterEach(() => {
    fileMonitor.stop();
    jest.useRealTimers();
  });

  describe('File Change to WebSocket Event Flow', () => {
    beforeEach(() => {
      fileMonitor.start(['/test/path']);
    });

    it('should broadcast file change events when files are modified', () => {
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      changeHandler('session-data.jsonl');
      jest.advanceTimersByTime(1500);

      expect(wsManager.broadcastFileChanged).toHaveBeenCalledWith(
        expect.stringContaining('session-data.jsonl'),
        'modified'
      );
    });

    it('should broadcast session created events when new sessions detected', () => {
      const testJsonlContent = JSON.stringify({
        sessionId: 'new-session-abc',
        timestamp: '2024-01-01T00:00:00Z',
        cwd: '/test/project',
        type: 'user',
        message: { role: 'user', content: 'New session started' }
      });

      mockFs.readFileSync.mockReturnValue(testJsonlContent);
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('new-session.jsonl');
      jest.advanceTimersByTime(1500);

      expect(wsManager.broadcastSessionCreated).toHaveBeenCalledWith(
        'new-session-abc',
        '/test/project'
      );
    });

    it('should broadcast session updated events for existing sessions', () => {
      const testJsonlContent = [
        {
          sessionId: 'existing-session-def',
          timestamp: '2024-01-01T00:00:00Z',
          cwd: '/test/project',
          type: 'user',
          message: { role: 'user', content: 'First message' }
        },
        {
          sessionId: 'existing-session-def',
          timestamp: '2024-01-01T00:01:00Z',
          cwd: '/test/project',
          type: 'assistant',
          message: { 
            role: 'assistant', 
            content: [{ type: 'text', text: 'Response' }],
            id: 'msg-1',
            type: 'message',
            model: 'claude-3'
          }
        }
      ].map(entry => JSON.stringify(entry)).join('\n');

      mockFs.readFileSync.mockReturnValue(testJsonlContent);
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('updated-session.jsonl');
      jest.advanceTimersByTime(1500);

      expect(wsManager.broadcastSessionUpdated).toHaveBeenCalledWith(
        'existing-session-def',
        '/test/project',
        2
      );
    });
  });

  describe('Multiple File Changes', () => {
    beforeEach(() => {
      fileMonitor.start(['/test/path']);
    });

    it('should handle multiple files changing simultaneously', () => {
      const file1Content = JSON.stringify({
        sessionId: 'session-1',
        timestamp: '2024-01-01T00:00:00Z',
        cwd: '/project1'
      });

      const file2Content = JSON.stringify({
        sessionId: 'session-2',
        timestamp: '2024-01-01T00:00:00Z',
        cwd: '/project2'
      });

      mockFs.readFileSync
        .mockReturnValueOnce(file1Content)
        .mockReturnValueOnce(file2Content);

      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      changeHandler('file1.jsonl');
      changeHandler('file2.jsonl');
      
      jest.advanceTimersByTime(1500);

      expect(wsManager.broadcastSessionCreated).toHaveBeenCalledTimes(2);
      expect(wsManager.broadcastSessionCreated).toHaveBeenCalledWith('session-1', '/project1');
      expect(wsManager.broadcastSessionCreated).toHaveBeenCalledWith('session-2', '/project2');
    });

    it('should debounce rapid changes to the same file', () => {
      const testContent = JSON.stringify({
        sessionId: 'rapid-session',
        timestamp: '2024-01-01T00:00:00Z',
        cwd: '/test/project'
      });

      mockFs.readFileSync.mockReturnValue(testContent);

      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      // Rapid changes to same file
      changeHandler('rapid.jsonl');
      changeHandler('rapid.jsonl');
      changeHandler('rapid.jsonl');
      
      jest.advanceTimersByTime(1500);

      // Should only process once due to debouncing
      expect(wsManager.broadcastSessionCreated).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(() => {
      fileMonitor.start(['/test/path']);
    });

    it('should continue operating when file read fails', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      expect(() => {
        changeHandler('problematic.jsonl');
        jest.advanceTimersByTime(1500);
      }).not.toThrow();

      // File change event should still be broadcast
      expect(wsManager.broadcastFileChanged).toHaveBeenCalledWith(
        expect.stringContaining('problematic.jsonl'),
        'modified'
      );

      // But session events should not be broadcast due to read error
      expect(wsManager.broadcastSessionCreated).not.toHaveBeenCalled();
      expect(wsManager.broadcastSessionUpdated).not.toHaveBeenCalled();
    });

    it('should handle corrupted JSONL gracefully', () => {
      const mixedContent = [
        '{"valid": "json", "sessionId": "good-session", "cwd": "/test"}',
        'corrupted-line-not-json',
        '{"another": "valid", "sessionId": "another-good", "cwd": "/test"}'
      ].join('\n');

      mockFs.readFileSync.mockReturnValue(mixedContent);

      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('mixed.jsonl');
      jest.advanceTimersByTime(1500);

      // Should still broadcast file change
      expect(wsManager.broadcastFileChanged).toHaveBeenCalledWith(
        expect.stringContaining('mixed.jsonl'),
        'modified'
      );

      // Should process valid entries
      expect(wsManager.broadcastSessionCreated).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance Considerations', () => {
    beforeEach(() => {
      fileMonitor.start(['/test/path']);
    });

    it('should handle large JSONL files efficiently', () => {
      // Simulate a large file with many entries
      const largeFileEntries = Array.from({ length: 100 }, (_, i) => 
        JSON.stringify({
          sessionId: `batch-session-${Math.floor(i / 10)}`,
          timestamp: `2024-01-01T00:${String(i).padStart(2, '0')}:00Z`,
          cwd: '/large/project',
          type: 'user',
          message: { role: 'user', content: `Message ${i}` }
        })
      );

      mockFs.readFileSync.mockReturnValue(largeFileEntries.join('\n'));

      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('large.jsonl');
      jest.advanceTimersByTime(1500);

      // Should group by session and emit updates for sessions with multiple entries
      expect(wsManager.broadcastSessionUpdated).toHaveBeenCalled();
      
      // Should process all sessions efficiently
      const totalCalls = (wsManager.broadcastSessionCreated as jest.Mock).mock.calls.length +
                        (wsManager.broadcastSessionUpdated as jest.Mock).mock.calls.length;
      expect(totalCalls).toBeGreaterThan(0);
    });
  });

  describe('Event Ordering', () => {
    beforeEach(() => {
      fileMonitor.start(['/test/path']);
    });

    it('should maintain correct event order for file and session events', () => {
      const testContent = JSON.stringify({
        sessionId: 'ordered-session',
        timestamp: '2024-01-01T00:00:00Z',
        cwd: '/test/project'
      });

      mockFs.readFileSync.mockReturnValue(testContent);

      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('ordered.jsonl');
      jest.advanceTimersByTime(1500);

      // File change should be broadcast first, then session events
      expect(wsManager.broadcastFileChanged).toHaveBeenCalled();
      expect(wsManager.broadcastSessionCreated).toHaveBeenCalled();
      
      // Verify call order using invocation order
      const fileChangedOrder = (wsManager.broadcastFileChanged as jest.Mock).mock.invocationCallOrder[0];
      const sessionCreatedOrder = (wsManager.broadcastSessionCreated as jest.Mock).mock.invocationCallOrder[0];
      expect(fileChangedOrder).toBeLessThan(sessionCreatedOrder);
    });
  });

  describe('Cleanup Integration', () => {
    it('should clean up both systems properly', async () => {
      fileMonitor.start(['/test/path']);
      
      fileMonitor.stop();
      await wsManager.stop();

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(fileMonitor.getStatus().isActive).toBe(false);
    });
  });
});