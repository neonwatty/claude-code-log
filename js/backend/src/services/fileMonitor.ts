import chokidar from "chokidar";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { getWebSocketManager } from "../websocket/server";

export interface IFileChangeEvent {
  type: "created" | "modified" | "deleted";
  filePath: string;
  timestamp: string;
}

export interface ISessionChangeEvent {
  type: "session_created" | "session_updated" | "session_deleted";
  sessionId: string;
  cwd?: string;
  entryCount?: number;
  timestamp: string;
}

export class FileMonitor extends EventEmitter {
  private watchers: any[] = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastFileStates: Map<string, { size: number; mtime: number }> =
    new Map();
  private isActive = false;
  private readonly DEBOUNCE_DELAY = 1000; // 1 second debounce

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on("fileChanged", this.handleFileChange.bind(this));
    this.on("sessionChanged", this.handleSessionChange.bind(this));
  }

  public start(paths?: string[]): void {
    if (this.isActive) {
      console.warn("File monitor is already active");
      return;
    }

    const watchPaths = paths || this.getDefaultWatchPaths();

    for (const watchPath of watchPaths) {
      if (fs.existsSync(watchPath)) {
        this.startWatching(watchPath);
      } else {
        console.warn(`Watch path does not exist: ${watchPath}`);
      }
    }

    this.isActive = true;
    console.log(`File monitor started, watching ${this.watchers.length} paths`);
  }

  private getDefaultWatchPaths(): string[] {
    const paths = [
      process.cwd(),
      path.join(process.cwd(), "logs"),
      path.join(process.cwd(), ".."),
    ];

    // Add common Claude Code directories
    if (process.env.HOME) {
      paths.push(
        path.join(process.env.HOME, ".config", "claude-code"),
        path.join(
          process.env.HOME,
          "Library",
          "Application Support",
          "claude-code",
        ),
      );
    }

    return paths;
  }

  private startWatching(watchPath: string): void {
    try {
      const watcher = chokidar.watch("**/*.jsonl", {
        cwd: watchPath,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100,
        },
      });

      watcher.on("add", (filePath) => {
        const fullPath = path.resolve(watchPath, filePath);
        this.debouncedFileChange("created", fullPath);
      });

      watcher.on("change", (filePath) => {
        const fullPath = path.resolve(watchPath, filePath);
        this.debouncedFileChange("modified", fullPath);
      });

      watcher.on("unlink", (filePath) => {
        const fullPath = path.resolve(watchPath, filePath);
        this.debouncedFileChange("deleted", fullPath);
      });

      watcher.on("error", (error: any) => {
        console.error(`Watcher error for ${watchPath}:`, error);
      });

      this.watchers.push(watcher);
      console.log(`Started watching: ${watchPath}`);
    } catch (error) {
      console.error(`Failed to start watching ${watchPath}:`, error);
    }
  }

  private debouncedFileChange(
    type: "created" | "modified" | "deleted",
    filePath: string,
  ): void {
    // Clear existing debounce timer for this file
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.processFileChange(type, filePath);
    }, this.DEBOUNCE_DELAY);

    this.debounceTimers.set(filePath, timer);
  }

  private processFileChange(
    type: "created" | "modified" | "deleted",
    filePath: string,
  ): void {
    try {
      // Check if file actually changed for modified events
      if (type === "modified") {
        if (!this.hasFileActuallyChanged(filePath)) {
          return;
        }
      }

      console.log(`File ${type}: ${filePath}`);

      const event: IFileChangeEvent = {
        type,
        filePath,
        timestamp: new Date().toISOString(),
      };

      this.emit("fileChanged", event);

      // Parse JSONL file for session changes
      if (type !== "deleted") {
        this.parseJsonlForSessionChanges(filePath);
      }
    } catch (error) {
      console.error(`Error processing file change for ${filePath}:`, error);
    }
  }

  private hasFileActuallyChanged(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      const currentState = {
        size: stats.size,
        mtime: stats.mtime.getTime(),
      };

      const lastState = this.lastFileStates.get(filePath);

      if (
        !lastState ||
        lastState.size !== currentState.size ||
        lastState.mtime !== currentState.mtime
      ) {
        this.lastFileStates.set(filePath, currentState);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error checking file state for ${filePath}:`, error);
      return true; // Assume changed if we can't read stats
    }
  }

  private parseJsonlForSessionChanges(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      if (lines.length === 0) return;

      const sessionSummary = new Map<
        string,
        {
          sessionId: string;
          cwd: string;
          entryCount: number;
          lastTimestamp: string;
          isNew: boolean;
        }
      >();

      // Parse all entries to get session summaries
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const sessionId = entry.sessionId;

          if (sessionId) {
            if (!sessionSummary.has(sessionId)) {
              sessionSummary.set(sessionId, {
                sessionId,
                cwd: entry.cwd || "",
                entryCount: 0,
                lastTimestamp: entry.timestamp,
                isNew: true,
              });
            }

            const summary = sessionSummary.get(sessionId)!;
            summary.entryCount++;
            summary.lastTimestamp = entry.timestamp;

            // If we see multiple entries, it's likely an update, not a new session
            if (summary.entryCount > 1) {
              summary.isNew = false;
            }
          }
        } catch (parseError) {
          console.warn(`Error parsing line in ${filePath}:`, parseError);
        }
      }

      // Emit session change events
      for (const summary of sessionSummary.values()) {
        const event: ISessionChangeEvent = {
          type: summary.isNew ? "session_created" : "session_updated",
          sessionId: summary.sessionId,
          cwd: summary.cwd,
          entryCount: summary.entryCount,
          timestamp: new Date().toISOString(),
        };

        this.emit("sessionChanged", event);
      }
    } catch (error) {
      console.error(`Error parsing JSONL file ${filePath}:`, error);
    }
  }

  private handleFileChange(event: IFileChangeEvent): void {
    try {
      const wsManager = getWebSocketManager();
      wsManager.broadcastFileChanged(event.filePath, event.type);
    } catch (error) {
      console.error("Error handling file change:", error);
    }
  }

  private handleSessionChange(event: ISessionChangeEvent): void {
    try {
      const wsManager = getWebSocketManager();

      switch (event.type) {
        case "session_created":
          wsManager.broadcastSessionCreated(event.sessionId, event.cwd || "");
          break;
        case "session_updated":
          wsManager.broadcastSessionUpdated(
            event.sessionId,
            event.cwd || "",
            event.entryCount || 0,
          );
          break;
        case "session_deleted":
          wsManager.broadcastSessionDeleted(event.sessionId);
          break;
      }
    } catch (error) {
      console.error("Error handling session change:", error);
    }
  }

  public stop(): void {
    if (!this.isActive) {
      return;
    }

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close all watchers
    for (const watcher of this.watchers) {
      watcher.close().catch((error: any) => {
        console.error("Error closing watcher:", error);
      });
    }
    this.watchers = [];

    this.isActive = false;
    this.lastFileStates.clear();
    console.log("File monitor stopped");
  }

  public getStatus(): {
    isActive: boolean;
    watcherCount: number;
    monitoredFiles: number;
  } {
    return {
      isActive: this.isActive,
      watcherCount: this.watchers.length,
      monitoredFiles: this.lastFileStates.size,
    };
  }
}

// Singleton instance
let fileMonitor: FileMonitor | null = null;

export function getFileMonitor(): FileMonitor {
  if (!fileMonitor) {
    fileMonitor = new FileMonitor();
  }
  return fileMonitor;
}

export function createFileMonitor(): FileMonitor {
  if (fileMonitor) {
    fileMonitor.stop();
  }
  fileMonitor = new FileMonitor();
  return fileMonitor;
}
