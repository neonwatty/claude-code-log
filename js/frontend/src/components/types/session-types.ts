import { TranscriptEntry, ContentItem } from '@app/shared';

/**
 * Session view component interfaces and types
 */

/**
 * Display modes for components
 */
export type DisplayMode = 'compact' | 'detailed' | 'minimal';

/**
 * Theme variants
 */
export type ThemeVariant = 'light' | 'dark' | 'auto';

/**
 * Session branch metadata
 */
export interface SessionBranchData {
  /** Parent session ID (null for root sessions) */
  parentSessionId?: string | null;
  /** Message index in parent session where this branch started */
  branchPoint?: number | null;
  /** Timestamp when this branch was created */
  branchTimestamp?: Date | null;
  /** Additional branch metadata */
  branchMetadata?: {
    /** User-provided name for this branch */
    branchName?: string;
    /** Description of why this branch was created */
    branchReason?: string;
    /** Original message content at branch point */
    originalMessage?: string;
  };
}

/**
 * Session summary information for list views
 */
export interface SessionSummary extends SessionBranchData {
  /** Unique session identifier */
  sessionId: string;
  /** Session title or description */
  title?: string;
  /** Working directory path */
  cwd: string;
  /** Start timestamp */
  startTime: Date;
  /** End timestamp (if session is completed) */
  endTime?: Date;
  /** Total number of messages in the session */
  messageCount: number;
  /** Number of user messages */
  userMessageCount: number;
  /** Number of assistant messages */
  assistantMessageCount: number;
  /** Session duration in milliseconds */
  duration?: number;
  /** Whether the session is currently active */
  isActive: boolean;
  /** Session tags or categories */
  tags?: string[];
  /** Brief summary of the session content */
  summary?: string;
  /** Token usage information */
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * Detailed session information for detailed views
 */
export interface SessionDetail extends SessionSummary {
  /** All transcript entries for the session */
  entries: TranscriptEntry[];
  /** Session metadata */
  metadata?: Record<string, any>;
  /** File paths referenced in the session */
  referencedFiles?: string[];
  /** Tools used in the session */
  toolsUsed?: string[];
  /** Error information if session had issues */
  errors?: SessionError[];
}

/**
 * Session error information
 */
export interface SessionError {
  /** Error message */
  message: string;
  /** Error timestamp */
  timestamp: Date;
  /** Error context or stack trace */
  context?: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high';
}

/**
 * Message display information
 */
export interface MessageDisplay {
  /** Original transcript entry */
  entry: TranscriptEntry;
  /** Processed content for display */
  processedContent: ProcessedContent[];
  /** Display metadata */
  metadata: MessageMetadata;
}

/**
 * Processed content for rendering
 */
export interface ProcessedContent {
  /** Content type */
  type: 'text' | 'code' | 'tool_use' | 'tool_result' | 'thinking' | 'image' | 'error';
  /** Raw content */
  content: string | ContentItem;
  /** Language for syntax highlighting (if applicable) */
  language?: string;
  /** Whether content should be collapsible */
  collapsible?: boolean;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Message metadata for display
 */
export interface MessageMetadata {
  /** Message timestamp */
  timestamp: Date;
  /** Message index in session */
  index: number;
  /** Whether message has tool use */
  hasToolUse: boolean;
  /** Whether message has thinking content */
  hasThinking: boolean;
  /** Whether message has errors */
  hasErrors: boolean;
  /** Token count for this message */
  tokenCount?: number;
  /** Processing duration (for assistant messages) */
  processingDuration?: number;
}

/**
 * Tool use display information
 */
export interface ToolUseDisplay {
  /** Tool name */
  name: string;
  /** Tool parameters */
  parameters: Record<string, any>;
  /** Tool result */
  result?: any;
  /** Tool execution status */
  status: 'pending' | 'success' | 'error';
  /** Error message if tool failed */
  error?: string;
  /** Execution duration */
  duration?: number;
}

/**
 * Filtering options for session lists
 */
export interface SessionFilter {
  /** Search query string */
  query?: string;
  /** Date range filter */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** Tags to filter by */
  tags?: string[];
  /** Working directory filter */
  cwd?: string;
  /** Message count range */
  messageCountRange?: {
    min: number;
    max: number;
  };
  /** Duration range (in minutes) */
  durationRange?: {
    min: number;
    max: number;
  };
  /** Whether to show only active sessions */
  activeOnly?: boolean;
  /** Whether to show only sessions with errors */
  errorsOnly?: boolean;
}

/**
 * Sorting options for session lists
 */
export interface SessionSort {
  /** Field to sort by */
  field: 'startTime' | 'endTime' | 'messageCount' | 'duration' | 'title';
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  /** Current page (0-based) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items */
  totalItems: number;
  /** Whether there are more pages */
  hasNextPage: boolean;
  /** Whether there are previous pages */
  hasPrevPage: boolean;
}

/**
 * Session branch tree structure for visualization
 */
export interface SessionBranchTree {
  /** Root session (has no parent) */
  rootSession: SessionSummary;
  /** Direct child branches */
  branches: SessionBranchTree[];
  /** Depth level in the tree */
  depth: number;
}

/**
 * Branch point information for UI selection
 */
export interface BranchPoint {
  /** Message index in session */
  messageIndex: number;
  /** Message content preview */
  messagePreview: string;
  /** Message timestamp */
  timestamp: Date;
  /** Whether this point already has branches */
  hasBranches: boolean;
  /** Number of existing branches from this point */
  branchCount: number;
}

/**
 * Branch creation request
 */
export interface BranchCreationRequest {
  /** Parent session ID */
  parentSessionId: string;
  /** Message index to branch from */
  branchPoint: number;
  /** Optional branch metadata */
  metadata?: {
    branchName?: string;
    branchReason?: string;
  };
}

/**
 * Branch creation response
 */
export interface BranchCreationResponse {
  /** Newly created session ID */
  sessionId: string;
  /** Complete session data */
  session: SessionSummary;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * WebSocket branch notification data
 */
export interface BranchNotification {
  /** Event type */
  type: 'session:branched' | 'session:branch-updated' | 'session:branch-deleted';
  /** Parent session ID */
  parentSessionId: string;
  /** Branch session ID */
  branchSessionId: string;
  /** Branch point index */
  branchPoint: number;
  /** Branch metadata */
  metadata?: SessionBranchData['branchMetadata'];
  /** Timestamp of the event */
  timestamp: Date;
}

/**
 * Component event types
 */
export interface ComponentEvents {
  /** Session selected event */
  'session-selected': {
    sessionId: string;
    session: SessionSummary;
  };
  
  /** Message selected event */
  'message-selected': {
    messageIndex: number;
    message: MessageDisplay;
  };
  
  /** Filter changed event */
  'filter-changed': {
    filter: SessionFilter;
  };
  
  /** Sort changed event */
  'sort-changed': {
    sort: SessionSort;
  };
  
  /** Page changed event */
  'page-changed': {
    page: number;
    pageSize: number;
  };
  
  /** Error occurred event */
  'error-occurred': {
    error: string;
    context?: string;
  };
  
  /** Loading state changed event */
  'loading-changed': {
    loading: boolean;
  };

  /** Branch point selected event */
  'branch-point-selected': {
    sessionId: string;
    branchPoint: BranchPoint;
  };

  /** Branch creation requested event */
  'branch-create-requested': {
    request: BranchCreationRequest;
  };

  /** Branch created event */
  'branch-created': {
    parentSessionId: string;
    newSession: SessionSummary;
  };

  /** Branch navigation event */
  'branch-navigate': {
    fromSessionId: string;
    toSessionId: string;
  };

  /** Branch tree updated event */
  'branch-tree-updated': {
    rootSessionId: string;
    tree: SessionBranchTree;
  };
}

/**
 * Syntax highlighting configuration
 */
export interface SyntaxHighlightConfig {
  /** Theme name */
  theme: string;
  /** Supported languages */
  languages: string[];
  /** Line numbers enabled */
  lineNumbers: boolean;
  /** Word wrap enabled */
  wordWrap: boolean;
  /** Tab size */
  tabSize: number;
}

/**
 * Markdown rendering configuration
 */
export interface MarkdownConfig {
  /** Enable HTML in markdown */
  html: boolean;
  /** Enable link target="_blank" */
  linkify: boolean;
  /** Enable typographer */
  typographer: boolean;
  /** Code highlighting enabled */
  highlight: boolean;
  /** Table support */
  tables: boolean;
  /** Task list support */
  taskLists: boolean;
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  /** Virtual scrolling threshold */
  virtualScrollThreshold: number;
  /** Lazy loading threshold */
  lazyLoadThreshold: number;
  /** Image lazy loading */
  lazyImages: boolean;
  /** Debounce delay for search */
  searchDebounceMs: number;
  /** Maximum items to render initially */
  initialRenderLimit: number;
}

/**
 * Accessibility configuration
 */
export interface AccessibilityConfig {
  /** Enable screen reader announcements */
  announcements: boolean;
  /** Enable keyboard navigation */
  keyboardNavigation: boolean;
  /** Enable high contrast mode */
  highContrast: boolean;
  /** Enable reduced motion */
  reducedMotion: boolean;
  /** Focus management enabled */
  focusManagement: boolean;
}

/**
 * Component configuration
 */
export interface ComponentConfig {
  /** Display mode */
  displayMode: DisplayMode;
  /** Theme variant */
  theme: ThemeVariant;
  /** Syntax highlighting config */
  syntaxHighlight: SyntaxHighlightConfig;
  /** Markdown config */
  markdown: MarkdownConfig;
  /** Performance config */
  performance: PerformanceConfig;
  /** Accessibility config */
  accessibility: AccessibilityConfig;
}

/**
 * Custom event detail types
 */
export type CustomEventDetail<K extends keyof ComponentEvents> = ComponentEvents[K];