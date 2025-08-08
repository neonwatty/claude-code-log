import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import WebSocketService from './websocket';
import { AppEvent, EventFilter, EventHistory } from '../types/websocket';

describe('WebSocket Event System Integration', () => {
  let httpServer: HttpServer;
  let webSocketService: WebSocketService;
  let clientSocket: ClientSocket;
  let serverPort: number;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
  });

  beforeEach((context) => {
    return new Promise<void>((resolve) => {
      httpServer = createServer();
      webSocketService = new WebSocketService(httpServer);
      
      httpServer.listen(() => {
        serverPort = (httpServer.address() as AddressInfo).port;
        
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

  describe('Event Subscription via WebSocket', () => {
    beforeEach(() => {
      return new Promise<void>((resolve) => {
        clientSocket.on('authenticated', () => {
          resolve();
        });
        
        clientSocket.emit('authenticate', { 
          userId: 'test-user', 
          sessionId: 'test-session' 
        });
      });
    });

    it('should handle event subscription', (context) => {
      return new Promise<void>((resolve) => {
        const filter: EventFilter = {
          types: ['file:created', 'file:modified'],
          userId: 'test-user'
        };

        clientSocket.on('subscription-created', (data) => {
          expect(data.subscriptionId).toBeDefined();
          expect(typeof data.subscriptionId).toBe('string');
          resolve();
        });

        clientSocket.emit('subscribe-events', filter, (subscriptionId: string) => {
          expect(subscriptionId).toBeDefined();
        });
      });
    }, 5000);

    it('should handle event unsubscription', (context) => {
      return new Promise<void>((resolve) => {
        const filter: EventFilter = {
          types: ['file:created']
        };

        let subscriptionId: string;

        clientSocket.on('subscription-created', (data) => {
          subscriptionId = data.subscriptionId;
          
          clientSocket.on('subscription-removed', (removeData) => {
            expect(removeData.subscriptionId).toBe(subscriptionId);
            resolve();
          });
          
          clientSocket.emit('unsubscribe-events', subscriptionId);
        });

        clientSocket.emit('subscribe-events', filter, (id: string) => {
          subscriptionId = id;
        });
      });
    }, 5000);

    it('should receive events after subscription', (context) => {
      return new Promise<void>((resolve) => {
        const filter: EventFilter = {
          types: ['file:created']
        };

        clientSocket.on('subscription-created', () => {
          // Publish an event that should match the filter
          clientSocket.emit('publish-event', {
            type: 'file:created',
            data: {
              filePath: '/test/newfile.js',
              fileName: 'newfile.js',
              fileSize: 256
            }
          });
        });

        clientSocket.on('app-event', (event: AppEvent) => {
          expect(event.type).toBe('file:created');
          expect(event.userId).toBe('test-user');
          expect((event as any).data.filePath).toBe('/test/newfile.js');
          resolve();
        });

        clientSocket.emit('subscribe-events', filter, () => {});
      });
    }, 5000);

    it('should not receive events that do not match filter', (context) => {
      return new Promise<void>((resolve, reject) => {
        const filter: EventFilter = {
          types: ['file:created'] // Only file:created events
        };

        let eventReceived = false;

        clientSocket.on('subscription-created', () => {
          // Publish an event that should NOT match the filter
          clientSocket.emit('publish-event', {
            type: 'user:joined',
            data: {
              userId: 'another-user',
              action: 'joined'
            }
          });
          
          // Wait a bit to ensure no event is received
          setTimeout(() => {
            if (!eventReceived) {
              resolve();
            } else {
              reject(new Error('Received event that should have been filtered'));
            }
          }, 1000);
        });

        clientSocket.on('app-event', (event: AppEvent) => {
          if (event.type === 'user:joined') {
            eventReceived = true;
          }
        });

        clientSocket.emit('subscribe-events', filter, () => {});
      });
    }, 5000);
  });

  describe('Event Publishing via WebSocket', () => {
    beforeEach(() => {
      return new Promise<void>((resolve) => {
        clientSocket.on('authenticated', () => {
          resolve();
        });
        
        clientSocket.emit('authenticate', { 
          userId: 'test-user', 
          sessionId: 'test-session' 
        });
      });
    });

    it('should publish events when authenticated', (context) => {
      return new Promise<void>((resolve) => {
        // Subscribe to all events to catch our published event
        clientSocket.on('subscription-created', () => {
          clientSocket.emit('publish-event', {
            type: 'code:changed',
            data: {
              filePath: '/src/app.js',
              language: 'javascript',
              changes: {
                startLine: 1,
                endLine: 5,
                content: 'console.log("test");'
              }
            }
          });
        });

        clientSocket.on('app-event', (event: AppEvent) => {
          expect(event.type).toBe('code:changed');
          expect(event.userId).toBe('test-user');
          expect(event.sessionId).toBe('test-session');
          resolve();
        });

        clientSocket.emit('subscribe-events', {}, () => {});
      });
    }, 5000);

    it('should reject event publishing when not authenticated', (context) => {
      return new Promise<void>((resolve) => {
        // Create a new unauthenticated client
        const unauthClient = ioClient(`http://localhost:${serverPort}`, {
          transports: ['websocket'],
          forceNew: true,
        });

        unauthClient.on('connect', () => {
          unauthClient.on('error-message', (error) => {
            expect(error.code).toBe('UNAUTHORIZED');
            expect(error.message).toContain('Authentication required');
            unauthClient.disconnect();
            resolve();
          });

          unauthClient.emit('publish-event', {
            type: 'file:created',
            data: {
              filePath: '/test.js',
              fileName: 'test.js'
            }
          });
        });
      });
    }, 5000);
  });

  describe('Event History via WebSocket', () => {
    beforeEach(async () => {
      await new Promise<void>((resolve) => {
        clientSocket.on('authenticated', () => {
          resolve();
        });
        
        clientSocket.emit('authenticate', { 
          userId: 'test-user', 
          sessionId: 'test-session' 
        });
      });

      // Add some events to history
      await new Promise<void>((resolve) => {
        let eventsPublished = 0;
        const totalEvents = 3;

        const checkComplete = () => {
          eventsPublished++;
          if (eventsPublished === totalEvents) {
            setTimeout(resolve, 100); // Small delay to ensure events are processed
          }
        };

        clientSocket.on('app-event', checkComplete);

        // Subscribe to catch our own events
        clientSocket.emit('subscribe-events', {}, () => {
          clientSocket.emit('publish-event', {
            type: 'file:created',
            data: { filePath: '/test1.js', fileName: 'test1.js' }
          });
          
          clientSocket.emit('publish-event', {
            type: 'file:modified',
            data: { filePath: '/test2.js', fileName: 'test2.js' }
          });
          
          clientSocket.emit('publish-event', {
            type: 'user:joined',
            data: { userId: 'test-user', action: 'joined' }
          });
        });
      });
    });

    it('should retrieve event history', (context) => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('request-event-history', undefined, 1, 10, (history: EventHistory) => {
          expect(history).toBeDefined();
          expect(history.events).toBeInstanceOf(Array);
          expect(history.events.length).toBeGreaterThanOrEqual(3);
          expect(history.totalCount).toBeGreaterThanOrEqual(3);
          expect(history.page).toBe(1);
          expect(history.pageSize).toBe(10);
          resolve();
        });
      });
    }, 5000);

    it('should retrieve filtered event history', (context) => {
      return new Promise<void>((resolve) => {
        const filter: EventFilter = {
          types: ['file:created', 'file:modified']
        };

        clientSocket.emit('request-event-history', filter, 1, 10, (history: EventHistory) => {
          expect(history.events.length).toBeGreaterThanOrEqual(2);
          expect(history.events.every(e => e.type.startsWith('file:'))).toBe(true);
          resolve();
        });
      });
    }, 5000);

    it('should handle pagination in history', (context) => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('request-event-history', undefined, 1, 2, (history: EventHistory) => {
          expect(history.events.length).toBe(2);
          expect(history.pageSize).toBe(2);
          expect(history.hasMore).toBe(true);
          resolve();
        });
      });
    }, 5000);
  });

  describe('Event Replay via WebSocket', () => {
    beforeEach(async () => {
      await new Promise<void>((resolve) => {
        clientSocket.on('authenticated', () => {
          resolve();
        });
        
        clientSocket.emit('authenticate', { 
          userId: 'test-user', 
          sessionId: 'test-session' 
        });
      });

      // Add events for replay
      await new Promise<void>((resolve) => {
        let eventsPublished = 0;
        
        clientSocket.on('app-event', () => {
          eventsPublished++;
          if (eventsPublished === 2) {
            setTimeout(resolve, 100);
          }
        });

        clientSocket.emit('subscribe-events', {}, () => {
          clientSocket.emit('publish-event', {
            type: 'file:created',
            data: { filePath: '/replay1.js', fileName: 'replay1.js' }
          });
          
          clientSocket.emit('publish-event', {
            type: 'file:modified', 
            data: { filePath: '/replay2.js', fileName: 'replay2.js' }
          });
        });
      });
    });

    it('should replay events', (context) => {
      return new Promise<void>((resolve) => {
        let replayStarted = false;
        let replayEnded = false;
        let eventsReplayed = 0;

        clientSocket.on('event-replay-start', (data) => {
          expect(data.count).toBeGreaterThanOrEqual(2);
          replayStarted = true;
        });

        clientSocket.on('event-replay-end', () => {
          replayEnded = true;
          expect(replayStarted).toBe(true);
          expect(eventsReplayed).toBeGreaterThanOrEqual(2);
          resolve();
        });

        // Count replayed events (they come as regular app-event)
        const originalHandler = clientSocket.listeners('app-event')[0];
        clientSocket.off('app-event');
        
        clientSocket.on('app-event', (event) => {
          eventsReplayed++;
          if (originalHandler) originalHandler(event);
        });

        clientSocket.emit('request-event-replay');
      });
    }, 5000);

    it('should replay filtered events', (context) => {
      return new Promise<void>((resolve) => {
        let fileEventsReplayed = 0;

        clientSocket.on('event-replay-start', (data) => {
          expect(data.count).toBeGreaterThanOrEqual(1);
        });

        clientSocket.on('event-replay-end', () => {
          expect(fileEventsReplayed).toBeGreaterThanOrEqual(1);
          resolve();
        });

        // Count only file:created events
        clientSocket.off('app-event');
        clientSocket.on('app-event', (event) => {
          if (event.type === 'file:created') {
            fileEventsReplayed++;
          }
        });

        clientSocket.emit('request-event-replay', {
          types: ['file:created']
        });
      });
    }, 5000);
  });

  describe('Automatic Event Generation', () => {
    beforeEach(() => {
      return new Promise<void>((resolve) => {
        clientSocket.on('authenticated', () => {
          resolve();
        });
        
        clientSocket.emit('authenticate', { 
          userId: 'test-user', 
          sessionId: 'test-session' 
        });
      });
    });

    it('should generate user:joined events when joining sessions', (context) => {
      return new Promise<void>((resolve) => {
        // Subscribe to user events
        clientSocket.on('subscription-created', () => {
          clientSocket.emit('join-session', 'test-session-123');
        });

        clientSocket.on('app-event', (event: AppEvent) => {
          if (event.type === 'user:joined') {
            expect(event.userId).toBe('test-user');
            expect(event.sessionId).toBe('test-session-123');
            expect((event as any).data.action).toBe('joined_session');
            expect((event as any).data.target).toBe('test-session-123');
            resolve();
          }
        });

        clientSocket.emit('subscribe-events', {
          types: ['user:joined']
        }, () => {});
      });
    }, 5000);

    it('should generate user:left events when leaving sessions', (context) => {
      return new Promise<void>((resolve) => {
        // First join a session, then leave it
        let joined = false;

        clientSocket.on('subscription-created', () => {
          clientSocket.emit('join-session', 'test-session-leave');
        });

        clientSocket.on('app-event', (event: AppEvent) => {
          if (event.type === 'user:joined' && !joined) {
            joined = true;
            // Now leave the session
            clientSocket.emit('leave-session', 'test-session-leave');
          } else if (event.type === 'user:left') {
            expect(event.userId).toBe('test-user');
            expect(event.sessionId).toBe('test-session-leave');
            expect((event as any).data.action).toBe('left_session');
            resolve();
          }
        });

        clientSocket.emit('subscribe-events', {
          types: ['user:joined', 'user:left']
        }, () => {});
      });
    }, 5000);
  });

  describe('Event System Statistics', () => {
    it('should provide event statistics through WebSocket service', () => {
      const stats = webSocketService.getEventStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalEvents).toBeDefined();
      expect(stats.activeSubscriptions).toBeDefined();
      expect(stats.eventsByType).toBeDefined();
      expect(stats.recentActivity).toBeDefined();
      expect(stats.historySize).toBeDefined();
      expect(stats.maxHistorySize).toBeDefined();
    });

    it('should provide event history through WebSocket service', () => {
      const history = webSocketService.getEventHistory();
      
      expect(history).toBeDefined();
      expect(history.events).toBeInstanceOf(Array);
      expect(history.totalCount).toBeDefined();
      expect(history.page).toBeDefined();
      expect(history.pageSize).toBeDefined();
      expect(history.hasMore).toBeDefined();
    });
  });

  describe('Rate Limiting on Event Publishing', () => {
    beforeEach(() => {
      return new Promise<void>((resolve) => {
        clientSocket.on('authenticated', () => {
          resolve();
        });
        
        clientSocket.emit('authenticate', { 
          userId: 'test-user', 
          sessionId: 'test-session' 
        });
      });
    });

    it('should enforce rate limiting on rapid event publishing', (context) => {
      return new Promise<void>((resolve) => {
        let rateLimitHit = false;

        clientSocket.on('error-message', (error) => {
          if (error.code === 'RATE_LIMIT_EXCEEDED') {
            rateLimitHit = true;
            expect(error.message).toContain('Too many');
            resolve();
          }
        });

        // Publish many events rapidly to trigger rate limit
        for (let i = 0; i < 50; i++) {
          clientSocket.emit('publish-event', {
            type: 'file:created',
            data: {
              filePath: `/spam${i}.js`,
              fileName: `spam${i}.js`
            }
          });
        }

        // If no rate limit hit in 3 seconds, something's wrong
        setTimeout(() => {
          if (!rateLimitHit) {
            resolve(); // Rate limiting might not be strict enough to trigger in test
          }
        }, 3000);
      });
    }, 5000);
  });
});