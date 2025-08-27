import fs from "fs/promises";
import path from "path";
import { EventEmitter } from "events";
import { ProjectCache, SessionCacheData } from "../utils/cache";
import { getCacheDirectoryService } from "./cache-directory.service";
import { getFileModificationService } from "./file-modification.service";
import { getCacheValidationService } from "./cache-validation.service";
import { getJsonlCacheBuilderService } from "./jsonl-cache-builder.service";

export interface InvalidationRule {
  type: "file_modification" | "age_based" | "dependency" | "manual";
  priority: "high" | "medium" | "low";
  condition: any;
  action: "rebuild" | "remove" | "update" | "warm";
}

export interface InvalidationEvent {
  type:
    | "invalidation_triggered"
    | "cache_updated"
    | "cache_warmed"
    | "dependencies_cascaded";
  projectPath: string;
  timestamp: string;
  metadata?: any;
}

export interface CacheUpdateResult {
  success: boolean;
  projectPath: string;
  updatedFiles: string[];
  invalidatedSessions: string[];
  rebuiltSessions: string[];
  removedEntries: string[];
  updateTimeMs: number;
  errors: string[];
}

export interface DependencyMap {
  [filePath: string]: {
    dependsOn: string[];
    dependents: string[];
    lastModified: number;
    cacheKeys: string[];
  };
}

export interface CacheWarmingStrategy {
  type: "frequency_based" | "recency_based" | "size_based" | "manual";
  threshold: number;
  maxItems: number;
  enabled: boolean;
}

export interface ExpirationPolicy {
  maxAge: number; // milliseconds
  maxIdleTime: number; // milliseconds
  maxSize: number; // number of entries
  enabled: boolean;
}

export class CacheInvalidationService extends EventEmitter {
  private static instance: CacheInvalidationService | null = null;
  private invalidationRules: Map<string, InvalidationRule[]> = new Map();
  private dependencyMaps: Map<string, DependencyMap> = new Map();
  private accessPatterns: Map<
    string,
    { count: number; lastAccess: number; totalSize: number }
  > = new Map();
  private warmingStrategies: CacheWarmingStrategy[] = [];
  private expirationPolicies: ExpirationPolicy[] = [];
  private invalidationInProgress = false;

  constructor() {
    super();
    this.initializeDefaultPolicies();
  }

  public static getInstance(): CacheInvalidationService {
    if (!CacheInvalidationService.instance) {
      CacheInvalidationService.instance = new CacheInvalidationService();
    }
    return CacheInvalidationService.instance;
  }

  /**
   * Initialize default invalidation and warming policies
   */
  private initializeDefaultPolicies(): void {
    // Default expiration policy: 7 days max age, 1 day idle time
    this.expirationPolicies.push({
      maxAge: 7 * 24 * 60 * 60 * 1000,
      maxIdleTime: 24 * 60 * 60 * 1000,
      maxSize: 1000,
      enabled: true,
    });

    // Default warming strategy: frequency-based for top 50 most accessed items
    this.warmingStrategies.push({
      type: "frequency_based",
      threshold: 5,
      maxItems: 50,
      enabled: true,
    });
  }

  /**
   * Registers cache invalidation rules for a project
   */
  public registerInvalidationRules(
    projectPath: string,
    rules: InvalidationRule[],
  ): void {
    this.invalidationRules.set(projectPath, rules);
  }

  /**
   * Checks for cache invalidation needs and triggers updates
   */
  public async checkAndInvalidate(
    projectPath: string,
  ): Promise<CacheUpdateResult> {
    if (this.invalidationInProgress) {
      throw new Error("Cache invalidation already in progress");
    }

    this.invalidationInProgress = true;
    const startTime = Date.now();

    const result: CacheUpdateResult = {
      success: false,
      projectPath,
      updatedFiles: [],
      invalidatedSessions: [],
      rebuiltSessions: [],
      removedEntries: [],
      updateTimeMs: 0,
      errors: [],
    };

    try {
      this.emit("invalidationEvent", {
        type: "invalidation_triggered",
        projectPath,
        timestamp: new Date().toISOString(),
      } as InvalidationEvent);

      // Load current cache
      const cache = await this.loadProjectCache(projectPath);
      if (!cache) {
        result.errors.push("Failed to load project cache");
        return result;
      }

      // Check file modifications
      const modificationResults = await this.checkFileModifications(
        projectPath,
        cache,
      );
      result.updatedFiles = modificationResults.modifiedFiles;

      // Apply expiration policies
      const expirationResults = await this.applyExpirationPolicies(
        projectPath,
        cache,
      );
      result.removedEntries = expirationResults.removedEntries;

      // Handle dependency cascading
      const dependencyResults = await this.handleDependencyCascading(
        projectPath,
        modificationResults.modifiedFiles,
      );
      result.invalidatedSessions.push(...dependencyResults.affectedSessions);

      // Perform selective cache updates
      if (result.updatedFiles.length > 0 || result.removedEntries.length > 0) {
        const updateResults = await this.performSelectiveUpdate(
          projectPath,
          result.updatedFiles,
          result.invalidatedSessions,
        );
        result.rebuiltSessions = updateResults.rebuiltSessions;
        result.errors.push(...updateResults.errors);
      }

      // Apply cache warming strategies
      await this.applyCacheWarming(projectPath, cache);

      result.success = result.errors.length === 0;
      result.updateTimeMs = Date.now() - startTime;

      this.emit("invalidationEvent", {
        type: "cache_updated",
        projectPath,
        timestamp: new Date().toISOString(),
        metadata: {
          updatedFiles: result.updatedFiles.length,
          invalidatedSessions: result.invalidatedSessions.length,
          rebuiltSessions: result.rebuiltSessions.length,
          updateTimeMs: result.updateTimeMs,
        },
      } as InvalidationEvent);

      return result;
    } catch (error) {
      result.errors.push(`Invalidation error: ${error}`);
      return result;
    } finally {
      this.invalidationInProgress = false;
    }
  }

  /**
   * Checks for file modifications since last cache update
   */
  private async checkFileModifications(
    projectPath: string,
    cache: ProjectCache,
  ): Promise<{
    modifiedFiles: string[];
    newFiles: string[];
    deletedFiles: string[];
  }> {
    const fileModificationService = getFileModificationService();
    const modifiedFiles: string[] = [];
    const newFiles: string[] = [];
    const deletedFiles: string[] = [];

    // Check all cached files
    for (const [relativePath, fileInfo] of Object.entries(cache.cached_files)) {
      const fullPath = path.resolve(projectPath, relativePath);

      try {
        const stats = await fs.stat(fullPath);
        if (stats.mtime.getTime() !== fileInfo.source_mtime) {
          modifiedFiles.push(relativePath);
        }
      } catch (error) {
        // File was deleted
        deletedFiles.push(relativePath);
      }
    }

    // Check for new JSONL files
    const { findJsonlFiles } = await import("../parsers/jsonl-parser");
    const currentFiles = findJsonlFiles(projectPath);

    for (const filePath of currentFiles) {
      const relativePath = path.relative(projectPath, filePath);
      if (!cache.cached_files[relativePath]) {
        newFiles.push(relativePath);
      }
    }

    return {
      modifiedFiles: [...modifiedFiles, ...newFiles],
      newFiles,
      deletedFiles,
    };
  }

  /**
   * Applies expiration policies to remove stale cache entries
   */
  private async applyExpirationPolicies(
    projectPath: string,
    cache: ProjectCache,
  ): Promise<{ removedEntries: string[]; expiredSessions: string[] }> {
    const removedEntries: string[] = [];
    const expiredSessions: string[] = [];
    const now = Date.now();

    for (const policy of this.expirationPolicies) {
      if (!policy.enabled) continue;

      // Check age-based expiration
      if (policy.maxAge > 0) {
        const cacheAge = now - new Date(cache.cache_created).getTime();
        if (cacheAge > policy.maxAge) {
          // Mark entire cache for rebuild
          removedEntries.push("*");
          break;
        }
      }

      // Check session-level expiration
      for (const [sessionId, sessionData] of Object.entries(cache.sessions)) {
        const sessionAge = now - new Date(sessionData.last_timestamp).getTime();

        if (sessionAge > policy.maxAge) {
          expiredSessions.push(sessionId);
        }

        // Check idle time
        const accessPattern = this.accessPatterns.get(sessionId);
        if (accessPattern && policy.maxIdleTime > 0) {
          const idleTime = now - accessPattern.lastAccess;
          if (idleTime > policy.maxIdleTime) {
            expiredSessions.push(sessionId);
          }
        }
      }

      // Check size-based expiration (LRU)
      if (
        policy.maxSize > 0 &&
        Object.keys(cache.sessions).length > policy.maxSize
      ) {
        const sessionsByAccess = Object.entries(cache.sessions)
          .map(([sessionId, sessionData]) => ({
            sessionId,
            sessionData,
            lastAccess: this.accessPatterns.get(sessionId)?.lastAccess || 0,
          }))
          .sort((a, b) => a.lastAccess - b.lastAccess);

        const toRemove = sessionsByAccess
          .slice(0, sessionsByAccess.length - policy.maxSize)
          .map((item) => item.sessionId);

        expiredSessions.push(...toRemove);
      }
    }

    return { removedEntries, expiredSessions };
  }

  /**
   * Handles dependency cascading when files change
   */
  private async handleDependencyCascading(
    projectPath: string,
    modifiedFiles: string[],
  ): Promise<{ affectedSessions: string[]; cascadedFiles: string[] }> {
    const affectedSessions: string[] = [];
    const cascadedFiles: string[] = [];

    const dependencyMap = this.dependencyMaps.get(projectPath);
    if (!dependencyMap) {
      return { affectedSessions, cascadedFiles };
    }

    // Find all files affected by the cascade
    const toProcess = [...modifiedFiles];
    const processed = new Set<string>();

    while (toProcess.length > 0) {
      const currentFile = toProcess.pop()!;
      if (processed.has(currentFile)) continue;

      processed.add(currentFile);
      const dependency = dependencyMap[currentFile];

      if (dependency) {
        // Add dependent files to processing queue
        for (const dependent of dependency.dependents) {
          if (!processed.has(dependent)) {
            toProcess.push(dependent);
            cascadedFiles.push(dependent);
          }
        }

        // Mark associated cache keys for invalidation
        affectedSessions.push(...dependency.cacheKeys);
      }
    }

    this.emit("invalidationEvent", {
      type: "dependencies_cascaded",
      projectPath,
      timestamp: new Date().toISOString(),
      metadata: {
        modifiedFiles,
        cascadedFiles,
        affectedSessions: affectedSessions.length,
      },
    } as InvalidationEvent);

    return { affectedSessions, cascadedFiles };
  }

  /**
   * Performs selective cache update for modified files/sessions
   */
  private async performSelectiveUpdate(
    projectPath: string,
    modifiedFiles: string[],
    invalidatedSessions: string[],
  ): Promise<{ rebuiltSessions: string[]; errors: string[] }> {
    const rebuiltSessions: string[] = [];
    const errors: string[] = [];

    try {
      const cacheBuilderService = getJsonlCacheBuilderService();

      // Rebuild cache for modified files only
      if (modifiedFiles.length > 0) {
        const buildResult = await cacheBuilderService.buildCache(projectPath, {
          incrementalMode: true,
          forceRebuild: false,
          parallelProcessing: modifiedFiles.length > 1,
        });

        if (!buildResult.success) {
          errors.push(...buildResult.errors);
        } else {
          rebuiltSessions.push(
            ...Object.keys(buildResult.sessionsCreated || {}),
          );
        }
      }

      // Remove invalidated sessions from cache
      if (invalidatedSessions.length > 0) {
        await this.removeSessionsFromCache(projectPath, invalidatedSessions);
        rebuiltSessions.push(...invalidatedSessions);
      }
    } catch (error) {
      errors.push(`Selective update error: ${error}`);
    }

    return { rebuiltSessions, errors };
  }

  /**
   * Applies cache warming strategies
   */
  private async applyCacheWarming(
    projectPath: string,
    cache: ProjectCache,
  ): Promise<void> {
    for (const strategy of this.warmingStrategies) {
      if (!strategy.enabled) continue;

      try {
        const candidatesForWarming = this.identifyWarmingCandidates(
          cache,
          strategy,
        );

        if (candidatesForWarming.length > 0) {
          await this.warmCacheEntries(projectPath, candidatesForWarming);

          this.emit("invalidationEvent", {
            type: "cache_warmed",
            projectPath,
            timestamp: new Date().toISOString(),
            metadata: {
              strategy: strategy.type,
              warmedEntries: candidatesForWarming.length,
            },
          } as InvalidationEvent);
        }
      } catch (error) {
        console.warn(
          `Cache warming error for strategy ${strategy.type}:`,
          error,
        );
      }
    }
  }

  /**
   * Identifies candidates for cache warming based on strategy
   */
  private identifyWarmingCandidates(
    cache: ProjectCache,
    strategy: CacheWarmingStrategy,
  ): string[] {
    const candidates: string[] = [];

    switch (strategy.type) {
      case "frequency_based":
        const frequentlyAccessed = Array.from(this.accessPatterns.entries())
          .filter(([_, pattern]) => pattern.count >= strategy.threshold)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, strategy.maxItems)
          .map(([sessionId]) => sessionId);
        candidates.push(...frequentlyAccessed);
        break;

      case "recency_based":
        const recentlyAccessed = Array.from(this.accessPatterns.entries())
          .sort((a, b) => b[1].lastAccess - a[1].lastAccess)
          .slice(0, strategy.maxItems)
          .map(([sessionId]) => sessionId);
        candidates.push(...recentlyAccessed);
        break;

      case "size_based":
        const largestSessions = Object.entries(cache.sessions)
          .sort((a, b) => b[1].message_count - a[1].message_count)
          .slice(0, strategy.maxItems)
          .map(([sessionId]) => sessionId);
        candidates.push(...largestSessions);
        break;
    }

    return candidates;
  }

  /**
   * Warms cache entries by pre-loading them
   */
  private async warmCacheEntries(
    projectPath: string,
    sessionIds: string[],
  ): Promise<void> {
    // In a full implementation, this would pre-load session data into memory
    // For now, we'll just update access patterns to mark as warmed
    const now = Date.now();

    for (const sessionId of sessionIds) {
      const pattern = this.accessPatterns.get(sessionId) || {
        count: 0,
        lastAccess: 0,
        totalSize: 0,
      };
      pattern.lastAccess = now;
      this.accessPatterns.set(sessionId, pattern);
    }
  }

  /**
   * Records access to a cache entry for tracking patterns
   */
  public recordAccess(sessionId: string, size: number = 0): void {
    const pattern = this.accessPatterns.get(sessionId) || {
      count: 0,
      lastAccess: 0,
      totalSize: 0,
    };
    pattern.count++;
    pattern.lastAccess = Date.now();
    pattern.totalSize = Math.max(pattern.totalSize, size);
    this.accessPatterns.set(sessionId, pattern);
  }

  /**
   * Builds dependency map for a project
   */
  public async buildDependencyMap(projectPath: string): Promise<void> {
    const dependencyMap: DependencyMap = {};

    try {
      const { findJsonlFiles } = await import("../parsers/jsonl-parser");
      const jsonlFiles = findJsonlFiles(projectPath);

      for (const filePath of jsonlFiles) {
        const relativePath = path.relative(projectPath, filePath);
        const stats = await fs.stat(filePath);

        dependencyMap[relativePath] = {
          dependsOn: [],
          dependents: [],
          lastModified: stats.mtime.getTime(),
          cacheKeys: [], // Will be populated with session IDs that depend on this file
        };
      }

      this.dependencyMaps.set(projectPath, dependencyMap);
    } catch (error) {
      console.error(`Error building dependency map for ${projectPath}:`, error);
    }
  }

  /**
   * Adds dependency relationship between files
   */
  public addDependency(
    projectPath: string,
    sourceFile: string,
    dependentFile: string,
  ): void {
    const dependencyMap = this.dependencyMaps.get(projectPath);
    if (!dependencyMap) return;

    if (dependencyMap[sourceFile] && dependencyMap[dependentFile]) {
      dependencyMap[sourceFile].dependents.push(dependentFile);
      dependencyMap[dependentFile].dependsOn.push(sourceFile);
    }
  }

  /**
   * Loads project cache from disk
   */
  private async loadProjectCache(
    projectPath: string,
  ): Promise<ProjectCache | null> {
    try {
      const cachePath = path.join(projectPath, ".cache", "index.json");
      const content = await fs.readFile(cachePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Removes specific sessions from cache
   */
  private async removeSessionsFromCache(
    projectPath: string,
    sessionIds: string[],
  ): Promise<void> {
    try {
      const cache = await this.loadProjectCache(projectPath);
      if (!cache) return;

      for (const sessionId of sessionIds) {
        delete cache.sessions[sessionId];
      }

      // Recalculate totals
      cache.total_message_count = Object.values(cache.sessions).reduce(
        (total, session) => total + session.message_count,
        0,
      );

      cache.total_input_tokens = Object.values(cache.sessions).reduce(
        (total, session) => total + session.total_input_tokens,
        0,
      );

      cache.total_output_tokens = Object.values(cache.sessions).reduce(
        (total, session) => total + session.total_output_tokens,
        0,
      );

      cache.last_updated = new Date().toISOString();

      // Write updated cache back to disk
      const cachePath = path.join(projectPath, ".cache", "index.json");
      await this.atomicWriteJson(cachePath, cache);
    } catch (error) {
      console.error(`Error removing sessions from cache:`, error);
    }
  }

  /**
   * Configures expiration policies
   */
  public setExpirationPolicies(policies: ExpirationPolicy[]): void {
    this.expirationPolicies = policies;
  }

  /**
   * Configures cache warming strategies
   */
  public setCacheWarmingStrategies(strategies: CacheWarmingStrategy[]): void {
    this.warmingStrategies = strategies;
  }

  /**
   * Gets current access patterns for analysis
   */
  public getAccessPatterns(): Map<
    string,
    { count: number; lastAccess: number; totalSize: number }
  > {
    return new Map(this.accessPatterns);
  }

  /**
   * Gets dependency map for a project
   */
  public getDependencyMap(projectPath: string): DependencyMap | undefined {
    return this.dependencyMaps.get(projectPath);
  }

  /**
   * Atomic write operation
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
   * Shuts down the service and cleans up resources
   */
  public async shutdown(): Promise<void> {
    this.invalidationInProgress = false;
    this.removeAllListeners();
  }
}

// Singleton instance getter
export function getCacheInvalidationService(): CacheInvalidationService {
  return CacheInvalidationService.getInstance();
}
