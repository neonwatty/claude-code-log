// Session Browser Module
// Comprehensive visual browser interface for Claude Code sessions

export { SessionBrowser } from './SessionBrowser';
export { SessionViewer } from './viewer/SessionViewer';
export { SessionNavigation } from './navigation/SessionNavigation';

// Re-export commonly used types for convenience
export type {
  SessionSummary,
  SessionDetail,
  SessionFilter,
  SessionSort,
  PaginationOptions,
  DisplayMode,
  MessageDisplay,
  ProcessedContent,
  MessageMetadata,
  SessionBranchTree,
  ComponentEvents
} from '../types/session-types';