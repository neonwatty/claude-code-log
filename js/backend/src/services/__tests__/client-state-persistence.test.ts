import ClientStatePersistenceManager, { StateOperation, ClientStateSnapshot } from '../client-state-persistence';

// Mock setTimeout and setInterval for testing
jest.useFakeTimers();

describe('ClientStatePersistenceManager', () => {
  let manager: ClientStatePersistenceManager;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    manager = new ClientStatePersistenceManager({
      snapshotInterval: 1000,
      maxSnapshots: 5,
      maxOperations: 10,
      compressionThreshold: 3,
      cleanupInterval: 5000,
      persistenceTimeout: 1000
    });

    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(async () => {
    await manager.shutdown();
    jest.clearAllTimers();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Snapshot Management', () => {
    test('should create state snapshot', async () => {
      const mockState = {
        sessions: { 'session-1': { title: 'Test Session' } },
        subscriptions: ['sub-1'],
        userPreferences: { theme: 'dark' },
        activeSessionId: 'session-1'
      };

      const snapshotId = await manager.createSnapshot(
        'user-1',
        'socket-1',
        mockState,
        1,
        'token-123'
      );

      expect(snapshotId).toBeTruthy();
      expect(typeof snapshotId).toBe('string');

      const snapshot = manager.getLatestSnapshot('user-1');
      expect(snapshot).toBeTruthy();
      expect(snapshot!.userId).toBe('user-1');
      expect(snapshot!.socketId).toBe('socket-1');
      expect(snapshot!.version).toBe(1);
      expect(snapshot!.reconnectToken).toBe('token-123');
      expect(snapshot!.state).toEqual(mockState);
    });

    test('should limit number of snapshots per user', async () => {
      const mockState = {
        sessions: {},
        subscriptions: [],
        userPreferences: {},
        activeSessionId: null
      };

      // Create more snapshots than the limit
      for (let i = 0; i < 8; i++) {
        await manager.createSnapshot('user-1', 'socket-1', mockState, i + 1);
      }

      const snapshots = manager.getUserSnapshots('user-1');
      expect(snapshots.length).toBe(5); // maxSnapshots limit

      // Check that newest snapshots are kept
      const versions = snapshots.map(s => s.version).sort((a, b) => a - b);
      expect(versions).toEqual([4, 5, 6, 7, 8]);
    });

    test('should delete snapshot by ID', async () => {
      const mockState = { sessions: {}, subscriptions: [], userPreferences: {}, activeSessionId: null };
      
      const snapshotId = await manager.createSnapshot('user-1', 'socket-1', mockState, 1);
      expect(manager.getLatestSnapshot('user-1')).toBeTruthy();

      const deleted = manager.deleteSnapshot(snapshotId);
      expect(deleted).toBe(true);
      expect(manager.getLatestSnapshot('user-1')).toBe(undefined);
    });

    test('should clear all user data', async () => {
      const mockState = { sessions: {}, subscriptions: [], userPreferences: {}, activeSessionId: null };
      
      await manager.createSnapshot('user-1', 'socket-1', mockState, 1);
      manager.addOperation({
        id: 'op-1',
        type: 'add',
        target: 'session',
        targetId: 'session-1',
        payload: { title: 'Test' },
        timestamp: Date.now(),
        version: 2,
        userId: 'user-1'
      });

      expect(manager.getLatestSnapshot('user-1')).toBeTruthy();

      manager.clearUserData('user-1');

      expect(manager.getLatestSnapshot('user-1')).toBe(undefined);
      expect(manager.getUserSnapshots('user-1')).toHaveLength(0);
    });
  });

  describe('State Recovery', () => {
    test('should recover state when no snapshots exist', async () => {
      const result = await manager.recoverState('user-1', 1);
      
      expect(result.needsFullSync).toBe(true);
      expect(result.snapshot).toBe(undefined);
      expect(result.delta).toBe(undefined);
    });

    test('should recover state with exact version match', async () => {
      const mockState = { sessions: {}, subscriptions: [], userPreferences: {}, activeSessionId: null };
      await manager.createSnapshot('user-1', 'socket-1', mockState, 5, 'token-123');

      const result = await manager.recoverState('user-1', 5, 'token-123');
      
      expect(result.needsFullSync).toBe(false);
      expect(result.snapshot).toBeTruthy();
      expect(result.snapshot!.version).toBe(5);
      expect(result.delta).toBe(undefined);
    });

    test('should generate delta when client version is behind', async () => {
      const mockState = { sessions: {}, subscriptions: [], userPreferences: {}, activeSessionId: null };
      await manager.createSnapshot('user-1', 'socket-1', mockState, 5);

      // Add some operations
      manager.addOperation({
        id: 'op-1',
        type: 'add',
        target: 'session',
        targetId: 'session-1',
        payload: { title: 'Test' },
        timestamp: Date.now(),
        version: 4,
        userId: 'user-1'
      });

      const result = await manager.recoverState('user-1', 3);
      
      expect(result.needsFullSync).toBe(false);
      expect(result.snapshot).toBeTruthy();
      expect(result.delta).toBeTruthy();
      expect(result.delta!.fromVersion).toBe(3);
      expect(result.delta!.toVersion).toBe(5);
    });

    test('should require full sync when client is too far behind', async () => {
      const mockState = { sessions: {}, subscriptions: [], userPreferences: {}, activeSessionId: null };
      await manager.createSnapshot('user-1', 'socket-1', mockState, 20);

      const result = await manager.recoverState('user-1', 5);
      
      expect(result.needsFullSync).toBe(true);
    });

    test('should validate reconnect token', async () => {
      const mockState = { sessions: {}, subscriptions: [], userPreferences: {}, activeSessionId: null };
      await manager.createSnapshot('user-1', 'socket-1', mockState, 5, 'valid-token');

      // With valid token
      const validResult = await manager.recoverState('user-1', 5, 'valid-token');
      expect(validResult.needsFullSync).toBe(false);

      // With invalid token
      const invalidResult = await manager.recoverState('user-1', 5, 'invalid-token');
      expect(invalidResult.needsFullSync).toBe(true);
    });
  });

  describe('Operations and Delta Management', () => {
    test('should add and track operations', () => {
      const operation: StateOperation = {
        id: 'op-1',
        type: 'add',
        target: 'session',
        targetId: 'session-1',
        payload: { title: 'Test' },
        timestamp: Date.now(),
        version: 1,
        userId: 'user-1'
      };

      manager.addOperation(operation);

      const delta = manager.generateDelta('user-1', 0, 2);
      expect(delta).toBeTruthy();
      expect(delta!.operations).toHaveLength(1);
      expect(delta!.operations[0]).toEqual(operation);
    });

    test('should limit operations per user', () => {
      // Add more operations than the limit
      for (let i = 0; i < 15; i++) {
        manager.addOperation({
          id: `op-${i}`,
          type: 'add',
          target: 'session',
          targetId: `session-${i}`,
          payload: { title: `Test ${i}` },
          timestamp: Date.now(),
          version: i + 1,
          userId: 'user-1'
        });
      }

      const delta = manager.generateDelta('user-1', 0, 20);
      expect(delta!.operations.length).toBe(10); // maxOperations limit
    });

    test('should compress operations when threshold reached', () => {
      const eventSpy = jest.spyOn(manager, 'emit');

      // Add operations to trigger compression
      for (let i = 0; i < 4; i++) {
        manager.addOperation({
          id: `op-${i}`,
          type: 'update',
          target: 'session',
          targetId: 'session-1', // Same target
          payload: { title: `Test ${i}` },
          timestamp: Date.now() + i,
          version: i + 1,
          userId: 'user-1'
        });
      }

      expect(eventSpy).toHaveBeenCalledWith('delta-compressed', expect.any(Object));
    });

    test('should apply delta to state', () => {
      const initialState = {
        sessions: {},
        subscriptions: [],
        userPreferences: {},
        activeSessionId: null
      };

      const delta = {
        fromVersion: 1,
        toVersion: 3,
        operations: [
          {
            id: 'op-1',
            type: 'add' as const,
            target: 'session' as const,
            targetId: 'session-1',
            payload: { title: 'Test Session' },
            timestamp: Date.now(),
            version: 2,
            userId: 'user-1'
          },
          {
            id: 'op-2',
            type: 'add' as const,
            target: 'subscription' as const,
            targetId: 'sub-1',
            payload: 'sub-1',
            timestamp: Date.now(),
            version: 3,
            userId: 'user-1'
          }
        ],
        checksum: 'test-checksum',
        compressed: false
      };

      const newState = manager.applyDelta(initialState, delta);

      expect(newState.sessions['session-1']).toEqual({ title: 'Test Session' });
      expect(newState.subscriptions).toContain('sub-1');
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide accurate statistics', async () => {
      const mockState = { sessions: {}, subscriptions: [], userPreferences: {}, activeSessionId: null };
      
      await manager.createSnapshot('user-1', 'socket-1', mockState, 1);
      await manager.createSnapshot('user-2', 'socket-2', mockState, 1);
      
      manager.addOperation({
        id: 'op-1',
        type: 'add',
        target: 'session',
        targetId: 'session-1',
        payload: { title: 'Test' },
        timestamp: Date.now(),
        version: 2,
        userId: 'user-1'
      });

      const stats = manager.getStats();
      expect(stats.totalSnapshots).toBe(2);
      expect(stats.totalUsers).toBe(2);
      expect(stats.totalOperations).toBe(1);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Cleanup and Maintenance', () => {
    test('should perform cleanup on timer', async () => {
      const eventSpy = jest.spyOn(manager, 'emit');
      
      // Create old snapshot
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const mockState = { sessions: {}, subscriptions: [], userPreferences: {}, activeSessionId: null };
      const snapshotId = await manager.createSnapshot('user-1', 'socket-1', mockState, 1);
      
      // Manually set old timestamp
      const snapshot = manager.getLatestSnapshot('user-1');
      if (snapshot) {
        snapshot.timestamp = oldTimestamp;
      }

      // Trigger cleanup by advancing time
      jest.advanceTimersByTime(5000);

      expect(eventSpy).toHaveBeenCalledWith('cleanup-completed', expect.any(Object));
    });

    test('should shutdown gracefully', async () => {
      const shutdownSpy = jest.spyOn(manager, 'shutdown');
      
      await manager.shutdown();
      
      expect(shutdownSpy).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('ClientStatePersistenceManager shutting down...');
      expect(mockConsoleLog).toHaveBeenCalledWith('ClientStatePersistenceManager shutdown complete');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed state gracefully', () => {
      const invalidState = null;
      
      expect(() => {
        manager.createSnapshot('user-1', 'socket-1', invalidState, 1);
      }).not.toThrow();
    });

    test('should handle invalid operations gracefully', () => {
      const invalidOperation = {
        id: 'op-1',
        type: 'invalid' as any,
        target: 'session' as const,
        targetId: 'session-1',
        payload: { title: 'Test' },
        timestamp: Date.now(),
        version: 1,
        userId: 'user-1'
      };

      expect(() => {
        manager.addOperation(invalidOperation);
      }).not.toThrow();
    });
  });

  describe('Checksum Validation', () => {
    test('should generate consistent checksums', async () => {
      const mockState = {
        sessions: { 'session-1': { title: 'Test' } },
        subscriptions: ['sub-1'],
        userPreferences: { theme: 'dark' },
        activeSessionId: 'session-1'
      };

      const snapshot1 = await manager.createSnapshot('user-1', 'socket-1', mockState, 1);
      const snapshot2 = await manager.createSnapshot('user-2', 'socket-2', mockState, 1);

      const snap1 = manager.getLatestSnapshot('user-1');
      const snap2 = manager.getLatestSnapshot('user-2');

      expect(snap1!.checksum).toBe(snap2!.checksum);
    });

    test('should generate different checksums for different states', async () => {
      const state1 = { sessions: { 'session-1': { title: 'Test 1' } }, subscriptions: [], userPreferences: {}, activeSessionId: null };
      const state2 = { sessions: { 'session-1': { title: 'Test 2' } }, subscriptions: [], userPreferences: {}, activeSessionId: null };

      await manager.createSnapshot('user-1', 'socket-1', state1, 1);
      await manager.createSnapshot('user-2', 'socket-2', state2, 1);

      const snap1 = manager.getLatestSnapshot('user-1');
      const snap2 = manager.getLatestSnapshot('user-2');

      expect(snap1!.checksum).not.toBe(snap2!.checksum);
    });
  });
});