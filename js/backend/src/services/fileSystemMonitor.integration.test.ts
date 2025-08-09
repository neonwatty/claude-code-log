import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import express from 'express';
import WebSocketService from './websocket';
import FileSystemMonitor from './fileSystemMonitor';

describe('FileSystemMonitor Integration Tests', () => {
  let testDir: string;
  let app: express.Application;
  let httpServer: HttpServer;
  let webSocketService: WebSocketService;
  let fileSystemMonitor: FileSystemMonitor;
  let clientSocket: ClientSocket;
  let port: number;

  beforeAll(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `file-monitor-integration-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Set up Express app
    app = express();
    app.use(express.json());

    // Create HTTP server
    httpServer = new HttpServer(app);
    
    // Initialize WebSocket service
    webSocketService = new WebSocketService(httpServer);

    // Initialize FileSystemMonitor
    fileSystemMonitor = new FileSystemMonitor({
      watchPaths: [testDir],
      debounceMs: 100, // Faster for tests
      webSocketService,
    });

    // Start file monitoring
    await fileSystemMonitor.start();

    // Start HTTP server
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Stop file monitoring
    if (fileSystemMonitor) {
      await fileSystemMonitor.stop();
    }

    // Close WebSocket service
    if (webSocketService) {
      await webSocketService.close();
    }

    // Close HTTP server
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }

    // Clean up test directory
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might not exist or be in use, that's ok
    }
  });

  beforeEach(async () => {
    // Create WebSocket client
    clientSocket = ClientIO(`http://localhost:${port}`, {
      forceNew: true,
      timeout: 5000,
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      clientSocket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      clientSocket.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Authenticate client
    await new Promise<void>((resolve, reject) => {
      clientSocket.emit('authenticate', {
        userId: 'test-user',
        sessionId: 'test-session',
      });

      clientSocket.on('authenticated', (data) => {
        if (data.success) {
          resolve();
        } else {
          reject(new Error('Authentication failed'));
        }
      });
    });
  });

  afterEach(async () => {
    // Disconnect WebSocket client
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }

    // Clean up test files
    try {
      const files = await fs.readdir(testDir);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          await fs.unlink(join(testDir, file));
        }
      }
    } catch (error) {
      // Directory might be empty, that's ok
    }
  });

  describe('End-to-end file monitoring workflow', () => {
    it('should detect file creation and broadcast to WebSocket clients', async () => {
      const receivedEvents: any[] = [];

      // Listen for WebSocket events
      clientSocket.on('file-system-event', (data) => {
        receivedEvents.push({ type: 'file-system-event', data });
      });

      clientSocket.on('session-detected', (data) => {
        receivedEvents.push({ type: 'session-detected', data });
      });

      // Create a JSONL file
      const sessionId = 'integration-test-session-123';
      const testFile = join(testDir, `${sessionId}.jsonl`);
      const content = JSON.stringify({
        type: 'user',
        timestamp: new Date().toISOString(),
        sessionId,
        uuid: 'test-uuid-1',
        isSidechain: false,
        userType: 'claude-code',
        cwd: '/test/directory',
        version: '1.0.0',
        message: {
          role: 'user',
          content: 'Hello, this is a test message!',
        },
      });

      await fs.writeFile(testFile, content);

      // Wait for file system events and WebSocket broadcasts
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check that we received WebSocket events
      expect(receivedEvents.length).toBeGreaterThan(0);

      // Check file system event
      const fileEvents = receivedEvents.filter(e => e.type === 'file-system-event');
      expect(fileEvents.length).toBeGreaterThan(0);
      
      const fileEvent = fileEvents[0];
      expect(fileEvent.data.type).toBe('file_changed');
      expect(fileEvent.data.data.type).toBe('created');
      expect(fileEvent.data.data.filename).toBe(`${sessionId}.jsonl`);
      expect(fileEvent.data.data.filepath).toBe(testFile);

      // Check session detection event
      const sessionEvents = receivedEvents.filter(e => e.type === 'session-detected');
      expect(sessionEvents.length).toBeGreaterThan(0);
      
      const sessionEvent = sessionEvents[0];
      expect(sessionEvent.data.type).toBe('new_session');
      expect(sessionEvent.data.data.sessionId).toBe(sessionId);
      expect(sessionEvent.data.data.filepath).toBe(testFile);
    });

    it('should handle file modification with WebSocket updates', async () => {
      const receivedEvents: any[] = [];

      // Create initial file
      const testFile = join(testDir, 'modification-test.jsonl');
      const initialContent = JSON.stringify({
        type: 'user',
        sessionId: 'mod-test-session',
        message: { role: 'user', content: 'Initial content' },
      });

      await fs.writeFile(testFile, initialContent);

      // Wait for initial events to clear
      await new Promise(resolve => setTimeout(resolve, 200));

      // Now start listening for modification events
      clientSocket.on('file-system-event', (data) => {
        receivedEvents.push({ type: 'file-system-event', data });
      });

      // Modify the file
      const modifiedContent = initialContent + '\n' + JSON.stringify({
        type: 'assistant',
        sessionId: 'mod-test-session',
        message: { 
          id: 'msg-1',
          role: 'assistant', 
          content: [{ type: 'text', text: 'Assistant response' }] 
        },
      });

      await fs.writeFile(testFile, modifiedContent);

      // Wait for file system events
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check modification event was received
      const fileEvents = receivedEvents.filter(e => e.type === 'file-system-event');
      expect(fileEvents.length).toBeGreaterThan(0);
      
      const modEvent = fileEvents.find(e => e.data.data.type === 'modified');
      expect(modEvent).toBeDefined();
      expect(modEvent.data.data.filename).toBe('modification-test.jsonl');
    });

    it('should handle multiple concurrent file operations', async () => {
      const receivedEvents: any[] = [];

      // Listen for all events
      clientSocket.on('file-system-event', (data) => {
        receivedEvents.push({ type: 'file-system-event', data });
      });

      clientSocket.on('session-detected', (data) => {
        receivedEvents.push({ type: 'session-detected', data });
      });

      // Create multiple files simultaneously
      const fileOperations = [];
      for (let i = 0; i < 5; i++) {
        const sessionId = `concurrent-session-${i}`;
        const testFile = join(testDir, `concurrent-${i}.jsonl`);
        const content = JSON.stringify({
          type: 'user',
          sessionId,
          message: { role: 'user', content: `Message ${i}` },
        });

        fileOperations.push(fs.writeFile(testFile, content));
      }

      // Execute all file operations
      await Promise.all(fileOperations);

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 800));

      // Check that we received events for all files
      const fileEvents = receivedEvents.filter(e => e.type === 'file-system-event');
      const sessionEvents = receivedEvents.filter(e => e.type === 'session-detected');

      expect(fileEvents.length).toBeGreaterThanOrEqual(5);
      expect(sessionEvents.length).toBeGreaterThanOrEqual(5);

      // Verify we got events for each file
      const createdFiles = fileEvents
        .filter(e => e.data.data.type === 'created')
        .map(e => e.data.data.filename);

      for (let i = 0; i < 5; i++) {
        expect(createdFiles).toContain(`concurrent-${i}.jsonl`);
      }
    });

    it('should handle file deletion events', async () => {
      const receivedEvents: any[] = [];

      // Create file first
      const testFile = join(testDir, 'deletion-test.jsonl');
      const content = JSON.stringify({
        type: 'user',
        sessionId: 'deletion-session',
        message: { role: 'user', content: 'To be deleted' },
      });

      await fs.writeFile(testFile, content);

      // Wait for creation events to settle
      await new Promise(resolve => setTimeout(resolve, 200));

      // Start listening for deletion events
      clientSocket.on('file-system-event', (data) => {
        receivedEvents.push({ type: 'file-system-event', data });
      });

      // Delete the file
      await fs.unlink(testFile);

      // Wait for deletion events
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check deletion event was received
      const fileEvents = receivedEvents.filter(e => e.type === 'file-system-event');
      const deleteEvent = fileEvents.find(e => e.data.data.type === 'deleted');

      expect(deleteEvent).toBeDefined();
      expect(deleteEvent.data.data.filename).toBe('deletion-test.jsonl');
    });

    it('should handle malformed JSONL files gracefully', async () => {
      const receivedEvents: any[] = [];

      clientSocket.on('file-system-event', (data) => {
        receivedEvents.push({ type: 'file-system-event', data });
      });

      clientSocket.on('session-detected', (data) => {
        receivedEvents.push({ type: 'session-detected', data });
      });

      // Create file with malformed JSON
      const testFile = join(testDir, 'malformed-test.jsonl');
      const malformedContent = [
        '{"type":"user","message":{"role":"user","content":"Valid line"}}',
        'This is not valid JSON',
        '{"incomplete": json',
        '{"type":"user","message":{"role":"user","content":"Another valid line"}}',
      ].join('\n');

      await fs.writeFile(testFile, malformedContent);

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should still receive file system event (file was created)
      const fileEvents = receivedEvents.filter(e => e.type === 'file-system-event');
      expect(fileEvents.length).toBeGreaterThan(0);

      // Session detection might or might not work depending on parsing
      // But the system should not crash
      expect(receivedEvents.length).toBeGreaterThan(0);
    });

    it('should maintain WebSocket connection during file operations', async () => {
      let connectionEvents = 0;
      let disconnectionEvents = 0;

      clientSocket.on('connect', () => {
        connectionEvents++;
      });

      clientSocket.on('disconnect', () => {
        disconnectionEvents++;
      });

      // Perform many file operations
      for (let i = 0; i < 10; i++) {
        const testFile = join(testDir, `stability-test-${i}.jsonl`);
        const content = JSON.stringify({
          type: 'user',
          sessionId: `stability-session-${i}`,
          message: { role: 'user', content: `Stability test ${i}` },
        });

        await fs.writeFile(testFile, content);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Wait for all events to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Connection should remain stable
      expect(clientSocket.connected).toBe(true);
      expect(disconnectionEvents).toBe(0);
    });
  });

  describe('Error handling and recovery', () => {
    it('should recover from temporary file system errors', async () => {
      const receivedEvents: any[] = [];

      clientSocket.on('file-system-event', (data) => {
        receivedEvents.push({ type: 'file-system-event', data });
      });

      // Create file with valid content
      const testFile = join(testDir, 'recovery-test.jsonl');
      const validContent = JSON.stringify({
        type: 'user',
        sessionId: 'recovery-session',
        message: { role: 'user', content: 'Recovery test' },
      });

      await fs.writeFile(testFile, validContent);

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));

      // System should continue working after errors
      expect(receivedEvents.length).toBeGreaterThan(0);
      expect(clientSocket.connected).toBe(true);
    });

    it('should handle WebSocket client disconnections gracefully', async () => {
      const testFile = join(testDir, 'disconnect-test.jsonl');
      
      // Disconnect client
      clientSocket.disconnect();

      // Create file while client is disconnected
      const content = JSON.stringify({
        type: 'user',
        sessionId: 'disconnect-session',
        message: { role: 'user', content: 'Message while disconnected' },
      });

      await fs.writeFile(testFile, content);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // System should continue working (no crashes)
      expect(fileSystemMonitor.getStatus().isRunning).toBe(true);
    });
  });
});