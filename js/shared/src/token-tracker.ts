import { 
  TranscriptEntry, 
  AssistantTranscriptEntry, 
  SummaryTranscriptEntry,
  UsageInfo 
} from './index';
import { 
  groupEntriesBySession, 
  getSessionTimeRange, 
  extractSessionSummary,
  parseTimestamp 
} from './utils';
import { isAssistantMessage, isSummaryMessage } from './message-detector';

/**
 * Extended usage information with additional analytics
 */
export interface ExtendedUsageInfo extends UsageInfo {
  /** Total tokens (input + output) */
  total_tokens?: number;
  /** Cache hit ratio (read / (creation + read)) */
  cache_hit_ratio?: number;
  /** Cost estimation in dollars (if pricing is available) */
  estimated_cost?: number;
}

/**
 * Session-level token usage statistics
 */
export interface SessionTokenUsage {
  sessionId: string;
  messageCount: number;
  assistantMessageCount: number;
  usage: ExtendedUsageInfo;
  timeRange: {
    start: Date | null;
    end: Date | null;
  };
  summary?: string;
  firstUserMessage?: string;
  workingDirectory?: string;
}

/**
 * Project-level token usage aggregation
 */
export interface ProjectTokenUsage {
  totalSessions: number;
  totalMessages: number;
  totalAssistantMessages: number;
  usage: ExtendedUsageInfo;
  timeRange: {
    start: Date | null;
    end: Date | null;
  };
  sessionUsages: SessionTokenUsage[];
  averageTokensPerMessage: number;
  averageTokensPerSession: number;
}

/**
 * Token usage over time for analytics
 */
export interface TokenUsageTimepoint {
  timestamp: Date;
  sessionId: string;
  messageIndex: number;
  cumulativeUsage: ExtendedUsageInfo;
  messageUsage: UsageInfo;
}

/**
 * Token usage breakdown by message type
 */
export interface TokenUsageByType {
  assistant: ExtendedUsageInfo;
  toolUse: ExtendedUsageInfo;
  thinking: ExtendedUsageInfo;
  conversational: ExtendedUsageInfo;
}

/**
 * Pricing information for cost estimation
 */
export interface ModelPricing {
  modelName: string;
  inputTokenPrice: number; // Price per 1k input tokens in dollars
  outputTokenPrice: number; // Price per 1k output tokens in dollars  
  cacheCreationPrice?: number; // Price per 1k cache creation tokens
  cacheReadPrice?: number; // Price per 1k cache read tokens
}

/**
 * Default pricing for common Claude models (approximate)
 */
export const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-3-5-sonnet-20241022': {
    modelName: 'claude-3-5-sonnet-20241022',
    inputTokenPrice: 3.00, // $3 per 1M input tokens
    outputTokenPrice: 15.00, // $15 per 1M output tokens
    cacheCreationPrice: 3.75, // $3.75 per 1M tokens
    cacheReadPrice: 0.30, // $0.30 per 1M tokens
  },
  'claude-3-sonnet-20240229': {
    modelName: 'claude-3-sonnet-20240229', 
    inputTokenPrice: 3.00,
    outputTokenPrice: 15.00,
    cacheCreationPrice: 3.75,
    cacheReadPrice: 0.30,
  },
  'claude-3-haiku-20240307': {
    modelName: 'claude-3-haiku-20240307',
    inputTokenPrice: 0.25,
    outputTokenPrice: 1.25,
    cacheCreationPrice: 0.30,
    cacheReadPrice: 0.03,
  },
};

/**
 * Extract token usage from a single assistant message
 */
export function extractTokenUsage(entry: AssistantTranscriptEntry): ExtendedUsageInfo {
  const usage = entry.message.usage;
  if (!usage) {
    return {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      total_tokens: 0,
    };
  }

  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheCreation = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;

  const totalTokens = inputTokens + outputTokens;
  const totalCache = cacheCreation + cacheRead;
  const cacheHitRatio = totalCache > 0 ? cacheRead / totalCache : 0;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_creation_input_tokens: cacheCreation,
    cache_read_input_tokens: cacheRead,
    service_tier: usage.service_tier,
    total_tokens: totalTokens,
    cache_hit_ratio: cacheHitRatio,
  };
}

/**
 * Calculate total usage from multiple usage objects
 */
export function aggregateUsage(usages: ExtendedUsageInfo[]): ExtendedUsageInfo {
  const totals = usages.reduce((acc, usage) => ({
    input_tokens: (acc.input_tokens || 0) + (usage.input_tokens || 0),
    output_tokens: (acc.output_tokens || 0) + (usage.output_tokens || 0),
    cache_creation_input_tokens: (acc.cache_creation_input_tokens || 0) + (usage.cache_creation_input_tokens || 0),
    cache_read_input_tokens: (acc.cache_read_input_tokens || 0) + (usage.cache_read_input_tokens || 0),
  }), {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  });

  const totalTokens = (totals.input_tokens || 0) + (totals.output_tokens || 0);
  const totalCache = (totals.cache_creation_input_tokens || 0) + (totals.cache_read_input_tokens || 0);
  const cacheHitRatio = totalCache > 0 ? (totals.cache_read_input_tokens || 0) / totalCache : 0;

  return {
    ...totals,
    total_tokens: totalTokens,
    cache_hit_ratio: cacheHitRatio,
  };
}

/**
 * Calculate estimated cost based on model pricing
 */
export function calculateCost(usage: ExtendedUsageInfo, pricing: ModelPricing): number {
  const inputCost = (usage.input_tokens || 0) * pricing.inputTokenPrice / 1_000_000;
  const outputCost = (usage.output_tokens || 0) * pricing.outputTokenPrice / 1_000_000;
  
  let cacheCost = 0;
  if (pricing.cacheCreationPrice && pricing.cacheReadPrice) {
    const cacheCreationCost = (usage.cache_creation_input_tokens || 0) * pricing.cacheCreationPrice / 1_000_000;
    const cacheReadCost = (usage.cache_read_input_tokens || 0) * pricing.cacheReadPrice / 1_000_000;
    cacheCost = cacheCreationCost + cacheReadCost;
  }

  return inputCost + outputCost + cacheCost;
}

/**
 * Track token usage for a single session
 */
export function trackSessionUsage(entries: TranscriptEntry[]): SessionTokenUsage {
  // Filter out summary entries for most calculations
  const sessionEntries = entries.filter(e => e.type !== 'summary');
  const assistantEntries = sessionEntries.filter(isAssistantMessage);
  
  // Extract usage from all assistant messages
  const usages = assistantEntries.map(extractTokenUsage);
  const aggregatedUsage = aggregateUsage(usages);
  
  // Get session metadata
  const sessionId = sessionEntries[0]?.sessionId || '';
  const timeRange = getSessionTimeRange(entries);
  const summary = extractSessionSummary(entries);
  
  // Find first user message
  const firstUserEntry = sessionEntries.find(e => e.type === 'user');
  const firstUserMessage = firstUserEntry && firstUserEntry.type === 'user' 
    ? (Array.isArray(firstUserEntry.message.content) 
       ? firstUserEntry.message.content.find(c => c.type === 'text')?.text || ''
       : firstUserEntry.message.content)
    : undefined;

  // Get working directory from any session entry
  const workingDirectory = sessionEntries[0]?.cwd;

  return {
    sessionId,
    messageCount: sessionEntries.length,
    assistantMessageCount: assistantEntries.length,
    usage: aggregatedUsage,
    timeRange,
    summary,
    firstUserMessage,
    workingDirectory,
  };
}

/**
 * Track token usage across multiple sessions (project-level)
 */
export function trackProjectUsage(entries: TranscriptEntry[]): ProjectTokenUsage {
  const sessionGroups = groupEntriesBySession(entries);
  const sessionUsages = Object.values(sessionGroups).map(trackSessionUsage);
  
  // Aggregate all session usages
  const totalUsage = aggregateUsage(sessionUsages.map(s => s.usage));
  
  // Calculate project-level statistics
  const totalMessages = sessionUsages.reduce((sum, s) => sum + s.messageCount, 0);
  const totalAssistantMessages = sessionUsages.reduce((sum, s) => sum + s.assistantMessageCount, 0);
  
  // Calculate time range across all sessions
  let projectStart: Date | null = null;
  let projectEnd: Date | null = null;
  
  sessionUsages.forEach(session => {
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

  const averageTokensPerMessage = totalMessages > 0 ? (totalUsage.total_tokens || 0) / totalMessages : 0;
  const averageTokensPerSession = sessionUsages.length > 0 ? (totalUsage.total_tokens || 0) / sessionUsages.length : 0;

  return {
    totalSessions: sessionUsages.length,
    totalMessages,
    totalAssistantMessages,
    usage: totalUsage,
    timeRange: {
      start: projectStart,
      end: projectEnd,
    },
    sessionUsages,
    averageTokensPerMessage,
    averageTokensPerSession,
  };
}

/**
 * Generate token usage timeline for analytics
 */
export function generateUsageTimeline(entries: TranscriptEntry[]): TokenUsageTimepoint[] {
  const sessionGroups = groupEntriesBySession(entries);
  const timeline: TokenUsageTimepoint[] = [];
  
  Object.values(sessionGroups).forEach(sessionEntries => {
    const sessionId = (sessionEntries[0] && 'sessionId' in sessionEntries[0]) ? sessionEntries[0].sessionId : '';
    let cumulativeUsage: ExtendedUsageInfo = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      total_tokens: 0,
    };
    
    sessionEntries.forEach((entry, index) => {
      if (isAssistantMessage(entry)) {
        const messageUsage = extractTokenUsage(entry);
        cumulativeUsage = aggregateUsage([cumulativeUsage, messageUsage]);
        
        const timestamp = parseTimestamp(entry.timestamp);
        if (timestamp) {
          timeline.push({
            timestamp,
            sessionId,
            messageIndex: index,
            cumulativeUsage: { ...cumulativeUsage },
            messageUsage,
          });
        }
      }
    });
  });
  
  return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Analyze token usage by message content type
 */
export function analyzeUsageByType(entries: TranscriptEntry[]): TokenUsageByType {
  const assistantEntries = entries.filter(isAssistantMessage);
  
  const byType = {
    assistant: [] as ExtendedUsageInfo[],
    toolUse: [] as ExtendedUsageInfo[],
    thinking: [] as ExtendedUsageInfo[],
    conversational: [] as ExtendedUsageInfo[],
  };
  
  assistantEntries.forEach(entry => {
    const usage = extractTokenUsage(entry);
    const content = entry.message.content;
    
    // Categorize based on content
    let hasToolUse = false;
    let hasThinking = false;
    
    if (Array.isArray(content)) {
      hasToolUse = content.some(item => item.type === 'tool_use');
      hasThinking = content.some(item => item.type === 'thinking');
    }
    
    // Add to appropriate categories
    byType.assistant.push(usage);
    
    if (hasToolUse) {
      byType.toolUse.push(usage);
    }
    
    if (hasThinking) {
      byType.thinking.push(usage);
    }
    
    if (!hasToolUse && !hasThinking) {
      byType.conversational.push(usage);
    }
  });
  
  return {
    assistant: aggregateUsage(byType.assistant),
    toolUse: aggregateUsage(byType.toolUse),
    thinking: aggregateUsage(byType.thinking),
    conversational: aggregateUsage(byType.conversational),
  };
}

/**
 * Add cost estimates to usage information
 */
export function addCostEstimates(
  usage: ExtendedUsageInfo, 
  modelName?: string,
  customPricing?: ModelPricing
): ExtendedUsageInfo {
  let pricing = customPricing;
  
  if (!pricing && modelName && DEFAULT_MODEL_PRICING[modelName]) {
    pricing = DEFAULT_MODEL_PRICING[modelName];
  }
  
  if (pricing) {
    return {
      ...usage,
      estimated_cost: calculateCost(usage, pricing),
    };
  }
  
  return usage;
}

/**
 * Format usage information for human-readable display
 */
export function formatUsage(usage: ExtendedUsageInfo): string {
  const lines: string[] = [];
  
  if (usage.input_tokens) {
    lines.push(`Input: ${usage.input_tokens.toLocaleString()}`);
  }
  
  if (usage.output_tokens) {
    lines.push(`Output: ${usage.output_tokens.toLocaleString()}`);
  }
  
  if (usage.cache_creation_input_tokens) {
    lines.push(`Cache Creation: ${usage.cache_creation_input_tokens.toLocaleString()}`);
  }
  
  if (usage.cache_read_input_tokens) {
    lines.push(`Cache Read: ${usage.cache_read_input_tokens.toLocaleString()}`);
  }
  
  if (usage.total_tokens) {
    lines.push(`Total: ${usage.total_tokens.toLocaleString()}`);
  }
  
  if (usage.cache_hit_ratio && usage.cache_hit_ratio > 0) {
    lines.push(`Cache Hit Ratio: ${(usage.cache_hit_ratio * 100).toFixed(1)}%`);
  }
  
  if (usage.estimated_cost) {
    lines.push(`Estimated Cost: $${usage.estimated_cost.toFixed(4)}`);
  }
  
  return lines.join(' | ');
}

/**
 * Generate a comprehensive usage report
 */
export function generateUsageReport(projectUsage: ProjectTokenUsage): string {
  const lines: string[] = [];
  
  lines.push('# Token Usage Report\n');
  
  // Project overview
  lines.push('## Project Overview');
  lines.push(`- Total Sessions: ${projectUsage.totalSessions}`);
  lines.push(`- Total Messages: ${projectUsage.totalMessages}`);
  lines.push(`- Assistant Messages: ${projectUsage.totalAssistantMessages}`);
  lines.push(`- Average Tokens/Message: ${projectUsage.averageTokensPerMessage.toFixed(0)}`);
  lines.push(`- Average Tokens/Session: ${projectUsage.averageTokensPerSession.toFixed(0)}`);
  lines.push('');
  
  // Total usage
  lines.push('## Total Usage');
  lines.push(formatUsage(projectUsage.usage));
  lines.push('');
  
  // Session breakdown
  lines.push('## Session Breakdown');
  projectUsage.sessionUsages.forEach((session, index) => {
    lines.push(`### Session ${index + 1}: ${session.sessionId}`);
    lines.push(`- Messages: ${session.messageCount} (${session.assistantMessageCount} assistant)`);
    lines.push(`- Usage: ${formatUsage(session.usage)}`);
    if (session.summary) {
      lines.push(`- Summary: ${session.summary}`);
    }
    if (session.firstUserMessage) {
      lines.push(`- First Message: ${session.firstUserMessage.substring(0, 100)}...`);
    }
    lines.push('');
  });
  
  return lines.join('\n');
}