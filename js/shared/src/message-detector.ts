import { TranscriptEntry, UserTranscriptEntry, AssistantTranscriptEntry, SummaryTranscriptEntry, SystemTranscriptEntry } from './index';
import { parseTranscriptEntry } from './utils';
import { validateTranscriptEntry } from './validation';

/**
 * Supported message types in Claude Code transcripts
 */
export const MESSAGE_TYPES = ['user', 'assistant', 'summary', 'system'] as const;
export type MessageType = typeof MESSAGE_TYPES[number];

/**
 * Message type detection result with additional metadata
 */
export interface MessageTypeDetectionResult {
  type: MessageType | 'unknown';
  isValid: boolean;
  isSupported: boolean;
  entry?: TranscriptEntry;
  errors?: Array<{
    path: string[];
    message: string;
    code: string;
  }>;
  metadata?: {
    hasMessage?: boolean;
    hasContent?: boolean;
    hasToolUseResult?: boolean;
    hasUsage?: boolean;
    contentItemCount?: number;
  };
}

/**
 * Statistics about message types in a collection
 */
export interface MessageTypeStats {
  total: number;
  byType: Record<MessageType | 'unknown' | 'invalid', number>;
  validCount: number;
  invalidCount: number;
  unknownCount: number;
}

/**
 * Detects the message type from raw JSON data and validates it
 */
export function detectMessageType(data: Record<string, any>): MessageTypeDetectionResult {
  // Quick type detection from the 'type' field
  const rawType = data.type;
  const isKnownType = MESSAGE_TYPES.includes(rawType);
  
  // Initial result structure
  const result: MessageTypeDetectionResult = {
    type: isKnownType ? rawType : 'unknown',
    isValid: false,
    isSupported: isKnownType,
    metadata: extractMetadata(data),
  };

  // Validate using the schema
  const validationResult = validateTranscriptEntry(data);
  
  if (validationResult.success) {
    result.isValid = true;
    result.entry = validationResult.data;
  } else {
    result.errors = validationResult.error.issues.map(issue => ({
      path: issue.path.map(p => String(p)),
      message: issue.message,
      code: issue.code,
    }));
  }

  return result;
}

/**
 * Detects message type and attempts to parse the entry
 */
export function detectAndParseMessage(data: Record<string, any>): MessageTypeDetectionResult {
  const detection = detectMessageType(data);
  
  // If validation failed but we have a known type, try parsing anyway
  if (!detection.isValid && detection.isSupported) {
    const parsedEntry = parseTranscriptEntry(data);
    if (parsedEntry) {
      detection.isValid = true;
      detection.entry = parsedEntry;
    }
  }

  return detection;
}

/**
 * Batch message type detection for arrays of data
 */
export function detectMessageTypes(dataArray: Record<string, any>[]): MessageTypeDetectionResult[] {
  return dataArray.map(detectMessageType);
}

/**
 * Get statistics about message types in a collection
 */
export function getMessageTypeStats(detectionResults: MessageTypeDetectionResult[]): MessageTypeStats {
  const stats: MessageTypeStats = {
    total: detectionResults.length,
    byType: {
      user: 0,
      assistant: 0,
      summary: 0,
      system: 0,
      unknown: 0,
      invalid: 0,
    },
    validCount: 0,
    invalidCount: 0,
    unknownCount: 0,
  };

  detectionResults.forEach(result => {
    if (result.isValid) {
      stats.validCount++;
      if (result.type !== 'unknown') {
        stats.byType[result.type]++;
      } else {
        stats.byType.unknown++;
        stats.unknownCount++;
      }
    } else {
      stats.invalidCount++;
      stats.byType.invalid++;
    }
  });

  return stats;
}

/**
 * Filter entries by message type
 */
export function filterByMessageType<T extends TranscriptEntry>(
  entries: T[], 
  type: MessageType
): T[] {
  return entries.filter(entry => entry.type === type);
}

/**
 * Type guards for specific message types
 */
export function isUserMessage(entry: TranscriptEntry): entry is UserTranscriptEntry {
  return entry.type === 'user';
}

export function isAssistantMessage(entry: TranscriptEntry): entry is AssistantTranscriptEntry {
  return entry.type === 'assistant';
}

export function isSummaryMessage(entry: TranscriptEntry): entry is SummaryTranscriptEntry {
  return entry.type === 'summary';
}

export function isSystemMessage(entry: TranscriptEntry): entry is SystemTranscriptEntry {
  return entry.type === 'system';
}

/**
 * Advanced message classification based on content analysis
 */
export function classifyMessageContent(entry: TranscriptEntry): {
  category: 'conversational' | 'tool-use' | 'meta' | 'system-notification';
  hasToolUse: boolean;
  hasThinking: boolean;
  hasImages: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
} {
  const result = {
    category: 'conversational' as 'conversational' | 'tool-use' | 'meta' | 'system-notification',
    hasToolUse: false,
    hasThinking: false,
    hasImages: false,
    complexity: 'simple' as 'simple' | 'moderate' | 'complex',
  };

  // Handle different message types
  if (isSystemMessage(entry)) {
    result.category = 'system-notification';
    return result;
  }

  if (isSummaryMessage(entry)) {
    result.category = 'meta';
    return result;
  }

  // Analyze content for user and assistant messages
  if (isUserMessage(entry) || isAssistantMessage(entry)) {
    const content = entry.message.content;
    let contentItems = 0;
    
    if (Array.isArray(content)) {
      contentItems = content.length;
      
      // Check for different content types
      content.forEach(item => {
        switch (item.type) {
          case 'tool_use':
            result.hasToolUse = true;
            result.category = 'tool-use';
            break;
          case 'thinking':
            result.hasThinking = true;
            break;
          case 'image':
            result.hasImages = true;
            break;
        }
      });
    }

    // Determine complexity based on content
    if (contentItems > 5 || result.hasToolUse) {
      result.complexity = 'complex';
    } else if (contentItems > 1 || result.hasThinking || result.hasImages) {
      result.complexity = 'moderate';
    }

    // Check for tool use result in user messages
    if (isUserMessage(entry) && entry.toolUseResult) {
      result.hasToolUse = true;
      if (result.category === 'conversational') {
        result.category = 'tool-use';
      }
    }
  }

  return result;
}

/**
 * Validate message type consistency across a session
 */
export function validateMessageSequence(entries: TranscriptEntry[]): {
  isValid: boolean;
  issues: Array<{
    index: number;
    issue: string;
    severity: 'warning' | 'error';
  }>;
} {
  const issues: Array<{ index: number; issue: string; severity: 'warning' | 'error' }> = [];
  let lastUserIndex = -1;
  let lastAssistantIndex = -1;

  entries.forEach((entry, index) => {
    // Skip summary and system messages for sequence validation
    if (entry.type === 'summary' || entry.type === 'system') {
      return;
    }

    if (entry.type === 'user') {
      lastUserIndex = index;
      
      // Check if there are consecutive user messages (warning)
      if (lastAssistantIndex < lastUserIndex - 1 && lastUserIndex > 0) {
        const prevEntry = entries[index - 1];
        if (prevEntry.type === 'user') {
          issues.push({
            index,
            issue: 'Consecutive user messages detected',
            severity: 'warning',
          });
        }
      }
    } else if (entry.type === 'assistant') {
      lastAssistantIndex = index;
      
      // Check if assistant responds without user input (warning)
      if (lastUserIndex === -1) {
        issues.push({
          index,
          issue: 'Assistant message without prior user message',
          severity: 'warning',
        });
      }
    }
  });

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

/**
 * Extract metadata from raw message data
 */
function extractMetadata(data: Record<string, any>): MessageTypeDetectionResult['metadata'] {
  const metadata: NonNullable<MessageTypeDetectionResult['metadata']> = {};

  metadata.hasMessage = !!data.message;
  
  if (data.message) {
    metadata.hasContent = !!data.message.content;
    metadata.hasUsage = !!data.message.usage;
    
    if (Array.isArray(data.message.content)) {
      metadata.contentItemCount = data.message.content.length;
    }
  }

  metadata.hasToolUseResult = !!data.toolUseResult;

  return metadata;
}

/**
 * Create a human-readable summary of detection results
 */
export function summarizeDetectionResults(results: MessageTypeDetectionResult[]): string {
  const stats = getMessageTypeStats(results);
  const lines: string[] = [];

  lines.push(`Message Type Detection Summary:`);
  lines.push(`- Total messages: ${stats.total}`);
  lines.push(`- Valid messages: ${stats.validCount} (${(stats.validCount / stats.total * 100).toFixed(1)}%)`);
  
  if (stats.invalidCount > 0) {
    lines.push(`- Invalid messages: ${stats.invalidCount} (${(stats.invalidCount / stats.total * 100).toFixed(1)}%)`);
  }
  
  lines.push(`Message types:`);
  Object.entries(stats.byType)
    .filter(([_, count]) => count > 0)
    .forEach(([type, count]) => {
      lines.push(`  - ${type}: ${count}`);
    });

  return lines.join('\n');
}