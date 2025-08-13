import { Server as HttpServer } from 'http';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import WebSocketService from '../websocket';

describe('WebSocket Memory Leak Testing for Task 19 Components', () => {
  let httpServer: HttpServer;
  let webSocketService: WebSocketService;
  let serverPort: number;

  const MEMORY_TEST_CONFIG = {
    CONNECTION_CYCLES: 5, // Number of connect/disconnect cycles
    CLIENTS_PER_CYCLE: 10, // Clients per cycle
    CYCLE_DURATION: 2000, // Time between cycles (ms)
    MAX_MEMORY_INCREASE: 50 * 1024 * 1024, // 50MB max increase
    STABILIZATION_TIME: 3000, // Time to wait for GC
    LONG_RUNNING_DURATION: 10000, // 10 seconds for long-running tests
  };

  beforeAll((done) => {
    httpServer = createServer();
    webSocketService = new WebSocketService(httpServer, {
      maxConnectionsPerUser: 100,
      maxConnectionsPerIP: 200,
      healthMonitor: {
        baseHeartbeatInterval: 2000,
        diagnosticInterval: 30000,
        enableNetworkDiagnostics: true,
        enableAdaptiveHeartbeat: true,
      }
    });
    
    httpServer.listen(() => {
      serverPort = (httpServer.address() as AddressInfo).port;
      done();
    });
  });

  afterAll(async () => {
    await webSocketService.close();
    httpServer.close();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  /**
   * Helper function to force garbage collection and get memory usage
   */
  function getMemoryUsage(): NodeJS.MemoryUsage {
    if (global.gc) {
      global.gc();
    }
    return process.memoryUsage();
  }

  /**
   * Helper function to create and authenticate a client
   */
  async function createAuthenticatedClient(userId: string, sessionId: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const client = ClientIO(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        timeout: 5000,
      });

      const timeout = setTimeout(() => {
        client.disconnect();
        reject(new Error('Client connection timeout'));
      }, 5000);

      client.on('connect', () => {
        client.emit('authenticate', { userId, sessionId });
      });

      client.on('authenticated', (data) => {
        if (data.success) {
          clearTimeout(timeout);
          resolve(client);
        } else {
          clearTimeout(timeout);
          client.disconnect();
          reject(new Error('Authentication failed'));
        }
      });

      client.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Helper function to simulate client activity
   */
  async function simulateClientActivity(client: ClientSocket, duration: number): Promise<void> {
    const startTime = Date.now();
    const activities = [
      'session-update',
      'get-connection-health',
      'create-state-snapshot',
      'get-health-statistics'
    ];

    while (Date.now() - startTime < duration && client.connected) {
      const activity = activities[Math.floor(Math.random() * activities.length)];
      
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(resolve, 1000); // Don't wait too long
          
          client.emit(activity, {
            sessionId: 'memory-test-session',
            userId: 'memory-test-user',
            data: `activity-${Date.now()}`
          }, () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch (error) {
        // Ignore activity errors for memory testing
      }
      
      // Small delay between activities
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  describe('Connection Memory Leaks', () => {
    test('should not leak memory during repeated connect/disconnect cycles', async () => {
      const initialMemory = getMemoryUsage();
      
      // Perform multiple connection cycles
      for (let cycle = 0; cycle < MEMORY_TEST_CONFIG.CONNECTION_CYCLES; cycle++) {
        const clients: ClientSocket[] = [];
        
        // Create multiple clients
        for (let i = 0; i < MEMORY_TEST_CONFIG.CLIENTS_PER_CYCLE; i++) {
          try {
            const client = await createAuthenticatedClient(
              `memory-test-user-${cycle}-${i}`,
              `memory-test-session-${cycle}`
            );
            clients.push(client);
          } catch (error) {
            // Skip failed connections
          }
        }
        
        // Let connections stabilize and generate some activity
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Disconnect all clients
        await Promise.all(clients.map(client => {
          return new Promise<void>((resolve) => {
            if (client.connected) {
              client.on('disconnect', () => resolve());
              client.disconnect();
              setTimeout(resolve, 1000); // Fallback timeout
            } else {
              resolve();
            }
          });
        }));
        
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, MEMORY_TEST_CONFIG.CYCLE_DURATION));
      }
      
      // Allow time for garbage collection
      await new Promise(resolve => setTimeout(resolve, MEMORY_TEST_CONFIG.STABILIZATION_TIME));
      
      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory increase after ${MEMORY_TEST_CONFIG.CONNECTION_CYCLES} cycles: ${Math.round(memoryIncrease / 1024 / 1024 * 100) / 100}MB`);
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(MEMORY_TEST_CONFIG.MAX_MEMORY_INCREASE);
    }, 30000);

    test('should properly clean up health monitoring resources', async () => {
      const initialMemory = getMemoryUsage();
      const clients: ClientSocket[] = [];
      
      // Create clients with health monitoring
      for (let i = 0; i < 15; i++) {
        try {
          const client = await createAuthenticatedClient(
            `health-memory-test-user-${i}`,
            `health-memory-test-session`
          );
          clients.push(client);
        } catch (error) {
          // Skip failed connections
        }
      }
      
      // Wait for health monitoring to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Trigger health operations
      for (const client of clients.slice(0, 5)) {
        try {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, 2000);
            client.emit('get-connection-health', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        } catch (error) {
          // Ignore errors
        }
      }
      
      // Disconnect all clients
      await Promise.all(clients.map(client => {
        return new Promise<void>((resolve) => {
          if (client.connected) {
            client.on('disconnect', () => resolve());
            client.disconnect();
            setTimeout(resolve, 1000);
          } else {
            resolve();
          }
        });
      }));
      
      // Wait for cleanup and garbage collection
      await new Promise(resolve => setTimeout(resolve, MEMORY_TEST_CONFIG.STABILIZATION_TIME));
      
      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory increase after health monitoring test: ${Math.round(memoryIncrease / 1024 / 1024 * 100) / 100}MB`);
      
      expect(memoryIncrease).toBeLessThan(MEMORY_TEST_CONFIG.MAX_MEMORY_INCREASE);
    }, 20000);
  });

  describe('State Management Memory Leaks', () => {
    test('should not leak memory during state operations', async () => {
      const initialMemory = getMemoryUsage();
      const client = await createAuthenticatedClient('state-memory-user', 'state-memory-session');
      
      try {
        // Perform many state operations
        for (let i = 0; i < 50; i++) {
          try {
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(resolve, 1000);
              
              client.emit('create-state-snapshot', {
                userId: 'state-memory-user',
                state: {
                  sessions: { 
                    [`session-${i}`]: { 
                      title: `Session ${i}`,
                      data: new Array(100).fill(`data-${i}`).join(' ') // Some bulk data
                    } 
                  },
                  subscriptions: [`sub-${i}`],
                  userPreferences: { iteration: i },
                  activeSessionId: `session-${i}`
                }
              }, () => {
                clearTimeout(timeout);
                resolve();
              });
            });
          } catch (error) {
            // Continue on errors
          }
          
          // Small delay
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Perform state recovery operations
        for (let i = 0; i < 20; i++) {
          try {
            await new Promise<void>((resolve) => {
              const timeout = setTimeout(resolve, 1000);
              
              client.emit('recover-state', {
                userId: 'state-memory-user',
                version: i + 1
              }, () => {
                clearTimeout(timeout);
                resolve();
              });
            });
          } catch (error) {
            // Continue on errors
          }
        }
        
      } finally {
        // Cleanup client
        if (client.connected) {
          await new Promise<void>((resolve) => {
            client.on('disconnect', () => resolve());
            client.disconnect();
            setTimeout(resolve, 1000);
          });
        }
      }
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, MEMORY_TEST_CONFIG.STABILIZATION_TIME));
      
      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory increase after state operations: ${Math.round(memoryIncrease / 1024 / 1024 * 100) / 100}MB`);
      
      expect(memoryIncrease).toBeLessThan(MEMORY_TEST_CONFIG.MAX_MEMORY_INCREASE);
    }, 25000);

    test('should clean up conflict resolution resources', async () => {
      const initialMemory = getMemoryUsage();
      const clients: ClientSocket[] = [];
      
      // Create multiple clients for conflict testing
      for (let i = 0; i < 10; i++) {
        try {
          const client = await createAuthenticatedClient(
            `conflict-memory-user-${i}`,
            'conflict-memory-session'
          );
          clients.push(client);
        } catch (error) {
          // Skip failed connections
        }
      }
      
      try {
        // Generate many conflicts
        for (let round = 0; round < 20; round++) {
          // Send conflicting updates from multiple clients
          const conflictPromises = clients.map((client, index) => {
            return new Promise<void>((resolve) => {
              const timeout = setTimeout(resolve, 2000);
              
              client.emit('session-update', {
                sessionId: 'conflict-memory-session',
                update: {
                  type: 'update',
                  data: `Content from client ${index} round ${round}`,
                  targetPath: ['document', 'content'],
                  timestamp: Date.now(),
                }
              }, () => {
                clearTimeout(timeout);
                resolve();
              });
            });
          });
          
          await Promise.all(conflictPromises);
          
          // Small delay between conflict rounds
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } finally {
        // Cleanup all clients
        await Promise.all(clients.map(client => {
          return new Promise<void>((resolve) => {
            if (client.connected) {
              client.on('disconnect', () => resolve());
              client.disconnect();
              setTimeout(resolve, 1000);
            } else {
              resolve();
            }
          });
        }));
      }
      
      // Wait for conflict resolution cleanup
      await new Promise(resolve => setTimeout(resolve, MEMORY_TEST_CONFIG.STABILIZATION_TIME));
      
      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory increase after conflict resolution: ${Math.round(memoryIncrease / 1024 / 1024 * 100) / 100}MB`);
      
      expect(memoryIncrease).toBeLessThan(MEMORY_TEST_CONFIG.MAX_MEMORY_INCREASE);
    }, 30000);
  });

  describe('Long-Running Connection Memory Tests', () => {
    test('should maintain stable memory usage with long-running connections', async () => {
      const initialMemory = getMemoryUsage();
      const clients: ClientSocket[] = [];
      
      // Create persistent clients
      for (let i = 0; i < 8; i++) {
        try {
          const client = await createAuthenticatedClient(
            `long-running-user-${i}`,
            'long-running-session'
          );
          clients.push(client);
        } catch (error) {
          // Skip failed connections
        }
      }
      
      try {
        // Simulate continuous activity for a period
        const activityPromises = clients.map(client => 
          simulateClientActivity(client, MEMORY_TEST_CONFIG.LONG_RUNNING_DURATION)
        );
        
        // Measure memory at intervals
        const memoryMeasurements: number[] = [];
        const measurementInterval = setInterval(() => {
          const currentMemory = getMemoryUsage();
          memoryMeasurements.push(currentMemory.heapUsed);
        }, 2000);
        
        await Promise.all(activityPromises);
        clearInterval(measurementInterval);
        
        // Check memory trend
        const firstMeasurement = memoryMeasurements[0] || initialMemory.heapUsed;
        const lastMeasurement = memoryMeasurements[memoryMeasurements.length - 1] || firstMeasurement;
        const memoryGrowth = lastMeasurement - firstMeasurement;
        
        console.log(`Memory growth during long-running test: ${Math.round(memoryGrowth / 1024 / 1024 * 100) / 100}MB`);
        console.log(`Memory measurements: ${memoryMeasurements.length}`);
        
        // Memory should not grow excessively during long-running operations
        expect(memoryGrowth).toBeLessThan(MEMORY_TEST_CONFIG.MAX_MEMORY_INCREASE);
        
      } finally {
        // Cleanup all clients
        await Promise.all(clients.map(client => {
          return new Promise<void>((resolve) => {
            if (client.connected) {
              client.on('disconnect', () => resolve());
              client.disconnect();
              setTimeout(resolve, 1000);
            } else {
              resolve();
            }
          });
        }));
      }
      
      // Final memory check after cleanup
      await new Promise(resolve => setTimeout(resolve, MEMORY_TEST_CONFIG.STABILIZATION_TIME));
      
      const finalMemory = getMemoryUsage();
      const totalIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Total memory increase after cleanup: ${Math.round(totalIncrease / 1024 / 1024 * 100) / 100}MB`);
      
      expect(totalIncrease).toBeLessThan(MEMORY_TEST_CONFIG.MAX_MEMORY_INCREASE);
    }, 40000);
  });

  describe('Timer and Resource Cleanup', () => {
    test('should clean up all timers and intervals', async () => {
      const initialMemory = getMemoryUsage();
      
      // Get initial timer counts (approximation)
      const initialHandles = (process as any)._getActiveHandles?.()?.length || 0;
      const initialRequests = (process as any)._getActiveRequests?.()?.length || 0;
      
      const clients: ClientSocket[] = [];
      
      // Create clients that will trigger timer creation
      for (let i = 0; i < 12; i++) {
        try {
          const client = await createAuthenticatedClient(
            `timer-test-user-${i}`,
            'timer-test-session'
          );
          clients.push(client);
        } catch (error) {
          // Skip failed connections
        }
      }
      
      // Wait for timers to be established (heartbeats, diagnostics, etc.)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Disconnect all clients (should clean up timers)
      await Promise.all(clients.map(client => {
        return new Promise<void>((resolve) => {
          if (client.connected) {
            client.on('disconnect', () => resolve());
            client.disconnect();
            setTimeout(resolve, 1000);
          } else {
            resolve();
          }
        });
      }));
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, MEMORY_TEST_CONFIG.STABILIZATION_TIME));
      
      // Check final handle counts
      const finalHandles = (process as any)._getActiveHandles?.()?.length || 0;
      const finalRequests = (process as any)._getActiveRequests?.()?.length || 0;
      
      console.log(`Handle change: ${finalHandles - initialHandles}`);
      console.log(`Request change: ${finalRequests - initialRequests}`);
      
      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory increase after timer cleanup: ${Math.round(memoryIncrease / 1024 / 1024 * 100) / 100}MB`);
      
      // Should not have excessive handle/request buildup
      expect(finalHandles - initialHandles).toBeLessThan(20);
      expect(finalRequests - initialRequests).toBeLessThan(10);
      expect(memoryIncrease).toBeLessThan(MEMORY_TEST_CONFIG.MAX_MEMORY_INCREASE);
    }, 25000);
  });
});