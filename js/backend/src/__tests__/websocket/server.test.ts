import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { WebSocketManager } from '../../websocket/server';
import { WebSocketMessageType } from '../../websocket/messageTypes';
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
    if (testClient && testClient.readyState === WebSocket.OPEN) {
      testClient.close();
    }
    
    await wsManager.stop();
    
    return new Promise<void>((resolve) => {
      httpServer.close(() => {
        resolve();
      });
    });
  });

  describe('Connection Management', () => {
    it('should accept WebSocket connections', (done) => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      testClient.on('open', () => {
        expect(wsManager.getActiveClientCount()).toBe(1);
        done();
      });

      testClient.on('error', done);
    });

    it('should send welcome message on connection', (done) => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      testClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe(WebSocketMessageType.CONNECT);
        expect(message.data).toHaveProperty('clientId');
        expect(message.data).toHaveProperty('message');
        expect(message.data.message).toContain('Connected to Claude Code Log WebSocket server');
        done();
      });

      testClient.on('error', done);
    });

    it('should track multiple client connections', (done) => {
      const clients: WebSocket[] = [];
      let connectedCount = 0;

      const createClient = () => {
        const client = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
        clients.push(client);
        
        client.on('open', () => {
          connectedCount++;
          if (connectedCount === 3) {
            expect(wsManager.getActiveClientCount()).toBe(3);
            
            // Clean up clients
            clients.forEach(c => c.close());
            done();
          }
        });
        
        client.on('error', done);
      };

      // Create 3 clients
      createClient();
      createClient();
      createClient();
    });

    it('should handle client disconnection', (done) => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      testClient.on('open', () => {
        expect(wsManager.getActiveClientCount()).toBe(1);
        testClient.close();
      });

      testClient.on('close', () => {
        // Give some time for cleanup
        setTimeout(() => {
          expect(wsManager.getActiveClientCount()).toBe(0);
          done();
        }, 100);
      });

      testClient.on('error', done);
    });
  });

  describe('Message Broadcasting', () => {
    beforeEach((done) => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      testClient.on('open', () => done());
      testClient.on('error', done);
    });

    it('should broadcast session created events', (done) => {
      let messageCount = 0;
      
      testClient.on('message', (data) => {
        messageCount++;
        if (messageCount === 1) {
          // Skip welcome message
          return;
        }
        
        const message = JSON.parse(data.toString());
        expect(message.type).toBe(WebSocketMessageType.SESSION_CREATED);
        expect(message.data).toHaveProperty('sessionId', 'test-session-123');
        expect(message.data).toHaveProperty('cwd', '/test/project');
        done();
      });

      // Trigger broadcast
      wsManager.broadcastSessionCreated('test-session-123', '/test/project');
    });

    it('should broadcast session updated events', (done) => {
      let messageCount = 0;
      
      testClient.on('message', (data) => {
        messageCount++;
        if (messageCount === 1) {
          // Skip welcome message
          return;
        }
        
        const message = JSON.parse(data.toString());
        expect(message.type).toBe(WebSocketMessageType.SESSION_UPDATED);
        expect(message.data).toHaveProperty('sessionId', 'test-session-456');
        expect(message.data).toHaveProperty('entryCount', 5);
        done();
      });

      // Trigger broadcast
      wsManager.broadcastSessionUpdated('test-session-456', '/test/project', 5);
    });

    it('should broadcast file changed events', (done) => {
      let messageCount = 0;
      
      testClient.on('message', (data) => {
        messageCount++;
        if (messageCount === 1) {
          // Skip welcome message
          return;
        }
        
        const message = JSON.parse(data.toString());
        expect(message.type).toBe(WebSocketMessageType.FILE_CHANGED);
        expect(message.data).toHaveProperty('filePath', '/test/file.jsonl');
        expect(message.data).toHaveProperty('changeType', 'modified');
        done();
      });

      // Trigger broadcast
      wsManager.broadcastFileChanged('/test/file.jsonl', 'modified');
    });

    it('should broadcast to multiple clients', (done) => {
      const client2 = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let client1Received = false;
      let client2Received = false;
      
      client2.on('open', () => {
        let messageCount1 = 0;
        let messageCount2 = 0;
        
        testClient.on('message', (data) => {
          messageCount1++;
          if (messageCount1 === 1) return; // Skip welcome
          
          const message = JSON.parse(data.toString());
          expect(message.type).toBe(WebSocketMessageType.SESSION_CREATED);
          client1Received = true;
          if (client1Received && client2Received) {
            client2.close();
            done();
          }
        });
        
        client2.on('message', (data) => {
          messageCount2++;
          if (messageCount2 === 1) return; // Skip welcome
          
          const message = JSON.parse(data.toString());
          expect(message.type).toBe(WebSocketMessageType.SESSION_CREATED);
          client2Received = true;
          if (client1Received && client2Received) {
            client2.close();
            done();
          }
        });
        
        // Trigger broadcast to both clients
        wsManager.broadcastSessionCreated('test-session-multi', '/test/project');
      });
      
      client2.on('error', done);
    });
  });

  describe('CORS Validation', () => {
    it('should reject connections from invalid origins', (done) => {
      // This test requires mocking the WebSocket constructor with custom headers
      // In a real scenario, you'd test this with actual HTTP upgrade requests
      
      // For now, we'll test that the validation function exists and works
      const { validateWebSocketOrigin } = require('../../middleware/cors');
      
      expect(validateWebSocketOrigin('http://malicious-site.com')).toBe(false);
      expect(validateWebSocketOrigin('http://localhost:5173')).toBe(true);
      expect(validateWebSocketOrigin(undefined)).toBe(true);
      
      done();
    });
  });

  describe('Heartbeat Mechanism', () => {
    beforeEach((done) => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      testClient.on('open', () => done());
      testClient.on('error', done);
    });

    it('should respond to heartbeat messages', (done) => {
      let messageCount = 0;
      
      testClient.on('message', (data) => {
        messageCount++;
        if (messageCount === 1) {
          // Skip welcome message, send heartbeat
          const heartbeatMessage = {
            type: WebSocketMessageType.HEARTBEAT,
            timestamp: new Date().toISOString()
          };
          testClient.send(JSON.stringify(heartbeatMessage));
          return;
        }
        
        // Should receive pong response
        const message = JSON.parse(data.toString());
        expect(message.type).toBe(WebSocketMessageType.PONG);
        done();
      });
    });

    it('should handle pong messages from clients', (done) => {
      let messageCount = 0;
      
      testClient.on('message', (data) => {
        messageCount++;
        if (messageCount === 1) {
          // Skip welcome message, send pong
          const pongMessage = {
            type: WebSocketMessageType.PONG,
            timestamp: new Date().toISOString()
          };
          testClient.send(JSON.stringify(pongMessage));
          
          // If no error occurs, test passes
          setTimeout(done, 100);
          return;
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON messages gracefully', (done) => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      testClient.on('open', () => {
        // Send invalid JSON
        testClient.send('invalid-json');
        
        // Client should remain connected
        setTimeout(() => {
          expect(testClient.readyState).toBe(WebSocket.OPEN);
          done();
        }, 100);
      });

      testClient.on('error', done);
    });

    it('should handle server shutdown gracefully', async () => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      return new Promise<void>((resolve, reject) => {
        testClient.on('open', async () => {
          try {
            await wsManager.stop();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        
        testClient.on('error', reject);
      });
    });
  });

  describe('Client Information', () => {
    it('should track client metadata', (done) => {
      testClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`, {
        headers: {
          'User-Agent': 'Test-WebSocket-Client/1.0'
        }
      });
      
      testClient.on('open', () => {
        const clients = wsManager.getClientList();
        expect(clients.length).toBe(1);
        expect(clients[0]).toHaveProperty('id');
        expect(clients[0]).toHaveProperty('isAlive');
        expect(clients[0]).toHaveProperty('connectedAt');
        expect(clients[0].metadata).toHaveProperty('userAgent');
        done();
      });

      testClient.on('error', done);
    });
  });
});