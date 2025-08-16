// Core session and message interfaces matching Python models

export interface ITodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

export interface IUsageInfo {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  service_tier?: string;
  server_tool_use?: Record<string, any>;
}

// Content types matching Python ContentItem union
export interface ITextContent {
  type: 'text';
  text: string;
}

export interface IToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface IToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<Record<string, any>>;
  is_error?: boolean;
}

export interface IThinkingContent {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface IImageSource {
  type: 'base64';
  media_type: string;
  data: string;
}

export interface IImageContent {
  type: 'image';
  source: IImageSource;
}

export type IContentItem = 
  | ITextContent 
  | IToolUseContent 
  | IToolResultContent 
  | IThinkingContent 
  | IImageContent;

// Message interfaces
export interface IUserMessage {
  role: 'user';
  content: string | IContentItem[];
}

export interface IAssistantMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: IContentItem[];
  stop_reason?: string;
  stop_sequence?: string;
  usage?: IUsageInfo;
}

// File and command result interfaces
export interface IFileInfo {
  filePath: string;
  content: string;
  numLines: number;
  startLine: number;
  totalLines: number;
}

export interface IFileReadResult {
  type: 'text';
  file: IFileInfo;
}

export interface ICommandResult {
  stdout: string;
  stderr: string;
  interrupted: boolean;
  isImage: boolean;
}

export interface ITodoResult {
  oldTodos: ITodoItem[];
  newTodos: ITodoItem[];
}

export interface IEditResult {
  oldString?: string;
  newString?: string;
  replaceAll?: boolean;
  originalFile?: string;
  structuredPatch?: any;
  userModified?: boolean;
}

export type IToolUseResult = 
  | string 
  | ITodoItem[] 
  | IFileReadResult 
  | ICommandResult 
  | ITodoResult 
  | IEditResult 
  | IContentItem[];

// Base transcript entry
export interface IBaseTranscriptEntry {
  parentUuid?: string;
  isSidechain: boolean;
  userType: string;
  cwd: string;
  sessionId: string;
  version: string;
  uuid: string;
  timestamp: string;
  isMeta?: boolean;
}

// Transcript entry types
export interface IUserTranscriptEntry extends IBaseTranscriptEntry {
  type: 'user';
  message: IUserMessage;
  toolUseResult?: IToolUseResult;
}

export interface IAssistantTranscriptEntry extends IBaseTranscriptEntry {
  type: 'assistant';
  message: IAssistantMessage;
  requestId?: string;
}

export interface ISummaryTranscriptEntry {
  type: 'summary';
  summary: string;
  leafUuid: string;
  cwd?: string;
}

export interface ISystemTranscriptEntry extends IBaseTranscriptEntry {
  type: 'system';
  content: string;
  level?: string; // 'warning', 'info', 'error'
}

export type ITranscriptEntry = 
  | IUserTranscriptEntry 
  | IAssistantTranscriptEntry 
  | ISummaryTranscriptEntry 
  | ISystemTranscriptEntry;

// Session management interfaces
export interface ISession {
  id: string;
  entries: ITranscriptEntry[];
  firstTimestamp: string;
  lastTimestamp: string;
  totalUsage: IUsageInfo;
  cwd: string;
  summary?: string;
}

export interface IProject {
  name: string;
  path: string;
  sessions: ISession[];
  totalMessages: number;
  totalTokens: number;
}

// API response interface (already exists but included for completeness)
export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  timestamp: string;
  details?: any;
}