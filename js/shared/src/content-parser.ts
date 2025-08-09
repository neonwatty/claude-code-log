import {
  ContentItem,
  TextContent,
  ToolUseContent,
  ToolResultContent,
  ThinkingContent,
  ImageContent,
  UserMessage,
  AssistantMessage,
  TranscriptEntry,
  UserTranscriptEntry,
  AssistantTranscriptEntry,
  SummaryTranscriptEntry,
  SystemTranscriptEntry,
} from './index';

/**
 * Parsed content with metadata for rendering
 */
export interface ParsedContent {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'image' | 'markdown';
  content: string;
  metadata?: {
    toolName?: string;
    toolId?: string;
    isError?: boolean;
    mediaType?: string;
    hasLongContent?: boolean;
    previewText?: string;
  };
}

/**
 * Parsed message with all content items processed
 */
export interface ParsedMessage {
  messageType: string;
  displayType: string;
  cssClass: string;
  timestamp: string;
  parsedContent: ParsedContent[];
  rawContent: string | ContentItem[];
  hasToolUse: boolean;
  hasThinking: boolean;
  hasImages: boolean;
  tokenUsage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

/**
 * Configuration for content parsing
 */
export interface ContentParsingOptions {
  /** Maximum length for preview text before truncation */
  maxPreviewLength?: number;
  /** Whether to render markdown content */
  enableMarkdown?: boolean;
  /** Whether to include raw content in output */
  includeRawContent?: boolean;
  /** Whether to extract tool information */
  extractToolInfo?: boolean;
}

const DEFAULT_OPTIONS: Required<ContentParsingOptions> = {
  maxPreviewLength: 200,
  enableMarkdown: true,
  includeRawContent: false,
  extractToolInfo: true,
};

/**
 * HTML escape utility function
 */
function escapeHtml(text: string): string {
  const div = document?.createElement('div') || { textContent: '' };
  div.textContent = text;
  return div.innerHTML || text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extract text content from various content types
 */
export function extractTextContent(content: string | ContentItem[]): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts: string[] = [];
    
    for (const item of content) {
      if (item.type === 'text') {
        textParts.push((item as TextContent).text);
      } else if (item.type === 'thinking') {
        // Skip thinking content in main text extraction
        continue;
      }
      // Skip other non-text content types for main text extraction
    }
    
    return textParts.join('\n');
  }

  return String(content) || '';
}

/**
 * Extract thinking content from content items
 */
export function extractThinkingContent(content: string | ContentItem[]): string[] {
  if (typeof content === 'string' || !Array.isArray(content)) {
    return [];
  }

  return content
    .filter((item): item is ThinkingContent => item.type === 'thinking')
    .map(item => item.thinking);
}

/**
 * Check if content contains specific types
 */
export function analyzeContentTypes(content: string | ContentItem[]): {
  hasText: boolean;
  hasToolUse: boolean;
  hasToolResult: boolean;
  hasThinking: boolean;
  hasImages: boolean;
  toolCount: number;
  imageCount: number;
} {
  if (typeof content === 'string') {
    return {
      hasText: true,
      hasToolUse: false,
      hasToolResult: false,
      hasThinking: false,
      hasImages: false,
      toolCount: 0,
      imageCount: 0,
    };
  }

  if (!Array.isArray(content)) {
    return {
      hasText: false,
      hasToolUse: false,
      hasToolResult: false,
      hasThinking: false,
      hasImages: false,
      toolCount: 0,
      imageCount: 0,
    };
  }

  const analysis = {
    hasText: false,
    hasToolUse: false,
    hasToolResult: false,
    hasThinking: false,
    hasImages: false,
    toolCount: 0,
    imageCount: 0,
  };

  for (const item of content) {
    switch (item.type) {
      case 'text':
        analysis.hasText = true;
        break;
      case 'tool_use':
        analysis.hasToolUse = true;
        analysis.toolCount++;
        break;
      case 'tool_result':
        analysis.hasToolResult = true;
        break;
      case 'thinking':
        analysis.hasThinking = true;
        break;
      case 'image':
        analysis.hasImages = true;
        analysis.imageCount++;
        break;
    }
  }

  return analysis;
}

/**
 * Parse text content for markdown rendering
 */
export function parseTextContent(
  text: string,
  options: ContentParsingOptions = {}
): ParsedContent {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return {
    type: opts.enableMarkdown ? 'markdown' : 'text',
    content: text,
    metadata: {
      hasLongContent: text.length > opts.maxPreviewLength,
      previewText: text.length > opts.maxPreviewLength 
        ? text.substring(0, opts.maxPreviewLength) + '...' 
        : undefined,
    },
  };
}

/**
 * Parse tool use content
 */
export function parseToolUseContent(
  toolUse: ToolUseContent,
  options: ContentParsingOptions = {}
): ParsedContent {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  let content: string;
  
  // Special handling for TodoWrite
  if (toolUse.name === 'TodoWrite') {
    const todos = toolUse.input.todos || [];
    if (Array.isArray(todos) && todos.length > 0) {
      const todoItems = todos.map((todo: any) => {
        const status = todo.status === 'completed' ? '✅' : 
                     todo.status === 'in_progress' ? '🔄' : '⭕';
        return `${status} ${todo.content}`;
      }).join('\n');
      content = `Todo List:\n${todoItems}`;
    } else {
      content = 'Todo List: (empty)';
    }
  } else {
    // Format the input parameters as JSON
    try {
      content = JSON.stringify(toolUse.input, null, 2);
    } catch {
      content = String(toolUse.input);
    }
  }

  return {
    type: 'tool_use',
    content,
    metadata: {
      toolName: toolUse.name,
      toolId: toolUse.id,
      hasLongContent: content.length > opts.maxPreviewLength,
      previewText: content.length > opts.maxPreviewLength 
        ? content.substring(0, opts.maxPreviewLength) + '...' 
        : undefined,
    },
  };
}

/**
 * Parse tool result content
 */
export function parseToolResultContent(
  toolResult: ToolResultContent,
  options: ContentParsingOptions = {}
): ParsedContent {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  let content: string;
  
  if (typeof toolResult.content === 'string') {
    content = toolResult.content;
  } else {
    // Content is a list of structured items, extract text
    const contentParts: string[] = [];
    for (const item of toolResult.content) {
      if (typeof item === 'object' && item.type === 'text') {
        contentParts.push(item.text || '');
      } else {
        contentParts.push(String(item));
      }
    }
    content = contentParts.join('\n');
  }

  return {
    type: 'tool_result',
    content,
    metadata: {
      toolId: toolResult.tool_use_id,
      isError: toolResult.is_error || false,
      hasLongContent: content.length > opts.maxPreviewLength,
      previewText: content.length > opts.maxPreviewLength 
        ? content.substring(0, opts.maxPreviewLength) + '...' 
        : undefined,
    },
  };
}

/**
 * Parse thinking content
 */
export function parseThinkingContent(
  thinking: ThinkingContent,
  options: ContentParsingOptions = {}
): ParsedContent {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const content = thinking.thinking.trim();

  return {
    type: 'thinking',
    content,
    metadata: {
      hasLongContent: content.length > opts.maxPreviewLength,
      previewText: content.length > opts.maxPreviewLength 
        ? content.substring(0, opts.maxPreviewLength) + '...' 
        : undefined,
    },
  };
}

/**
 * Parse image content
 */
export function parseImageContent(
  image: ImageContent,
  options: ContentParsingOptions = {}
): ParsedContent {
  // Create a data URL from the base64 image data
  const dataUrl = `data:${image.source.media_type};base64,${image.source.data}`;

  return {
    type: 'image',
    content: dataUrl,
    metadata: {
      mediaType: image.source.media_type,
    },
  };
}

/**
 * Parse individual content item
 */
export function parseContentItem(
  item: ContentItem,
  options: ContentParsingOptions = {}
): ParsedContent {
  switch (item.type) {
    case 'text':
      return parseTextContent((item as TextContent).text, options);
    case 'tool_use':
      return parseToolUseContent(item as ToolUseContent, options);
    case 'tool_result':
      return parseToolResultContent(item as ToolResultContent, options);
    case 'thinking':
      return parseThinkingContent(item as ThinkingContent, options);
    case 'image':
      return parseImageContent(item as ImageContent, options);
    default:
      return {
        type: 'text',
        content: JSON.stringify(item),
        metadata: {},
      };
  }
}

/**
 * Parse message content (string or array of content items)
 */
export function parseMessageContent(
  content: string | ContentItem[],
  options: ContentParsingOptions = {}
): ParsedContent[] {
  if (typeof content === 'string') {
    return [parseTextContent(content, options)];
  }

  if (!Array.isArray(content)) {
    return [parseTextContent(String(content), options)];
  }

  return content.map(item => parseContentItem(item, options));
}

/**
 * Determine display information for different message types
 */
function getMessageDisplayInfo(entry: TranscriptEntry): {
  messageType: string;
  displayType: string;
  cssClass: string;
} {
  const isSidechain = entry.type !== 'summary' && entry.isSidechain;
  
  switch (entry.type) {
    case 'user':
      return {
        messageType: 'user',
        displayType: isSidechain ? '📝 Sub-assistant prompt' : '🤷 User',
        cssClass: isSidechain ? 'user sidechain' : 'user',
      };
    case 'assistant':
      return {
        messageType: 'assistant',
        displayType: isSidechain ? '🔗 Sub-assistant' : '🤖 Assistant',
        cssClass: isSidechain ? 'assistant sidechain' : 'assistant',
      };
    case 'system':
      return {
        messageType: 'system',
        displayType: '⚙️ System',
        cssClass: 'system',
      };
    case 'summary':
      return {
        messageType: 'summary',
        displayType: '📋 Session Summary',
        cssClass: 'summary',
      };
    default:
      return {
        messageType: 'unknown',
        displayType: '❓ Unknown',
        cssClass: 'unknown',
      };
  }
}

/**
 * Parse a complete transcript entry into a structured message
 */
export function parseTranscriptEntry(
  entry: TranscriptEntry,
  options: ContentParsingOptions = {}
): ParsedMessage {
  const { messageType, displayType, cssClass } = getMessageDisplayInfo(entry);
  
  let parsedContent: ParsedContent[] = [];
  let rawContent: string | ContentItem[] = '';
  let tokenUsage: ParsedMessage['tokenUsage'];

  // Handle different entry types
  switch (entry.type) {
    case 'user':
      rawContent = (entry as UserTranscriptEntry).message.content;
      parsedContent = parseMessageContent(rawContent, options);
      break;
      
    case 'assistant':
      const assistantEntry = entry as AssistantTranscriptEntry;
      rawContent = assistantEntry.message.content;
      parsedContent = parseMessageContent(rawContent, options);
      
      // Extract token usage
      if (assistantEntry.message.usage) {
        const usage = assistantEntry.message.usage;
        tokenUsage = {
          input_tokens: usage.input_tokens || 0,
          output_tokens: usage.output_tokens || 0,
          total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
        };
      }
      break;
      
    case 'system':
      const systemEntry = entry as SystemTranscriptEntry;
      rawContent = systemEntry.content;
      parsedContent = [parseTextContent(systemEntry.content, options)];
      break;
      
    case 'summary':
      const summaryEntry = entry as SummaryTranscriptEntry;
      rawContent = summaryEntry.summary;
      parsedContent = [parseTextContent(summaryEntry.summary, options)];
      break;
  }

  // Analyze content types
  const contentAnalysis = analyzeContentTypes(rawContent);

  return {
    messageType,
    displayType,
    cssClass,
    timestamp: entry.type !== 'summary' ? entry.timestamp : '',
    parsedContent,
    rawContent: options.includeRawContent ? rawContent : '',
    hasToolUse: contentAnalysis.hasToolUse,
    hasThinking: contentAnalysis.hasThinking,
    hasImages: contentAnalysis.hasImages,
    tokenUsage,
  };
}

/**
 * Parse multiple transcript entries
 */
export function parseTranscriptEntries(
  entries: TranscriptEntry[],
  options: ContentParsingOptions = {}
): ParsedMessage[] {
  return entries.map(entry => parseTranscriptEntry(entry, options));
}

/**
 * Extract command information from system messages
 */
export function extractCommandInfo(content: string): {
  commandName: string;
  commandArgs?: string;
  commandContents?: string;
  isCommand: boolean;
} {
  // Look for command patterns like <command-name>init</command-name>
  const commandNameMatch = content.match(/<command-name>([^<]+)<\/command-name>/);
  const commandArgsMatch = content.match(/<command-args>([^<]*)<\/command-args>/);
  const commandContentsMatch = content.match(/<command-contents>([\s\S]*?)<\/command-contents>/);

  if (!commandNameMatch) {
    return {
      commandName: '',
      isCommand: false,
    };
  }

  return {
    commandName: commandNameMatch[1].trim(),
    commandArgs: commandArgsMatch ? commandArgsMatch[1].trim() : undefined,
    commandContents: commandContentsMatch ? commandContentsMatch[1].trim() : undefined,
    isCommand: true,
  };
}

/**
 * Format content for display in different contexts
 */
export function formatContentForDisplay(
  parsedContent: ParsedContent[],
  context: 'html' | 'text' | 'preview' = 'text'
): string {
  if (context === 'preview') {
    // For previews, combine all text content with truncation
    const textParts = parsedContent
      .filter(pc => pc.type === 'text' || pc.type === 'markdown')
      .map(pc => pc.content)
      .join(' ');
    
    return textParts.length > 100 ? textParts.substring(0, 100) + '...' : textParts;
  }

  if (context === 'text') {
    // For text context, extract all readable text
    return parsedContent
      .map(pc => {
        switch (pc.type) {
          case 'text':
          case 'markdown':
            return pc.content;
          case 'tool_use':
            return `[Tool: ${pc.metadata?.toolName}] ${pc.content}`;
          case 'tool_result':
            return `[Tool Result] ${pc.content}`;
          case 'thinking':
            return `[Thinking] ${pc.content}`;
          case 'image':
            return `[Image: ${pc.metadata?.mediaType}]`;
          default:
            return pc.content;
        }
      })
      .join('\n');
  }

  // For HTML context, would need HTML rendering logic
  // For now, return text format
  return formatContentForDisplay(parsedContent, 'text');
}