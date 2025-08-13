import { Server as HttpServer } from 'http';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import WebSocketService from '../websocket';

describe('WebSocket Conflict Resolution Integration', () => {
  let httpServer: HttpServer;
  let webSocketService: WebSocketService;
  let client1: ClientSocket;
  let client2: ClientSocket;
  let serverPort: number;

  beforeAll((done) => {
    httpServer = createServer();
    webSocketService = new WebSocketService(httpServer);
    
    httpServer.listen(() => {
      serverPort = (httpServer.address() as AddressInfo).port;
      done();
    });
  });

  afterAll(async () => {
    await webSocketService.close();
    httpServer.close();
  });

  beforeEach((done) => {
    let connectedClients = 0;
    
    client1 = ClientIO(`http://localhost:${serverPort}`);
    client2 = ClientIO(`http://localhost:${serverPort}`);

    const checkAllConnected = () => {
      connectedClients++;
      if (connectedClients === 2) {
        done();
      }
    };

    client1.on('connect', () => {
      client1.emit('authenticate', {
        userId: 'user-1',
        sessionId: 'test-session',
      });
    });

    client2.on('connect', () => {
      client2.emit('authenticate', {
        userId: 'user-2',
        sessionId: 'test-session',
      });
    });

    client1.on('authenticated', (data) => {
      if (data.success) {
        client1.emit('join-session', 'test-session');
        checkAllConnected();
      }
    });

    client2.on('authenticated', (data) => {
      if (data.success) {
        client2.emit('join-session', 'test-session');
        checkAllConnected();
      }
    });
  });

  afterEach(() => {
    client1.disconnect();
    client2.disconnect();
  });

  test('should detect and resolve concurrent updates', (done) => {
    let conflictDetected = false;
    let conflictResolved = false;
    let updateConfirmed = 0;

    // Listen for conflict detection
    client1.on('conflict-detected', (data) => {
      expect(data.conflictId).toBeDefined();
      expect(data.type).toBe('concurrent-update');
      expect(data.sessionId).toBe('test-session');
      expect(data.affectedUsers).toContain('user-1');
      expect(data.affectedUsers).toContain('user-2');
      conflictDetected = true;

      // Resolve the conflict using semantic merge
      client1.emit('resolve-conflict', {
        conflictId: data.conflictId,
        strategy: 'semantic-merge'
      }, (result: { success: boolean; error?: string }) => {
        expect(result.success).toBe(true);
      });
    });

    // Listen for conflict resolution
    client2.on('conflict-resolved', (data) => {
      expect(data.conflictId).toBeDefined();
      expect(data.strategy).toBe('semantic-merge');
      expect(data.confidence).toBeGreaterThan(0);
      conflictResolved = true;
      checkCompletion();
    });

    // Listen for update confirmations
    client1.on('session-update-confirmed', (data) => {
      expect(data.updateId).toBeDefined();
      expect(data.vectorClock).toBeDefined();
      updateConfirmed++;
      checkCompletion();
    });

    client2.on('session-update-confirmed', (data) => {
      expect(data.updateId).toBeDefined();
      expect(data.vectorClock).toBeDefined();
      updateConfirmed++;
      checkCompletion();
    });

    const checkCompletion = () => {
      if (conflictDetected && conflictResolved && updateConfirmed >= 2) {
        done();
      }
    };

    // Send concurrent updates
    setTimeout(() => {
      client1.emit('session-update', {
        sessionId: 'test-session',
        update: {
          type: 'update',
          data: 'User 1 content',
          targetPath: ['document', 'content'],
        }
      });
    }, 50);

    setTimeout(() => {
      client2.emit('session-update', {
        sessionId: 'test-session',
        update: {
          type: 'update',
          data: 'User 2 content',
          targetPath: ['document', 'content'],
        }
      });
    }, 60);
  });

  test('should handle overlapping text edits with operational transform', (done) => {
    let conflictDetected = false;
    let operationsSynchronized = false;

    client1.on('conflict-detected', (data) => {
      expect(data.type).toBe('overlapping-edit');
      conflictDetected = true;

      // Resolve using operational transform
      client1.emit('resolve-conflict', {
        conflictId: data.conflictId,
        strategy: 'operational-transform'
      });
    });

    client2.on('operations-synchronized', (data) => {
      expect(data.sessionId).toBe('test-session');
      expect(data.operations).toHaveLength(2);
      expect(data.strategy).toBe('operational-transform');
      operationsSynchronized = true;

      if (conflictDetected && operationsSynchronized) {
        done();
      }
    });

    // Send overlapping edits
    client1.emit('session-update', {
      sessionId: 'test-session',
      update: {
        type: 'insert',
        data: 'Hello ',
        targetPath: ['document', 'text'],
        position: 0,
        length: 6,
      }
    });

    setTimeout(() => {
      client2.emit('session-update', {
        sessionId: 'test-session',
        update: {
          type: 'insert',
          data: 'World',
          targetPath: ['document', 'text'],
          position: 3,
          length: 5,
        }
      });
    }, 10);
  });

  test('should require manual resolution for critical conflicts', (done) => {
    let manualResolutionRequired = false;

    client1.on('manual-resolution-required', (data) => {
      expect(data.conflictId).toBeDefined();
      expect(data.sessionId).toBe('test-session');
      expect(data.severity).toBe('critical');
      expect(data.options).toHaveLength(2);
      manualResolutionRequired = true;

      // User selects the first option
      client1.emit('resolve-conflict', {
        conflictId: data.conflictId,
        selectedOperationId: data.options[0].id
      }, (result: { success: boolean }) => {
        expect(result.success).toBe(true);
        if (manualResolutionRequired) {
          done();
        }
      });
    });

    // Simulate critical conflict by sending updates with data corruption indicators
    client1.emit('session-update', {
      sessionId: 'test-session',
      update: {
        type: 'update',
        data: { critical: true, content: 'Critical data 1' },
        targetPath: ['document', 'criticalField'],
      }
    });

    setTimeout(() => {
      client2.emit('session-update', {
        sessionId: 'test-session',
        update: {
          type: 'update',
          data: { critical: true, content: 'Critical data 2' },
          targetPath: ['document', 'criticalField'],
        }
      });
    }, 5);
  });

  test('should provide conflict statistics', (done) => {
    client1.on('conflict-detected', () => {
      // After conflict is detected, get statistics
      client1.emit('get-conflict-stats', (stats: any) => {
        expect(stats).toBeDefined();
        expect(stats.activeConflicts).toBeGreaterThan(0);
        expect(stats.conflictsByType).toBeDefined();
        expect(stats.resolutionsByStrategy).toBeDefined();
        done();
      });
    });

    // Create a conflict
    client1.emit('session-update', {
      sessionId: 'test-session',
      update: {
        type: 'update',
        data: 'Content 1',
        targetPath: ['document', 'field'],
      }
    });

    setTimeout(() => {
      client2.emit('session-update', {
        sessionId: 'test-session',
        update: {
          type: 'update',
          data: 'Content 2',
          targetPath: ['document', 'field'],
        }
      });
    }, 10);
  });

  test('should get active conflicts for a session', (done) => {
    client1.on('conflict-detected', (conflictData) => {
      // Get active conflicts for the session
      client1.emit('get-active-conflicts', 'test-session', (conflicts: any[]) => {
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].id).toBe(conflictData.conflictId);
        expect(conflicts[0].sessionId).toBe('test-session');
        done();
      });
    });

    // Create a conflict
    client1.emit('session-update', {
      sessionId: 'test-session',
      update: {
        type: 'update',
        data: 'Update 1',
        targetPath: ['document', 'content'],
      }
    });

    setTimeout(() => {
      client2.emit('session-update', {
        sessionId: 'test-session',
        update: {
          type: 'update',
          data: 'Update 2',
          targetPath: ['document', 'content'],
        }
      });
    }, 10);
  });

  test('should handle multiple conflicts in sequence', (done) => {
    let conflictsDetected = 0;
    let conflictsResolved = 0;
    const expectedConflicts = 2;

    const checkCompletion = () => {
      if (conflictsDetected === expectedConflicts && conflictsResolved === expectedConflicts) {
        done();
      }
    };

    client1.on('conflict-detected', (data) => {
      conflictsDetected++;
      
      // Auto-resolve each conflict
      client1.emit('resolve-conflict', {
        conflictId: data.conflictId,
        strategy: 'last-writer-wins'
      });
    });

    client1.on('conflict-resolved', () => {
      conflictsResolved++;
      checkCompletion();
    });

    // Create first conflict
    client1.emit('session-update', {
      sessionId: 'test-session',
      update: {
        type: 'update',
        data: 'Field 1 - User 1',
        targetPath: ['document', 'field1'],
      }
    });

    setTimeout(() => {
      client2.emit('session-update', {
        sessionId: 'test-session',
        update: {
          type: 'update',
          data: 'Field 1 - User 2',
          targetPath: ['document', 'field1'],
        }
      });
    }, 10);

    // Create second conflict
    setTimeout(() => {
      client1.emit('session-update', {
        sessionId: 'test-session',
        update: {
          type: 'update',
          data: 'Field 2 - User 1',
          targetPath: ['document', 'field2'],
        }
      });
    }, 100);

    setTimeout(() => {
      client2.emit('session-update', {
        sessionId: 'test-session',
        update: {
          type: 'update',
          data: 'Field 2 - User 2',
          targetPath: ['document', 'field2'],
        }
      });
    }, 110);
  });

  test('should handle vector clock synchronization', (done) => {
    let vectorClocksReceived = 0;
    const expectedVectorClocks = 2;

    client1.on('session-update-confirmed', (data) => {
      expect(data.vectorClock).toBeDefined();
      expect(typeof data.vectorClock).toBe('object');
      vectorClocksReceived++;
      
      if (vectorClocksReceived === expectedVectorClocks) {
        done();
      }
    });

    client2.on('session-update-confirmed', (data) => {
      expect(data.vectorClock).toBeDefined();
      expect(typeof data.vectorClock).toBe('object');
      vectorClocksReceived++;
      
      if (vectorClocksReceived === expectedVectorClocks) {
        done();
      }
    });

    // Send updates that don't conflict
    client1.emit('session-update', {
      sessionId: 'test-session',
      update: {
        type: 'update',
        data: 'Non-conflicting update 1',
        targetPath: ['document', 'field1'],
      }
    });

    setTimeout(() => {
      client2.emit('session-update', {
        sessionId: 'test-session',
        update: {
          type: 'update',
          data: 'Non-conflicting update 2',
          targetPath: ['document', 'field2'],
        }
      });
    }, 50);
  });

  test('should emit system alerts for resolution errors', (done) => {
    client1.on('system-alert', (data) => {
      expect(data.type).toBe('conflict-resolution-error');
      expect(data.conflictId).toBeDefined();
      expect(data.error).toBeDefined();
      done();
    });

    // Create a conflict first
    client1.on('conflict-detected', (conflictData) => {
      // Try to resolve with an invalid strategy to trigger an error
      client1.emit('resolve-conflict', {
        conflictId: 'invalid-conflict-id',
        strategy: 'semantic-merge'
      });
    });

    client1.emit('session-update', {
      sessionId: 'test-session',
      update: {
        type: 'update',
        data: 'Update 1',
        targetPath: ['document', 'content'],
      }
    });

    setTimeout(() => {
      client2.emit('session-update', {
        sessionId: 'test-session',
        update: {
          type: 'update',
          data: 'Update 2',
          targetPath: ['document', 'content'],
        }
      });
    }, 10);
  });
});