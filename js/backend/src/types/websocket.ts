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
  // CLI Process events
  'cli-spawn': (config: CLIProcessConfig, callback: (result: { success: boolean; processId?: string; error?: string }) => void) => void;
  'cli-terminate': (processId: string, callback: (result: { success: boolean; error?: string }) => void) => void;
  'cli-input': (processId: string, data: string) => void;
  'cli-get-processes': (callback: (processes: CLIProcessInfo[]) => void) => void;
  'cli-get-process': (processId: string, callback: (process: CLIProcessInfo | null) => void) => void;
  // Context transfer events
  'context-prepare': (sessionPath: string, options?: any, callback?: (result: { success: boolean; packageId?: string; error?: string }) => void) => void;
  'context-transfer-initiate': (packageId: string, callback?: (result: { success: boolean; transferId?: string; error?: string }) => void) => void;
  'context-transfer-status': (transferId: string, callback?: (status: any) => void) => void;
  // Session status events
  'get-session-status': (sessionId: string, callback?: (status: SessionStatusData | null) => void) => void;
  'subscribe-session-status': (sessionId: string, callback?: (subscriptionId: string) => void) => void;
  'unsubscribe-session-status': (subscriptionId: string) => void;
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
  // CLI Process events
  'cli-process-started': (data: { processId: string; processInfo: CLIProcessInfo }) => void;
  'cli-process-stopped': (data: { processId: string; processInfo: CLIProcessInfo }) => void;
  'cli-process-error': (data: { processId: string; processInfo: CLIProcessInfo; error: string }) => void;
  'cli-process-timeout': (data: { processId: string; processInfo: CLIProcessInfo }) => void;
  'cli-stdout-data': (data: { processId: string; content: string; timestamp: string; parsed?: any }) => void;
  'cli-stderr-data': (data: { processId: string; content: string; timestamp: string; parsed?: any }) => void;
  'cli-parsed-output': (data: { processId: string; output: ParsedCLIOutput }) => void;
  // Context transfer events
  'context-prepared': (data: { packageId: string; sessionId: string; stats: any; expiresAt: string }) => void;
  'context-transfer-initiated': (data: { transferId: string; packageId: string; status: string }) => void;
  'context-transfer-progress': (data: { transferId: string; progress: number; status: string }) => void;
  'context-transfer-completed': (data: { transferId: string; packageId: string; success: boolean }) => void;
  'context-transfer-failed': (data: { transferId: string; packageId: string; error: string }) => void;
  // Session branch events
  'session-branched': (data: { 
    parentSessionId: string; 
    branchSession: { 
      id: string; 
      parentSessionId: string; 
      branchPoint: number; 
      branchTimestamp: string; 
      branchMetadata?: { 
        branchName?: string; 
        branchReason?: string; 
        originalMessage?: string; 
      }; 
      workingDirectory?: string; 
      status: string; 
      createdAt: string; 
    }; 
    affectedSessions: string[];
  }) => void;
  'branch-tree-updated': (data: { 
    rootSessionId: string; 
    branchData: { 
      parentId: string; 
      childId: string; 
      branchPoint: number; 
    }; 
    affectedSessions: string[];
  }) => void;
  // Session status events
  'session-status-changed': (data: SessionStatusEvent['data']) => void;
  'session-status-subscription-created': (data: { subscriptionId: string; sessionId: string }) => void;
  'session-status-subscription-removed': (data: { subscriptionId: string; sessionId: string }) => void;
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
  | 'session:branched' | 'session:branch-tree-updated'
  // Session status events
  | 'session:status-changed' | 'session:progress-updated' | 'session:metadata-changed'
  | 'session:performance-updated' | 'session:error-occurred' | 'session:warning-issued'
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

// Session branch events
export interface SessionBranchEvent extends BaseEvent {
  type: 'session:branched' | 'session:branch-tree-updated';
  data: {
    // Common fields
    sessionId: string;
    parentSessionId?: string;
    branchPoint?: number;
    branchTimestamp?: string;
    
    // Branch creation data
    branchSession?: {
      id: string;
      parentSessionId: string;
      branchPoint: number;
      branchTimestamp: string;
      branchMetadata?: {
        branchName?: string;
        branchReason?: string;
        originalMessage?: string;
      };
      workingDirectory?: string;
      status: string;
      createdAt: string;
    };
    
    // Branch tree update data
    rootSessionId?: string;
    branchData?: {
      parentId: string;
      childId: string;
      branchPoint: number;
    };
    
    // Affected sessions for UI updates
    affectedSessions?: string[];
  };
}

// Session status events
export interface SessionStatusEvent extends BaseEvent {
  type: 'session:status-changed' | 'session:progress-updated' | 'session:metadata-changed' | 'session:performance-updated' | 'session:error-occurred' | 'session:warning-issued';
  data: {
    sessionId: string;
    
    // Status change data
    status?: {
      current: 'active' | 'idle' | 'processing' | 'loading' | 'error' | 'completed' | 'paused';
      previous?: 'active' | 'idle' | 'processing' | 'loading' | 'error' | 'completed' | 'paused';
      reason?: string;
      source?: 'user' | 'system' | 'file-change' | 'websocket' | 'api';
    };
    
    // Progress tracking data
    progress?: {
      current: number;
      total: number;
      percentage: number;
      stage?: string;
      description?: string;
      estimatedTimeRemaining?: number;
    };
    
    // Metadata changes
    metadata?: {
      changed: Record<string, any>;
      added?: Record<string, any>;
      removed?: string[];
      full?: Record<string, any>;
    };
    
    // Performance metrics
    performance?: {
      loadTime?: number;
      responseTime?: number;
      memoryUsage?: number;
      cpuUsage?: number;
      messageCount?: number;
      fileSystemOps?: number;
      lastActivity?: string;
    };
    
    // Error/warning information
    error?: {
      code: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      stack?: string;
      context?: Record<string, any>;
      recoverable: boolean;
    };
    
    warning?: {
      code: string;
      message: string;
      level: 'info' | 'warning' | 'error';
      context?: Record<string, any>;
      autoResolve?: boolean;
    };
  };
}

// Session status data structure for direct queries
export interface SessionStatusData {
  sessionId: string;
  status: {
    current: 'active' | 'idle' | 'processing' | 'loading' | 'error' | 'completed' | 'paused';
    lastChanged: string;
    reason?: string;
    source?: 'user' | 'system' | 'file-change' | 'websocket' | 'api';
  };
  progress?: {
    current: number;
    total: number;
    percentage: number;
    stage?: string;
    description?: string;
    estimatedTimeRemaining?: number;
  };
  metadata: Record<string, any>;
  performance: {
    loadTime?: number;
    responseTime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    messageCount?: number;
    fileSystemOps?: number;
    lastActivity?: string;
  };
  errors: Array<{
    code: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
    recoverable: boolean;
  }>;
  warnings: Array<{
    code: string;
    message: string;
    level: 'info' | 'warning' | 'error';
    timestamp: string;
    autoResolve?: boolean;
  }>;
  lastUpdated: string;
}

// Session status subscription
export interface SessionStatusSubscription {
  id: string;
  sessionId: string;
  socketId: string;
  createdAt: Date;
  active: boolean;
  filters?: {
    events?: Array<'status-changed' | 'progress-updated' | 'metadata-changed' | 'performance-updated' | 'error-occurred' | 'warning-issued'>;
    severityLevel?: 'low' | 'medium' | 'high' | 'critical';
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
export type AppEvent = FileEvent | UserActionEvent | SessionEvent | SessionBranchEvent | SessionStatusEvent | CodeEvent | MessageEvent | SystemEvent | CustomEvent;

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

// CLI Process types
export interface CLIProcessConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface CLIProcessInfo {
  id: string;
  pid?: number;
  command: string;
  args: string[];
  status: 'starting' | 'running' | 'stopped' | 'error' | 'timeout';
  startedAt: string; // ISO string
  stoppedAt?: string; // ISO string
  exitCode?: number;
  signal?: string;
  error?: string;
}

export interface ParsedCLIOutput {
  type: 'stdout' | 'stderr';
  content: string;
  timestamp: string; // ISO string
  parsed?: {
    isJson?: boolean;
    isMarkdown?: boolean;
    isToolUse?: boolean;
    hasAnsiCodes?: boolean;
    data?: any;
  };
}

// Export types directly - no default export needed for type-only exports