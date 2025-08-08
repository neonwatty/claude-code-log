import { Socket } from 'socket.io';

// Extend Socket data interface
export interface SocketData {
  userId?: string;
  sessionId?: string;
  connectedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  lastHeartbeat: Date;
  connectionId: string;
  reconnectCount: number;
  totalConnections: number;
}

// Client-to-Server events
export interface ClientToServerEvents {
  authenticate: (data: { userId?: string; sessionId?: string; reconnectToken?: string }) => void;
  'join-session': (sessionId: string) => void;
  'leave-session': (sessionId: string) => void;
  'session-update': (data: { sessionId: string; update: any }) => void;
  ping: (callback?: (response: string) => void) => void;
  heartbeat: () => void;
  'request-reconnect-token': (callback: (token: string) => void) => void;
}

// Server-to-Client events
export interface ServerToClientEvents {
  authenticated: (data: { success: boolean; error?: string; connectionId?: string; reconnectToken?: string }) => void;
  'user-joined': (data: { socketId: string; userId?: string }) => void;
  'user-left': (data: { socketId: string; userId?: string; reason?: string }) => void;
  'session-updated': (data: { update: any; fromSocket: string; timestamp: string }) => void;
  'connection-count': (count: number) => void;
  'error-message': (error: { code: string; message: string }) => void;
  'heartbeat-response': () => void;
  'reconnect-required': (data: { reason: string; delay: number }) => void;
  'connection-limit-exceeded': (data: { limit: number; current: number }) => void;
}

// Inter-server events (for multi-server setups)
export interface InterServerEvents {
  'session-broadcast': (sessionId: string, event: string, data: any) => void;
  'user-broadcast': (userId: string, event: string, data: any) => void;
}

// Socket type with our custom data
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Session update types
export interface SessionUpdate {
  type: 'file-change' | 'user-action' | 'state-update' | 'message';
  data: any;
  timestamp: string;
  userId?: string;
}

// Connection info
export interface ConnectionInfo {
  socketId: string;
  userId?: string;
  sessionId?: string;
  connectedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  lastHeartbeat: Date;
  connectionId: string;
  reconnectCount: number;
  totalConnections: number;
}

// Connection limits and rate limiting
export interface ConnectionLimits {
  maxConnectionsPerUser: number;
  maxConnectionsPerIP: number;
  maxGlobalConnections: number;
  rateLimitWindow: number; // in milliseconds
  maxEventsPerWindow: number;
}

// Connection statistics
export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  connectionsPerUser: Map<string, number>;
  connectionsPerIP: Map<string, number>;
  averageConnectionDuration: number;
  totalReconnects: number;
  heartbeatStats: {
    sent: number;
    received: number;
    missed: number;
  };
}

// Reconnection token
export interface ReconnectToken {
  token: string;
  userId: string;
  sessionId?: string;
  expiresAt: Date;
  socketData: Partial<SocketData>;
}

// Export types directly - no default export needed for type-only exports