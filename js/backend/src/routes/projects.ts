import { Router, Request, Response } from "express";
import { IApiResponse, IProject, ISession } from "../../../shared/dist/src/index.js";
import fs from "fs";
import path from "path";
// Remove unused imports

const router = Router();

// Helper function to find JSONL files recursively
function findJsonlFiles(dir: string, visited = new Set<string>()): string[] {
  const files: string[] = [];

  try {
    // Resolve symbolic links to check for circular references
    const realPath = fs.realpathSync(dir);

    // Check if we've already visited this directory (prevents infinite recursion)
    if (visited.has(realPath)) {
      return files;
    }
    visited.add(realPath);

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        files.push(...findJsonlFiles(fullPath, visited));
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

// Helper function to extract project name from path
function getProjectName(cwd: string): string {
  // Handle both Unix and Windows path separators
  const segments = cwd.split(/[/\\]/).filter((s) => s);
  return segments[segments.length - 1] || "Unknown";
}

// GET /api/projects - List all unique projects from sessions
router.get("/", async (req: Request, res: Response) => {
  try {
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

    const allSessions: ISession[] = [];

    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        const jsonlFiles = findJsonlFiles(searchPath);
        for (const file of jsonlFiles) {
          const sessions = parseSessionsFromJsonl(file);
          allSessions.push(...sessions);
        }
      }
    }

    // Group sessions by project path
    const projectMap = new Map<string, IProject>();

    for (const session of allSessions) {
      const projectPath = session.cwd;
      const projectName = getProjectName(projectPath);

      if (!projectMap.has(projectPath)) {
        projectMap.set(projectPath, {
          name: projectName,
          path: projectPath,
          sessions: [],
          totalMessages: 0,
          totalTokens: 0,
        });
      }

      const project = projectMap.get(projectPath)!;
      project.sessions.push(session);
      project.totalMessages += session.entries.length;
      project.totalTokens +=
        (session.totalUsage.input_tokens || 0) +
        (session.totalUsage.output_tokens || 0);
    }

    // Convert to array and sort by total activity
    const projects = Array.from(projectMap.values()).sort(
      (a, b) => b.totalMessages - a.totalMessages,
    );

    const response: IApiResponse = {
      success: true,
      data: {
        projects,
        totalProjects: projects.length,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching projects:", error);
    const response: IApiResponse = {
      success: false,
      error: "Failed to fetch projects",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// GET /api/projects/by-path/:encodedPath - Get specific project details
router.get("/by-path/:encodedPath", async (req: Request, res: Response) => {
  try {
    const projectPath = decodeURIComponent(req.params.encodedPath);

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

    const allSessions: ISession[] = [];

    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        const jsonlFiles = findJsonlFiles(searchPath);
        for (const file of jsonlFiles) {
          const sessions = parseSessionsFromJsonl(file);
          allSessions.push(...sessions);
        }
      }
    }

    // Filter sessions for this project
    const projectSessions = allSessions.filter(
      (session) => session.cwd === projectPath,
    );

    if (projectSessions.length === 0) {
      const response: IApiResponse = {
        success: false,
        error: "Project not found",
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    const project: IProject = {
      name: getProjectName(projectPath),
      path: projectPath,
      sessions: projectSessions.sort(
        (a, b) =>
          new Date(b.lastTimestamp).getTime() -
          new Date(a.lastTimestamp).getTime(),
      ),
      totalMessages: projectSessions.reduce(
        (sum, session) => sum + session.entries.length,
        0,
      ),
      totalTokens: projectSessions.reduce(
        (sum, session) =>
          sum +
          (session.totalUsage.input_tokens || 0) +
          (session.totalUsage.output_tokens || 0),
        0,
      ),
    };

    const response: IApiResponse = {
      success: true,
      data: project,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching project:", error);
    const response: IApiResponse = {
      success: false,
      error: "Failed to fetch project",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

export default router;
