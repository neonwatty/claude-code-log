import { WebSocketManager, getWebSocketManager } from '../../websocket/server';
import { FileMonitor } from '../../services/fileMonitor';
import * as fs from 'fs';
import chokidar from 'chokidar';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import type { MockedFunction, Mocked } from 'vitest';

// Mock dependencies
vi.mock('fs');
vi.mock('chokidar');
vi.mock('../../websocket/server', async () => {
  const originalModule = await vi.importActual('../../websocket/server');
  return {
    ...originalModule,
    getWebSocketManager: vi.fn(),
    WebSocketManager: vi.fn().mockImplementation(() => ({
      broadcastFileChanged: vi.fn(),
      broadcastSessionCreated: vi.fn(),
      broadcastSessionUpdated: vi.fn(),
      broadcastSessionDeleted: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined)
    }))
  };
});

const mockFs = vi.mocked(fs);
const mockChokidar = chokidar as Mocked<typeof chokidar>;
const mockGetWebSocketManager = getWebSocketManager as MockedFunction<typeof getWebSocketManager>;

describe('FileMonitor + WebSocket Integration', () => {
  let fileMonitor: FileMonitor;
  let wsManager: WebSocketManager;
  let mockWatcher: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock watcher
    mockWatcher = {
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined)
    };
    
    mockChokidar.watch = vi.fn().mockReturnValue(mockWatcher);
    mockFs.existsSync.mockReturnValue(true);
    
    // Mock file system operations that FileMonitor uses
    mockFs.statSync.mockReturnValue({
      size: 1024,
      mtime: new Date('2023-01-01T10:00:00Z')
    } as any);
    mockFs.readFileSync.mockReturnValue('');

    // Create instances
    wsManager = new WebSocketManager();
    
    // Configure getWebSocketManager to return our mocked instance
    mockGetWebSocketManager.mockReturnValue(wsManager);
    
    fileMonitor = new FileMonitor();
  });

  afterEach(() => {
    if (fileMonitor && typeof fileMonitor.stop === 'function') {
      fileMonitor.stop();
    }
  });

  describe('File Change to WebSocket Event Flow', () => {
    beforeEach(() => {
      fileMonitor.start(['/test/path']);
    });

    it('should broadcast file change events when files are modified', async () => {
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      changeHandler('session-data.jsonl');
      
      // Wait for debounced processing (FileMonitor uses 1000ms debounce)
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(wsManager.broadcastFileChanged).toHaveBeenCalledWith(
        expect.stringContaining('session-data.jsonl'),
        'modified'
      );
    });

    it('should broadcast session created events when new sessions detected', async () => {
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
      
      // Wait for debounced processing (FileMonitor uses 1000ms debounce)
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(wsManager.broadcastSessionCreated).toHaveBeenCalledWith(
        'new-session-abc',
        '/test/project'
      );
    });

    it('should broadcast session updated events for existing sessions', async () => {
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
      
      // Wait for debounced processing (FileMonitor uses 1000ms debounce)
      await new Promise(resolve => setTimeout(resolve, 1100));

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

    it('should handle multiple files changing simultaneously', async () => {
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
      
      // Wait for debounced processing (FileMonitor uses 1000ms debounce)
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(wsManager.broadcastSessionCreated).toHaveBeenCalledTimes(2);
      expect(wsManager.broadcastSessionCreated).toHaveBeenCalledWith('session-1', '/project1');
      expect(wsManager.broadcastSessionCreated).toHaveBeenCalledWith('session-2', '/project2');
    });

    it('should debounce rapid changes to the same file', async () => {
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
      
      // Wait for debounced processing (FileMonitor uses 1000ms debounce)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should only process once due to debouncing
      expect(wsManager.broadcastSessionCreated).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(() => {
      fileMonitor.start(['/test/path']);
    });

    it('should continue operating when file read fails', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      expect(async () => {
        changeHandler('problematic.jsonl');
        await new Promise(resolve => setTimeout(resolve, 1100));
      }).not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 1100));

      // File change event should still be broadcast
      expect(wsManager.broadcastFileChanged).toHaveBeenCalledWith(
        expect.stringContaining('problematic.jsonl'),
        'modified'
      );

      // But session events should not be broadcast due to read error
      expect(wsManager.broadcastSessionCreated).not.toHaveBeenCalled();
      expect(wsManager.broadcastSessionUpdated).not.toHaveBeenCalled();
    });

    it('should handle corrupted JSONL gracefully', async () => {
      const mixedContent = [
        '{"valid": "json", "sessionId": "good-session", "cwd": "/test"}',
        'corrupted-line-not-json',
        '{"another": "valid", "sessionId": "another-good", "cwd": "/test"}'
      ].join('\n');

      mockFs.readFileSync.mockReturnValue(mixedContent);

      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('mixed.jsonl');
      
      // Wait for debounced processing (FileMonitor uses 1000ms debounce)
      await new Promise(resolve => setTimeout(resolve, 1100));

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

    it('should handle large JSONL files efficiently', async () => {
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
      
      // Wait for debounced processing (FileMonitor uses 1000ms debounce)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should group by session and emit updates for sessions with multiple entries
      expect(wsManager.broadcastSessionUpdated).toHaveBeenCalled();
      
      // Should process all sessions efficiently
      const totalCalls = (wsManager.broadcastSessionCreated as any).mock.calls.length +
                        (wsManager.broadcastSessionUpdated as any).mock.calls.length;
      expect(totalCalls).toBeGreaterThan(0);
    });
  });

  describe('Event Ordering', () => {
    beforeEach(() => {
      fileMonitor.start(['/test/path']);
    });

    it('should maintain correct event order for file and session events', async () => {
      const testContent = JSON.stringify({
        sessionId: 'ordered-session',
        timestamp: '2024-01-01T00:00:00Z',
        cwd: '/test/project'
      });

      mockFs.readFileSync.mockReturnValue(testContent);

      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      changeHandler('ordered.jsonl');
      
      // Wait for debounced processing (FileMonitor uses 1000ms debounce)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // File change should be broadcast first, then session events
      expect(wsManager.broadcastFileChanged).toHaveBeenCalled();
      expect(wsManager.broadcastSessionCreated).toHaveBeenCalled();
      
      // Verify call order using invocation order
      const fileChangedOrder = (wsManager.broadcastFileChanged as any).mock.invocationCallOrder[0];
      const sessionCreatedOrder = (wsManager.broadcastSessionCreated as any).mock.invocationCallOrder[0];
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