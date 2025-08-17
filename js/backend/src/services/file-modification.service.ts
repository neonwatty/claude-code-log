import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface FileStats {
  filePath: string;
  size: number;
  mtime: number;
  exists: boolean;
  lastChecked: number;
}

export interface FileModificationResult {
  hasChanged: boolean;
  previousStats?: FileStats;
  currentStats?: FileStats;
  changeType: 'modified' | 'created' | 'deleted' | 'unchanged';
}

export interface BatchCheckResult {
  changedFiles: string[];
  unchangedFiles: string[];
  deletedFiles: string[];
  newFiles: string[];
  totalChecked: number;
  checkDurationMs: number;
}

export interface DirectoryTrackingOptions {
  recursive: boolean;
  pattern?: RegExp;
  ignorePatterns?: RegExp[];
  maxDepth?: number;
}

export interface FileModificationEvent {
  type: 'file_changed' | 'file_deleted' | 'file_created' | 'batch_complete';
  filePath?: string;
  batchResult?: BatchCheckResult;
  timestamp: string;
  metadata?: any;
}

export class FileModificationService extends EventEmitter {
  private static instance: FileModificationService | null = null;
  private fileStats: Map<string, FileStats> = new Map();
  private trackedDirectories: Map<string, DirectoryTrackingOptions> = new Map();
  private batchCheckInProgress = false;

  constructor() {
    super();
  }

  public static getInstance(): FileModificationService {
    if (!FileModificationService.instance) {
      FileModificationService.instance = new FileModificationService();
    }
    return FileModificationService.instance;
  }

  /**
   * Tracks a single file for modification changes
   */
  public async trackFile(filePath: string): Promise<FileStats> {
    const absolutePath = path.resolve(filePath);
    const stats = await this.getFileStats(absolutePath);
    
    this.fileStats.set(absolutePath, stats);
    
    if (!stats.exists) {
      this.emit('fileModificationEvent', {
        type: 'file_deleted',
        filePath: absolutePath,
        timestamp: new Date().toISOString()
      } as FileModificationEvent);
    }

    return stats;
  }

  /**
   * Tracks all files in a directory (optionally recursive)
   */
  public async trackDirectory(
    dirPath: string, 
    options: DirectoryTrackingOptions = { recursive: true }
  ): Promise<string[]> {
    const absoluteDirPath = path.resolve(dirPath);
    this.trackedDirectories.set(absoluteDirPath, options);

    const files = await this.discoverFiles(absoluteDirPath, options);
    
    for (const filePath of files) {
      await this.trackFile(filePath);
    }

    return files;
  }

  /**
   * Discovers files in a directory based on tracking options
   */
  private async discoverFiles(
    dirPath: string, 
    options: DirectoryTrackingOptions,
    currentDepth: number = 0
  ): Promise<string[]> {
    const files: string[] = [];
    
    if (options.maxDepth && currentDepth >= options.maxDepth) {
      return files;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          // Apply pattern matching
          if (options.pattern && !options.pattern.test(entry.name)) {
            continue;
          }

          // Apply ignore patterns
          if (options.ignorePatterns?.some(pattern => pattern.test(entry.name))) {
            continue;
          }

          files.push(fullPath);
        } else if (entry.isDirectory() && options.recursive) {
          // Skip hidden directories and common ignore patterns
          if (entry.name.startsWith('.') && entry.name !== '.cache') {
            continue;
          }

          const subFiles = await this.discoverFiles(fullPath, options, currentDepth + 1);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      console.warn(`Error reading directory ${dirPath}:`, error);
    }

    return files;
  }

  /**
   * Gets current file statistics
   */
  private async getFileStats(filePath: string): Promise<FileStats> {
    try {
      const stats = await fs.stat(filePath);
      return {
        filePath,
        size: stats.size,
        mtime: stats.mtime.getTime(),
        exists: true,
        lastChecked: Date.now()
      };
    } catch (error) {
      return {
        filePath,
        size: 0,
        mtime: 0,
        exists: false,
        lastChecked: Date.now()
      };
    }
  }

  /**
   * Gets file statistics synchronously (for performance-critical operations)
   */
  private getFileStatsSync(filePath: string): FileStats {
    try {
      const stats = fsSync.statSync(filePath);
      return {
        filePath,
        size: stats.size,
        mtime: stats.mtime.getTime(),
        exists: true,
        lastChecked: Date.now()
      };
    } catch (error) {
      return {
        filePath,
        size: 0,
        mtime: 0,
        exists: false,
        lastChecked: Date.now()
      };
    }
  }

  /**
   * Checks if a single file has been modified since last check
   */
  public async checkFileModification(filePath: string): Promise<FileModificationResult> {
    const absolutePath = path.resolve(filePath);
    const previousStats = this.fileStats.get(absolutePath);
    const currentStats = await this.getFileStats(absolutePath);

    // Update tracked stats
    this.fileStats.set(absolutePath, currentStats);

    if (!previousStats) {
      // First time checking this file
      return {
        hasChanged: currentStats.exists,
        currentStats,
        changeType: currentStats.exists ? 'created' : 'deleted'
      };
    }

    // File was deleted
    if (!currentStats.exists && previousStats.exists) {
      this.emit('fileModificationEvent', {
        type: 'file_deleted',
        filePath: absolutePath,
        timestamp: new Date().toISOString()
      } as FileModificationEvent);

      return {
        hasChanged: true,
        previousStats,
        currentStats,
        changeType: 'deleted'
      };
    }

    // File was created
    if (currentStats.exists && !previousStats.exists) {
      this.emit('fileModificationEvent', {
        type: 'file_created',
        filePath: absolutePath,
        timestamp: new Date().toISOString()
      } as FileModificationEvent);

      return {
        hasChanged: true,
        previousStats,
        currentStats,
        changeType: 'created'
      };
    }

    // File was modified
    if (currentStats.exists && previousStats.exists) {
      const hasChanged = 
        currentStats.mtime !== previousStats.mtime || 
        currentStats.size !== previousStats.size;

      if (hasChanged) {
        this.emit('fileModificationEvent', {
          type: 'file_changed',
          filePath: absolutePath,
          timestamp: new Date().toISOString(),
          metadata: {
            previousMtime: previousStats.mtime,
            currentMtime: currentStats.mtime,
            sizeChange: currentStats.size - previousStats.size
          }
        } as FileModificationEvent);

        return {
          hasChanged: true,
          previousStats,
          currentStats,
          changeType: 'modified'
        };
      }
    }

    return {
      hasChanged: false,
      previousStats,
      currentStats,
      changeType: 'unchanged'
    };
  }

  /**
   * Efficiently checks multiple files in batch
   */
  public async batchCheckFiles(filePaths: string[]): Promise<BatchCheckResult> {
    if (this.batchCheckInProgress) {
      throw new Error('Batch check already in progress');
    }

    this.batchCheckInProgress = true;
    const startTime = Date.now();

    const result: BatchCheckResult = {
      changedFiles: [],
      unchangedFiles: [],
      deletedFiles: [],
      newFiles: [],
      totalChecked: filePaths.length,
      checkDurationMs: 0
    };

    try {
      // Use Promise.allSettled for concurrent file checking
      const checkPromises = filePaths.map(async filePath => {
        try {
          const modificationResult = await this.checkFileModification(filePath);
          return { filePath, modificationResult };
        } catch (error) {
          console.warn(`Error checking file ${filePath}:`, error);
          return { filePath, modificationResult: null };
        }
      });

      const checkResults = await Promise.allSettled(checkPromises);

      for (const promiseResult of checkResults) {
        if (promiseResult.status === 'fulfilled' && promiseResult.value.modificationResult) {
          const { filePath, modificationResult } = promiseResult.value;
          
          switch (modificationResult.changeType) {
            case 'modified':
              result.changedFiles.push(filePath);
              break;
            case 'created':
              result.newFiles.push(filePath);
              break;
            case 'deleted':
              result.deletedFiles.push(filePath);
              break;
            case 'unchanged':
              result.unchangedFiles.push(filePath);
              break;
          }
        }
      }

      result.checkDurationMs = Date.now() - startTime;

      this.emit('fileModificationEvent', {
        type: 'batch_complete',
        batchResult: result,
        timestamp: new Date().toISOString()
      } as FileModificationEvent);

      return result;

    } finally {
      this.batchCheckInProgress = false;
    }
  }

  /**
   * Fast synchronous batch check for performance-critical scenarios
   */
  public batchCheckFilesSync(filePaths: string[]): BatchCheckResult {
    const startTime = Date.now();

    const result: BatchCheckResult = {
      changedFiles: [],
      unchangedFiles: [],
      deletedFiles: [],
      newFiles: [],
      totalChecked: filePaths.length,
      checkDurationMs: 0
    };

    for (const filePath of filePaths) {
      try {
        const absolutePath = path.resolve(filePath);
        const previousStats = this.fileStats.get(absolutePath);
        const currentStats = this.getFileStatsSync(absolutePath);

        // Update tracked stats
        this.fileStats.set(absolutePath, currentStats);

        if (!previousStats) {
          if (currentStats.exists) {
            result.newFiles.push(filePath);
          }
          continue;
        }

        // File was deleted
        if (!currentStats.exists && previousStats.exists) {
          result.deletedFiles.push(filePath);
          continue;
        }

        // File was created
        if (currentStats.exists && !previousStats.exists) {
          result.newFiles.push(filePath);
          continue;
        }

        // File was modified
        if (currentStats.exists && previousStats.exists) {
          const hasChanged = 
            currentStats.mtime !== previousStats.mtime || 
            currentStats.size !== previousStats.size;

          if (hasChanged) {
            result.changedFiles.push(filePath);
          } else {
            result.unchangedFiles.push(filePath);
          }
        }
      } catch (error) {
        console.warn(`Error checking file ${filePath}:`, error);
      }
    }

    result.checkDurationMs = Date.now() - startTime;
    return result;
  }

  /**
   * Checks all tracked files for modifications
   */
  public async checkAllTrackedFiles(): Promise<BatchCheckResult> {
    const trackedFiles = Array.from(this.fileStats.keys());
    return this.batchCheckFiles(trackedFiles);
  }

  /**
   * Checks all files in tracked directories
   */
  public async checkTrackedDirectories(): Promise<BatchCheckResult> {
    const allFiles: string[] = [];

    for (const [dirPath, options] of this.trackedDirectories) {
      try {
        const files = await this.discoverFiles(dirPath, options);
        allFiles.push(...files);
      } catch (error) {
        console.warn(`Error checking tracked directory ${dirPath}:`, error);
      }
    }

    return this.batchCheckFiles(allFiles);
  }

  /**
   * Gets file modification time for cache comparison
   */
  public getFileModificationTime(filePath: string): number | null {
    const stats = this.fileStats.get(path.resolve(filePath));
    return stats?.exists ? stats.mtime : null;
  }

  /**
   * Checks if file needs cache invalidation based on cached mtime
   */
  public needsCacheInvalidation(filePath: string, cachedMtime: number): boolean {
    const currentMtime = this.getFileModificationTime(filePath);
    if (currentMtime === null) {
      return true; // File doesn't exist, invalidate cache
    }
    return currentMtime !== cachedMtime;
  }

  /**
   * Removes file from tracking
   */
  public untrackFile(filePath: string): boolean {
    const absolutePath = path.resolve(filePath);
    return this.fileStats.delete(absolutePath);
  }

  /**
   * Removes directory from tracking
   */
  public untrackDirectory(dirPath: string): boolean {
    const absoluteDirPath = path.resolve(dirPath);
    
    // Remove all files within this directory
    const toRemove: string[] = [];
    for (const [filePath] of this.fileStats) {
      if (filePath.startsWith(absoluteDirPath)) {
        toRemove.push(filePath);
      }
    }
    
    toRemove.forEach(filePath => this.fileStats.delete(filePath));
    
    return this.trackedDirectories.delete(absoluteDirPath);
  }

  /**
   * Gets statistics about tracked files
   */
  public getTrackingStats(): {
    trackedFiles: number;
    trackedDirectories: number;
    lastBatchCheck?: BatchCheckResult;
  } {
    return {
      trackedFiles: this.fileStats.size,
      trackedDirectories: this.trackedDirectories.size
    };
  }

  /**
   * Gets all currently tracked file paths
   */
  public getTrackedFiles(): string[] {
    return Array.from(this.fileStats.keys());
  }

  /**
   * Gets all currently tracked directory paths
   */
  public getTrackedDirectories(): string[] {
    return Array.from(this.trackedDirectories.keys());
  }

  /**
   * Clears all tracking data
   */
  public clearAllTracking(): void {
    this.fileStats.clear();
    this.trackedDirectories.clear();
  }

  /**
   * Shuts down the service and cleans up resources
   */
  public async shutdown(): Promise<void> {
    this.clearAllTracking();
    this.removeAllListeners();
  }
}

// Singleton instance getter
export function getFileModificationService(): FileModificationService {
  return FileModificationService.getInstance();
}