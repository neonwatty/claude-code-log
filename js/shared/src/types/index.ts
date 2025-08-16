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
  IApiResponse
} from '../interfaces';

// Utility types for common patterns
export type MessageRole = 'user' | 'assistant' | 'system';
export type TranscriptEntryType = 'user' | 'assistant' | 'summary' | 'system';
export type ContentType = 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'image';
export type TodoStatus = 'pending' | 'in_progress' | 'completed';
export type TodoPriority = 'high' | 'medium' | 'low';

// Pagination types for API responses
export interface IPaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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