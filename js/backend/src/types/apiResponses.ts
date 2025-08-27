// API Response types matching Python renderer data structures

import {
  ISession,
  IProject,
  ITranscriptEntry,
  IUsageInfo,
} from "../../../shared/src";

// Base API response (already exists in shared, but extended here)
export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  timestamp: string;
  details?: any;
}

// Pagination metadata
export interface IPaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  page?: number;
  totalPages?: number;
}

// Session API responses
export interface ISessionListResponse {
  sessions: ISession[];
  pagination: IPaginationMeta;
}

export interface ISessionDetailResponse extends ISession {
  // Additional computed fields for detailed view
  totalMessages: number;
  totalTokens: number;
  averageResponseTime?: number;
  lastActivity: string;
}

export interface ISessionContinueResponse {
  message: string;
  sessionId: string;
  status: "pending" | "started" | "failed";
  requestId?: string;
}

// Project API responses
export interface IProjectListResponse {
  projects: IProject[];
  totalProjects: number;
}

export interface IProjectDetailResponse extends IProject {
  // Additional computed fields
  recentActivity: {
    lastSession: string;
    lastMessage: string;
    frequency: "daily" | "weekly" | "monthly" | "occasional";
  };
  statistics: {
    averageSessionLength: number;
    averageTokensPerSession: number;
    mostActiveTimeOfDay?: string;
  };
}

// WebSocket status responses
export interface IWebSocketStatusResponse {
  isActive: boolean;
  connectedClients: number;
  totalConnections: number;
  uptime: number;
}

// File monitoring responses
export interface IFileMonitorStatusResponse {
  isActive: boolean;
  watcherCount: number;
  monitoredFiles: number;
  lastActivity?: string;
}

// Health check response
export interface IHealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  environment: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  version: string;
  services: {
    database: "healthy" | "unhealthy";
    fileSystem: "healthy" | "unhealthy";
    webSocket: "healthy" | "unhealthy";
  };
}

// Error response details
export interface IErrorDetails {
  field?: string;
  code?: string;
  message?: string;
  value?: any;
}

export interface IValidationErrorResponse {
  errors: IErrorDetails[];
  totalErrors: number;
}

// API metadata
export interface IApiMetadata {
  version: string;
  buildTime?: string;
  commitHash?: string;
  environment: string;
  features: string[];
}

// Statistics and analytics responses
export interface IUsageStatistics {
  totalSessions: number;
  totalProjects: number;
  totalTokens: number;
  totalMessages: number;
  period: {
    start: string;
    end: string;
    duration: string;
  };
  breakdown: {
    byDay: Array<{ date: string; sessions: number; tokens: number }>;
    byProject: Array<{ project: string; sessions: number; tokens: number }>;
    byModel: Array<{ model: string; usage: number; percentage: number }>;
  };
}

// Search and filtering responses
export interface ISearchResponse<T> {
  results: T[];
  query: string;
  totalResults: number;
  searchTime: number;
  pagination: IPaginationMeta;
  facets?: Array<{
    field: string;
    values: Array<{ value: string; count: number }>;
  }>;
}

// Export endpoints response
export interface IExportResponse {
  format: "json" | "csv" | "jsonl";
  downloadUrl: string;
  expiresAt: string;
  size: number;
  recordCount: number;
}

// Batch operation responses
export interface IBatchOperationResponse {
  operationId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  results?: {
    successful: number;
    failed: number;
    errors?: IErrorDetails[];
  };
  startedAt: string;
  completedAt?: string;
}

// Response builder utility type
export type ApiResponse<T = any> = IApiResponse<T>;

// Response factory functions
export const createSuccessResponse = <T>(
  data: T,
  message?: string,
): ApiResponse<T> => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
  ...(message && { message }),
});

export const createErrorResponse = (
  error: string,
  errorCode?: string,
  details?: any,
): ApiResponse => ({
  success: false,
  error,
  errorCode,
  timestamp: new Date().toISOString(),
  ...(details && { details }),
});

export const createPaginatedResponse = <T>(
  items: T[],
  pagination: IPaginationMeta,
): ApiResponse<{ items: T[]; pagination: IPaginationMeta }> => ({
  success: true,
  data: { items, pagination },
  timestamp: new Date().toISOString(),
});
