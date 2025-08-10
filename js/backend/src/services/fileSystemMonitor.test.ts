import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { EventEmitter } from 'events';
import WebSocketService from './websocket';
import FileSystemMonitor, { FileChangeEvent, SessionDetectedEvent } from './fileSystemMonitor';

// Mock WebSocket service
const mockWebSocketService = {
  broadcastToAll: vi.fn(),
} as any;

describe('FileSystemMonitor', () => {
  let testDir: string;
  let monitor: FileSystemMonitor;
  let events: Array<{ type: string; data: any }>;

  beforeAll(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `file-monitor-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.rmdir(testDir, { recursive: true }).catch(() => {
      // Directory might not exist, that's ok
    });
  });

  beforeEach(() => {
    events = [];
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Create fresh monitor instance
    monitor = new FileSystemMonitor({
      watchPaths: [testDir],
      debounceMs: 50, // Short debounce for faster tests
      webSocketService: mockWebSocketService,
    });

    // Capture events
    monitor.on('fileChanged', (event: FileChangeEvent) => {
      events.push({ type: 'fileChanged', data: event });
    });

    monitor.on('sessionDetected', (event: SessionDetectedEvent) => {
      events.push({ type: 'sessionDetected', data: event });
    });

    monitor.on('error', (error: Error) => {
      events.push({ type: 'error', data: error });
    });
  });

  afterEach(async () => {
    // Comprehensive cleanup with timeout protection
    const cleanup = async () => {
      // Stop monitor first
      if (monitor) {
        try {
          if (monitor.getStatus().isRunning) {
            await monitor.stop();
          }
        } catch (error) {
          console.warn('Monitor stop error:', error);
        }
      }
      
      // Remove all event listeners to prevent memory leaks
      if (monitor) {
        monitor.removeAllListeners();
      }

      // Clean up test files
      try {
        const files = await fs.readdir(testDir);
        await Promise.all(files.map(file => 
          fs.unlink(join(testDir, file)).catch(() => {})
        ));
      } catch (error) {
        // Directory might be empty or not exist, that's ok
      }
      
      // Clear all timers and mocks
      vi.clearAllTimers();
      vi.clearAllMocks();
      
      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 10));
    };
    
    // Apply overall timeout to cleanup
    await Promise.race([
      cleanup(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('FileSystemMonitor cleanup timeout')), 3000)
      )
    ]).catch(error => {
      console.warn('FileSystemMonitor cleanup failed:', error);
    });
  });

  describe('constructor', () => {
    it('should initialize with correct default options', () => {
      const monitor = new FileSystemMonitor({
        watchPaths: ['/test/path'],
      });

      const status = monitor.getStatus();
      expect(status.watchPaths).toEqual(['/test/path']);
      expect(status.isRunning).toBe(false);
    });

    it('should accept custom options', () => {
      const monitor = new FileSystemMonitor({
        watchPaths: ['/custom/path'],
        fileExtension: '.custom',
        debounceMs: 1000,
        recursive: false,
      });

      expect(monitor.getStatus().watchPaths).toEqual(['/custom/path']);
    });
  });

  describe('start/stop', () => {
    it('should start and stop monitoring', async () => {
      expect(monitor.getStatus().isRunning).toBe(false);
      
      await monitor.start();
      expect(monitor.getStatus().isRunning).toBe(true);
      
      await monitor.stop();
      expect(monitor.getStatus().isRunning).toBe(false);
    });

    it('should not start twice', async () => {
      await monitor.start();
      
      // Starting again should be a no-op
      await monitor.start();
      
      expect(monitor.getStatus().isRunning).toBe(true);
    });

    it('should handle stop when not running', async () => {
      // Should not throw
      await monitor.stop();
      expect(monitor.getStatus().isRunning).toBe(false);
    });
  });

  describe('file change detection', () => {
    it('should detect file creation', async () => {
      await monitor.start();
      
      const testFile = join(testDir, 'new-file.jsonl');
      const content = '{"type":"user","sessionId":"test-123","message":{"role":"user","content":"Hello"}}';
      
      await fs.writeFile(testFile, content);
      
      // Wait for debounce and file system events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const fileEvents = events.filter(e => e.type === 'fileChanged');
      expect(fileEvents.length).toBeGreaterThan(0);
      expect(fileEvents[0].data.type).toBe('created');
      expect(fileEvents[0].data.filename).toBe('new-file.jsonl');
    });

    it('should detect file modification', async () => {
      const testFile = join(testDir, 'existing-file.jsonl');
      const initialContent = '{"type":"user","sessionId":"test-123","message":{"role":"user","content":"Hello"}}';
      
      // Create file first
      await fs.writeFile(testFile, initialContent);
      
      await monitor.start();
      
      // Wait a moment for initial scan
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Clear events from initialization
      events.length = 0;
      
      // Modify the file
      const modifiedContent = initialContent + '\n{"type":"assistant","sessionId":"test-123","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}]}}';
      await fs.writeFile(testFile, modifiedContent);
      
      // Wait for debounce and file system events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const fileEvents = events.filter(e => e.type === 'fileChanged');
      expect(fileEvents.length).toBeGreaterThan(0);
      expect(fileEvents[0].data.type).toBe('modified');
    });

    it('should detect file deletion', async () => {
      const testFile = join(testDir, 'delete-me.jsonl');
      const content = '{"type":"user","sessionId":"test-123","message":{"role":"user","content":"Hello"}}';
      
      // Create file first
      await fs.writeFile(testFile, content);
      
      await monitor.start();
      
      // Wait for initial scan
      await new Promise(resolve => setTimeout(resolve, 100));
      events.length = 0; // Clear initialization events
      
      // Delete the file
      await fs.unlink(testFile);
      
      // Wait for file system events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const fileEvents = events.filter(e => e.type === 'fileChanged');
      expect(fileEvents.length).toBeGreaterThan(0);
      expect(fileEvents[0].data.type).toBe('deleted');
    });

    it('should ignore non-JSONL files', async () => {
      await monitor.start();
      
      const testFile = join(testDir, 'not-jsonl.txt');
      await fs.writeFile(testFile, 'This is not a JSONL file');
      
      // Wait for potential events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const fileEvents = events.filter(e => e.type === 'fileChanged');
      expect(fileEvents.length).toBe(0);
    });
  });

  describe('session detection', () => {
    it('should detect session from filename UUID', async () => {
      await monitor.start();
      
      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const testFile = join(testDir, `${sessionId}.jsonl`);
      const content = '{"type":"user","message":{"role":"user","content":"Hello"}}';
      
      await fs.writeFile(testFile, content);
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const sessionEvents = events.filter(e => e.type === 'sessionDetected');
      expect(sessionEvents.length).toBeGreaterThan(0);
      expect(sessionEvents[0].data.sessionId).toBe(sessionId);
    });

    it('should detect session from entry sessionId', async () => {
      await monitor.start();
      
      const testFile = join(testDir, 'unknown-name.jsonl');
      const sessionId = 'session-from-content-123';
      const content = `{"type":"user","sessionId":"${sessionId}","message":{"role":"user","content":"Hello"}}`;
      
      await fs.writeFile(testFile, content);
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const sessionEvents = events.filter(e => e.type === 'sessionDetected');
      expect(sessionEvents.length).toBeGreaterThan(0);
      expect(sessionEvents[0].data.sessionId).toBe(sessionId);
    });

    it('should detect session from metadata', async () => {
      await monitor.start();
      
      const testFile = join(testDir, 'metadata-session.jsonl');
      const sessionId = 'metadata-session-456';
      const content = `{"type":"user","metadata":{"sessionId":"${sessionId}"},"message":{"role":"user","content":"Hello"}}`;
      
      await fs.writeFile(testFile, content);
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const sessionEvents = events.filter(e => e.type === 'sessionDetected');
      expect(sessionEvents.length).toBeGreaterThan(0);
      expect(sessionEvents[0].data.sessionId).toBe(sessionId);
    });

    it('should handle files without session info gracefully', async () => {
      await monitor.start();
      
      const testFile = join(testDir, 'no-session.jsonl');
      const content = '{"type":"user","message":{"role":"user","content":"Hello"}}';
      
      await fs.writeFile(testFile, content);
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should have file change event but no session detected event
      const fileEvents = events.filter(e => e.type === 'fileChanged');
      const sessionEvents = events.filter(e => e.type === 'sessionDetected');
      
      expect(fileEvents.length).toBeGreaterThan(0);
      expect(sessionEvents.length).toBe(0);
    });
  });

  describe('WebSocket integration', () => {
    it('should broadcast file change events via WebSocket', async () => {
      await monitor.start();
      
      const testFile = join(testDir, 'websocket-test.jsonl');
      const content = '{"type":"user","sessionId":"ws-test","message":{"role":"user","content":"Hello"}}';
      
      await fs.writeFile(testFile, content);
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(mockWebSocketService.broadcastToAll).toHaveBeenCalledWith(
        'file-system-event',
        expect.objectContaining({
          type: 'file_changed',
          data: expect.objectContaining({
            type: 'created',
            filename: 'websocket-test.jsonl'
          })
        })
      );
    });

    it('should broadcast session detection events via WebSocket', async () => {
      await monitor.start();
      
      const testFile = join(testDir, 'session-broadcast-test.jsonl');
      const sessionId = 'broadcast-session-123';
      const content = `{"type":"user","sessionId":"${sessionId}","message":{"role":"user","content":"Hello"}}`;
      
      await fs.writeFile(testFile, content);
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(mockWebSocketService.broadcastToAll).toHaveBeenCalledWith(
        'session-detected',
        expect.objectContaining({
          type: 'new_session',
          data: expect.objectContaining({
            sessionId: sessionId
          })
        })
      );
    });

    it('should work without WebSocket service', async () => {
      const monitorWithoutWS = new FileSystemMonitor({
        watchPaths: [testDir],
        debounceMs: 50,
        // No webSocketService provided
      });

      await monitorWithoutWS.start();
      
      const testFile = join(testDir, 'no-websocket.jsonl');
      const content = '{"type":"user","message":{"role":"user","content":"Hello"}}';
      
      // Should not throw
      await fs.writeFile(testFile, content);
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await monitorWithoutWS.stop();
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid file changes', async () => {
      await monitor.start();
      
      const testFile = join(testDir, 'debounce-test.jsonl');
      
      // Make rapid changes
      for (let i = 0; i < 5; i++) {
        const content = `{"type":"user","message":{"role":"user","content":"Update ${i}"}}`;
        await fs.writeFile(testFile, content);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const fileEvents = events.filter(e => e.type === 'fileChanged');
      
      // Should have fewer events than changes due to debouncing
      expect(fileEvents.length).toBeLessThan(5);
      expect(fileEvents.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle malformed JSONL gracefully', async () => {
      await monitor.start();
      
      const testFile = join(testDir, 'malformed.jsonl');
      const content = 'This is not valid JSON\n{incomplete json';
      
      await fs.writeFile(testFile, content);
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should still detect file change, but not crash
      const fileEvents = events.filter(e => e.type === 'fileChanged');
      const errorEvents = events.filter(e => e.type === 'error');
      
      expect(fileEvents.length).toBeGreaterThan(0);
      // Errors might or might not be emitted depending on parsing strategy
    });

    it('should handle permission errors gracefully', async () => {
      // This test is platform-specific and might need adjustment
      const invalidPath = '/invalid/nonexistent/path';
      
      const monitorWithInvalidPath = new FileSystemMonitor({
        watchPaths: [invalidPath],
        debounceMs: 50,
      });

      // Should handle start failure gracefully
      await expect(monitorWithInvalidPath.start()).rejects.toThrow();
    });
  });

  describe('path management', () => {
    it('should add new watch paths', async () => {
      const newDir = join(testDir, 'new-watch-dir');
      await fs.mkdir(newDir, { recursive: true });
      
      await monitor.start();
      
      const initialStatus = monitor.getStatus();
      expect(initialStatus.watchPaths).not.toContain(newDir);
      
      await monitor.addWatchPath(newDir);
      
      const updatedStatus = monitor.getStatus();
      expect(updatedStatus.watchPaths).toContain(newDir);
      
      // Test that new directory is actually watched
      const testFile = join(newDir, 'new-path-test.jsonl');
      const content = '{"type":"user","message":{"role":"user","content":"Hello from new path"}}';
      
      await fs.writeFile(testFile, content);
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const fileEvents = events.filter(e => e.type === 'fileChanged');
      expect(fileEvents.length).toBeGreaterThan(0);
      
      // Cleanup
      await fs.unlink(testFile);
      await fs.rmdir(newDir);
    });

    it('should remove watch paths', async () => {
      await monitor.start();
      
      const initialStatus = monitor.getStatus();
      expect(initialStatus.watchPaths).toContain(testDir);
      
      monitor.removeWatchPath(testDir);
      
      const updatedStatus = monitor.getStatus();
      expect(updatedStatus.watchPaths).not.toContain(testDir);
    });
  });

  describe('rescan functionality', () => {
    it('should rescan directories', async () => {
      // Create files before starting monitor
      const testFile1 = join(testDir, 'existing-1.jsonl');
      const testFile2 = join(testDir, 'existing-2.jsonl');
      
      await fs.writeFile(testFile1, '{"type":"user","message":{"role":"user","content":"File 1"}}');
      await fs.writeFile(testFile2, '{"type":"user","message":{"role":"user","content":"File 2"}}');
      
      await monitor.start();
      
      // Rescan should pick up existing files
      await monitor.rescan();
      
      const status = monitor.getStatus();
      expect(status.watchedFiles).toBeGreaterThanOrEqual(2);
    });
  });

  describe('status reporting', () => {
    it('should report correct status', () => {
      const status = monitor.getStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('watchPaths');
      expect(status).toHaveProperty('watchedFiles');
      expect(status).toHaveProperty('activeWatchers');
      
      expect(status.isRunning).toBe(false);
      expect(Array.isArray(status.watchPaths)).toBe(true);
      expect(typeof status.watchedFiles).toBe('number');
      expect(typeof status.activeWatchers).toBe('number');
    });
  });
});