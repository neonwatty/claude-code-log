import { SessionSummary } from '../components/types/session-types';

/**
 * State synchronization event types
 */
export type StateSyncEventType = 
  | 'state-changed'
  | 'state-sync-started'
  | 'state-sync-completed'
  | 'state-conflict-detected'
  | 'state-reconciled'
  | 'offline-changes-queued'
  | 'sync-error';

/**
 * Application state structure
 */
export interface ApplicationState {
  sessions: Map<string, SessionSummary>;
  subscriptions: Set<string>;
  userPreferences: Record<string, any>;
  activeSessionId: string | null;
  lastUpdate: number;
  version: number;
}

/**
 * State change operation
 */
export interface StateChangeOperation {
  id: string;
  type: 'add' | 'update' | 'delete';
  target: 'session' | 'subscription' | 'preference';
  targetId: string;
  payload: any;
  timestamp: number;
  version: number;
  applied: boolean;
}

/**
 * State snapshot for versioning
 */
export interface StateSnapshot {
  state: ApplicationState;
  version: number;
  timestamp: number;
  checksum: string;
}

/**
 * State synchronization configuration
 */
export interface StateSyncConfig {
  maxQueueSize: number;
  syncTimeoutMs: number;
  checksumEnabled: boolean;
  conflictResolutionStrategy: 'server-wins' | 'client-wins' | 'merge' | 'prompt-user';
  snapshotIntervalMs: number;
  maxSnapshots: number;
}

/**
 * Client-side state synchronization manager
 */
export class StateSynchronizationManager extends EventTarget {
  private state: ApplicationState;
  private pendingOperations: StateChangeOperation[] = [];
  private appliedOperations: StateChangeOperation[] = [];
  private snapshots: StateSnapshot[] = [];
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private config: StateSyncConfig;
  private snapshotTimer: NodeJS.Timeout | null = null;
  
  constructor(config?: Partial<StateSyncConfig>) {
    super();
    
    this.config = {
      maxQueueSize: 1000,
      syncTimeoutMs: 30000,
      checksumEnabled: true,
      conflictResolutionStrategy: 'server-wins',
      snapshotIntervalMs: 60000, // 1 minute
      maxSnapshots: 10,
      ...config
    };
    
    this.state = this.initializeState();
    this.startSnapshotTimer();
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }
  
  /**
   * Initialize empty application state
   */
  private initializeState(): ApplicationState {
    return {
      sessions: new Map(),
      subscriptions: new Set(),
      userPreferences: {},
      activeSessionId: null,
      lastUpdate: Date.now(),
      version: 1
    };
  }
  
  /**
   * Get current application state (read-only copy)
   */
  public getState(): Readonly<ApplicationState> {
    return {
      ...this.state,
      sessions: new Map(this.state.sessions),
      subscriptions: new Set(this.state.subscriptions),
      userPreferences: { ...this.state.userPreferences }
    };
  }
  
  /**
   * Update session in state
   */
  public updateSession(sessionId: string, sessionData: Partial<SessionSummary>): void {
    const operation: StateChangeOperation = {
      id: this.generateOperationId(),
      type: this.state.sessions.has(sessionId) ? 'update' : 'add',
      target: 'session',
      targetId: sessionId,
      payload: sessionData,
      timestamp: Date.now(),
      version: this.state.version + 1,
      applied: false
    };
    
    this.queueOperation(operation);
  }
  
  /**
   * Remove session from state
   */
  public removeSession(sessionId: string): void {
    const operation: StateChangeOperation = {
      id: this.generateOperationId(),
      type: 'delete',
      target: 'session',
      targetId: sessionId,
      payload: null,
      timestamp: Date.now(),
      version: this.state.version + 1,
      applied: false
    };
    
    this.queueOperation(operation);
  }
  
  /**
   * Add subscription
   */
  public addSubscription(subscriptionId: string): void {
    const operation: StateChangeOperation = {
      id: this.generateOperationId(),
      type: 'add',
      target: 'subscription',
      targetId: subscriptionId,
      payload: subscriptionId,
      timestamp: Date.now(),
      version: this.state.version + 1,
      applied: false
    };
    
    this.queueOperation(operation);
  }
  
  /**
   * Remove subscription
   */
  public removeSubscription(subscriptionId: string): void {
    const operation: StateChangeOperation = {
      id: this.generateOperationId(),
      type: 'delete',
      target: 'subscription',
      targetId: subscriptionId,
      payload: null,
      timestamp: Date.now(),
      version: this.state.version + 1,
      applied: false
    };
    
    this.queueOperation(operation);
  }
  
  /**
   * Update user preference
   */
  public updatePreference(key: string, value: any): void {
    const operation: StateChangeOperation = {
      id: this.generateOperationId(),
      type: 'update',
      target: 'preference',
      targetId: key,
      payload: value,
      timestamp: Date.now(),
      version: this.state.version + 1,
      applied: false
    };
    
    this.queueOperation(operation);
  }
  
  /**
   * Set active session
   */
  public setActiveSession(sessionId: string | null): void {
    const operation: StateChangeOperation = {
      id: this.generateOperationId(),
      type: 'update',
      target: 'preference',
      targetId: '__activeSessionId',
      payload: sessionId,
      timestamp: Date.now(),
      version: this.state.version + 1,
      applied: false
    };
    
    this.queueOperation(operation);
  }
  
  /**
   * Queue state change operation
   */
  private queueOperation(operation: StateChangeOperation): void {
    // Apply immediately if online
    if (this.isOnline && !this.isSyncing) {
      this.applyOperation(operation);
      this.emitStateChange();
    } else {
      // Queue for later when back online
      this.pendingOperations.push(operation);
      
      // Limit queue size
      if (this.pendingOperations.length > this.config.maxQueueSize) {
        this.pendingOperations.shift(); // Remove oldest
      }
      
      this.emitEvent('offline-changes-queued', {
        operation,
        queueSize: this.pendingOperations.length
      });
    }
  }
  
  /**
   * Apply state change operation
   */
  private applyOperation(operation: StateChangeOperation): boolean {
    try {
      switch (operation.target) {
        case 'session':
          this.applySessionOperation(operation);
          break;
        case 'subscription':
          this.applySubscriptionOperation(operation);
          break;
        case 'preference':
          this.applyPreferenceOperation(operation);
          break;
        default:
          console.warn('Unknown operation target:', operation.target);
          return false;
      }
      
      operation.applied = true;
      this.appliedOperations.push(operation);
      this.state.version = operation.version;
      this.state.lastUpdate = operation.timestamp;
      
      return true;
    } catch (error) {
      console.error('Failed to apply operation:', operation, error);
      return false;
    }
  }
  
  /**
   * Apply session-related operation
   */
  private applySessionOperation(operation: StateChangeOperation): void {
    switch (operation.type) {
      case 'add':
      case 'update':
        const existingSession = this.state.sessions.get(operation.targetId);
        const updatedSession = existingSession 
          ? { ...existingSession, ...operation.payload }
          : operation.payload as SessionSummary;
        this.state.sessions.set(operation.targetId, updatedSession);
        break;
        
      case 'delete':
        this.state.sessions.delete(operation.targetId);
        if (this.state.activeSessionId === operation.targetId) {
          this.state.activeSessionId = null;
        }
        break;
    }
  }
  
  /**
   * Apply subscription-related operation
   */
  private applySubscriptionOperation(operation: StateChangeOperation): void {
    switch (operation.type) {
      case 'add':
        this.state.subscriptions.add(operation.payload);
        break;
        
      case 'delete':
        this.state.subscriptions.delete(operation.targetId);
        break;
    }
  }
  
  /**
   * Apply preference-related operation
   */
  private applyPreferenceOperation(operation: StateChangeOperation): void {
    if (operation.targetId === '__activeSessionId') {
      this.state.activeSessionId = operation.payload;
    } else {
      switch (operation.type) {
        case 'update':
          this.state.userPreferences[operation.targetId] = operation.payload;
          break;
          
        case 'delete':
          delete this.state.userPreferences[operation.targetId];
          break;
      }
    }
  }
  
  /**
   * Synchronize state with server
   */
  public async synchronizeWithServer(serverState: any, serverVersion: number): Promise<void> {
    if (this.isSyncing) {
      console.warn('Synchronization already in progress');
      return;
    }
    
    this.isSyncing = true;
    this.emitEvent('state-sync-started', { serverVersion });
    
    try {
      // Apply any pending operations first
      await this.applyPendingOperations();
      
      // Detect conflicts between local and server state
      const conflicts = this.detectConflicts(serverState, serverVersion);
      
      if (conflicts.length > 0) {
        this.emitEvent('state-conflict-detected', { conflicts });
        await this.resolveConflicts(conflicts, serverState);
      } else {
        // No conflicts, merge server state
        await this.mergeServerState(serverState, serverVersion);
      }
      
      this.emitEvent('state-sync-completed', {
        localVersion: this.state.version,
        serverVersion
      });
      
    } catch (error) {
      console.error('State synchronization failed:', error);
      this.emitEvent('sync-error', { error: error.message });
    } finally {
      this.isSyncing = false;
    }
  }
  
  /**
   * Apply all pending operations
   */
  private async applyPendingOperations(): Promise<void> {
    const operations = [...this.pendingOperations];
    this.pendingOperations = [];
    
    for (const operation of operations) {
      this.applyOperation(operation);
    }
    
    if (operations.length > 0) {
      this.emitStateChange();
    }
  }
  
  /**
   * Detect conflicts between local and server state
   */
  private detectConflicts(serverState: any, serverVersion: number): Array<{
    type: string;
    localValue: any;
    serverValue: any;
    path: string;
  }> {
    const conflicts: Array<any> = [];
    
    // Check version conflicts
    if (this.state.version > serverVersion) {
      conflicts.push({
        type: 'version',
        localValue: this.state.version,
        serverValue: serverVersion,
        path: 'version'
      });
    }
    
    // Check session conflicts
    if (serverState.sessions) {
      for (const [sessionId, serverSession] of Object.entries(serverState.sessions)) {
        const localSession = this.state.sessions.get(sessionId);
        if (localSession && this.hasSessionConflict(localSession, serverSession as SessionSummary)) {
          conflicts.push({
            type: 'session',
            localValue: localSession,
            serverValue: serverSession,
            path: `sessions.${sessionId}`
          });
        }
      }
    }
    
    return conflicts;
  }
  
  /**
   * Check if session has conflicts
   */
  private hasSessionConflict(local: SessionSummary, server: SessionSummary): boolean {
    // Simple timestamp-based conflict detection
    const localTime = local.endTime?.getTime() || local.startTime.getTime();
    const serverTime = server.endTime?.getTime() || server.startTime.getTime();
    
    return Math.abs(localTime - serverTime) > 1000; // 1 second tolerance
  }
  
  /**
   * Resolve conflicts using configured strategy
   */
  private async resolveConflicts(conflicts: any[], serverState: any): Promise<void> {
    for (const conflict of conflicts) {
      switch (this.config.conflictResolutionStrategy) {
        case 'server-wins':
          await this.applyServerValue(conflict, serverState);
          break;
          
        case 'client-wins':
          // Keep local value, ignore server
          break;
          
        case 'merge':
          await this.mergeConflictValues(conflict, serverState);
          break;
          
        case 'prompt-user':
          await this.promptUserForResolution(conflict, serverState);
          break;
      }
    }
    
    this.emitEvent('state-reconciled', { 
      resolvedConflicts: conflicts.length,
      strategy: this.config.conflictResolutionStrategy
    });
  }
  
  /**
   * Apply server value for conflict resolution
   */
  private async applyServerValue(conflict: any, serverState: any): Promise<void> {
    if (conflict.type === 'session') {
      const sessionId = conflict.path.split('.')[1];
      this.state.sessions.set(sessionId, conflict.serverValue);
    }
  }
  
  /**
   * Merge conflicting values
   */
  private async mergeConflictValues(conflict: any, serverState: any): Promise<void> {
    if (conflict.type === 'session') {
      const sessionId = conflict.path.split('.')[1];
      const merged = {
        ...conflict.serverValue,
        ...conflict.localValue,
        // Use latest timestamp for lastUpdate
        lastUpdate: Math.max(
          conflict.localValue.lastUpdate || 0,
          conflict.serverValue.lastUpdate || 0
        )
      };
      this.state.sessions.set(sessionId, merged);
    }
  }
  
  /**
   * Prompt user for conflict resolution (emit event for UI handling)
   */
  private async promptUserForResolution(conflict: any, serverState: any): Promise<void> {
    return new Promise((resolve) => {
      const handleUserChoice = (event: CustomEvent) => {
        const { conflictId, choice } = event.detail;
        if (conflictId === conflict.path) {
          if (choice === 'server') {
            this.applyServerValue(conflict, serverState);
          }
          // else keep local value
          
          this.removeEventListener('conflict-resolution', handleUserChoice as EventListener);
          resolve();
        }
      };
      
      this.addEventListener('conflict-resolution', handleUserChoice as EventListener);
      
      // Emit event for UI to handle
      this.emitEvent('user-conflict-prompt', {
        conflict,
        conflictId: conflict.path
      });
    });
  }
  
  /**
   * Merge server state with local state
   */
  private async mergeServerState(serverState: any, serverVersion: number): Promise<void> {
    // Update sessions from server
    if (serverState.sessions) {
      for (const [sessionId, serverSession] of Object.entries(serverState.sessions)) {
        this.state.sessions.set(sessionId, serverSession as SessionSummary);
      }
    }
    
    // Update subscriptions from server
    if (serverState.subscriptions) {
      this.state.subscriptions = new Set(serverState.subscriptions);
    }
    
    // Update preferences from server
    if (serverState.userPreferences) {
      this.state.userPreferences = { ...serverState.userPreferences };
    }
    
    // Update version and timestamp
    this.state.version = Math.max(this.state.version, serverVersion);
    this.state.lastUpdate = Date.now();
  }
  
  /**
   * Create state snapshot
   */
  public createSnapshot(): StateSnapshot {
    const snapshot: StateSnapshot = {
      state: this.getState(),
      version: this.state.version,
      timestamp: Date.now(),
      checksum: this.config.checksumEnabled ? this.calculateChecksum(this.state) : ''
    };
    
    this.snapshots.push(snapshot);
    
    // Limit number of snapshots
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }
    
    return snapshot;
  }
  
  /**
   * Restore from snapshot
   */
  public restoreFromSnapshot(snapshot: StateSnapshot): boolean {
    try {
      // Verify checksum if enabled
      if (this.config.checksumEnabled && snapshot.checksum) {
        const currentChecksum = this.calculateChecksum(snapshot.state);
        if (currentChecksum !== snapshot.checksum) {
          throw new Error('Snapshot checksum mismatch');
        }
      }
      
      this.state = {
        sessions: new Map(snapshot.state.sessions),
        subscriptions: new Set(snapshot.state.subscriptions),
        userPreferences: { ...snapshot.state.userPreferences },
        activeSessionId: snapshot.state.activeSessionId,
        lastUpdate: snapshot.state.lastUpdate,
        version: snapshot.state.version
      };
      
      this.emitStateChange();
      return true;
    } catch (error) {
      console.error('Failed to restore from snapshot:', error);
      return false;
    }
  }
  
  /**
   * Calculate state checksum for integrity verification
   */
  private calculateChecksum(state: ApplicationState): string {
    const serialized = JSON.stringify({
      sessions: Array.from(state.sessions.entries()).sort(),
      subscriptions: Array.from(state.subscriptions).sort(),
      userPreferences: Object.entries(state.userPreferences).sort(),
      activeSessionId: state.activeSessionId,
      version: state.version
    });
    
    // Simple hash function (in production, use a proper hash like SHA-256)
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(36);
  }
  
  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.isOnline = true;
    console.log('Connection restored, synchronizing state...');
    
    // Apply pending operations
    this.applyPendingOperations();
  }
  
  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.isOnline = false;
    console.log('Connection lost, queuing state changes...');
  }
  
  /**
   * Start automatic snapshot timer
   */
  private startSnapshotTimer(): void {
    this.snapshotTimer = setInterval(() => {
      this.createSnapshot();
    }, this.config.snapshotIntervalMs);
  }
  
  /**
   * Stop automatic snapshot timer
   */
  private stopSnapshotTimer(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }
  
  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Emit state change event
   */
  private emitStateChange(): void {
    this.emitEvent('state-changed', {
      state: this.getState(),
      version: this.state.version,
      timestamp: this.state.lastUpdate
    });
  }
  
  /**
   * Emit custom event
   */
  private emitEvent(type: StateSyncEventType, detail: any): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  
  /**
   * Get synchronization status
   */
  public getSyncStatus(): {
    isOnline: boolean;
    isSyncing: boolean;
    pendingOperations: number;
    lastSync: number;
    version: number;
  } {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingOperations: this.pendingOperations.length,
      lastSync: this.state.lastUpdate,
      version: this.state.version
    };
  }
  
  /**
   * Get pending operations
   */
  public getPendingOperations(): ReadonlyArray<StateChangeOperation> {
    return [...this.pendingOperations];
  }
  
  /**
   * Get snapshots history
   */
  public getSnapshots(): ReadonlyArray<StateSnapshot> {
    return [...this.snapshots];
  }
  
  /**
   * Clear all data and reset state
   */
  public reset(): void {
    this.state = this.initializeState();
    this.pendingOperations = [];
    this.appliedOperations = [];
    this.snapshots = [];
    this.emitStateChange();
  }
  
  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stopSnapshotTimer();
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
  }
}