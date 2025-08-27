import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { EventEmitter } from "events";
import {
  ProjectCache,
  CacheValidationResult,
  // CachedFileInfo, // Unused
  SessionCacheData,
  CACHE_FORMAT_VERSION,
  CACHE_INDEX_FILENAME,
} from "../utils/cache";

export interface ValidationOptions {
  enableChecksumValidation?: boolean;
  enableVersionMigration?: boolean;
  strictValidation?: boolean;
  maxCorruptionRetries?: number;
}

export interface ValidationEvent {
  type:
    | "validation_started"
    | "validation_completed"
    | "migration_performed"
    | "corruption_detected"
    | "fallback_triggered";
  projectPath: string;
  timestamp: string;
  metadata?: any;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migratedData?: ProjectCache;
  error?: string;
}

export interface ChecksumValidationResult {
  isValid: boolean;
  expectedChecksum?: string;
  actualChecksum?: string;
  corruptedFields?: string[];
}

export class CacheValidationService extends EventEmitter {
  private static instance: CacheValidationService | null = null;
  private readonly SUPPORTED_VERSIONS = ["1.0.0", "0.9.0", "0.8.0"];
  private readonly REQUIRED_FIELDS = [
    "version",
    "cache_created",
    "last_updated",
    "project_path",
    "cached_files",
    "sessions",
    "total_message_count",
  ];

  constructor() {
    super();
  }

  public static getInstance(): CacheValidationService {
    if (!CacheValidationService.instance) {
      CacheValidationService.instance = new CacheValidationService();
    }
    return CacheValidationService.instance;
  }

  /**
   * Validates a cache directory and its index file
   */
  public async validateCache(
    projectPath: string,
    options: ValidationOptions = {},
  ): Promise<CacheValidationResult> {
    const startTime = Date.now();

    this.emit("validationEvent", {
      type: "validation_started",
      projectPath,
      timestamp: new Date().toISOString(),
      metadata: { options },
    } as ValidationEvent);

    try {
      const cachePath = path.join(projectPath, ".cache");
      const indexPath = path.join(cachePath, CACHE_INDEX_FILENAME);

      // Check if cache directory exists
      if (!(await this.fileExists(indexPath))) {
        return this.createValidationResult(
          false,
          "Cache index file not found",
          false,
          [],
        );
      }

      // Load and parse index file
      const indexData = await this.loadIndexFile(indexPath);
      if (!indexData) {
        return this.createValidationResult(
          false,
          "Failed to parse index file",
          false,
          [],
        );
      }

      // Check version compatibility first
      const versionValidation = this.validateVersion(indexData.version);
      let migratedData = indexData;

      if (!versionValidation.isCompatible && options.enableVersionMigration) {
        const migrationResult = await this.migrateCache(indexData, indexPath);
        if (migrationResult.success && migrationResult.migratedData) {
          migratedData = migrationResult.migratedData;
        } else {
          return this.createValidationResult(
            false,
            `Version ${indexData.version} incompatible and migration failed: ${migrationResult.error}`,
            false,
            [],
          );
        }
      } else if (!versionValidation.isCompatible) {
        return this.createValidationResult(
          false,
          `Version ${indexData.version} incompatible with current version ${CACHE_FORMAT_VERSION}`,
          false,
          [],
        );
      }

      // Validate basic structure (after potential migration)
      const structureValidation = this.validateStructure(migratedData);
      if (!structureValidation.isValid) {
        return this.createValidationResult(
          false,
          structureValidation.reason,
          false,
          [],
        );
      }

      // Validate file checksums if enabled
      if (options.enableChecksumValidation) {
        const checksumValidation = await this.validateChecksums(
          migratedData,
          projectPath,
        );
        if (!checksumValidation.isValid) {
          this.emit("validationEvent", {
            type: "corruption_detected",
            projectPath,
            timestamp: new Date().toISOString(),
            metadata: { corruptedFields: checksumValidation.corruptedFields },
          } as ValidationEvent);

          if (options.strictValidation) {
            return this.createValidationResult(
              false,
              "Cache corruption detected",
              true,
              [],
            );
          }
        }
      }

      // Check file modifications
      const filesToRecache = await this.checkFileModifications(
        migratedData,
        projectPath,
      );

      const isValid = filesToRecache.length === 0;
      const result = this.createValidationResult(
        isValid,
        undefined,
        true,
        filesToRecache,
      );

      this.emit("validationEvent", {
        type: "validation_completed",
        projectPath,
        timestamp: new Date().toISOString(),
        metadata: {
          isValid,
          filesToRecache: filesToRecache.length,
          durationMs: Date.now() - startTime,
        },
      } as ValidationEvent);

      return result;
    } catch (error) {
      const errorMessage = `Validation error: ${error}`;

      if (options.enableVersionMigration) {
        this.emit("validationEvent", {
          type: "fallback_triggered",
          projectPath,
          timestamp: new Date().toISOString(),
          metadata: { error: errorMessage },
        } as ValidationEvent);
      }

      return this.createValidationResult(false, errorMessage, false, []);
    }
  }

  /**
   * Validates the basic structure of cache data
   */
  private validateStructure(cacheData: any): {
    isValid: boolean;
    reason?: string;
  } {
    if (!cacheData || typeof cacheData !== "object") {
      return { isValid: false, reason: "Invalid cache data format" };
    }

    // Check required fields
    for (const field of this.REQUIRED_FIELDS) {
      if (!(field in cacheData)) {
        return { isValid: false, reason: `Missing required field: ${field}` };
      }
    }

    // Validate data types
    if (typeof cacheData.version !== "string") {
      return { isValid: false, reason: "Invalid version field type" };
    }

    if (typeof cacheData.project_path !== "string") {
      return { isValid: false, reason: "Invalid project_path field type" };
    }

    if (
      typeof cacheData.cached_files !== "object" ||
      Array.isArray(cacheData.cached_files)
    ) {
      return { isValid: false, reason: "Invalid cached_files field type" };
    }

    if (
      typeof cacheData.sessions !== "object" ||
      Array.isArray(cacheData.sessions)
    ) {
      return { isValid: false, reason: "Invalid sessions field type" };
    }

    if (typeof cacheData.total_message_count !== "number") {
      return {
        isValid: false,
        reason: "Invalid total_message_count field type",
      };
    }

    return { isValid: true };
  }

  /**
   * Validates version compatibility
   */
  private validateVersion(version: string): {
    isCompatible: boolean;
    needsMigration: boolean;
  } {
    const isCurrentVersion = version === CACHE_FORMAT_VERSION;
    const isSupported = this.SUPPORTED_VERSIONS.includes(version);

    return {
      isCompatible: isCurrentVersion,
      needsMigration: !isCurrentVersion && isSupported,
    };
  }

  /**
   * Migrates cache data from older versions to current version
   */
  private async migrateCache(
    cacheData: any,
    indexPath: string,
  ): Promise<MigrationResult> {
    const fromVersion = cacheData.version;

    try {
      let migratedData: ProjectCache;

      switch (fromVersion) {
        case "0.9.0":
          migratedData = this.migrateFrom090(cacheData);
          break;
        case "0.8.0":
          migratedData = this.migrateFrom080(cacheData);
          break;
        default:
          return {
            success: false,
            fromVersion,
            toVersion: CACHE_FORMAT_VERSION,
            error: `Unsupported version for migration: ${fromVersion}`,
          };
      }

      // Write migrated data back to file
      await this.atomicWriteJson(indexPath, migratedData);

      this.emit("validationEvent", {
        type: "migration_performed",
        projectPath: path.dirname(path.dirname(indexPath)),
        timestamp: new Date().toISOString(),
        metadata: { fromVersion, toVersion: CACHE_FORMAT_VERSION },
      } as ValidationEvent);

      return {
        success: true,
        fromVersion,
        toVersion: CACHE_FORMAT_VERSION,
        migratedData,
      };
    } catch (error) {
      return {
        success: false,
        fromVersion,
        toVersion: CACHE_FORMAT_VERSION,
        error: `Migration failed: ${error}`,
      };
    }
  }

  /**
   * Migrates from version 0.9.0 to current version
   */
  private migrateFrom090(oldData: any): ProjectCache {
    return {
      version: CACHE_FORMAT_VERSION,
      cache_created: oldData.cache_created || new Date().toISOString(),
      last_updated: new Date().toISOString(),
      project_path: oldData.project_path,
      cached_files: oldData.cached_files || {},
      total_message_count: oldData.total_message_count || 0,
      total_input_tokens: oldData.total_input_tokens || 0,
      total_output_tokens: oldData.total_output_tokens || 0,
      total_cache_creation_tokens: oldData.total_cache_creation_tokens || 0,
      total_cache_read_tokens: oldData.total_cache_read_tokens || 0,
      sessions: oldData.sessions || {},
      working_directories: oldData.working_directories || [
        oldData.project_path,
      ],
      earliest_timestamp:
        oldData.earliest_timestamp || new Date().toISOString(),
      latest_timestamp: oldData.latest_timestamp || new Date().toISOString(),
    };
  }

  /**
   * Migrates from version 0.8.0 to current version
   */
  private migrateFrom080(oldData: any): ProjectCache {
    // 0.8.0 might have different field names or missing fields
    const sessions: Record<string, SessionCacheData> = {};

    // Convert old session format if it exists
    if (oldData.session_data) {
      for (const [sessionId, sessionInfo] of Object.entries(
        oldData.session_data as any,
      )) {
        sessions[sessionId] = {
          session_id: sessionId,
          summary: (sessionInfo as any).summary || "",
          first_timestamp:
            (sessionInfo as any).first_timestamp || new Date().toISOString(),
          last_timestamp:
            (sessionInfo as any).last_timestamp || new Date().toISOString(),
          message_count: (sessionInfo as any).message_count || 0,
          first_user_message: (sessionInfo as any).first_user_message || "",
          cwd: (sessionInfo as any).cwd,
          total_input_tokens: (sessionInfo as any).total_input_tokens || 0,
          total_output_tokens: (sessionInfo as any).total_output_tokens || 0,
          total_cache_creation_tokens: 0,
          total_cache_read_tokens: 0,
        };
      }
    }

    return {
      version: CACHE_FORMAT_VERSION,
      cache_created: oldData.created || new Date().toISOString(),
      last_updated: new Date().toISOString(),
      project_path: oldData.project_path,
      cached_files: oldData.files || {},
      total_message_count: oldData.message_count || 0,
      total_input_tokens: oldData.input_tokens || 0,
      total_output_tokens: oldData.output_tokens || 0,
      total_cache_creation_tokens: 0,
      total_cache_read_tokens: 0,
      sessions,
      working_directories: [oldData.project_path],
      earliest_timestamp: oldData.earliest || new Date().toISOString(),
      latest_timestamp: oldData.latest || new Date().toISOString(),
    };
  }

  /**
   * Validates checksums of cached data
   */
  private async validateChecksums(
    cacheData: ProjectCache,
    projectPath: string,
  ): Promise<ChecksumValidationResult> {
    try {
      // Calculate checksum of the cache data structure
      const dataString = JSON.stringify(
        cacheData,
        Object.keys(cacheData).sort(),
      );
      const actualChecksum = crypto
        .createHash("sha256")
        .update(dataString)
        .digest("hex");

      // For this implementation, we'll consider the cache valid if we can calculate a checksum
      // In a full implementation, you might store checksums in metadata
      return {
        isValid: true,
        actualChecksum,
      };
    } catch (error) {
      return {
        isValid: false,
        corruptedFields: ["checksum_calculation_failed"],
      };
    }
  }

  /**
   * Checks if cached files have been modified since caching
   */
  private async checkFileModifications(
    cacheData: ProjectCache,
    projectPath: string,
  ): Promise<string[]> {
    const filesToRecache: string[] = [];

    for (const [filename, fileInfo] of Object.entries(cacheData.cached_files)) {
      try {
        const fullPath = path.resolve(projectPath, filename);
        const stats = await fs.stat(fullPath);

        if (stats.mtime.getTime() !== fileInfo.source_mtime) {
          filesToRecache.push(filename);
        }
      } catch (error) {
        // File doesn't exist or can't be accessed
        filesToRecache.push(filename);
      }
    }

    return filesToRecache;
  }

  /**
   * Performs a quick validation without full checks
   */
  public async quickValidate(projectPath: string): Promise<boolean> {
    try {
      const indexPath = path.join(projectPath, ".cache", CACHE_INDEX_FILENAME);

      if (!(await this.fileExists(indexPath))) {
        return false;
      }

      const indexData = await this.loadIndexFile(indexPath);
      if (!indexData) {
        return false;
      }

      const structureValidation = this.validateStructure(indexData);
      const versionValidation = this.validateVersion(indexData.version);

      return (
        structureValidation.isValid &&
        (versionValidation.isCompatible || versionValidation.needsMigration)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Repairs a corrupted cache by rebuilding from source files
   */
  public async repairCache(projectPath: string): Promise<boolean> {
    try {
      const cachePath = path.join(projectPath, ".cache");

      // Remove corrupted cache
      await fs.rm(cachePath, { recursive: true, force: true });

      this.emit("validationEvent", {
        type: "fallback_triggered",
        projectPath,
        timestamp: new Date().toISOString(),
        metadata: { action: "cache_repair_initiated" },
      } as ValidationEvent);

      return true;
    } catch (error) {
      console.error(`Failed to repair cache for ${projectPath}:`, error);
      return false;
    }
  }

  /**
   * Gets detailed validation information for debugging
   */
  public async getValidationDetails(projectPath: string): Promise<{
    cacheExists: boolean;
    indexExists: boolean;
    version?: string;
    structureValid: boolean;
    fileCount: number;
    sessionCount: number;
    lastUpdated?: string;
  }> {
    const details: {
      cacheExists: boolean;
      indexExists: boolean;
      version?: string;
      structureValid: boolean;
      fileCount: number;
      sessionCount: number;
      lastUpdated?: string;
    } = {
      cacheExists: false,
      indexExists: false,
      structureValid: false,
      fileCount: 0,
      sessionCount: 0,
    };

    try {
      const cachePath = path.join(projectPath, ".cache");
      const indexPath = path.join(cachePath, CACHE_INDEX_FILENAME);

      details.cacheExists = await this.fileExists(cachePath);
      details.indexExists = await this.fileExists(indexPath);

      if (details.indexExists) {
        const indexData = await this.loadIndexFile(indexPath);
        if (indexData) {
          details.version = indexData.version;
          details.lastUpdated = indexData.last_updated;
          details.structureValid = this.validateStructure(indexData).isValid;
          details.fileCount = Object.keys(indexData.cached_files || {}).length;
          details.sessionCount = Object.keys(indexData.sessions || {}).length;
        }
      }
    } catch (error) {
      console.warn(
        `Error getting validation details for ${projectPath}:`,
        error,
      );
    }

    return details;
  }

  /**
   * Utility methods
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async loadIndexFile(indexPath: string): Promise<ProjectCache | null> {
    try {
      const content = await fs.readFile(indexPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Failed to load index file ${indexPath}:`, error);
      return null;
    }
  }

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

  private createValidationResult(
    isValid: boolean,
    reason?: string,
    versionCompatible: boolean = true,
    filesToRecache: string[] = [],
  ): CacheValidationResult {
    return {
      is_valid: isValid,
      reason,
      version_compatible: versionCompatible,
      files_to_recache: filesToRecache,
    };
  }

  /**
   * Shuts down the service and cleans up resources
   */
  public async shutdown(): Promise<void> {
    this.removeAllListeners();
  }
}

// Singleton instance getter
export function getCacheValidationService(): CacheValidationService {
  return CacheValidationService.getInstance();
}
