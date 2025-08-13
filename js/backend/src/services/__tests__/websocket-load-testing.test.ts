import { Server as HttpServer } from 'http';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import WebSocketService from '../websocket';

describe('WebSocket Load Testing for Task 19 Components', () => {
  let httpServer: HttpServer;
  let webSocketService: WebSocketService;
  let serverPort: number;
  let clients: ClientSocket[] = [];

  const LOAD_TEST_CONFIG = {
    // Start with manageable numbers for CI/local testing
    LOW_LOAD: 10,
    MEDIUM_LOAD: 25,
    HIGH_LOAD: 50,
    CONNECTION_TIMEOUT: 30000, // 30 seconds for load tests
    MESSAGE_BURST_SIZE: 100,
    CONCURRENT_OPERATIONS: 20
  };

  beforeAll((done) => {
    httpServer = createServer();
    webSocketService = new WebSocketService(httpServer, {
      maxConnectionsPerUser: 100, // Increased for load testing
      maxConnectionsPerIP: 200,
      healthMonitor: {
        baseHeartbeatInterval: 5000, // Longer intervals under load
        diagnosticInterval: 60000,
        enableNetworkDiagnostics: true,
        enableAdaptiveHeartbeat: true,
      }
    });
    
    httpServer.listen(() => {
      serverPort = (httpServer.address() as AddressInfo).port;
      done();
    });
  }, LOAD_TEST_CONFIG.CONNECTION_TIMEOUT);

  afterAll(async () => {
    // Cleanup all clients
    await Promise.all(clients.map(client => {
      if (client.connected) {
        return new Promise<void>((resolve) => {
          client.on('disconnect', () => resolve());
          client.disconnect();
          setTimeout(resolve, 1000); // Fallback timeout
        });
      }
      return Promise.resolve();
    }));
    
    clients = [];
    
    // Close services
    await webSocketService.close();
    httpServer.close();
    
    // Wait for full cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
  }, LOAD_TEST_CONFIG.CONNECTION_TIMEOUT);

  afterEach(async () => {
    // Cleanup clients after each test
    await Promise.all(clients.map(client => {
      if (client.connected) {
        return new Promise<void>((resolve) => {
          client.on('disconnect', () => resolve());
          client.disconnect();
          setTimeout(resolve, 500); // Fallback timeout
        });
      }
      return Promise.resolve();
    }));
    clients = [];
  });

  /**
   * Helper function to create multiple authenticated clients
   */
  async function createClients(count: number, userPrefix = 'load-test-user'): Promise<ClientSocket[]> {
    const clientPromises = Array.from({ length: count }, (_, index) => {
      return new Promise<ClientSocket>((resolve, reject) => {
        const client = ClientIO(`http://localhost:${serverPort}`, {
          transports: ['websocket'],
          timeout: 10000,
        });

        const timeout = setTimeout(() => {
          client.disconnect();
          reject(new Error(`Client ${index} connection timeout`));
        }, 10000);

        client.on('connect', () => {
          client.emit('authenticate', {
            userId: `${userPrefix}-${index}`,
            sessionId: `load-test-session-${Math.floor(index / 10)}`, // Group clients by session
          });
        });

        client.on('authenticated', (data) => {
          if (data.success) {
            clearTimeout(timeout);
            resolve(client);
          } else {
            clearTimeout(timeout);
            client.disconnect();
            reject(new Error(`Client ${index} authentication failed`));
          }
        });

        client.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    try {
      const newClients = await Promise.all(clientPromises);
      clients.push(...newClients);
      return newClients;
    } catch (error) {
      // Cleanup any connected clients if some failed
      clientPromises.forEach(async (promise, index) => {
        try {
          const client = await promise;
          if (client.connected) client.disconnect();
        } catch {
          // Ignore cleanup errors
        }
      });
      throw error;
    }
  }

  describe('Connection Load Testing', () => {
    test('should handle low load concurrent connections', async () => {
      const testClients = await createClients(LOAD_TEST_CONFIG.LOW_LOAD);
      
      expect(testClients).toHaveLength(LOAD_TEST_CONFIG.LOW_LOAD);
      expect(testClients.every(client => client.connected)).toBe(true);
      
      // Verify server can provide stats for all connections
      const stats = await new Promise((resolve, reject) => {
        testClients[0].emit('get-connection-stats', (data: any) => {
          if (data.error) reject(data.error);
          else resolve(data);
        });
      });
      
      expect(stats).toBeDefined();
    }, LOAD_TEST_CONFIG.CONNECTION_TIMEOUT);

    test('should handle medium load concurrent connections', async () => {
      const testClients = await createClients(LOAD_TEST_CONFIG.MEDIUM_LOAD);
      
      expect(testClients).toHaveLength(LOAD_TEST_CONFIG.MEDIUM_LOAD);
      expect(testClients.every(client => client.connected)).toBe(true);
      
      // Test that health monitoring works under medium load
      const healthPromises = testClients.slice(0, 5).map(client => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            client.emit('get-connection-health', (data: any) => {
              if (data?.socketId) resolve(data);
              else reject(new Error('Health check failed'));
            });
          }, 1000); // Wait for health monitoring to initialize
        });
      });
      
      const healthResults = await Promise.all(healthPromises);
      expect(healthResults).toHaveLength(5);
      expect(healthResults.every(result => result)).toBe(true);
    }, LOAD_TEST_CONFIG.CONNECTION_TIMEOUT);

    test('should handle high load concurrent connections', async () => {
      const testClients = await createClients(LOAD_TEST_CONFIG.HIGH_LOAD);
      
      expect(testClients).toHaveLength(LOAD_TEST_CONFIG.HIGH_LOAD);
      expect(testClients.every(client => client.connected)).toBe(true);
      
      // Verify server resources under high load
      const memoryBefore = process.memoryUsage();
      
      // Wait a bit for connections to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const memoryAfter = process.memoryUsage();
      
      // Memory usage should be reasonable (less than 200MB increase)
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // 200MB
    }, LOAD_TEST_CONFIG.CONNECTION_TIMEOUT);
  });

  describe('Message Throughput Load Testing', () => {
    test('should handle message bursts from multiple clients', async () => {
      const testClients = await createClients(LOAD_TEST_CONFIG.CONCURRENT_OPERATIONS);
      
      // Each client sends a burst of messages
      const messagePromises = testClients.map((client, clientIndex) => {
        return Promise.all(
          Array.from({ length: 10 }, (_, msgIndex) => {
            return new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Message timeout')), 5000);
              
              client.emit('session-update', {
                sessionId: `load-test-session-${Math.floor(clientIndex / 10)}`,
                update: {
                  type: 'test-update',
                  data: `Message ${msgIndex} from client ${clientIndex}`,
                  timestamp: Date.now(),
                }
              }, (response: any) => {
                clearTimeout(timeout);
                if (response?.success !== false) {
                  resolve();
                } else {
                  reject(new Error('Message failed'));
                }
              });
            });
          })
        );
      });
      
      // All messages should be processed successfully
      await Promise.all(messagePromises);
      
      // Verify no clients disconnected during the burst
      expect(testClients.every(client => client.connected)).toBe(true);
    }, LOAD_TEST_CONFIG.CONNECTION_TIMEOUT);

    test('should handle concurrent state synchronization', async () => {
      const testClients = await createClients(LOAD_TEST_CONFIG.CONCURRENT_OPERATIONS);
      
      // Test concurrent state updates that might cause conflicts
      const conflictPromises = testClients.map((client, index) => {
        return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Conflict resolution timeout')), 10000);
          
          let conflictResolved = false;
          
          // Listen for conflict resolution
          client.on('conflict-resolved', () => {
            conflictResolved = true;
            clearTimeout(timeout);
            resolve();
          });
          
          // Listen for successful updates
          client.on('session-update-confirmed', () => {
            if (!conflictResolved) {
              clearTimeout(timeout);
              resolve();
            }
          });
          
          // Send conflicting update to same document
          client.emit('session-update', {
            sessionId: 'conflict-test-session',
            update: {
              type: 'update',
              data: `Content from client ${index}`,
              targetPath: ['document', 'content'],
              timestamp: Date.now(),
            }
          });
        });
      });
      
      // All conflicts should be resolved
      await Promise.all(conflictPromises);
    }, LOAD_TEST_CONFIG.CONNECTION_TIMEOUT);
  });

  describe('Health Monitoring Under Load', () => {
    test('should maintain health monitoring accuracy under load', async () => {
      const testClients = await createClients(LOAD_TEST_CONFIG.MEDIUM_LOAD);
      
      // Wait for health monitoring to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get health statistics
      const healthStats = await new Promise<any>((resolve, reject) => {
        testClients[0].emit('get-health-statistics', (data: any) => {
          if (data.error) reject(data.error);
          else resolve(data);
        });
      });
      
      expect(healthStats.totalConnections).toBeGreaterThanOrEqual(LOAD_TEST_CONFIG.MEDIUM_LOAD);
      expect(healthStats.averageLatency).toBeGreaterThanOrEqual(0);
      expect(healthStats.qualityDistribution).toBeDefined();
      
      // Test individual health checks for a subset of clients
      const individualHealthPromises = testClients.slice(0, 5).map(client => {
        return new Promise((resolve, reject) => {
          client.emit('get-connection-health', (data: any) => {
            if (data?.quality) resolve(data);
            else reject(new Error('Individual health check failed'));
          });
        });
      });
      
      const individualHealth = await Promise.all(individualHealthPromises);
      expect(individualHealth).toHaveLength(5);
      expect(individualHealth.every(h => (h as any).quality)).toBe(true);
    }, LOAD_TEST_CONFIG.CONNECTION_TIMEOUT);

    test('should handle health diagnostics under load', async () => {
      const testClients = await createClients(LOAD_TEST_CONFIG.LOW_LOAD);
      
      // Wait for health monitoring to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Run diagnostics on multiple clients simultaneously
      const diagnosticPromises = testClients.slice(0, 5).map(client => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Diagnostic timeout')), 15000);
          
          client.emit('run-health-diagnostic', (report: any) => {
            clearTimeout(timeout);
            if (report?.overallHealth !== undefined) {
              resolve(report);
            } else {
              reject(new Error('Invalid diagnostic report'));
            }
          });
        });
      });
      
      const diagnosticReports = await Promise.all(diagnosticPromises);
      expect(diagnosticReports).toHaveLength(5);
      expect(diagnosticReports.every(report => (report as any).overallHealth !== undefined)).toBe(true);
    }, LOAD_TEST_CONFIG.CONNECTION_TIMEOUT);
  });

  describe('State Persistence Under Load', () => {
    test('should handle concurrent state snapshots', async () => {
      const testClients = await createClients(LOAD_TEST_CONFIG.CONCURRENT_OPERATIONS);
      
      // Simulate state changes from multiple clients
      const stateUpdatePromises = testClients.map((client, index) => {
        return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('State update timeout')), 10000);
          
          client.emit('create-state-snapshot', {
            userId: `load-test-user-${index}`,
            state: {
              sessions: { [`session-${index}`]: { title: `Session ${index}` } },
              subscriptions: [`sub-${index}`],
              userPreferences: { theme: index % 2 === 0 ? 'dark' : 'light' },
              activeSessionId: `session-${index}`
            }
          }, (response: any) => {
            clearTimeout(timeout);
            if (response?.snapshotId) {
              resolve();
            } else {
              reject(new Error('Snapshot creation failed'));
            }
          });
        });
      });
      
      // All snapshots should be created successfully
      await Promise.all(stateUpdatePromises);
      
      // Verify state recovery works
      const recoveryPromise = new Promise<any>((resolve, reject) => {
        testClients[0].emit('recover-state', {
          userId: 'load-test-user-0',
          version: 1
        }, (response: any) => {
          if (response?.snapshot || response?.needsFullSync) {
            resolve(response);
          } else {
            reject(new Error('State recovery failed'));
          }
        });
      });
      
      const recoveryResult = await recoveryPromise;
      expect(recoveryResult).toBeDefined();
    }, LOAD_TEST_CONFIG.CONNECTION_TIMEOUT);
  });

  describe('Performance Benchmarks', () => {
    test('should meet connection establishment time benchmarks', async () => {
      const startTime = Date.now();
      
      await createClients(LOAD_TEST_CONFIG.MEDIUM_LOAD);
      
      const connectionTime = Date.now() - startTime;
      
      // Should establish 25 connections in under 10 seconds
      expect(connectionTime).toBeLessThan(10000);
      
      // Average connection time should be reasonable
      const avgConnectionTime = connectionTime / LOAD_TEST_CONFIG.MEDIUM_LOAD;
      expect(avgConnectionTime).toBeLessThan(400); // Less than 400ms per connection
    }, LOAD_TEST_CONFIG.CONNECTION_TIMEOUT);

    test('should maintain message throughput benchmarks', async () => {
      const testClients = await createClients(LOAD_TEST_CONFIG.LOW_LOAD);
      
      const messageCount = 50;
      const startTime = Date.now();
      
      // Send messages from all clients simultaneously
      const messagePromises = testClients.map(client => {
        return Promise.all(
          Array.from({ length: messageCount / testClients.length }, (_, index) => {
            return new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Message timeout')), 5000);
              
              client.emit('test-message', {
                index,
                timestamp: Date.now(),
                data: 'test-payload'
              }, () => {
                clearTimeout(timeout);
                resolve();
              });
            });
          })
        );
      });
      
      await Promise.all(messagePromises);
      
      const totalTime = Date.now() - startTime;
      const messagesPerSecond = (messageCount * 1000) / totalTime;
      
      // Should handle at least 10 messages per second
      expect(messagesPerSecond).toBeGreaterThan(10);
    }, LOAD_TEST_CONFIG.CONNECTION_TIMEOUT);
  });
});