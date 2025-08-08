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
  // Event system events
  'subscribe-events': (filter: EventFilter, callback: (subscriptionId: string) => void) => void;
  'unsubscribe-events': (subscriptionId: string) => void;
  'publish-event': (event: Partial<AppEvent>) => void;
  'request-event-history': (filter?: EventFilter, page?: number, pageSize?: number, callback?: (history: EventHistory) => void) => void;
  'request-event-replay': (filter?: EventFilter, startTime?: string) => void;
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
  // Event system events
  'app-event': (event: AppEvent) => void;
  'app-event-global': (summary: { type: EventType; id: string; timestamp: string; userId?: string; sessionId?: string }) => void;
  'event-replay-start': (data: { count: number }) => void;
  'event-replay-end': () => void;
  'subscription-created': (data: { subscriptionId: string }) => void;
  'subscription-removed': (data: { subscriptionId: string }) => void;
}

// Inter-server events (for multi-server setups)
export interface InterServerEvents {
  'session-broadcast': (sessionId: string, event: string, data: any) => void;
  'user-broadcast': (userId: string, event: string, data: any) => void;
}

// Socket type with our custom data
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Event system types
export type EventType = 
  // File events
  | 'file:created' | 'file:modified' | 'file:deleted' | 'file:renamed' | 'file:moved' | 'file:executed'
  // User action events  
  | 'user:joined' | 'user:left' | 'user:typing' | 'user:idle' | 'user:active'
  // Session events
  | 'session:created' | 'session:updated' | 'session:deleted' | 'session:shared'
  // Code events
  | 'code:changed' | 'code:saved' | 'code:executed' | 'code:error'
  // Chat/message events
  | 'message:sent' | 'message:edited' | 'message:deleted'
  // System events
  | 'system:notification' | 'system:error' | 'system:maintenance'
  // Custom events
  | 'custom:event';

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

// File change events
export interface FileEvent extends BaseEvent {
  type: 'file:created' | 'file:modified' | 'file:deleted' | 'file:renamed' | 'file:moved' | 'file:executed';
  data: {
    filePath: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
    oldPath?: string; // for rename/move operations
    content?: string; // for small files
    diff?: string; // for modifications
    exitCode?: number; // for executed files
    output?: string; // execution output
  };
}

// User action events
export interface UserActionEvent extends BaseEvent {
  type: 'user:joined' | 'user:left' | 'user:typing' | 'user:idle' | 'user:active';
  data: {
    userId: string;
    userName?: string;
    action: string;
    target?: string; // what they're acting on
    location?: {
      file?: string;
      line?: number;
      column?: number;
    };
  };
}

// Session events
export interface SessionEvent extends BaseEvent {
  type: 'session:created' | 'session:updated' | 'session:deleted' | 'session:shared';
  data: {
    sessionId: string;
    sessionName?: string;
    participants?: string[];
    settings?: Record<string, any>;
    shareSettings?: {
      readOnly: boolean;
      allowedUsers: string[];
    };
  };
}

// Code events
export interface CodeEvent extends BaseEvent {
  type: 'code:changed' | 'code:saved' | 'code:executed' | 'code:error';
  data: {
    filePath: string;
    language?: string;
    changes?: {
      startLine: number;
      endLine: number;
      content: string;
    };
    executionResult?: {
      output: string;
      error?: string;
      exitCode?: number;
    };
  };
}

// Message events
export interface MessageEvent extends BaseEvent {
  type: 'message:sent' | 'message:edited' | 'message:deleted';
  data: {
    messageId: string;
    content: string;
    replyTo?: string;
    mentions?: string[];
    attachments?: string[];
  };
}

// System events
export interface SystemEvent extends BaseEvent {
  type: 'system:notification' | 'system:error' | 'system:maintenance';
  data: {
    level: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    actionRequired?: boolean;
    autoClose?: boolean;
    duration?: number;
  };
}

// Custom events
export interface CustomEvent extends BaseEvent {
  type: 'custom:event';
  data: {
    eventName: string;
    payload: any;
  };
}

// Union type for all events
export type AppEvent = FileEvent | UserActionEvent | SessionEvent | CodeEvent | MessageEvent | SystemEvent | CustomEvent;

// Event subscription and filtering
export interface EventFilter {
  types?: EventType[];
  userId?: string;
  sessionId?: string;
  filePath?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface EventSubscription {
  id: string;
  socketId: string;
  filter: EventFilter;
  createdAt: Date;
  active: boolean;
}

// Event history and replay
export interface EventHistory {
  events: AppEvent[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Session update types (keeping for backward compatibility)
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