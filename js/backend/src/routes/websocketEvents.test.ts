import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import express, { Express } from 'express';
import WebSocketService from '../services/websocket';
import websocketRoutes from './websocket';

describe('WebSocket Event System REST API', () => {
  let app: Express;
  let httpServer: HttpServer;
  let webSocketService: WebSocketService;
  let serverPort: number;

  beforeEach(() => {
    return new Promise<void>((resolve) => {
      app = express();
      app.use(express.json());
      
      httpServer = createServer(app);
      webSocketService = new WebSocketService(httpServer);
      
      // Make WebSocketService available to routes
      app.locals.webSocketService = webSocketService;
      
      // Add WebSocket routes
      app.use('/api/websocket', websocketRoutes);
      
      httpServer.listen(() => {
        serverPort = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(() => {
    return new Promise<void>((resolve) => {
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
  });

  describe('GET /api/websocket/events/stats', () => {
    it('should return event statistics', async () => {
      const response = await request(app)
        .get('/api/websocket/events/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalEvents');
      expect(response.body).toHaveProperty('activeSubscriptions');
      expect(response.body).toHaveProperty('eventsByType');
      expect(response.body).toHaveProperty('recentActivity');
      expect(response.body).toHaveProperty('historySize');
      expect(response.body).toHaveProperty('maxHistorySize');

      expect(typeof response.body.totalEvents).toBe('number');
      expect(typeof response.body.activeSubscriptions).toBe('number');
      expect(typeof response.body.eventsByType).toBe('object');
      expect(Array.isArray(response.body.recentActivity)).toBe(true);
    });

    it('should handle missing WebSocket service', async () => {
      app.locals.webSocketService = null;
      
      const response = await request(app)
        .get('/api/websocket/events/stats')
        .expect(500);

      expect(response.body.error).toBe('WebSocket service not available');
    });
  });

  describe('GET /api/websocket/events/history', () => {
    beforeEach(async () => {
      // Add some events to history for testing
      await webSocketService.publishEvent({
        id: 'test1',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        userId: 'user1',
        sessionId: 'session1',
        data: { filePath: '/test1.js', fileName: 'test1.js' }
      });

      await webSocketService.publishEvent({
        id: 'test2',
        type: 'file:modified',
        timestamp: new Date().toISOString(),
        userId: 'user2',
        sessionId: 'session1',
        data: { filePath: '/test2.js', fileName: 'test2.js' }
      });

      await webSocketService.publishEvent({
        id: 'test3',
        type: 'user:joined',
        timestamp: new Date().toISOString(),
        userId: 'user1',
        sessionId: 'session2',
        data: { userId: 'user1', action: 'joined' }
      });
    });

    it('should return all event history', async () => {
      const response = await request(app)
        .get('/api/websocket/events/history')
        .expect(200);

      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('pageSize');
      expect(response.body).toHaveProperty('hasMore');

      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body.events.length).toBeGreaterThanOrEqual(3);
      expect(response.body.totalCount).toBeGreaterThanOrEqual(3);
    });

    it('should filter events by type', async () => {
      const response = await request(app)
        .get('/api/websocket/events/history?types=file:created,file:modified')
        .expect(200);

      expect(response.body.events.length).toBeGreaterThanOrEqual(2);
      expect(response.body.events.every((event: any) => 
        event.type === 'file:created' || event.type === 'file:modified'
      )).toBe(true);
    });

    it('should filter events by userId', async () => {
      const response = await request(app)
        .get('/api/websocket/events/history?userId=user1')
        .expect(200);

      expect(response.body.events.length).toBeGreaterThanOrEqual(2);
      expect(response.body.events.every((event: any) => event.userId === 'user1')).toBe(true);
    });

    it('should filter events by sessionId', async () => {
      const response = await request(app)
        .get('/api/websocket/events/history?sessionId=session1')
        .expect(200);

      expect(response.body.events.length).toBeGreaterThanOrEqual(2);
      expect(response.body.events.every((event: any) => event.sessionId === 'session1')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/websocket/events/history?page=1&pageSize=2')
        .expect(200);

      expect(response.body.events.length).toBeLessThanOrEqual(2);
      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(2);
    });

    it('should combine multiple filters', async () => {
      const response = await request(app)
        .get('/api/websocket/events/history?types=file:created&userId=user1&sessionId=session1')
        .expect(200);

      expect(response.body.events.every((event: any) => 
        event.type === 'file:created' && 
        event.userId === 'user1' && 
        event.sessionId === 'session1'
      )).toBe(true);
    });

    it('should handle missing WebSocket service', async () => {
      app.locals.webSocketService = null;
      
      const response = await request(app)
        .get('/api/websocket/events/history')
        .expect(500);

      expect(response.body.error).toBe('WebSocket service not available');
    });
  });

  describe('POST /api/websocket/events/publish', () => {
    it('should publish valid events', async () => {
      const eventData = {
        type: 'system:notification',
        data: {
          level: 'info',
          title: 'Test Notification',
          message: 'This is a test notification'
        },
        userId: 'admin',
        sessionId: 'admin-session',
        metadata: {
          priority: 'normal'
        }
      };

      const response = await request(app)
        .post('/api/websocket/events/publish')
        .send(eventData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Event published successfully');
    });

    it('should reject events without type', async () => {
      const eventData = {
        data: {
          level: 'info',
          title: 'Test',
          message: 'Test message'
        }
      };

      const response = await request(app)
        .post('/api/websocket/events/publish')
        .send(eventData)
        .expect(400);

      expect(response.body.error).toBe('Event type and data are required');
    });

    it('should reject events without data', async () => {
      const eventData = {
        type: 'system:notification'
      };

      const response = await request(app)
        .post('/api/websocket/events/publish')
        .send(eventData)
        .expect(400);

      expect(response.body.error).toBe('Event type and data are required');
    });

    it('should handle invalid events', async () => {
      const eventData = {
        type: 'file:created',
        data: {
          fileName: 'test.js'
          // Missing required filePath
        }
      };

      const response = await request(app)
        .post('/api/websocket/events/publish')
        .send(eventData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Event validation failed');
    });

    it('should handle publishing errors gracefully', async () => {
      app.locals.webSocketService = null;
      
      const eventData = {
        type: 'system:notification',
        data: {
          level: 'info',
          title: 'Test',
          message: 'Test message'
        }
      };

      const response = await request(app)
        .post('/api/websocket/events/publish')
        .send(eventData)
        .expect(500);

      expect(response.body.error).toBe('WebSocket service not available');
    });

    it('should include user context in published events', async () => {
      const eventData = {
        type: 'file:created',
        data: {
          filePath: '/test/api-created.js',
          fileName: 'api-created.js'
        },
        userId: 'api-user',
        sessionId: 'api-session'
      };

      await request(app)
        .post('/api/websocket/events/publish')
        .send(eventData)
        .expect(200);

      // Verify the event was stored with correct context
      const historyResponse = await request(app)
        .get('/api/websocket/events/history?userId=api-user')
        .expect(200);

      const publishedEvent = historyResponse.body.events.find((e: any) => 
        e.data.fileName === 'api-created.js'
      );
      
      expect(publishedEvent).toBeDefined();
      expect(publishedEvent.userId).toBe('api-user');
      expect(publishedEvent.sessionId).toBe('api-session');
    });
  });

  describe('DELETE /api/websocket/events/cleanup', () => {
    beforeEach(async () => {
      // Add an old event for cleanup testing
      const oldEvent = {
        id: 'old-event',
        type: 'file:created',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        data: { filePath: '/old.js', fileName: 'old.js' }
      };

      const newEvent = {
        id: 'new-event',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/new.js', fileName: 'new.js' }
      };

      await webSocketService.publishEvent(oldEvent);
      await webSocketService.publishEvent(newEvent);
    });

    it('should cleanup old events', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const response = await request(app)
        .delete('/api/websocket/events/cleanup')
        .send({ olderThan: oneHourAgo })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.removedCount).toBeGreaterThanOrEqual(1);
      expect(response.body.message).toContain('Cleaned up');
    });

    it('should require olderThan parameter', async () => {
      const response = await request(app)
        .delete('/api/websocket/events/cleanup')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('olderThan date is required');
    });

    it('should validate date format', async () => {
      const response = await request(app)
        .delete('/api/websocket/events/cleanup')
        .send({ olderThan: 'invalid-date' })
        .expect(400);

      expect(response.body.error).toBe('Invalid date format');
    });

    it('should handle missing WebSocket service', async () => {
      app.locals.webSocketService = null;
      
      const response = await request(app)
        .delete('/api/websocket/events/cleanup')
        .send({ olderThan: new Date().toISOString() })
        .expect(500);

      expect(response.body.error).toBe('WebSocket service not available');
    });
  });

  describe('Event System Integration with Existing Endpoints', () => {
    it('should include event stats in connection statistics', async () => {
      // Publish some events first
      await webSocketService.publishEvent({
        id: 'integration-test',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/integration.js', fileName: 'integration.js' }
      });

      const response = await request(app)
        .get('/api/websocket/stats')
        .expect(200);

      expect(response.body).toHaveProperty('connectedClients');
      expect(response.body).toHaveProperty('enhanced');
      expect(response.body.enhanced).toHaveProperty('totalConnections');
      expect(response.body.enhanced).toHaveProperty('activeConnections');
    });

    it('should maintain backward compatibility with existing endpoints', async () => {
      // Test that existing endpoints still work
      const response = await request(app)
        .get('/api/websocket/session/test-session/clients')
        .expect(200);

      expect(response.body).toHaveProperty('sessionId', 'test-session');
      expect(response.body).toHaveProperty('clientCount');
      expect(response.body).toHaveProperty('clients');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent event publishing', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/websocket/events/publish')
            .send({
              type: 'file:created',
              data: {
                filePath: `/concurrent${i}.js`,
                fileName: `concurrent${i}.js`
              }
            })
        );
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle large event history requests', async () => {
      // Add many events
      for (let i = 0; i < 50; i++) {
        await webSocketService.publishEvent({
          id: `bulk-${i}`,
          type: 'file:created',
          timestamp: new Date().toISOString(),
          data: { filePath: `/bulk${i}.js`, fileName: `bulk${i}.js` }
        });
      }

      const response = await request(app)
        .get('/api/websocket/events/history?pageSize=100')
        .expect(200);

      expect(response.body.events.length).toBeGreaterThanOrEqual(50);
      expect(response.body.totalCount).toBeGreaterThanOrEqual(50);
    });

    it('should handle invalid query parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/websocket/events/history?page=invalid&pageSize=not-a-number')
        .expect(200);

      // Should default to valid values
      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(50);
    });
  });

  describe('Security Considerations', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .post('/api/websocket/events/publish')
        .send({
          type: 'malicious:event',
          data: { payload: 'malicious data' }
        })
        .expect(400);

      expect(response.body.error).toBe('Event validation failed');
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
    });

    it('should validate event types against known types', async () => {
      const response = await request(app)
        .post('/api/websocket/events/publish')
        .send({
          type: 'unknown:type',
          data: { test: 'data' }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});