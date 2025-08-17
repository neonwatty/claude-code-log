import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { 
  ProjectCache, 
  CacheStats, 
  CacheValidationResult,
  CACHE_FORMAT_VERSION,
  CACHE_INDEX_FILENAME 
} from '../utils/cache';

export interface CacheDirectoryEvent {
  type: 'created' | 'updated' | 'deleted' | 'validated';
  projectPath: string;
  timestamp: string;
  metadata?: any;
}

export interface CacheDirectoryInfo {
  projectPath: string;
  cachePath: string;
  indexPath: string;
  exists: boolean;
  isValid: boolean;
  lastUpdated?: string;
}

export class CacheDirectoryService extends EventEmitter {
  private static instance: CacheDirectoryService | null = null;
  private cacheDirectories: Map<string, CacheDirectoryInfo> = new Map();
  private readonly CACHE_DIR_NAME = '.cache';

  constructor() {
    super();
  }

  public static getInstance(): CacheDirectoryService {
    if (!CacheDirectoryService.instance) {
      CacheDirectoryService.instance = new CacheDirectoryService();
    }
    return CacheDirectoryService.instance;
  }

  /**
   * Creates a cache directory structure for a project
   */
  public async createCacheDirectory(projectPath: string): Promise<CacheDirectoryInfo> {
    try {
      const absoluteProjectPath = path.resolve(projectPath);
      const cachePath = path.join(absoluteProjectPath, this.CACHE_DIR_NAME);
      const indexPath = path.join(cachePath, CACHE_INDEX_FILENAME);

      // Create cache directory if it doesn't exist
      await fs.mkdir(cachePath, { recursive: true });

      // Initialize or update index.json
      const indexData = await this.initializeIndex(absoluteProjectPath, indexPath);

      const cacheInfo: CacheDirectoryInfo = {
        projectPath: absoluteProjectPath,
        cachePath,
        indexPath,
        exists: true,
        isValid: true,
        lastUpdated: indexData.last_updated
      };

      this.cacheDirectories.set(absoluteProjectPath, cacheInfo);

      this.emit('directoryEvent', {
        type: 'created',
        projectPath: absoluteProjectPath,
        timestamp: new Date().toISOString(),
        metadata: { cachePath, indexPath }
      } as CacheDirectoryEvent);

      return cacheInfo;
    } catch (error) {
      throw new Error(`Failed to create cache directory for ${projectPath}: ${error}`);
    }
  }

  /**
   * Initializes or updates the index.json file for a cache directory
   */
  private async initializeIndex(projectPath: string, indexPath: string): Promise<ProjectCache> {
    const now = new Date().toISOString();

    // Check if index.json already exists
    let existingIndex: ProjectCache | null = null;
    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      existingIndex = JSON.parse(indexContent);
    } catch (error) {
      // Index doesn't exist or is invalid, will create new one
    }

    const indexData: ProjectCache = {
      version: CACHE_FORMAT_VERSION,
      cache_created: existingIndex?.cache_created || now,
      last_updated: now,
      project_path: projectPath,
      cached_files: existingIndex?.cached_files || {},
      total_message_count: existingIndex?.total_message_count || 0,
      total_input_tokens: existingIndex?.total_input_tokens || 0,
      total_output_tokens: existingIndex?.total_output_tokens || 0,
      total_cache_creation_tokens: existingIndex?.total_cache_creation_tokens || 0,
      total_cache_read_tokens: existingIndex?.total_cache_read_tokens || 0,
      sessions: existingIndex?.sessions || {},
      working_directories: existingIndex?.working_directories || [projectPath],
      earliest_timestamp: existingIndex?.earliest_timestamp || now,
      latest_timestamp: existingIndex?.latest_timestamp || now
    };

    // Atomic write operation
    await this.atomicWriteJson(indexPath, indexData);

    return indexData;
  }

  /**
   * Performs atomic write operations to prevent cache corruption
   */
  private async atomicWriteJson(filePath: string, data: any): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    
    try {
      // Write to temporary file first
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      
      // Atomically move temporary file to final location
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temporary file on error
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Discovers and registers existing cache directories
   */
  public async discoverCacheDirectories(searchPaths: string[]): Promise<CacheDirectoryInfo[]> {
    const discovered: CacheDirectoryInfo[] = [];

    for (const searchPath of searchPaths) {
      try {
        const results = await this.traverseDirectory(searchPath);
        discovered.push(...results);
      } catch (error) {
        console.warn(`Error discovering cache directories in ${searchPath}:`, error);
      }
    }

    return discovered;
  }

  /**
   * Recursively traverses directories to find cache directories
   */
  private async traverseDirectory(dirPath: string, maxDepth: number = 3, currentDepth: number = 0): Promise<CacheDirectoryInfo[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const discovered: CacheDirectoryInfo[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);

          // Check if this is a cache directory
          if (entry.name === this.CACHE_DIR_NAME) {
            const projectPath = dirPath;
            const indexPath = path.join(fullPath, CACHE_INDEX_FILENAME);
            
            const cacheInfo: CacheDirectoryInfo = {
              projectPath,
              cachePath: fullPath,
              indexPath,
              exists: true,
              isValid: await this.validateCacheDirectory(fullPath),
              lastUpdated: await this.getLastUpdated(indexPath)
            };

            this.cacheDirectories.set(projectPath, cacheInfo);
            discovered.push(cacheInfo);
          } else {
            // Recursively search subdirectories
            const subResults = await this.traverseDirectory(fullPath, maxDepth, currentDepth + 1);
            discovered.push(...subResults);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return discovered;
  }

  /**
   * Validates a cache directory structure
   */
  public async validateCacheDirectory(cachePath: string): Promise<boolean> {
    try {
      const indexPath = path.join(cachePath, CACHE_INDEX_FILENAME);
      
      // Check if index.json exists and is readable
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const indexData = JSON.parse(indexContent);

      // Basic validation of index structure
      return !!(indexData.version && indexData.project_path && indexData.sessions);
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the last updated timestamp from an index file
   */
  private async getLastUpdated(indexPath: string): Promise<string | undefined> {
    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const indexData = JSON.parse(indexContent);
      return indexData.last_updated;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Updates cache metadata for a project
   */
  public async updateCacheMetadata(projectPath: string, updates: Partial<ProjectCache>): Promise<void> {
    const cacheInfo = this.cacheDirectories.get(projectPath);
    if (!cacheInfo) {
      throw new Error(`No cache directory found for project: ${projectPath}`);
    }

    try {
      // Read current index
      const indexContent = await fs.readFile(cacheInfo.indexPath, 'utf-8');
      const currentIndex: ProjectCache = JSON.parse(indexContent);

      // Merge updates
      const updatedIndex: ProjectCache = {
        ...currentIndex,
        ...updates,
        last_updated: new Date().toISOString()
      };

      // Atomic write
      await this.atomicWriteJson(cacheInfo.indexPath, updatedIndex);

      // Update cached info
      cacheInfo.lastUpdated = updatedIndex.last_updated;

      this.emit('directoryEvent', {
        type: 'updated',
        projectPath,
        timestamp: new Date().toISOString(),
        metadata: updates
      } as CacheDirectoryEvent);

    } catch (error) {
      throw new Error(`Failed to update cache metadata for ${projectPath}: ${error}`);
    }
  }

  /**
   * Gets cache statistics for a project
   */
  public async getCacheStats(projectPath: string): Promise<CacheStats> {
    const cacheInfo = this.cacheDirectories.get(projectPath);
    if (!cacheInfo) {
      return { cache_enabled: false };
    }

    try {
      const indexContent = await fs.readFile(cacheInfo.indexPath, 'utf-8');
      const indexData: ProjectCache = JSON.parse(indexContent);

      return {
        cache_enabled: true,
        cached_files_count: Object.keys(indexData.cached_files).length,
        total_cached_messages: indexData.total_message_count,
        total_sessions: Object.keys(indexData.sessions).length,
        cache_created: indexData.cache_created,
        last_updated: indexData.last_updated
      };
    } catch (error) {
      return { cache_enabled: false };
    }
  }

  /**
   * Validates cache consistency and returns validation results
   */
  public async validateCacheConsistency(projectPath: string): Promise<CacheValidationResult> {
    const cacheInfo = this.cacheDirectories.get(projectPath);
    if (!cacheInfo) {
      return {
        is_valid: false,
        reason: 'Cache directory not found',
        version_compatible: false,
        files_to_recache: []
      };
    }

    try {
      const indexContent = await fs.readFile(cacheInfo.indexPath, 'utf-8');
      const indexData: ProjectCache = JSON.parse(indexContent);

      // Check version compatibility
      const versionCompatible = indexData.version === CACHE_FORMAT_VERSION;

      // Check if cached files still exist and are up to date
      const filesToRecache: string[] = [];
      for (const [filename, fileInfo] of Object.entries(indexData.cached_files)) {
        const filePath = path.resolve(indexData.project_path, filename);
        
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtime.getTime() !== fileInfo.source_mtime) {
            filesToRecache.push(filename);
          }
        } catch (error) {
          // File doesn't exist anymore
          filesToRecache.push(filename);
        }
      }

      const isValid = versionCompatible && filesToRecache.length === 0;

      this.emit('directoryEvent', {
        type: 'validated',
        projectPath,
        timestamp: new Date().toISOString(),
        metadata: { isValid, filesToRecache: filesToRecache.length }
      } as CacheDirectoryEvent);

      return {
        is_valid: isValid,
        reason: !isValid ? (versionCompatible ? 'Files need recaching' : 'Version incompatible') : undefined,
        version_compatible: versionCompatible,
        files_to_recache: filesToRecache
      };
    } catch (error) {
      return {
        is_valid: false,
        reason: `Error validating cache: ${error}`,
        version_compatible: false,
        files_to_recache: []
      };
    }
  }

  /**
   * Removes a cache directory and its contents
   */
  public async removeCacheDirectory(projectPath: string): Promise<void> {
    const cacheInfo = this.cacheDirectories.get(projectPath);
    if (!cacheInfo) {
      throw new Error(`No cache directory found for project: ${projectPath}`);
    }

    try {
      await fs.rm(cacheInfo.cachePath, { recursive: true, force: true });
      this.cacheDirectories.delete(projectPath);

      this.emit('directoryEvent', {
        type: 'deleted',
        projectPath,
        timestamp: new Date().toISOString(),
        metadata: { cachePath: cacheInfo.cachePath }
      } as CacheDirectoryEvent);

    } catch (error) {
      throw new Error(`Failed to remove cache directory for ${projectPath}: ${error}`);
    }
  }

  /**
   * Gets information about all managed cache directories
   */
  public getAllCacheDirectories(): CacheDirectoryInfo[] {
    return Array.from(this.cacheDirectories.values());
  }

  /**
   * Gets information about a specific cache directory
   */
  public getCacheDirectory(projectPath: string): CacheDirectoryInfo | undefined {
    return this.cacheDirectories.get(projectPath);
  }

  /**
   * Checks if a project has a cache directory
   */
  public hasCacheDirectory(projectPath: string): boolean {
    return this.cacheDirectories.has(projectPath);
  }

  /**
   * Initializes the service by discovering existing cache directories
   */
  public async initialize(searchPaths: string[] = [process.cwd()]): Promise<void> {
    try {
      await this.discoverCacheDirectories(searchPaths);
      console.log(`Cache directory service initialized with ${this.cacheDirectories.size} cache directories`);
    } catch (error) {
      console.error('Error initializing cache directory service:', error);
    }
  }

  /**
   * Cleans up resources and stops the service
   */
  public async shutdown(): Promise<void> {
    this.cacheDirectories.clear();
    this.removeAllListeners();
  }
}

// Singleton instance getter
export function getCacheDirectoryService(): CacheDirectoryService {
  return CacheDirectoryService.getInstance();
}