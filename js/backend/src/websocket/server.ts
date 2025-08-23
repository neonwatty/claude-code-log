import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { ConnectionManager } from './connectionManager';
import { WebSocketEventMessage, WebSocketMessageType } from './messageTypes';
import { validateWebSocketOrigin } from '../middleware/cors';

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private connectionManager: ConnectionManager;
  private server: Server | null = null;

  constructor() {
    this.connectionManager = new ConnectionManager();
  }

  public async start(port: number, httpServer?: Server): Promise<void> {
    try {
      if (httpServer) {
        // Use existing HTTP server
        this.wss = new WebSocketServer({ 
          server: httpServer,
          path: '/ws'
        });
        this.server = httpServer;
        console.log(`WebSocket server attached to existing HTTP server at /ws`);
      } else {
        // Create standalone WebSocket server
        this.wss = new WebSocketServer({ 
          port,
          path: '/ws'
        });
        console.log(`WebSocket server started on port ${port}`);
      }

      this.setupWebSocketServer();
    } catch (error) {
      console.error('Failed to start WebSocket server:', error);
      throw error;
    }
  }

  private setupWebSocketServer(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log('New WebSocket connection received');
      
      // Validate origin for CORS compliance
      const origin = request.headers.origin;
      if (!validateWebSocketOrigin(origin)) {
        console.warn(`WebSocket connection rejected - invalid origin: ${origin}`);
        ws.close(1008, 'Origin not allowed');
        return;
      }
      
      // Extract client metadata
      const metadata = {
        userAgent: request.headers['user-agent'],
        ip: request.socket.remoteAddress,
        origin: origin
      };

      // Add client to connection manager
      const clientId = this.connectionManager.addClient(ws, metadata);
      
      // Send welcome message
      const welcomeMessage: WebSocketEventMessage = {
        type: WebSocketMessageType.CONNECT,
        timestamp: new Date().toISOString(),
        data: {
          clientId,
          message: 'Connected to Claude Code Log WebSocket server',
          endpoints: {
            heartbeat: 'Send heartbeat messages to maintain connection',
            events: 'Receive real-time session and project updates'
          }
        }
      };
      
      ws.send(JSON.stringify(welcomeMessage));
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    this.wss.on('close', () => {
      console.log('WebSocket server closed');
    });
  }

  public broadcast(message: WebSocketEventMessage): void {
    this.connectionManager.broadcast(message);
  }

  public sendToClient(clientId: string, message: WebSocketEventMessage): boolean {
    return this.connectionManager.sendToClient(clientId, message);
  }

  public getActiveClientCount(): number {
    return this.connectionManager.getActiveClientCount();
  }

  public getClientList() {
    return this.connectionManager.getClientList();
  }

  // Event broadcasting methods
  public broadcastSessionCreated(sessionId: string, cwd: string): void {
    this.broadcast({
      type: WebSocketMessageType.SESSION_CREATED,
      timestamp: new Date().toISOString(),
      data: {
        sessionId,
        cwd,
        timestamp: new Date().toISOString()
      }
    });
  }

  public broadcastSessionUpdated(sessionId: string, cwd: string, entryCount: number): void {
    this.broadcast({
      type: WebSocketMessageType.SESSION_UPDATED,
      timestamp: new Date().toISOString(),
      data: {
        sessionId,
        cwd,
        entryCount,
        lastActivity: new Date().toISOString()
      }
    });
  }

  public broadcastSessionDeleted(sessionId: string): void {
    this.broadcast({
      type: WebSocketMessageType.SESSION_DELETED,
      timestamp: new Date().toISOString(),
      data: {
        sessionId
      }
    });
  }

  public broadcastProjectUpdated(projectPath: string, sessionCount: number): void {
    this.broadcast({
      type: WebSocketMessageType.PROJECT_UPDATED,
      timestamp: new Date().toISOString(),
      data: {
        projectPath,
        sessionCount,
        lastActivity: new Date().toISOString()
      }
    });
  }

  public broadcastFileChanged(filePath: string, changeType: 'created' | 'modified' | 'deleted'): void {
    this.broadcast({
      type: WebSocketMessageType.FILE_CHANGED,
      timestamp: new Date().toISOString(),
      data: {
        filePath,
        changeType
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Destroy connection manager first to clean up clients
      this.connectionManager.destroy();
      
      if (this.wss) {
        this.wss.close(() => {
          console.log('WebSocket server stopped');
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Singleton instance
let webSocketManager: WebSocketManager | null = null;

export function getWebSocketManager(): WebSocketManager {
  if (!webSocketManager) {
    webSocketManager = new WebSocketManager();
  }
  return webSocketManager;
}

export function createWebSocketManager(): WebSocketManager {
  webSocketManager = new WebSocketManager();
  return webSocketManager;
}