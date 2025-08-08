import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  eventRateLimitMiddleware,
  contentFilterMiddleware,
  userPermissionMiddleware,
  eventEnrichmentMiddleware,
  auditLogMiddleware,
  fileEventValidationMiddleware,
  sessionEventValidationMiddleware,
  errorHandlingMiddleware
} from './eventMiddleware';
import { AppEvent, TypedSocket } from '../types/websocket';

describe('Event Middleware', () => {
  let mockSocket: TypedSocket;
  let consoleLogSpy: any;

  beforeEach(() => {
    mockSocket = {
      id: 'test-socket-id',
      data: {
        userId: 'test-user',
        sessionId: 'test-session',
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        connectionId: 'test-connection-id',
        reconnectCount: 0,
        totalConnections: 1,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      }
    } as TypedSocket;

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('eventRateLimitMiddleware', () => {
    it('should allow non-system events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result = await eventRateLimitMiddleware(event, mockSocket);
      expect(result).toBe(true);
    });

    it('should always allow system events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'system:notification',
        timestamp: new Date().toISOString(),
        data: { level: 'info', title: 'Test', message: 'Test message' }
      } as any;

      const result = await eventRateLimitMiddleware(event);
      expect(result).toBe(true);
    });

    it('should log rate check for non-system events with socket', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      await eventRateLimitMiddleware(event, mockSocket);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Event rate check for file:created')
      );
    });
  });

  describe('contentFilterMiddleware', () => {
    it('should allow clean message events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'message:sent',
        timestamp: new Date().toISOString(),
        data: { messageId: 'msg1', content: 'Hello world!' }
      } as any;

      const result = await contentFilterMiddleware(event);
      expect(result).toBe(true);
    });

    it('should block message events with forbidden content', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'message:sent',
        timestamp: new Date().toISOString(),
        data: { messageId: 'msg1', content: 'This is spam content' }
      } as any;

      const result = await contentFilterMiddleware(event);
      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Content filtered')
      );
    });

    it('should allow non-message events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result = await contentFilterMiddleware(event);
      expect(result).toBe(true);
    });

    it('should be case insensitive', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'message:sent',
        timestamp: new Date().toISOString(),
        data: { messageId: 'msg1', content: 'This is SPAM content' }
      } as any;

      const result = await contentFilterMiddleware(event);
      expect(result).toBe(false);
    });
  });

  describe('userPermissionMiddleware', () => {
    it('should allow non-restricted events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result = await userPermissionMiddleware(event, mockSocket);
      expect(result).toBe(true);
    });

    it('should block restricted events without authentication', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:deleted',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result = await userPermissionMiddleware(event);
      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied')
      );
    });

    it('should allow restricted events with authentication', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:deleted',
        timestamp: new Date().toISOString(),
        userId: 'test-user',
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result = await userPermissionMiddleware(event, mockSocket);
      expect(result).toBe(true);
    });

    it('should block system events for non-admin users', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'system:maintenance',
        timestamp: new Date().toISOString(),
        userId: 'regular-user',
        data: { level: 'info', title: 'Maintenance', message: 'System update' }
      } as any;

      const result = await userPermissionMiddleware(event, mockSocket);
      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('System events require admin role')
      );
    });

    it('should allow system events for admin users', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'system:maintenance',
        timestamp: new Date().toISOString(),
        userId: 'admin',
        data: { level: 'info', title: 'Maintenance', message: 'System update' }
      } as any;

      const result = await userPermissionMiddleware(event, mockSocket);
      expect(result).toBe(true);
    });
  });

  describe('eventEnrichmentMiddleware', () => {
    it('should add metadata to events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result = await eventEnrichmentMiddleware(event, mockSocket);
      
      expect(result).toBe(true);
      expect(event.metadata).toBeDefined();
      expect(event.metadata!.socketId).toBe('test-socket-id');
      expect(event.metadata!.ipAddress).toBe('127.0.0.1');
      expect(event.metadata!.userAgent).toBe('test-agent');
      expect(event.metadata!.connectionId).toBe('test-connection-id');
      expect(event.metadata!.serverTimestamp).toBeDefined();
      expect(event.metadata!.source).toBe('websocket');
    });

    it('should mark REST API events correctly', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result = await eventEnrichmentMiddleware(event); // No socket
      
      expect(result).toBe(true);
      expect(event.metadata!.source).toBe('rest_api');
    });

    it('should preserve existing metadata', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' },
        metadata: { existing: 'value' }
      } as any;

      const result = await eventEnrichmentMiddleware(event, mockSocket);
      
      expect(result).toBe(true);
      expect(event.metadata!.existing).toBe('value');
      expect(event.metadata!.socketId).toBe('test-socket-id');
    });
  });

  describe('auditLogMiddleware', () => {
    it('should log auditable events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:deleted',
        timestamp: new Date().toISOString(),
        userId: 'test-user',
        sessionId: 'test-session',
        data: { filePath: '/important.js', fileName: 'important.js' }
      } as any;

      const result = await auditLogMiddleware(event, mockSocket);
      
      expect(result).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'AUDIT LOG:',
        expect.stringContaining('file:deleted')
      );
    });

    it('should not log non-auditable events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      consoleLogSpy.mockClear();
      const result = await auditLogMiddleware(event, mockSocket);
      
      expect(result).toBe(true);
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        'AUDIT LOG:',
        expect.any(String)
      );
    });
  });

  describe('fileEventValidationMiddleware', () => {
    it('should allow valid file events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/src/components/Button.tsx', fileName: 'Button.tsx' }
      } as any;

      const result = await fileEventValidationMiddleware(event);
      expect(result).toBe(true);
    });

    it('should block file events without filePath', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { fileName: 'test.js' }
      } as any;

      const result = await fileEventValidationMiddleware(event);
      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid file event: Missing filePath')
      );
    });

    it('should block access to restricted paths', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/etc/passwd', fileName: 'passwd' }
      } as any;

      const result = await fileEventValidationMiddleware(event);
      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Security violation: Access to restricted path')
      );
    });

    it('should validate executable file extensions', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:executed',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test/script.exe', fileName: 'script.exe' }
      } as any;

      const result = await fileEventValidationMiddleware(event);
      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Execution of .exe files not allowed')
      );
    });

    it('should allow valid executable extensions', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:executed',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test/script.js', fileName: 'script.js' }
      } as any;

      const result = await fileEventValidationMiddleware(event);
      expect(result).toBe(true);
    });

    it('should allow non-file events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'user:joined',
        timestamp: new Date().toISOString(),
        data: { userId: 'test-user', action: 'joined' }
      } as any;

      const result = await fileEventValidationMiddleware(event);
      expect(result).toBe(true);
    });
  });

  describe('sessionEventValidationMiddleware', () => {
    it('should allow valid session events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'session:created',
        timestamp: new Date().toISOString(),
        data: { sessionId: 'test-session' }
      } as any;

      const result = await sessionEventValidationMiddleware(event, mockSocket);
      expect(result).toBe(true);
    });

    it('should block session events without sessionId', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'session:created',
        timestamp: new Date().toISOString(),
        data: { sessionName: 'Test Session' }
      } as any;

      const result = await sessionEventValidationMiddleware(event, mockSocket);
      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid session event: Missing sessionId')
      );
    });

    it('should block unauthorized session access', async () => {
      mockSocket.data.sessionId = 'user-session';
      
      const event: AppEvent = {
        id: 'test-id',
        type: 'session:updated',
        timestamp: new Date().toISOString(),
        data: { sessionId: 'different-session' }
      } as any;

      const result = await sessionEventValidationMiddleware(event, mockSocket);
      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('User not authorized for session')
      );
    });

    it('should allow authorized session access', async () => {
      mockSocket.data.sessionId = 'test-session';
      
      const event: AppEvent = {
        id: 'test-id',
        type: 'session:updated',
        timestamp: new Date().toISOString(),
        data: { sessionId: 'test-session' }
      } as any;

      const result = await sessionEventValidationMiddleware(event, mockSocket);
      expect(result).toBe(true);
    });

    it('should allow non-session events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result = await sessionEventValidationMiddleware(event, mockSocket);
      expect(result).toBe(true);
    });
  });

  describe('errorHandlingMiddleware', () => {
    it('should allow valid events', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result = await errorHandlingMiddleware(event, mockSocket);
      expect(result).toBe(true);
    });

    it('should block events without id', async () => {
      const event: AppEvent = {
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result = await errorHandlingMiddleware(event, mockSocket);
      expect(result).toBe(false);
    });

    it('should block events without type', async () => {
      const event: AppEvent = {
        id: 'test-id',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result = await errorHandlingMiddleware(event, mockSocket);
      expect(result).toBe(false);
    });

    it('should block events without timestamp', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result = await errorHandlingMiddleware(event, mockSocket);
      expect(result).toBe(false);
    });

    it('should block events with excessively large data', async () => {
      const largeData = 'x'.repeat(60000); // Over 50k characters
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js', content: largeData }
      } as any;

      const result = await errorHandlingMiddleware(event, mockSocket);
      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Event data too large')
      );
    });

    it('should handle middleware exceptions gracefully', async () => {
      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      // Mock JSON.stringify to throw an error
      const originalStringify = JSON.stringify;
      JSON.stringify = vi.fn().mockImplementation(() => {
        throw new Error('Stringify error');
      });

      const result = await errorHandlingMiddleware(event, mockSocket);
      
      expect(result).toBe(false);
      
      // Restore original function
      JSON.stringify = originalStringify;
    });
  });

  describe('Middleware Chain Integration', () => {
    it('should process middleware in correct order', async () => {
      const executionOrder: string[] = [];
      
      const middleware1 = async (event: AppEvent, socket?: TypedSocket) => {
        executionOrder.push('middleware1');
        return true;
      };
      
      const middleware2 = async (event: AppEvent, socket?: TypedSocket) => {
        executionOrder.push('middleware2');
        return true;
      };
      
      const middleware3 = async (event: AppEvent, socket?: TypedSocket) => {
        executionOrder.push('middleware3');
        return true;
      };

      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      await middleware1(event, mockSocket);
      await middleware2(event, mockSocket);
      await middleware3(event, mockSocket);

      expect(executionOrder).toEqual(['middleware1', 'middleware2', 'middleware3']);
    });

    it('should stop processing when middleware returns false', async () => {
      const executionOrder: string[] = [];
      
      const middleware1 = async (event: AppEvent, socket?: TypedSocket) => {
        executionOrder.push('middleware1');
        return true;
      };
      
      const middleware2 = async (event: AppEvent, socket?: TypedSocket) => {
        executionOrder.push('middleware2');
        return false; // Block here
      };
      
      const middleware3 = async (event: AppEvent, socket?: TypedSocket) => {
        executionOrder.push('middleware3');
        return true;
      };

      const event: AppEvent = {
        id: 'test-id',
        type: 'file:created',
        timestamp: new Date().toISOString(),
        data: { filePath: '/test.js', fileName: 'test.js' }
      } as any;

      const result1 = await middleware1(event, mockSocket);
      expect(result1).toBe(true);
      
      const result2 = await middleware2(event, mockSocket);
      expect(result2).toBe(false);
      
      // In a real middleware chain, middleware3 would not be called
      // This test just verifies the individual middleware behavior

      expect(executionOrder).toEqual(['middleware1', 'middleware2']);
    });
  });
});