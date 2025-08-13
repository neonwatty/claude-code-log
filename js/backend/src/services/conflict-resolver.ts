import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

/**
 * Conflict resolution strategies for handling simultaneous updates
 */
export type ConflictResolutionStrategy = 
  | 'last-writer-wins'
  | 'operational-transform'
  | 'semantic-merge'
  | 'user-prompt'
  | 'vector-clock'
  | 'manual-resolution';

/**
 * Types of conflicts that can occur
 */
export type ConflictType = 
  | 'concurrent-update'
  | 'version-mismatch'
  | 'overlapping-edit'
  | 'data-corruption'
  | 'race-condition'
  | 'schema-conflict';

/**
 * Conflict severity levels
 */
export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Vector clock for tracking causality relationships
 */
export interface VectorClock {
  [nodeId: string]: number;
}

/**
 * Logical timestamp for ordering events
 */
export interface LogicalTimestamp {
  clock: number;
  nodeId: string;
  wallTime: number;
}

/**
 * Operation for operational transformation
 */
export interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'retain' | 'update' | 'move';
  position?: number;
  length?: number;
  content?: any;
  targetPath?: string[];
  timestamp: LogicalTimestamp;
  vectorClock: VectorClock;
  userId: string;
  sessionId: string;
}

/**
 * Conflict detection result
 */
export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  sessionId: string;
  operations: Operation[];
  detectedAt: string;
  metadata?: {
    conflictingFields?: string[];
    affectedUsers?: string[];
    estimatedResolutionTime?: number;
    automaticResolution?: boolean;
  };
}

/**
 * Resolution result
 */
export interface ConflictResolution {
  conflictId: string;
  strategy: ConflictResolutionStrategy;
  resolvedOperations: Operation[];
  mergedState?: any;
  requiresUserInput?: boolean;
  confidence: number; // 0-1 scale
  explanation?: string;
  warnings?: string[];
  appliedAt: string;
}

/**
 * State update with versioning information
 */
export interface VersionedStateUpdate {
  sessionId: string;
  userId: string;
  socketId: string;
  operation: Operation;
  vectorClock: VectorClock;
  timestamp: LogicalTimestamp;
  checksum: string;
  dependencies?: string[]; // Operation IDs this depends on
}

/**
 * Configuration for the conflict resolver
 */
export interface ConflictResolverConfig {
  defaultStrategy: ConflictResolutionStrategy;
  enableVectorClocks: boolean;
  maxConflictHistory: number;
  autoResolveThreshold: number; // confidence threshold for auto-resolution
  operationalTransformTimeout: number;
  semanticMergeRules?: Record<string, (a: any, b: any) => any>;
  notificationSettings: {
    notifyOnDetection: boolean;
    notifyOnResolution: boolean;
    notifyUsers: boolean;
  };
}

/**
 * Advanced conflict resolution engine for WebSocket state synchronization
 */
export class ConflictResolver extends EventEmitter {
  private config: ConflictResolverConfig;
  private nodeId: string;
  private logicalClock: number = 0;
  private vectorClocks = new Map<string, VectorClock>(); // sessionId -> vector clock
  private conflicts = new Map<string, Conflict>();
  private resolvedConflicts = new Map<string, ConflictResolution>();
  private operationHistory = new Map<string, Operation[]>(); // sessionId -> operations
  private conflictHistory: Conflict[] = [];

  private readonly DEFAULT_CONFIG: ConflictResolverConfig = {
    defaultStrategy: 'semantic-merge',
    enableVectorClocks: true,
    maxConflictHistory: 1000,
    autoResolveThreshold: 0.8,
    operationalTransformTimeout: 5000,
    semanticMergeRules: {},
    notificationSettings: {
      notifyOnDetection: true,
      notifyOnResolution: true,
      notifyUsers: true,
    },
  };

  constructor(nodeId?: string, config: Partial<ConflictResolverConfig> = {}) {
    super();
    this.nodeId = nodeId || randomUUID();
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Processes a state update and detects conflicts
   */
  async processStateUpdate(update: VersionedStateUpdate): Promise<Conflict | null> {
    // Update vector clock
    if (this.config.enableVectorClocks) {
      this.updateVectorClock(update.sessionId, update.vectorClock);
    }

    // Update logical clock
    this.logicalClock = Math.max(this.logicalClock, update.timestamp.clock) + 1;

    // Add to operation history
    this.addToOperationHistory(update.sessionId, update.operation);

    // Detect conflicts
    const conflict = await this.detectConflicts(update);

    if (conflict) {
      this.conflicts.set(conflict.id, conflict);
      this.addToConflictHistory(conflict);

      // Emit conflict detection event
      if (this.config.notificationSettings.notifyOnDetection) {
        this.emit('conflict-detected', conflict);
      }

      // Attempt automatic resolution if confidence is high enough
      if (conflict.metadata?.automaticResolution && 
          conflict.severity !== 'critical') {
        const resolution = await this.resolveConflict(conflict.id);
        if (resolution && resolution.confidence >= this.config.autoResolveThreshold) {
          await this.applyResolution(resolution);
        }
      }
    }

    return conflict;
  }

  /**
   * Detects conflicts in a state update
   */
  private async detectConflicts(update: VersionedStateUpdate): Promise<Conflict | null> {
    const sessionHistory = this.operationHistory.get(update.sessionId) || [];
    const recentOps = sessionHistory.filter(op => 
      this.isRecent(op.timestamp, update.timestamp) && 
      op.userId !== update.userId
    );

    if (recentOps.length === 0) {
      return null; // No concurrent operations
    }

    // Check for different types of conflicts
    const conflictTypes: ConflictType[] = [];
    const conflictingOps = [update.operation];

    // Concurrent update detection
    const concurrentOps = recentOps.filter(op => 
      this.isConcurrent(op.timestamp, update.timestamp)
    );

    if (concurrentOps.length > 0) {
      conflictTypes.push('concurrent-update');
      conflictingOps.push(...concurrentOps);
    }

    // Overlapping edit detection (for text/content operations)
    const overlappingOps = recentOps.filter(op => 
      this.hasOverlappingChanges(op, update.operation)
    );

    if (overlappingOps.length > 0) {
      conflictTypes.push('overlapping-edit');
      conflictingOps.push(...overlappingOps);
    }

    // Version mismatch detection
    if (this.config.enableVectorClocks) {
      const versionConflict = this.detectVersionMismatch(update);
      if (versionConflict) {
        conflictTypes.push('version-mismatch');
      }
    }

    if (conflictTypes.length === 0) {
      return null;
    }

    const conflict: Conflict = {
      id: randomUUID(),
      type: conflictTypes[0], // Primary conflict type
      severity: this.calculateSeverity(conflictTypes, conflictingOps),
      sessionId: update.sessionId,
      operations: conflictingOps,
      detectedAt: new Date().toISOString(),
      metadata: {
        conflictingFields: this.extractConflictingFields(conflictingOps),
        affectedUsers: [...new Set(conflictingOps.map(op => op.userId))],
        automaticResolution: this.canAutoResolve(conflictTypes, conflictingOps),
        estimatedResolutionTime: this.estimateResolutionTime(conflictTypes),
      },
    };

    return conflict;
  }

  /**
   * Resolves a conflict using the appropriate strategy
   */
  async resolveConflict(conflictId: string, strategy?: ConflictResolutionStrategy): Promise<ConflictResolution | null> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      return null;
    }

    const resolveStrategy = strategy || this.config.defaultStrategy;
    let resolution: ConflictResolution;

    try {
      switch (resolveStrategy) {
        case 'last-writer-wins':
          resolution = await this.resolveLastWriterWins(conflict);
          break;
        case 'operational-transform':
          resolution = await this.resolveOperationalTransform(conflict);
          break;
        case 'semantic-merge':
          resolution = await this.resolveSemanticMerge(conflict);
          break;
        case 'vector-clock':
          resolution = await this.resolveVectorClock(conflict);
          break;
        case 'user-prompt':
          resolution = await this.resolveUserPrompt(conflict);
          break;
        case 'manual-resolution':
        default:
          resolution = await this.resolveManual(conflict);
          break;
      }

      this.resolvedConflicts.set(conflictId, resolution);

      // Emit resolution event
      if (this.config.notificationSettings.notifyOnResolution) {
        this.emit('conflict-resolved', resolution);
      }

      return resolution;

    } catch (error) {
      this.emit('resolution-error', {
        conflictId,
        strategy: resolveStrategy,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      return null;
    }
  }

  /**
   * Last writer wins resolution strategy
   */
  private async resolveLastWriterWins(conflict: Conflict): Promise<ConflictResolution> {
    const sortedOps = conflict.operations.sort((a, b) => 
      b.timestamp.wallTime - a.timestamp.wallTime
    );

    const winningOp = sortedOps[0];

    return {
      conflictId: conflict.id,
      strategy: 'last-writer-wins',
      resolvedOperations: [winningOp],
      confidence: 0.7,
      explanation: `Applied the most recent operation from user ${winningOp.userId}`,
      appliedAt: new Date().toISOString(),
    };
  }

  /**
   * Operational transformation resolution strategy
   */
  private async resolveOperationalTransform(conflict: Conflict): Promise<ConflictResolution> {
    const transformedOps: Operation[] = [];

    // Simple operational transformation for insert/delete operations
    for (let i = 0; i < conflict.operations.length; i++) {
      let op = conflict.operations[i];
      
      // Transform against all previous operations
      for (let j = 0; j < i; j++) {
        op = this.transformOperation(op, conflict.operations[j]);
      }
      
      transformedOps.push(op);
    }

    return {
      conflictId: conflict.id,
      strategy: 'operational-transform',
      resolvedOperations: transformedOps,
      confidence: 0.85,
      explanation: 'Applied operational transformation to reconcile concurrent edits',
      appliedAt: new Date().toISOString(),
    };
  }

  /**
   * Semantic merge resolution strategy
   */
  private async resolveSemanticMerge(conflict: Conflict): Promise<ConflictResolution> {
    const mergedState = {};
    const warnings: string[] = [];

    // Group operations by target path
    const operationsByPath = new Map<string, Operation[]>();
    
    for (const op of conflict.operations) {
      const path = op.targetPath?.join('.') || 'root';
      const pathOps = operationsByPath.get(path) || [];
      pathOps.push(op);
      operationsByPath.set(path, pathOps);
    }

    // Apply semantic merge rules for each path
    for (const [path, ops] of operationsByPath) {
      const mergeRule = this.config.semanticMergeRules?.[path];
      
      if (mergeRule && ops.length === 2) {
        // Apply custom merge rule
        try {
          const merged = mergeRule(ops[0].content, ops[1].content);
          this.setPathValue(mergedState, path, merged);
        } catch (error) {
          warnings.push(`Failed to apply merge rule for ${path}: ${error}`);
          // Fallback to last writer wins
          this.setPathValue(mergedState, path, ops[ops.length - 1].content);
        }
      } else {
        // Default semantic merge logic
        const merged = this.defaultSemanticMerge(ops);
        this.setPathValue(mergedState, path, merged);
      }
    }

    return {
      conflictId: conflict.id,
      strategy: 'semantic-merge',
      resolvedOperations: [], // Operations are merged into state
      mergedState,
      confidence: warnings.length === 0 ? 0.9 : 0.6,
      explanation: 'Applied semantic merge rules to combine changes',
      warnings: warnings.length > 0 ? warnings : undefined,
      appliedAt: new Date().toISOString(),
    };
  }

  /**
   * Vector clock resolution strategy
   */
  private async resolveVectorClock(conflict: Conflict): Promise<ConflictResolution> {
    if (!this.config.enableVectorClocks) {
      throw new Error('Vector clocks are not enabled');
    }

    // Find the operation with the most advanced vector clock
    let mostAdvanced = conflict.operations[0];
    
    for (const op of conflict.operations) {
      if (this.isVectorClockMoreAdvanced(op.vectorClock, mostAdvanced.vectorClock)) {
        mostAdvanced = op;
      }
    }

    return {
      conflictId: conflict.id,
      strategy: 'vector-clock',
      resolvedOperations: [mostAdvanced],
      confidence: 0.95,
      explanation: 'Selected operation with most advanced vector clock',
      appliedAt: new Date().toISOString(),
    };
  }

  /**
   * User prompt resolution strategy
   */
  private async resolveUserPrompt(conflict: Conflict): Promise<ConflictResolution> {
    // Emit event for UI to show conflict resolution dialog
    this.emit('user-input-required', {
      conflictId: conflict.id,
      conflict,
      options: conflict.operations.map(op => ({
        id: op.id,
        description: this.generateOperationDescription(op),
        userId: op.userId,
        timestamp: op.timestamp,
      })),
    });

    return {
      conflictId: conflict.id,
      strategy: 'user-prompt',
      resolvedOperations: [],
      requiresUserInput: true,
      confidence: 0,
      explanation: 'Waiting for user input to resolve conflict',
      appliedAt: new Date().toISOString(),
    };
  }

  /**
   * Manual resolution strategy
   */
  private async resolveManual(conflict: Conflict): Promise<ConflictResolution> {
    return {
      conflictId: conflict.id,
      strategy: 'manual-resolution',
      resolvedOperations: [],
      requiresUserInput: true,
      confidence: 0,
      explanation: 'Conflict requires manual resolution',
      appliedAt: new Date().toISOString(),
    };
  }

  /**
   * Applies a conflict resolution
   */
  async applyResolution(resolution: ConflictResolution): Promise<void> {
    if (resolution.requiresUserInput) {
      // Cannot auto-apply, emit event for manual handling
      this.emit('manual-resolution-required', resolution);
      return;
    }

    const conflict = this.conflicts.get(resolution.conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${resolution.conflictId} not found`);
    }

    // Apply the resolved operations or merged state
    if (resolution.mergedState) {
      this.emit('state-merge-applied', {
        sessionId: conflict.sessionId,
        mergedState: resolution.mergedState,
        resolution,
      });
    } else if (resolution.resolvedOperations.length > 0) {
      this.emit('operations-applied', {
        sessionId: conflict.sessionId,
        operations: resolution.resolvedOperations,
        resolution,
      });
    }

    // Mark conflict as resolved
    this.conflicts.delete(resolution.conflictId);

    // Notify users if enabled
    if (this.config.notificationSettings.notifyUsers && conflict.metadata?.affectedUsers) {
      this.emit('user-notification', {
        userIds: conflict.metadata.affectedUsers,
        type: 'conflict-resolved',
        message: `Conflict in session ${conflict.sessionId} has been resolved using ${resolution.strategy}`,
        details: resolution,
      });
    }
  }

  /**
   * Handles user input for conflict resolution
   */
  async handleUserInput(conflictId: string, selectedOperationId: string): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    const selectedOp = conflict.operations.find(op => op.id === selectedOperationId);
    if (!selectedOp) {
      throw new Error(`Operation ${selectedOperationId} not found in conflict`);
    }

    const resolution: ConflictResolution = {
      conflictId,
      strategy: 'user-prompt',
      resolvedOperations: [selectedOp],
      confidence: 1.0,
      explanation: `User selected operation from ${selectedOp.userId}`,
      appliedAt: new Date().toISOString(),
    };

    await this.applyResolution(resolution);
  }

  // Helper methods

  private updateVectorClock(sessionId: string, incomingClock: VectorClock): void {
    const currentClock = this.vectorClocks.get(sessionId) || {};
    
    // Merge vector clocks
    const mergedClock: VectorClock = { ...currentClock };
    
    for (const [nodeId, clock] of Object.entries(incomingClock)) {
      mergedClock[nodeId] = Math.max(mergedClock[nodeId] || 0, clock);
    }
    
    // Increment our own clock
    mergedClock[this.nodeId] = (mergedClock[this.nodeId] || 0) + 1;
    
    this.vectorClocks.set(sessionId, mergedClock);
  }

  private addToOperationHistory(sessionId: string, operation: Operation): void {
    const history = this.operationHistory.get(sessionId) || [];
    history.push(operation);
    
    // Keep only recent operations (last 100)
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    this.operationHistory.set(sessionId, history);
  }

  private addToConflictHistory(conflict: Conflict): void {
    this.conflictHistory.push(conflict);
    
    if (this.conflictHistory.length > this.config.maxConflictHistory) {
      this.conflictHistory.splice(0, this.conflictHistory.length - this.config.maxConflictHistory);
    }
  }

  private isRecent(timestamp1: LogicalTimestamp, timestamp2: LogicalTimestamp): boolean {
    const timeDiff = Math.abs(timestamp1.wallTime - timestamp2.wallTime);
    return timeDiff < 10000; // 10 seconds
  }

  private isConcurrent(timestamp1: LogicalTimestamp, timestamp2: LogicalTimestamp): boolean {
    return Math.abs(timestamp1.wallTime - timestamp2.wallTime) < 1000; // 1 second
  }

  private hasOverlappingChanges(op1: Operation, op2: Operation): boolean {
    // Simple overlap detection for position-based operations
    if (op1.position !== undefined && op2.position !== undefined) {
      const op1End = op1.position + (op1.length || 0);
      const op2End = op2.position + (op2.length || 0);
      
      return !(op1End <= op2.position || op2End <= op1.position);
    }
    
    // Path-based overlap detection
    if (op1.targetPath && op2.targetPath) {
      const path1 = op1.targetPath.join('.');
      const path2 = op2.targetPath.join('.');
      return path1 === path2;
    }
    
    return false;
  }

  private detectVersionMismatch(update: VersionedStateUpdate): boolean {
    const sessionClock = this.vectorClocks.get(update.sessionId);
    if (!sessionClock) return false;
    
    // Check if the incoming vector clock is consistent
    for (const [nodeId, clock] of Object.entries(update.vectorClock)) {
      const ourClock = sessionClock[nodeId] || 0;
      if (clock > ourClock + 1) {
        return true; // Gap detected
      }
    }
    
    return false;
  }

  private calculateSeverity(types: ConflictType[], operations: Operation[]): ConflictSeverity {
    if (types.includes('data-corruption')) return 'critical';
    if (types.includes('schema-conflict')) return 'high';
    if (types.includes('overlapping-edit')) return 'medium';
    if (operations.length > 5) return 'high';
    return 'low';
  }

  private extractConflictingFields(operations: Operation[]): string[] {
    const fields = new Set<string>();
    
    for (const op of operations) {
      if (op.targetPath) {
        fields.add(op.targetPath.join('.'));
      }
    }
    
    return Array.from(fields);
  }

  private canAutoResolve(types: ConflictType[], operations: Operation[]): boolean {
    if (types.includes('data-corruption') || types.includes('schema-conflict')) {
      return false;
    }
    
    if (operations.length > 3) {
      return false; // Too complex
    }
    
    return true;
  }

  private estimateResolutionTime(types: ConflictType[]): number {
    if (types.includes('data-corruption')) return 300000; // 5 minutes
    if (types.includes('overlapping-edit')) return 60000; // 1 minute
    return 10000; // 10 seconds
  }

  private transformOperation(op: Operation, against: Operation): Operation {
    // Simple operational transformation implementation
    if (op.type === 'insert' && against.type === 'insert' && 
        op.position !== undefined && against.position !== undefined) {
      
      if (against.position <= op.position) {
        return {
          ...op,
          position: op.position + (against.length || 1),
        };
      }
    }
    
    if (op.type === 'delete' && against.type === 'insert' &&
        op.position !== undefined && against.position !== undefined) {
      
      if (against.position <= op.position) {
        return {
          ...op,
          position: op.position + (against.length || 1),
        };
      }
    }
    
    return op; // No transformation needed
  }

  private defaultSemanticMerge(operations: Operation[]): any {
    if (operations.length === 0) return null;
    if (operations.length === 1) return operations[0].content;
    
    // For arrays, merge them
    if (Array.isArray(operations[0].content)) {
      return operations.reduce((acc, op) => {
        if (Array.isArray(op.content)) {
          return [...acc, ...op.content];
        }
        return acc;
      }, []);
    }
    
    // For objects, deep merge
    if (typeof operations[0].content === 'object' && operations[0].content !== null) {
      return operations.reduce((acc, op) => {
        if (typeof op.content === 'object' && op.content !== null) {
          return { ...acc, ...op.content };
        }
        return acc;
      }, {});
    }
    
    // For primitives, use last writer wins
    return operations[operations.length - 1].content;
  }

  private setPathValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  private isVectorClockMoreAdvanced(clock1: VectorClock, clock2: VectorClock): boolean {
    let moreAdvanced = false;
    
    for (const [nodeId, count] of Object.entries(clock1)) {
      const otherCount = clock2[nodeId] || 0;
      if (count > otherCount) {
        moreAdvanced = true;
      } else if (count < otherCount) {
        return false;
      }
    }
    
    return moreAdvanced;
  }

  private generateOperationDescription(operation: Operation): string {
    const { type, userId, content, targetPath } = operation;
    const path = targetPath?.join('.') || 'document';
    
    switch (type) {
      case 'insert':
        return `${userId} inserted "${content}" at ${path}`;
      case 'delete':
        return `${userId} deleted content at ${path}`;
      case 'update':
        return `${userId} updated ${path} to "${content}"`;
      case 'move':
        return `${userId} moved content at ${path}`;
      default:
        return `${userId} performed ${type} operation at ${path}`;
    }
  }

  // Public API methods

  /**
   * Gets current conflict statistics
   */
  getConflictStats() {
    return {
      activeConflicts: this.conflicts.size,
      resolvedConflicts: this.resolvedConflicts.size,
      totalConflictsHistorical: this.conflictHistory.length,
      conflictsByType: this.getConflictsByType(),
      resolutionsByStrategy: this.getResolutionsByStrategy(),
    };
  }

  private getConflictsByType() {
    const counts: Record<ConflictType, number> = {
      'concurrent-update': 0,
      'version-mismatch': 0,
      'overlapping-edit': 0,
      'data-corruption': 0,
      'race-condition': 0,
      'schema-conflict': 0,
    };

    for (const conflict of this.conflictHistory) {
      counts[conflict.type]++;
    }

    return counts;
  }

  private getResolutionsByStrategy() {
    const counts: Record<ConflictResolutionStrategy, number> = {
      'last-writer-wins': 0,
      'operational-transform': 0,
      'semantic-merge': 0,
      'user-prompt': 0,
      'vector-clock': 0,
      'manual-resolution': 0,
    };

    for (const resolution of this.resolvedConflicts.values()) {
      counts[resolution.strategy]++;
    }

    return counts;
  }

  /**
   * Gets active conflicts
   */
  getActiveConflicts(): Conflict[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * Gets conflict history
   */
  getConflictHistory(): Conflict[] {
    return [...this.conflictHistory];
  }

  /**
   * Updates resolver configuration
   */
  updateConfig(newConfig: Partial<ConflictResolverConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }

  /**
   * Creates a new logical timestamp
   */
  createLogicalTimestamp(): LogicalTimestamp {
    this.logicalClock++;
    return {
      clock: this.logicalClock,
      nodeId: this.nodeId,
      wallTime: Date.now(),
    };
  }

  /**
   * Creates a vector clock for a session
   */
  createVectorClock(sessionId: string): VectorClock {
    const clock = this.vectorClocks.get(sessionId) || {};
    clock[this.nodeId] = (clock[this.nodeId] || 0) + 1;
    this.vectorClocks.set(sessionId, clock);
    return { ...clock };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Clear all data
    this.conflicts.clear();
    this.resolvedConflicts.clear();
    this.operationHistory.clear();
    this.vectorClocks.clear();
    this.conflictHistory.length = 0;
    
    this.removeAllListeners();
    console.log('ConflictResolver shutdown complete');
  }
}

export default ConflictResolver;