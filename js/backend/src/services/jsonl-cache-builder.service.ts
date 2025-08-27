import fs from "fs/promises";
import path from "path";
import { EventEmitter } from "events";
import {
  loadTranscriptAsync,
  findJsonlFiles,
  extractTextContent,
  ParserOptions,
} from "../parsers/jsonl-parser";
import {
  ITranscriptEntry,
  IUserTranscriptEntry,
  IAssistantTranscriptEntry,
} from "../../../shared/src/interfaces";
import {
  ProjectCache,
  SessionCacheData,
  CachedFileInfo,
  CACHE_FORMAT_VERSION,
} from "../utils/cache";
import { getCacheDirectoryService } from "./cache-directory.service";
import { getFileModificationService } from "./file-modification.service";

export interface CacheBuildOptions {
  forceRebuild?: boolean;
  incrementalMode?: boolean;
  parallelProcessing?: boolean;
  maxParallelFiles?: number;
  chunkSize?: number;
  includeSystemMessages?: boolean;
  includeSummaries?: boolean;
}

export interface CacheBuildResult {
  success: boolean;
  projectPath: string;
  filesProcessed: number;
  entriesProcessed: number;
  sessionsCreated: number;
  totalTokens: number;
  buildTimeMs: number;
  errors: string[];
  skippedFiles: string[];
}

export interface CacheBuildEvent {
  type:
    | "build_started"
    | "file_processing"
    | "session_created"
    | "build_completed"
    | "build_error";
  projectPath: string;
  timestamp: string;
  metadata?: any;
}

export interface StreamingBuildProgress {
  currentFile: string;
  filesCompleted: number;
  totalFiles: number;
  entriesProcessed: number;
  sessionsFound: number;
  memoryUsageMB: number;
}

export class JsonlCacheBuilderService extends EventEmitter {
  private static instance: JsonlCacheBuilderService | null = null;
  private buildInProgress = false;
  private readonly DEFAULT_CHUNK_SIZE = 1000;
  private readonly MAX_MEMORY_MB = 512;

  constructor() {
    super();
  }

  public static getInstance(): JsonlCacheBuilderService {
    if (!JsonlCacheBuilderService.instance) {
      JsonlCacheBuilderService.instance = new JsonlCacheBuilderService();
    }
    return JsonlCacheBuilderService.instance;
  }

  /**
   * Builds cache for a project from JSONL files
   */
  public async buildCache(
    projectPath: string,
    options: CacheBuildOptions = {},
  ): Promise<CacheBuildResult> {
    if (this.buildInProgress) {
      throw new Error("Cache build already in progress");
    }

    this.buildInProgress = true;
    const startTime = Date.now();

    const result: CacheBuildResult = {
      success: false,
      projectPath,
      filesProcessed: 0,
      entriesProcessed: 0,
      sessionsCreated: 0,
      totalTokens: 0,
      buildTimeMs: 0,
      errors: [],
      skippedFiles: [],
    };

    try {
      this.emit("cacheBuildEvent", {
        type: "build_started",
        projectPath,
        timestamp: new Date().toISOString(),
        metadata: { options },
      } as CacheBuildEvent);

      // Discover JSONL files
      const jsonlFiles = findJsonlFiles(projectPath);
      if (jsonlFiles.length === 0) {
        result.errors.push("No JSONL files found in project directory");
        return result;
      }

      // Determine which files need processing
      const filesToProcess = await this.getFilesToProcess(
        projectPath,
        jsonlFiles,
        options,
      );

      // Create or ensure cache directory exists
      const cacheDirectoryService = getCacheDirectoryService();
      await cacheDirectoryService.createCacheDirectory(projectPath);

      let projectCache: ProjectCache;

      if (options.incrementalMode && !options.forceRebuild) {
        // Load existing cache and update incrementally
        projectCache = await this.loadExistingCache(projectPath);
      } else {
        // Create new cache
        projectCache = this.createEmptyCache(projectPath);
      }

      // Process files
      if (options.parallelProcessing && filesToProcess.length > 1) {
        await this.processFilesParallel(
          filesToProcess,
          projectCache,
          options,
          result,
        );
      } else {
        await this.processFilesSequential(
          filesToProcess,
          projectCache,
          options,
          result,
        );
      }

      // Finalize cache data
      await this.finalizeCache(projectPath, projectCache);

      result.success = true;
      result.buildTimeMs = Date.now() - startTime;

      this.emit("cacheBuildEvent", {
        type: "build_completed",
        projectPath,
        timestamp: new Date().toISOString(),
        metadata: {
          filesProcessed: result.filesProcessed,
          entriesProcessed: result.entriesProcessed,
          sessionsCreated: result.sessionsCreated,
          buildTimeMs: result.buildTimeMs,
        },
      } as CacheBuildEvent);

      return result;
    } catch (error) {
      result.errors.push(`Build error: ${error}`);

      this.emit("cacheBuildEvent", {
        type: "build_error",
        projectPath,
        timestamp: new Date().toISOString(),
        metadata: { error: String(error) },
      } as CacheBuildEvent);

      return result;
    } finally {
      this.buildInProgress = false;
    }
  }

  /**
   * Determines which files need processing based on modification times
   */
  private async getFilesToProcess(
    projectPath: string,
    allFiles: string[],
    options: CacheBuildOptions,
  ): Promise<string[]> {
    if (options.forceRebuild) {
      return allFiles;
    }

    const fileModificationService = getFileModificationService();
    const filesToProcess: string[] = [];

    for (const filePath of allFiles) {
      try {
        // Track file for modification detection
        await fileModificationService.trackFile(filePath);

        // Check if file needs processing
        const stats = await fs.stat(filePath);
        const relativePath = path.relative(projectPath, filePath);

        // For incremental mode, check if file was modified
        if (options.incrementalMode) {
          const needsUpdate = fileModificationService.needsCacheInvalidation(
            filePath,
            stats.mtime.getTime(),
          );

          if (needsUpdate) {
            filesToProcess.push(filePath);
          }
        } else {
          filesToProcess.push(filePath);
        }
      } catch (error) {
        console.warn(`Error checking file ${filePath}:`, error);
        filesToProcess.push(filePath); // Process it anyway to be safe
      }
    }

    return filesToProcess;
  }

  /**
   * Processes files sequentially with streaming
   */
  private async processFilesSequential(
    filesToProcess: string[],
    projectCache: ProjectCache,
    options: CacheBuildOptions,
    result: CacheBuildResult,
  ): Promise<void> {
    for (let i = 0; i < filesToProcess.length; i++) {
      const filePath = filesToProcess[i];

      this.emit("cacheBuildEvent", {
        type: "file_processing",
        projectPath: projectCache.project_path,
        timestamp: new Date().toISOString(),
        metadata: {
          filePath,
          progress: {
            current: i + 1,
            total: filesToProcess.length,
          },
        },
      } as CacheBuildEvent);

      try {
        await this.processFileStreaming(
          filePath,
          projectCache,
          options,
          result,
        );
        result.filesProcessed++;
      } catch (error) {
        result.errors.push(`Error processing ${filePath}: ${error}`);
        result.skippedFiles.push(filePath);
      }

      // Memory management
      if (this.getMemoryUsageMB() > this.MAX_MEMORY_MB) {
        if (global.gc) {
          global.gc();
        }
      }
    }
  }

  /**
   * Processes files in parallel for better performance
   */
  private async processFilesParallel(
    filesToProcess: string[],
    projectCache: ProjectCache,
    options: CacheBuildOptions,
    result: CacheBuildResult,
  ): Promise<void> {
    const maxParallel =
      options.maxParallelFiles || Math.min(4, filesToProcess.length);
    const chunks = this.chunkArray(filesToProcess, maxParallel);

    for (const chunk of chunks) {
      const promises = chunk.map(async (filePath) => {
        try {
          await this.processFileStreaming(
            filePath,
            projectCache,
            options,
            result,
          );
          result.filesProcessed++;
        } catch (error) {
          result.errors.push(`Error processing ${filePath}: ${error}`);
          result.skippedFiles.push(filePath);
        }
      });

      await Promise.allSettled(promises);
    }
  }

  /**
   * Processes a single file using streaming for memory efficiency
   */
  private async processFileStreaming(
    filePath: string,
    projectCache: ProjectCache,
    options: CacheBuildOptions,
    result: CacheBuildResult,
  ): Promise<void> {
    const parserOptions: ParserOptions = {
      silent: true,
      skipMalformed: true,
      maxErrors: 50,
    };

    const parseResult = await loadTranscriptAsync(filePath, parserOptions);

    if (parseResult.errors.length > 0) {
      result.errors.push(
        `Parse errors in ${filePath}: ${parseResult.errors.length} errors`,
      );
    }

    // Update file info in cache
    const stats = await fs.stat(filePath);
    const relativePath = path.relative(projectCache.project_path, filePath);

    const fileInfo: CachedFileInfo = {
      file_path: relativePath,
      source_mtime: stats.mtime.getTime(),
      cached_mtime: Date.now(),
      message_count: parseResult.entries.length,
      session_ids: this.extractSessionIds(parseResult.entries),
    };

    projectCache.cached_files[relativePath] = fileInfo;

    // Process entries in chunks for memory efficiency
    const chunks = this.chunkArray(
      parseResult.entries,
      options.chunkSize || this.DEFAULT_CHUNK_SIZE,
    );

    for (const chunk of chunks) {
      await this.processEntryChunk(chunk, projectCache, options, result);
    }
  }

  /**
   * Processes a chunk of transcript entries
   */
  private async processEntryChunk(
    entries: ITranscriptEntry[],
    projectCache: ProjectCache,
    options: CacheBuildOptions,
    result: CacheBuildResult,
  ): Promise<void> {
    const sessionsMap = new Map<string, SessionCacheData>();

    for (const entry of entries) {
      result.entriesProcessed++;

      // Skip system messages if not requested
      if (entry.type === "system" && !options.includeSystemMessages) {
        continue;
      }

      // Skip summaries if not requested
      if (entry.type === "summary" && !options.includeSummaries) {
        continue;
      }

      // Process session data
      if ("sessionId" in entry && entry.sessionId) {
        const sessionId = entry.sessionId;

        if (!sessionsMap.has(sessionId)) {
          sessionsMap.set(sessionId, this.createSessionCacheData(sessionId));
        }

        const sessionData = sessionsMap.get(sessionId)!;
        this.updateSessionWithEntry(sessionData, entry);
      }
    }

    // Merge sessions into project cache
    for (const [sessionId, sessionData] of sessionsMap) {
      if (projectCache.sessions[sessionId]) {
        // Merge with existing session data
        this.mergeSessionData(projectCache.sessions[sessionId], sessionData);
      } else {
        // Add new session
        projectCache.sessions[sessionId] = sessionData;
        result.sessionsCreated++;

        this.emit("cacheBuildEvent", {
          type: "session_created",
          projectPath: projectCache.project_path,
          timestamp: new Date().toISOString(),
          metadata: { sessionId, entryCount: sessionData.message_count },
        } as CacheBuildEvent);
      }
    }
  }

  /**
   * Creates initial session cache data
   */
  private createSessionCacheData(sessionId: string): SessionCacheData {
    const now = new Date().toISOString();

    return {
      session_id: sessionId,
      summary: "",
      first_timestamp: now,
      last_timestamp: now,
      message_count: 0,
      first_user_message: "",
      cwd: "",
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cache_creation_tokens: 0,
      total_cache_read_tokens: 0,
    };
  }

  /**
   * Updates session data with a transcript entry
   */
  private updateSessionWithEntry(
    sessionData: SessionCacheData,
    entry: ITranscriptEntry,
  ): void {
    if ("timestamp" in entry && entry.timestamp) {
      if (
        !sessionData.first_timestamp ||
        entry.timestamp < sessionData.first_timestamp
      ) {
        sessionData.first_timestamp = entry.timestamp;
      }
      if (
        !sessionData.last_timestamp ||
        entry.timestamp > sessionData.last_timestamp
      ) {
        sessionData.last_timestamp = entry.timestamp;
      }
    }

    if ("cwd" in entry && entry.cwd && !sessionData.cwd) {
      sessionData.cwd = entry.cwd;
    }

    sessionData.message_count++;

    // Extract token usage information
    if (entry.type === "assistant") {
      const assistantEntry = entry as IAssistantTranscriptEntry;
      if (assistantEntry.message.usage) {
        const usage = assistantEntry.message.usage;
        sessionData.total_input_tokens += usage.input_tokens || 0;
        sessionData.total_output_tokens += usage.output_tokens || 0;
        sessionData.total_cache_creation_tokens +=
          usage.cache_creation_input_tokens || 0;
        sessionData.total_cache_read_tokens +=
          usage.cache_read_input_tokens || 0;
      }
    }

    // Capture first user message for preview
    if (entry.type === "user" && !sessionData.first_user_message) {
      const userEntry = entry as IUserTranscriptEntry;
      sessionData.first_user_message = extractTextContent(
        userEntry.message.content,
      );
    }
  }

  /**
   * Merges two session cache data objects
   */
  private mergeSessionData(
    existing: SessionCacheData,
    incoming: SessionCacheData,
  ): void {
    // Update timestamps
    if (incoming.first_timestamp < existing.first_timestamp) {
      existing.first_timestamp = incoming.first_timestamp;
    }
    if (incoming.last_timestamp > existing.last_timestamp) {
      existing.last_timestamp = incoming.last_timestamp;
    }

    // Add counts and tokens
    existing.message_count += incoming.message_count;
    existing.total_input_tokens += incoming.total_input_tokens;
    existing.total_output_tokens += incoming.total_output_tokens;
    existing.total_cache_creation_tokens +=
      incoming.total_cache_creation_tokens;
    existing.total_cache_read_tokens += incoming.total_cache_read_tokens;

    // Update first user message if not set
    if (!existing.first_user_message && incoming.first_user_message) {
      existing.first_user_message = incoming.first_user_message;
    }

    // Update cwd if not set
    if (!existing.cwd && incoming.cwd) {
      existing.cwd = incoming.cwd;
    }
  }

  /**
   * Extracts unique session IDs from entries
   */
  private extractSessionIds(entries: ITranscriptEntry[]): string[] {
    const sessionIds = new Set<string>();

    for (const entry of entries) {
      if ("sessionId" in entry && entry.sessionId) {
        sessionIds.add(entry.sessionId);
      }
    }

    return Array.from(sessionIds);
  }

  /**
   * Loads existing cache or creates empty one
   */
  private async loadExistingCache(projectPath: string): Promise<ProjectCache> {
    try {
      const cachePath = path.join(projectPath, ".cache", "index.json");
      const content = await fs.readFile(cachePath, "utf-8");
      const existingCache = JSON.parse(content) as ProjectCache;

      // Update last_updated timestamp
      existingCache.last_updated = new Date().toISOString();

      return existingCache;
    } catch (error) {
      // Cache doesn't exist or is invalid, create new one
      return this.createEmptyCache(projectPath);
    }
  }

  /**
   * Creates an empty cache structure
   */
  private createEmptyCache(projectPath: string): ProjectCache {
    const now = new Date().toISOString();

    return {
      version: CACHE_FORMAT_VERSION,
      cache_created: now,
      last_updated: now,
      project_path: projectPath,
      cached_files: {},
      total_message_count: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cache_creation_tokens: 0,
      total_cache_read_tokens: 0,
      sessions: {},
      working_directories: [projectPath],
      earliest_timestamp: now,
      latest_timestamp: now,
    };
  }

  /**
   * Finalizes cache data and writes to disk
   */
  private async finalizeCache(
    projectPath: string,
    projectCache: ProjectCache,
  ): Promise<void> {
    // Calculate totals
    projectCache.total_message_count = 0;
    projectCache.total_input_tokens = 0;
    projectCache.total_output_tokens = 0;
    projectCache.total_cache_creation_tokens = 0;
    projectCache.total_cache_read_tokens = 0;

    let earliestTimestamp = new Date().toISOString();
    let latestTimestamp = new Date(0).toISOString();

    for (const sessionData of Object.values(projectCache.sessions)) {
      projectCache.total_message_count += sessionData.message_count;
      projectCache.total_input_tokens += sessionData.total_input_tokens;
      projectCache.total_output_tokens += sessionData.total_output_tokens;
      projectCache.total_cache_creation_tokens +=
        sessionData.total_cache_creation_tokens;
      projectCache.total_cache_read_tokens +=
        sessionData.total_cache_read_tokens;

      if (sessionData.first_timestamp < earliestTimestamp) {
        earliestTimestamp = sessionData.first_timestamp;
      }
      if (sessionData.last_timestamp > latestTimestamp) {
        latestTimestamp = sessionData.last_timestamp;
      }
    }

    projectCache.earliest_timestamp = earliestTimestamp;
    projectCache.latest_timestamp = latestTimestamp;
    projectCache.last_updated = new Date().toISOString();

    // Write cache to disk
    const cachePath = path.join(projectPath, ".cache", "index.json");
    await this.atomicWriteJson(cachePath, projectCache);
  }

  /**
   * Atomic write operation for cache files
   */
  private async atomicWriteJson(filePath: string, data: any): Promise<void> {
    const tempPath = `${filePath}.tmp`;

    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
      await fs.rename(tempPath, filePath);
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Utility methods
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private getMemoryUsageMB(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024;
  }

  /**
   * Gets build status and progress information
   */
  public getBuildStatus(): { inProgress: boolean; memoryUsageMB: number } {
    return {
      inProgress: this.buildInProgress,
      memoryUsageMB: this.getMemoryUsageMB(),
    };
  }

  /**
   * Cancels current build operation
   */
  public cancelBuild(): void {
    this.buildInProgress = false;
  }

  /**
   * Shuts down the service and cleans up resources
   */
  public async shutdown(): Promise<void> {
    this.buildInProgress = false;
    this.removeAllListeners();
  }
}

// Singleton instance getter
export function getJsonlCacheBuilderService(): JsonlCacheBuilderService {
  return JsonlCacheBuilderService.getInstance();
}
