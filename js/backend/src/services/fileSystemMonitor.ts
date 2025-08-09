import { watch, FSWatcher, Stats } from 'fs';
import { stat, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import WebSocketService from './websocket';

export interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted';
  filepath: string;
  filename: string;
  timestamp: Date;
  stats?: Stats;
}

export interface FileMonitorOptions {
  /**
   * Directories to monitor for JSONL files
   */
  watchPaths: string[];
  
  /**
   * File extension to monitor (default: '.jsonl')
   */
  fileExtension?: string;
  
  /**
   * Debounce time in milliseconds to prevent duplicate events
   */
  debounceMs?: number;
  
  /**
   * Whether to recursively watch subdirectories
   */
  recursive?: boolean;
  
  /**
   * WebSocket service for broadcasting events
   */
  webSocketService?: WebSocketService;
}

export interface SessionDetectedEvent {
  sessionId: string;
  filepath: string;
  newEntries: number;
  totalEntries: number;
}

/**
 * File System Monitor Service for watching JSONL files
 * Detects new sessions and file changes, triggers WebSocket events
 */
export class FileSystemMonitor extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();
  private fileTimestamps: Map<string, number> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private options: Required<Omit<FileMonitorOptions, 'webSocketService'>> & { webSocketService?: WebSocketService };
  private isRunning = false;

  constructor(options: FileMonitorOptions) {
    super();
    
    this.options = {
      watchPaths: options.watchPaths,
      fileExtension: options.fileExtension ?? '.jsonl',
      debounceMs: options.debounceMs ?? 300,
      recursive: options.recursive ?? true,
      webSocketService: options.webSocketService,
    };

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen for file change events and broadcast via WebSocket
    this.on('fileChanged', (event: FileChangeEvent) => {
      console.log(`File ${event.type}: ${event.filepath}`);
      
      if (this.options.webSocketService) {
        this.options.webSocketService.broadcastToAll('file-system-event', {
          type: 'file_changed',
          data: event,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Listen for session detection events
    this.on('sessionDetected', (event: SessionDetectedEvent) => {
      console.log(`Session detected: ${event.sessionId} in ${event.filepath}`);
      
      if (this.options.webSocketService) {
        this.options.webSocketService.broadcastToAll('session-detected', {
          type: 'new_session',
          data: event,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Start monitoring the specified directories
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('File system monitor is already running');
      return;
    }

    console.log('Starting file system monitor...');
    
    // Initialize file timestamps for existing files
    await this.initializeFileTimestamps();
    
    // Start watching each path
    for (const watchPath of this.options.watchPaths) {
      await this.startWatching(watchPath);
    }

    this.isRunning = true;
    console.log(`File system monitor started, watching ${this.options.watchPaths.length} paths`);
  }

  /**
   * Stop monitoring and cleanup resources
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping file system monitor...');

    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    // Close all watchers
    this.watchers.forEach(watcher => watcher.close());
    this.watchers.clear();

    // Clear timestamps
    this.fileTimestamps.clear();

    this.isRunning = false;
    console.log('File system monitor stopped');
  }

  /**
   * Add a new path to monitor
   */
  async addWatchPath(path: string): Promise<void> {
    if (!this.options.watchPaths.includes(path)) {
      this.options.watchPaths.push(path);
      
      if (this.isRunning) {
        await this.startWatching(path);
      }
    }
  }

  /**
   * Remove a path from monitoring
   */
  removeWatchPath(path: string): void {
    const index = this.options.watchPaths.indexOf(path);
    if (index > -1) {
      this.options.watchPaths.splice(index, 1);
      
      const watcher = this.watchers.get(path);
      if (watcher) {
        watcher.close();
        this.watchers.delete(path);
      }
    }
  }

  private async initializeFileTimestamps(): Promise<void> {
    for (const watchPath of this.options.watchPaths) {
      try {
        await this.scanDirectory(watchPath);
      } catch (error) {
        console.error(`Failed to scan directory ${watchPath}:`, error);
      }
    }
  }

  private async scanDirectory(dirPath: string): Promise<void> {
    try {
      const items = await readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = join(dirPath, item.name);
        
        if (item.isFile() && item.name.endsWith(this.options.fileExtension)) {
          const stats = await stat(fullPath);
          this.fileTimestamps.set(fullPath, stats.mtime.getTime());
        } else if (item.isDirectory() && this.options.recursive) {
          await this.scanDirectory(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
  }

  private async startWatching(watchPath: string): Promise<void> {
    try {
      const watcher = watch(watchPath, { recursive: this.options.recursive }, (eventType, filename) => {
        if (filename && filename.endsWith(this.options.fileExtension)) {
          this.handleFileChange(eventType, join(watchPath, filename));
        }
      });

      watcher.on('error', (error) => {
        console.error(`Watcher error for ${watchPath}:`, error);
        this.emit('error', error);
      });

      this.watchers.set(watchPath, watcher);
      console.log(`Started watching: ${watchPath}`);
    } catch (error) {
      console.error(`Failed to watch ${watchPath}:`, error);
      throw error;
    }
  }

  private handleFileChange(eventType: string, filepath: string): void {
    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(filepath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      await this.processFileChange(eventType, filepath);
      this.debounceTimers.delete(filepath);
    }, this.options.debounceMs);

    this.debounceTimers.set(filepath, timer);
  }

  private async processFileChange(eventType: string, filepath: string): Promise<void> {
    try {
      const fileStats = await stat(filepath).catch(() => null);
      const filename = filepath.split('/').pop() || '';
      
      // Determine change type
      let changeType: FileChangeEvent['type'];
      
      if (!fileStats) {
        // File doesn't exist - it was deleted
        changeType = 'deleted';
        this.fileTimestamps.delete(filepath);
      } else {
        const lastModified = this.fileTimestamps.get(filepath);
        const currentModified = fileStats.mtime.getTime();
        
        if (!lastModified) {
          changeType = 'created';
        } else if (currentModified > lastModified) {
          changeType = 'modified';
        } else {
          // No actual change - ignore
          return;
        }
        
        this.fileTimestamps.set(filepath, currentModified);
      }

      // Emit file change event
      const fileChangeEvent: FileChangeEvent = {
        type: changeType,
        filepath,
        filename,
        timestamp: new Date(),
        stats: fileStats || undefined,
      };

      this.emit('fileChanged', fileChangeEvent);

      // For new or modified JSONL files, check for session data
      if (changeType !== 'deleted') {
        await this.detectSessionChanges(filepath);
      }

    } catch (error) {
      console.error(`Error processing file change for ${filepath}:`, error);
      this.emit('error', error);
    }
  }

  private async detectSessionChanges(filepath: string): Promise<void> {
    try {
      // Simple JSONL file parsing to detect session information
      const entries = await this.parseJsonlFile(filepath);
      
      if (entries.length > 0) {
        // Extract session information from the first entry or filename
        const sessionId = this.extractSessionId(filepath, entries);
        
        if (sessionId) {
          const sessionEvent: SessionDetectedEvent = {
            sessionId,
            filepath,
            newEntries: entries.length,
            totalEntries: entries.length,
          };

          this.emit('sessionDetected', sessionEvent);
        }
      }
    } catch (error) {
      console.error(`Error detecting session changes in ${filepath}:`, error);
    }
  }

  /**
   * Simple JSONL file parser - reads first few lines to detect session info
   */
  private async parseJsonlFile(filepath: string): Promise<any[]> {
    const entries: any[] = [];
    let lineCount = 0;
    const maxLinesToRead = 10; // Only read first few lines for session detection

    const fileStream = createReadStream(filepath, { encoding: 'utf8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        if (lineCount >= maxLinesToRead) break;
        
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        try {
          const entry = JSON.parse(trimmedLine);
          if (entry && typeof entry === 'object') {
            entries.push(entry);
            lineCount++;
          }
        } catch (parseError) {
          // Skip invalid JSON lines
          continue;
        }
      }
    } finally {
      rl.close();
      fileStream.destroy();
    }

    return entries;
  }

  private extractSessionId(filepath: string, entries: any[]): string | null {
    // Try to extract session ID from filename or entries
    const filename = filepath.split('/').pop() || '';
    
    // Check if filename contains a UUID-like pattern
    const uuidMatch = filename.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (uuidMatch) {
      return uuidMatch[1];
    }
    
    // Check first entry for session metadata
    if (entries.length > 0) {
      const firstEntry = entries[0];
      if (firstEntry.sessionId) {
        return firstEntry.sessionId;
      }
      if (firstEntry.metadata?.sessionId) {
        return firstEntry.metadata.sessionId;
      }
    }
    
    return null;
  }

  /**
   * Get current monitoring status
   */
  getStatus(): {
    isRunning: boolean;
    watchPaths: string[];
    watchedFiles: number;
    activeWatchers: number;
  } {
    return {
      isRunning: this.isRunning,
      watchPaths: this.options.watchPaths,
      watchedFiles: this.fileTimestamps.size,
      activeWatchers: this.watchers.size,
    };
  }

  /**
   * Manually trigger a rescan of all watched directories
   */
  async rescan(): Promise<void> {
    console.log('Rescanning watched directories...');
    this.fileTimestamps.clear();
    await this.initializeFileTimestamps();
    console.log('Rescan complete');
  }
}

export default FileSystemMonitor;