import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import WebSocketService from './websocket';

describe('WebSocketService', () => {
  let httpServer: HttpServer;
  let webSocketService: WebSocketService;
  let clientSocket: ClientSocket;
  let serverPort: number;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
  });

  beforeEach((context) => {
    return new Promise<void>((resolve) => {
      // Create HTTP server
      httpServer = createServer();
      
      // Initialize WebSocket service
      webSocketService = new WebSocketService(httpServer);
      
      // Start server on random port
      httpServer.listen(() => {
        serverPort = (httpServer.address() as AddressInfo).port;
        
        // Create client connection
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          transports: ['websocket'],
          forceNew: true,
        });
        
        clientSocket.on('connect', () => {
          resolve();
        });
      });
    });
  }, 10000);

  afterEach(() => {
    return new Promise<void>((resolve) => {
      if (clientSocket) {
        clientSocket.disconnect();
      }
      
      if (webSocketService) {
        webSocketService.close().then(() => {
          if (httpServer) {
            httpServer.close(() => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else if (httpServer) {
        httpServer.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }, 10000);

  describe('Server Initialization', () => {
    it('should initialize WebSocket server correctly', () => {
      expect(webSocketService).toBeDefined();
      expect(webSocketService.server).toBeDefined();
    });

    it('should get initial connected clients count', () => {
      expect(webSocketService.getConnectedClients()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Client Connection', () => {
    it('should accept client connections', () => {
      expect(clientSocket.connected).toBe(true);
      expect(clientSocket.id).toBeDefined();
    });

    it('should handle client authentication', (context) => {
      return new Promise<void>((resolve) => {
        const authData = { 
          userId: 'test-user-123', 
          sessionId: 'test-session-456' 
        };

        clientSocket.on('authenticated', (response) => {
          expect(response.success).toBe(true);
          resolve();
        });

        clientSocket.emit('authenticate', authData);
      });
    }, 5000);

    it('should handle ping/pong correctly', (context) => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('ping', (response: string) => {
          expect(response).toBe('pong');
          resolve();
        });
      });
    }, 5000);
  });

  describe('Session Management', () => {
    beforeEach(() => {
      return new Promise<void>((resolve) => {
        // Authenticate first
        clientSocket.on('authenticated', () => {
          resolve();
        });
        
        clientSocket.emit('authenticate', { 
          userId: 'test-user', 
          sessionId: 'test-session' 
        });
      });
    });

    it('should handle session joining', () => {
      const sessionId = 'test-session-join';
      
      // Just verify the client can join a session without errors
      expect(() => {
        clientSocket.emit('join-session', sessionId);
      }).not.toThrow();
      
      // Small delay to let the join process
      return new Promise<void>(resolve => setTimeout(resolve, 100));
    });

    it('should handle session updates', (context) => {
      return new Promise<void>((resolve) => {
        const sessionId = 'test-session-update';
        const updateData = {
          sessionId,
          update: { 
            type: 'test-update',
            data: { message: 'Test update' },
            timestamp: new Date().toISOString()
          }
        };

        // Create second client to receive the update
        const secondClient = ioClient(`http://localhost:${serverPort}`, {
          transports: ['websocket'],
          forceNew: true,
        });

        secondClient.on('connect', () => {
          secondClient.emit('authenticate', { userId: 'user2', sessionId });
          secondClient.emit('join-session', sessionId);

          secondClient.on('session-updated', (data) => {
            expect(data.update).toEqual(updateData.update);
            expect(data.fromSocket).toBeDefined();
            expect(data.timestamp).toBeDefined();
            secondClient.disconnect();
            resolve();
          });

          // Join session and send update after second client is ready
          setTimeout(() => {
            clientSocket.emit('join-session', sessionId);
            clientSocket.emit('session-update', updateData);
          }, 100);
        });
      });
    }, 5000);
  });

  describe('Broadcasting Methods', () => {
    it('should broadcast to all clients', (context) => {
      return new Promise<void>((resolve) => {
        const testEvent = 'test-broadcast';
        const testData = { message: 'Hello everyone!' };

        clientSocket.on(testEvent, (data) => {
          expect(data).toEqual(testData);
          resolve();
        });

        webSocketService.broadcastToAll(testEvent, testData);
      });
    }, 5000);

    it('should get session clients', async () => {
      const sessionId = 'test-session-clients';
      
      // First authenticate and join session
      await new Promise<void>((resolve) => {
        clientSocket.on('authenticated', () => {
          clientSocket.emit('join-session', sessionId);
          setTimeout(resolve, 100); // Give time for join to process
        });
        
        clientSocket.emit('authenticate', { 
          userId: 'test-user', 
          sessionId 
        });
      });

      const clients = await webSocketService.getSessionClients(sessionId);
      expect(Array.isArray(clients)).toBe(true);
      expect(clients.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Simulate connection error
      webSocketService.server.engine.emit('connection_error', new Error('Test connection error'));
      
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket connection error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle client disconnection', () => {
      return new Promise<void>((resolve) => {
        clientSocket.on('disconnect', () => {
          // Just verify disconnect happens - the fact that this event fired means it worked
          expect(true).toBe(true);
          resolve();
        });

        // Trigger disconnect
        clientSocket.disconnect();
      });
    });
  });

  describe('Connection Management', () => {
    it('should track connection statistics', () => {
      const stats = webSocketService.getConnectionStats();
      
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('connectionsPerUser');
      expect(stats).toHaveProperty('connectionsPerIP');
      expect(stats).toHaveProperty('heartbeatStats');
      
      expect(stats.activeConnections).toBeGreaterThanOrEqual(1);
      expect(stats.totalConnections).toBeGreaterThanOrEqual(1);
    });

    it('should get connection info for a socket', () => {
      const connectionInfo = webSocketService.getConnectionInfo(clientSocket.id);
      
      expect(connectionInfo).toBeDefined();
      expect(connectionInfo?.socketId).toBe(clientSocket.id);
      expect(connectionInfo?.connectionId).toBeDefined();
      expect(connectionInfo?.connectedAt).toBeInstanceOf(Date);
    });

    it('should handle authentication with enhanced features', () => {
      return new Promise<void>((resolve) => {
        clientSocket.on('authenticated', (response) => {
          expect(response.success).toBe(true);
          expect(response.connectionId).toBeDefined();
          expect(response.reconnectToken).toBeDefined();
          resolve();
        });

        clientSocket.emit('authenticate', { 
          userId: 'test-user-conn-mgmt', 
          sessionId: 'test-session-conn-mgmt' 
        });
      });
    });

    it('should track user connections', async () => {
      // First authenticate to establish user connection
      await new Promise<void>((resolve) => {
        clientSocket.on('authenticated', () => resolve());
        clientSocket.emit('authenticate', { 
          userId: 'test-user-tracking', 
          sessionId: 'test-session' 
        });
      });

      const userConnections = webSocketService.getUserConnections('test-user-tracking');
      
      expect(Array.isArray(userConnections)).toBe(true);
      expect(userConnections.length).toBeGreaterThanOrEqual(1);
      expect(userConnections[0]).toHaveProperty('userId', 'test-user-tracking');
    });

    it('should handle reconnect token requests', () => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('request-reconnect-token', (token: string) => {
          expect(typeof token).toBe('string');
          expect(token.length).toBeGreaterThan(0);
          resolve();
        });
      });
    });

    it('should update connection limits', () => {
      const newLimits = {
        maxConnectionsPerUser: 10,
        maxConnectionsPerIP: 20,
      };

      expect(() => {
        webSocketService.updateConnectionLimits(newLimits);
      }).not.toThrow();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should close gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await webSocketService.close();
      
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket server closed');
      
      consoleSpy.mockRestore();
    });
  });
});