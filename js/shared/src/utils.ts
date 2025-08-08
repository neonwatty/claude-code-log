import {
  TranscriptEntry,
  UserTranscriptEntry,
  AssistantTranscriptEntry,
  SummaryTranscriptEntry,
  SystemTranscriptEntry,
  ContentItem,
  TextContent,
  ToolUseContent,
  ToolResultContent,
  ThinkingContent,
  ImageContent,
  UserMessage,
  UsageInfo,
} from './index';
import {
  validateTranscriptEntry,
  validateContentItem,
  validateUsageInfo,
  ContentItemSchema,
  TranscriptEntrySchema,
} from './validation';

// Date and Time Utilities
export function parseTimestamp(timestampStr: string): Date | null {
  try {
    // Handle ISO timestamp with Z suffix
    const normalizedTimestamp = timestampStr.replace('Z', '+00:00');
    const date = new Date(normalizedTimestamp);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

// Content Item Parsing
export function parseContentItem(itemData: Record<string, any>): ContentItem {
  const contentType = itemData.type || '';

  try {
    switch (contentType) {
      case 'text':
        return { type: 'text', text: itemData.text || '' } as TextContent;
      case 'tool_use':
        return {
          type: 'tool_use',
          id: itemData.id || '',
          name: itemData.name || '',
          input: itemData.input || {},
        } as ToolUseContent;
      case 'tool_result':
        return {
          type: 'tool_result',
          tool_use_id: itemData.tool_use_id || '',
          content: itemData.content || '',
          is_error: itemData.is_error,
        } as ToolResultContent;
      case 'thinking':
        return {
          type: 'thinking',
          thinking: itemData.thinking || '',
          signature: itemData.signature,
        } as ThinkingContent;
      case 'image':
        return {
          type: 'image',
          source: itemData.source || { type: 'base64', media_type: '', data: '' },
        } as ImageContent;
      default:
        // Fallback to text content for unknown types
        return { type: 'text', text: String(itemData) } as TextContent;
    }
  } catch {
    return { type: 'text', text: String(itemData) } as TextContent;
  }
}

export function parseMessageContent(contentData: any): string | ContentItem[] {
  if (typeof contentData === 'string') {
    return contentData;
  } else if (Array.isArray(contentData)) {
    return contentData.map((item: Record<string, any>) => parseContentItem(item));
  } else {
    return String(contentData);
  }
}

// Transcript Entry Parsing
export function parseTranscriptEntry(data: Record<string, any>): TranscriptEntry | null {
  const entryType = data.type;

  try {
    let processedData = { ...data };

    // Parse message content if present
    if (processedData.message?.content) {
      processedData = {
        ...processedData,
        message: {
          ...processedData.message,
          content: parseMessageContent(processedData.message.content),
        },
      };
    }

    // Parse toolUseResult if it's a list of content items
    if (Array.isArray(processedData.toolUseResult)) {
      const toolResult = processedData.toolUseResult;
      if (toolResult.length > 0 && typeof toolResult[0] === 'object' && toolResult[0].type) {
        processedData.toolUseResult = toolResult.map((item: Record<string, any>) => 
          parseContentItem(item)
        );
      }
    }

    const validationResult = validateTranscriptEntry(processedData);
    if (validationResult.success) {
      return validationResult.data;
    }

    return null;
  } catch {
    return null;
  }
}

// Usage Information Utilities
export function normalizeUsageInfo(usageData: any): UsageInfo | undefined {
  if (!usageData) return undefined;

  if (typeof usageData === 'object') {
    const validationResult = validateUsageInfo(usageData);
    if (validationResult.success) {
      return validationResult.data;
    }
  }

  return undefined;
}

export function calculateTotalUsage(entries: TranscriptEntry[]): UsageInfo {
  const totals: UsageInfo = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };

  entries.forEach((entry) => {
    if (entry.type === 'assistant' && entry.message.usage) {
      const usage = entry.message.usage;
      totals.input_tokens = (totals.input_tokens || 0) + (usage.input_tokens || 0);
      totals.output_tokens = (totals.output_tokens || 0) + (usage.output_tokens || 0);
      totals.cache_creation_input_tokens = 
        (totals.cache_creation_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
      totals.cache_read_input_tokens = 
        (totals.cache_read_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
    }
  });

  return totals;
}

// Session Utilities
export function groupEntriesBySession(entries: TranscriptEntry[]): Record<string, TranscriptEntry[]> {
  const sessions: Record<string, TranscriptEntry[]> = {};

  entries.forEach((entry) => {
    if (entry.type !== 'summary') {
      const sessionId = entry.sessionId;
      if (!sessions[sessionId]) {
        sessions[sessionId] = [];
      }
      sessions[sessionId].push(entry);
    }
  });

  return sessions;
}

export function getSessionTimeRange(entries: TranscriptEntry[]): { start: Date | null; end: Date | null } {
  let start: Date | null = null;
  let end: Date | null = null;

  entries.forEach((entry) => {
    if (entry.type !== 'summary') {
      const timestamp = parseTimestamp(entry.timestamp);
      if (timestamp) {
        if (!start || timestamp < start) start = timestamp;
        if (!end || timestamp > end) end = timestamp;
      }
    }
  });

  return { start, end };
}

// Data Transformation Utilities
export function serializeToJsonl(entries: TranscriptEntry[]): string {
  return entries
    .map((entry) => JSON.stringify(entry))
    .join('\n');
}

export function parseJsonlString(jsonlString: string): TranscriptEntry[] {
  const lines = jsonlString.split('\n').filter(line => line.trim());
  const entries: TranscriptEntry[] = [];

  lines.forEach((line) => {
    try {
      const data = JSON.parse(line);
      const entry = parseTranscriptEntry(data);
      if (entry) {
        entries.push(entry);
      }
    } catch (error) {
      console.warn('Failed to parse JSONL line:', line, error);
    }
  });

  return entries;
}

// Content Analysis Utilities
export function extractTextFromContent(content: string | ContentItem[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .filter((item): item is TextContent => item.type === 'text')
    .map((item) => item.text)
    .join(' ');
}

export function getToolUsesFromContent(content: ContentItem[]): ToolUseContent[] {
  return content.filter((item): item is ToolUseContent => item.type === 'tool_use');
}

export function getToolResultsFromContent(content: ContentItem[]): ToolResultContent[] {
  return content.filter((item): item is ToolResultContent => item.type === 'tool_result');
}

// Validation Utilities with Error Details
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

export function safeParseTranscriptEntry(data: unknown): ValidationResult<TranscriptEntry> {
  const result = TranscriptEntrySchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return {
      success: false,
      error: 'Validation failed',
      details: result.error.issues,
    };
  }
}

export function safeParseContentItem(data: unknown): ValidationResult<ContentItem> {
  const result = ContentItemSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return {
      success: false,
      error: 'Content item validation failed',
      details: result.error.issues,
    };
  }
}

// Type Assertion Utilities
export function assertIsUserEntry(entry: TranscriptEntry): asserts entry is UserTranscriptEntry {
  if (entry.type !== 'user') {
    throw new Error(`Expected user entry, got ${entry.type}`);
  }
}

export function assertIsAssistantEntry(entry: TranscriptEntry): asserts entry is AssistantTranscriptEntry {
  if (entry.type !== 'assistant') {
    throw new Error(`Expected assistant entry, got ${entry.type}`);
  }
}

export function assertIsSummaryEntry(entry: TranscriptEntry): asserts entry is SummaryTranscriptEntry {
  if (entry.type !== 'summary') {
    throw new Error(`Expected summary entry, got ${entry.type}`);
  }
}

// Summary and Metadata Utilities
export function extractSessionSummary(entries: TranscriptEntry[]): string {
  // Look for summary entries first
  const summaryEntry = entries.find((entry): entry is SummaryTranscriptEntry => 
    entry.type === 'summary'
  );
  
  if (summaryEntry) {
    return summaryEntry.summary;
  }

  // Fallback to first user message
  const firstUserEntry = entries.find((entry): entry is UserTranscriptEntry => 
    entry.type === 'user'
  );
  
  if (firstUserEntry) {
    return extractTextFromContent(firstUserEntry.message.content).substring(0, 100) + '...';
  }

  return 'No summary available';
}

export function getSessionMetadata(entries: TranscriptEntry[]) {
  const timeRange = getSessionTimeRange(entries);
  const usage = calculateTotalUsage(entries);
  const messageCount = entries.filter(e => e.type !== 'summary').length;
  const sessionId = entries.find(e => e.type !== 'summary')?.sessionId || '';

  return {
    sessionId,
    messageCount,
    usage,
    timeRange,
    summary: extractSessionSummary(entries),
  };
}