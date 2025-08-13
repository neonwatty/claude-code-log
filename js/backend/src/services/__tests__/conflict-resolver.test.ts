import ConflictResolver, { 
  Operation, 
  VersionedStateUpdate, 
  ConflictType,
  ConflictSeverity 
} from '../conflict-resolver';

describe('ConflictResolver', () => {
  let conflictResolver: ConflictResolver;
  let sessionId: string;
  let userId1: string;
  let userId2: string;

  beforeEach(() => {
    conflictResolver = new ConflictResolver('test-node', {
      defaultStrategy: 'semantic-merge',
      enableVectorClocks: true,
      autoResolveThreshold: 0.8,
    });
    sessionId = 'test-session-1';
    userId1 = 'user-1';
    userId2 = 'user-2';
  });

  afterEach(async () => {
    await conflictResolver.shutdown();
  });

  describe('Conflict Detection', () => {
    test('should detect concurrent updates', async () => {
      // Simulate first user making an update
      const operation1: Operation = {
        id: 'op-1',
        type: 'update',
        content: 'first change',
        targetPath: ['document', 'content'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: conflictResolver.createVectorClock(sessionId),
        userId: userId1,
        sessionId,
      };

      const update1: VersionedStateUpdate = {
        sessionId,
        userId: userId1,
        socketId: 'socket-1',
        operation: operation1,
        vectorClock: operation1.vectorClock,
        timestamp: operation1.timestamp,
        checksum: 'checksum-1',
      };

      // Process first update (should not cause conflict)
      const conflict1 = await conflictResolver.processStateUpdate(update1);
      expect(conflict1).toBeNull();

      // Simulate second user making a concurrent update
      const operation2: Operation = {
        id: 'op-2',
        type: 'update',
        content: 'second change',
        targetPath: ['document', 'content'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: conflictResolver.createVectorClock(sessionId),
        userId: userId2,
        sessionId,
      };

      const update2: VersionedStateUpdate = {
        sessionId,
        userId: userId2,
        socketId: 'socket-2',
        operation: operation2,
        vectorClock: operation2.vectorClock,
        timestamp: operation2.timestamp,
        checksum: 'checksum-2',
      };

      // Process second update (should detect conflict)
      const conflict2 = await conflictResolver.processStateUpdate(update2);
      expect(conflict2).not.toBeNull();
      expect(conflict2?.type).toBe('concurrent-update');
      expect(conflict2?.operations).toHaveLength(2);
      expect(conflict2?.metadata?.affectedUsers).toContain(userId1);
      expect(conflict2?.metadata?.affectedUsers).toContain(userId2);
    });

    test('should detect overlapping edits', async () => {
      const operation1: Operation = {
        id: 'op-1',
        type: 'insert',
        content: 'text1',
        position: 10,
        length: 5,
        targetPath: ['document', 'text'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: conflictResolver.createVectorClock(sessionId),
        userId: userId1,
        sessionId,
      };

      const update1: VersionedStateUpdate = {
        sessionId,
        userId: userId1,
        socketId: 'socket-1',
        operation: operation1,
        vectorClock: operation1.vectorClock,
        timestamp: operation1.timestamp,
        checksum: 'checksum-1',
      };

      await conflictResolver.processStateUpdate(update1);

      // Overlapping edit at position 12
      const operation2: Operation = {
        id: 'op-2',
        type: 'delete',
        position: 12,
        length: 3,
        targetPath: ['document', 'text'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: conflictResolver.createVectorClock(sessionId),
        userId: userId2,
        sessionId,
      };

      const update2: VersionedStateUpdate = {
        sessionId,
        userId: userId2,
        socketId: 'socket-2',
        operation: operation2,
        vectorClock: operation2.vectorClock,
        timestamp: operation2.timestamp,
        checksum: 'checksum-2',
      };

      const conflict = await conflictResolver.processStateUpdate(update2);
      expect(conflict).not.toBeNull();
      expect(conflict?.type).toBe('overlapping-edit');
    });
  });

  describe('Conflict Resolution Strategies', () => {
    let conflict: any;

    beforeEach(async () => {
      // Setup a conflict scenario
      const operation1: Operation = {
        id: 'op-1',
        type: 'update',
        content: 'first change',
        targetPath: ['document', 'title'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: conflictResolver.createVectorClock(sessionId),
        userId: userId1,
        sessionId,
      };

      const operation2: Operation = {
        id: 'op-2',
        type: 'update',
        content: 'second change',
        targetPath: ['document', 'title'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: conflictResolver.createVectorClock(sessionId),
        userId: userId2,
        sessionId,
      };

      const update1: VersionedStateUpdate = {
        sessionId,
        userId: userId1,
        socketId: 'socket-1',
        operation: operation1,
        vectorClock: operation1.vectorClock,
        timestamp: operation1.timestamp,
        checksum: 'checksum-1',
      };

      await conflictResolver.processStateUpdate(update1);

      const update2: VersionedStateUpdate = {
        sessionId,
        userId: userId2,
        socketId: 'socket-2',
        operation: operation2,
        vectorClock: operation2.vectorClock,
        timestamp: operation2.timestamp,
        checksum: 'checksum-2',
      };

      conflict = await conflictResolver.processStateUpdate(update2);
      expect(conflict).not.toBeNull();
    });

    test('should resolve using last-writer-wins strategy', async () => {
      const resolution = await conflictResolver.resolveConflict(conflict.id, 'last-writer-wins');
      
      expect(resolution).not.toBeNull();
      expect(resolution!.strategy).toBe('last-writer-wins');
      expect(resolution!.resolvedOperations).toHaveLength(1);
      expect(resolution!.confidence).toBeGreaterThan(0);
    });

    test('should resolve using semantic-merge strategy', async () => {
      const resolution = await conflictResolver.resolveConflict(conflict.id, 'semantic-merge');
      
      expect(resolution).not.toBeNull();
      expect(resolution!.strategy).toBe('semantic-merge');
      expect(resolution!.mergedState).toBeDefined();
      expect(resolution!.confidence).toBeGreaterThan(0);
    });

    test('should resolve using vector-clock strategy', async () => {
      const resolution = await conflictResolver.resolveConflict(conflict.id, 'vector-clock');
      
      expect(resolution).not.toBeNull();
      expect(resolution!.strategy).toBe('vector-clock');
      expect(resolution!.resolvedOperations).toHaveLength(1);
      expect(resolution!.confidence).toBeGreaterThan(0.9);
    });

    test('should require user input for user-prompt strategy', async () => {
      const resolution = await conflictResolver.resolveConflict(conflict.id, 'user-prompt');
      
      expect(resolution).not.toBeNull();
      expect(resolution!.strategy).toBe('user-prompt');
      expect(resolution!.requiresUserInput).toBe(true);
      expect(resolution!.confidence).toBe(0);
    });
  });

  describe('Operational Transformation', () => {
    test('should transform insert operations correctly', async () => {
      const operation1: Operation = {
        id: 'op-1',
        type: 'insert',
        content: 'text1',
        position: 5,
        length: 5,
        targetPath: ['document'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: conflictResolver.createVectorClock(sessionId),
        userId: userId1,
        sessionId,
      };

      const operation2: Operation = {
        id: 'op-2',
        type: 'insert',
        content: 'text2',
        position: 3,
        length: 5,
        targetPath: ['document'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: conflictResolver.createVectorClock(sessionId),
        userId: userId2,
        sessionId,
      };

      const update1: VersionedStateUpdate = {
        sessionId,
        userId: userId1,
        socketId: 'socket-1',
        operation: operation1,
        vectorClock: operation1.vectorClock,
        timestamp: operation1.timestamp,
        checksum: 'checksum-1',
      };

      await conflictResolver.processStateUpdate(update1);

      const update2: VersionedStateUpdate = {
        sessionId,
        userId: userId2,
        socketId: 'socket-2',
        operation: operation2,
        vectorClock: operation2.vectorClock,
        timestamp: operation2.timestamp,
        checksum: 'checksum-2',
      };

      const conflict = await conflictResolver.processStateUpdate(update2);
      expect(conflict).not.toBeNull();

      const resolution = await conflictResolver.resolveConflict(conflict!.id, 'operational-transform');
      expect(resolution).not.toBeNull();
      expect(resolution!.strategy).toBe('operational-transform');
      expect(resolution!.resolvedOperations).toHaveLength(2);
      
      // Check that the second operation was transformed
      const transformedOp = resolution!.resolvedOperations.find(op => op.id === 'op-1');
      expect(transformedOp).toBeDefined();
      expect(transformedOp!.position).toBe(10); // 5 + 5 (length of first insert)
    });
  });

  describe('Vector Clocks', () => {
    test('should maintain vector clocks correctly', () => {
      const clock1 = conflictResolver.createVectorClock(sessionId);
      expect(clock1).toHaveProperty('test-node');
      expect(clock1['test-node']).toBe(1);

      const clock2 = conflictResolver.createVectorClock(sessionId);
      expect(clock2['test-node']).toBe(2);
    });

    test('should detect version mismatches', async () => {
      // Create an operation with an advanced vector clock
      const futureVectorClock = { 'test-node': 100, 'other-node': 50 };
      
      const operation: Operation = {
        id: 'op-future',
        type: 'update',
        content: 'future change',
        targetPath: ['document'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: futureVectorClock,
        userId: userId1,
        sessionId,
      };

      const update: VersionedStateUpdate = {
        sessionId,
        userId: userId1,
        socketId: 'socket-1',
        operation,
        vectorClock: futureVectorClock,
        timestamp: operation.timestamp,
        checksum: 'checksum-future',
      };

      const conflict = await conflictResolver.processStateUpdate(update);
      expect(conflict).not.toBeNull();
      expect(conflict?.type).toBe('version-mismatch');
    });
  });

  describe('Event Emission', () => {
    test('should emit conflict-detected event', (done) => {
      conflictResolver.on('conflict-detected', (conflict) => {
        expect(conflict.id).toBeDefined();
        expect(conflict.type).toBeDefined();
        expect(conflict.sessionId).toBe(sessionId);
        done();
      });

      // Create conflicting operations
      const createConflictingUpdates = async () => {
        const operation1: Operation = {
          id: 'op-1',
          type: 'update',
          content: 'change1',
          targetPath: ['test'],
          timestamp: conflictResolver.createLogicalTimestamp(),
          vectorClock: conflictResolver.createVectorClock(sessionId),
          userId: userId1,
          sessionId,
        };

        const update1: VersionedStateUpdate = {
          sessionId,
          userId: userId1,
          socketId: 'socket-1',
          operation: operation1,
          vectorClock: operation1.vectorClock,
          timestamp: operation1.timestamp,
          checksum: 'checksum-1',
        };

        await conflictResolver.processStateUpdate(update1);

        const operation2: Operation = {
          id: 'op-2',
          type: 'update',
          content: 'change2',
          targetPath: ['test'],
          timestamp: conflictResolver.createLogicalTimestamp(),
          vectorClock: conflictResolver.createVectorClock(sessionId),
          userId: userId2,
          sessionId,
        };

        const update2: VersionedStateUpdate = {
          sessionId,
          userId: userId2,
          socketId: 'socket-2',
          operation: operation2,
          vectorClock: operation2.vectorClock,
          timestamp: operation2.timestamp,
          checksum: 'checksum-2',
        };

        await conflictResolver.processStateUpdate(update2);
      };

      createConflictingUpdates();
    });

    test('should emit conflict-resolved event', (done) => {
      conflictResolver.on('conflict-resolved', (resolution) => {
        expect(resolution.conflictId).toBeDefined();
        expect(resolution.strategy).toBeDefined();
        expect(resolution.confidence).toBeGreaterThanOrEqual(0);
        done();
      });

      // Create and resolve a conflict
      const createAndResolveConflict = async () => {
        const operation1: Operation = {
          id: 'op-1',
          type: 'update',
          content: 'change1',
          targetPath: ['test'],
          timestamp: conflictResolver.createLogicalTimestamp(),
          vectorClock: conflictResolver.createVectorClock(sessionId),
          userId: userId1,
          sessionId,
        };

        const update1: VersionedStateUpdate = {
          sessionId,
          userId: userId1,
          socketId: 'socket-1',
          operation: operation1,
          vectorClock: operation1.vectorClock,
          timestamp: operation1.timestamp,
          checksum: 'checksum-1',
        };

        await conflictResolver.processStateUpdate(update1);

        const operation2: Operation = {
          id: 'op-2',
          type: 'update',
          content: 'change2',
          targetPath: ['test'],
          timestamp: conflictResolver.createLogicalTimestamp(),
          vectorClock: conflictResolver.createVectorClock(sessionId),
          userId: userId2,
          sessionId,
        };

        const update2: VersionedStateUpdate = {
          sessionId,
          userId: userId2,
          socketId: 'socket-2',
          operation: operation2,
          vectorClock: operation2.vectorClock,
          timestamp: operation2.timestamp,
          checksum: 'checksum-2',
        };

        const conflict = await conflictResolver.processStateUpdate(update2);
        if (conflict) {
          await conflictResolver.resolveConflict(conflict.id, 'last-writer-wins');
        }
      };

      createAndResolveConflict();
    });
  });

  describe('Statistics and Management', () => {
    test('should provide accurate conflict statistics', async () => {
      // Create a few conflicts
      for (let i = 0; i < 3; i++) {
        const operation1: Operation = {
          id: `op-1-${i}`,
          type: 'update',
          content: `change1-${i}`,
          targetPath: ['test', i.toString()],
          timestamp: conflictResolver.createLogicalTimestamp(),
          vectorClock: conflictResolver.createVectorClock(sessionId),
          userId: userId1,
          sessionId,
        };

        const update1: VersionedStateUpdate = {
          sessionId,
          userId: userId1,
          socketId: 'socket-1',
          operation: operation1,
          vectorClock: operation1.vectorClock,
          timestamp: operation1.timestamp,
          checksum: `checksum-1-${i}`,
        };

        await conflictResolver.processStateUpdate(update1);

        const operation2: Operation = {
          id: `op-2-${i}`,
          type: 'update',
          content: `change2-${i}`,
          targetPath: ['test', i.toString()],
          timestamp: conflictResolver.createLogicalTimestamp(),
          vectorClock: conflictResolver.createVectorClock(sessionId),
          userId: userId2,
          sessionId,
        };

        const update2: VersionedStateUpdate = {
          sessionId,
          userId: userId2,
          socketId: 'socket-2',
          operation: operation2,
          vectorClock: operation2.vectorClock,
          timestamp: operation2.timestamp,
          checksum: `checksum-2-${i}`,
        };

        await conflictResolver.processStateUpdate(update2);
      }

      const stats = conflictResolver.getConflictStats();
      expect(stats.activeConflicts).toBe(3);
      expect(stats.totalConflictsHistorical).toBe(3);
      expect(stats.conflictsByType['concurrent-update']).toBe(3);
    });

    test('should track resolved conflicts correctly', async () => {
      // Create and resolve a conflict
      const operation1: Operation = {
        id: 'op-1',
        type: 'update',
        content: 'change1',
        targetPath: ['test'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: conflictResolver.createVectorClock(sessionId),
        userId: userId1,
        sessionId,
      };

      const update1: VersionedStateUpdate = {
        sessionId,
        userId: userId1,
        socketId: 'socket-1',
        operation: operation1,
        vectorClock: operation1.vectorClock,
        timestamp: operation1.timestamp,
        checksum: 'checksum-1',
      };

      await conflictResolver.processStateUpdate(update1);

      const operation2: Operation = {
        id: 'op-2',
        type: 'update',
        content: 'change2',
        targetPath: ['test'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: conflictResolver.createVectorClock(sessionId),
        userId: userId2,
        sessionId,
      };

      const update2: VersionedStateUpdate = {
        sessionId,
        userId: userId2,
        socketId: 'socket-2',
        operation: operation2,
        vectorClock: operation2.vectorClock,
        timestamp: operation2.timestamp,
        checksum: 'checksum-2',
      };

      const conflict = await conflictResolver.processStateUpdate(update2);
      expect(conflict).not.toBeNull();

      const statsBefore = conflictResolver.getConflictStats();
      expect(statsBefore.activeConflicts).toBe(1);
      expect(statsBefore.resolvedConflicts).toBe(0);

      const resolution = await conflictResolver.resolveConflict(conflict!.id, 'last-writer-wins');
      expect(resolution).not.toBeNull();

      const statsAfter = conflictResolver.getConflictStats();
      expect(statsAfter.resolvedConflicts).toBe(1);
      expect(statsAfter.resolutionsByStrategy['last-writer-wins']).toBe(1);
    });
  });

  describe('User Input Handling', () => {
    test('should handle user input for conflict resolution', async () => {
      // Create a conflict
      const operation1: Operation = {
        id: 'op-1',
        type: 'update',
        content: 'user1 change',
        targetPath: ['test'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: conflictResolver.createVectorClock(sessionId),
        userId: userId1,
        sessionId,
      };

      const operation2: Operation = {
        id: 'op-2',
        type: 'update',
        content: 'user2 change',
        targetPath: ['test'],
        timestamp: conflictResolver.createLogicalTimestamp(),
        vectorClock: conflictResolver.createVectorClock(sessionId),
        userId: userId2,
        sessionId,
      };

      const update1: VersionedStateUpdate = {
        sessionId,
        userId: userId1,
        socketId: 'socket-1',
        operation: operation1,
        vectorClock: operation1.vectorClock,
        timestamp: operation1.timestamp,
        checksum: 'checksum-1',
      };

      await conflictResolver.processStateUpdate(update1);

      const update2: VersionedStateUpdate = {
        sessionId,
        userId: userId2,
        socketId: 'socket-2',
        operation: operation2,
        vectorClock: operation2.vectorClock,
        timestamp: operation2.timestamp,
        checksum: 'checksum-2',
      };

      const conflict = await conflictResolver.processStateUpdate(update2);
      expect(conflict).not.toBeNull();

      // Simulate user selecting the first operation
      await conflictResolver.handleUserInput(conflict!.id, 'op-1');

      const statsAfter = conflictResolver.getConflictStats();
      expect(statsAfter.resolvedConflicts).toBe(1);
      expect(statsAfter.resolutionsByStrategy['user-prompt']).toBe(1);
    });
  });
});