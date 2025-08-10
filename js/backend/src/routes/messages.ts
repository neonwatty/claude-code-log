import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { 
  JsonlParser,
  parseTranscriptEntriesOptimized,
  parseTranscriptEntryOptimized,
  organizeIntoSessionsOptimized,
  formatContentForDisplay,
  ParsedMessage,
  OptimizedParsingOptions,
  TranscriptEntry,
} from '@app/shared';

const router = Router();

/**
 * Message service for handling individual message parsing and content extraction
 */
class MessageService {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  /**
   * Check if cache entry is valid
   */
  private static isCacheValid(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Set cache entry with TTL
   */
  private static setCache(key: string, data: any, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  /**
   * Get cached data or return null
   */
  private static getCache(key: string): any | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key)?.data || null;
    }
    return null;
  }

  /**
   * Parse JSONL files from directory
   */
  static async parseJsonlFiles(directoryPath: string) {
    const parser = new JsonlParser({ 
      skipInvalidLines: true,
      batchSize: 1000,
    });

    const { promises: fs } = await import('fs');
    const { join } = await import('path');
    
    const files = await fs.readdir(directoryPath);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) {
      throw new Error(`No JSONL files found in directory: ${directoryPath}`);
    }

    let allEntries: any[] = [];
    let allErrors: any[] = [];

    for (const file of jsonlFiles) {
      const filePath = join(directoryPath, file);
      try {
        const result = await parser.parseFile(filePath);
        allEntries.push(...result.entries);
        allErrors.push(...result.errors.map((err: any) => ({ ...err, file })));
      } catch (error) {
        allErrors.push({
          file,
          error: error instanceof Error ? error.message : String(error),
          lineNumber: 0,
          line: '',
        });
      }
    }

    return { entries: allEntries, errors: allErrors, fileCount: jsonlFiles.length };
  }

  /**
   * Parse messages with full content processing
   */
  static async parseMessages(
    entries: TranscriptEntry[],
    options: OptimizedParsingOptions = {}
  ): Promise<ParsedMessage[]> {
    const cacheKey = `messages-${entries.length}-${JSON.stringify(options)}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const messages = await parseTranscriptEntriesOptimized(entries, {
        useCache: true,
        enableProfiling: true,
        includeRawContent: true,
        extractToolInfo: true,
        enableMarkdown: true,
        ...options,
      });

      this.setCache(cacheKey, messages, 10 * 60 * 1000); // 10 minutes cache
      return messages;
    } catch (error) {
      throw new Error(`Failed to parse messages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Find messages by various criteria
   */
  static async searchMessages(
    entries: TranscriptEntry[],
    criteria: {
      messageType?: string;
      hasToolUse?: boolean;
      hasThinking?: boolean;
      hasImages?: boolean;
      toolName?: string;
      textSearch?: string;
      sessionId?: string;
      dateRange?: { start: string; end: string };
    }
  ): Promise<ParsedMessage[]> {
    const cacheKey = `search-${entries.length}-${JSON.stringify(criteria)}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      // Parse all messages first
      const allMessages = await this.parseMessages(entries);
      
      // Apply filters
      let filteredMessages = allMessages;

      if (criteria.messageType) {
        filteredMessages = filteredMessages.filter(m => m.messageType === criteria.messageType);
      }

      if (criteria.hasToolUse !== undefined) {
        filteredMessages = filteredMessages.filter(m => m.hasToolUse === criteria.hasToolUse);
      }

      if (criteria.hasThinking !== undefined) {
        filteredMessages = filteredMessages.filter(m => m.hasThinking === criteria.hasThinking);
      }

      if (criteria.hasImages !== undefined) {
        filteredMessages = filteredMessages.filter(m => m.hasImages === criteria.hasImages);
      }

      if (criteria.toolName) {
        filteredMessages = filteredMessages.filter(m => 
          m.parsedContent.some((c: any) => 
            c.type === 'tool_use' && 
            c.metadata?.toolName?.toLowerCase().includes(criteria.toolName!.toLowerCase())
          )
        );
      }

      if (criteria.textSearch) {
        const searchTerm = criteria.textSearch.toLowerCase();
        filteredMessages = filteredMessages.filter(m =>
          m.parsedContent.some((c: any) =>
            c.content.toLowerCase().includes(searchTerm)
          )
        );
      }

      if (criteria.sessionId) {
        // Filter original entries by session ID and get corresponding message indices
        const sessionEntries = entries.filter(e => 
          e.type !== 'summary' && e.sessionId === criteria.sessionId
        );
        const sessionIndices = new Set(sessionEntries.map((_, index) => index));
        filteredMessages = filteredMessages.filter((_, index) => sessionIndices.has(index));
      }

      if (criteria.dateRange) {
        const startDate = new Date(criteria.dateRange.start);
        const endDate = new Date(criteria.dateRange.end);
        filteredMessages = filteredMessages.filter(m => {
          if (!m.timestamp) return false;
          const messageDate = new Date(m.timestamp);
          return messageDate >= startDate && messageDate <= endDate;
        });
      }

      this.setCache(cacheKey, filteredMessages, 5 * 60 * 1000); // 5 minutes cache
      return filteredMessages;
    } catch (error) {
      throw new Error(`Failed to search messages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get message statistics
   */
  static async getMessageStatistics(messages: ParsedMessage[]): Promise<{
    totalMessages: number;
    messageTypes: Record<string, number>;
    contentTypes: {
      hasText: number;
      hasToolUse: number;
      hasThinking: number;
      hasImages: number;
      toolUsage: Record<string, number>;
    };
    avgContentLength: number;
    tokenStats?: {
      totalTokens: number;
      avgTokensPerMessage: number;
    };
  }> {
    const cacheKey = `message-stats-${messages.length}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const stats = {
      totalMessages: messages.length,
      messageTypes: {} as Record<string, number>,
      contentTypes: {
        hasText: 0,
        hasToolUse: 0,
        hasThinking: 0,
        hasImages: 0,
        toolUsage: {} as Record<string, number>,
      },
      avgContentLength: 0,
      tokenStats: {
        totalTokens: 0,
        avgTokensPerMessage: 0,
      },
    };

    let totalContentLength = 0;
    let totalTokens = 0;
    let messagesWithTokens = 0;

    messages.forEach(message => {
      // Message types
      stats.messageTypes[message.messageType] = (stats.messageTypes[message.messageType] || 0) + 1;

      // Content types
      if (message.parsedContent.some((c: any) => c.type === 'text' || c.type === 'markdown')) {
        stats.contentTypes.hasText++;
      }
      if (message.hasToolUse) {
        stats.contentTypes.hasToolUse++;
      }
      if (message.hasThinking) {
        stats.contentTypes.hasThinking++;
      }
      if (message.hasImages) {
        stats.contentTypes.hasImages++;
      }

      // Tool usage
      message.parsedContent.forEach((content: any) => {
        if (content.type === 'tool_use' && content.metadata?.toolName) {
          const toolName = content.metadata.toolName;
          stats.contentTypes.toolUsage[toolName] = (stats.contentTypes.toolUsage[toolName] || 0) + 1;
        }
      });

      // Content length
      const contentLength = message.parsedContent.reduce((sum: number, c: any) => sum + c.content.length, 0);
      totalContentLength += contentLength;

      // Token stats
      if (message.tokenUsage) {
        totalTokens += message.tokenUsage.total_tokens;
        messagesWithTokens++;
      }
    });

    stats.avgContentLength = messages.length > 0 ? Math.round(totalContentLength / messages.length) : 0;
    stats.tokenStats.totalTokens = totalTokens;
    stats.tokenStats.avgTokensPerMessage = messagesWithTokens > 0 ? Math.round(totalTokens / messagesWithTokens) : 0;

    this.setCache(cacheKey, stats, 10 * 60 * 1000); // 10 minutes cache
    return stats;
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Middleware for validating directory path
 */
function validateDirectoryPath(req: Request, res: Response, next: NextFunction) {
  const { directoryPath } = req.body;
  
  if (!directoryPath || typeof directoryPath !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Directory path is required and must be a string',
    });
  }
  
  if (directoryPath.includes('..') || directoryPath.includes('~')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid directory path',
    });
  }
  
  next();
}

/**
 * POST /api/messages/parse
 * Parse messages with full content processing
 */
router.post('/parse', validateDirectoryPath, async (req: Request, res: Response) => {
  try {
    const { directoryPath, options = {} } = req.body;
    
    const parseResult = await MessageService.parseJsonlFiles(directoryPath);
    const messages = await MessageService.parseMessages(parseResult.entries, options);
    
    res.json({
      success: true,
      data: {
        messages,
        metadata: {
          totalMessages: messages.length,
          fileCount: parseResult.fileCount,
          errorCount: parseResult.errors.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse messages',
    });
  }
});

/**
 * POST /api/messages/search
 * Search messages by various criteria
 */
router.post('/search', validateDirectoryPath, async (req: Request, res: Response) => {
  try {
    const { directoryPath, criteria = {}, limit, offset } = req.body;
    
    const parseResult = await MessageService.parseJsonlFiles(directoryPath);
    const messages = await MessageService.searchMessages(parseResult.entries, criteria);
    
    // Apply pagination if provided
    const paginatedMessages = limit || offset ? 
      messages.slice(offset || 0, (offset || 0) + (limit || messages.length)) : 
      messages;
    
    const stats = await MessageService.getMessageStatistics(messages);
    
    res.json({
      success: true,
      data: {
        messages: paginatedMessages,
        pagination: {
          total: messages.length,
          offset: offset || 0,
          limit: limit || messages.length,
          hasMore: messages.length > (offset || 0) + (limit || messages.length),
        },
        statistics: stats,
        criteria,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search messages',
    });
  }
});

/**
 * POST /api/messages/filter
 * Filter messages by type and content
 */
router.post('/filter', validateDirectoryPath, async (req: Request, res: Response) => {
  try {
    const { 
      directoryPath, 
      messageType, 
      hasToolUse, 
      hasThinking, 
      hasImages,
      sessionId,
      limit = 100,
      offset = 0,
    } = req.body;
    
    const criteria: any = {};
    if (messageType) criteria.messageType = messageType;
    if (hasToolUse !== undefined) criteria.hasToolUse = hasToolUse;
    if (hasThinking !== undefined) criteria.hasThinking = hasThinking;
    if (hasImages !== undefined) criteria.hasImages = hasImages;
    if (sessionId) criteria.sessionId = sessionId;
    
    const parseResult = await MessageService.parseJsonlFiles(directoryPath);
    const filteredMessages = await MessageService.searchMessages(parseResult.entries, criteria);
    
    const paginatedMessages = filteredMessages.slice(offset, offset + limit);
    
    res.json({
      success: true,
      data: {
        messages: paginatedMessages,
        pagination: {
          total: filteredMessages.length,
          offset,
          limit,
          hasMore: filteredMessages.length > offset + limit,
        },
        filters: criteria,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to filter messages',
    });
  }
});

/**
 * POST /api/messages/by-session
 * Get all messages for a specific session
 */
router.post('/by-session', validateDirectoryPath, async (req: Request, res: Response) => {
  try {
    const { directoryPath, sessionId, includeContent = true } = req.body;
    
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required and must be a string',
      });
    }
    
    const parseResult = await MessageService.parseJsonlFiles(directoryPath);
    
    // Filter entries by session ID
    const sessionEntries = parseResult.entries.filter(entry => 
      entry.type !== 'summary' && entry.sessionId === sessionId
    );
    
    if (sessionEntries.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No messages found for session ${sessionId}`,
      });
    }
    
    // Parse messages with optional content parsing
    const messages = includeContent ? 
      await MessageService.parseMessages(sessionEntries) :
      sessionEntries.map(entry => parseTranscriptEntryOptimized(entry, { 
        includeRawContent: false,
        extractToolInfo: false,
      }));
    
    const stats = await MessageService.getMessageStatistics(messages);
    
    res.json({
      success: true,
      data: {
        sessionId,
        messages,
        statistics: stats,
        metadata: {
          messageCount: messages.length,
          includeContent,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session messages',
    });
  }
});

/**
 * POST /api/messages/content
 * Get formatted content for specific messages
 */
router.post('/content', validateDirectoryPath, async (req: Request, res: Response) => {
  try {
    const { directoryPath, messageIndex, format = 'text' } = req.body;
    
    if (typeof messageIndex !== 'number' || messageIndex < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid message index is required',
      });
    }
    
    const parseResult = await MessageService.parseJsonlFiles(directoryPath);
    
    if (messageIndex >= parseResult.entries.length) {
      return res.status(404).json({
        success: false,
        error: `Message index ${messageIndex} is out of range`,
      });
    }
    
    const entry = parseResult.entries[messageIndex];
    const message = parseTranscriptEntryOptimized(entry, {
      includeRawContent: true,
      extractToolInfo: true,
    });
    
    // Format content based on requested format
    const formattedContent = formatContentForDisplay(message.parsedContent, format as any);
    
    res.json({
      success: true,
      data: {
        messageIndex,
        messageType: message.messageType,
        displayType: message.displayType,
        timestamp: message.timestamp,
        content: formattedContent,
        parsedContent: message.parsedContent,
        hasToolUse: message.hasToolUse,
        hasThinking: message.hasThinking,
        hasImages: message.hasImages,
        tokenUsage: message.tokenUsage,
        format,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get message content',
    });
  }
});

/**
 * POST /api/messages/statistics
 * Get detailed message statistics
 */
router.post('/statistics', validateDirectoryPath, async (req: Request, res: Response) => {
  try {
    const { directoryPath, sessionId } = req.body;
    
    const parseResult = await MessageService.parseJsonlFiles(directoryPath);
    
    // Filter by session if provided
    const entries = sessionId ? 
      parseResult.entries.filter(entry => 
        entry.type !== 'summary' && entry.sessionId === sessionId
      ) :
      parseResult.entries;
    
    const messages = await MessageService.parseMessages(entries);
    const stats = await MessageService.getMessageStatistics(messages);
    
    res.json({
      success: true,
      data: {
        ...stats,
        metadata: {
          fileCount: parseResult.fileCount,
          totalEntries: parseResult.entries.length,
          filteredEntries: entries.length,
          sessionId: sessionId || null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get message statistics',
    });
  }
});

/**
 * DELETE /api/messages/cache
 * Clear message cache
 */
router.delete('/cache', (req: Request, res: Response) => {
  try {
    MessageService.clearCache();
    
    res.json({
      success: true,
      message: 'Message cache cleared successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear message cache',
    });
  }
});

export default router;