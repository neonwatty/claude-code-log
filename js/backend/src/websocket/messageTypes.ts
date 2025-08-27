// WebSocket message types and interfaces

export interface IWebSocketMessage {
  type: string;
  timestamp: string;
  data?: any;
}

// Message types
export enum WebSocketMessageType {
  // Connection management
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  HEARTBEAT = "heartbeat",
  PONG = "pong",

  // Session events
  SESSION_CREATED = "session_created",
  SESSION_UPDATED = "session_updated",
  SESSION_DELETED = "session_deleted",

  // Project events
  PROJECT_UPDATED = "project_updated",

  // File system events
  FILE_CHANGED = "file_changed",

  // Analytics events
  ANALYTICS_TOKEN_UPDATE = "analytics_token_update",
  ANALYTICS_INSIGHTS_UPDATE = "analytics_insights_update",
  ANALYTICS_PERFORMANCE_UPDATE = "analytics_performance_update",
  ANALYTICS_REAL_TIME_METRICS = "analytics_real_time_metrics",

  // Error events
  ERROR = "error",
}

// Specific message interfaces
export interface IHeartbeatMessage extends IWebSocketMessage {
  type: WebSocketMessageType.HEARTBEAT;
}

export interface IPongMessage extends IWebSocketMessage {
  type: WebSocketMessageType.PONG;
}

export interface ISessionCreatedMessage extends IWebSocketMessage {
  type: WebSocketMessageType.SESSION_CREATED;
  data: {
    sessionId: string;
    cwd: string;
    timestamp: string;
  };
}

export interface ISessionUpdatedMessage extends IWebSocketMessage {
  type: WebSocketMessageType.SESSION_UPDATED;
  data: {
    sessionId: string;
    cwd: string;
    entryCount: number;
    lastActivity: string;
  };
}

export interface ISessionDeletedMessage extends IWebSocketMessage {
  type: WebSocketMessageType.SESSION_DELETED;
  data: {
    sessionId: string;
  };
}

export interface IProjectUpdatedMessage extends IWebSocketMessage {
  type: WebSocketMessageType.PROJECT_UPDATED;
  data: {
    projectPath: string;
    sessionCount: number;
    lastActivity: string;
  };
}

export interface IFileChangedMessage extends IWebSocketMessage {
  type: WebSocketMessageType.FILE_CHANGED;
  data: {
    filePath: string;
    changeType: "created" | "modified" | "deleted";
  };
}

export interface IErrorMessage extends IWebSocketMessage {
  type: WebSocketMessageType.ERROR;
  data: {
    message: string;
    code?: string;
  };
}

export interface IConnectMessage extends IWebSocketMessage {
  type: WebSocketMessageType.CONNECT;
  data: {
    clientId: string;
    message: string;
    endpoints?: any;
  };
}

// Analytics message interfaces
export interface IAnalyticsTokenUpdateMessage extends IWebSocketMessage {
  type: WebSocketMessageType.ANALYTICS_TOKEN_UPDATE;
  data: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    sessionsAnalyzed: number;
    timeRange: {
      start: string;
      end: string;
    };
    patterns: Array<{
      timestamp: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      sessionId: string;
      messageType: "user" | "assistant";
    }>;
  };
}

export interface IAnalyticsInsightsUpdateMessage extends IWebSocketMessage {
  type: WebSocketMessageType.ANALYTICS_INSIGHTS_UPDATE;
  data: {
    totalTokensUsed: number;
    averageTokensPerSession: number;
    tokenEfficiencyScore: number;
    recommendations: Array<{
      type: "optimization" | "usage" | "performance";
      priority: "high" | "medium" | "low";
      title: string;
      description: string;
      impact: string;
    }>;
  };
}

export interface IAnalyticsPerformanceUpdateMessage extends IWebSocketMessage {
  type: WebSocketMessageType.ANALYTICS_PERFORMANCE_UPDATE;
  data: {
    averageResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    systemLoad: {
      cpu: number;
      memory: number;
      disk: number;
    };
  };
}

export interface IAnalyticsRealTimeMetricsMessage extends IWebSocketMessage {
  type: WebSocketMessageType.ANALYTICS_REAL_TIME_METRICS;
  data: {
    currentSessionCount: number;
    activeConnections: number;
    tokensPerMinute: number;
    averageResponseTime: number;
  };
}

export type WebSocketEventMessage =
  | IHeartbeatMessage
  | IPongMessage
  | ISessionCreatedMessage
  | ISessionUpdatedMessage
  | ISessionDeletedMessage
  | IProjectUpdatedMessage
  | IFileChangedMessage
  | IErrorMessage
  | IConnectMessage
  | IAnalyticsTokenUpdateMessage
  | IAnalyticsInsightsUpdateMessage
  | IAnalyticsPerformanceUpdateMessage
  | IAnalyticsRealTimeMetricsMessage;
