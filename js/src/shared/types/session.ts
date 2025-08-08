export interface ClaudeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: ClaudeContent[];
  timestamp: string;
  usage?: TokenUsage;
}

export interface ClaudeContent {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  image_url?: string;
  tool_use_id?: string;
  tool_use?: ToolUse;
  tool_result?: ToolResult;
}

export interface ToolUse {
  id: string;
  type: string;
  name: string;
  input: any;
}

export interface ToolResult {
  tool_use_id: string;
  type: string;
  content: any;
  is_error?: boolean;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface ClaudeSession {
  id: string;
  title?: string;
  summary?: string;
  messages: ClaudeMessage[];
  metadata: SessionMetadata;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMetadata {
  projectPath?: string;
  workingDirectory?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  sessions: ClaudeSession[];
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  summary: string;
  messageCount: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
  projectPath?: string;
}

export interface FilterOptions {
  dateRange?: {
    start: string;
    end: string;
  };
  messageTypes?: string[];
  projects?: string[];
  searchTerm?: string;
}

export interface SessionStats {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  dateRange: {
    start: string;
    end: string;
  };
  projects: Project[];
}
