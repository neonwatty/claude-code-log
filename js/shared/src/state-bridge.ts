import { EventEmitter } from 'events';

/**
 * State synchronization event types
 */
export type StateSyncEventType = 
  | 'session-created'
  | 'session-updated'
  | 'session-deleted'
  | 'context-prepared'
  | 'context-transferred'
  | 'preference-changed'
  | 'position-changed'
  | 'filter-applied'
  | 'view-mode-changed';

/**
 * State change event data
 */
export interface StateChangeEvent {
  id: string;
  type: StateSyncEventType;
  timestamp: string;
  sessionId: string;
  userId?: string;
  source: 'web' | 'cli';
  data: any;
  checksum?: string;
}

/**
 * Session state snapshot
 */
export interface SessionStateSnapshot {
  sessionId: string;
  lastModified: string;
  checksum: string;
  state: {
    position?: {
      messageIndex: number;
      timestamp: string;
    };
    preferences?: {
      displayMode?: string;
      theme?: string;
      filters?: Record<string, any>;
    };
    metadata?: Record<string, any>;
  };
}

/**
 * State conflict resolution strategy
 */
export type ConflictResolutionStrategy = 'last-writer-wins' | 'manual-merge' | 'auto-merge' | 'web-priority' | 'cli-priority';

/**
 * State conflict information
 */
export interface StateConflict {
  id: string;
  sessionId: string;
  conflictType: 'concurrent-update' | 'version-mismatch' | 'data-corruption';
  webState: any;
  cliState: any;
  resolution?: ConflictResolutionStrategy;
  resolvedState?: any;
  timestamp: string;
}

/**
 * Bridge synchronization status
 */
export interface BridgeStatus {
  connected: boolean;
  lastSync: string;
  pendingUpdates: number;
  conflicts: number;
  errorCount: number;
  sessionCount: number;
}

/**
 * State bridge configuration
 */
export interface StateBridgeConfig {
  syncInterval: number; // milliseconds
  maxRetries: number;
  conflictResolution: ConflictResolutionStrategy;
  enableCompression: boolean;
  maxStateHistory: number;
  autoResolveConflicts: boolean;
}

/**
 * Session State Management Bridge
 * 
 * Manages bidirectional state synchronization between web app and CLI sessions,
 * including conflict resolution and state persistence during transfers.
 */
export class StateBridge extends EventEmitter {
  private config: StateBridgeConfig;
  private sessions = new Map<string, SessionStateSnapshot>();
  private conflicts = new Map<string, StateConflict>();
  private pendingUpdates = new Map<string, StateChangeEvent[]>();
  private syncTimers = new Map<string, NodeJS.Timeout>();
  
  // State history for conflict resolution
  private stateHistory = new Map<string, StateChangeEvent[]>();
  
  // Connection status
  private connected = false;
  private lastSyncTime = new Date();
  private errorCount = 0;
  
  private readonly DEFAULT_CONFIG: StateBridgeConfig = {
    syncInterval: 5000, // 5 seconds
    maxRetries: 3,
    conflictResolution: 'auto-merge',
    enableCompression: true,
    maxStateHistory: 100,
    autoResolveConflicts: true,
  };

  constructor(config: Partial<StateBridgeConfig> = {}) {
    super();
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.setupPeriodicSync();
  }

  /**
   * Connects the state bridge (e.g., when WebSocket connection is established)
   */
  async connect(): Promise<void> {
    this.connected = true;
    this.errorCount = 0;
    this.emit('connected', { timestamp: new Date().toISOString() });
    
    // Sync any pending updates
    await this.syncPendingUpdates();
  }

  /**
   * Disconnects the state bridge
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    
    // Clear sync timers
    for (const timer of this.syncTimers.values()) {
      clearTimeout(timer);
    }
    this.syncTimers.clear();
    
    this.emit('disconnected', { timestamp: new Date().toISOString() });
  }

  /**
   * Updates session state from web app
   */
  async updateFromWeb(sessionId: string, stateUpdate: Partial<SessionStateSnapshot['state']>, userId?: string): Promise<void> {
    const event: StateChangeEvent = {
      id: this.generateEventId(),
      type: 'session-updated',
      timestamp: new Date().toISOString(),
      sessionId,
      userId,
      source: 'web',
      data: stateUpdate,
    };

    await this.processStateChange(event);
  }

  /**
   * Updates session state from CLI
   */
  async updateFromCLI(sessionId: string, stateUpdate: Partial<SessionStateSnapshot['state']>, userId?: string): Promise<void> {
    const event: StateChangeEvent = {
      id: this.generateEventId(),
      type: 'session-updated',
      timestamp: new Date().toISOString(),
      sessionId,
      userId,
      source: 'cli',
      data: stateUpdate,
    };

    await this.processStateChange(event);
  }

  /**
   * Processes a state change event
   */
  private async processStateChange(event: StateChangeEvent): Promise<void> {
    try {
      // Add to history
      this.addToHistory(event);
      
      // Get current state
      const currentState = this.sessions.get(event.sessionId);
      
      if (currentState) {
        // Check for conflicts
        const conflict = this.detectConflict(event, currentState);
        
        if (conflict) {
          await this.handleConflict(conflict);
        } else {
          // No conflict, apply the update
          await this.applyStateUpdate(event);
        }
      } else {
        // No existing state, create new snapshot
        await this.createStateSnapshot(event);
      }

      // Queue for synchronization if not connected
      if (!this.connected) {
        this.queueUpdate(event);
      } else {
        // Broadcast the change
        this.broadcastStateChange(event);
      }

    } catch (error) {
      this.errorCount++;
      this.emit('error', {
        type: 'state-processing-error',
        event,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Applies a state update to the session snapshot
   */
  private async applyStateUpdate(event: StateChangeEvent): Promise<void> {
    const sessionId = event.sessionId;
    const existingSnapshot = this.sessions.get(sessionId);
    
    const newState = existingSnapshot ? 
      this.mergeStates(existingSnapshot.state, event.data) : 
      event.data;

    const snapshot: SessionStateSnapshot = {
      sessionId,
      lastModified: event.timestamp,
      checksum: this.calculateChecksum(newState),
      state: newState,
    };

    this.sessions.set(sessionId, snapshot);
    
    this.emit('state-updated', {
      sessionId,
      snapshot,
      source: event.source,
      timestamp: event.timestamp,
    });
  }

  /**
   * Creates a new state snapshot
   */
  private async createStateSnapshot(event: StateChangeEvent): Promise<void> {
    const snapshot: SessionStateSnapshot = {
      sessionId: event.sessionId,
      lastModified: event.timestamp,
      checksum: this.calculateChecksum(event.data),
      state: event.data,
    };

    this.sessions.set(event.sessionId, snapshot);
    
    this.emit('state-created', {
      sessionId: event.sessionId,
      snapshot,
      source: event.source,
      timestamp: event.timestamp,
    });
  }

  /**
   * Detects conflicts between state updates
   */
  private detectConflict(event: StateChangeEvent, currentState: SessionStateSnapshot): StateConflict | null {
    // Check for concurrent updates (within a small time window)
    const eventTime = new Date(event.timestamp);
    const stateTime = new Date(currentState.lastModified);
    const timeDiff = Math.abs(eventTime.getTime() - stateTime.getTime());
    
    if (timeDiff < 1000) { // 1 second window
      return {
        id: this.generateEventId(),
        sessionId: event.sessionId,
        conflictType: 'concurrent-update',
        webState: event.source === 'web' ? event.data : currentState.state,
        cliState: event.source === 'cli' ? event.data : currentState.state,
        timestamp: new Date().toISOString(),
      };
    }

    // Check for checksum mismatch (potential data corruption)
    const expectedChecksum = this.calculateChecksum(currentState.state);
    if (currentState.checksum !== expectedChecksum) {
      return {
        id: this.generateEventId(),
        sessionId: event.sessionId,
        conflictType: 'data-corruption',
        webState: event.source === 'web' ? event.data : currentState.state,
        cliState: event.source === 'cli' ? event.data : currentState.state,
        timestamp: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Handles state conflicts
   */
  private async handleConflict(conflict: StateConflict): Promise<void> {
    this.conflicts.set(conflict.id, conflict);
    
    if (this.config.autoResolveConflicts) {
      const resolution = await this.autoResolveConflict(conflict);
      if (resolution) {
        await this.applyConflictResolution(conflict.id, resolution);
        return;
      }
    }

    // Emit conflict for manual resolution
    this.emit('conflict-detected', conflict);
  }

  /**
   * Automatically resolves conflicts based on strategy
   */
  private async autoResolveConflict(conflict: StateConflict): Promise<any | null> {
    const { conflictType, webState, cliState } = conflict;
    const strategy = this.config.conflictResolution;

    switch (strategy) {
      case 'last-writer-wins':
        // Use the state with the most recent timestamp
        return this.getNewestState(webState, cliState);

      case 'web-priority':
        return webState;

      case 'cli-priority':
        return cliState;

      case 'auto-merge':
        return this.mergeStates(webState, cliState);

      case 'manual-merge':
      default:
        return null; // Requires manual intervention
    }
  }

  /**
   * Applies conflict resolution
   */
  async applyConflictResolution(conflictId: string, resolvedState: any): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return;

    conflict.resolution = this.config.conflictResolution;
    conflict.resolvedState = resolvedState;

    // Apply the resolved state
    const event: StateChangeEvent = {
      id: this.generateEventId(),
      type: 'session-updated',
      timestamp: new Date().toISOString(),
      sessionId: conflict.sessionId,
      source: 'bridge',
      data: resolvedState,
    };

    await this.applyStateUpdate(event);

    // Remove from conflicts
    this.conflicts.delete(conflictId);

    this.emit('conflict-resolved', {
      conflictId,
      sessionId: conflict.sessionId,
      resolvedState,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Merges two state objects
   */
  private mergeStates(state1: any, state2: any): any {
    if (!state1) return state2;
    if (!state2) return state1;

    // Deep merge with state2 taking precedence for conflicts
    return this.deepMerge(state1, state2);
  }

  /**
   * Deep merge utility
   */
  private deepMerge(obj1: any, obj2: any): any {
    const result = { ...obj1 };

    for (const key in obj2) {
      if (obj2.hasOwnProperty(key)) {
        if (
          obj2[key] && 
          typeof obj2[key] === 'object' && 
          !Array.isArray(obj2[key]) &&
          obj1[key] && 
          typeof obj1[key] === 'object' && 
          !Array.isArray(obj1[key])
        ) {
          result[key] = this.deepMerge(obj1[key], obj2[key]);
        } else {
          result[key] = obj2[key];
        }
      }
    }

    return result;
  }

  /**
   * Gets the state with the newest timestamp
   */
  private getNewestState(state1: any, state2: any): any {
    const timestamp1 = state1?.lastModified || state1?.timestamp;
    const timestamp2 = state2?.lastModified || state2?.timestamp;

    if (!timestamp1) return state2;
    if (!timestamp2) return state1;

    return new Date(timestamp1) > new Date(timestamp2) ? state1 : state2;
  }

  /**
   * Queues an update for later synchronization
   */
  private queueUpdate(event: StateChangeEvent): void {
    const sessionId = event.sessionId;
    const queue = this.pendingUpdates.get(sessionId) || [];
    queue.push(event);
    this.pendingUpdates.set(sessionId, queue);
  }

  /**
   * Syncs all pending updates
   */
  private async syncPendingUpdates(): Promise<void> {
    const allUpdates: StateChangeEvent[] = [];
    
    for (const [sessionId, updates] of this.pendingUpdates.entries()) {
      allUpdates.push(...updates);
    }

    // Clear pending updates
    this.pendingUpdates.clear();

    // Process updates in chronological order
    allUpdates.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const update of allUpdates) {
      this.broadcastStateChange(update);
    }

    this.lastSyncTime = new Date();
  }

  /**
   * Broadcasts state changes to connected clients
   */
  private broadcastStateChange(event: StateChangeEvent): void {
    this.emit('state-broadcast', event);
  }

  /**
   * Sets up periodic synchronization
   */
  private setupPeriodicSync(): void {
    setInterval(async () => {
      if (this.connected && this.pendingUpdates.size > 0) {
        await this.syncPendingUpdates();
      }
    }, this.config.syncInterval);
  }

  /**
   * Adds event to history
   */
  private addToHistory(event: StateChangeEvent): void {
    const sessionId = event.sessionId;
    const history = this.stateHistory.get(sessionId) || [];
    
    history.push(event);
    
    // Limit history size
    if (history.length > this.config.maxStateHistory) {
      history.splice(0, history.length - this.config.maxStateHistory);
    }
    
    this.stateHistory.set(sessionId, history);
  }

  /**
   * Calculates checksum for state data
   */
  private calculateChecksum(data: any): string {
    const crypto = require('crypto');
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Generates unique event ID
   */
  private generateEventId(): string {
    const crypto = require('crypto');
    return crypto.randomUUID();
  }

  /**
   * Gets current session state
   */
  getSessionState(sessionId: string): SessionStateSnapshot | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Gets all active sessions
   */
  getAllSessions(): SessionStateSnapshot[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Gets pending conflicts
   */
  getPendingConflicts(): StateConflict[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * Gets bridge status
   */
  getStatus(): BridgeStatus {
    return {
      connected: this.connected,
      lastSync: this.lastSyncTime.toISOString(),
      pendingUpdates: Array.from(this.pendingUpdates.values()).reduce((sum, updates) => sum + updates.length, 0),
      conflicts: this.conflicts.size,
      errorCount: this.errorCount,
      sessionCount: this.sessions.size,
    };
  }

  /**
   * Gets state history for a session
   */
  getSessionHistory(sessionId: string): StateChangeEvent[] {
    return this.stateHistory.get(sessionId) || [];
  }

  /**
   * Clears session state
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.stateHistory.delete(sessionId);
    this.pendingUpdates.delete(sessionId);
    
    // Clear conflicts for this session
    for (const [conflictId, conflict] of this.conflicts.entries()) {
      if (conflict.sessionId === sessionId) {
        this.conflicts.delete(conflictId);
      }
    }

    this.emit('session-cleared', { sessionId, timestamp: new Date().toISOString() });
  }

  /**
   * Updates bridge configuration
   */
  updateConfig(newConfig: Partial<StateBridgeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', { config: this.config, timestamp: new Date().toISOString() });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await this.disconnect();
    
    // Clear all data
    this.sessions.clear();
    this.conflicts.clear();
    this.pendingUpdates.clear();
    this.stateHistory.clear();
    
    this.removeAllListeners();
    
    console.log('StateBridge shutdown complete');
  }
}

export default StateBridge;