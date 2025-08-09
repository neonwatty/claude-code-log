import { Request, Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import { join } from 'path';
import { z } from 'zod';

/**
 * Validation schemas using Zod
 */
export const sessionValidationSchemas = {
  // Directory path validation
  directoryPath: z.object({
    directoryPath: z.string()
      .min(1, 'Directory path is required')
      .refine(path => !path.includes('..'), 'Directory path cannot contain ".."')
      .refine(path => !path.includes('~'), 'Directory path cannot contain "~"')
      .refine(path => path.startsWith('/') || path.match(/^[A-Za-z]:\\/), 'Directory path must be absolute'),
  }),

  // Session organization options
  sessionOptions: z.object({
    directoryPath: z.string().min(1),
    options: z.object({
      sortBy: z.enum(['chronological', 'reverse-chronological', 'sessionId']).optional(),
      includeTokenUsage: z.boolean().optional(),
      includeMessagePreviews: z.boolean().optional(),
      groupByWorkingDirectory: z.boolean().optional(),
      minMessageCount: z.number().min(1).optional(),
      maxPreviewLength: z.number().min(1).max(1000).optional(),
      useCache: z.boolean().optional(),
      enableProfiling: z.boolean().optional(),
    }).optional(),
  }),

  // Session ID validation
  sessionId: z.object({
    sessionId: z.string()
      .min(1, 'Session ID is required')
      .max(100, 'Session ID too long'),
    directoryPath: z.string().min(1),
  }),

  // Working directory filter
  workingDirectoryFilter: z.object({
    directoryPath: z.string().min(1),
    workingDirectory: z.string().min(1, 'Working directory is required'),
  }),

  // Message parsing options
  messageOptions: z.object({
    directoryPath: z.string().min(1),
    options: z.object({
      maxPreviewLength: z.number().min(1).max(1000).optional(),
      enableMarkdown: z.boolean().optional(),
      includeRawContent: z.boolean().optional(),
      extractToolInfo: z.boolean().optional(),
      useCache: z.boolean().optional(),
      enableProfiling: z.boolean().optional(),
    }).optional(),
  }),

  // Search criteria
  searchCriteria: z.object({
    directoryPath: z.string().min(1),
    criteria: z.object({
      messageType: z.enum(['user', 'assistant', 'system', 'summary']).optional(),
      hasToolUse: z.boolean().optional(),
      hasThinking: z.boolean().optional(),
      hasImages: z.boolean().optional(),
      toolName: z.string().optional(),
      textSearch: z.string().optional(),
      sessionId: z.string().optional(),
      dateRange: z.object({
        start: z.string().datetime().optional(),
        end: z.string().datetime().optional(),
      }).optional(),
    }).optional(),
    limit: z.number().min(1).max(1000).optional(),
    offset: z.number().min(0).optional(),
  }),

  // Message filter
  messageFilter: z.object({
    directoryPath: z.string().min(1),
    messageType: z.enum(['user', 'assistant', 'system', 'summary']).optional(),
    hasToolUse: z.boolean().optional(),
    hasThinking: z.boolean().optional(),
    hasImages: z.boolean().optional(),
    sessionId: z.string().optional(),
    limit: z.number().min(1).max(1000).default(100),
    offset: z.number().min(0).default(0),
  }),

  // Message content request
  messageContent: z.object({
    directoryPath: z.string().min(1),
    messageIndex: z.number().min(0),
    format: z.enum(['text', 'html', 'preview']).default('text'),
  }),

  // Session by ID request
  sessionById: z.object({
    directoryPath: z.string().min(1),
    sessionId: z.string().min(1),
    includeContent: z.boolean().default(true),
  }),
};

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  public statusCode: number;
  public details: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

/**
 * Custom error class for file system errors
 */
export class FileSystemError extends Error {
  public statusCode: number;
  public originalError: Error;

  constructor(message: string, originalError: Error) {
    super(message);
    this.name = 'FileSystemError';
    this.statusCode = 400;
    this.originalError = originalError;
  }
}

/**
 * Validation middleware factory
 */
export function validateSchema(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body or query parameters
      const data = req.method === 'GET' ? req.query : req.body;
      schema.parse(data);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          'Validation failed',
          error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          }))
        );
        next(validationError);
      } else {
        next(error);
      }
    }
  };
}

/**
 * Directory existence validation middleware
 */
export const validateDirectoryExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const directoryPath = req.body?.directoryPath || req.query?.directoryPath;
    
    if (!directoryPath) {
      throw new ValidationError('Directory path is required');
    }

    // Check if directory exists
    try {
      const stats = await fs.stat(directoryPath);
      if (!stats.isDirectory()) {
        throw new FileSystemError(
          `Path is not a directory: ${directoryPath}`,
          new Error('Not a directory')
        );
      }
    } catch (fsError) {
      throw new FileSystemError(
        `Directory does not exist or is not accessible: ${directoryPath}`,
        fsError as Error
      );
    }

    // Check for JSONL files
    try {
      const files = await fs.readdir(directoryPath);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
      
      if (jsonlFiles.length === 0) {
        throw new ValidationError(`No JSONL files found in directory: ${directoryPath}`);
      }

      // Store file count for later use
      req.context = { ...req.context, jsonlFileCount: jsonlFiles.length };
    } catch (fsError) {
      throw new FileSystemError(
        `Cannot read directory: ${directoryPath}`,
        fsError as Error
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Rate limiting for resource-intensive operations
 */
class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || now > record.resetTime) {
      this.requests.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  getRemainingRequests(key: string): number {
    const record = this.requests.get(key);
    if (!record || Date.now() > record.resetTime) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - record.count);
  }

  getResetTime(key: string): number {
    const record = this.requests.get(key);
    if (!record || Date.now() > record.resetTime) {
      return Date.now() + this.windowMs;
    }
    return record.resetTime;
  }
}

// Rate limiter instances
const parseRateLimiter = new RateLimiter(5, 60000); // 5 requests per minute
const analyticsRateLimiter = new RateLimiter(10, 60000); // 10 requests per minute

/**
 * Rate limiting middleware factory
 */
export function createRateLimiter(limiter: RateLimiter, keyGenerator: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    
    if (!limiter.isAllowed(key)) {
      const remainingRequests = limiter.getRemainingRequests(key);
      const resetTime = limiter.getResetTime(key);
      
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        details: {
          remainingRequests,
          resetTime: new Date(resetTime).toISOString(),
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
        },
      });
      return;
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Remaining': limiter.getRemainingRequests(key).toString(),
      'X-RateLimit-Reset': limiter.getResetTime(key).toString(),
    });

    next();
  };
}

/**
 * Pre-configured rate limiters
 */
export const rateLimiters = {
  parse: createRateLimiter(parseRateLimiter, req => 
    req.ip + ':' + (req.body?.directoryPath || req.query?.directoryPath || 'unknown')
  ),
  analytics: createRateLimiter(analyticsRateLimiter, req => 
    req.ip + ':' + (req.body?.directoryPath || req.query?.directoryPath || 'unknown')
  ),
  general: createRateLimiter(new RateLimiter(20, 60000), req => req.ip), // 20 requests per minute
};

/**
 * Request context middleware
 */
export const addRequestContext = (req: Request, res: Response, next: NextFunction) => {
  req.context = {
    startTime: Date.now(),
    requestId: Math.random().toString(36).substring(2),
  };
  
  res.set('X-Request-ID', req.context.requestId);
  next();
};

/**
 * Response time tracking middleware
 */
export const trackResponseTime = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    res.set('X-Response-Time', `${responseTime}ms`);
    
    // Log slow requests
    if (responseTime > 5000) {
      console.warn(`Slow request: ${req.method} ${req.path} took ${responseTime}ms`);
    }
  });
  
  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'",
  });
  next();
};

/**
 * Enhanced error handler for session API
 */
export const sessionErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error with context
  console.error('Session API Error:', {
    requestId: req.context?.requestId,
    method: req.method,
    path: req.path,
    error: error.message,
    stack: error.stack,
    body: req.body,
    query: req.query,
  });

  // Handle specific error types
  if (error instanceof ValidationError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      details: error.details,
      requestId: req.context?.requestId,
    });
  }

  if (error instanceof FileSystemError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      type: 'FileSystemError',
      requestId: req.context?.requestId,
    });
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
      requestId: req.context?.requestId,
    });
  }

  // Handle known error patterns
  if (error.message.includes('ENOENT')) {
    return res.status(404).json({
      success: false,
      error: 'File or directory not found',
      requestId: req.context?.requestId,
    });
  }

  if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
    return res.status(403).json({
      success: false,
      error: 'Permission denied',
      requestId: req.context?.requestId,
    });
  }

  // Generic server error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    requestId: req.context?.requestId,
    ...(process.env.NODE_ENV === 'development' && { details: error.message }),
  });
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      context?: {
        startTime: number;
        requestId: string;
        jsonlFileCount?: number;
      };
    }
  }
}