import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { EventManager } from './eventManager';
import { 
  AppEvent, 
  EventFilter, 
  FileEvent, 
  UserActionEvent, 
  SessionEvent,
  CodeEvent,
  MessageEvent,
  SystemEvent,
  CustomEvent 
} from '../types/websocket';

describe('EventManager', () => {
  let httpServer: HttpServer;
  let io: SocketIOServer;
  let eventManager: EventManager;
  let mockSocket: any;

  beforeEach(() => {
    httpServer = createServer();
    io = new SocketIOServer(httpServer);
    eventManager = new EventManager(io, 100); // Small history size for testing
    
    // Mock socket
    mockSocket = {
      id: 'test-socket-id',
      data: {
        userId: 'test-user',
        sessionId: 'test-session'
      },
      emit: vi.fn()
    };
  });

  afterEach(() => {
    io.close();
    httpServer.close();
  });

  describe('Event Creation Factory Methods', () => {
    it('should create file events with correct structure', () => {
      const fileEvent = eventManager.createFileEvent(
        'file:created',
        {
          filePath: '/test/file.js',
          fileName: 'file.js',
          fileSize: 1024
        },
        { userId: 'user123', sessionId: 'session456' }
      );

      expect(fileEvent.id).toBeDefined();
      expect(fileEvent.type).toBe('file:created');
      expect(fileEvent.timestamp).toBeDefined();
      expect(fileEvent.userId).toBe('user123');
      expect(fileEvent.sessionId).toBe('session456');
      expect(fileEvent.data.filePath).toBe('/test/file.js');
      expect(fileEvent.data.fileName).toBe('file.js');
      expect(fileEvent.data.fileSize).toBe(1024);
    });

    it('should create user action events', () => {
      const userEvent = eventManager.createUserActionEvent(
        'user:joined',
        {
          userId: 'user123',
          action: 'joined_session',
          target: 'session456'
        },
        { userId: 'user123', sessionId: 'session456' }
      );

      expect(userEvent.type).toBe('user:joined');
      expect(userEvent.data.userId).toBe('user123');
      expect(userEvent.data.action).toBe('joined_session');
    });

    it('should create session events', () => {
      const sessionEvent = eventManager.createSessionEvent(
        'session:created',
        {
          sessionId: 'session456',
          sessionName: 'Test Session',
          participants: ['user1', 'user2']
        }
      );

      expect(sessionEvent.type).toBe('session:created');
      expect(sessionEvent.data.sessionId).toBe('session456');
      expect(sessionEvent.data.participants).toEqual(['user1', 'user2']);
    });

    it('should create code events', () => {
      const codeEvent = eventManager.createCodeEvent(
        'code:changed',
        {
          filePath: '/src/app.js',
          language: 'javascript',
          changes: {
            startLine: 1,
            endLine: 5,
            content: 'console.log("hello");'
          }
        }
      );

      expect(codeEvent.type).toBe('code:changed');
      expect(codeEvent.data.filePath).toBe('/src/app.js');
      expect(codeEvent.data.changes?.startLine).toBe(1);
    });

    it('should create message events', () => {
      const messageEvent = eventManager.createMessageEvent(
        'message:sent',
        {
          messageId: 'msg123',
          content: 'Hello world!',
          mentions: ['user1']
        }
      );

      expect(messageEvent.type).toBe('message:sent');
      expect(messageEvent.data.messageId).toBe('msg123');
      expect(messageEvent.data.content).toBe('Hello world!');
    });

    it('should create system events', () => {
      const systemEvent = eventManager.createSystemEvent(
        'system:notification',
        {
          level: 'info',
          title: 'System Update',
          message: 'System will restart in 5 minutes'
        }
      );

      expect(systemEvent.type).toBe('system:notification');
      expect(systemEvent.data.level).toBe('info');
      expect(systemEvent.data.title).toBe('System Update');
    });

    it('should create custom events', () => {
      const customEvent = eventManager.createCustomEvent(
        {
          eventName: 'user_achievement',
          payload: { achievement: 'first_commit', points: 100 }
        }
      );

      expect(customEvent.type).toBe('custom:event');
      expect(customEvent.data.eventName).toBe('user_achievement');
      expect(customEvent.data.payload.points).toBe(100);
    });
  });

  describe('Event Validation', () => {
    it('should validate file events correctly', async () => {
      const validFileEvent = eventManager.createFileEvent(
        'file:created',
        { filePath: '/test.js', fileName: 'test.js' }
      );
      
      const result = await eventManager.publishEvent(validFileEvent);
      expect(result).toBe(true);
    });

    it('should reject invalid file events', async () => {
      const invalidEvent = {
        id: 'test',
        type: 'file:created' as const,
        timestamp: new Date().toISOString(),
        data: { fileName: 'test.js' } // Missing required filePath
      };
      
      const result = await eventManager.publishEvent(invalidEvent as FileEvent);
      expect(result).toBe(false);
    });

    it('should reject events with invalid timestamps', async () => {
      const invalidEvent = {
        id: 'test',
        type: 'file:created' as const,
        timestamp: 'invalid-timestamp',
        data: { filePath: '/test.js', fileName: 'test.js' }
      };
      
      const result = await eventManager.publishEvent(invalidEvent as FileEvent);
      expect(result).toBe(false);
    });

    it('should reject events without required fields', async () => {
      const invalidEvent = {
        type: 'file:created' as const,
        data: { filePath: '/test.js', fileName: 'test.js' }
        // Missing id and timestamp
      };
      
      const result = await eventManager.publishEvent(invalidEvent as FileEvent);
      expect(result).toBe(false);
    });
  });

  describe('Event Subscriptions', () => {
    it('should create subscriptions', () => {
      const filter: EventFilter = {
        types: ['file:created', 'file:modified'],
        userId: 'user123'
      };
      
      const subscriptionId = eventManager.subscribe('socket123', filter);
      
      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');
    });

    it('should unsubscribe correctly', () => {
      const filter: EventFilter = { types: ['file:created'] };
      const subscriptionId = eventManager.subscribe('socket123', filter);
      
      const removed = eventManager.unsubscribe(subscriptionId);
      expect(removed).toBe(true);
      
      // Try to remove again
      const removedAgain = eventManager.unsubscribe(subscriptionId);
      expect(removedAgain).toBe(false);
    });

    it('should remove all subscriptions for a socket', () => {
      const filter1: EventFilter = { types: ['file:created'] };
      const filter2: EventFilter = { types: ['user:joined'] };
      
      eventManager.subscribe('socket123', filter1);
      eventManager.subscribe('socket123', filter2);
      eventManager.subscribe('socket456', filter1);
      
      const removed = eventManager.unsubscribeSocket('socket123');
      expect(removed).toBe(2);
    });
  });

  describe('Event Filtering', () => {
    let fileEvent: FileEvent;
    let userEvent: UserActionEvent;
    
    beforeEach(async () => {
      fileEvent = eventManager.createFileEvent(
        'file:created',
        { filePath: '/test.js', fileName: 'test.js' },
        { userId: 'user123', sessionId: 'session456' }
      );
      
      userEvent = eventManager.createUserActionEvent(
        'user:joined',
        { userId: 'user789', action: 'joined' },
        { userId: 'user789', sessionId: 'session456' }
      );
      
      await eventManager.publishEvent(fileEvent);
      await eventManager.publishEvent(userEvent);
    });

    it('should filter events by type', () => {
      const history = eventManager.getEventHistory({
        types: ['file:created']
      });
      
      expect(history.events).toHaveLength(1);
      expect(history.events[0].type).toBe('file:created');
    });

    it('should filter events by user', () => {
      const history = eventManager.getEventHistory({
        userId: 'user123'
      });
      
      expect(history.events).toHaveLength(1);
      expect(history.events[0].userId).toBe('user123');
    });

    it('should filter events by session', () => {
      const history = eventManager.getEventHistory({
        sessionId: 'session456'
      });
      
      expect(history.events).toHaveLength(2);
      expect(history.events.every(e => e.sessionId === 'session456')).toBe(true);
    });

    it('should filter events by file path', () => {
      const history = eventManager.getEventHistory({
        filePath: '/test.js'
      });
      
      expect(history.events).toHaveLength(1);
      expect((history.events[0] as FileEvent).data.filePath).toBe('/test.js');
    });

    it('should filter events by date range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      
      const history = eventManager.getEventHistory({
        dateRange: {
          start: oneHourAgo,
          end: oneHourFromNow
        }
      });
      
      expect(history.events).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      const history = eventManager.getEventHistory({
        types: ['file:created'],
        userId: 'user123',
        sessionId: 'session456'
      });
      
      expect(history.events).toHaveLength(1);
      expect(history.events[0].type).toBe('file:created');
      expect(history.events[0].userId).toBe('user123');
    });
  });

  describe('Event History Management', () => {
    beforeEach(async () => {
      // Add multiple events to history
      for (let i = 0; i < 10; i++) {
        const event = eventManager.createFileEvent(
          'file:created',
          { filePath: `/test${i}.js`, fileName: `test${i}.js` },
          { userId: `user${i}` }
        );
        await eventManager.publishEvent(event);
      }
    });

    it('should return paginated history', () => {
      const page1 = eventManager.getEventHistory(undefined, 1, 5);
      const page2 = eventManager.getEventHistory(undefined, 2, 5);
      
      expect(page1.events).toHaveLength(5);
      expect(page2.events).toHaveLength(5);
      expect(page1.page).toBe(1);
      expect(page2.page).toBe(2);
      expect(page1.pageSize).toBe(5);
      expect(page1.totalCount).toBe(10);
      expect(page1.hasMore).toBe(true);
      expect(page2.hasMore).toBe(false);
    });

    it('should sort events by timestamp (newest first)', () => {
      const history = eventManager.getEventHistory();
      
      for (let i = 0; i < history.events.length - 1; i++) {
        const current = new Date(history.events[i].timestamp);
        const next = new Date(history.events[i + 1].timestamp);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should maintain history size limit', async () => {
      // EventManager was created with maxHistorySize = 100
      // Add 50 more events to exceed the limit
      for (let i = 10; i < 150; i++) {
        const event = eventManager.createFileEvent(
          'file:created',
          { filePath: `/test${i}.js`, fileName: `test${i}.js` }
        );
        await eventManager.publishEvent(event);
      }
      
      const history = eventManager.getEventHistory();
      expect(history.totalCount).toBe(100); // Should be limited to maxHistorySize
    });
  });

  describe('Event Replay', () => {
    let mockSocket: any;

    beforeEach(async () => {
      mockSocket = {
        emit: vi.fn()
      };
      
      // Mock io.sockets.sockets.get to return our mock socket
      vi.spyOn(io.sockets.sockets, 'get').mockReturnValue(mockSocket as any);
      
      // Add some events
      const event1 = eventManager.createFileEvent(
        'file:created',
        { filePath: '/test1.js', fileName: 'test1.js' },
        { userId: 'user1' }
      );
      const event2 = eventManager.createUserActionEvent(
        'user:joined',
        { userId: 'user1', action: 'joined' }
      );
      
      await eventManager.publishEvent(event1);
      await eventManager.publishEvent(event2);
    });

    it('should replay all events', async () => {
      const count = await eventManager.replayEvents('socket123');
      
      expect(count).toBe(2);
      expect(mockSocket.emit).toHaveBeenCalledWith('event-replay-start', { count: 2 });
      expect(mockSocket.emit).toHaveBeenCalledWith('event-replay-end');
      expect(mockSocket.emit).toHaveBeenCalledWith('app-event', expect.any(Object));
    });

    it('should replay filtered events', async () => {
      const count = await eventManager.replayEvents('socket123', {
        types: ['file:created']
      });
      
      expect(count).toBe(1);
      expect(mockSocket.emit).toHaveBeenCalledWith('event-replay-start', { count: 1 });
    });

    it('should replay events from specific time', async () => {
      const futureTime = new Date(Date.now() + 60000); // 1 minute in future
      const count = await eventManager.replayEvents('socket123', undefined, futureTime);
      
      expect(count).toBe(0); // No events should match future time
    });

    it('should return 0 for non-existent socket', async () => {
      vi.spyOn(io.sockets.sockets, 'get').mockReturnValue(undefined);
      
      const count = await eventManager.replayEvents('non-existent-socket');
      expect(count).toBe(0);
    });
  });

  describe('Middleware System', () => {
    it('should execute middleware in order', async () => {
      const middleware1 = vi.fn().mockResolvedValue(true);
      const middleware2 = vi.fn().mockResolvedValue(true);
      const middleware3 = vi.fn().mockResolvedValue(true);
      
      eventManager.addMiddleware(middleware1);
      eventManager.addMiddleware(middleware2);
      eventManager.addMiddleware(middleware3);
      
      const event = eventManager.createFileEvent(
        'file:created',
        { filePath: '/test.js', fileName: 'test.js' }
      );
      
      await eventManager.publishEvent(event);
      
      expect(middleware1).toHaveBeenCalledWith(event, undefined);
      expect(middleware2).toHaveBeenCalledWith(event, undefined);
      expect(middleware3).toHaveBeenCalledWith(event, undefined);
    });

    it('should block event if middleware returns false', async () => {
      const middleware1 = vi.fn().mockResolvedValue(true);
      const middleware2 = vi.fn().mockResolvedValue(false); // Block event
      const middleware3 = vi.fn().mockResolvedValue(true);
      
      eventManager.addMiddleware(middleware1);
      eventManager.addMiddleware(middleware2);
      eventManager.addMiddleware(middleware3);
      
      const event = eventManager.createFileEvent(
        'file:created',
        { filePath: '/test.js', fileName: 'test.js' }
      );
      
      const result = await eventManager.publishEvent(event);
      
      expect(result).toBe(false);
      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
      expect(middleware3).not.toHaveBeenCalled(); // Should not be called after block
      
      // Event should not be in history
      const history = eventManager.getEventHistory();
      expect(history.totalCount).toBe(0);
    });

    it('should handle middleware errors gracefully', async () => {
      const middleware1 = vi.fn().mockResolvedValue(true);
      const middleware2 = vi.fn().mockRejectedValue(new Error('Middleware error'));
      
      eventManager.addMiddleware(middleware1);
      eventManager.addMiddleware(middleware2);
      
      const event = eventManager.createFileEvent(
        'file:created',
        { filePath: '/test.js', fileName: 'test.js' }
      );
      
      const result = await eventManager.publishEvent(event);
      expect(result).toBe(false); // Should fail due to error
    });

    it('should remove middleware correctly', async () => {
      const middleware1 = vi.fn().mockResolvedValue(true);
      const middleware2 = vi.fn().mockResolvedValue(true);
      
      eventManager.addMiddleware(middleware1);
      eventManager.addMiddleware(middleware2);
      eventManager.removeMiddleware(middleware1);
      
      const event = eventManager.createFileEvent(
        'file:created',
        { filePath: '/test.js', fileName: 'test.js' }
      );
      
      await eventManager.publishEvent(event);
      
      expect(middleware1).not.toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      // Add various events
      await eventManager.publishEvent(eventManager.createFileEvent(
        'file:created',
        { filePath: '/test1.js', fileName: 'test1.js' }
      ));
      await eventManager.publishEvent(eventManager.createFileEvent(
        'file:modified',
        { filePath: '/test2.js', fileName: 'test2.js' }
      ));
      await eventManager.publishEvent(eventManager.createUserActionEvent(
        'user:joined',
        { userId: 'user1', action: 'joined' }
      ));
    });

    it('should provide accurate statistics', () => {
      const stats = eventManager.getEventStats();
      
      expect(stats.totalEvents).toBe(3);
      expect(stats.activeSubscriptions).toBe(0);
      expect(stats.eventsByType.get('file:created')).toBe(1);
      expect(stats.eventsByType.get('file:modified')).toBe(1);
      expect(stats.eventsByType.get('user:joined')).toBe(1);
      expect(stats.historySize).toBe(3);
      expect(stats.maxHistorySize).toBe(100);
    });

    it('should track subscriptions in stats', () => {
      eventManager.subscribe('socket1', { types: ['file:created'] });
      eventManager.subscribe('socket2', { types: ['user:joined'] });
      
      const stats = eventManager.getEventStats();
      expect(stats.activeSubscriptions).toBe(2);
    });

    it('should provide recent activity', () => {
      const stats = eventManager.getEventStats();
      expect(stats.recentActivity).toHaveLength(3);
      expect(stats.recentActivity.every(event => 
        new Date(event.timestamp).getTime() > Date.now() - 5 * 60 * 1000
      )).toBe(true);
    });
  });

  describe('Cleanup Operations', () => {
    beforeEach(async () => {
      // Add events with different timestamps
      const oldEvent = eventManager.createFileEvent(
        'file:created',
        { filePath: '/old.js', fileName: 'old.js' }
      );
      oldEvent.timestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      
      const newEvent = eventManager.createFileEvent(
        'file:created',
        { filePath: '/new.js', fileName: 'new.js' }
      );
      
      await eventManager.publishEvent(oldEvent);
      await eventManager.publishEvent(newEvent);
    });

    it('should cleanup old events', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const removed = eventManager.cleanupHistory(oneHourAgo);
      
      expect(removed).toBe(1); // Should remove the old event
      
      const history = eventManager.getEventHistory();
      expect(history.totalCount).toBe(1);
    });

    it('should cleanup inactive subscriptions', () => {
      // Create subscriptions
      eventManager.subscribe('active-socket', { types: ['file:created'] });
      eventManager.subscribe('inactive-socket', { types: ['user:joined'] });
      
      // Mock io to return socket for active but not inactive
      vi.spyOn(io.sockets.sockets, 'get')
        .mockImplementation((socketId: string) => {
          if (socketId === 'active-socket') {
            return { id: socketId } as any;
          }
          return undefined;
        });
      
      const removed = eventManager.cleanupInactiveSubscriptions();
      expect(removed).toBe(1); // Should remove inactive subscription
      
      const stats = eventManager.getEventStats();
      expect(stats.activeSubscriptions).toBe(1);
    });
  });
});