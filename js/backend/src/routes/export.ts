import { Router, Request, Response } from "express";
import { z } from "zod";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import rateLimit from "express-rate-limit";
import {
  IApiResponse,
  ISession,
  safeValidateExportRequest,
  safeValidateDownloadRequest,
} from "../../../shared/dist/src/index.js";
import { getExportService } from "../services/export.service";

const router = Router();

// Monkey-patch flag
let isMonkeyPatched = false;

// Lazy initialization of export service to allow for proper mocking
function getService() {
  const service = getExportService();
  
  // Apply monkey patch if not already done
  if (!isMonkeyPatched && service) {
    (service as any).collectSessionData = collectSessionData;
    isMonkeyPatched = true;
  }
  
  return service;
}

// Rate limiting for export endpoints
const exportRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 export requests per windowMs
  message: {
    success: false,
    error: "Too many export requests, please try again later",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const downloadRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 download requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas for route parameters
const exportIdSchema = z.string().uuid();

// Helper function to find JSONL files recursively (from sessions.ts)
function findJsonlFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = fsSync.readdirSync(dir, { withFileTypes: true });

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

// Helper function to parse JSONL and extract sessions (from sessions.ts)
function parseSessionsFromJsonl(filePath: string): ISession[] {
  try {
    const content = fsSync.readFileSync(filePath, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line: string) => line.trim());

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

// Helper function to collect session data based on request
async function collectSessionData(request: any): Promise<ISession[]> {
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

  const allSessions: ISession[] = [];

  // Collect all sessions from available JSONL files
  for (const searchPath of searchPaths) {
    try {
      if (fsSync.existsSync(searchPath)) {
        const jsonlFiles = findJsonlFiles(searchPath);
        for (const file of jsonlFiles) {
          const sessions = parseSessionsFromJsonl(file);
          allSessions.push(...sessions);
        }
      }
    } catch (error) {
      console.warn(`Failed to read from ${searchPath}:`, error);
    }
  }

  // Filter sessions based on request criteria
  let filteredSessions = allSessions;

  if (request.sessionId) {
    filteredSessions = filteredSessions.filter(session => session.id === request.sessionId);
  } else if (request.sessionIds && request.sessionIds.length > 0) {
    filteredSessions = filteredSessions.filter(session => 
      request.sessionIds.includes(session.id)
    );
  } else if (request.projectName) {
    filteredSessions = filteredSessions.filter(session =>
      session.cwd.toLowerCase().includes(request.projectName.toLowerCase())
    );
  }

  // Apply date range filtering if specified
  if (request.options.dateRange) {
    if (request.options.dateRange.startDate) {
      const startDate = new Date(request.options.dateRange.startDate);
      filteredSessions = filteredSessions.filter(session => 
        new Date(session.firstTimestamp) >= startDate
      );
    }
    if (request.options.dateRange.endDate) {
      const endDate = new Date(request.options.dateRange.endDate);
      filteredSessions = filteredSessions.filter(session => 
        new Date(session.lastTimestamp) <= endDate
      );
    }
  }

  return filteredSessions;
}

// Monkey-patch implementation is handled in getService() function above

/**
 * GET /api/export/metrics - Get export service metrics
 */
router.get("/metrics", async (req: Request, res: Response) => {
  try {
    const metrics = getService().getExportMetrics();

    const response: IApiResponse = {
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching export metrics:", error);
    const response: IApiResponse = {
      success: false,
      error: "Failed to fetch export metrics",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/export/cleanup - Cleanup expired exports (admin endpoint)
 */
router.post("/cleanup", async (req: Request, res: Response) => {
  try {
    await getService().cleanupExpiredExports();

    const response: IApiResponse = {
      success: true,
      data: { message: "Cleanup completed successfully" },
      timestamp: new Date().toISOString(),
    };

    res.json(response);

  } catch (error) {
    console.error("Error during export cleanup:", error);
    const response: IApiResponse = {
      success: false,
      error: "Failed to cleanup exports",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/export - Create new export
 */
router.post("/", exportRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = safeValidateExportRequest(req.body);
    if (!validation.success) {
      const response: IApiResponse = {
        success: false,
        error: "Invalid export request",
        details: validation.error.flatten(),
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const exportRequest = validation.data;

    // Check if we can find any matching sessions before starting export
    const sessions = await collectSessionData(exportRequest);
    if (sessions.length === 0) {
      const response: IApiResponse = {
        success: false,
        error: "No matching sessions found for export criteria",
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    // Create export job
    const result = await getService().createExport(exportRequest);

    const response: IApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.status(202).json(response); // 202 Accepted - processing started

  } catch (error) {
    console.error("Error creating export:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const response: IApiResponse = {
      success: false,
      error: errorMessage.includes("Maximum concurrent") ? errorMessage : "Failed to create export",
      timestamp: new Date().toISOString(),
    };

    const statusCode = errorMessage.includes("Maximum concurrent") ? 429 : 500;
    res.status(statusCode).json(response);
  }
});

/**
 * GET /api/export/:exportId - Get export status
 */
router.get("/:exportId", async (req: Request, res: Response) => {
  try {
    const validation = exportIdSchema.safeParse(req.params.exportId);
    if (!validation.success) {
      const response: IApiResponse = {
        success: false,
        error: "Invalid export ID format",
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const exportId = validation.data;
    const status = getService().getExportStatus(exportId);

    if (!status) {
      const response: IApiResponse = {
        success: false,
        error: "Export not found",
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
    console.error("Error fetching export status:", error);
    const response: IApiResponse = {
      success: false,
      error: "Failed to fetch export status",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/export/:exportId/download - Download export file
 */
router.get("/:exportId/download", downloadRateLimit, async (req: Request, res: Response) => {
  try {
    const validation = exportIdSchema.safeParse(req.params.exportId);
    if (!validation.success) {
      const response: IApiResponse = {
        success: false,
        error: "Invalid export ID format",
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const exportId = validation.data;
    const token = req.query.token as string;

    if (!token) {
      const response: IApiResponse = {
        success: false,
        error: "Download token is required",
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    // Validate download request
    const downloadValidation = safeValidateDownloadRequest({ exportId, token });
    if (!downloadValidation.success) {
      const response: IApiResponse = {
        success: false,
        error: "Invalid download request",
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const status = getService().getExportStatus(exportId);

    if (!status) {
      const response: IApiResponse = {
        success: false,
        error: "Export not found",
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    if (status.status !== "completed" || !status.result) {
      const response: IApiResponse = {
        success: false,
        error: "Export not ready for download",
        timestamp: new Date().toISOString(),
      };
      return res.status(409).json(response); // 409 Conflict
    }

    // Verify token matches
    if (status.result.downloadToken !== token) {
      const response: IApiResponse = {
        success: false,
        error: "Invalid download token",
        timestamp: new Date().toISOString(),
      };
      return res.status(403).json(response);
    }

    // Check if export has expired
    if (status.result.expiresAt && new Date() > new Date(status.result.expiresAt)) {
      const response: IApiResponse = {
        success: false,
        error: "Download link has expired",
        timestamp: new Date().toISOString(),
      };
      return res.status(410).json(response); // 410 Gone
    }

    // Get file path and check if it exists
    const tempDir = path.join(process.cwd(), "temp", "exports");
    const filePath = path.join(tempDir, status.result.filename);

    try {
      await fs.access(filePath);
    } catch {
      const response: IApiResponse = {
        success: false,
        error: "Export file no longer available",
        timestamp: new Date().toISOString(),
      };
      return res.status(410).json(response);
    }

    // Set appropriate headers
    const mimeTypes: Record<string, string> = {
      html: "text/html",
      markdown: "text/markdown",
      json: "application/json",
      pdf: "application/pdf",
    };

    const contentType = mimeTypes[status.result.format] || "application/octet-stream";
    
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${status.result.filename}"`);
    res.setHeader("Content-Length", status.result.size);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    // Stream the file
    const fileStream = fsSync.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("error", (error: Error) => {
      console.error("Error streaming export file:", error);
      if (!res.headersSent) {
        const response: IApiResponse = {
          success: false,
          error: "Failed to stream export file",
          timestamp: new Date().toISOString(),
        };
        res.status(500).json(response);
      }
    });

  } catch (error) {
    console.error("Error downloading export:", error);
    const response: IApiResponse = {
      success: false,
      error: "Failed to download export",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/export/:exportId - Cancel or delete export
 */
router.delete("/:exportId", async (req: Request, res: Response) => {
  try {
    const validation = exportIdSchema.safeParse(req.params.exportId);
    if (!validation.success) {
      const response: IApiResponse = {
        success: false,
        error: "Invalid export ID format",
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const exportId = validation.data;
    const status = getService().getExportStatus(exportId);

    if (!status) {
      const response: IApiResponse = {
        success: false,
        error: "Export not found",
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    // For now, we'll just mark as cancelled (could implement actual cancellation)
    if (status.status === "processing") {
      // Could implement cancellation logic here
      console.log(`Export ${exportId} cancellation requested`);
    }

    const response: IApiResponse = {
      success: true,
      data: { message: "Export deletion requested" },
      timestamp: new Date().toISOString(),
    };

    res.json(response);

  } catch (error) {
    console.error("Error deleting export:", error);
    const response: IApiResponse = {
      success: false,
      error: "Failed to delete export",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

export default router;