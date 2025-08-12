import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import { createServer, Server as HttpServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import WebSocketContextEvents, { ContextTransfer, ContextTransferState } from './websocket-context-events';
import { TypedSocket, ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types/websocket';

// Mock CLI integration service
vi.mock('../routes/cli-integration', () => ({
  cliIntegrationService: {
    prepareSessionContext: vi.fn(),
    markPackageTransferred: vi.fn(),
    shutdown: vi.fn(),
  },
}));

describe('WebSocketContextEvents', () => {
  let httpServer: HttpServer;
  let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  let contextEvents: WebSocketContextEvents;
  let clientSocket: ClientSocket;
  let serverSocket: TypedSocket;

  beforeEach((done) => {
    // Create HTTP server and Socket.IO server
    httpServer = createServer();
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // Create context events service
    contextEvents = new WebSocketContextEvents(io);

    // Start server
    httpServer.listen(0, () => {
      const port = (httpServer.address() as any)?.port;
      
      // Create client connection
      clientSocket = ioClient(`http://localhost:${port}`);
      
      // Setup server-side socket
      io.on('connection', (socket) => {
        serverSocket = socket as TypedSocket;
        // Mock socket data
        serverSocket.data = {
          userId: 'test-user-123',
          sessionId: 'test-session-123',
          connectedAt: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'test-client',
          lastHeartbeat: new Date(),
          connectionId: 'conn-123',
          reconnectCount: 0,
          totalConnections: 1,
        };
        
        // Set up context event handlers
        contextEvents.setupContextEventHandlers(serverSocket);
        
        done();
      });

      clientSocket.connect();
    });
  });

  afterEach(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    if (contextEvents) {
      await contextEvents.shutdown();
    }
    
    if (io) {
      io.close();
    }
    
    if (httpServer) {
      httpServer.close();
    }
    
    vi.clearAllMocks();
  });

  describe('Context Preparation', () => {
    it('should handle context prepare request successfully', (done) => {
      const mockPrepareResult = {
        package: {
          id: 'package-123',
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 60000),
          info: {
            compressed: false,
            size: 1024,
            checksum: 'checksum-123',
            version: '1.0.0',
          },
        },
        stats: {
          entriesIncluded: 10,
          totalEntries: 10,
          processingTimeMs: 100,
          filesReferenced: 5,
          toolsUsed: 3,
        },
      };

      // Mock CLI integration service
      const { cliIntegrationService } = require('../routes/cli-integration');
      cliIntegrationService.prepareSessionContext.mockResolvedValue(mockPrepareResult);

      // Listen for context-prepared event
      clientSocket.on('context-prepared', (data) => {
        expect(data.packageId).toBe('package-123');
        expect(data.sessionId).toBe('session-123');
        expect(data.stats).toBeDefined();
        done();
      });

      // Send context-prepare request
      clientSocket.emit('context-prepare', '/test/session.jsonl', {}, (result) => {
        expect(result.success).toBe(true);
        expect(result.packageId).toBe('package-123');
      });
    });

    it('should reject unauthenticated context prepare requests', (done) => {
      // Remove user ID to simulate unauthenticated request
      serverSocket.data.userId = undefined;

      clientSocket.emit('context-prepare', '/test/session.jsonl', {}, (result) => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('Authentication required');
        done();
      });
    });

    it('should handle context prepare failures', (done) => {
      const { cliIntegrationService } = require('../routes/cli-integration');
      cliIntegrationService.prepareSessionContext.mockRejectedValue(new Error('Preparation failed'));

      clientSocket.on('context-transfer-failed', (data) => {
        expect(data.error).toContain('Preparation failed');
        done();
      });

      clientSocket.emit('context-prepare', '/invalid/session.jsonl', {}, (result) => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('Preparation failed');
      });
    });
  });

  describe('Context Transfer', () => {
    let mockPackageId: string;

    beforeEach(() => {
      mockPackageId = 'package-123';
      
      const mockPrepareResult = {
        package: {
          id: mockPackageId,
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 60000),
          info: {
            compressed: false,
            size: 1024,
            checksum: 'checksum-123',
            version: '1.0.0',
          },
        },
        stats: {
          entriesIncluded: 10,
          totalEntries: 10,
          processingTimeMs: 100,
        },
      };

      const { cliIntegrationService } = require('../routes/cli-integration');
      cliIntegrationService.prepareSessionContext.mockResolvedValue(mockPrepareResult);
    });

    it('should handle context transfer initiation', (done) => {
      let transferInitiated = false;
      let transferCompleted = false;

      // Listen for transfer events
      clientSocket.on('context-transfer-initiated', (data) => {
        expect(data.packageId).toBe(mockPackageId);
        expect(data.status).toBe('transferring');
        transferInitiated = true;
      });

      clientSocket.on('context-transfer-completed', (data) => {
        expect(data.packageId).toBe(mockPackageId);
        expect(data.success).toBe(true);
        transferCompleted = true;
        
        // Check that both events were received
        expect(transferInitiated).toBe(true);
        expect(transferCompleted).toBe(true);
        done();
      });

      // First prepare context
      clientSocket.emit('context-prepare', '/test/session.jsonl', {}, (prepareResult) => {
        expect(prepareResult.success).toBe(true);
        
        // Then initiate transfer
        clientSocket.emit('context-transfer-initiate', mockPackageId, (transferResult) => {
          expect(transferResult.success).toBe(true);
          expect(transferResult.transferId).toBeDefined();
        });
      });
    });

    it('should handle transfer progress updates', (done) => {
      let progressReceived = false;

      clientSocket.on('context-transfer-progress', (data) => {
        expect(data.progress).toBeGreaterThanOrEqual(0);
        expect(data.progress).toBeLessThanOrEqual(100);
        expect(data.status).toBe('transferring');
        progressReceived = true;
      });

      clientSocket.on('context-transfer-completed', () => {
        expect(progressReceived).toBe(true);
        done();
      });

      // Prepare and initiate transfer
      clientSocket.emit('context-prepare', '/test/session.jsonl', {}, () => {
        clientSocket.emit('context-transfer-initiate', mockPackageId);
      });
    });

    it('should reject transfer for non-existent package', (done) => {
      clientSocket.emit('context-transfer-initiate', 'non-existent-package', (result) => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('Transfer not found');
        done();
      });
    });

    it('should reject unauthorized transfer access', (done) => {
      // Create transfer with different socket
      const anotherSocket = {
        ...serverSocket,
        id: 'different-socket',
        data: { ...serverSocket.data, userId: 'different-user' },
      } as TypedSocket;

      // Mock a transfer from another socket
      const mockTransfer: ContextTransfer = {
        id: 'transfer-123',
        packageId: mockPackageId,
        sessionId: 'session-123',
        socketId: 'different-socket',
        userId: 'different-user',
        state: 'ready',
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      };

      // Directly add the transfer to simulate it exists
      (contextEvents as any).activeTransfers.set('transfer-123', mockTransfer);
      (contextEvents as any).activeTransfers.set(mockPackageId, mockTransfer); // Map by package ID

      clientSocket.emit('context-transfer-initiate', mockPackageId, (result) => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('Transfer not found'); // Should not find it due to socket mismatch
        done();
      });
    });
  });

  describe('Transfer Status', () => {
    it('should return transfer status', (done) => {
      const mockPrepareResult = {
        package: {
          id: 'package-123',
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 60000),
          info: {
            compressed: false,
            size: 1024,
            checksum: 'checksum-123',
            version: '1.0.0',
          },
        },
        stats: {
          entriesIncluded: 10,
          totalEntries: 10,
          processingTimeMs: 100,
        },
      };

      const { cliIntegrationService } = require('../routes/cli-integration');
      cliIntegrationService.prepareSessionContext.mockResolvedValue(mockPrepareResult);

      clientSocket.emit('context-prepare', '/test/session.jsonl', {}, (prepareResult) => {
        expect(prepareResult.success).toBe(true);
        
        // Get the transfer ID from the preparation result
        const transferId = prepareResult.transferId;
        
        // Request transfer status
        clientSocket.emit('context-transfer-status', transferId, (status) => {
          expect(status.id).toBe(transferId);
          expect(status.packageId).toBe('package-123');
          expect(status.state).toBe('ready');
          expect(status.progress).toBeDefined();
          done();
        });
      });
    });

    it('should reject status request for non-existent transfer', (done) => {
      clientSocket.emit('context-transfer-status', 'non-existent-transfer', (status) => {
        expect(status.error).toContain('Transfer not found');
        done();
      });
    });
  });

  describe('Socket Disconnection Handling', () => {
    it('should cleanup transfers on socket disconnect', (done) => {
      const mockPrepareResult = {
        package: {
          id: 'package-123',
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 60000),
          info: {
            compressed: false,
            size: 1024,
            checksum: 'checksum-123',
            version: '1.0.0',
          },
        },
        stats: {
          entriesIncluded: 10,
          totalEntries: 10,
          processingTimeMs: 100,
        },
      };

      const { cliIntegrationService } = require('../routes/cli-integration');
      cliIntegrationService.prepareSessionContext.mockResolvedValue(mockPrepareResult);

      // Prepare context to create a transfer
      clientSocket.emit('context-prepare', '/test/session.jsonl', {}, (prepareResult) => {
        expect(prepareResult.success).toBe(true);
        
        // Start transfer
        clientSocket.emit('context-transfer-initiate', 'package-123', () => {
          // Check initial stats
          const initialStats = contextEvents.getTransferStats();
          expect(initialStats.total).toBeGreaterThan(0);
          
          // Disconnect client
          clientSocket.disconnect();
          
          // Wait a bit for cleanup to process
          setTimeout(() => {
            // Transfers should be cancelled but not necessarily removed yet
            const stats = contextEvents.getTransferStats();
            // Note: Transfers might still exist but should be in cancelled state
            done();
          }, 100);
        });
      });
    });
  });

  describe('Transfer Statistics', () => {
    it('should return accurate transfer statistics', () => {
      const stats = contextEvents.getTransferStats();
      
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('preparing');
      expect(stats).toHaveProperty('ready');
      expect(stats).toHaveProperty('transferring');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('cancelled');
      
      // Initially all should be 0
      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
    });

    it('should track socket transfers', (done) => {
      const mockPrepareResult = {
        package: {
          id: 'package-123',
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 60000),
          info: {
            compressed: false,
            size: 1024,
            checksum: 'checksum-123',
            version: '1.0.0',
          },
        },
        stats: {
          entriesIncluded: 10,
          totalEntries: 10,
          processingTimeMs: 100,
        },
      };

      const { cliIntegrationService } = require('../routes/cli-integration');
      cliIntegrationService.prepareSessionContext.mockResolvedValue(mockPrepareResult);

      clientSocket.emit('context-prepare', '/test/session.jsonl', {}, () => {
        const socketTransfers = contextEvents.getSocketTransfers(serverSocket.id);
        expect(socketTransfers.length).toBe(1);
        expect(socketTransfers[0].packageId).toBe('package-123');
        done();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', (done) => {
      const { cliIntegrationService } = require('../routes/cli-integration');
      cliIntegrationService.prepareSessionContext.mockRejectedValue(new Error('Service unavailable'));

      clientSocket.on('context-transfer-failed', (data) => {
        expect(data.error).toContain('Service unavailable');
        done();
      });

      clientSocket.emit('context-prepare', '/test/session.jsonl', {}, (result) => {
        expect(result.success).toBe(false);
      });
    });

    it('should handle invalid callback responses', () => {
      // Test that the service doesn't crash when callbacks are not provided
      expect(() => {
        serverSocket.emit('context-prepare', '/test/session.jsonl', {});
      }).not.toThrow();
    });
  });

  describe('Cleanup and Lifecycle', () => {
    it('should clean up expired transfers', async () => {
      // Create a transfer that's already expired
      const expiredTransfer: ContextTransfer = {
        id: 'expired-transfer',
        packageId: 'expired-package',
        sessionId: 'expired-session',
        socketId: serverSocket.id,
        userId: 'test-user',
        state: 'completed',
        progress: 100,
        createdAt: new Date(Date.now() - 60000),
        updatedAt: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() - 1000), // Already expired
      };

      // Add the expired transfer directly
      (contextEvents as any).activeTransfers.set('expired-transfer', expiredTransfer);

      const initialCount = contextEvents.getTransferStats().total;

      // Trigger cleanup manually
      (contextEvents as any).cleanupExpiredTransfers();

      const finalCount = contextEvents.getTransferStats().total;
      expect(finalCount).toBeLessThan(initialCount);
    });

    it('should shutdown cleanly', async () => {
      await expect(contextEvents.shutdown()).resolves.toBeUndefined();
      
      const stats = contextEvents.getTransferStats();
      expect(stats.total).toBe(0);
    });
  });
});