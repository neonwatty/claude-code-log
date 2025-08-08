import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer, Server as HttpServer } from 'http';
import express, { Express } from 'express';
import { AddressInfo } from 'net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import WebSocketService from '../services/websocket';
import websocketRoutes from './websocket';

describe('WebSocket Routes', () => {
  let app: Express;
  let httpServer: HttpServer;
  let webSocketService: WebSocketService;
  let clientSocket: ClientSocket;
  let serverPort: number;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
  });

  beforeEach(() => {
    return new Promise<void>((resolve) => {
      // Create Express app
      app = express();
      app.use(express.json());
      
      // Create HTTP server
      httpServer = createServer(app);
      
      // Initialize WebSocket service
      webSocketService = new WebSocketService(httpServer);
      
      // Make WebSocket service available to routes
      app.locals.webSocketService = webSocketService;
      
      // Add routes
      app.use('/api/websocket', websocketRoutes);
      
      // Start server on random port
      httpServer.listen(() => {
        serverPort = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  }, 10000);

  afterEach(() => {
    return new Promise<void>((resolve) => {
      if (clientSocket && clientSocket.connected) {
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

  describe('GET /api/websocket/stats', () => {
    it('should return connection statistics', async () => {
      const response = await request(app)
        .get('/api/websocket/stats')
        .expect(200);

      expect(response.body).toHaveProperty('connectedClients');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.connectedClients).toBe('number');
      expect(response.body.connectedClients).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing WebSocket service gracefully', async () => {
      // Remove WebSocket service
      delete app.locals.webSocketService;
      
      const response = await request(app)
        .get('/api/websocket/stats')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('WebSocket service not available');
    });
  });

  describe('GET /api/websocket/session/:sessionId/clients', () => {
    beforeEach(() => {
      return new Promise<void>((resolve) => {
        // Create client connection for testing
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          transports: ['websocket'],
          forceNew: true,
        });
        
        clientSocket.on('connect', () => {
          // Authenticate and join session
          clientSocket.emit('authenticate', { 
            userId: 'test-user', 
            sessionId: 'test-session' 
          });
          
          clientSocket.on('authenticated', () => {
            clientSocket.emit('join-session', 'test-session');
            setTimeout(resolve, 100); // Give time for join to process
          });
        });
      });
    });

    it('should return session clients', async () => {
      const response = await request(app)
        .get('/api/websocket/session/test-session/clients')
        .expect(200);

      expect(response.body).toHaveProperty('sessionId', 'test-session');
      expect(response.body).toHaveProperty('clientCount');
      expect(response.body).toHaveProperty('clients');
      expect(Array.isArray(response.body.clients)).toBe(true);
    });

    it('should handle missing WebSocket service', async () => {
      delete app.locals.webSocketService;
      
      const response = await request(app)
        .get('/api/websocket/session/test-session/clients')
        .expect(500);

      expect(response.body.error).toBe('WebSocket service not available');
    });
  });

  describe('POST /api/websocket/session/:sessionId/broadcast', () => {
    beforeEach(() => {
      return new Promise<void>((resolve) => {
        // Create client connection for testing broadcasts
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          transports: ['websocket'],
          forceNew: true,
        });
        
        clientSocket.on('connect', () => {
          clientSocket.emit('authenticate', { 
            userId: 'test-user', 
            sessionId: 'broadcast-session' 
          });
          
          clientSocket.on('authenticated', () => {
            clientSocket.emit('join-session', 'broadcast-session');
            setTimeout(resolve, 100);
          });
        });
      });
    });

    it('should broadcast message to session', async () => {
      const testData = {
        event: 'test-event',
        data: { message: 'Hello session!' }
      };

      // Listen for the broadcast on client
      const messagePromise = new Promise<void>((resolve) => {
        clientSocket.on('test-event', (data) => {
          expect(data).toEqual(testData.data);
          resolve();
        });
      });

      const response = await request(app)
        .post('/api/websocket/session/broadcast-session/broadcast')
        .send(testData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('test-event');
      expect(response.body.message).toContain('broadcast-session');

      // Wait for client to receive message
      await messagePromise;
    });

    it('should require event name', async () => {
      const response = await request(app)
        .post('/api/websocket/session/test-session/broadcast')
        .send({ data: { message: 'No event name' } })
        .expect(400);

      expect(response.body.error).toBe('Event name is required');
    });

    it('should handle missing WebSocket service', async () => {
      delete app.locals.webSocketService;
      
      const response = await request(app)
        .post('/api/websocket/session/test-session/broadcast')
        .send({ event: 'test', data: {} })
        .expect(500);

      expect(response.body.error).toBe('WebSocket service not available');
    });
  });

  describe('POST /api/websocket/user/:userId/broadcast', () => {
    beforeEach(() => {
      return new Promise<void>((resolve) => {
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          transports: ['websocket'],
          forceNew: true,
        });
        
        clientSocket.on('connect', () => {
          clientSocket.emit('authenticate', { 
            userId: 'broadcast-user',
            sessionId: 'test-session' 
          });
          
          clientSocket.on('authenticated', () => {
            setTimeout(resolve, 100);
          });
        });
      });
    });

    it('should broadcast message to specific user', async () => {
      const testData = {
        event: 'user-message',
        data: { message: 'Hello user!' }
      };

      // Listen for the broadcast on client
      const messagePromise = new Promise<void>((resolve) => {
        clientSocket.on('user-message', (data) => {
          expect(data).toEqual(testData.data);
          resolve();
        });
      });

      const response = await request(app)
        .post('/api/websocket/user/broadcast-user/broadcast')
        .send(testData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('user-message');
      expect(response.body.message).toContain('broadcast-user');

      await messagePromise;
    });
  });

  describe('POST /api/websocket/broadcast', () => {
    beforeEach(() => {
      return new Promise<void>((resolve) => {
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          transports: ['websocket'],
          forceNew: true,
        });
        
        clientSocket.on('connect', resolve);
      });
    });

    it('should broadcast message to all clients', async () => {
      const testData = {
        event: 'global-message',
        data: { message: 'Hello everyone!' }
      };

      // Listen for the broadcast on client
      const messagePromise = new Promise<void>((resolve) => {
        clientSocket.on('global-message', (data) => {
          expect(data).toEqual(testData.data);
          resolve();
        });
      });

      const response = await request(app)
        .post('/api/websocket/broadcast')
        .send(testData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('connectedClients');
      expect(response.body.message).toContain('global-message');

      await messagePromise;
    });

    it('should require event name for global broadcast', async () => {
      const response = await request(app)
        .post('/api/websocket/broadcast')
        .send({ data: { message: 'No event' } })
        .expect(400);

      expect(response.body.error).toBe('Event name is required');
    });
  });
});