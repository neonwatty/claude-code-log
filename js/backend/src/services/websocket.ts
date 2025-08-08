import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import config from '../config/env';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData,
  TypedSocket,
  SessionUpdate,
  ConnectionLimits
} from '../types/websocket';
import { ConnectionManager } from './connectionManager';

class WebSocketService {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private connectionManager: ConnectionManager;

  constructor(httpServer: HttpServer, connectionLimits?: Partial<ConnectionLimits>) {
    this.io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      // Connection state recovery for better reliability
      connectionStateRecovery: {},
      // Configure transport options
      transports: ['websocket', 'polling'],
    });

    // Initialize connection manager
    this.connectionManager = new ConnectionManager(this.io, connectionLimits);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: TypedSocket) => {
      // Get client info
      const ipAddress = socket.handshake.address;
      const userAgent = socket.handshake.headers['user-agent'];
      
      console.log(`WebSocket client connected: ${socket.id} from ${ipAddress}`);
      
      // Check connection limits
      const connectionCheck = this.connectionManager.canConnect(undefined, ipAddress);
      if (!connectionCheck.allowed) {
        console.log(`Connection rejected for ${socket.id}: ${connectionCheck.reason}`);
        socket.emit('connection-limit-exceeded', { 
          limit: 0, 
          current: 0 
        });
        socket.disconnect(true);
        return;
      }

      // Initialize connection tracking
      const connectionId = this.connectionManager.initializeConnection(socket, ipAddress, userAgent);
      console.log(`Connection ${connectionId} initialized for socket ${socket.id}`);

      // Handle client authentication
      socket.on('authenticate', (data) => {
        console.log(`Client ${socket.id} authenticating with:`, data);
        
        // Handle reconnection if token provided
        if (data.reconnectToken) {
          const reconnected = this.connectionManager.handleReconnection(socket, data.reconnectToken);
          if (reconnected) {
            console.log(`Client ${socket.id} reconnected successfully`);
            socket.emit('authenticated', { 
              success: true, 
              connectionId: socket.data.connectionId,
              reconnectToken: this.connectionManager.generateReconnectToken(socket)
            });
            return;
          } else {
            console.log(`Invalid reconnect token for ${socket.id}`);
          }
        }

        // Check connection limits for this user
        if (data.userId) {
          const userConnectionCheck = this.connectionManager.canConnect(data.userId, socket.data.ipAddress);
          if (!userConnectionCheck.allowed) {
            socket.emit('authenticated', { 
              success: false, 
              error: userConnectionCheck.reason 
            });
            return;
          }
        }
        
        // Authenticate connection
        this.connectionManager.authenticateConnection(socket, data.userId!, data.sessionId);
        
        // Join user-specific room for targeted messages
        if (data.userId) {
          socket.join(`user:${data.userId}`);
        }
        
        // Generate reconnect token
        const reconnectToken = this.connectionManager.generateReconnectToken(socket);
        
        // Confirm authentication
        socket.emit('authenticated', { 
          success: true,
          connectionId: socket.data.connectionId,
          reconnectToken 
        });
      });

      // Handle session-related events
      socket.on('join-session', (sessionId: string) => {
        console.log(`Client ${socket.id} joining session: ${sessionId}`);
        socket.join(`session:${sessionId}`);
        
        // Notify other clients in the session
        socket.to(`session:${sessionId}`).emit('user-joined', {
          socketId: socket.id,
          userId: socket.data?.userId,
        });
      });

      socket.on('leave-session', (sessionId: string) => {
        console.log(`Client ${socket.id} leaving session: ${sessionId}`);
        socket.leave(`session:${sessionId}`);
        
        // Notify other clients in the session
        socket.to(`session:${sessionId}`).emit('user-left', {
          socketId: socket.id,
          userId: socket.data?.userId,
        });
      });

      // Handle real-time updates
      socket.on('session-update', (data) => {
        // Check rate limit
        if (!this.connectionManager.checkRateLimit(socket)) {
          socket.emit('error-message', {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please slow down.'
          });
          return;
        }

        console.log(`Session update from ${socket.id}:`, data);
        
        // Broadcast to all clients in the session except sender
        socket.to(`session:${data.sessionId}`).emit('session-updated', {
          update: data.update,
          fromSocket: socket.id,
          timestamp: new Date().toISOString(),
        });
      });

      // Handle ping/pong for connection monitoring
      socket.on('ping', (callback) => {
        if (callback) callback('pong');
      });

      // Handle heartbeat responses (enhanced monitoring)
      socket.on('heartbeat', () => {
        // Heartbeat handling is managed by ConnectionManager
      });

      // Handle reconnection token requests
      socket.on('request-reconnect-token', (callback) => {
        const token = this.connectionManager.generateReconnectToken(socket);
        callback(token);
      });

      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        console.log(`Client ${socket.id} disconnected: ${reason}`);
        
        // Clean up any session memberships
        const rooms = [...socket.rooms].filter(room => room !== socket.id);
        rooms.forEach(room => {
          socket.to(room).emit('user-left', {
            socketId: socket.id,
            userId: socket.data?.userId,
            reason,
          });
        });

        // Handle connection cleanup through ConnectionManager
        this.connectionManager.handleDisconnection(socket);
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        console.error(`WebSocket error from ${socket.id}:`, error);
      });
    });

    // Handle server-level events
    this.io.engine.on('connection_error', (err: any) => {
      console.error('WebSocket connection error:', err);
    });
  }

  // Public methods for broadcasting messages
  public broadcastToSession(sessionId: string, event: keyof ServerToClientEvents | string, data: any): void {
    (this.io.to(`session:${sessionId}`) as any).emit(event, data);
  }

  public broadcastToUser(userId: string, event: keyof ServerToClientEvents | string, data: any): void {
    (this.io.to(`user:${userId}`) as any).emit(event, data);
  }

  public broadcastToAll(event: keyof ServerToClientEvents | string, data: any): void {
    (this.io as any).emit(event, data);
  }

  public getConnectedClients(): number {
    return this.io.engine.clientsCount;
  }

  public getSessionClients(sessionId: string): Promise<string[]> {
    return this.io.in(`session:${sessionId}`).allSockets().then(sockets => [...sockets]);
  }

  // Connection Management methods
  public getConnectionStats() {
    return this.connectionManager.getStats();
  }

  public getConnectionInfo(socketId: string) {
    return this.connectionManager.getConnectionInfo(socketId);
  }

  public getUserConnections(userId: string) {
    return this.connectionManager.getUserConnections(userId);
  }

  public getIPConnections(ipAddress: string) {
    return this.connectionManager.getIPConnections(ipAddress);
  }

  public updateConnectionLimits(limits: Partial<ConnectionLimits>) {
    this.connectionManager.updateLimits(limits);
  }

  // Graceful shutdown
  public async close(): Promise<void> {
    return new Promise((resolve) => {
      // Clean up connection manager resources
      this.connectionManager.cleanupExpiredTokens();
      
      this.io.close(() => {
        console.log('WebSocket server closed');
        resolve();
      });
    });
  }

  // Getter for the Socket.IO instance (for advanced usage)
  public get server(): SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
    return this.io;
  }
}

export default WebSocketService;