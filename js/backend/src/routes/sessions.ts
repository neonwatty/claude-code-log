import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { 
  JsonlParser,
  organizeIntoSessionsOptimized,
  organizeProjectOptimized,
  parseTranscriptEntriesOptimized,
  findSessionsByWorkingDirectory,
  SessionInfo,
  ProjectSessions,
  ParsedMessage,
  OptimizedSessionOptions,
  OptimizedParsingOptions,
} from '@app/shared';

const router = Router();

/**
 * Session service for handling JSONL parsing and session organization
 */
class SessionService {
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
   * Parse JSONL files from a directory
   */
  static async parseJsonlFiles(directoryPath: string): Promise<{
    entries: any[];
    errors: any[];
    fileCount: number;
  }> {
    const cacheKey = `parse-${directoryPath}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const files = await fs.readdir(directoryPath);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
      
      if (jsonlFiles.length === 0) {
        throw new Error(`No JSONL files found in directory: ${directoryPath}`);
      }

      const parser = new JsonlParser({ 
        skipInvalidLines: true,
        batchSize: 1000,
      });

      let allEntries: any[] = [];
      let allErrors: any[] = [];

      for (const file of jsonlFiles) {
        const filePath = join(directoryPath, file);
        try {
          const result = await parser.parseFile(filePath);
          allEntries.push(...result.entries);
          allErrors.push(...result.errors.map(err => ({ ...err, file })));
        } catch (error) {
          allErrors.push({
            file,
            error: error instanceof Error ? error.message : String(error),
            lineNumber: 0,
            line: '',
          });
        }
      }

      const result = {
        entries: allEntries,
        errors: allErrors,
        fileCount: jsonlFiles.length,
      };

      this.setCache(cacheKey, result, 10 * 60 * 1000); // 10 minutes cache
      return result;
    } catch (error) {
      throw new Error(`Failed to parse JSONL files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Organize entries into sessions
   */
  static async organizeSessions(
    entries: any[], 
    options: OptimizedSessionOptions = {}
  ): Promise<SessionInfo[]> {
    const cacheKey = `sessions-${entries.length}-${JSON.stringify(options)}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const sessions = await organizeIntoSessionsOptimized(entries, {
        useCache: true,
        enableProfiling: true,
        includeTokenUsage: true,
        includeMessagePreviews: true,
        ...options,
      });

      this.setCache(cacheKey, sessions, 5 * 60 * 1000); // 5 minutes cache
      return sessions;
    } catch (error) {
      throw new Error(`Failed to organize sessions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Organize project-level data
   */
  static async organizeProject(entries: any[]): Promise<ProjectSessions> {
    const cacheKey = `project-${entries.length}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const project = await organizeProjectOptimized(entries, {
        useCache: true,
        enableProfiling: true,
        includeTokenUsage: true,
        groupByWorkingDirectory: true,
      });

      this.setCache(cacheKey, project, 10 * 60 * 1000); // 10 minutes cache
      return project;
    } catch (error) {
      throw new Error(`Failed to organize project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse messages with content parsing
   */
  static async parseMessages(
    entries: any[], 
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
        ...options,
      });

      this.setCache(cacheKey, messages, 5 * 60 * 1000); // 5 minutes cache
      return messages;
    } catch (error) {
      throw new Error(`Failed to parse messages: ${error instanceof Error ? error.message : String(error)}`);
    }
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
  
  // Basic path validation (could be enhanced with more security checks)
  if (directoryPath.includes('..') || directoryPath.includes('~')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid directory path',
    });
  }
  
  next();
}

/**
 * GET /api/sessions/parse
 * Parse JSONL files from a directory and return raw entries
 */
router.post('/parse', validateDirectoryPath, async (req: Request, res: Response) => {
  try {
    const { directoryPath } = req.body;
    
    const result = await SessionService.parseJsonlFiles(directoryPath);
    
    res.json({
      success: true,
      data: {
        entries: result.entries,
        errors: result.errors,
        fileCount: result.fileCount,
        totalEntries: result.entries.length,
        errorCount: result.errors.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse JSONL files',
    });
  }
});

/**
 * POST /api/sessions/organize
 * Organize entries into sessions
 */
router.post('/organize', validateDirectoryPath, async (req: Request, res: Response) => {
  try {
    const { directoryPath, options = {} } = req.body;
    
    // Parse files first
    const parseResult = await SessionService.parseJsonlFiles(directoryPath);
    
    // Organize into sessions
    const sessions = await SessionService.organizeSessions(parseResult.entries, options);
    
    res.json({
      success: true,
      data: {
        sessions,
        totalSessions: sessions.length,
        totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0),
        parsingErrors: parseResult.errors,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to organize sessions',
    });
  }
});

/**
 * POST /api/sessions/project
 * Get project-level organization and analytics
 */
router.post('/project', validateDirectoryPath, async (req: Request, res: Response) => {
  try {
    const { directoryPath } = req.body;
    
    // Parse files first
    const parseResult = await SessionService.parseJsonlFiles(directoryPath);
    
    // Organize project
    const project = await SessionService.organizeProject(parseResult.entries);
    
    res.json({
      success: true,
      data: {
        ...project,
        parsingInfo: {
          fileCount: parseResult.fileCount,
          errorCount: parseResult.errors.length,
          totalEntries: parseResult.entries.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to organize project',
    });
  }
});

/**
 * GET /api/sessions/:sessionId
 * Get detailed information about a specific session
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { directoryPath } = req.query;
    
    if (!directoryPath || typeof directoryPath !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Directory path is required as query parameter',
      });
    }
    
    // Parse and organize sessions
    const parseResult = await SessionService.parseJsonlFiles(directoryPath);
    const sessions = await SessionService.organizeSessions(parseResult.entries);
    
    // Find specific session
    const session = sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: `Session ${sessionId} not found`,
      });
    }
    
    // Parse messages for this session
    const messages = await SessionService.parseMessages(session.entries, {
      includeRawContent: true,
      extractToolInfo: true,
    });
    
    res.json({
      success: true,
      data: {
        session: {
          ...session,
          messages,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session details',
    });
  }
});

/**
 * POST /api/sessions/directory
 * Get sessions filtered by working directory
 */
router.post('/directory', validateDirectoryPath, async (req: Request, res: Response) => {
  try {
    const { directoryPath, workingDirectory } = req.body;
    
    if (!workingDirectory || typeof workingDirectory !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Working directory filter is required',
      });
    }
    
    // Parse files
    const parseResult = await SessionService.parseJsonlFiles(directoryPath);
    
    // Filter by working directory
    const filteredSessions = await findSessionsByWorkingDirectory(
      parseResult.entries,
      workingDirectory
    );
    
    res.json({
      success: true,
      data: {
        sessions: filteredSessions,
        workingDirectory,
        totalSessions: filteredSessions.length,
        totalMessages: filteredSessions.reduce((sum, s) => sum + s.messageCount, 0),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to filter sessions by directory',
    });
  }
});

/**
 * DELETE /api/sessions/cache
 * Clear the session cache
 */
router.delete('/cache', (req: Request, res: Response) => {
  try {
    SessionService.clearCache();
    
    res.json({
      success: true,
      message: 'Session cache cleared successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
    });
  }
});

/**
 * GET /api/sessions/cache/status
 * Get cache status information
 */
router.get('/cache/status', (req: Request, res: Response) => {
  try {
    const cacheEntries = Array.from((SessionService as any).cache.entries());
    const cacheStatus = {
      size: cacheEntries.length,
      entries: cacheEntries.map(([key, entry]: [string, any]) => ({
        key,
        timestamp: entry.timestamp,
        ttl: entry.ttl,
        age: Date.now() - entry.timestamp,
        isValid: Date.now() - entry.timestamp < entry.ttl,
      })),
    };
    
    res.json({
      success: true,
      data: cacheStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get cache status',
    });
  }
});

export default router;