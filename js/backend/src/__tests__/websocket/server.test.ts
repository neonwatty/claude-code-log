import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { WebSocketManager } from '../../websocket/server';
import { WebSocketMessageType } from '../../websocket/messageTypes';
import { validateWebSocketOrigin } from '../../middleware/cors';
import WebSocket from 'ws';

describe('WebSocket Server', () => {
  let wsManager: WebSocketManager;
  let httpServer: any;
  let testClient: WebSocket;
  const TEST_PORT = 8081;

  beforeEach(async () => {
    wsManager = new WebSocketManager();
    httpServer = createServer();
    
    // Start the WebSocket server
    await wsManager.start(0, httpServer);
    
    return new Promise<void>((resolve) => {
      httpServer.listen(TEST_PORT, () => {
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Close test client first
    if (testClient) {
      if (testClient.readyState === WebSocket.OPEN) {
        testClient.close();
        // Wait for close to complete
        await new Promise<void>((resolve) => {
          testClient.on('close', () => resolve());
          // Force close after timeout
          setTimeout(() => resolve(), 100);
        });
      }
      testClient = null as any;
    }
    
    // Stop websocket manager
    await wsManager.stop();
    
    // Close HTTP server
    return new Promise<void>((resolve) => {
      httpServer.close(() => {
        resolve();
      });
      // Force resolve after timeout to prevent hanging
      setTimeout(() => resolve(), 1000);
    });
  });

  describe('Connection Management', () => {
    it('should accept WebSocket connections', async () => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      return new Promise<void>((resolve, reject) => {
        testClient.on('open', () => {
          expect(wsManager.getActiveClientCount()).toBe(1);
          resolve();
        });

        testClient.on('error', reject);
      });
    });

    it('should send welcome message on connection', async () => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      return new Promise<void>((resolve, reject) => {
        testClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          expect(message.type).toBe(WebSocketMessageType.CONNECT);
          expect(message.data).toHaveProperty('clientId');
          expect(message.data).toHaveProperty('message');
          expect(message.data.message).toContain('Connected to Claude Code Log WebSocket server');
          resolve();
        });

        testClient.on('error', reject);
      });
    });

    it('should track multiple client connections', async () => {
      const clients: WebSocket[] = [];

      return new Promise<void>((resolve, reject) => {
        let connectedCount = 0;

        const createClient = () => {
          const client = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
          clients.push(client);
          
          client.on('open', () => {
            connectedCount++;
            if (connectedCount === 3) {
              try {
                expect(wsManager.getActiveClientCount()).toBe(3);
                // Clean up clients
                clients.forEach(c => c.close());
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          });
          
          client.on('error', reject);
        };

        // Create 3 clients
        createClient();
        createClient();
        createClient();
      });
    });

    it('should handle client disconnection', async () => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      return new Promise<void>((resolve, reject) => {
        testClient.on('open', () => {
          expect(wsManager.getActiveClientCount()).toBe(1);
          testClient.close();
        });

        testClient.on('close', () => {
          // Give some time for cleanup
          setTimeout(() => {
            try {
              expect(wsManager.getActiveClientCount()).toBe(0);
              resolve();
            } catch (error) {
              reject(error);
            }
          }, 100);
        });

        testClient.on('error', reject);
      });
    });
  });

  describe('Message Broadcasting', () => {
    beforeEach(async () => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      return new Promise<void>((resolve, reject) => {
        testClient.on('open', () => resolve());
        testClient.on('error', reject);
      });
    });

    it('should broadcast session created events', async () => {
      return new Promise<void>((resolve, reject) => {
        testClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          // Look for the specific message type we're testing
          if (message.type === WebSocketMessageType.SESSION_CREATED) {
            try {
              expect(message.type).toBe(WebSocketMessageType.SESSION_CREATED);
              expect(message.data).toHaveProperty('sessionId', 'test-session-123');
              expect(message.data).toHaveProperty('cwd', '/test/project');
              resolve();
            } catch (error) {
              reject(error);
            }
          }
          // Ignore other messages (like welcome messages)
        });

        testClient.on('error', reject);

        // Add delay to ensure connection is fully established
        setTimeout(() => {
          wsManager.broadcastSessionCreated('test-session-123', '/test/project');
        }, 10);
      });
    });

    it('should broadcast session updated events', async () => {
      return new Promise<void>((resolve, reject) => {
        testClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          // Look for the specific message type we're testing
          if (message.type === WebSocketMessageType.SESSION_UPDATED) {
            try {
              expect(message.type).toBe(WebSocketMessageType.SESSION_UPDATED);
              expect(message.data).toHaveProperty('sessionId', 'test-session-456');
              expect(message.data).toHaveProperty('entryCount', 5);
              resolve();
            } catch (error) {
              reject(error);
            }
          }
          // Ignore other messages (like welcome messages)
        });

        testClient.on('error', reject);

        // Add delay to ensure connection is fully established
        setTimeout(() => {
          wsManager.broadcastSessionUpdated('test-session-456', '/test/project', 5);
        }, 10);
      });
    });

    it('should broadcast file changed events', async () => {
      return new Promise<void>((resolve, reject) => {
        testClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          // Look for the specific message type we're testing
          if (message.type === WebSocketMessageType.FILE_CHANGED) {
            try {
              expect(message.type).toBe(WebSocketMessageType.FILE_CHANGED);
              expect(message.data).toHaveProperty('filePath', '/test/file.jsonl');
              expect(message.data).toHaveProperty('changeType', 'modified');
              resolve();
            } catch (error) {
              reject(error);
            }
          }
          // Ignore other messages (like welcome messages)
        });

        testClient.on('error', reject);

        // Add delay to ensure connection is fully established
        setTimeout(() => {
          wsManager.broadcastFileChanged('/test/file.jsonl', 'modified');
        }, 10);
      });
    });

    it('should broadcast to multiple clients', async () => {
      const client2 = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      return new Promise<void>((resolve, reject) => {
        let client1Received = false;
        let client2Received = false;
        
        const checkCompletion = () => {
          if (client1Received && client2Received) {
            client2.close();
            resolve();
          }
        };

        client2.on('open', () => {
          testClient.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === WebSocketMessageType.SESSION_CREATED) {
              try {
                expect(message.type).toBe(WebSocketMessageType.SESSION_CREATED);
                client1Received = true;
                checkCompletion();
              } catch (error) {
                reject(error);
              }
            }
          });
          
          client2.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === WebSocketMessageType.SESSION_CREATED) {
              try {
                expect(message.type).toBe(WebSocketMessageType.SESSION_CREATED);
                client2Received = true;
                checkCompletion();
              } catch (error) {
                reject(error);
              }
            }
          });
          
          // Add delay to ensure both connections are fully established
          setTimeout(() => {
            wsManager.broadcastSessionCreated('test-session-multi', '/test/project');
          }, 50);
        });
        
        client2.on('error', reject);
        testClient.on('error', reject);
      });
    });
  });

  describe('CORS Validation', () => {
    it('should reject connections from invalid origins', () => {
      // This test requires mocking the WebSocket constructor with custom headers
      // In a real scenario, you'd test this with actual HTTP upgrade requests
      
      // For now, we'll test that the validation function exists and works
      
      expect(validateWebSocketOrigin('http://malicious-site.com')).toBe(false);
      expect(validateWebSocketOrigin('http://localhost:5173')).toBe(true);
      expect(validateWebSocketOrigin(undefined)).toBe(true);
    });
  });

  describe('Heartbeat Mechanism', () => {
    beforeEach(async () => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      return new Promise<void>((resolve, reject) => {
        testClient.on('open', () => resolve());
        testClient.on('error', reject);
      });
    });

    it('should respond to heartbeat messages', async () => {
      return new Promise<void>((resolve, reject) => {
        testClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          // Look for pong response to our heartbeat
          if (message.type === WebSocketMessageType.PONG) {
            try {
              expect(message.type).toBe(WebSocketMessageType.PONG);
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        testClient.on('error', reject);

        // Send heartbeat after connection is established
        setTimeout(() => {
          const heartbeatMessage = {
            type: WebSocketMessageType.HEARTBEAT,
            timestamp: new Date().toISOString()
          };
          if (testClient.readyState === WebSocket.OPEN) {
            testClient.send(JSON.stringify(heartbeatMessage));
          } else {
            reject(new Error('WebSocket not open'));
          }
        }, 50);
      });
    });

    it('should handle pong messages from clients', async () => {
      return new Promise<void>((resolve, reject) => {
        // Add delay to ensure connection is established, then send pong
        setTimeout(() => {
          const pongMessage = {
            type: WebSocketMessageType.PONG,
            timestamp: new Date().toISOString()
          };
          
          if (testClient.readyState === WebSocket.OPEN) {
            testClient.send(JSON.stringify(pongMessage));
            // If no error occurs after a brief delay, test passes
            setTimeout(() => resolve(), 50);
          } else {
            reject(new Error('WebSocket not open'));
          }
        }, 50);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON messages gracefully', async () => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      return new Promise<void>((resolve, reject) => {
        testClient.on('open', () => {
          // Wait for connection to be fully established
          setTimeout(() => {
            if (testClient.readyState === WebSocket.OPEN) {
              // Send invalid JSON
              testClient.send('invalid-json');
              
              // Client should remain connected
              setTimeout(() => {
                try {
                  expect(testClient.readyState).toBe(WebSocket.OPEN);
                  resolve();
                } catch (error) {
                  reject(error);
                }
              }, 100);
            } else {
              reject(new Error('WebSocket not open'));
            }
          }, 50);
        });

        testClient.on('error', reject);
      });
    });

    it('should handle server shutdown gracefully', async () => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test timeout'));
        }, 5000);
        
        testClient.on('open', async () => {
          try {
            await wsManager.stop();
            clearTimeout(timeout);
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
        
        testClient.on('close', () => {
          clearTimeout(timeout);
          resolve(); // Connection closed during shutdown is acceptable
        });
        
        testClient.on('error', (error) => {
          clearTimeout(timeout);
          // Don't reject on connection errors during shutdown
          resolve();
        });
      });
    });
  });

  describe('Client Information', () => {
    it('should track client metadata', async () => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`, {
        headers: {
          'User-Agent': 'Test-WebSocket-Client/1.0'
        }
      });
      
      return new Promise<void>((resolve, reject) => {
        testClient.on('open', () => {
          try {
            const clients = wsManager.getClientList();
            expect(clients.length).toBe(1);
            expect(clients[0]).toHaveProperty('id');
            expect(clients[0]).toHaveProperty('isAlive');
            expect(clients[0]).toHaveProperty('connectedAt');
            expect(clients[0].metadata).toHaveProperty('userAgent');
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        testClient.on('error', reject);
      });
    });
  });
});