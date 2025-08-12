import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { 
  SessionStatusData, 
  SessionStatusEvent,
  SessionStatusSubscription 
} from '../types/websocket';
import { EventManager } from './eventManager';
import SessionStateManager, { SessionData } from './session-state';

export interface SessionStatusTrackerEvents {
  'status-changed': (sessionId: string, statusData: SessionStatusData) => void;
  'progress-updated': (sessionId: string, progress: SessionStatusData['progress']) => void;
  'metadata-changed': (sessionId: string, metadata: Record<string, any>) => void;
  'performance-updated': (sessionId: string, performance: SessionStatusData['performance']) => void;
  'error-occurred': (sessionId: string, error: SessionStatusData['errors'][0]) => void;
  'warning-issued': (sessionId: string, warning: SessionStatusData['warnings'][0]) => void;
}

declare interface SessionStatusTracker {
  on<U extends keyof SessionStatusTrackerEvents>(
    event: U, listener: SessionStatusTrackerEvents[U]
  ): this;
  
  emit<U extends keyof SessionStatusTrackerEvents>(
    event: U, ...args: Parameters<SessionStatusTrackerEvents[U]>
  ): boolean;
}

/**
 * SessionStatusTracker monitors and tracks session status changes with persistent state management.
 * Integrates with SessionStateManager and EventManager to provide real-time status updates.
 */
class SessionStatusTracker extends EventEmitter {
  private statusCache = new Map<string, SessionStatusData>();
  private statusHistory = new Map<string, Array<{ timestamp: string; status: SessionStatusData['status'] }>>();
  
  // Configuration
  private readonly MAX_HISTORY_PER_SESSION = 100;
  private readonly STATUS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly PERFORMANCE_UPDATE_INTERVAL = 10 * 1000; // 10 seconds
  
  private performanceUpdateInterval?: NodeJS.Timeout;

  constructor(
    private eventManager: EventManager,
    private sessionStateManager?: SessionStateManager
  ) {
    super();
    
    // Set up session state manager listeners if provided
    if (this.sessionStateManager) {
      this.setupSessionStateListeners();
    }
    
    // Start performance monitoring
    this.startPerformanceMonitoring();
  }

  /**
   * Updates the status of a session
   */
  async updateSessionStatus(
    sessionId: string,
    status: SessionStatusData['status']['current'],
    reason?: string,
    source: SessionStatusData['status']['source'] = 'system'
  ): Promise<boolean> {
    const currentStatusData = this.statusCache.get(sessionId) || this.createDefaultStatusData(sessionId);
    const previousStatus = currentStatusData.status.current;
    
    // Update status
    currentStatusData.status = {
      current: status,
      lastChanged: new Date().toISOString(),
      reason,
      source
    };
    currentStatusData.lastUpdated = new Date().toISOString();
    
    // Update cache
    this.statusCache.set(sessionId, currentStatusData);
    
    // Add to history
    this.addToStatusHistory(sessionId, status);
    
    // Create and broadcast event
    const statusEvent = this.eventManager.createSessionStatusEvent(
      'session:status-changed',
      {
        sessionId,
        status: {
          current: status,
          previous: previousStatus,
          reason,
          source
        }
      }
    );
    
    await this.eventManager.publishEvent(statusEvent);
    await this.eventManager.broadcastSessionStatus(sessionId, statusEvent.data);
    
    // Emit local event
    this.emit('status-changed', sessionId, currentStatusData);
    
    return true;
  }

  /**
   * Updates session progress
   */
  async updateProgress(
    sessionId: string,
    progress: {
      current: number;
      total: number;
      stage?: string;
      description?: string;
      estimatedTimeRemaining?: number;
    }
  ): Promise<boolean> {
    const statusData = this.statusCache.get(sessionId) || this.createDefaultStatusData(sessionId);
    
    const progressData = {
      ...progress,
      percentage: Math.round((progress.current / progress.total) * 100)
    };
    
    statusData.progress = progressData;
    statusData.lastUpdated = new Date().toISOString();
    
    this.statusCache.set(sessionId, statusData);
    
    // Create and broadcast event
    const progressEvent = this.eventManager.createSessionStatusEvent(
      'session:progress-updated',
      {
        sessionId,
        progress: progressData
      }
    );
    
    await this.eventManager.publishEvent(progressEvent);
    await this.eventManager.broadcastSessionStatus(sessionId, progressEvent.data);
    
    this.emit('progress-updated', sessionId, progressData);
    
    return true;
  }

  /**
   * Updates session metadata
   */
  async updateMetadata(
    sessionId: string,
    changes: Record<string, any>,
    added?: Record<string, any>,
    removed?: string[]
  ): Promise<boolean> {
    const statusData = this.statusCache.get(sessionId) || this.createDefaultStatusData(sessionId);
    
    // Apply changes
    statusData.metadata = { ...statusData.metadata, ...changes };
    
    // Apply additions
    if (added) {
      statusData.metadata = { ...statusData.metadata, ...added };
    }
    
    // Apply removals
    if (removed) {
      for (const key of removed) {
        delete statusData.metadata[key];
      }
    }
    
    statusData.lastUpdated = new Date().toISOString();
    this.statusCache.set(sessionId, statusData);
    
    // Create and broadcast event
    const metadataEvent = this.eventManager.createSessionStatusEvent(
      'session:metadata-changed',
      {
        sessionId,
        metadata: {
          changed: changes,
          added,
          removed,
          full: statusData.metadata
        }
      }
    );
    
    await this.eventManager.publishEvent(metadataEvent);
    await this.eventManager.broadcastSessionStatus(sessionId, metadataEvent.data);
    
    this.emit('metadata-changed', sessionId, statusData.metadata);
    
    return true;
  }

  /**
   * Updates performance metrics for a session
   */
  async updatePerformance(
    sessionId: string,
    performance: Partial<SessionStatusData['performance']>
  ): Promise<boolean> {
    const statusData = this.statusCache.get(sessionId) || this.createDefaultStatusData(sessionId);
    
    statusData.performance = { ...statusData.performance, ...performance };
    statusData.lastUpdated = new Date().toISOString();
    
    this.statusCache.set(sessionId, statusData);
    
    // Create and broadcast event
    const performanceEvent = this.eventManager.createSessionStatusEvent(
      'session:performance-updated',
      {
        sessionId,
        performance: statusData.performance
      }
    );
    
    await this.eventManager.publishEvent(performanceEvent);
    await this.eventManager.broadcastSessionStatus(sessionId, performanceEvent.data);
    
    this.emit('performance-updated', sessionId, statusData.performance);
    
    return true;
  }

  /**
   * Records an error for a session
   */
  async recordError(
    sessionId: string,
    error: {
      code: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      stack?: string;
      context?: Record<string, any>;
      recoverable: boolean;
    }
  ): Promise<boolean> {
    const statusData = this.statusCache.get(sessionId) || this.createDefaultStatusData(sessionId);
    
    const errorWithTimestamp = {
      ...error,
      timestamp: new Date().toISOString()
    };
    
    statusData.errors.push(errorWithTimestamp);
    statusData.lastUpdated = new Date().toISOString();
    
    // Limit error history
    if (statusData.errors.length > 50) {
      statusData.errors = statusData.errors.slice(-50);
    }
    
    this.statusCache.set(sessionId, statusData);
    
    // Create and broadcast event
    const errorEvent = this.eventManager.createSessionStatusEvent(
      'session:error-occurred',
      {
        sessionId,
        error
      }
    );
    
    await this.eventManager.publishEvent(errorEvent);
    await this.eventManager.broadcastSessionStatus(sessionId, errorEvent.data);
    
    this.emit('error-occurred', sessionId, errorWithTimestamp);
    
    return true;
  }

  /**
   * Records a warning for a session
   */
  async recordWarning(
    sessionId: string,
    warning: {
      code: string;
      message: string;
      level: 'info' | 'warning' | 'error';
      context?: Record<string, any>;
      autoResolve?: boolean;
    }
  ): Promise<boolean> {
    const statusData = this.statusCache.get(sessionId) || this.createDefaultStatusData(sessionId);
    
    const warningWithTimestamp = {
      ...warning,
      timestamp: new Date().toISOString()
    };
    
    statusData.warnings.push(warningWithTimestamp);
    statusData.lastUpdated = new Date().toISOString();
    
    // Limit warning history
    if (statusData.warnings.length > 50) {
      statusData.warnings = statusData.warnings.slice(-50);
    }
    
    this.statusCache.set(sessionId, statusData);
    
    // Create and broadcast event
    const warningEvent = this.eventManager.createSessionStatusEvent(
      'session:warning-issued',
      {
        sessionId,
        warning
      }
    );
    
    await this.eventManager.publishEvent(warningEvent);
    await this.eventManager.broadcastSessionStatus(sessionId, warningEvent.data);
    
    this.emit('warning-issued', sessionId, warningWithTimestamp);
    
    return true;
  }

  /**
   * Gets the current status data for a session
   */
  getSessionStatus(sessionId: string): SessionStatusData | null {
    const statusData = this.statusCache.get(sessionId);
    if (!statusData) {
      return null;
    }
    
    // Check if cache is still valid
    const age = Date.now() - new Date(statusData.lastUpdated).getTime();
    if (age > this.STATUS_CACHE_TTL) {
      // Refresh status from session state if available
      this.refreshStatusFromSessionState(sessionId);
    }
    
    return { ...statusData };
  }

  /**
   * Gets status history for a session
   */
  getStatusHistory(sessionId: string): Array<{ timestamp: string; status: string }> {
    const history = this.statusHistory.get(sessionId);
    return history ? [...history] : [];
  }

  /**
   * Tracks file system changes for a session
   */
  async trackFileSystemChange(sessionId: string, changeType: 'file-created' | 'file-modified' | 'file-deleted'): Promise<void> {
    const statusData = this.statusCache.get(sessionId);
    if (statusData) {
      statusData.performance.fileSystemOps = (statusData.performance.fileSystemOps || 0) + 1;
      statusData.performance.lastActivity = new Date().toISOString();
      
      await this.updatePerformance(sessionId, {
        fileSystemOps: statusData.performance.fileSystemOps,
        lastActivity: statusData.performance.lastActivity
      });
    }
  }

  /**
   * Creates default status data for a new session
   */
  private createDefaultStatusData(sessionId: string): SessionStatusData {
    const now = new Date().toISOString();
    
    return {
      sessionId,
      status: {
        current: 'idle',
        lastChanged: now,
        source: 'system'
      },
      metadata: {},
      performance: {
        messageCount: 0,
        fileSystemOps: 0,
        lastActivity: now
      },
      errors: [],
      warnings: [],
      lastUpdated: now
    };
  }

  /**
   * Adds status change to history
   */
  private addToStatusHistory(sessionId: string, status: string): void {
    if (!this.statusHistory.has(sessionId)) {
      this.statusHistory.set(sessionId, []);
    }
    
    const history = this.statusHistory.get(sessionId)!;
    history.push({
      timestamp: new Date().toISOString(),
      status
    });
    
    // Limit history size
    if (history.length > this.MAX_HISTORY_PER_SESSION) {
      history.splice(0, history.length - this.MAX_HISTORY_PER_SESSION);
    }
  }

  /**
   * Refreshes status from session state manager
   */
  private refreshStatusFromSessionState(sessionId: string): void {
    if (!this.sessionStateManager) return;
    
    const session = this.sessionStateManager.getSession(sessionId);
    if (session) {
      const statusData = this.statusCache.get(sessionId) || this.createDefaultStatusData(sessionId);
      
      // Map session status to our status format
      let sessionStatus: SessionStatusData['status']['current'] = 'idle';
      if (session.status === 'active') {
        sessionStatus = 'active';
      } else if (session.status === 'suspended') {
        sessionStatus = 'paused';
      } else if (session.status === 'terminated') {
        sessionStatus = 'completed';
      }
      
      statusData.status.current = sessionStatus;
      statusData.lastUpdated = new Date().toISOString();
      
      this.statusCache.set(sessionId, statusData);
    }
  }

  /**
   * Sets up listeners for session state manager events
   */
  private setupSessionStateListeners(): void {
    if (!this.sessionStateManager) return;
    
    this.sessionStateManager.on('session-created', (session: SessionData) => {
      this.updateSessionStatus(session.id, 'active', 'Session created', 'system');
    });
    
    this.sessionStateManager.on('session-updated', (session: SessionData) => {
      let status: SessionStatusData['status']['current'] = 'active';
      if (session.status === 'suspended') {
        status = 'paused';
      } else if (session.status === 'terminated') {
        status = 'completed';
      }
      
      this.updateSessionStatus(session.id, status, 'Session state updated', 'system');
      
      // Update metadata with session info
      this.updateMetadata(session.id, {
        workingDirectory: session.workingDirectory,
        processId: session.processId,
        commandHistoryLength: session.commandHistory.length,
        lastActiveAt: session.lastActiveAt.toISOString()
      });
    });
    
    this.sessionStateManager.on('session-suspended', (session: SessionData) => {
      this.updateSessionStatus(session.id, 'paused', 'Session suspended', 'system');
    });
    
    this.sessionStateManager.on('session-restored', (session: SessionData) => {
      this.updateSessionStatus(session.id, 'active', 'Session restored', 'system');
    });
    
    this.sessionStateManager.on('session-terminated', (sessionId: string) => {
      this.updateSessionStatus(sessionId, 'completed', 'Session terminated', 'system');
    });
    
    this.sessionStateManager.on('session-branched', (parentSession: SessionData, branchSession: SessionData) => {
      this.updateSessionStatus(branchSession.id, 'active', 'Session branched from parent', 'system');
      this.updateMetadata(branchSession.id, {
        parentSessionId: parentSession.id,
        branchPoint: branchSession.branchPoint,
        branchMetadata: branchSession.branchMetadata
      });
    });
  }

  /**
   * Starts periodic performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.performanceUpdateInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, this.PERFORMANCE_UPDATE_INTERVAL);
  }

  /**
   * Updates performance metrics for all active sessions
   */
  private async updatePerformanceMetrics(): Promise<void> {
    for (const [sessionId, statusData] of this.statusCache.entries()) {
      if (statusData.status.current === 'active') {
        // Basic performance metrics - in a real implementation, 
        // this would collect actual system metrics
        const performance = {
          ...statusData.performance,
          lastActivity: new Date().toISOString()
        };
        
        // Only update if there's actual change to avoid noise
        const hasChanges = performance.lastActivity !== statusData.performance.lastActivity;
        if (hasChanges) {
          await this.updatePerformance(sessionId, performance);
        }
      }
    }
  }

  /**
   * Clean up expired status data
   */
  async cleanupExpiredStatus(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, statusData] of this.statusCache.entries()) {
      const age = now - new Date(statusData.lastUpdated).getTime();
      
      // Remove status data older than 24 hours for completed/terminated sessions
      if (age > 24 * 60 * 60 * 1000 && 
          (statusData.status.current === 'completed' || statusData.status.current === 'error')) {
        this.statusCache.delete(sessionId);
        this.statusHistory.delete(sessionId);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Gets statistics about tracked sessions
   */
  getStats() {
    const statusCounts = new Map<string, number>();
    let totalErrors = 0;
    let totalWarnings = 0;
    
    for (const statusData of this.statusCache.values()) {
      const status = statusData.status.current;
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      totalErrors += statusData.errors.length;
      totalWarnings += statusData.warnings.length;
    }
    
    return {
      totalSessions: this.statusCache.size,
      statusBreakdown: Object.fromEntries(statusCounts),
      totalErrors,
      totalWarnings,
      historySessions: this.statusHistory.size,
      averageHistoryLength: Array.from(this.statusHistory.values())
        .reduce((sum, history) => sum + history.length, 0) / this.statusHistory.size || 0
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('SessionStatusTracker shutting down...');
    
    if (this.performanceUpdateInterval) {
      clearInterval(this.performanceUpdateInterval);
    }
    
    // Update all active sessions to paused
    for (const [sessionId, statusData] of this.statusCache.entries()) {
      if (statusData.status.current === 'active') {
        await this.updateSessionStatus(sessionId, 'paused', 'System shutdown', 'system');
      }
    }
    
    console.log('SessionStatusTracker shutdown complete');
  }
}

export default SessionStatusTracker;