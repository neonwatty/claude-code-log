// Type utilities and aliases for the shared interfaces

export type {
  ITodoItem,
  IUsageInfo,
  ITextContent,
  IToolUseContent,
  IToolResultContent,
  IThinkingContent,
  IImageSource,
  IImageContent,
  IContentItem,
  IUserMessage,
  IAssistantMessage,
  IFileInfo,
  IFileReadResult,
  ICommandResult,
  ITodoResult,
  IEditResult,
  IToolUseResult,
  IBaseTranscriptEntry,
  IUserTranscriptEntry,
  IAssistantTranscriptEntry,
  ISummaryTranscriptEntry,
  ISystemTranscriptEntry,
  ITranscriptEntry,
  ISession,
  IProject,
  IApiResponse,
  User,
  LogEntry,
} from "../interfaces";

// Export the new export-related types are exported from the schemas/export module

// Utility types for common patterns
export type MessageRole = "user" | "assistant" | "system";
export type TranscriptEntryType = "user" | "assistant" | "summary" | "system";
export type ContentType =
  | "text"
  | "tool_use"
  | "tool_result"
  | "thinking"
  | "image";
export type TodoStatus = "pending" | "in_progress" | "completed";
export type TodoPriority = "high" | "medium" | "low";

// Pagination types for API responses
export interface IPaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface IPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Filter types for sessions and transcripts
export interface ISessionFilter {
  fromDate?: string;
  toDate?: string;
  projectName?: string;
  sessionId?: string;
  cwd?: string;
  hasErrors?: boolean;
}

export interface IMessageFilter {
  type?: TranscriptEntryType[];
  fromTimestamp?: string;
  toTimestamp?: string;
  hasToolUse?: boolean;
  searchText?: string;
}

// Aggregation types for statistics
export interface ITokenUsageAggregation {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  averageInputTokens: number;
  averageOutputTokens: number;
}

export interface ISessionStats {
  totalSessions: number;
  totalMessages: number;
  totalProjects: number;
  tokenUsage: ITokenUsageAggregation;
  dateRange: {
    earliest: string;
    latest: string;
  };
}

// Export functionality types
export type ExportFormat = "html" | "markdown" | "json" | "pdf";

export interface IExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  includeThinking?: boolean;
  includeToolUse?: boolean;
  includeImages?: boolean;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  messageTypes?: TranscriptEntryType[];
  customTemplate?: string;
  compressionLevel?: number;
}

export interface IExportRequest {
  sessionId?: string;
  sessionIds?: string[];
  messageIds?: string[];
  projectName?: string;
  options: IExportOptions;
}

export interface IExportProgress {
  stage: "preparing" | "processing" | "generating" | "streaming" | "completed" | "error";
  progress: number; // 0-100
  currentItem?: string;
  totalItems?: number;
  processedItems?: number;
  message?: string;
  bytesProcessed?: number;
  estimatedSize?: number;
}

export interface IExportResult {
  success: boolean;
  exportId: string;
  format: ExportFormat;
  filename: string;
  size: number;
  url?: string;
  downloadToken?: string;
  expiresAt?: string;
  metadata: {
    sessionCount: number;
    messageCount: number;
    generatedAt: string;
    processingTime: number;
    options: IExportOptions;
  };
  error?: string;
}

export interface IExportStatus {
  exportId: string;
  status: "pending" | "processing" | "completed" | "failed" | "expired";
  progress: IExportProgress;
  result?: IExportResult;
  createdAt: string;
  completedAt?: string;
  error?: string;
}
