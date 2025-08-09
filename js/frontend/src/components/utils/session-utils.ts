import { TranscriptEntry, ContentItem, TextContent, ToolUseContent, ToolResultContent, ThinkingContent } from '@app/shared';
import { SessionSummary, SessionDetail, MessageDisplay, ProcessedContent, MessageMetadata, ToolUseDisplay } from '../types/session-types';

/**
 * Utility functions for session data processing and manipulation
 */

/**
 * Creates a session summary from transcript entries
 * @param entries - Array of transcript entries
 * @param sessionId - Session identifier
 * @param cwd - Working directory
 * @returns Session summary object
 */
export function createSessionSummary(
  entries: TranscriptEntry[],
  sessionId: string,
  cwd: string
): SessionSummary {
  if (entries.length === 0) {
    return {
      sessionId,
      cwd,
      startTime: new Date(),
      messageCount: 0,
      userMessageCount: 0,
      assistantMessageCount: 0,
      isActive: false,
    };
  }

  // Sort entries by timestamp
  const sortedEntries = [...entries].sort((a, b) => {
    const aTime = 'timestamp' in a ? a.timestamp : '';
    const bTime = 'timestamp' in b ? b.timestamp : '';
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });

  const firstEntry = sortedEntries[0];
  const lastEntry = sortedEntries[sortedEntries.length - 1];

  const userMessages = entries.filter(e => e.type === 'user');
  const assistantMessages = entries.filter(e => e.type === 'assistant');

  const firstTimestamp = 'timestamp' in firstEntry ? firstEntry.timestamp : '';
  const lastTimestamp = 'timestamp' in lastEntry ? lastEntry.timestamp : '';
  const startTime = new Date(firstTimestamp);
  const endTime = new Date(lastTimestamp);
  const duration = endTime.getTime() - startTime.getTime();

  // Calculate token usage if available
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  
  assistantMessages.forEach(msg => {
    if (msg.type === 'assistant' && msg.message.usage) {
      totalInputTokens += msg.message.usage.input_tokens || 0;
      totalOutputTokens += msg.message.usage.output_tokens || 0;
    }
  });

  return {
    sessionId,
    cwd,
    startTime,
    endTime,
    duration,
    messageCount: entries.length,
    userMessageCount: userMessages.length,
    assistantMessageCount: assistantMessages.length,
    isActive: false, // Would need real-time info to determine
    tokenUsage: totalInputTokens > 0 || totalOutputTokens > 0 ? {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
    } : undefined,
  };
}

/**
 * Processes transcript entries into display-ready message objects
 * @param entries - Array of transcript entries
 * @returns Array of processed message display objects
 */
export function processMessagesForDisplay(entries: TranscriptEntry[]): MessageDisplay[] {
  return entries.map((entry, index) => ({
    entry,
    processedContent: processMessageContent(entry),
    metadata: extractMessageMetadata(entry, index),
  }));
}

/**
 * Processes message content into display-ready format
 * @param entry - Transcript entry
 * @returns Array of processed content items
 */
export function processMessageContent(entry: TranscriptEntry): ProcessedContent[] {
  const processedContent: ProcessedContent[] = [];

  if (entry.type === 'user') {
    const content = entry.message.content;
    if (typeof content === 'string') {
      processedContent.push({
        type: 'text',
        content,
      });
    } else if (Array.isArray(content)) {
      content.forEach(item => {
        processedContent.push(processContentItem(item));
      });
    }
  } else if (entry.type === 'assistant') {
    entry.message.content.forEach(item => {
      processedContent.push(processContentItem(item));
    });
  } else if (entry.type === 'system') {
    processedContent.push({
      type: 'text',
      content: entry.content,
    });
  }

  return processedContent;
}

/**
 * Processes individual content items
 * @param item - Content item
 * @returns Processed content object
 */
function processContentItem(item: ContentItem): ProcessedContent {
  switch (item.type) {
    case 'text':
      return {
        type: 'text',
        content: item.text,
      };

    case 'tool_use':
      return {
        type: 'tool_use',
        content: item,
        collapsible: true,
        defaultCollapsed: false,
      };

    case 'tool_result':
      return {
        type: 'tool_result',
        content: item,
        collapsible: true,
        defaultCollapsed: true,
      };

    case 'thinking':
      return {
        type: 'thinking',
        content: item.thinking,
        collapsible: true,
        defaultCollapsed: true,
      };

    case 'image':
      return {
        type: 'image',
        content: item,
      };

    default:
      return {
        type: 'text',
        content: JSON.stringify(item),
      };
  }
}

/**
 * Extracts metadata from a message entry
 * @param entry - Transcript entry
 * @param index - Message index
 * @returns Message metadata
 */
export function extractMessageMetadata(entry: TranscriptEntry, index: number): MessageMetadata {
  const timestampStr = 'timestamp' in entry ? entry.timestamp : '';
  const timestamp = new Date(timestampStr);
  
  let hasToolUse = false;
  let hasThinking = false;
  let hasErrors = false;
  let tokenCount = 0;

  if (entry.type === 'assistant') {
    entry.message.content.forEach(item => {
      if (item.type === 'tool_use') hasToolUse = true;
      if (item.type === 'thinking') hasThinking = true;
      if (item.type === 'tool_result' && item.is_error) hasErrors = true;
    });

    if (entry.message.usage) {
      tokenCount = (entry.message.usage.input_tokens || 0) + (entry.message.usage.output_tokens || 0);
    }
  }

  return {
    timestamp,
    index,
    hasToolUse,
    hasThinking,
    hasErrors,
    tokenCount: tokenCount > 0 ? tokenCount : undefined,
  };
}

/**
 * Extracts tool use information from content
 * @param content - Content items
 * @returns Array of tool use displays
 */
export function extractToolUse(content: ContentItem[]): ToolUseDisplay[] {
  const tools: ToolUseDisplay[] = [];
  const toolResults = new Map<string, any>();

  // First pass: collect tool results
  content.forEach(item => {
    if (item.type === 'tool_result') {
      toolResults.set(item.tool_use_id, {
        result: item.content,
        status: item.is_error ? 'error' : 'success',
        error: item.is_error ? String(item.content) : undefined,
      });
    }
  });

  // Second pass: process tool uses
  content.forEach(item => {
    if (item.type === 'tool_use') {
      const result = toolResults.get(item.id);
      tools.push({
        name: item.name,
        parameters: item.input,
        result: result?.result,
        status: result?.status || 'pending',
        error: result?.error,
      });
    }
  });

  return tools;
}

/**
 * Detects code blocks in text content and extracts language
 * @param text - Text content to analyze
 * @returns Array of code block information
 */
export function detectCodeBlocks(text: string): Array<{
  content: string;
  language?: string;
  startIndex: number;
  endIndex: number;
}> {
  const codeBlocks: Array<{
    content: string;
    language?: string;
    startIndex: number;
    endIndex: number;
  }> = [];

  // Regex to match fenced code blocks
  const fencedCodeRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
  let match;

  while ((match = fencedCodeRegex.exec(text)) !== null) {
    codeBlocks.push({
      content: match[2],
      language: match[1] || undefined,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  // Also detect inline code blocks
  const inlineCodeRegex = /`([^`]+)`/g;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    codeBlocks.push({
      content: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return codeBlocks.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Sanitizes and processes markdown content
 * @param markdown - Raw markdown content
 * @returns Processed markdown ready for rendering
 */
export function processMarkdown(markdown: string): string {
  // Basic markdown processing (could be enhanced with a full markdown library)
  let processed = markdown;

  // Convert **bold** to <strong>
  processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert *italic* to <em>
  processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Convert [link](url) to <a>
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  // Convert line breaks
  processed = processed.replace(/\n/g, '<br>');

  return processed;
}

/**
 * Generates a summary from message content
 * @param entries - Transcript entries
 * @param maxLength - Maximum summary length
 * @returns Generated summary
 */
export function generateSessionSummary(entries: TranscriptEntry[], maxLength = 200): string {
  if (entries.length === 0) return 'Empty session';

  // Get first user message for context
  const firstUserMessage = entries.find(e => e.type === 'user');
  if (!firstUserMessage) return 'No user messages';

  let content = '';
  if (firstUserMessage.type === 'user') {
    const messageContent = firstUserMessage.message.content;
    if (typeof messageContent === 'string') {
      content = messageContent;
    } else if (Array.isArray(messageContent)) {
      const textContent = messageContent.find(item => item.type === 'text') as TextContent;
      content = textContent?.text || '';
    }
  }

  // Truncate and clean up
  content = content.replace(/\s+/g, ' ').trim();
  if (content.length > maxLength) {
    content = content.substring(0, maxLength - 3) + '...';
  }

  return content || 'Session content';
}

/**
 * Calculates session statistics
 * @param entries - Transcript entries
 * @returns Session statistics object
 */
export function calculateSessionStats(entries: TranscriptEntry[]) {
  let totalTokens = 0;
  let totalTools = 0;
  let totalErrors = 0;
  let totalThinking = 0;

  entries.forEach(entry => {
    if (entry.type === 'assistant') {
      if (entry.message.usage) {
        totalTokens += (entry.message.usage.input_tokens || 0) + (entry.message.usage.output_tokens || 0);
      }

      entry.message.content.forEach(item => {
        if (item.type === 'tool_use') totalTools++;
        if (item.type === 'thinking') totalThinking++;
        if (item.type === 'tool_result' && item.is_error) totalErrors++;
      });
    }
  });

  return {
    totalMessages: entries.length,
    totalTokens,
    totalTools,
    totalErrors,
    totalThinking,
    averageTokensPerMessage: entries.length > 0 ? Math.round(totalTokens / entries.length) : 0,
  };
}

/**
 * Filters entries by search query
 * @param entries - Transcript entries to filter
 * @param query - Search query
 * @returns Filtered entries
 */
export function filterEntriesByQuery(entries: TranscriptEntry[], query: string): TranscriptEntry[] {
  if (!query.trim()) return entries;

  const searchTerm = query.toLowerCase();

  return entries.filter(entry => {
    // Search in message content
    if (entry.type === 'user') {
      const content = entry.message.content;
      if (typeof content === 'string') {
        return content.toLowerCase().includes(searchTerm);
      } else if (Array.isArray(content)) {
        return content.some(item => {
          if (item.type === 'text') {
            return item.text.toLowerCase().includes(searchTerm);
          }
          return false;
        });
      }
    } else if (entry.type === 'assistant') {
      return entry.message.content.some(item => {
        if (item.type === 'text') {
          return item.text.toLowerCase().includes(searchTerm);
        } else if (item.type === 'thinking') {
          return item.thinking.toLowerCase().includes(searchTerm);
        }
        return false;
      });
    } else if (entry.type === 'system') {
      return entry.content.toLowerCase().includes(searchTerm);
    }

    return false;
  });
}

/**
 * Groups entries by time period
 * @param entries - Transcript entries
 * @param period - Time period ('hour', 'day', 'week')
 * @returns Grouped entries
 */
export function groupEntriesByTime(
  entries: TranscriptEntry[], 
  period: 'hour' | 'day' | 'week'
): Array<{ period: string; entries: TranscriptEntry[] }> {
  const groups = new Map<string, TranscriptEntry[]>();

  entries.forEach(entry => {
    const timestampStr = 'timestamp' in entry ? entry.timestamp : '';
    const date = new Date(timestampStr);
    let periodKey: string;

    switch (period) {
      case 'hour':
        periodKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
        break;
      case 'day':
        periodKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
        break;
    }

    if (!groups.has(periodKey)) {
      groups.set(periodKey, []);
    }
    groups.get(periodKey)!.push(entry);
  });

  return Array.from(groups.entries())
    .map(([period, entries]) => ({ period, entries }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Validates session data
 * @param sessionData - Session data to validate
 * @returns Validation result
 */
export function validateSessionData(sessionData: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!sessionData.sessionId) {
    errors.push('Session ID is required');
  }

  if (!Array.isArray(sessionData.entries)) {
    errors.push('Entries must be an array');
  } else {
    sessionData.entries.forEach((entry: any, index: number) => {
      if (!entry.timestamp) {
        errors.push(`Entry ${index} is missing timestamp`);
      }
      if (!entry.type) {
        errors.push(`Entry ${index} is missing type`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}