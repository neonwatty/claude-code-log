import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { randomUUID } from 'crypto';
import WebSocketBranchNotificationService from '../websocket-branch-notifications';
import SessionStateManager, { SessionData } from '../session-state';
import { EventManager } from '../eventManager';
import { TypedSocket, SessionBranchEvent } from '../../types/websocket';

// Mock socket.io
vi.mock('socket.io', () => ({
  Server: vi.fn(() => ({
    to: vi.fn(() => ({
      emit: vi.fn()
    })),
    emit: vi.fn(),
    engine: {
      clientsCount: 0
    }
  }))
}));

describe('WebSocketBranchNotificationService', () => {
  let mockIO: any;
  let mockSessionStateManager: vi.Mocked<SessionStateManager>;
  let mockEventManager: vi.Mocked<EventManager>;
  let service: WebSocketBranchNotificationService;

  const mockParentSession: SessionData = {
    id: 'parent-session-123',
    workingDirectory: '/test/project',
    environment: { NODE_ENV: 'test' },
    commandHistory: [],
    status: 'active',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    lastActiveAt: new Date('2024-01-01T10:05:00Z'),
  };

  const mockBranchSession: SessionData = {
    id: 'branch-session-456',
    parentSessionId: 'parent-session-123',
    branchPoint: 2,
    branchTimestamp: new Date('2024-01-01T11:00:00Z'),
    branchMetadata: {
      branchName: 'alternative-approach',
      branchReason: 'Testing different implementation',
      originalMessage: 'Original assistant message',
    },
    workingDirectory: '/test/project',
    environment: { NODE_ENV: 'test' },
    commandHistory: [],
    status: 'active',
    createdAt: new Date('2024-01-01T11:00:00Z'),
    lastActiveAt: new Date('2024-01-01T11:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock IO
    mockIO = {
      to: vi.fn(() => ({
        emit: vi.fn()
      })),
      emit: vi.fn(),
      engine: {
        clientsCount: 0
      }
    };
    vi.mocked(SocketIOServer).mockReturnValue(mockIO);

    // Create mock SessionStateManager
    mockSessionStateManager = {
      on: vi.fn(),
      removeAllListeners: vi.fn(),
      getBranchTree: vi.fn(),
      getRootSessionId: vi.fn(),
    } as any;

    // Create mock EventManager
    mockEventManager = {
      publishEvent: vi.fn(),
    } as any;

    // Create service
    service = new WebSocketBranchNotificationService(
      mockIO,
      mockSessionStateManager,
      mockEventManager
    );
  });

  afterEach(() => {
    if (service.isInitialized()) {
      service.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize event listeners', () => {
      expect(service.isInitialized()).toBe(false);

      service.initialize();

      expect(service.isInitialized()).toBe(true);
      expect(mockSessionStateManager.on).toHaveBeenCalledWith('session-branched', expect.any(Function));
      expect(mockSessionStateManager.on).toHaveBeenCalledWith('branch-tree-updated', expect.any(Function));
    });

    it('should not initialize twice', () => {
      service.initialize();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      service.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('WebSocketBranchNotificationService already initialized');
      consoleSpy.mockRestore();
    });
  });

  describe('Session Branched Notifications', () => {
    beforeEach(() => {
      service.initialize();
      
      // Mock branch tree methods
      mockSessionStateManager.getRootSessionId.mockReturnValue('parent-session-123');
      mockSessionStateManager.getBranchTree.mockReturnValue({
        root: mockParentSession,
        branches: new Map([
          ['parent-session-123', [mockBranchSession]]
        ])
      });
    });

    it('should handle session-branched event', async () => {
      // Get the event handler that was registered
      const sessionBranchedHandler = mockSessionStateManager.on.mock.calls
        .find(call => call[0] === 'session-branched')?.[1];
      
      expect(sessionBranchedHandler).toBeDefined();

      // Call the handler
      await sessionBranchedHandler(mockParentSession, mockBranchSession);

      // Verify WebSocket emissions
      expect(mockIO.to).toHaveBeenCalledWith('session:parent-session-123');
      expect(mockIO.to).toHaveBeenCalledWith('session:branch-session-456');
      expect(mockIO.emit).toHaveBeenCalledWith('session-branched', expect.objectContaining({
        parentSessionId: 'parent-session-123',
        branchSession: expect.objectContaining({
          id: 'branch-session-456',
          parentSessionId: 'parent-session-123',
          branchPoint: 2,
        }),
        affectedSessions: expect.arrayContaining(['parent-session-123', 'branch-session-456']),
      }));

      // Verify EventManager call
      expect(mockEventManager.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session:branched',
          data: expect.objectContaining({
            sessionId: 'branch-session-456',
            parentSessionId: 'parent-session-123',
          }),
        })
      );
    });

    it('should handle errors in session-branched handler gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Make getBranchTree throw an error
      mockSessionStateManager.getBranchTree.mockImplementation(() => {
        throw new Error('Branch tree error');
      });

      // Get the event handler
      const sessionBranchedHandler = mockSessionStateManager.on.mock.calls
        .find(call => call[0] === 'session-branched')?.[1];
      
      // Call the handler - should not throw
      await sessionBranchedHandler(mockParentSession, mockBranchSession);

      // Should still emit notifications with minimal affected sessions
      expect(mockIO.emit).toHaveBeenCalledWith('session-branched', expect.objectContaining({
        parentSessionId: 'parent-session-123',
        affectedSessions: expect.arrayContaining(['parent-session-123', 'branch-session-456']),
      }));

      consoleSpy.mockRestore();
    });
  });

  describe('Branch Tree Updated Notifications', () => {
    beforeEach(() => {
      service.initialize();
      
      // Mock branch tree
      mockSessionStateManager.getBranchTree.mockReturnValue({
        root: mockParentSession,
        branches: new Map([
          ['parent-session-123', [mockBranchSession]]
        ])
      });
    });

    it('should handle branch-tree-updated event', async () => {
      const branchData = {
        parentId: 'parent-session-123',
        childId: 'branch-session-456',
        branchPoint: 2,
      };

      // Get the event handler
      const branchTreeUpdatedHandler = mockSessionStateManager.on.mock.calls
        .find(call => call[0] === 'branch-tree-updated')?.[1];
      
      expect(branchTreeUpdatedHandler).toBeDefined();

      // Call the handler
      await branchTreeUpdatedHandler('parent-session-123', branchData);

      // Verify WebSocket emissions
      expect(mockIO.to).toHaveBeenCalledWith('session:parent-session-123');
      expect(mockIO.to).toHaveBeenCalledWith('session:branch-session-456');
      expect(mockIO.emit).toHaveBeenCalledWith('branch-tree-updated', expect.objectContaining({
        rootSessionId: 'parent-session-123',
        branchData: {
          parentId: 'parent-session-123',
          childId: 'branch-session-456',
          branchPoint: 2,
        },
        affectedSessions: expect.arrayContaining(['parent-session-123', 'branch-session-456']),
      }));

      // Verify EventManager call
      expect(mockEventManager.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session:branch-tree-updated',
          data: expect.objectContaining({
            sessionId: 'parent-session-123',
            rootSessionId: 'parent-session-123',
            branchData,
          }),
        })
      );
    });
  });

  describe('Manual Notification Methods', () => {
    beforeEach(() => {
      service.initialize();
      mockSessionStateManager.getRootSessionId.mockReturnValue('parent-session-123');
      mockSessionStateManager.getBranchTree.mockReturnValue({
        root: mockParentSession,
        branches: new Map([
          ['parent-session-123', [mockBranchSession]]
        ])
      });
    });

    it('should manually notify branch created', async () => {
      await service.notifyBranchCreated(mockParentSession, mockBranchSession);

      expect(mockIO.emit).toHaveBeenCalledWith('session-branched', expect.objectContaining({
        parentSessionId: 'parent-session-123',
        branchSession: expect.objectContaining({
          id: 'branch-session-456',
        }),
      }));
    });

    it('should manually notify branch tree updated', async () => {
      const branchData = {
        parentId: 'parent-session-123',
        childId: 'branch-session-456',
        branchPoint: 2,
      };

      await service.notifyBranchTreeUpdated('parent-session-123', branchData);

      expect(mockIO.emit).toHaveBeenCalledWith('branch-tree-updated', expect.objectContaining({
        rootSessionId: 'parent-session-123',
        branchData,
      }));
    });
  });

  describe('Service Without EventManager', () => {
    beforeEach(() => {
      // Create service without EventManager
      service = new WebSocketBranchNotificationService(
        mockIO,
        mockSessionStateManager
        // No EventManager
      );
      service.initialize();

      mockSessionStateManager.getRootSessionId.mockReturnValue('parent-session-123');
      mockSessionStateManager.getBranchTree.mockReturnValue({
        root: mockParentSession,
        branches: new Map()
      });
    });

    it('should work without EventManager', async () => {
      const sessionBranchedHandler = mockSessionStateManager.on.mock.calls
        .find(call => call[0] === 'session-branched')?.[1];
      
      // Should not throw when EventManager is not available
      await sessionBranchedHandler(mockParentSession, mockBranchSession);

      // Should still emit WebSocket notifications
      expect(mockIO.emit).toHaveBeenCalledWith('session-branched', expect.any(Object));
    });
  });

  describe('Stats and Shutdown', () => {
    it('should return correct stats', () => {
      const stats = service.getStats();
      
      expect(stats).toEqual({
        initialized: false,
        connectedClients: 0,
        hasEventManager: true,
      });

      service.initialize();
      
      const statsAfterInit = service.getStats();
      expect(statsAfterInit.initialized).toBe(true);
    });

    it('should shutdown properly', () => {
      service.initialize();
      expect(service.isInitialized()).toBe(true);

      service.shutdown();

      expect(service.isInitialized()).toBe(false);
      expect(mockSessionStateManager.removeAllListeners).toHaveBeenCalledWith('session-branched');
      expect(mockSessionStateManager.removeAllListeners).toHaveBeenCalledWith('branch-tree-updated');
    });

    it('should handle shutdown when not initialized', () => {
      expect(service.isInitialized()).toBe(false);
      
      // Should not throw
      service.shutdown();
      
      expect(mockSessionStateManager.removeAllListeners).not.toHaveBeenCalled();
    });
  });

  describe('Affected Sessions Logic', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should determine affected sessions from branch tree', async () => {
      // Mock a complex branch tree
      const complexBranchTree = {
        root: mockParentSession,
        branches: new Map([
          ['parent-session-123', [mockBranchSession, { ...mockBranchSession, id: 'branch-session-789' }]],
          ['branch-session-456', [{ ...mockBranchSession, id: 'nested-branch-999' }]]
        ])
      };

      mockSessionStateManager.getRootSessionId.mockReturnValue('parent-session-123');
      mockSessionStateManager.getBranchTree.mockReturnValue(complexBranchTree);

      const sessionBranchedHandler = mockSessionStateManager.on.mock.calls
        .find(call => call[0] === 'session-branched')?.[1];
      
      await sessionBranchedHandler(mockParentSession, mockBranchSession);

      // Should include all sessions in the tree
      expect(mockIO.emit).toHaveBeenCalledWith('session-branched', 
        expect.objectContaining({
          affectedSessions: expect.arrayContaining([
            'parent-session-123',
            'branch-session-456', 
            'branch-session-789',
            'nested-branch-999'
          ])
        })
      );
    });

    it('should handle minimal affected sessions when branch tree fails', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      mockSessionStateManager.getRootSessionId.mockImplementation(() => {
        throw new Error('Failed to get root');
      });

      const sessionBranchedHandler = mockSessionStateManager.on.mock.calls
        .find(call => call[0] === 'session-branched')?.[1];
      
      await sessionBranchedHandler(mockParentSession, mockBranchSession);

      // Should include at least parent and branch sessions
      expect(mockIO.emit).toHaveBeenCalledWith('session-branched', 
        expect.objectContaining({
          affectedSessions: expect.arrayContaining([
            'parent-session-123',
            'branch-session-456'
          ])
        })
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'Could not determine full branch tree, using minimal affected sessions:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});