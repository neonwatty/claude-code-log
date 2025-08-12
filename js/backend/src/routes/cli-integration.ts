import { Router, Request, Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import { join } from 'path';
import { 
  JsonlParser,
  organizeIntoSessionsOptimized,
  parseTranscriptEntriesOptimized,
  SessionInfo,
  TranscriptEntry,
} from '@app/shared';
import { 
  validateSchema, 
  sessionValidationSchemas,
  addRequestContext,
  trackResponseTime,
  sessionErrorHandler
} from '../middleware/sessionValidation';
import ContextSerializer, { 
  ContextSerializationOptions,
  ContextPreparationResult 
} from '../services/context-serializer';
import SessionStateManager from '../services/session-state';
import { ApiResponse } from '@app/shared';

const router = Router();

/**
 * CLI Integration service for preparing and transferring session context to Claude Code CLI
 */
export class CLIIntegrationService {
  private contextSerializer: ContextSerializer;
  private sessionStateManager: SessionStateManager;

  constructor() {
    this.contextSerializer = new ContextSerializer();
    this.sessionStateManager = new SessionStateManager();
  }

  /**
   * Prepares session context for CLI transfer
   */
  async prepareSessionContext(
    sessionPath: string, 
    options: ContextSerializationOptions = {}
  ): Promise<ContextPreparationResult> {
    try {
      // Parse the JSONL file
      const parser = new JsonlParser();
      const parseResult = await parser.parseFile(sessionPath, {
        validate: true,
        includeInvalid: false,
      });

      if (!parseResult.success) {
        throw new Error(`Failed to parse session file: ${parseResult.error}`);
      }

      // Parse transcript entries
      const entries = parseTranscriptEntriesOptimized(parseResult.entries, {
        includeContent: true,
        includeTokenUsage: true,
        includeToolResults: true,
      });

      // Organize into session
      const sessions = organizeIntoSessionsOptimized(entries, {
        groupBySidechain: false,
        includeMetadata: true,
        calculateTokenUsage: true,
      });

      if (sessions.length === 0) {
        throw new Error('No valid sessions found in file');
      }

      // Use the first (main) session
      const sessionInfo = sessions[0];

      // Get session data if available
      const sessionData = await this.getSessionData(sessionInfo.sessionId);

      // Prepare context package
      return await this.contextSerializer.prepareContextPackage(
        sessionInfo,
        entries,
        sessionData,
        options
      );

    } catch (error) {
      throw new Error(`Failed to prepare session context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets session data from session state manager
   */
  private async getSessionData(sessionId: string) {
    try {
      return this.sessionStateManager.getSession(sessionId);
    } catch (error) {
      // Session data is optional, don't fail if not found
      console.warn(`Could not get session data for ${sessionId}:`, error);
      return undefined;
    }
  }

  /**
   * Gets a prepared context package
   */
  async getContextPackage(packageId: string) {
    return await this.contextSerializer.getContextPackage(packageId);
  }

  /**
   * Marks a package as transferred
   */
  markPackageTransferred(packageId: string): boolean {
    return this.contextSerializer.markPackageTransferred(packageId);
  }

  /**
   * Gets package statistics
   */
  getPackageStats() {
    return this.contextSerializer.getPackageStats();
  }

  /**
   * Deserializes a context package
   */
  async deserializeContextPackage(packageId: string) {
    const pkg = await this.contextSerializer.getContextPackage(packageId);
    if (!pkg) {
      throw new Error(`Context package not found: ${packageId}`);
    }

    return await this.contextSerializer.deserializeContextPackage(pkg);
  }

  /**
   * Shutdown cleanup
   */
  async shutdown(): Promise<void> {
    await Promise.all([
      this.contextSerializer.shutdown(),
      this.sessionStateManager.shutdown(),
    ]);
  }
}

// Create service instance
const cliIntegrationService = new CLIIntegrationService();

/**
 * Request validation schemas
 */
const cliValidationSchemas = {
  prepareContext: {
    type: 'object',
    required: ['sessionPath'],
    properties: {
      sessionPath: { 
        type: 'string', 
        minLength: 1,
        pattern: '^[^\\0]+$' // No null bytes
      },
      options: {
        type: 'object',
        properties: {
          includeAllEntries: { type: 'boolean' },
          maxEntries: { 
            type: 'integer', 
            minimum: 1, 
            maximum: 10000 
          },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string', format: 'date-time' },
              end: { type: 'string', format: 'date-time' }
            },
            required: ['start', 'end']
          },
          messageRange: {
            type: 'object',
            properties: {
              start: { type: 'integer', minimum: 0 },
              end: { type: 'integer', minimum: 0 }
            },
            required: ['start', 'end']
          },
          includeTokenUsage: { type: 'boolean' },
          includeFiles: { type: 'boolean' },
          includeTools: { type: 'boolean' },
          includePreferences: { type: 'boolean' },
          compress: { type: 'boolean' },
          contextType: { 
            type: 'string', 
            enum: ['full', 'partial', 'recent', 'range'] 
          }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },

  transferRequest: {
    type: 'object',
    required: ['packageId'],
    properties: {
      packageId: { 
        type: 'string', 
        pattern: '^[a-fA-F0-9-]+$' // UUID pattern
      }
    },
    additionalProperties: false
  }
};

/**
 * Authentication middleware for CLI endpoints
 */
const authenticateCLI = (req: Request, res: Response, next: NextFunction) => {
  // In a real implementation, this would validate CLI authentication tokens
  // For now, we'll use a simple header-based approach
  const cliToken = req.headers['x-cli-auth-token'];
  const userAgent = req.headers['user-agent'];

  if (!cliToken) {
    return res.status(401).json({
      success: false,
      error: 'CLI authentication token required',
      code: 'CLI_AUTH_REQUIRED'
    });
  }

  // Validate CLI token format (would be more sophisticated in production)
  if (typeof cliToken !== 'string' || cliToken.length < 10) {
    return res.status(401).json({
      success: false,
      error: 'Invalid CLI authentication token',
      code: 'CLI_AUTH_INVALID'
    });
  }

  // Check for Claude Code CLI user agent
  if (!userAgent || !userAgent.includes('claude-code')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid client - expected Claude Code CLI',
      code: 'CLI_CLIENT_INVALID'
    });
  }

  // Add CLI context to request
  req.cli = {
    token: cliToken as string,
    userAgent: userAgent as string,
    authenticated: true,
  };

  next();
};

/**
 * Rate limiting for CLI endpoints
 */
const rateLimitCLI = (req: Request, res: Response, next: NextFunction) => {
  // Simple in-memory rate limiting
  // In production, this would use Redis or similar
  const clientId = req.cli?.token || req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30; // 30 requests per minute

  if (!req.app.locals.rateLimitStore) {
    req.app.locals.rateLimitStore = new Map();
  }

  const store = req.app.locals.rateLimitStore;
  const key = `cli:${clientId}`;
  const windowData = store.get(key) || { count: 0, resetTime: now + windowMs };

  if (now > windowData.resetTime) {
    windowData.count = 0;
    windowData.resetTime = now + windowMs;
  }

  windowData.count++;
  store.set(key, windowData);

  if (windowData.count > maxRequests) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((windowData.resetTime - now) / 1000),
    });
  }

  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': Math.max(0, maxRequests - windowData.count).toString(),
    'X-RateLimit-Reset': Math.ceil(windowData.resetTime / 1000).toString(),
  });

  next();
};

// Apply middleware to all CLI routes
router.use(addRequestContext('cli-integration'));
router.use(trackResponseTime);
router.use(authenticateCLI);
router.use(rateLimitCLI);

/**
 * POST /api/cli/context/prepare
 * Prepares session context for CLI transfer
 */
router.post(
  '/context/prepare',
  validateSchema(cliValidationSchemas.prepareContext),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionPath, options = {} } = req.body;

      // Validate session file exists and is accessible
      try {
        await fs.access(sessionPath);
        const stats = await fs.stat(sessionPath);
        if (!stats.isFile()) {
          return res.status(400).json({
            success: false,
            error: 'Path is not a file',
            code: 'INVALID_FILE_PATH'
          } as ApiResponse);
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Session file not found or not accessible',
          code: 'FILE_NOT_FOUND'
        } as ApiResponse);
      }

      // Process date range if provided
      if (options.dateRange) {
        options.dateRange = {
          start: new Date(options.dateRange.start),
          end: new Date(options.dateRange.end),
        };
      }

      const result = await cliIntegrationService.prepareSessionContext(sessionPath, options);

      res.status(200).json({
        success: true,
        data: {
          packageId: result.package.id,
          sessionId: result.package.sessionId,
          preparationStats: result.stats,
          packageInfo: {
            compressed: result.package.info.compressed,
            size: result.package.info.size,
            originalSize: result.package.info.originalSize,
            version: result.package.info.version,
          },
          warnings: result.warnings,
          expiresAt: result.package.expiresAt.toISOString(),
        },
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cli/context/:packageId
 * Retrieves prepared context package
 */
router.get(
  '/context/:packageId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { packageId } = req.params;

      // Validate package ID format
      if (!/^[a-fA-F0-9-]+$/.test(packageId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid package ID format',
          code: 'INVALID_PACKAGE_ID'
        } as ApiResponse);
      }

      const contextPackage = await cliIntegrationService.getContextPackage(packageId);

      if (!contextPackage) {
        return res.status(404).json({
          success: false,
          error: 'Context package not found or expired',
          code: 'PACKAGE_NOT_FOUND'
        } as ApiResponse);
      }

      // Deserialize the context for transfer
      const context = await cliIntegrationService.deserializeContextPackage(packageId);

      res.status(200).json({
        success: true,
        data: {
          context,
          packageInfo: {
            id: contextPackage.id,
            sessionId: contextPackage.sessionId,
            createdAt: contextPackage.createdAt.toISOString(),
            expiresAt: contextPackage.expiresAt.toISOString(),
            status: contextPackage.status,
            compressed: contextPackage.info.compressed,
            size: contextPackage.info.size,
            checksum: contextPackage.info.checksum,
          },
        },
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cli/transfer/:packageId
 * Marks a context package as transferred
 */
router.post(
  '/transfer/:packageId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { packageId } = req.params;

      // Validate package ID format
      if (!/^[a-fA-F0-9-]+$/.test(packageId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid package ID format',
          code: 'INVALID_PACKAGE_ID'
        } as ApiResponse);
      }

      const success = cliIntegrationService.markPackageTransferred(packageId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Context package not found or already transferred',
          code: 'PACKAGE_NOT_FOUND'
        } as ApiResponse);
      }

      res.status(200).json({
        success: true,
        data: {
          packageId,
          status: 'transferred',
          transferredAt: new Date().toISOString(),
        },
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cli/status
 * Gets CLI integration status and statistics
 */
router.get(
  '/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const packageStats = cliIntegrationService.getPackageStats();

      res.status(200).json({
        success: true,
        data: {
          status: 'operational',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          packages: packageStats,
          limits: {
            maxPackageSize: 100 * 1024 * 1024, // 100MB
            packageTTL: 24 * 60 * 60 * 1000, // 24 hours
            rateLimit: {
              window: 60, // seconds
              maxRequests: 30,
            },
          },
        },
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cli/health
 * Health check endpoint for CLI integration
 */
router.get(
  '/health',
  async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    } as ApiResponse);
  }
);

// Error handling middleware
router.use(sessionErrorHandler);

// Export service for testing and cleanup
export { cliIntegrationService };

export default router;

// Extend Express Request interface for CLI context
declare global {
  namespace Express {
    interface Request {
      cli?: {
        token: string;
        userAgent: string;
        authenticated: boolean;
      };
    }
  }
}