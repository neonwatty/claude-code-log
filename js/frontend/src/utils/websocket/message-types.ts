/**
 * WebSocket message types and protocol definitions for real-time session updates
 */

// Message types enum for WebSocket communication
export enum MessageType {
  SESSION_CREATED = "SESSION_CREATED",
  SESSION_UPDATED = "SESSION_UPDATED",
  SESSION_DELETED = "SESSION_DELETED",
  CACHE_INVALIDATED = "CACHE_INVALIDATED",
  ANALYTICS_TOKEN_UPDATE = "ANALYTICS_TOKEN_UPDATE",
  ANALYTICS_INSIGHTS_UPDATE = "ANALYTICS_INSIGHTS_UPDATE", 
  ANALYTICS_PERFORMANCE_UPDATE = "ANALYTICS_PERFORMANCE_UPDATE",
  ANALYTICS_REAL_TIME_METRICS = "ANALYTICS_REAL_TIME_METRICS",
}

// Base message interface
export interface BaseMessage {
  type: MessageType;
  timestamp: string;
  id: string; // Unique message ID for tracking
}

// Session-related payload interfaces
export interface SessionData {
  sessionId: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

// Specific message payload interfaces
export interface SessionCreatedMessage extends BaseMessage {
  type: MessageType.SESSION_CREATED;
  payload: {
    session: SessionData;
  };
}

export interface SessionUpdatedMessage extends BaseMessage {
  type: MessageType.SESSION_UPDATED;
  payload: {
    session: SessionData;
    changes: {
      fields: string[]; // List of fields that changed
      previousValues?: Partial<SessionData>;
    };
  };
}

export interface SessionDeletedMessage extends BaseMessage {
  type: MessageType.SESSION_DELETED;
  payload: {
    sessionId: string;
    deletedAt: string;
  };
}

export interface CacheInvalidatedMessage extends BaseMessage {
  type: MessageType.CACHE_INVALIDATED;
  payload: {
    scope: "all" | "session" | "specific";
    sessionIds?: string[]; // For specific invalidation
    reason: string;
  };
}

// Analytics message interfaces
export interface AnalyticsTokenUpdateMessage extends BaseMessage {
  type: MessageType.ANALYTICS_TOKEN_UPDATE;
  payload: {
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

export interface AnalyticsInsightsUpdateMessage extends BaseMessage {
  type: MessageType.ANALYTICS_INSIGHTS_UPDATE;
  payload: {
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

export interface AnalyticsPerformanceUpdateMessage extends BaseMessage {
  type: MessageType.ANALYTICS_PERFORMANCE_UPDATE;
  payload: {
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

export interface AnalyticsRealTimeMetricsMessage extends BaseMessage {
  type: MessageType.ANALYTICS_REAL_TIME_METRICS;
  payload: {
    currentSessionCount: number;
    activeConnections: number;
    tokensPerMinute: number;
    averageResponseTime: number;
  };
}

// Union type for all possible WebSocket messages
export type WebSocketMessage =
  | SessionCreatedMessage
  | SessionUpdatedMessage
  | SessionDeletedMessage
  | CacheInvalidatedMessage
  | AnalyticsTokenUpdateMessage
  | AnalyticsInsightsUpdateMessage
  | AnalyticsPerformanceUpdateMessage
  | AnalyticsRealTimeMetricsMessage;

// Message validation schemas (for runtime type checking)
export interface MessageSchema {
  type: MessageType;
  requiredFields: string[];
  payloadSchema: Record<string, string>; // field -> expected type
}

export const MESSAGE_SCHEMAS: Record<MessageType, MessageSchema> = {
  [MessageType.SESSION_CREATED]: {
    type: MessageType.SESSION_CREATED,
    requiredFields: ["type", "timestamp", "id", "payload"],
    payloadSchema: {
      session: "object",
    },
  },
  [MessageType.SESSION_UPDATED]: {
    type: MessageType.SESSION_UPDATED,
    requiredFields: ["type", "timestamp", "id", "payload"],
    payloadSchema: {
      session: "object",
      changes: "object",
    },
  },
  [MessageType.SESSION_DELETED]: {
    type: MessageType.SESSION_DELETED,
    requiredFields: ["type", "timestamp", "id", "payload"],
    payloadSchema: {
      sessionId: "string",
      deletedAt: "string",
    },
  },
  [MessageType.CACHE_INVALIDATED]: {
    type: MessageType.CACHE_INVALIDATED,
    requiredFields: ["type", "timestamp", "id", "payload"],
    payloadSchema: {
      scope: "string",
      reason: "string",
    },
  },
  [MessageType.ANALYTICS_TOKEN_UPDATE]: {
    type: MessageType.ANALYTICS_TOKEN_UPDATE,
    requiredFields: ["type", "timestamp", "id", "payload"],
    payloadSchema: {
      totalTokens: "number",
      inputTokens: "number",
      outputTokens: "number",
      sessionsAnalyzed: "number",
      timeRange: "object",
      patterns: "object",
    },
  },
  [MessageType.ANALYTICS_INSIGHTS_UPDATE]: {
    type: MessageType.ANALYTICS_INSIGHTS_UPDATE,
    requiredFields: ["type", "timestamp", "id", "payload"],
    payloadSchema: {
      totalTokensUsed: "number",
      averageTokensPerSession: "number",
      tokenEfficiencyScore: "number",
      recommendations: "object",
    },
  },
  [MessageType.ANALYTICS_PERFORMANCE_UPDATE]: {
    type: MessageType.ANALYTICS_PERFORMANCE_UPDATE,
    requiredFields: ["type", "timestamp", "id", "payload"],
    payloadSchema: {
      averageResponseTime: "number",
      cacheHitRate: "number",
      errorRate: "number",
      systemLoad: "object",
    },
  },
  [MessageType.ANALYTICS_REAL_TIME_METRICS]: {
    type: MessageType.ANALYTICS_REAL_TIME_METRICS,
    requiredFields: ["type", "timestamp", "id", "payload"],
    payloadSchema: {
      currentSessionCount: "number",
      activeConnections: "number",
      tokensPerMinute: "number",
      averageResponseTime: "number",
    },
  },
};

// Error types for message processing
export interface MessageError {
  code: string;
  message: string;
  originalMessage?: unknown;
  timestamp: string;
}

export enum MessageErrorCode {
  INVALID_FORMAT = "INVALID_FORMAT",
  UNKNOWN_TYPE = "UNKNOWN_TYPE",
  MISSING_FIELDS = "MISSING_FIELDS",
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  PROCESSING_ERROR = "PROCESSING_ERROR",
}
