// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Request Types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, any>;
}

// Error Types
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: Date;
}

// Constants
export const API_ENDPOINTS = {
  users: '/api/users',
  auth: '/api/auth',
  health: '/api/health',
  sessions: '/api/sessions',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;

// Claude Code Transcript Types
export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

export interface UsageInfo {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  service_tier?: string;
  server_tool_use?: Record<string, any>;
}

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<Record<string, any>>;
  is_error?: boolean;
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface ImageSource {
  type: 'base64';
  media_type: string;
  data: string;
}

export interface ImageContent {
  type: 'image';
  source: ImageSource;
}

export type ContentItem = 
  | TextContent 
  | ToolUseContent 
  | ToolResultContent 
  | ThinkingContent 
  | ImageContent;

export interface UserMessage {
  role: 'user';
  content: string | ContentItem[];
}

export interface AssistantMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: ContentItem[];
  stop_reason?: string;
  stop_sequence?: string | null;
  usage?: UsageInfo;
}

export interface FileInfo {
  filePath: string;
  content: string;
  numLines: number;
  startLine: number;
  totalLines: number;
}

export interface FileReadResult {
  type: 'text';
  file: FileInfo;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  interrupted: boolean;
  isImage: boolean;
}

export interface TodoResult {
  oldTodos: TodoItem[];
  newTodos: TodoItem[];
}

export interface EditResult {
  oldString?: string;
  newString?: string;
  replaceAll?: boolean;
  originalFile?: string;
  structuredPatch?: any;
  userModified?: boolean;
}

export type ToolUseResult = 
  | string 
  | TodoItem[] 
  | FileReadResult 
  | CommandResult 
  | TodoResult 
  | EditResult 
  | ContentItem[];

export interface BaseTranscriptEntry {
  parentUuid?: string | null;
  isSidechain: boolean;
  userType: string;
  cwd: string;
  sessionId: string;
  version: string;
  uuid: string;
  timestamp: string;
  isMeta?: boolean;
}

export interface UserTranscriptEntry extends BaseTranscriptEntry {
  type: 'user';
  message: UserMessage;
  toolUseResult?: ToolUseResult;
}

export interface AssistantTranscriptEntry extends BaseTranscriptEntry {
  type: 'assistant';
  message: AssistantMessage;
  requestId?: string;
}

export interface SummaryTranscriptEntry {
  type: 'summary';
  summary: string;
  leafUuid: string;
  cwd?: string;
}

export interface SystemTranscriptEntry extends BaseTranscriptEntry {
  type: 'system';
  content: string;
  level?: string;
}

export type TranscriptEntry = 
  | UserTranscriptEntry 
  | AssistantTranscriptEntry 
  | SummaryTranscriptEntry 
  | SystemTranscriptEntry;

// Utility Types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T> = Promise<ApiResponse<T>>;

// Type Guards
export function isApiError(error: any): error is AppError {
  return error && typeof error.code === 'string' && typeof error.message === 'string';
}

export function isUser(obj: any): obj is User {
  return obj && typeof obj.id === 'string' && typeof obj.email === 'string';
}

// Export validation schemas and functions
export * from './validation';

// Export utility functions
export * from './utils';

// Export JSONL parser functionality
export {
  JsonlParser,
  parseJsonlFile,
  parseJsonlString,
  type JsonlParserOptions,
  type JsonlParseResult,
} from './jsonl-parser';

// Export message type detection functionality
export {
  detectMessageType,
  detectAndParseMessage,
  detectMessageTypes,
  getMessageTypeStats,
  filterByMessageType,
  isUserMessage,
  isAssistantMessage,
  isSummaryMessage,
  isSystemMessage,
  classifyMessageContent,
  validateMessageSequence,
  summarizeDetectionResults,
  MESSAGE_TYPES,
  type MessageType,
  type MessageTypeDetectionResult,
  type MessageTypeStats,
} from './message-detector';

// Export token tracking functionality
export {
  extractTokenUsage,
  trackSessionUsage,
  aggregateUsage,
  trackProjectUsage,
  type ExtendedUsageInfo,
  type SessionTokenUsage,
  type ProjectTokenUsage,
  type TokenUsageTimepoint,
  type TokenUsageByType,
} from './token-tracker';

// Export content parsing functionality
export {
  extractTextContent,
  extractThinkingContent,
  analyzeContentTypes,
  parseTextContent,
  parseToolUseContent,
  parseToolResultContent,
  parseThinkingContent,
  parseImageContent,
  parseContentItem,
  parseMessageContent,
  parseTranscriptEntry,
  parseTranscriptEntries,
  extractCommandInfo,
  formatContentForDisplay,
  type ParsedContent,
  type ParsedMessage,
  type ContentParsingOptions,
} from './content-parser';

// Export session organization functionality
export {
  organizeIntoSessions,
  organizeProject,
  findSessionsByWorkingDirectory,
  buildBranchTree,
  getBranchTreeSessions,
  findRootSession,
  getSessionBranches,
  sessionHasBranches,
  getBranchDepth,
  formatBranchInfo,
  type SessionInfo,
  type ProjectSessions,
  type SessionOrganizationOptions,
} from './session-organizer';

// Export performance optimization functionality
export {
  ParsedContentCache,
  SessionCache,
  LazyContentLoader,
  ObjectPool,
  BatchProcessor,
  PerformanceMonitor,
  globalContentCache,
  globalSessionCache,
  globalLazyLoader,
  globalPerformanceMonitor,
  createOptimizedContentParser,
} from './performance-cache';

// Export optimized content parsing
export {
  OptimizedContentParser,
  OptimizedContentAnalyzer,
  globalOptimizedParser,
  parseTranscriptEntry as parseTranscriptEntryOptimized,
  parseTranscriptEntries as parseTranscriptEntriesOptimized,
  parseTranscriptEntriesStream,
  optimizedParsers,
  type OptimizedParsingOptions,
} from './optimized-content-parser';

// Export optimized session organization
export {
  OptimizedSessionOrganizer,
  globalOptimizedOrganizer,
  organizeIntoSessions as organizeIntoSessionsOptimized,
  organizeProject as organizeProjectOptimized,
  organizeSessionsStream,
  type OptimizedSessionOptions,
} from './optimized-session-organizer';

// Export state bridge functionality
export {
  StateBridge,
  type StateSyncEventType,
  type StateChangeEvent,
  type SessionStateSnapshot,
  type StateConflict,
  type ConflictResolutionStrategy,
  type BridgeStatus,
  type StateBridgeConfig,
} from './state-bridge';
