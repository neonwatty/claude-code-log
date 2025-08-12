import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { TypedSocket } from '../types/websocket';

/**
 * Client state snapshot structure
 */
export interface ClientStateSnapshot {
  id: string;
  userId: string;
  socketId: string;
  version: number;
  timestamp: number;
  checksum: string;
  state: {
    sessions: Record<string, any>;
    subscriptions: string[];
    userPreferences: Record<string, any>;
    activeSessionId: string | null;
  };
  
  // Delta tracking
  operations: StateOperation[];
  lastSyncVersion: number;
  reconnectToken?: string;
}

/**
 * State operation for delta updates
 */
export interface StateOperation {
  id: string;
  type: 'add' | 'update' | 'delete';
  target: 'session' | 'subscription' | 'preference';
  targetId: string;
  payload: any;
  timestamp: number;
  version: number;
  userId: string;
}

/**
 * Delta compression result
 */
export interface StateDelta {
  fromVersion: number;
  toVersion: number;
  operations: StateOperation[];
  checksum: string;
  compressed: boolean;
}

/**
 * State persistence configuration
 */
export interface StatePersistenceConfig {
  snapshotInterval: number;
  maxSnapshots: number;
  maxOperations: number;
  compressionThreshold: number;
  cleanupInterval: number;
  persistenceTimeout: number;
}

/**
 * State persistence events
 */
export interface StatePersistenceEvents {
  'snapshot-created': (snapshot: ClientStateSnapshot) => void;
  'snapshot-expired': (snapshotId: string) => void;
  'delta-compressed': (delta: StateDelta) => void;
  'state-recovered': (userId: string, snapshot: ClientStateSnapshot) => void;
  'persistence-error': (error: Error) => void;
  'cleanup-completed': (stats: CleanupStats) => void;
}

interface CleanupStats {
  expiredSnapshots: number;
  compressedOperations: number;
  freedMemory: number;
}

declare interface ClientStatePersistenceManager {
  on<U extends keyof StatePersistenceEvents>(
    event: U, 
    listener: StatePersistenceEvents[U]
  ): this;
  
  emit<U extends keyof StatePersistenceEvents>(
    event: U, 
    ...args: Parameters<StatePersistenceEvents[U]>
  ): boolean;
}

/**
 * Server-side client state persistence and recovery manager
 */
export class ClientStatePersistenceManager extends EventEmitter {
  private snapshots = new Map<string, ClientStateSnapshot>();
  private userSnapshots = new Map<string, Set<string>>(); // userId -> snapshot IDs
  private pendingOperations = new Map<string, StateOperation[]>(); // userId -> operations
  private snapshotTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private config: StatePersistenceConfig;

  constructor(config?: Partial<StatePersistenceConfig>) {
    super();
    
    this.config = {
      snapshotInterval: 30000, // 30 seconds
      maxSnapshots: 50,
      maxOperations: 1000,
      compressionThreshold: 100,
      cleanupInterval: 300000, // 5 minutes
      persistenceTimeout: 10000, // 10 seconds
      ...config
    };

    this.startPeriodicTasks();
  }

  /**
   * Create state snapshot for a client
   */
  public async createSnapshot(
    userId: string, 
    socketId: string, 
    state: any, 
    version: number,
    reconnectToken?: string
  ): Promise<string> {
    const snapshot: ClientStateSnapshot = {
      id: randomUUID(),
      userId,
      socketId,
      version,
      timestamp: Date.now(),
      checksum: this.calculateChecksum(state),
      state: this.cloneState(state),
      operations: this.getPendingOperationsForUser(userId),
      lastSyncVersion: version,
      reconnectToken
    };

    // Store snapshot
    this.snapshots.set(snapshot.id, snapshot);
    
    // Track user snapshots
    if (!this.userSnapshots.has(userId)) {
      this.userSnapshots.set(userId, new Set());
    }
    this.userSnapshots.get(userId)!.add(snapshot.id);
    
    // Clear pending operations for this user
    this.pendingOperations.delete(userId);
    
    // Enforce snapshot limits
    await this.enforceSnapshotLimits(userId);
    
    this.emit('snapshot-created', snapshot);
    console.log(`Created state snapshot ${snapshot.id} for user ${userId}`);
    
    return snapshot.id;
  }

  /**
   * Recover state for a user during reconnection
   */
  public async recoverState(
    userId: string, 
    clientVersion: number,
    reconnectToken?: string
  ): Promise<{
    snapshot?: ClientStateSnapshot;
    delta?: StateDelta;
    needsFullSync: boolean;
  }> {
    const userSnapshotIds = this.userSnapshots.get(userId);
    if (!userSnapshotIds || userSnapshotIds.size === 0) {
      return { needsFullSync: true };
    }

    // Find the most recent compatible snapshot
    let latestSnapshot: ClientStateSnapshot | undefined;
    for (const snapshotId of userSnapshotIds) {
      const snapshot = this.snapshots.get(snapshotId);
      if (snapshot && (!latestSnapshot || snapshot.timestamp > latestSnapshot.timestamp)) {
        // Validate reconnect token if provided
        if (reconnectToken && snapshot.reconnectToken !== reconnectToken) {
          continue;
        }
        latestSnapshot = snapshot;
      }
    }

    if (!latestSnapshot) {
      return { needsFullSync: true };
    }

    // Check if client version is too far behind
    if (clientVersion < latestSnapshot.lastSyncVersion - 10) {
      return { needsFullSync: true };
    }

    // Generate delta if needed
    if (clientVersion < latestSnapshot.version) {
      const delta = this.generateDelta(userId, clientVersion, latestSnapshot.version);
      return { snapshot: latestSnapshot, delta, needsFullSync: false };
    }

    // Client is up to date
    return { snapshot: latestSnapshot, needsFullSync: false };
  }

  /**
   * Add state operation for delta tracking
   */
  public addOperation(operation: StateOperation): void {
    if (!this.pendingOperations.has(operation.userId)) {
      this.pendingOperations.set(operation.userId, []);
    }

    const userOps = this.pendingOperations.get(operation.userId)!;
    userOps.push(operation);

    // Enforce operation limits
    if (userOps.length > this.config.maxOperations) {
      userOps.splice(0, userOps.length - this.config.maxOperations);
    }

    // Trigger compression if threshold reached
    if (userOps.length >= this.config.compressionThreshold) {
      this.compressOperations(operation.userId);
    }
  }

  /**
   * Generate delta between two versions
   */
  public generateDelta(userId: string, fromVersion: number, toVersion: number): StateDelta | null {
    const operations = this.getPendingOperationsForUser(userId)
      .filter(op => op.version > fromVersion && op.version <= toVersion)
      .sort((a, b) => a.version - b.version);

    if (operations.length === 0) {
      return null;
    }

    const delta: StateDelta = {
      fromVersion,
      toVersion,
      operations,
      checksum: this.calculateOperationsChecksum(operations),
      compressed: false
    };

    // Apply compression if beneficial
    if (operations.length > 10) {
      delta.compressed = true;
      // In a real implementation, we might compress the operations
    }

    return delta;
  }

  /**
   * Apply delta operations to a state
   */
  public applyDelta(state: any, delta: StateDelta): any {
    const newState = this.cloneState(state);

    for (const operation of delta.operations) {
      try {
        this.applyOperationToState(newState, operation);
      } catch (error) {
        console.error('Failed to apply operation:', operation, error);
      }
    }

    return newState;
  }

  /**
   * Get latest snapshot for a user
   */
  public getLatestSnapshot(userId: string): ClientStateSnapshot | undefined {
    const userSnapshotIds = this.userSnapshots.get(userId);
    if (!userSnapshotIds) {
      return undefined;
    }

    let latest: ClientStateSnapshot | undefined;
    for (const snapshotId of userSnapshotIds) {
      const snapshot = this.snapshots.get(snapshotId);
      if (snapshot && (!latest || snapshot.timestamp > latest.timestamp)) {
        latest = snapshot;
      }
    }

    return latest;
  }

  /**
   * Get all snapshots for a user
   */
  public getUserSnapshots(userId: string): ClientStateSnapshot[] {
    const userSnapshotIds = this.userSnapshots.get(userId);
    if (!userSnapshotIds) {
      return [];
    }

    return Array.from(userSnapshotIds)
      .map(id => this.snapshots.get(id))
      .filter((snapshot): snapshot is ClientStateSnapshot => snapshot !== undefined)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Delete snapshot by ID
   */
  public deleteSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return false;
    }

    // Remove from user tracking
    const userSnapshotIds = this.userSnapshots.get(snapshot.userId);
    if (userSnapshotIds) {
      userSnapshotIds.delete(snapshotId);
      if (userSnapshotIds.size === 0) {
        this.userSnapshots.delete(snapshot.userId);
      }
    }

    // Remove snapshot
    this.snapshots.delete(snapshotId);
    
    this.emit('snapshot-expired', snapshotId);
    return true;
  }

  /**
   * Clear all data for a user
   */
  public clearUserData(userId: string): void {
    const userSnapshotIds = this.userSnapshots.get(userId);
    if (userSnapshotIds) {
      for (const snapshotId of userSnapshotIds) {
        this.snapshots.delete(snapshotId);
      }
      this.userSnapshots.delete(userId);
    }

    this.pendingOperations.delete(userId);
  }

  /**
   * Get persistence statistics
   */
  public getStats(): {
    totalSnapshots: number;
    totalUsers: number;
    totalOperations: number;
    memoryUsage: number;
    oldestSnapshot: number;
    newestSnapshot: number;
  } {
    const snapshots = Array.from(this.snapshots.values());
    const totalOperations = Array.from(this.pendingOperations.values())
      .reduce((sum, ops) => sum + ops.length, 0);

    return {
      totalSnapshots: snapshots.length,
      totalUsers: this.userSnapshots.size,
      totalOperations,
      memoryUsage: this.calculateMemoryUsage(),
      oldestSnapshot: snapshots.length > 0 ? Math.min(...snapshots.map(s => s.timestamp)) : 0,
      newestSnapshot: snapshots.length > 0 ? Math.max(...snapshots.map(s => s.timestamp)) : 0
    };
  }

  /**
   * Start periodic maintenance tasks
   */
  private startPeriodicTasks(): void {
    // Periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop periodic tasks
   */
  private stopPeriodicTasks(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Perform maintenance cleanup
   */
  private async performCleanup(): Promise<void> {
    const startTime = Date.now();
    const stats: CleanupStats = {
      expiredSnapshots: 0,
      compressedOperations: 0,
      freedMemory: 0
    };

    const now = Date.now();
    const expiredThreshold = now - (24 * 60 * 60 * 1000); // 24 hours

    // Clean up expired snapshots
    for (const [snapshotId, snapshot] of this.snapshots.entries()) {
      if (snapshot.timestamp < expiredThreshold) {
        this.deleteSnapshot(snapshotId);
        stats.expiredSnapshots++;
      }
    }

    // Compress operations for all users
    for (const userId of this.pendingOperations.keys()) {
      const beforeCount = this.pendingOperations.get(userId)?.length || 0;
      this.compressOperations(userId);
      const afterCount = this.pendingOperations.get(userId)?.length || 0;
      stats.compressedOperations += Math.max(0, beforeCount - afterCount);
    }

    stats.freedMemory = this.calculateMemoryUsage();

    console.log(`Cleanup completed in ${Date.now() - startTime}ms:`, stats);
    this.emit('cleanup-completed', stats);
  }

  /**
   * Enforce snapshot limits per user
   */
  private async enforceSnapshotLimits(userId: string): Promise<void> {
    const userSnapshotIds = this.userSnapshots.get(userId);
    if (!userSnapshotIds || userSnapshotIds.size <= this.config.maxSnapshots) {
      return;
    }

    // Get snapshots sorted by timestamp (oldest first)
    const snapshots = Array.from(userSnapshotIds)
      .map(id => this.snapshots.get(id))
      .filter((snapshot): snapshot is ClientStateSnapshot => snapshot !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest snapshots
    const toRemove = snapshots.length - this.config.maxSnapshots;
    for (let i = 0; i < toRemove; i++) {
      this.deleteSnapshot(snapshots[i].id);
    }
  }

  /**
   * Get pending operations for a user
   */
  private getPendingOperationsForUser(userId: string): StateOperation[] {
    return this.pendingOperations.get(userId) || [];
  }

  /**
   * Compress operations for a user
   */
  private compressOperations(userId: string): void {
    const operations = this.pendingOperations.get(userId);
    if (!operations || operations.length < this.config.compressionThreshold) {
      return;
    }

    // Simple compression: remove duplicate operations on the same target
    const compressed = new Map<string, StateOperation>();
    
    for (const op of operations) {
      const key = `${op.target}:${op.targetId}`;
      const existing = compressed.get(key);
      
      if (!existing || op.timestamp > existing.timestamp) {
        compressed.set(key, op);
      }
    }

    this.pendingOperations.set(userId, Array.from(compressed.values()));

    const delta: StateDelta = {
      fromVersion: 0,
      toVersion: 0,
      operations: Array.from(compressed.values()),
      checksum: '',
      compressed: true
    };

    this.emit('delta-compressed', delta);
  }

  /**
   * Apply operation to state object
   */
  private applyOperationToState(state: any, operation: StateOperation): void {
    switch (operation.target) {
      case 'session':
        this.applySessionOperation(state, operation);
        break;
      case 'subscription':
        this.applySubscriptionOperation(state, operation);
        break;
      case 'preference':
        this.applyPreferenceOperation(state, operation);
        break;
    }
  }

  /**
   * Apply session operation to state
   */
  private applySessionOperation(state: any, operation: StateOperation): void {
    if (!state.sessions) {
      state.sessions = {};
    }

    switch (operation.type) {
      case 'add':
      case 'update':
        if (state.sessions[operation.targetId]) {
          state.sessions[operation.targetId] = { ...state.sessions[operation.targetId], ...operation.payload };
        } else {
          state.sessions[operation.targetId] = operation.payload;
        }
        break;
      case 'delete':
        delete state.sessions[operation.targetId];
        if (state.activeSessionId === operation.targetId) {
          state.activeSessionId = null;
        }
        break;
    }
  }

  /**
   * Apply subscription operation to state
   */
  private applySubscriptionOperation(state: any, operation: StateOperation): void {
    if (!state.subscriptions) {
      state.subscriptions = [];
    }

    switch (operation.type) {
      case 'add':
        if (!state.subscriptions.includes(operation.payload)) {
          state.subscriptions.push(operation.payload);
        }
        break;
      case 'delete':
        state.subscriptions = state.subscriptions.filter((sub: string) => sub !== operation.targetId);
        break;
    }
  }

  /**
   * Apply preference operation to state
   */
  private applyPreferenceOperation(state: any, operation: StateOperation): void {
    if (!state.userPreferences) {
      state.userPreferences = {};
    }

    if (operation.targetId === '__activeSessionId') {
      state.activeSessionId = operation.payload;
    } else {
      switch (operation.type) {
        case 'update':
          state.userPreferences[operation.targetId] = operation.payload;
          break;
        case 'delete':
          delete state.userPreferences[operation.targetId];
          break;
      }
    }
  }

  /**
   * Clone state object
   */
  private cloneState(state: any): any {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Calculate state checksum
   */
  private calculateChecksum(state: any): string {
    const serialized = JSON.stringify(state, Object.keys(state).sort());
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(36);
  }

  /**
   * Calculate operations checksum
   */
  private calculateOperationsChecksum(operations: StateOperation[]): string {
    const serialized = JSON.stringify(operations.map(op => ({
      type: op.type,
      target: op.target,
      targetId: op.targetId,
      version: op.version
    })));
    
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString(36);
  }

  /**
   * Calculate approximate memory usage
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;
    
    // Calculate snapshots size
    for (const snapshot of this.snapshots.values()) {
      totalSize += JSON.stringify(snapshot).length * 2; // Approximate UTF-16 encoding
    }
    
    // Calculate operations size
    for (const operations of this.pendingOperations.values()) {
      totalSize += JSON.stringify(operations).length * 2;
    }
    
    return totalSize;
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('ClientStatePersistenceManager shutting down...');
    
    this.stopPeriodicTasks();
    
    // In a real implementation, we would persist snapshots to database
    await this.performFinalPersistence();
    
    console.log('ClientStatePersistenceManager shutdown complete');
  }

  /**
   * Final persistence before shutdown
   */
  private async performFinalPersistence(): Promise<void> {
    // In production, this would write all snapshots and operations to persistent storage
    const stats = this.getStats();
    console.log('Final persistence stats:', stats);
  }
}

export default ClientStatePersistenceManager;