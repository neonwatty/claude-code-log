import { Router, Request, Response } from "express";
import { IApiResponse, ISession } from "../../../shared/src";
import {
  SessionContinuationRequestSchema,
  SessionContinuationWithContextRequestSchema,
  ContextPreparationRequestSchema,
} from "../../../shared/src/schemas/claude-integration.js";
import fs from "fs";
import path from "path";
import { z } from "zod";
import {
  sessionIdValidation,
  paginationValidation,
  handleValidationErrors,
} from "../middleware/validation";
import { ClaudeIntegrationService } from "../services/claude-integration.service.js";

const router = Router();

// Initialize Claude integration service
const claudeService = new ClaudeIntegrationService();

// Validation schemas
const sessionIdSchema = z.string().uuid();
const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  project: z.string().optional(),
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
      } else if (entry.name.endsWith(".jsonl")) {
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
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.trim());

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
              cache_creation_input_tokens: 0,
            },
          });
        }

        const session = sessionMap.get(sessionId);
        session.entries.push(entry);
        session.lastTimestamp = entry.timestamp;

        // Accumulate usage if present
        if (entry.type === "assistant" && entry.message?.usage) {
          const usage = entry.message.usage;
          session.totalUsage.input_tokens += usage.input_tokens || 0;
          session.totalUsage.output_tokens += usage.output_tokens || 0;
          session.totalUsage.cache_read_input_tokens +=
            usage.cache_read_input_tokens || 0;
          session.totalUsage.cache_creation_input_tokens +=
            usage.cache_creation_input_tokens || 0;
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
router.get(
  "/",
  paginationValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const validation = paginationSchema.safeParse(req.query);
      if (!validation.success) {
        const response: IApiResponse = {
          success: false,
          error: "Invalid pagination parameters",
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      const { limit, offset, project } = validation.data;

      // Look for JSONL files in common locations
      const searchPaths = [
        process.cwd(),
        path.join(process.cwd(), "logs"),
        path.join(process.cwd(), ".."),
        path.join(process.env.HOME || "/", ".config", "claude-code"),
        path.join(
          process.env.HOME || "/",
          "Library",
          "Application Support",
          "claude-code",
        ),
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
        allSessions = allSessions.filter((session) =>
          session.cwd.toLowerCase().includes(project.toLowerCase()),
        );
      }

      // Sort by last timestamp (most recent first)
      allSessions.sort(
        (a, b) =>
          new Date(b.lastTimestamp).getTime() -
          new Date(a.lastTimestamp).getTime(),
      );

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
            hasMore: offset + limit < total,
          },
        },
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      const response: IApiResponse = {
        success: false,
        error: "Failed to fetch sessions",
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(response);
    }
  },
);

// GET /api/sessions/:id - Get specific session details
router.get(
  "/:id",
  sessionIdValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const validation = sessionIdSchema.safeParse(req.params.id);
      if (!validation.success) {
        const response: IApiResponse = {
          success: false,
          error: "Invalid session ID format",
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      const sessionId = validation.data;

      // Look for JSONL files in common locations
      const searchPaths = [
        process.cwd(),
        path.join(process.cwd(), "logs"),
        path.join(process.cwd(), ".."),
        path.join(process.env.HOME || "/", ".config", "claude-code"),
        path.join(
          process.env.HOME || "/",
          "Library",
          "Application Support",
          "claude-code",
        ),
      ];

      let foundSession: ISession | null = null;

      for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
          const jsonlFiles = findJsonlFiles(searchPath);
          for (const file of jsonlFiles) {
            const sessions = parseSessionsFromJsonl(file);
            const session = sessions.find((s) => s.id === sessionId);
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
          error: "Session not found",
          timestamp: new Date().toISOString(),
        };
        return res.status(404).json(response);
      }

      const response: IApiResponse = {
        success: true,
        data: foundSession,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching session:", error);
      const response: IApiResponse = {
        success: false,
        error: "Failed to fetch session",
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(response);
    }
  },
);

// POST /api/sessions/continue - Trigger Claude Code session continuation
router.post("/continue", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = SessionContinuationRequestSchema.safeParse(req.body);
    if (!validation.success) {
      const response: IApiResponse = {
        success: false,
        error: "Invalid session continuation request",
        details: validation.error.flatten(),
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const request = validation.data;

    // Find the session file path if not provided
    if (!request.sessionPath) {
      // Look for the session JSONL file
      const searchPaths = [
        process.cwd(),
        path.join(process.cwd(), "logs"),
        path.join(process.cwd(), ".."),
        path.join(process.env.HOME || "/", ".config", "claude-code"),
        path.join(
          process.env.HOME || "/",
          "Library",
          "Application Support",
          "claude-code",
        ),
      ];

      let foundSessionPath: string | null = null;

      for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
          const jsonlFiles = findJsonlFiles(searchPath);
          for (const file of jsonlFiles) {
            const sessions = parseSessionsFromJsonl(file);
            const session = sessions.find((s) => s.id === request.sessionId);
            if (session) {
              foundSessionPath = file;
              break;
            }
          }
          if (foundSessionPath) break;
        }
      }

      if (!foundSessionPath) {
        const response: IApiResponse = {
          success: false,
          error: "Session file not found",
          timestamp: new Date().toISOString(),
        };
        return res.status(404).json(response);
      }

      // Update request with found session path
      request.sessionPath = foundSessionPath;
    }

    // Continue the session using Claude integration service
    const continuationResponse = await claudeService.continueSession(request);

    const response: IApiResponse = {
      success: continuationResponse.success,
      data: continuationResponse,
      error: continuationResponse.error,
      timestamp: new Date().toISOString(),
    };

    const statusCode = continuationResponse.success ? 200 : 400;
    res.status(statusCode).json(response);
  } catch (error) {
    console.error("Error continuing session:", error);
    const response: IApiResponse = {
      success: false,
      error: "Internal server error during session continuation",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// GET /api/sessions/processes - Get all active Claude processes
router.get("/processes", async (req: Request, res: Response) => {
  try {
    const processes = claudeService.getAllProcessStatus();

    const response: IApiResponse = {
      success: true,
      data: { processes },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching processes:", error);
    const response: IApiResponse = {
      success: false,
      error: "Failed to fetch active processes",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// GET /api/sessions/processes/:id - Get specific process status
router.get("/processes/:id", async (req: Request, res: Response) => {
  try {
    const processId = req.params.id;
    const status = claudeService.getProcessStatus(processId);

    if (!status) {
      const response: IApiResponse = {
        success: false,
        error: "Process not found",
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    const response: IApiResponse = {
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching process status:", error);
    const response: IApiResponse = {
      success: false,
      error: "Failed to fetch process status",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// POST /api/sessions/processes/:id/input - Send input to a process
router.post("/processes/:id/input", async (req: Request, res: Response) => {
  try {
    const processId = req.params.id;
    const { input } = req.body;

    if (!input || typeof input !== "string") {
      const response: IApiResponse = {
        success: false,
        error: "Input string is required",
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const success = claudeService.sendInput(processId, input);

    if (!success) {
      const response: IApiResponse = {
        success: false,
        error: "Failed to send input to process",
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    const response: IApiResponse = {
      success: true,
      data: { message: "Input sent successfully" },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error("Error sending input to process:", error);
    const response: IApiResponse = {
      success: false,
      error: "Failed to send input to process",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// DELETE /api/sessions/processes/:id - Kill a process
router.delete("/processes/:id", async (req: Request, res: Response) => {
  try {
    const processId = req.params.id;
    const { reason } = req.body;

    const success = await claudeService.killProcess(processId, reason);

    if (!success) {
      const response: IApiResponse = {
        success: false,
        error: "Process not found or already stopped",
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    const response: IApiResponse = {
      success: true,
      data: { message: "Process terminated successfully" },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error("Error killing process:", error);
    const response: IApiResponse = {
      success: false,
      error: "Failed to terminate process",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// POST /api/sessions/prepare-context - Prepare session context (CLAUDE.md generation)
router.post("/prepare-context", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = ContextPreparationRequestSchema.safeParse(req.body);
    if (!validation.success) {
      const response: IApiResponse = {
        success: false,
        error: "Invalid context preparation request",
        details: validation.error.flatten(),
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const request = validation.data;

    // Find the session
    const sessionId = request.sessionId;
    let foundSession: ISession | null = null;

    // Look for JSONL files in common locations
    const searchPaths = [
      process.cwd(),
      path.join(process.cwd(), "logs"),
      path.join(process.cwd(), ".."),
      path.join(process.env.HOME || "/", ".config", "claude-code"),
      path.join(
        process.env.HOME || "/",
        "Library",
        "Application Support",
        "claude-code",
      ),
    ];

    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        const jsonlFiles = findJsonlFiles(searchPath);
        for (const file of jsonlFiles) {
          const sessions = parseSessionsFromJsonl(file);
          const session = sessions.find((s) => s.id === sessionId);
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
        error: "Session not found",
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    // Prepare context using Claude integration service
    const contextResult = await claudeService.prepareSessionContext(
      request,
      foundSession,
    );

    const response: IApiResponse = {
      success: contextResult.success,
      data: contextResult,
      error: contextResult.error,
      timestamp: new Date().toISOString(),
    };

    const statusCode = contextResult.success ? 200 : 400;
    res.status(statusCode).json(response);
  } catch (error) {
    console.error("Error preparing session context:", error);
    const response: IApiResponse = {
      success: false,
      error: "Internal server error during context preparation",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// POST /api/sessions/continue-with-context - Continue session with automatic context preparation
router.post("/continue-with-context", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = SessionContinuationWithContextRequestSchema.safeParse(
      req.body,
    );
    if (!validation.success) {
      const response: IApiResponse = {
        success: false,
        error: "Invalid session continuation with context request",
        details: validation.error.flatten(),
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const request = validation.data;

    // Find the session
    const sessionId = request.sessionId;
    let foundSession: ISession | null = null;

    // Look for JSONL files in common locations
    const searchPaths = [
      process.cwd(),
      path.join(process.cwd(), "logs"),
      path.join(process.cwd(), ".."),
      path.join(process.env.HOME || "/", ".config", "claude-code"),
      path.join(
        process.env.HOME || "/",
        "Library",
        "Application Support",
        "claude-code",
      ),
    ];

    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        const jsonlFiles = findJsonlFiles(searchPath);
        for (const file of jsonlFiles) {
          const sessions = parseSessionsFromJsonl(file);
          const session = sessions.find((s) => s.id === sessionId);
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
        error: "Session not found",
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    // Find the session file path if not provided
    if (!request.sessionPath) {
      let foundSessionPath: string | null = null;

      for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
          const jsonlFiles = findJsonlFiles(searchPath);
          for (const file of jsonlFiles) {
            const sessions = parseSessionsFromJsonl(file);
            const session = sessions.find((s) => s.id === request.sessionId);
            if (session) {
              foundSessionPath = file;
              break;
            }
          }
          if (foundSessionPath) break;
        }
      }

      if (!foundSessionPath) {
        const response: IApiResponse = {
          success: false,
          error: "Session file not found",
          timestamp: new Date().toISOString(),
        };
        return res.status(404).json(response);
      }

      // Update request with found session path
      request.sessionPath = foundSessionPath;
    }

    // Continue session with context using Claude integration service
    const continuationResponse = await claudeService.continueSessionWithContext(
      request,
      foundSession,
    );

    const response: IApiResponse = {
      success: continuationResponse.success,
      data: continuationResponse,
      error: continuationResponse.error,
      timestamp: new Date().toISOString(),
    };

    const statusCode = continuationResponse.success ? 200 : 400;
    res.status(statusCode).json(response);
  } catch (error) {
    console.error("Error continuing session with context:", error);
    const response: IApiResponse = {
      success: false,
      error: "Internal server error during session continuation with context",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// GET /api/sessions/:id/context - Get session context data without starting a process
router.get(
  "/:id/context",
  sessionIdValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const validation = sessionIdSchema.safeParse(req.params.id);
      if (!validation.success) {
        const response: IApiResponse = {
          success: false,
          error: "Invalid session ID format",
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      const sessionId = validation.data;

      // Find the session
      let foundSession: ISession | null = null;

      // Look for JSONL files in common locations
      const searchPaths = [
        process.cwd(),
        path.join(process.cwd(), "logs"),
        path.join(process.cwd(), ".."),
        path.join(process.env.HOME || "/", ".config", "claude-code"),
        path.join(
          process.env.HOME || "/",
          "Library",
          "Application Support",
          "claude-code",
        ),
      ];

      for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
          const jsonlFiles = findJsonlFiles(searchPath);
          for (const file of jsonlFiles) {
            const sessions = parseSessionsFromJsonl(file);
            const session = sessions.find((s) => s.id === sessionId);
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
          error: "Session not found",
          timestamp: new Date().toISOString(),
        };
        return res.status(404).json(response);
      }

      // Get context data without writing files
      const contextResult = await claudeService.getSessionContextData(
        sessionId,
        foundSession,
      );

      const response: IApiResponse = {
        success: contextResult.success,
        data: contextResult,
        error: contextResult.error,
        timestamp: new Date().toISOString(),
      };

      const statusCode = contextResult.success ? 200 : 400;
      res.status(statusCode).json(response);
    } catch (error) {
      console.error("Error fetching session context:", error);
      const response: IApiResponse = {
        success: false,
        error: "Failed to fetch session context",
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(response);
    }
  },
);

// DELETE /api/sessions/:id/context - Clean up session context files
router.delete(
  "/:id/context",
  sessionIdValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const validation = sessionIdSchema.safeParse(req.params.id);
      if (!validation.success) {
        const response: IApiResponse = {
          success: false,
          error: "Invalid session ID format",
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      // const sessionId = validation.data; // Unused for now
      const { workingDirectory, keepClaudeMd } = req.body;

      if (!workingDirectory) {
        const response: IApiResponse = {
          success: false,
          error: "Working directory is required for context cleanup",
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      // Clean up context files
      await claudeService.cleanupSessionContext(
        workingDirectory,
        keepClaudeMd || false,
      );

      const response: IApiResponse = {
        success: true,
        data: { message: "Context cleanup completed successfully" },
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      console.error("Error cleaning up session context:", error);
      const response: IApiResponse = {
        success: false,
        error: "Failed to clean up session context",
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(response);
    }
  },
);

export default router;
