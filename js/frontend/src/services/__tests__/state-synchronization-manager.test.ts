import { StateSynchronizationManager } from '../state-synchronization-manager';
import { SessionSummary } from '../../components/types/session-types';

// Mock SessionSummary for testing
const createMockSession = (id: string, overrides?: Partial<SessionSummary>): SessionSummary => ({
  sessionId: id,
  title: `Session ${id}`,
  cwd: '/test/path',
  startTime: new Date(),
  endTime: undefined,
  messageCount: 5,
  userMessageCount: 3,
  assistantMessageCount: 2,
  duration: undefined,
  isActive: true,
  tags: [],
  summary: `Test session ${id}`,
  tokenUsage: {
    inputTokens: 100,
    outputTokens: 150,
    totalTokens: 250,
  },
  ...overrides
});

describe('StateSynchronizationManager', () => {
  let stateManager: StateSynchronizationManager;
  let eventSpy: jest.SpyInstance;

  beforeEach(() => {
    stateManager = new StateSynchronizationManager({
      maxQueueSize: 10,
      syncTimeoutMs: 5000,
      checksumEnabled: true,
      conflictResolutionStrategy: 'server-wins',
      snapshotIntervalMs: 1000,
      maxSnapshots: 5
    });

    eventSpy = jest.spyOn(stateManager, 'dispatchEvent');
  });

  afterEach(() => {
    stateManager.dispose();
    eventSpy.mockRestore();
  });

  describe('Basic State Management', () => {
    test('should initialize with empty state', () => {
      const state = stateManager.getState();
      
      expect(state.sessions.size).toBe(0);
      expect(state.subscriptions.size).toBe(0);
      expect(Object.keys(state.userPreferences)).toHaveLength(0);
      expect(state.activeSessionId).toBe(null);
      expect(state.version).toBe(1);
    });

    test('should update session state', () => {
      const session = createMockSession('test-1');
      stateManager.updateSession(session.sessionId, session);

      const state = stateManager.getState();
      expect(state.sessions.has('test-1')).toBe(true);
      expect(state.sessions.get('test-1')).toEqual(session);
      expect(state.version).toBe(2);
    });

    test('should remove session from state', () => {
      const session = createMockSession('test-1');
      stateManager.updateSession(session.sessionId, session);
      stateManager.removeSession(session.sessionId);

      const state = stateManager.getState();
      expect(state.sessions.has('test-1')).toBe(false);
      expect(state.version).toBe(3);
    });

    test('should manage subscriptions', () => {
      stateManager.addSubscription('sub-1');
      stateManager.addSubscription('sub-2');

      let state = stateManager.getState();
      expect(state.subscriptions.has('sub-1')).toBe(true);
      expect(state.subscriptions.has('sub-2')).toBe(true);
      expect(state.version).toBe(3);

      stateManager.removeSubscription('sub-1');
      state = stateManager.getState();
      expect(state.subscriptions.has('sub-1')).toBe(false);
      expect(state.subscriptions.has('sub-2')).toBe(true);
      expect(state.version).toBe(4);
    });

    test('should manage user preferences', () => {
      stateManager.updatePreference('theme', 'dark');
      stateManager.updatePreference('language', 'en');

      const state = stateManager.getState();
      expect(state.userPreferences.theme).toBe('dark');
      expect(state.userPreferences.language).toBe('en');
    });

    test('should set active session', () => {
      stateManager.setActiveSession('session-1');

      const state = stateManager.getState();
      expect(state.activeSessionId).toBe('session-1');
    });
  });

  describe('Event Emission', () => {
    test('should emit state-changed events', () => {
      const session = createMockSession('test-1');
      stateManager.updateSession(session.sessionId, session);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'state-changed',
          detail: expect.objectContaining({
            version: 2
          })
        })
      );
    });

    test('should emit offline-changes-queued when offline', () => {
      // Simulate offline state
      Object.defineProperty(stateManager, 'isOnline', {
        value: false,
        writable: true
      });

      const session = createMockSession('test-1');
      stateManager.updateSession(session.sessionId, session);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'offline-changes-queued'
        })
      );
    });
  });

  describe('State Snapshots', () => {
    test('should create state snapshots', () => {
      const session = createMockSession('test-1');
      stateManager.updateSession(session.sessionId, session);

      const snapshot = stateManager.createSnapshot();
      
      expect(snapshot.version).toBe(2);
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.state.sessions.has('test-1')).toBe(true);
      expect(snapshot.checksum).toBeTruthy();
    });

    test('should restore from snapshot', () => {
      const session = createMockSession('test-1');
      stateManager.updateSession(session.sessionId, session);
      
      const snapshot = stateManager.createSnapshot();
      
      // Make more changes
      stateManager.updateSession('test-2', createMockSession('test-2'));
      stateManager.setActiveSession('test-2');
      
      // Restore from snapshot
      const success = stateManager.restoreFromSnapshot(snapshot);
      
      expect(success).toBe(true);
      const state = stateManager.getState();
      expect(state.sessions.size).toBe(1);
      expect(state.sessions.has('test-1')).toBe(true);
      expect(state.sessions.has('test-2')).toBe(false);
    });

    test('should limit number of snapshots', () => {
      // Create more snapshots than the limit
      for (let i = 0; i < 8; i++) {
        stateManager.updateSession(`test-${i}`, createMockSession(`test-${i}`));
        stateManager.createSnapshot();
      }

      const snapshots = stateManager.getSnapshots();
      expect(snapshots.length).toBe(5); // maxSnapshots limit
    });
  });

  describe('Synchronization', () => {
    test('should detect conflicts', async () => {
      const session = createMockSession('test-1', {
        startTime: new Date('2023-01-01T10:00:00Z')
      });
      stateManager.updateSession(session.sessionId, session);

      const serverState = {
        sessions: {
          'test-1': createMockSession('test-1', {
            startTime: new Date('2023-01-01T11:00:00Z'), // Different time
            title: 'Server Version'
          })
        },
        version: 2
      };

      await stateManager.synchronizeWithServer(serverState, 2);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'state-conflict-detected'
        })
      );
    });

    test('should resolve conflicts with server-wins strategy', async () => {
      const session = createMockSession('test-1', {
        title: 'Client Version'
      });
      stateManager.updateSession(session.sessionId, session);

      const serverSession = createMockSession('test-1', {
        title: 'Server Version'
      });
      const serverState = {
        sessions: {
          'test-1': serverSession
        },
        version: 3
      };

      await stateManager.synchronizeWithServer(serverState, 3);

      const state = stateManager.getState();
      expect(state.sessions.get('test-1')?.title).toBe('Server Version');
    });

    test('should merge server state without conflicts', async () => {
      const serverState = {
        sessions: {
          'server-1': createMockSession('server-1'),
          'server-2': createMockSession('server-2')
        },
        subscriptions: ['sub-1', 'sub-2'],
        userPreferences: {
          theme: 'dark',
          language: 'en'
        },
        version: 5
      };

      await stateManager.synchronizeWithServer(serverState, 5);

      const state = stateManager.getState();
      expect(state.sessions.size).toBe(2);
      expect(state.sessions.has('server-1')).toBe(true);
      expect(state.sessions.has('server-2')).toBe(true);
      expect(state.subscriptions.size).toBe(2);
      expect(state.userPreferences.theme).toBe('dark');
      expect(state.version).toBe(5);
    });
  });

  describe('Sync Status', () => {
    test('should provide sync status', () => {
      const status = stateManager.getSyncStatus();
      
      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('isSyncing');
      expect(status).toHaveProperty('pendingOperations');
      expect(status).toHaveProperty('lastSync');
      expect(status).toHaveProperty('version');
      
      expect(status.isOnline).toBe(true);
      expect(status.isSyncing).toBe(false);
      expect(status.pendingOperations).toBe(0);
      expect(status.version).toBe(1);
    });
  });

  describe('Pending Operations', () => {
    test('should queue operations when offline', () => {
      // Simulate offline state
      Object.defineProperty(stateManager, 'isOnline', {
        value: false,
        writable: true
      });

      stateManager.updateSession('test-1', createMockSession('test-1'));
      stateManager.addSubscription('sub-1');

      const pendingOps = stateManager.getPendingOperations();
      expect(pendingOps.length).toBe(2);
      expect(pendingOps[0].target).toBe('session');
      expect(pendingOps[1].target).toBe('subscription');
    });

    test('should apply pending operations when back online', async () => {
      // Start offline
      Object.defineProperty(stateManager, 'isOnline', {
        value: false,
        writable: true
      });

      stateManager.updateSession('test-1', createMockSession('test-1'));
      
      // Go back online and sync
      Object.defineProperty(stateManager, 'isOnline', {
        value: true,
        writable: true
      });

      await stateManager.synchronizeWithServer({}, 1);

      const state = stateManager.getState();
      expect(state.sessions.has('test-1')).toBe(true);
      expect(stateManager.getPendingOperations().length).toBe(0);
    });

    test('should limit queue size', () => {
      // Simulate offline state
      Object.defineProperty(stateManager, 'isOnline', {
        value: false,
        writable: true
      });

      // Add more operations than the queue limit
      for (let i = 0; i < 15; i++) {
        stateManager.updateSession(`test-${i}`, createMockSession(`test-${i}`));
      }

      const pendingOps = stateManager.getPendingOperations();
      expect(pendingOps.length).toBe(10); // maxQueueSize limit
    });
  });

  describe('Checksum Validation', () => {
    test('should calculate consistent checksums', () => {
      const session = createMockSession('test-1');
      stateManager.updateSession(session.sessionId, session);

      const snapshot1 = stateManager.createSnapshot();
      const snapshot2 = stateManager.createSnapshot();

      expect(snapshot1.checksum).toBe(snapshot2.checksum);
    });

    test('should detect checksum mismatches', () => {
      const session = createMockSession('test-1');
      stateManager.updateSession(session.sessionId, session);

      const snapshot = stateManager.createSnapshot();
      
      // Corrupt the checksum
      snapshot.checksum = 'invalid-checksum';

      const success = stateManager.restoreFromSnapshot(snapshot);
      expect(success).toBe(false);
    });
  });

  describe('Reset and Cleanup', () => {
    test('should reset state to initial values', () => {
      stateManager.updateSession('test-1', createMockSession('test-1'));
      stateManager.addSubscription('sub-1');
      stateManager.updatePreference('theme', 'dark');

      stateManager.reset();

      const state = stateManager.getState();
      expect(state.sessions.size).toBe(0);
      expect(state.subscriptions.size).toBe(0);
      expect(Object.keys(state.userPreferences)).toHaveLength(0);
      expect(state.version).toBe(1);
    });

    test('should cleanup resources on dispose', () => {
      const disposeSpy = jest.spyOn(stateManager, 'dispose');
      stateManager.dispose();
      expect(disposeSpy).toHaveBeenCalled();
    });
  });
});