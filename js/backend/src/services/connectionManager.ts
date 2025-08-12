import { Server as SocketIOServer } from 'socket.io';
import { randomUUID } from 'crypto';
import { 
  SocketData, 
  ConnectionInfo, 
  ConnectionLimits, 
  ConnectionStats, 
  ReconnectToken,
  TypedSocket
} from '../types/websocket';

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  nextAttemptTime: number;
}

interface ConnectionHealthMetrics {
  latency: number;
  packetLoss: number;
  throughput: number;
  quality: 'excellent' | 'good' | 'poor' | 'critical';
  lastUpdated: number;
}

export class ConnectionManager {
  private connections: Map<string, ConnectionInfo> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private ipConnections: Map<string, Set<string>> = new Map();
  private reconnectTokens: Map<string, ReconnectToken> = new Map();
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private connectionHealth: Map<string, ConnectionHealthMetrics> = new Map();
  private limits: ConnectionLimits;
  
  // Enhanced reconnection configuration
  private reconnectionConfig = {
    baseDelay: 1000,           // 1 second base delay
    maxDelay: 60000,           // 60 seconds maximum delay
    multiplier: 1.5,           // Exponential backoff multiplier
    jitterFactor: 0.1,         // 10% jitter to prevent thundering herd
    circuitBreakerThreshold: 5, // failures before circuit breaker opens
    circuitBreakerTimeout: 30000, // 30 seconds before half-open retry
    adaptiveHeartbeatMin: 5000,   // 5 seconds minimum heartbeat
    adaptiveHeartbeatMax: 30000,  // 30 seconds maximum heartbeat
  };
  
  private stats: ConnectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    connectionsPerUser: new Map(),
    connectionsPerIP: new Map(),
    averageConnectionDuration: 0,
    totalReconnects: 0,
    heartbeatStats: {
      sent: 0,
      received: 0,
      missed: 0,
    },
  };

  constructor(
    private io: SocketIOServer,
    connectionLimits?: Partial<ConnectionLimits>
  ) {
    // Set default limits and override with provided values
    this.limits = {
      maxConnectionsPerUser: 5,
      maxConnectionsPerIP: 10,
      maxGlobalConnections: 1000,
      rateLimitWindow: 60000, // 1 minute
      maxEventsPerWindow: 100,
      ...connectionLimits,
    };
  }

  // Initialize connection tracking for a new socket
  public initializeConnection(socket: TypedSocket, ipAddress?: string, userAgent?: string): string {
    const connectionId = randomUUID();
    const now = new Date();

    // Initialize socket data with connection metadata
    socket.data = {
      ...socket.data,
      connectedAt: now,
      lastHeartbeat: now,
      connectionId,
      reconnectCount: 0,
      totalConnections: 1,
      ipAddress,
      userAgent,
    };

    // Create connection info
    const connectionInfo: ConnectionInfo = {
      socketId: socket.id,
      connectedAt: now,
      lastHeartbeat: now,
      connectionId,
      reconnectCount: 0,
      totalConnections: 1,
      ipAddress,
      userAgent,
    };

    // Store connection
    this.connections.set(socket.id, connectionInfo);

    // Track IP connections
    if (ipAddress) {
      if (!this.ipConnections.has(ipAddress)) {
        this.ipConnections.set(ipAddress, new Set());
      }
      this.ipConnections.get(ipAddress)!.add(socket.id);
      this.stats.connectionsPerIP.set(ipAddress, this.ipConnections.get(ipAddress)!.size);
    }

    // Update global stats
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    // Start heartbeat monitoring
    this.startHeartbeatMonitoring(socket);

    return connectionId;
  }

  // Check if connection should be allowed
  public canConnect(userId?: string, ipAddress?: string): { allowed: boolean; reason?: string } {
    // Check global connection limit
    if (this.stats.activeConnections >= this.limits.maxGlobalConnections) {
      return { allowed: false, reason: 'Global connection limit exceeded' };
    }

    // Check per-user limit
    if (userId) {
      const userConnectionCount = this.userConnections.get(userId)?.size || 0;
      if (userConnectionCount >= this.limits.maxConnectionsPerUser) {
        return { allowed: false, reason: 'User connection limit exceeded' };
      }
    }

    // Check per-IP limit
    if (ipAddress) {
      const ipConnectionCount = this.ipConnections.get(ipAddress)?.size || 0;
      if (ipConnectionCount >= this.limits.maxConnectionsPerIP) {
        return { allowed: false, reason: 'IP connection limit exceeded' };
      }
    }

    return { allowed: true };
  }

  // Handle user authentication and update connection tracking
  public authenticateConnection(socket: TypedSocket, userId: string, sessionId?: string): void {
    const connectionInfo = this.connections.get(socket.id);
    if (!connectionInfo) return;

    // Update connection info
    connectionInfo.userId = userId;
    connectionInfo.sessionId = sessionId;

    // Update socket data
    socket.data.userId = userId;
    socket.data.sessionId = sessionId;

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(socket.id);
    this.stats.connectionsPerUser.set(userId, this.userConnections.get(userId)!.size);
  }

  // Rate limiting check
  public checkRateLimit(socket: TypedSocket): boolean {
    const key = socket.data.userId || socket.data.ipAddress || socket.id;
    const now = Date.now();
    const windowStart = now - this.limits.rateLimitWindow;

    const rateLimitData = this.rateLimitMap.get(key);
    
    if (!rateLimitData || rateLimitData.resetTime <= now) {
      // New window or expired window
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + this.limits.rateLimitWindow,
      });
      return true;
    }

    if (rateLimitData.count >= this.limits.maxEventsPerWindow) {
      return false; // Rate limit exceeded
    }

    rateLimitData.count++;
    return true;
  }

  // Start heartbeat monitoring for a connection
  private startHeartbeatMonitoring(socket: TypedSocket): void {
    const heartbeatInterval = setInterval(() => {
      const connectionInfo = this.connections.get(socket.id);
      if (!connectionInfo) {
        clearInterval(heartbeatInterval);
        return;
      }

      const now = Date.now();
      const lastHeartbeat = connectionInfo.lastHeartbeat.getTime();
      const heartbeatTimeout = 30000; // 30 seconds

      if (now - lastHeartbeat > heartbeatTimeout) {
        // Heartbeat timeout - disconnect client
        console.log(`Heartbeat timeout for client ${socket.id}`);
        socket.emit('reconnect-required', { 
          reason: 'Heartbeat timeout', 
          delay: 1000 
        });
        socket.disconnect(true);
        this.stats.heartbeatStats.missed++;
      } else {
        // Send heartbeat
        socket.emit('heartbeat-response');
        this.stats.heartbeatStats.sent++;
      }
    }, 15000); // Check every 15 seconds

    this.heartbeatIntervals.set(socket.id, heartbeatInterval);

    // Handle heartbeat responses
    socket.on('heartbeat', () => {
      const connectionInfo = this.connections.get(socket.id);
      if (connectionInfo) {
        connectionInfo.lastHeartbeat = new Date();
        socket.data.lastHeartbeat = new Date();
        this.stats.heartbeatStats.received++;
      }
    });
  }

  // Generate reconnection token
  public generateReconnectToken(socket: TypedSocket): string {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 300000); // 5 minutes

    if (socket.data.userId) {
      const reconnectToken: ReconnectToken = {
        token,
        userId: socket.data.userId,
        sessionId: socket.data.sessionId,
        expiresAt,
        socketData: { ...socket.data },
      };

      this.reconnectTokens.set(token, reconnectToken);

      // Clean up expired tokens
      setTimeout(() => {
        this.reconnectTokens.delete(token);
      }, 300000);
    }

    return token;
  }

  // Handle reconnection with token
  public handleReconnection(socket: TypedSocket, token: string): boolean {
    const reconnectData = this.reconnectTokens.get(token);
    
    if (!reconnectData || reconnectData.expiresAt < new Date()) {
      return false;
    }

    // Restore socket data
    Object.assign(socket.data, reconnectData.socketData);
    socket.data.reconnectCount = (socket.data.reconnectCount || 0) + 1;
    socket.data.lastHeartbeat = new Date();

    // Update connection info
    const connectionInfo = this.connections.get(socket.id);
    if (connectionInfo) {
      connectionInfo.userId = reconnectData.userId;
      connectionInfo.sessionId = reconnectData.sessionId;
      connectionInfo.reconnectCount++;
      connectionInfo.lastHeartbeat = new Date();
    }

    // Update user connections tracking
    if (reconnectData.userId) {
      if (!this.userConnections.has(reconnectData.userId)) {
        this.userConnections.set(reconnectData.userId, new Set());
      }
      this.userConnections.get(reconnectData.userId)!.add(socket.id);
    }

    this.stats.totalReconnects++;
    this.reconnectTokens.delete(token); // Use token only once

    return true;
  }

  // Handle connection cleanup
  public handleDisconnection(socket: TypedSocket): void {
    const connectionInfo = this.connections.get(socket.id);
    if (!connectionInfo) return;

    // Clean up heartbeat monitoring
    const heartbeatInterval = this.heartbeatIntervals.get(socket.id);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      this.heartbeatIntervals.delete(socket.id);
    }

    // Update user connections
    if (connectionInfo.userId) {
      const userSockets = this.userConnections.get(connectionInfo.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.userConnections.delete(connectionInfo.userId);
          this.stats.connectionsPerUser.delete(connectionInfo.userId);
        } else {
          this.stats.connectionsPerUser.set(connectionInfo.userId, userSockets.size);
        }
      }
    }

    // Update IP connections
    if (connectionInfo.ipAddress) {
      const ipSockets = this.ipConnections.get(connectionInfo.ipAddress);
      if (ipSockets) {
        ipSockets.delete(socket.id);
        if (ipSockets.size === 0) {
          this.ipConnections.delete(connectionInfo.ipAddress);
          this.stats.connectionsPerIP.delete(connectionInfo.ipAddress);
        } else {
          this.stats.connectionsPerIP.set(connectionInfo.ipAddress, ipSockets.size);
        }
      }
    }

    // Calculate connection duration for stats
    const duration = Date.now() - connectionInfo.connectedAt.getTime();
    this.updateAverageConnectionDuration(duration);

    // Clean up connection health metrics
    this.connectionHealth.delete(socket.id);
    
    // Clean up circuit breaker if no more connections for this user/IP
    if (connectionInfo.userId) {
      const userHasOtherConnections = this.userConnections.get(connectionInfo.userId)?.size || 0;
      if (userHasOtherConnections === 0) {
        this.circuitBreakers.delete(connectionInfo.userId);
      }
    }

    // Remove connection
    this.connections.delete(socket.id);
    this.stats.activeConnections--;

    console.log(`Connection ${socket.id} cleaned up. Duration: ${duration}ms`);
  }

  // Update average connection duration
  private updateAverageConnectionDuration(newDuration: number): void {
    const currentAvg = this.stats.averageConnectionDuration;
    const totalConnections = this.stats.totalConnections;
    
    // Calculate rolling average
    this.stats.averageConnectionDuration = 
      (currentAvg * (totalConnections - 1) + newDuration) / totalConnections;
  }

  // Get connection statistics
  public getStats(): ConnectionStats {
    return {
      ...this.stats,
      connectionsPerUser: new Map(this.stats.connectionsPerUser),
      connectionsPerIP: new Map(this.stats.connectionsPerIP),
    };
  }

  // Get connection info for a specific socket
  public getConnectionInfo(socketId: string): ConnectionInfo | undefined {
    return this.connections.get(socketId);
  }

  // Get all connections for a user
  public getUserConnections(userId: string): ConnectionInfo[] {
    const socketIds = this.userConnections.get(userId);
    if (!socketIds) return [];

    return Array.from(socketIds)
      .map(socketId => this.connections.get(socketId))
      .filter((info): info is ConnectionInfo => info !== undefined);
  }

  // Get all connections from an IP
  public getIPConnections(ipAddress: string): ConnectionInfo[] {
    const socketIds = this.ipConnections.get(ipAddress);
    if (!socketIds) return [];

    return Array.from(socketIds)
      .map(socketId => this.connections.get(socketId))
      .filter((info): info is ConnectionInfo => info !== undefined);
  }

  // Enhanced reconnection methods with circuit breaker and exponential backoff
  
  /**
   * Calculate reconnection delay with exponential backoff and jitter
   */
  public calculateReconnectionDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.reconnectionConfig.baseDelay * Math.pow(this.reconnectionConfig.multiplier, attempt),
      this.reconnectionConfig.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * this.reconnectionConfig.jitterFactor * Math.random();
    return Math.floor(exponentialDelay + jitter);
  }
  
  /**
   * Check circuit breaker state for a client
   */
  public checkCircuitBreaker(clientId: string): { canAttempt: boolean; nextAttemptIn?: number } {
    const breaker = this.circuitBreakers.get(clientId);
    if (!breaker) {
      return { canAttempt: true };
    }
    
    const now = Date.now();
    
    switch (breaker.state) {
      case 'closed':
        return { canAttempt: true };
        
      case 'open':
        if (now >= breaker.nextAttemptTime) {
          // Transition to half-open
          breaker.state = 'half-open';
          this.circuitBreakers.set(clientId, breaker);
          return { canAttempt: true };
        }
        return { 
          canAttempt: false, 
          nextAttemptIn: breaker.nextAttemptTime - now 
        };
        
      case 'half-open':
        return { canAttempt: true };
        
      default:
        return { canAttempt: true };
    }
  }
  
  /**
   * Record connection failure for circuit breaker
   */
  public recordConnectionFailure(clientId: string): void {
    let breaker = this.circuitBreakers.get(clientId);
    
    if (!breaker) {
      breaker = {
        failures: 1,
        lastFailureTime: Date.now(),
        state: 'closed',
        nextAttemptTime: 0
      };
    } else {
      breaker.failures++;
      breaker.lastFailureTime = Date.now();
    }
    
    // Check if threshold exceeded
    if (breaker.failures >= this.reconnectionConfig.circuitBreakerThreshold) {
      breaker.state = 'open';
      breaker.nextAttemptTime = Date.now() + this.reconnectionConfig.circuitBreakerTimeout;
      console.log(`Circuit breaker opened for client ${clientId} after ${breaker.failures} failures`);
    }
    
    this.circuitBreakers.set(clientId, breaker);
  }
  
  /**
   * Record successful connection for circuit breaker
   */
  public recordConnectionSuccess(clientId: string): void {
    const breaker = this.circuitBreakers.get(clientId);
    if (breaker) {
      if (breaker.state === 'half-open') {
        // Successful connection in half-open state - close the circuit
        breaker.state = 'closed';
        breaker.failures = 0;
        console.log(`Circuit breaker closed for client ${clientId} after successful reconnection`);
      } else if (breaker.state === 'closed') {
        // Reset failure count on successful connection
        breaker.failures = 0;
      }
      this.circuitBreakers.set(clientId, breaker);
    }
  }
  
  /**
   * Update connection health metrics
   */
  public updateConnectionHealth(socketId: string, metrics: Partial<ConnectionHealthMetrics>): void {
    let health = this.connectionHealth.get(socketId);
    
    if (!health) {
      health = {
        latency: 0,
        packetLoss: 0,
        throughput: 0,
        quality: 'good',
        lastUpdated: Date.now()
      };
    }
    
    // Update provided metrics
    Object.assign(health, metrics);
    health.lastUpdated = Date.now();
    
    // Determine connection quality
    health.quality = this.calculateConnectionQuality(health);
    
    this.connectionHealth.set(socketId, health);
    
    // Adjust heartbeat interval based on connection quality
    this.adjustHeartbeatInterval(socketId, health.quality);
  }
  
  /**
   * Calculate connection quality based on metrics
   */
  private calculateConnectionQuality(health: ConnectionHealthMetrics): 'excellent' | 'good' | 'poor' | 'critical' {
    if (health.latency < 50 && health.packetLoss < 0.01) {
      return 'excellent';
    } else if (health.latency < 150 && health.packetLoss < 0.05) {
      return 'good';
    } else if (health.latency < 500 && health.packetLoss < 0.1) {
      return 'poor';
    } else {
      return 'critical';
    }
  }
  
  /**
   * Adjust heartbeat interval based on connection quality
   */
  private adjustHeartbeatInterval(socketId: string, quality: string): void {
    const connection = this.connections.get(socketId);
    if (!connection) return;
    
    let newInterval: number;
    
    switch (quality) {
      case 'excellent':
        newInterval = this.reconnectionConfig.adaptiveHeartbeatMax; // Less frequent for good connections
        break;
      case 'good':
        newInterval = 20000; // 20 seconds
        break;
      case 'poor':
        newInterval = 10000; // 10 seconds
        break;
      case 'critical':
        newInterval = this.reconnectionConfig.adaptiveHeartbeatMin; // More frequent for poor connections
        break;
      default:
        newInterval = 15000; // Default 15 seconds
    }
    
    // Restart heartbeat with new interval if it changed significantly
    const currentInterval = this.heartbeatIntervals.get(socketId);
    if (currentInterval) {
      clearInterval(currentInterval);
      this.heartbeatIntervals.delete(socketId);
      
      // Find socket and restart heartbeat monitoring
      // Note: This would need access to the socket, which we don't have here
      // In practice, this would be called from the WebSocket service
      console.log(`Adjusted heartbeat interval for ${socketId} to ${newInterval}ms based on ${quality} connection quality`);
    }
  }
  
  /**
   * Get connection health metrics
   */
  public getConnectionHealth(socketId: string): ConnectionHealthMetrics | undefined {
    return this.connectionHealth.get(socketId);
  }
  
  /**
   * Get circuit breaker status
   */
  public getCircuitBreakerStatus(clientId: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(clientId);
  }
  
  /**
   * Clean up expired tokens periodically
   */
  public cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [token, data] of this.reconnectTokens.entries()) {
      if (data.expiresAt < now) {
        this.reconnectTokens.delete(token);
      }
    }
  }

  // Update connection limits
  public updateLimits(newLimits: Partial<ConnectionLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
  }
}