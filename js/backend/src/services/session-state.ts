import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import ProcessManager, { ProcessInfo } from './process-manager';

export interface SessionData {
  id: string;
  processId?: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  commandHistory: string[];
  status: 'active' | 'inactive' | 'suspended' | 'terminated';
  createdAt: Date;
  lastActiveAt: Date;
  metadata?: Record<string, any>;
}

export interface SessionPersistenceData {
  sessions: SessionData[];
  lastCleanup: Date;
  version: string;
}

export interface SessionStateEvents {
  'session-created': (session: SessionData) => void;
  'session-updated': (session: SessionData) => void;
  'session-suspended': (session: SessionData) => void;
  'session-restored': (session: SessionData) => void;
  'session-terminated': (sessionId: string) => void;
  'orphaned-process-cleaned': (processId: string) => void;
  'error': (error: Error) => void;
}

declare interface SessionStateManager {
  on<U extends keyof SessionStateEvents>(
    event: U, listener: SessionStateEvents[U]
  ): this;
  
  emit<U extends keyof SessionStateEvents>(
    event: U, ...args: Parameters<SessionStateEvents[U]>
  ): boolean;
}

/**
 * SessionStateManager handles persistence and recovery of Claude Code CLI sessions
 * with support for process tracking, session restoration, and orphaned process cleanup.
 * 
 * This implementation uses in-memory storage but is designed to be easily extended
 * to use SQLite or other persistent storage solutions.
 */
class SessionStateManager extends EventEmitter {
  private sessions = new Map<string, SessionData>();
  private processToSession = new Map<string, string>();
  private persistenceData: SessionPersistenceData;
  private cleanupInterval: NodeJS.Timeout;
  
  // Configuration
  private readonly CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_COMMAND_HISTORY = 1000;

  constructor(private processManager?: ProcessManager) {
    super();
    
    this.persistenceData = {
      sessions: [],
      lastCleanup: new Date(),
      version: '1.0.0',
    };

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL);

    // Listen to process manager events if provided
    if (this.processManager) {
      this.setupProcessManagerListeners();
    }
  }

  /**
   * Creates a new session
   */
  async createSession(options: {
    workingDirectory?: string;
    environment?: Record<string, string>;
    metadata?: Record<string, any>;
  } = {}): Promise<string> {
    const sessionId = randomUUID();
    const now = new Date();

    const session: SessionData = {
      id: sessionId,
      workingDirectory: options.workingDirectory,
      environment: options.environment,
      commandHistory: [],
      status: 'active',
      createdAt: now,
      lastActiveAt: now,
      metadata: options.metadata,
    };

    this.sessions.set(sessionId, session);
    await this.persistSessions();
    
    this.emit('session-created', session);
    return sessionId;
  }

  /**
   * Associates a process with a session
   */
  async associateProcess(sessionId: string, processId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Remove old process association if exists
    if (session.processId) {
      this.processToSession.delete(session.processId);
    }

    session.processId = processId;
    session.lastActiveAt = new Date();
    this.processToSession.set(processId, sessionId);

    await this.persistSessions();
    this.emit('session-updated', session);
    return true;
  }

  /**
   * Adds a command to session history
   */
  async addCommandToHistory(sessionId: string, command: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.commandHistory.push(command);
    session.lastActiveAt = new Date();

    // Limit history size
    if (session.commandHistory.length > this.MAX_COMMAND_HISTORY) {
      session.commandHistory = session.commandHistory.slice(-this.MAX_COMMAND_HISTORY);
    }

    await this.persistSessions();
    this.emit('session-updated', session);
    return true;
  }

  /**
   * Updates session metadata
   */
  async updateSession(sessionId: string, updates: Partial<Pick<SessionData, 'workingDirectory' | 'environment' | 'metadata'>>): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (updates.workingDirectory !== undefined) {
      session.workingDirectory = updates.workingDirectory;
    }
    
    if (updates.environment !== undefined) {
      session.environment = { ...session.environment, ...updates.environment };
    }
    
    if (updates.metadata !== undefined) {
      session.metadata = { ...session.metadata, ...updates.metadata };
    }

    session.lastActiveAt = new Date();
    await this.persistSessions();
    
    this.emit('session-updated', session);
    return true;
  }

  /**
   * Suspends a session (keeps data but marks as inactive)
   */
  async suspendSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = 'suspended';
    session.lastActiveAt = new Date();

    // Remove process association but keep session data
    if (session.processId) {
      this.processToSession.delete(session.processId);
      session.processId = undefined;
    }

    await this.persistSessions();
    this.emit('session-suspended', session);
    return true;
  }

  /**
   * Restores a suspended session
   */
  async restoreSession(sessionId: string, processId?: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'terminated') {
      return false;
    }

    session.status = 'active';
    session.lastActiveAt = new Date();

    if (processId) {
      await this.associateProcess(sessionId, processId);
    }

    await this.persistSessions();
    this.emit('session-restored', session);
    return true;
  }

  /**
   * Terminates a session (removes all data)
   */
  async terminateSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Clean up process association
    if (session.processId) {
      this.processToSession.delete(session.processId);
    }

    this.sessions.delete(sessionId);
    await this.persistSessions();
    
    this.emit('session-terminated', sessionId);
    return true;
  }

  /**
   * Gets session data by ID
   */
  getSession(sessionId: string): SessionData | undefined {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : undefined;
  }

  /**
   * Gets session ID by process ID
   */
  getSessionByProcess(processId: string): string | undefined {
    return this.processToSession.get(processId);
  }

  /**
   * Gets all sessions with optional filtering
   */
  getAllSessions(filter?: {
    status?: SessionData['status'];
    activeWithin?: number; // milliseconds
  }): SessionData[] {
    let sessions = Array.from(this.sessions.values());

    if (filter?.status) {
      sessions = sessions.filter(s => s.status === filter.status);
    }

    if (filter?.activeWithin) {
      const cutoff = new Date(Date.now() - filter.activeWithin);
      sessions = sessions.filter(s => s.lastActiveAt > cutoff);
    }

    return sessions.map(session => ({ ...session }));
  }

  /**
   * Gets session statistics
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    return {
      total: sessions.length,
      active: sessions.filter(s => s.status === 'active').length,
      suspended: sessions.filter(s => s.status === 'suspended').length,
      terminated: sessions.filter(s => s.status === 'terminated').length,
      recentlyActive: sessions.filter(s => s.lastActiveAt.getTime() > oneHourAgo).length,
      activePastDay: sessions.filter(s => s.lastActiveAt.getTime() > oneDayAgo).length,
      withProcesses: sessions.filter(s => s.processId).length,
      averageCommandHistory: sessions.reduce((sum, s) => sum + s.commandHistory.length, 0) / sessions.length || 0,
    };
  }

  /**
   * Cleans up expired and orphaned sessions
   */
  async cleanupExpiredSessions(): Promise<{
    expiredSessions: number;
    orphanedProcesses: number;
  }> {
    const now = Date.now();
    const cutoff = now - this.SESSION_TIMEOUT;
    let expiredCount = 0;
    let orphanedCount = 0;

    // Clean up expired sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActiveAt.getTime() < cutoff && session.status !== 'active') {
        await this.terminateSession(sessionId);
        expiredCount++;
      }
    }

    // Clean up orphaned processes (processes without active sessions)
    if (this.processManager) {
      const allProcesses = this.processManager.getAllProcesses();
      for (const process of allProcesses) {
        const sessionId = this.processToSession.get(process.id);
        if (!sessionId || !this.sessions.has(sessionId)) {
          // Orphaned process - terminate it
          await this.processManager.terminate(process.id);
          this.processToSession.delete(process.id);
          orphanedCount++;
          this.emit('orphaned-process-cleaned', process.id);
        }
      }
    }

    this.persistenceData.lastCleanup = new Date();
    await this.persistSessions();

    return { expiredSessions: expiredCount, orphanedProcesses: orphanedCount };
  }

  /**
   * Recovers sessions from persistence (would typically load from database)
   */
  async recoverSessions(): Promise<{
    recovered: number;
    failed: number;
  }> {
    let recovered = 0;
    let failed = 0;

    // In a real implementation, this would load from SQLite
    // For now, sessions are already in memory
    
    for (const [sessionId, session] of this.sessions.entries()) {
      try {
        // Verify session integrity
        if (session.processId && this.processManager) {
          const processInfo = this.processManager.getProcessInfo(session.processId);
          if (!processInfo || processInfo.status !== 'running') {
            // Process is dead, suspend the session
            await this.suspendSession(sessionId);
          } else {
            recovered++;
          }
        } else {
          recovered++;
        }
      } catch (error) {
        console.error(`Failed to recover session ${sessionId}:`, error);
        failed++;
      }
    }

    return { recovered, failed };
  }

  /**
   * Persists sessions to storage (in-memory for now, would be SQLite in production)
   */
  private async persistSessions(): Promise<void> {
    try {
      this.persistenceData.sessions = Array.from(this.sessions.values());
      // In a real implementation, this would write to SQLite
      // await this.writeToDatabase(this.persistenceData);
    } catch (error) {
      console.error('Failed to persist sessions:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Sets up listeners for process manager events
   */
  private setupProcessManagerListeners(): void {
    if (!this.processManager) return;

    this.processManager.on('process-stopped', (processInfo: ProcessInfo) => {
      const sessionId = this.processToSession.get(processInfo.id);
      if (sessionId) {
        // Process stopped, suspend the session
        this.suspendSession(sessionId);
      }
    });

    this.processManager.on('process-error', (processInfo: ProcessInfo) => {
      const sessionId = this.processToSession.get(processInfo.id);
      if (sessionId) {
        // Process failed, suspend the session
        this.suspendSession(sessionId);
      }
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('SessionStateManager shutting down...');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Suspend all active sessions
    const activeSessions = this.getAllSessions({ status: 'active' });
    for (const session of activeSessions) {
      await this.suspendSession(session.id);
    }

    await this.persistSessions();
    console.log('SessionStateManager shutdown complete');
  }

  /**
   * Gets the raw persistence data (for debugging/testing)
   */
  getPersistenceData(): SessionPersistenceData {
    return { ...this.persistenceData };
  }
}

export default SessionStateManager;