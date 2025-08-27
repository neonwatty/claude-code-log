/**
 * WebSocket types and interfaces for the frontend client
 * Unified with standardized message protocol
 */

// Re-export new standardized message types
export * from "../utils/websocket/message-types";
export * from "../utils/websocket/message-handlers";

// Legacy base message interface (kept for backward compatibility)
export interface IWebSocketMessage {
  type: string;
  timestamp: string;
  data?: any;
}

// Extended message types enum including legacy and new types
export enum WebSocketMessageType {
  // Connection management (legacy)
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  HEARTBEAT = "heartbeat",
  PONG = "pong",

  // Session events (standardized)
  SESSION_CREATED = "SESSION_CREATED",
  SESSION_UPDATED = "SESSION_UPDATED",
  SESSION_DELETED = "SESSION_DELETED",
  CACHE_INVALIDATED = "CACHE_INVALIDATED",

  // Project events (legacy - to be migrated)
  PROJECT_UPDATED = "project_updated",

  // File system events (legacy - to be migrated)
  FILE_CHANGED = "file_changed",

  // Error events (legacy)
  ERROR = "error",
}

// Connection states
export enum WebSocketConnectionState {
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  RECONNECTING = "RECONNECTING",
  DISCONNECTED = "DISCONNECTED",
  ERROR = "ERROR",
}

// Configuration interface
export interface IWebSocketConfig {
  url: string | (() => string);
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  debug?: boolean;
}

// Specific message interfaces
export interface IHeartbeatMessage extends IWebSocketMessage {
  type: WebSocketMessageType.HEARTBEAT;
}

export interface IPongMessage extends IWebSocketMessage {
  type: WebSocketMessageType.PONG;
}

export interface IConnectMessage extends IWebSocketMessage {
  type: WebSocketMessageType.CONNECT;
  data: {
    clientId: string;
    message: string;
    endpoints?: any;
  };
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

// Union type for all message types
export type WebSocketEventMessage =
  | IHeartbeatMessage
  | IPongMessage
  | IConnectMessage
  | ISessionCreatedMessage
  | ISessionUpdatedMessage
  | ISessionDeletedMessage
  | IProjectUpdatedMessage
  | IFileChangedMessage
  | IErrorMessage;

// Event handler types
export type WebSocketEventHandler<T = any> = (data: T) => void;
export type WebSocketMessageHandler = (message: WebSocketEventMessage) => void;

// Event map for typed event emitter
export interface IWebSocketEventMap {
  // Connection events
  "connection:open": Event;
  "connection:close": CloseEvent;
  "connection:error": Event;
  "connection:reconnecting": {
    attempt: number;
    maxAttempts: number;
    delay?: number;
    disconnectionType?: string;
  };

  // Message events
  message: WebSocketEventMessage;
  "session:created": ISessionCreatedMessage["data"];
  "session:updated": ISessionUpdatedMessage["data"];
  "session:deleted": ISessionDeletedMessage["data"];
  "cache:invalidated": any;
  "project:updated": IProjectUpdatedMessage["data"];
  "file:changed": IFileChangedMessage["data"];
  error: IErrorMessage["data"];

  // State events
  "state:changed": {
    oldState: WebSocketConnectionState;
    newState: WebSocketConnectionState;
  };
}
