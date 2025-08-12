import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { randomUUID } from 'crypto';
import config from '../config/env';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData,
  TypedSocket,
  SessionUpdate,
  ConnectionLimits,
  CLIProcessConfig,
  CLIProcessInfo,
  ParsedCLIOutput
} from '../types/websocket';
import { ConnectionManager } from './connectionManager';
import { EventManager } from './eventManager';
import CLIIntegration from './cli-integration';
import WebSocketContextEvents from './websocket-context-events';

class WebSocketService {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private connectionManager: ConnectionManager;
  private eventManager: EventManager;
  private cliIntegration: CLIIntegration;
  private contextEvents: WebSocketContextEvents;

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
    
    // Initialize event manager
    this.eventManager = new EventManager(this.io);

    // Initialize CLI integration
    this.cliIntegration = new CLIIntegration();

    // Initialize context events
    this.contextEvents = new WebSocketContextEvents(this.io);

    this.setupEventHandlers();
    this.setupCLIIntegrationListeners();
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

        // Publish user joined event
        if (socket.data.userId) {
          const userJoinedEvent = this.eventManager.createUserActionEvent(
            'user:joined',
            {
              userId: socket.data.userId,
              action: 'joined_session',
              target: sessionId
            },
            {
              userId: socket.data.userId,
              sessionId: sessionId
            }
          );
          this.eventManager.publishEvent(userJoinedEvent, socket);
        }
      });

      socket.on('leave-session', (sessionId: string) => {
        console.log(`Client ${socket.id} leaving session: ${sessionId}`);
        socket.leave(`session:${sessionId}`);
        
        // Notify other clients in the session
        socket.to(`session:${sessionId}`).emit('user-left', {
          socketId: socket.id,
          userId: socket.data?.userId,
        });

        // Publish user left event
        if (socket.data.userId) {
          const userLeftEvent = this.eventManager.createUserActionEvent(
            'user:left',
            {
              userId: socket.data.userId,
              action: 'left_session',
              target: sessionId
            },
            {
              userId: socket.data.userId,
              sessionId: sessionId
            }
          );
          this.eventManager.publishEvent(userLeftEvent, socket);
        }
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

      // Event system handlers
      socket.on('subscribe-events', (filter, callback) => {
        const subscriptionId = this.eventManager.subscribe(socket.id, filter);
        socket.emit('subscription-created', { subscriptionId });
        callback(subscriptionId);
      });

      socket.on('unsubscribe-events', (subscriptionId) => {
        const removed = this.eventManager.unsubscribe(subscriptionId);
        if (removed) {
          socket.emit('subscription-removed', { subscriptionId });
        }
      });

      socket.on('publish-event', async (eventData) => {
        // Only allow authenticated users to publish events
        if (!socket.data.userId) {
          socket.emit('error-message', {
            code: 'UNAUTHORIZED',
            message: 'Authentication required to publish events'
          });
          return;
        }

        // Check rate limit
        if (!this.connectionManager.checkRateLimit(socket)) {
          socket.emit('error-message', {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many events. Please slow down.'
          });
          return;
        }

        // Create event with user context and required fields
        const fullEvent = {
          ...eventData,
          id: eventData.id || randomUUID(),
          userId: socket.data.userId,
          sessionId: socket.data.sessionId,
          timestamp: eventData.timestamp || new Date().toISOString()
        } as any;

        await this.eventManager.publishEvent(fullEvent, socket);
      });

      socket.on('request-event-history', (filter, page = 1, pageSize = 50, callback) => {
        const history = this.eventManager.getEventHistory(filter, page, pageSize);
        if (callback) {
          callback(history);
        } else {
          socket.emit('event-history' as any, history);
        }
      });

      socket.on('request-event-replay', async (filter, startTime) => {
        const startDate = startTime ? new Date(startTime) : undefined;
        const replayCount = await this.eventManager.replayEvents(socket.id, filter, startDate);
        console.log(`Replayed ${replayCount} events for socket ${socket.id}`);
      });

      // Handle CLI process events
      socket.on('cli-spawn', async (config: CLIProcessConfig, callback) => {
        if (!socket.data.userId) {
          callback({ success: false, error: 'Authentication required' });
          return;
        }

        // Check rate limit
        if (!this.connectionManager.checkRateLimit(socket)) {
          callback({ success: false, error: 'Rate limit exceeded' });
          return;
        }

        try {
          const processId = await this.cliIntegration.spawnProcess(config);
          callback({ success: true, processId });
        } catch (error) {
          callback({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      });

      socket.on('cli-terminate', async (processId: string, callback) => {
        if (!socket.data.userId) {
          callback({ success: false, error: 'Authentication required' });
          return;
        }

        try {
          const success = await this.cliIntegration.terminateProcess(processId);
          callback({ success, error: success ? undefined : 'Failed to terminate process' });
        } catch (error) {
          callback({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      });

      socket.on('cli-input', async (processId: string, data: string) => {
        if (!socket.data.userId) {
          socket.emit('error-message', {
            code: 'UNAUTHORIZED',
            message: 'Authentication required for CLI input'
          });
          return;
        }

        // Check rate limit
        if (!this.connectionManager.checkRateLimit(socket)) {
          socket.emit('error-message', {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many CLI inputs. Please slow down.'
          });
          return;
        }

        try {
          await this.cliIntegration.sendInput(processId, data);
        } catch (error) {
          socket.emit('error-message', {
            code: 'CLI_INPUT_ERROR',
            message: error instanceof Error ? error.message : String(error)
          });
        }
      });

      socket.on('cli-get-processes', (callback) => {
        if (!socket.data.userId) {
          callback([]);
          return;
        }

        try {
          const processes = this.cliIntegration.getAllProcesses();
          callback(processes);
        } catch (error) {
          console.error('Error getting CLI processes:', error);
          callback([]);
        }
      });

      socket.on('cli-get-process', (processId: string, callback) => {
        if (!socket.data.userId) {
          callback(null);
          return;
        }

        try {
          const process = this.cliIntegration.getProcessInfo(processId);
          callback(process);
        } catch (error) {
          console.error('Error getting CLI process:', error);
          callback(null);
        }
      });

      // Set up context event handlers
      this.contextEvents.setupContextEventHandlers(socket);

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
        
        // Clean up event subscriptions
        this.eventManager.unsubscribeSocket(socket.id);
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

  private setupCLIIntegrationListeners(): void {
    // Listen to CLI integration events and broadcast to clients
    this.cliIntegration.on('process-started', (processId, processInfo) => {
      this.io.emit('cli-process-started', { processId, processInfo });
    });

    this.cliIntegration.on('process-stopped', (processId, processInfo) => {
      this.io.emit('cli-process-stopped', { processId, processInfo });
    });

    this.cliIntegration.on('process-error', (processId, processInfo, error) => {
      this.io.emit('cli-process-error', { processId, processInfo, error });
    });

    this.cliIntegration.on('process-timeout', (processId, processInfo) => {
      this.io.emit('cli-process-timeout', { processId, processInfo });
    });

    this.cliIntegration.on('stdout-data', (processId, content, timestamp, parsed) => {
      this.io.emit('cli-stdout-data', { processId, content, timestamp, parsed });
    });

    this.cliIntegration.on('stderr-data', (processId, content, timestamp, parsed) => {
      this.io.emit('cli-stderr-data', { processId, content, timestamp, parsed });
    });

    this.cliIntegration.on('parsed-output', (processId, output) => {
      this.io.emit('cli-parsed-output', { processId, output });
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

  // Event management methods
  public async publishEvent(event: any, socket?: TypedSocket) {
    return this.eventManager.publishEvent(event, socket);
  }

  public getEventStats() {
    return this.eventManager.getEventStats();
  }

  public getEventHistory(filter?: any, page?: number, pageSize?: number) {
    return this.eventManager.getEventHistory(filter, page, pageSize);
  }

  public addEventMiddleware(middleware: any) {
    this.eventManager.addMiddleware(middleware);
  }

  public cleanupEventHistory(olderThan: Date) {
    return this.eventManager.cleanupHistory(olderThan);
  }

  // CLI Integration methods
  public getCLIStats() {
    return this.cliIntegration.getStats();
  }

  public async cleanupCLI() {
    return this.cliIntegration.cleanup();
  }

  public async recoverCLISessions() {
    return this.cliIntegration.recoverSessions();
  }

  // Context transfer methods
  public getContextTransferStats() {
    return this.contextEvents.getTransferStats();
  }

  public getSocketContextTransfers(socketId: string) {
    return this.contextEvents.getSocketTransfers(socketId);
  }

  public cancelContextTransfer(transferId: string, socketId: string) {
    return this.contextEvents.cancelTransfer(transferId, socketId);
  }

  // Graceful shutdown
  public async close(): Promise<void> {
    return new Promise(async (resolve) => {
      // Shutdown CLI integration first
      await this.cliIntegration.shutdown();
      
      // Shutdown context events
      await this.contextEvents.shutdown();
      
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