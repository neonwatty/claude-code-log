import { randomUUID } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { 
  TranscriptEntry, 
  SessionInfo, 
  ContentItem,
  TokenUsageTimepoint,
  SessionTokenUsage,
  ProjectTokenUsage 
} from '@app/shared';
import { SessionData } from './session-state';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Serializable session context for CLI consumption
 */
export interface SerializableSessionContext {
  /** Context metadata */
  id: string;
  sessionId: string;
  createdAt: string;
  version: string;
  
  /** Session basic information */
  session: {
    id: string;
    title?: string;
    cwd: string;
    startTime: string;
    endTime?: string;
    isActive: boolean;
    tags?: string[];
    summary?: string;
  };

  /** Session entries */
  entries: {
    total: number;
    included: number;
    data: TranscriptEntry[];
    range?: {
      startIndex: number;
      endIndex: number;
    };
  };

  /** Token usage information */
  tokenUsage?: {
    session: SessionTokenUsage;
    project?: ProjectTokenUsage;
    timepoints: TokenUsageTimepoint[];
  };

  /** File references and context */
  files: {
    referenced: string[];
    recent: string[];
    working: string[];
  };

  /** Tools and commands used */
  tools: {
    used: string[];
    recent: string[];
    commands: string[];
  };

  /** User preferences and state */
  preferences?: {
    displayMode?: string;
    theme?: string;
    filters?: Record<string, any>;
    lastPosition?: {
      messageIndex: number;
      timestamp: string;
    };
  };

  /** CLI-specific metadata */
  cli: {
    transferId: string;
    compression: boolean;
    partialContext: boolean;
    contextType: 'full' | 'partial' | 'recent' | 'range';
    size: {
      uncompressed: number;
      compressed?: number;
    };
  };
}

/**
 * Context serialization options
 */
export interface ContextSerializationOptions {
  /** Include all entries or limit to recent */
  includeAllEntries?: boolean;
  /** Maximum number of entries to include */
  maxEntries?: number;
  /** Include entries within date range */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** Include specific message indices */
  messageRange?: {
    start: number;
    end: number;
  };
  /** Include token usage statistics */
  includeTokenUsage?: boolean;
  /** Include file references */
  includeFiles?: boolean;
  /** Include tool usage */
  includeTools?: boolean;
  /** Include user preferences */
  includePreferences?: boolean;
  /** Compress the serialized data */
  compress?: boolean;
  /** Context type identifier */
  contextType?: 'full' | 'partial' | 'recent' | 'range';
}

/**
 * Serialized context package for transfer
 */
export interface SerializedContextPackage {
  /** Package metadata */
  id: string;
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
  
  /** Serialized context data */
  context: SerializableSessionContext | Buffer;
  
  /** Package info */
  info: {
    compressed: boolean;
    size: number;
    originalSize?: number;
    checksum: string;
    version: string;
  };

  /** Transfer status */
  status: 'pending' | 'ready' | 'transferred' | 'expired';
}

/**
 * Context preparation result
 */
export interface ContextPreparationResult {
  /** Transfer package */
  package: SerializedContextPackage;
  
  /** Preparation statistics */
  stats: {
    entriesIncluded: number;
    totalEntries: number;
    filesReferenced: number;
    toolsUsed: number;
    processingTimeMs: number;
    compressionRatio?: number;
  };

  /** Warnings or issues */
  warnings?: string[];
}

/**
 * Context Serialization Service
 * 
 * Handles preparing session context and state for transfer to Claude Code CLI,
 * including compression, filtering, and packaging of session data.
 */
export class ContextSerializer {
  private packages = new Map<string, SerializedContextPackage>();
  private readonly PACKAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly DEFAULT_MAX_ENTRIES = 1000;
  private readonly COMPRESSION_THRESHOLD = 50 * 1024; // 50KB

  constructor() {
    // Periodic cleanup of expired packages
    setInterval(() => {
      this.cleanupExpiredPackages();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Serializes session context for CLI consumption
   */
  async serializeSessionContext(
    sessionInfo: SessionInfo,
    entries: TranscriptEntry[],
    sessionData?: SessionData,
    options: ContextSerializationOptions = {}
  ): Promise<SerializableSessionContext> {
    const startTime = Date.now();

    // Apply entry filtering
    const filteredEntries = this.filterEntries(entries, options);

    // Extract file references
    const files = this.extractFileReferences(filteredEntries);

    // Extract tool usage
    const tools = this.extractToolUsage(filteredEntries);

    // Build context object
    const context: SerializableSessionContext = {
      id: randomUUID(),
      sessionId: sessionInfo.sessionId,
      createdAt: new Date().toISOString(),
      version: '1.0.0',

      session: {
        id: sessionInfo.sessionId,
        title: sessionInfo.title,
        cwd: sessionInfo.cwd,
        startTime: sessionInfo.startTime.toISOString(),
        endTime: sessionInfo.endTime?.toISOString(),
        isActive: sessionInfo.isActive,
        tags: sessionInfo.tags,
        summary: sessionInfo.summary,
      },

      entries: {
        total: entries.length,
        included: filteredEntries.length,
        data: filteredEntries,
        range: options.messageRange ? {
          startIndex: options.messageRange.start,
          endIndex: options.messageRange.end,
        } : undefined,
      },

      files: options.includeFiles !== false ? files : {
        referenced: [],
        recent: [],
        working: [],
      },

      tools: options.includeTools !== false ? tools : {
        used: [],
        recent: [],
        commands: [],
      },

      cli: {
        transferId: randomUUID(),
        compression: options.compress !== false,
        partialContext: !options.includeAllEntries || filteredEntries.length < entries.length,
        contextType: options.contextType || (filteredEntries.length < entries.length ? 'partial' : 'full'),
        size: {
          uncompressed: JSON.stringify(filteredEntries).length,
        },
      },
    };

    // Add token usage if requested
    if (options.includeTokenUsage && sessionInfo.tokenUsage) {
      context.tokenUsage = {
        session: {
          sessionId: sessionInfo.sessionId,
          totalInputTokens: sessionInfo.tokenUsage.inputTokens,
          totalOutputTokens: sessionInfo.tokenUsage.outputTokens,
          totalTokens: sessionInfo.tokenUsage.totalTokens,
          costEstimate: 0, // Would be calculated based on model pricing
          timepoints: [],
        },
        timepoints: [], // Would be populated from token tracker
      };
    }

    // Add preferences if available
    if (options.includePreferences && sessionData?.metadata?.preferences) {
      context.preferences = sessionData.metadata.preferences;
    }

    return context;
  }

  /**
   * Prepares a context package for CLI transfer
   */
  async prepareContextPackage(
    sessionInfo: SessionInfo,
    entries: TranscriptEntry[],
    sessionData?: SessionData,
    options: ContextSerializationOptions = {}
  ): Promise<ContextPreparationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Serialize the context
      const context = await this.serializeSessionContext(sessionInfo, entries, sessionData, options);
      
      // Calculate size
      const contextJson = JSON.stringify(context);
      const originalSize = Buffer.byteLength(contextJson, 'utf8');
      
      let finalContext: SerializableSessionContext | Buffer = context;
      let compressed = false;
      let compressionRatio: number | undefined;

      // Apply compression if enabled and size threshold met
      if (options.compress !== false && originalSize > this.COMPRESSION_THRESHOLD) {
        try {
          const compressedBuffer = await gzipAsync(contextJson);
          if (compressedBuffer.length < originalSize * 0.8) { // Only use if significant compression
            finalContext = compressedBuffer;
            compressed = true;
            compressionRatio = originalSize / compressedBuffer.length;
            context.cli.size.compressed = compressedBuffer.length;
          }
        } catch (error) {
          warnings.push(`Compression failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Generate checksum
      const checksum = this.generateChecksum(typeof finalContext === 'string' ? contextJson : finalContext);

      // Create package
      const packageInfo: SerializedContextPackage = {
        id: randomUUID(),
        sessionId: sessionInfo.sessionId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.PACKAGE_EXPIRY),
        context: finalContext,
        info: {
          compressed,
          size: typeof finalContext === 'object' && Buffer.isBuffer(finalContext) ? finalContext.length : originalSize,
          originalSize: compressed ? originalSize : undefined,
          checksum,
          version: '1.0.0',
        },
        status: 'ready',
      };

      // Store package
      this.packages.set(packageInfo.id, packageInfo);

      const processingTime = Date.now() - startTime;

      return {
        package: packageInfo,
        stats: {
          entriesIncluded: context.entries.included,
          totalEntries: context.entries.total,
          filesReferenced: context.files.referenced.length,
          toolsUsed: context.tools.used.length,
          processingTimeMs: processingTime,
          compressionRatio,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };

    } catch (error) {
      throw new Error(`Failed to prepare context package: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieves a prepared context package
   */
  async getContextPackage(packageId: string): Promise<SerializedContextPackage | null> {
    const pkg = this.packages.get(packageId);
    
    if (!pkg) {
      return null;
    }

    if (pkg.status === 'expired' || new Date() > pkg.expiresAt) {
      this.packages.delete(packageId);
      return null;
    }

    return pkg;
  }

  /**
   * Deserializes a context package
   */
  async deserializeContextPackage(pkg: SerializedContextPackage): Promise<SerializableSessionContext> {
    try {
      let contextData: string;

      if (Buffer.isBuffer(pkg.context)) {
        // Decompress if needed
        if (pkg.info.compressed) {
          const decompressedBuffer = await gunzipAsync(pkg.context);
          contextData = decompressedBuffer.toString('utf8');
        } else {
          contextData = pkg.context.toString('utf8');
        }
      } else {
        contextData = JSON.stringify(pkg.context);
      }

      // Verify checksum
      const calculatedChecksum = this.generateChecksum(pkg.context);
      if (calculatedChecksum !== pkg.info.checksum) {
        throw new Error('Context package checksum mismatch - data may be corrupted');
      }

      return JSON.parse(contextData);

    } catch (error) {
      throw new Error(`Failed to deserialize context package: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Marks a package as transferred
   */
  markPackageTransferred(packageId: string): boolean {
    const pkg = this.packages.get(packageId);
    if (pkg && pkg.status === 'ready') {
      pkg.status = 'transferred';
      return true;
    }
    return false;
  }

  /**
   * Gets package transfer statistics
   */
  getPackageStats(): {
    total: number;
    pending: number;
    ready: number;
    transferred: number;
    expired: number;
  } {
    const packages = Array.from(this.packages.values());
    const now = new Date();

    return {
      total: packages.length,
      pending: packages.filter(p => p.status === 'pending').length,
      ready: packages.filter(p => p.status === 'ready' && p.expiresAt > now).length,
      transferred: packages.filter(p => p.status === 'transferred').length,
      expired: packages.filter(p => p.status === 'expired' || p.expiresAt <= now).length,
    };
  }

  /**
   * Filters transcript entries based on options
   */
  private filterEntries(entries: TranscriptEntry[], options: ContextSerializationOptions): TranscriptEntry[] {
    let filtered = [...entries];

    // Date range filtering
    if (options.dateRange) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= options.dateRange!.start && entryDate <= options.dateRange!.end;
      });
    }

    // Message range filtering
    if (options.messageRange) {
      filtered = filtered.slice(options.messageRange.start, options.messageRange.end + 1);
    }

    // Limit entries if not including all
    if (!options.includeAllEntries) {
      const maxEntries = options.maxEntries || this.DEFAULT_MAX_ENTRIES;
      if (filtered.length > maxEntries) {
        // Take most recent entries
        filtered = filtered.slice(-maxEntries);
      }
    }

    return filtered;
  }

  /**
   * Extracts file references from transcript entries
   */
  private extractFileReferences(entries: TranscriptEntry[]): {
    referenced: string[];
    recent: string[];
    working: string[];
  } {
    const allFiles = new Set<string>();
    const recentFiles = new Set<string>();
    const workingDirs = new Set<string>();

    for (const entry of entries) {
      // Add working directory
      if (entry.cwd) {
        workingDirs.add(entry.cwd);
      }

      // Extract file paths from content
      if (entry.type === 'user' || entry.type === 'assistant') {
        const content = entry.message.content;
        const contentArray = Array.isArray(content) ? content : [{ type: 'text', text: content }] as ContentItem[];
        
        for (const item of contentArray) {
          if (item.type === 'text') {
            // Simple file path extraction (could be enhanced)
            const fileMatches = item.text.match(/[\/\w\.\-]+\.(ts|js|py|md|json|yaml|yml|txt|css|html)/g);
            if (fileMatches) {
              fileMatches.forEach(file => allFiles.add(file));
            }
          } else if (item.type === 'tool_use' && item.name === 'str_replace_editor') {
            // Extract file paths from editor tool use
            if (item.input.command === 'str_replace' && item.input.path) {
              allFiles.add(item.input.path);
            }
          }
        }
      }
    }

    // Recent files are from the last 10 entries
    const recentEntries = entries.slice(-10);
    for (const entry of recentEntries) {
      if (entry.type === 'user' || entry.type === 'assistant') {
        const content = entry.message.content;
        const contentArray = Array.isArray(content) ? content : [{ type: 'text', text: content }] as ContentItem[];
        
        for (const item of contentArray) {
          if (item.type === 'text') {
            const fileMatches = item.text.match(/[\/\w\.\-]+\.(ts|js|py|md|json|yaml|yml|txt|css|html)/g);
            if (fileMatches) {
              fileMatches.forEach(file => recentFiles.add(file));
            }
          }
        }
      }
    }

    return {
      referenced: Array.from(allFiles),
      recent: Array.from(recentFiles),
      working: Array.from(workingDirs),
    };
  }

  /**
   * Extracts tool usage information from transcript entries
   */
  private extractToolUsage(entries: TranscriptEntry[]): {
    used: string[];
    recent: string[];
    commands: string[];
  } {
    const allTools = new Set<string>();
    const recentTools = new Set<string>();
    const commands = new Set<string>();

    for (const entry of entries) {
      if (entry.type === 'assistant') {
        for (const item of entry.message.content) {
          if (item.type === 'tool_use') {
            allTools.add(item.name);
            
            // Extract commands for bash/shell tools
            if (item.name === 'bash' && item.input.command) {
              commands.add(item.input.command);
            }
          }
        }
      }
    }

    // Recent tools from last 5 entries
    const recentEntries = entries.slice(-5);
    for (const entry of recentEntries) {
      if (entry.type === 'assistant') {
        for (const item of entry.message.content) {
          if (item.type === 'tool_use') {
            recentTools.add(item.name);
          }
        }
      }
    }

    return {
      used: Array.from(allTools),
      recent: Array.from(recentTools),
      commands: Array.from(commands),
    };
  }

  /**
   * Generates a checksum for data integrity verification
   */
  private generateChecksum(data: string | Buffer): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Cleans up expired packages
   */
  private cleanupExpiredPackages(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [id, pkg] of this.packages.entries()) {
      if (pkg.status === 'expired' || pkg.expiresAt <= now) {
        this.packages.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired context packages`);
    }
  }

  /**
   * Shutdown cleanup
   */
  async shutdown(): Promise<void> {
    this.packages.clear();
    console.log('ContextSerializer shutdown complete');
  }
}

export default ContextSerializer;