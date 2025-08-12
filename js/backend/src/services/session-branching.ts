import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { 
  JsonlParser,
  TranscriptEntry,
  SessionInfo,
  organizeIntoSessionsOptimized,
  parseTranscriptEntriesOptimized,
} from '@app/shared';
import SessionStateManager, { SessionData } from './session-state';
import WebSocketBranchNotificationService from './websocket-branch-notifications';

export interface BranchCreationRequest {
  parentSessionId: string;
  branchPoint: number;
  metadata?: {
    branchName?: string;
    branchReason?: string;
    originalMessage?: string;
  };
  workingDirectory?: string;
  environment?: Record<string, string>;
}

export interface BranchCreationResponse {
  sessionId: string;
  session: SessionData;
  success: boolean;
  error?: string;
}

export interface BranchValidationResponse {
  valid: boolean;
  error?: string;
  messageExists?: boolean;
  messageType?: string;
  messagePreview?: string;
}

/**
 * Service for handling session branching operations
 * Integrates SessionStateManager with JSONL-based session data
 */
export class SessionBranchingService {
  private sessionStateManager: SessionStateManager;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private branchNotificationService?: WebSocketBranchNotificationService;

  constructor(branchNotificationService?: WebSocketBranchNotificationService) {
    this.sessionStateManager = new SessionStateManager();
    this.branchNotificationService = branchNotificationService;
  }

  /**
   * Create a new branch from an existing session
   */
  async createBranch(
    request: BranchCreationRequest,
    directoryPath?: string
  ): Promise<BranchCreationResponse> {
    try {
      // Validate the parent session exists in SessionStateManager
      const parentSession = this.sessionStateManager.getSession(request.parentSessionId);
      if (!parentSession) {
        return {
          sessionId: '',
          session: {} as SessionData,
          success: false,
          error: `Parent session ${request.parentSessionId} not found`,
        };
      }

      // If directoryPath is provided, validate the branch point against JSONL data
      if (directoryPath) {
        const validation = await this.validateBranchPoint(
          request.parentSessionId,
          request.branchPoint,
          directoryPath
        );

        if (!validation.valid) {
          return {
            sessionId: '',
            session: {} as SessionData,
            success: false,
            error: validation.error || 'Invalid branch point',
          };
        }
      }

      // Create the branch session using SessionStateManager
      const branchSessionId = await this.sessionStateManager.createBranch(
        request.parentSessionId,
        request.branchPoint,
        {
          branchName: request.metadata?.branchName,
          branchReason: request.metadata?.branchReason,
          originalMessage: request.metadata?.originalMessage,
          workingDirectory: request.workingDirectory || parentSession.workingDirectory,
          environment: request.environment || parentSession.environment,
        }
      );

      if (!branchSessionId) {
        return {
          sessionId: '',
          session: {} as SessionData,
          success: false,
          error: 'Failed to create branch session',
        };
      }

      // Get the created session data
      const branchSession = this.sessionStateManager.getSession(branchSessionId);
      if (!branchSession) {
        return {
          sessionId: '',
          session: {} as SessionData,
          success: false,
          error: 'Branch session created but could not be retrieved',
        };
      }

      // If directoryPath is provided, create the JSONL file for the branch
      if (directoryPath) {
        await this.createBranchJsonlFile(
          branchSessionId,
          request.parentSessionId,
          request.branchPoint,
          directoryPath
        );
      }

      // Emit WebSocket notification if service is available
      if (this.branchNotificationService) {
        await this.branchNotificationService.notifyBranchCreated(parentSession, branchSession);
      }

      return {
        sessionId: branchSessionId,
        session: branchSession,
        success: true,
      };

    } catch (error) {
      return {
        sessionId: '',
        session: {} as SessionData,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating branch',
      };
    }
  }

  /**
   * Validate that a branch point is valid for a given session
   */
  async validateBranchPoint(
    sessionId: string,
    branchPoint: number,
    directoryPath: string
  ): Promise<BranchValidationResponse> {
    try {
      // Check cache first
      const cacheKey = `validate-${sessionId}-${branchPoint}-${directoryPath}`;
      const cached = this.getCache(cacheKey);
      if (cached) return cached;

      // Parse JSONL files to get session entries
      const sessionInfo = await this.getSessionFromJsonl(sessionId, directoryPath);
      if (!sessionInfo) {
        return {
          valid: false,
          error: `Session ${sessionId} not found in directory ${directoryPath}`,
        };
      }

      // Check if branch point index exists
      if (branchPoint >= sessionInfo.entries.length) {
        return {
          valid: false,
          error: `Branch point ${branchPoint} exceeds session length (${sessionInfo.entries.length})`,
          messageExists: false,
        };
      }

      const entry = sessionInfo.entries[branchPoint];
      
      // Typically, we only allow branching from assistant messages
      const isValidType = entry.type === 'assistant';
      if (!isValidType) {
        return {
          valid: false,
          error: `Branch point ${branchPoint} is not an assistant message (type: ${entry.type})`,
          messageExists: true,
          messageType: entry.type,
        };
      }

      // Extract message preview
      const messagePreview = this.extractMessagePreview(entry);

      const result = {
        valid: true,
        messageExists: true,
        messageType: entry.type,
        messagePreview,
      };

      // Cache the result
      this.setCache(cacheKey, result);
      return result;

    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error validating branch point',
      };
    }
  }

  /**
   * Get all branches for a parent session
   */
  async getBranches(parentSessionId: string): Promise<SessionData[]> {
    return this.sessionStateManager.getBranches(parentSessionId);
  }

  /**
   * Get the complete branch tree for a session
   */
  async getBranchTree(rootSessionId: string) {
    return this.sessionStateManager.getBranchTree(rootSessionId);
  }

  /**
   * Delete a branch and its descendants
   */
  async deleteBranch(branchSessionId: string): Promise<boolean> {
    return this.sessionStateManager.terminateSession(branchSessionId);
  }

  /**
   * Get session info from JSONL files
   */
  private async getSessionFromJsonl(
    sessionId: string,
    directoryPath: string
  ): Promise<SessionInfo | null> {
    try {
      // Parse JSONL files
      const files = await fs.readdir(directoryPath);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

      if (jsonlFiles.length === 0) {
        throw new Error(`No JSONL files found in directory: ${directoryPath}`);
      }

      const parser = new JsonlParser({ 
        skipInvalidLines: true,
        batchSize: 1000,
      });

      let allEntries: TranscriptEntry[] = [];

      for (const file of jsonlFiles) {
        const filePath = join(directoryPath, file);
        const result = await parser.parseFile(filePath);
        allEntries.push(...result.entries);
      }

      // Organize into sessions
      const sessions = await organizeIntoSessionsOptimized(allEntries, {
        useCache: true,
        includeTokenUsage: true,
        includeMessagePreviews: true,
      });

      // Find the specific session
      return sessions.find(s => s.sessionId === sessionId) || null;

    } catch (error) {
      console.error('Error getting session from JSONL:', error);
      return null;
    }
  }

  /**
   * Create a JSONL file for a new branch session
   */
  private async createBranchJsonlFile(
    branchSessionId: string,
    parentSessionId: string,
    branchPoint: number,
    directoryPath: string
  ): Promise<void> {
    try {
      // Get parent session data
      const parentSessionInfo = await this.getSessionFromJsonl(parentSessionId, directoryPath);
      if (!parentSessionInfo) {
        throw new Error(`Parent session ${parentSessionId} not found for JSONL creation`);
      }

      // Copy entries up to branch point
      const branchEntries = parentSessionInfo.entries.slice(0, branchPoint + 1);
      
      // Update session IDs in the copied entries
      const updatedEntries = branchEntries.map(entry => ({
        ...entry,
        sessionId: branchSessionId,
        // Add branch metadata to the first entry
        ...(entry === branchEntries[0] && {
          metadata: {
            ...((entry as any).metadata || {}),
            branch: {
              parentSessionId,
              branchPoint,
              branchTimestamp: new Date().toISOString(),
              branchMetadata: this.sessionStateManager.getSession(branchSessionId)?.branchMetadata,
            }
          }
        })
      }));

      // Write to new JSONL file
      const branchFileName = `${branchSessionId}.jsonl`;
      const branchFilePath = join(directoryPath, branchFileName);
      
      const jsonlContent = updatedEntries
        .map(entry => JSON.stringify(entry))
        .join('\n');

      await fs.writeFile(branchFilePath, jsonlContent, 'utf8');

    } catch (error) {
      console.error('Error creating branch JSONL file:', error);
      // Don't throw here - branch creation in SessionStateManager already succeeded
    }
  }

  /**
   * Extract preview text from a transcript entry
   */
  private extractMessagePreview(entry: TranscriptEntry, maxLength: number = 150): string {
    try {
      if (entry.type === 'user') {
        const userEntry = entry as any;
        const content = userEntry.message?.content;
        if (typeof content === 'string') {
          return content.slice(0, maxLength);
        }
        if (Array.isArray(content) && content.length > 0) {
          const firstTextContent = content.find((item: any) => item.type === 'text');
          return firstTextContent ? firstTextContent.text.slice(0, maxLength) : 'Complex message...';
        }
      }
      
      if (entry.type === 'assistant') {
        const assistantEntry = entry as any;
        const content = assistantEntry.message?.content;
        if (Array.isArray(content) && content.length > 0) {
          const textContent = content.find((item: any) => item.type === 'text');
          return textContent ? textContent.text.slice(0, maxLength) : 'Tool use or thinking...';
        }
      }

      return 'Message content';
    } catch (error) {
      return 'Unable to preview message';
    }
  }

  /**
   * Cache management utilities
   */
  private isCacheValid(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private setCache(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  private getCache(key: string): any | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key)?.data || null;
    }
    return null;
  }

  /**
   * Clear the service cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export default SessionBranchingService;