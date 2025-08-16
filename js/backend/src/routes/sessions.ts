import { Router, Request, Response } from 'express';
import { IApiResponse, ISession } from '../../../shared/src';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { 
  sessionIdValidation, 
  paginationValidation, 
  sessionContinueValidation,
  handleValidationErrors 
} from '../middleware/validation';

const router = Router();

// Validation schemas
const sessionIdSchema = z.string().uuid();
const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  project: z.string().optional()
});

// Helper function to find JSONL files recursively
function findJsonlFiles(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...findJsonlFiles(fullPath));
      } else if (entry.name.endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Could not read directory ${dir}:`, error);
  }
  
  return files;
}

// Helper function to parse JSONL and extract sessions
function parseSessionsFromJsonl(filePath: string): ISession[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    const sessionMap = new Map<string, any>();
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const sessionId = entry.sessionId;
        
        if (!sessionMap.has(sessionId)) {
          sessionMap.set(sessionId, {
            id: sessionId,
            entries: [],
            firstTimestamp: entry.timestamp,
            lastTimestamp: entry.timestamp,
            cwd: entry.cwd,
            totalUsage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0
            }
          });
        }
        
        const session = sessionMap.get(sessionId);
        session.entries.push(entry);
        session.lastTimestamp = entry.timestamp;
        
        // Accumulate usage if present
        if (entry.type === 'assistant' && entry.message?.usage) {
          const usage = entry.message.usage;
          session.totalUsage.input_tokens += usage.input_tokens || 0;
          session.totalUsage.output_tokens += usage.output_tokens || 0;
          session.totalUsage.cache_read_input_tokens += usage.cache_read_input_tokens || 0;
          session.totalUsage.cache_creation_input_tokens += usage.cache_creation_input_tokens || 0;
        }
      } catch (parseError) {
        console.warn(`Error parsing line in ${filePath}:`, parseError);
      }
    }
    
    return Array.from(sessionMap.values());
  } catch (error) {
    console.warn(`Error reading file ${filePath}:`, error);
    return [];
  }
}

// GET /api/sessions - List all sessions with pagination
router.get('/', paginationValidation, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const validation = paginationSchema.safeParse(req.query);
    if (!validation.success) {
      const response: IApiResponse = {
        success: false,
        error: 'Invalid pagination parameters',
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }
    
    const { limit, offset, project } = validation.data;
    
    // Look for JSONL files in common locations
    const searchPaths = [
      process.cwd(),
      path.join(process.cwd(), 'logs'),
      path.join(process.cwd(), '..'),
      path.join(process.env.HOME || '/', '.config', 'claude-code'),
      path.join(process.env.HOME || '/', 'Library', 'Application Support', 'claude-code')
    ];
    
    let allSessions: ISession[] = [];
    
    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        const jsonlFiles = findJsonlFiles(searchPath);
        for (const file of jsonlFiles) {
          const sessions = parseSessionsFromJsonl(file);
          allSessions.push(...sessions);
        }
      }
    }
    
    // Filter by project if specified
    if (project) {
      allSessions = allSessions.filter(session => 
        session.cwd.toLowerCase().includes(project.toLowerCase())
      );
    }
    
    // Sort by last timestamp (most recent first)
    allSessions.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
    
    // Apply pagination
    const total = allSessions.length;
    const paginatedSessions = allSessions.slice(offset, offset + limit);
    
    const response: IApiResponse = {
      success: true,
      data: {
        sessions: paginatedSessions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    const response: IApiResponse = {
      success: false,
      error: 'Failed to fetch sessions',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

// GET /api/sessions/:id - Get specific session details
router.get('/:id', sessionIdValidation, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const validation = sessionIdSchema.safeParse(req.params.id);
    if (!validation.success) {
      const response: IApiResponse = {
        success: false,
        error: 'Invalid session ID format',
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }
    
    const sessionId = validation.data;
    
    // Look for JSONL files in common locations
    const searchPaths = [
      process.cwd(),
      path.join(process.cwd(), 'logs'),
      path.join(process.cwd(), '..'),
      path.join(process.env.HOME || '/', '.config', 'claude-code'),
      path.join(process.env.HOME || '/', 'Library', 'Application Support', 'claude-code')
    ];
    
    let foundSession: ISession | null = null;
    
    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        const jsonlFiles = findJsonlFiles(searchPath);
        for (const file of jsonlFiles) {
          const sessions = parseSessionsFromJsonl(file);
          const session = sessions.find(s => s.id === sessionId);
          if (session) {
            foundSession = session;
            break;
          }
        }
        if (foundSession) break;
      }
    }
    
    if (!foundSession) {
      const response: IApiResponse = {
        success: false,
        error: 'Session not found',
        timestamp: new Date().toISOString()
      };
      return res.status(404).json(response);
    }
    
    const response: IApiResponse = {
      success: true,
      data: foundSession,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching session:', error);
    const response: IApiResponse = {
      success: false,
      error: 'Failed to fetch session',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

// POST /api/sessions/continue - Trigger Claude Code session continuation
router.post('/continue', sessionContinueValidation, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId) {
      const response: IApiResponse = {
        success: false,
        error: 'Session ID is required',
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }
    
    // For now, this is a placeholder that would integrate with Claude Code CLI
    // In a real implementation, this would trigger the Claude Code session continuation
    console.log(`Continuing session ${sessionId} with message:`, message);
    
    const response: IApiResponse = {
      success: true,
      data: {
        message: 'Session continuation triggered',
        sessionId,
        status: 'pending'
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error continuing session:', error);
    const response: IApiResponse = {
      success: false,
      error: 'Failed to continue session',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

export default router;