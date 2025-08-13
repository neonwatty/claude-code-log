import {
  TranscriptEntry,
  UserTranscriptEntry,
  AssistantTranscriptEntry,
  SummaryTranscriptEntry,
  ContentItem,
} from './index';
import { 
  groupEntriesBySession,
  getSessionTimeRange,
  extractSessionSummary,
  parseTimestamp,
  extractTextFromContent,
} from './utils';
import { trackSessionUsage } from './token-tracker';
import { isAssistantMessage, isUserMessage } from './message-detector';

/**
 * Enhanced session information with metadata and organization
 */
export interface SessionInfo {
  sessionId: string;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  summaryCount: number;
  workingDirectory: string;
  timeRange: {
    start: Date | null;
    end: Date | null;
  };
  summary: string;
  firstUserMessage?: string;
  lastAssistantMessage?: string;
  entries: TranscriptEntry[];
  tokenUsage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost?: number;
  };
  
  // Branch-specific fields for JSONL compatibility
  parentSessionId?: string | null;
  branchPoint?: number | null;
  branchTimestamp?: Date | null;
  branchMetadata?: {
    branchName?: string;
    branchReason?: string;
    originalMessage?: string;
  };
}

/**
 * Project-level session organization
 */
export interface ProjectSessions {
  sessionCount: number;
  totalMessages: number;
  timeRange: {
    start: Date | null;
    end: Date | null;
  };
  sessions: SessionInfo[];
  sessionsByWorkingDirectory: Record<string, SessionInfo[]>;
}

/**
 * Options for session organization
 */
export interface SessionOrganizationOptions {
  sortBy?: 'chronological' | 'reverse-chronological' | 'sessionId';
  includeTokenUsage?: boolean;
  includeMessagePreviews?: boolean;
  groupByWorkingDirectory?: boolean;
  minMessageCount?: number;
  maxPreviewLength?: number;
}

const DEFAULT_OPTIONS: Required<SessionOrganizationOptions> = {
  sortBy: 'chronological',
  includeTokenUsage: true,
  includeMessagePreviews: true,
  groupByWorkingDirectory: true,
  minMessageCount: 1,
  maxPreviewLength: 200,
};

/**
 * Extract branch metadata from a transcript entry if present
 */
function extractBranchMetadata(entry: TranscriptEntry | undefined): {
  parentSessionId?: string | null;
  branchPoint?: number | null;
  branchTimestamp?: Date | null;
  branchMetadata?: {
    branchName?: string;
    branchReason?: string;
    originalMessage?: string;
  };
} {
  if (!entry) {
    return {};
  }

  // In a real implementation, branch metadata might be stored in entry.metadata
  // or in a special branch entry type. For now, we'll extract it from metadata if present.
  const metadata = (entry as any).metadata;
  if (metadata && metadata.branch) {
    return {
      parentSessionId: metadata.branch.parentSessionId || null,
      branchPoint: metadata.branch.branchPoint || null,
      branchTimestamp: metadata.branch.branchTimestamp ? new Date(metadata.branch.branchTimestamp) : null,
      branchMetadata: metadata.branch.branchMetadata,
    };
  }

  return {};
}

/**
 * Extract preview text from the first user message in a session
 */
function extractFirstUserMessagePreview(entries: TranscriptEntry[], maxLength: number): string | undefined {
  const firstUserEntry = entries.find((entry): entry is UserTranscriptEntry => 
    isUserMessage(entry) && entry.type === 'user'
  );
  
  if (!firstUserEntry) {
    return undefined;
  }

  const text = extractTextFromContent(firstUserEntry.message.content);
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + '...';
  }
  return text;
}

/**
 * Extract preview text from the last assistant message in a session
 */
function extractLastAssistantMessagePreview(entries: TranscriptEntry[], maxLength: number): string | undefined {
  // Find last assistant message
  const assistantEntries = entries.filter((entry): entry is AssistantTranscriptEntry => 
    isAssistantMessage(entry)
  );
  
  if (assistantEntries.length === 0) {
    return undefined;
  }

  const lastAssistantEntry = assistantEntries[assistantEntries.length - 1];
  const text = extractTextFromContent(lastAssistantEntry.message.content);
  
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + '...';
  }
  return text;
}

/**
 * Organize entries into session information with metadata
 */
export function organizeIntoSessions(
  entries: TranscriptEntry[], 
  options: SessionOrganizationOptions = {}
): SessionInfo[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // First, we need to match summary entries to their sessions
  // Summaries have leafUuid that should match an assistant message's UUID
  const summaryEntries = entries.filter(entry => entry.type === 'summary');
  const nonSummaryEntries = entries.filter(entry => entry.type !== 'summary');
  
  // Create a map from UUID to sessionId for assistant messages
  const uuidToSessionMap: Map<string, string> = new Map();
  nonSummaryEntries.forEach(entry => {
    if (entry.type === 'assistant') {
      uuidToSessionMap.set(entry.uuid, entry.sessionId);
    }
  });
  
  // Group non-summary entries by session
  const sessionGroups = groupEntriesBySession(nonSummaryEntries);
  
  // Add summary entries to their corresponding sessions
  summaryEntries.forEach(summary => {
    const sessionId = uuidToSessionMap.get(summary.leafUuid);
    if (sessionId && sessionGroups[sessionId]) {
      sessionGroups[sessionId].push(summary);
    }
  });
  
  const sessions: SessionInfo[] = Object.entries(sessionGroups)
    .map(([sessionId, sessionEntries]) => {
      // Filter out entries that don't meet minimum message count
      if (sessionEntries.length < opts.minMessageCount) {
        return null;
      }

      // Count message types
      const userMessages = sessionEntries.filter(isUserMessage);
      const assistantMessages = sessionEntries.filter(isAssistantMessage);
      const summaryMessages = sessionEntries.filter(entry => entry.type === 'summary');

      // Get working directory from first entry
      const workingDirectory = sessionEntries.find(e => e.type !== 'summary')?.cwd || '';

      // Get session metadata
      const timeRange = getSessionTimeRange(sessionEntries);
      const summary = extractSessionSummary(sessionEntries);

      // Get message previews if requested
      let firstUserMessage: string | undefined;
      let lastAssistantMessage: string | undefined;

      if (opts.includeMessagePreviews) {
        firstUserMessage = extractFirstUserMessagePreview(sessionEntries, opts.maxPreviewLength);
        lastAssistantMessage = extractLastAssistantMessagePreview(sessionEntries, opts.maxPreviewLength);
      }

      // Get token usage if requested
      let tokenUsage: SessionInfo['tokenUsage'];
      if (opts.includeTokenUsage) {
        const sessionUsage = trackSessionUsage(sessionEntries);
        tokenUsage = {
          input_tokens: sessionUsage.usage.input_tokens || 0,
          output_tokens: sessionUsage.usage.output_tokens || 0,
          total_tokens: sessionUsage.usage.total_tokens || 0,
          estimated_cost: sessionUsage.usage.estimated_cost,
        };
      }

      // Extract branch metadata from first entry if present
      const firstEntry = sessionEntries.find(e => e.type !== 'summary');
      const branchData = extractBranchMetadata(firstEntry);

      return {
        sessionId,
        messageCount: sessionEntries.length,
        userMessageCount: userMessages.length,
        assistantMessageCount: assistantMessages.length,
        summaryCount: summaryMessages.length,
        workingDirectory,
        timeRange,
        summary,
        firstUserMessage,
        lastAssistantMessage,
        entries: sessionEntries,
        tokenUsage,
        ...branchData,
      } as SessionInfo;
    })
    .filter((session): session is SessionInfo => session !== null);

  // Sort sessions based on options
  switch (opts.sortBy) {
    case 'chronological':
      sessions.sort((a, b) => {
        const aTime = a.timeRange.start?.getTime() || 0;
        const bTime = b.timeRange.start?.getTime() || 0;
        return aTime - bTime;
      });
      break;
    case 'reverse-chronological':
      sessions.sort((a, b) => {
        const aTime = a.timeRange.start?.getTime() || 0;
        const bTime = b.timeRange.start?.getTime() || 0;
        return bTime - aTime;
      });
      break;
    case 'sessionId':
      sessions.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
      break;
  }

  return sessions;
}

/**
 * Organize entries into project-level session structure
 */
export function organizeProject(
  entries: TranscriptEntry[],
  options: SessionOrganizationOptions = {}
): ProjectSessions {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sessions = organizeIntoSessions(entries, options);

  // Calculate project-level time range
  let projectStart: Date | null = null;
  let projectEnd: Date | null = null;

  sessions.forEach(session => {
    if (session.timeRange.start) {
      if (!projectStart || session.timeRange.start < projectStart) {
        projectStart = session.timeRange.start;
      }
    }
    if (session.timeRange.end) {
      if (!projectEnd || session.timeRange.end > projectEnd) {
        projectEnd = session.timeRange.end;
      }
    }
  });

  // Group sessions by working directory if requested
  let sessionsByWorkingDirectory: Record<string, SessionInfo[]> = {};
  if (opts.groupByWorkingDirectory) {
    sessions.forEach(session => {
      const key = session.workingDirectory || 'unknown';
      if (!sessionsByWorkingDirectory[key]) {
        sessionsByWorkingDirectory[key] = [];
      }
      sessionsByWorkingDirectory[key].push(session);
    });
  }

  // Calculate total message count
  const totalMessages = sessions.reduce((sum, session) => sum + session.messageCount, 0);

  return {
    sessionCount: sessions.length,
    totalMessages,
    timeRange: {
      start: projectStart,
      end: projectEnd,
    },
    sessions,
    sessionsByWorkingDirectory,
  };
}

/**
 * Find sessions that match a working directory pattern
 */
export function findSessionsByWorkingDirectory(
  sessions: SessionInfo[],
  workingDirectoryPattern: string
): SessionInfo[] {
  const pattern = workingDirectoryPattern.toLowerCase();
  
  return sessions.filter(session => {
    const sessionCwd = session.workingDirectory.toLowerCase();
    return sessionCwd.includes(pattern) || pattern.includes(sessionCwd);
  });
}

/**
 * Find sessions within a specific time range
 */
export function findSessionsByTimeRange(
  sessions: SessionInfo[],
  startDate: Date,
  endDate?: Date
): SessionInfo[] {
  return sessions.filter(session => {
    if (!session.timeRange.start) return false;
    
    const sessionStart = session.timeRange.start;
    
    // Check if session starts after the start date
    if (sessionStart < startDate) return false;
    
    // Check if session starts before the end date (if provided)
    if (endDate && sessionStart > endDate) return false;
    
    return true;
  });
}

/**
 * Get session statistics summary
 */
export function getSessionStatistics(sessions: SessionInfo[]) {
  const stats = {
    totalSessions: sessions.length,
    totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0),
    totalUserMessages: sessions.reduce((sum, s) => sum + s.userMessageCount, 0),
    totalAssistantMessages: sessions.reduce((sum, s) => sum + s.assistantMessageCount, 0),
    totalTokens: 0,
    totalCost: 0,
    averageMessagesPerSession: 0,
    workingDirectories: new Set<string>(),
    timeSpan: {
      start: null as Date | null,
      end: null as Date | null,
      durationDays: 0,
    },
  };

  // Calculate token and cost totals
  sessions.forEach(session => {
    if (session.tokenUsage) {
      stats.totalTokens += session.tokenUsage.total_tokens;
      if (session.tokenUsage.estimated_cost) {
        stats.totalCost += session.tokenUsage.estimated_cost;
      }
    }
    stats.workingDirectories.add(session.workingDirectory);
  });

  // Calculate averages
  if (stats.totalSessions > 0) {
    stats.averageMessagesPerSession = Math.round(stats.totalMessages / stats.totalSessions);
  }

  // Calculate time span
  sessions.forEach(session => {
    if (session.timeRange.start) {
      if (!stats.timeSpan.start || session.timeRange.start < stats.timeSpan.start) {
        stats.timeSpan.start = session.timeRange.start;
      }
    }
    if (session.timeRange.end) {
      if (!stats.timeSpan.end || session.timeRange.end > stats.timeSpan.end) {
        stats.timeSpan.end = session.timeRange.end;
      }
    }
  });

  if (stats.timeSpan.start && stats.timeSpan.end) {
    const diffMs = stats.timeSpan.end.getTime() - stats.timeSpan.start.getTime();
    stats.timeSpan.durationDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  return {
    ...stats,
    workingDirectories: Array.from(stats.workingDirectories),
  };
}

/**
 * Format session for display (like TUI or reports)
 */
export function formatSessionSummary(session: SessionInfo): string {
  const parts: string[] = [];
  
  // Session ID and message count
  parts.push(`Session: ${session.sessionId}`);
  parts.push(`Messages: ${session.messageCount} (${session.userMessageCount}U, ${session.assistantMessageCount}A)`);
  
  // Time range
  if (session.timeRange.start && session.timeRange.end) {
    const start = session.timeRange.start.toLocaleString();
    const end = session.timeRange.end.toLocaleString();
    parts.push(`Time: ${start} - ${end}`);
  }
  
  // Working directory
  if (session.workingDirectory) {
    parts.push(`Dir: ${session.workingDirectory}`);
  }
  
  // Token usage
  if (session.tokenUsage) {
    const cost = session.tokenUsage.estimated_cost 
      ? ` ($${session.tokenUsage.estimated_cost.toFixed(4)})`
      : '';
    parts.push(`Tokens: ${session.tokenUsage.total_tokens}${cost}`);
  }
  
  // Summary
  if (session.summary) {
    parts.push(`Summary: ${session.summary}`);
  }
  
  return parts.join(' | ');
}

/**
 * Build a branch tree structure from sessions
 */
export function buildBranchTree(sessions: SessionInfo[]): SessionInfo[] {
  // Separate root sessions (no parent) from branch sessions
  const rootSessions: SessionInfo[] = [];
  const branchSessions = new Map<string, SessionInfo[]>();

  sessions.forEach(session => {
    if (!session.parentSessionId) {
      rootSessions.push(session);
    } else {
      if (!branchSessions.has(session.parentSessionId)) {
        branchSessions.set(session.parentSessionId, []);
      }
      branchSessions.get(session.parentSessionId)!.push(session);
    }
  });

  // Sort branch sessions by branch point and timestamp
  branchSessions.forEach(branches => {
    branches.sort((a, b) => {
      if (a.branchPoint !== b.branchPoint) {
        return (a.branchPoint || 0) - (b.branchPoint || 0);
      }
      const aTime = a.branchTimestamp?.getTime() || 0;
      const bTime = b.branchTimestamp?.getTime() || 0;
      return aTime - bTime;
    });
  });

  return rootSessions;
}

/**
 * Get all sessions in a branch tree starting from a root session
 */
export function getBranchTreeSessions(rootSession: SessionInfo, allSessions: SessionInfo[]): SessionInfo[] {
  const result: SessionInfo[] = [rootSession];
  const sessionMap = new Map(allSessions.map(s => [s.sessionId, s]));

  const addBranches = (parentId: string) => {
    allSessions
      .filter(s => s.parentSessionId === parentId)
      .forEach(branch => {
        result.push(branch);
        addBranches(branch.sessionId);
      });
  };

  addBranches(rootSession.sessionId);
  return result;
}

/**
 * Find the root session for a given session
 */
export function findRootSession(session: SessionInfo, allSessions: SessionInfo[]): SessionInfo {
  if (!session.parentSessionId) {
    return session;
  }

  const parent = allSessions.find(s => s.sessionId === session.parentSessionId);
  if (!parent) {
    return session; // Parent not found, treat as root
  }

  return findRootSession(parent, allSessions);
}

/**
 * Get sessions that branch from a specific message index
 */
export function getSessionBranches(sessionId: string, messageIndex: number, allSessions: SessionInfo[]): SessionInfo[] {
  return allSessions.filter(
    s => s.parentSessionId === sessionId && s.branchPoint === messageIndex
  );
}

/**
 * Check if a session has any branches
 */
export function sessionHasBranches(sessionId: string, allSessions: SessionInfo[]): boolean {
  return allSessions.some(s => s.parentSessionId === sessionId);
}

/**
 * Get branch depth (how many levels deep from root)
 */
export function getBranchDepth(session: SessionInfo, allSessions: SessionInfo[]): number {
  if (!session.parentSessionId) {
    return 0;
  }

  const parent = allSessions.find(s => s.sessionId === session.parentSessionId);
  if (!parent) {
    return 0;
  }

  return 1 + getBranchDepth(parent, allSessions);
}

/**
 * Format branch information for display
 */
export function formatBranchInfo(session: SessionInfo): string {
  if (!session.parentSessionId) {
    return 'Root session';
  }

  const parts: string[] = [];
  parts.push(`Branch from ${session.parentSessionId}`);
  
  if (session.branchPoint !== null && session.branchPoint !== undefined) {
    parts.push(`at message ${session.branchPoint}`);
  }
  
  if (session.branchMetadata?.branchName) {
    parts.push(`"${session.branchMetadata.branchName}"`);
  }
  
  if (session.branchTimestamp) {
    parts.push(`created ${session.branchTimestamp.toLocaleString()}`);
  }

  return parts.join(' ');
}