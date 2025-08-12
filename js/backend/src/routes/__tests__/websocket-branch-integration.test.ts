import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Server as HttpServer } from 'http';
import { io as Client, Socket } from 'socket.io-client';
import sessionsRouter from '../sessions';
import WebSocketService from '../../services/websocket';
import SessionBranchingService from '../../services/session-branching';
import { sessionErrorHandler } from '../../middleware/sessionValidation';

// Mock the SessionBranchingService to control branch creation
vi.mock('../../services/session-branching');

describe('WebSocket Branch Notifications Integration', () => {
  let app: express.Application;
  let httpServer: HttpServer;
  let webSocketService: WebSocketService;
  let clientSocket1: Socket;
  let clientSocket2: Socket;
  let port: number;

  beforeEach(async () => {
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRouter);
    app.use(sessionErrorHandler);

    // Create HTTP server
    httpServer = new HttpServer(app);
    
    // Get available port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    });

    // Create WebSocket service
    webSocketService = new WebSocketService(httpServer);
    
    // Make WebSocket service available to routes
    app.locals.webSocketService = webSocketService;

    // Create client sockets
    const clientOptions = {
      transports: ['websocket'],
      forceNew: true,
    };

    clientSocket1 = Client(`http://localhost:${port}`, clientOptions);
    clientSocket2 = Client(`http://localhost:${port}`, clientOptions);

    // Wait for connections
    await Promise.all([
      new Promise<void>((resolve) => clientSocket1.on('connect', resolve)),
      new Promise<void>((resolve) => clientSocket2.on('connect', resolve)),
    ]);

    // Authenticate clients
    await Promise.all([
      new Promise<void>((resolve) => {
        clientSocket1.emit('authenticate', { 
          userId: 'user1', 
          sessionId: 'session1' 
        });
        clientSocket1.on('authenticated', resolve);
      }),
      new Promise<void>((resolve) => {
        clientSocket2.emit('authenticate', { 
          userId: 'user2', 
          sessionId: 'session2' 
        });
        clientSocket2.on('authenticated', resolve);
      }),
    ]);

    // Join session rooms
    clientSocket1.emit('join-session', 'parent-session-123');
    clientSocket2.emit('join-session', 'parent-session-123');

    // Wait a bit for room joins to process
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Clean up mocks
    vi.clearAllMocks();

    // Close client sockets
    if (clientSocket1) {
      clientSocket1.disconnect();
    }
    if (clientSocket2) {
      clientSocket2.disconnect();
    }

    // Close WebSocket service and HTTP server
    if (webSocketService) {
      await webSocketService.close();
    }
    
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });

  describe('Branch Creation WebSocket Notifications', () => {
    it('should emit session-branched event when branch is created via API', async () => {
      // Setup mock for successful branch creation
      const mockBranchResponse = {
        sessionId: 'new-branch-session-456',
        session: {
          id: 'new-branch-session-456',
          parentSessionId: 'parent-session-123',
          branchPoint: 2,
          branchTimestamp: new Date('2024-01-01T12:00:00Z'),
          branchMetadata: {
            branchName: 'test-branch',
            branchReason: 'Testing API integration',
          },
          workingDirectory: '/test/project',
          status: 'active',
          createdAt: new Date('2024-01-01T12:00:00Z'),
        },
        success: true,
      };

      vi.mocked(SessionBranchingService).mockImplementation(() => ({
        createBranch: vi.fn().mockResolvedValue(mockBranchResponse),
      } as any));

      // Set up event listeners for both clients
      const branchNotifications1: any[] = [];
      const branchNotifications2: any[] = [];

      clientSocket1.on('session-branched', (data) => {
        branchNotifications1.push(data);
      });

      clientSocket2.on('session-branched', (data) => {
        branchNotifications2.push(data);
      });

      // Make API request to create branch
      const response = await request(app)
        .post('/api/sessions/parent-session-123/branch')
        .send({
          branchPoint: 2,
          metadata: {
            branchName: 'test-branch',
            branchReason: 'Testing API integration',
          },
          workingDirectory: '/test/project',
          directoryPath: '/test/jsonl/directory',
        })
        .expect(201);

      // Verify API response
      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe('new-branch-session-456');

      // Wait for WebSocket notifications to be delivered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify both clients received the notification
      expect(branchNotifications1).toHaveLength(1);
      expect(branchNotifications2).toHaveLength(1);

      // Verify notification content
      const notification = branchNotifications1[0];
      expect(notification).toMatchObject({
        parentSessionId: 'parent-session-123',
        branchSession: {
          id: 'new-branch-session-456',
          parentSessionId: 'parent-session-123',
          branchPoint: 2,
          branchMetadata: {
            branchName: 'test-branch',
            branchReason: 'Testing API integration',
          },
        },
        affectedSessions: expect.arrayContaining(['parent-session-123']),
      });

      // Both clients should receive the same notification
      expect(branchNotifications1[0]).toEqual(branchNotifications2[0]);
    });

    it('should emit branch-tree-updated event for complex branch structures', async () => {
      // Mock SessionStateManager to emit branch-tree-updated
      const sessionStateManager = webSocketService.getSessionStateManager();
      const branchNotificationService = webSocketService.getBranchNotificationService();

      const branchTreeNotifications1: any[] = [];
      const branchTreeNotifications2: any[] = [];

      clientSocket1.on('branch-tree-updated', (data) => {
        branchTreeNotifications1.push(data);
      });

      clientSocket2.on('branch-tree-updated', (data) => {
        branchTreeNotifications2.push(data);
      });

      // Manually trigger branch tree update
      const branchData = {
        parentId: 'parent-session-123',
        childId: 'new-branch-456',
        branchPoint: 1,
      };

      await branchNotificationService.notifyBranchTreeUpdated('parent-session-123', branchData);

      // Wait for notifications
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notifications were received
      expect(branchTreeNotifications1).toHaveLength(1);
      expect(branchTreeNotifications2).toHaveLength(1);

      const notification = branchTreeNotifications1[0];
      expect(notification).toMatchObject({
        rootSessionId: 'parent-session-123',
        branchData: {
          parentId: 'parent-session-123',
          childId: 'new-branch-456',
          branchPoint: 1,
        },
        affectedSessions: expect.arrayContaining(['parent-session-123']),
      });
    });

    it('should handle branch creation failures gracefully', async () => {
      // Setup mock for failed branch creation
      const mockErrorResponse = {
        sessionId: '',
        session: {} as any,
        success: false,
        error: 'Parent session not found',
      };

      vi.mocked(SessionBranchingService).mockImplementation(() => ({
        createBranch: vi.fn().mockResolvedValue(mockErrorResponse),
      } as any));

      const branchNotifications: any[] = [];
      clientSocket1.on('session-branched', (data) => {
        branchNotifications.push(data);
      });

      // Make API request that will fail
      const response = await request(app)
        .post('/api/sessions/nonexistent-session/branch')
        .send({
          branchPoint: 2,
          metadata: {
            branchName: 'test-branch',
          },
          workingDirectory: '/test/project',
          directoryPath: '/test/jsonl/directory',
        })
        .expect(400);

      // Verify API error response
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Parent session not found');

      // Wait for potential notifications
      await new Promise(resolve => setTimeout(resolve, 100));

      // No notifications should be sent for failed branch creation
      expect(branchNotifications).toHaveLength(0);
    });

    it('should broadcast to all clients including those not in specific sessions', async () => {
      // Create a third client not in any session
      const clientSocket3 = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await new Promise<void>((resolve) => {
        clientSocket3.on('connect', () => {
          clientSocket3.emit('authenticate', { 
            userId: 'user3', 
            sessionId: 'session3' 
          });
          clientSocket3.on('authenticated', resolve);
        });
      });

      const mockBranchResponse = {
        sessionId: 'new-branch-session-789',
        session: {
          id: 'new-branch-session-789',
          parentSessionId: 'parent-session-123',
          branchPoint: 1,
          branchTimestamp: new Date(),
          branchMetadata: { branchName: 'global-test' },
          workingDirectory: '/test',
          status: 'active',
          createdAt: new Date(),
        },
        success: true,
      };

      vi.mocked(SessionBranchingService).mockImplementation(() => ({
        createBranch: vi.fn().mockResolvedValue(mockBranchResponse),
      } as any));

      const globalNotifications: any[] = [];
      clientSocket3.on('session-branched', (data) => {
        globalNotifications.push(data);
      });

      // Create branch
      await request(app)
        .post('/api/sessions/parent-session-123/branch')
        .send({
          branchPoint: 1,
          metadata: { branchName: 'global-test' },
          workingDirectory: '/test',
          directoryPath: '/test/jsonl',
        })
        .expect(201);

      // Wait for notifications
      await new Promise(resolve => setTimeout(resolve, 100));

      // Client not in the session should still receive global notification
      expect(globalNotifications).toHaveLength(1);
      expect(globalNotifications[0]).toMatchObject({
        parentSessionId: 'parent-session-123',
        branchSession: {
          id: 'new-branch-session-789',
        },
      });

      clientSocket3.disconnect();
    });
  });

  describe('Client Connection and Event Filtering', () => {
    it('should handle client disconnection gracefully', async () => {
      const mockBranchResponse = {
        sessionId: 'new-branch-session-disconnect',
        session: {
          id: 'new-branch-session-disconnect',
          parentSessionId: 'parent-session-123',
          branchPoint: 0,
          branchTimestamp: new Date(),
          workingDirectory: '/test',
          status: 'active',
          createdAt: new Date(),
        },
        success: true,
      };

      vi.mocked(SessionBranchingService).mockImplementation(() => ({
        createBranch: vi.fn().mockResolvedValue(mockBranchResponse),
      } as any));

      // Disconnect one client
      clientSocket2.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));

      const notifications: any[] = [];
      clientSocket1.on('session-branched', (data) => {
        notifications.push(data);
      });

      // Create branch - should not cause errors
      await request(app)
        .post('/api/sessions/parent-session-123/branch')
        .send({
          branchPoint: 0,
          workingDirectory: '/test',
          directoryPath: '/test/jsonl',
        })
        .expect(201);

      // Wait for notifications
      await new Promise(resolve => setTimeout(resolve, 100));

      // Remaining client should still receive notification
      expect(notifications).toHaveLength(1);
    });

    it('should provide correct branch notification service stats', () => {
      const stats = webSocketService.getBranchNotificationStats();
      
      expect(stats).toMatchObject({
        initialized: true,
        connectedClients: expect.any(Number),
        hasEventManager: true,
      });
      
      expect(stats.connectedClients).toBeGreaterThanOrEqual(2);
    });
  });
});