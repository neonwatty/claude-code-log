import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { Server as SocketIOServer } from 'socket.io';
import { TypedSocket, ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types/websocket';
import ContextSerializer, { ContextSerializationOptions } from './context-serializer';
import { cliIntegrationService } from '../routes/cli-integration';

/**
 * Context transfer states
 */
export type ContextTransferState = 'pending' | 'preparing' | 'ready' | 'transferring' | 'completed' | 'failed' | 'cancelled';

/**
 * Context transfer information
 */
export interface ContextTransfer {
  id: string;
  packageId?: string;
  sessionId?: string;
  socketId: string;
  userId?: string;
  state: ContextTransferState;
  sessionPath?: string;
  options?: ContextSerializationOptions;
  progress: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  stats?: {
    preparationTimeMs?: number;
    transferTimeMs?: number;
    packageSize?: number;
    compressionRatio?: number;
  };
}

/**
 * WebSocket Context Events Service
 * 
 * Handles real-time context transfer events and CLI synchronization through WebSocket connections.
 */
export class WebSocketContextEvents extends EventEmitter {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private activeTransfers = new Map<string, ContextTransfer>();
  private socketTransfers = new Map<string, Set<string>>(); // socket -> transfer IDs
  private readonly TRANSFER_TIMEOUT = 10 * 60 * 1000; // 10 minutes

  constructor(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    super();
    this.io = io;
    
    // Periodic cleanup of expired transfers
    setInterval(() => {
      this.cleanupExpiredTransfers();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Sets up context event handlers for a socket
   */
  setupContextEventHandlers(socket: TypedSocket): void {
    // Handle context preparation requests
    socket.on('context-prepare', async (sessionPath: string, options = {}, callback) => {
      try {
        console.log(`Context preparation requested by socket ${socket.id} for ${sessionPath}`);
        
        if (!socket.data.userId) {
          const error = 'Authentication required for context preparation';
          if (callback) callback({ success: false, error });
          return;
        }

        // Create transfer record
        const transfer = this.createTransfer(socket, sessionPath, options);
        
        // Update state to preparing
        this.updateTransferState(transfer.id, 'preparing');
        
        // Prepare context package
        const result = await cliIntegrationService.prepareSessionContext(sessionPath, options);
        
        // Update transfer with package info
        transfer.packageId = result.package.id;
        transfer.sessionId = result.package.sessionId;
        transfer.stats = {
          preparationTimeMs: result.stats.processingTimeMs,
          packageSize: result.package.info.size,
          compressionRatio: result.stats.compressionRatio,
        };
        
        // Update state to ready
        this.updateTransferState(transfer.id, 'ready');
        
        // Broadcast context prepared event
        this.broadcastContextPrepared(socket, transfer, result);
        
        // Send callback response
        if (callback) {
          callback({ 
            success: true, 
            packageId: result.package.id,
            transferId: transfer.id,
          });
        }

      } catch (error) {
        console.error(`Context preparation failed for socket ${socket.id}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (callback) {
          callback({ success: false, error: errorMessage });
        }
        
        // Broadcast failure
        socket.emit('context-transfer-failed', {
          transferId: 'unknown',
          packageId: 'unknown',
          error: errorMessage,
        });
      }
    });

    // Handle context transfer initiation
    socket.on('context-transfer-initiate', async (packageId: string, callback) => {
      try {
        console.log(`Context transfer initiation requested by socket ${socket.id} for package ${packageId}`);
        
        if (!socket.data.userId) {
          const error = 'Authentication required for context transfer';
          if (callback) callback({ success: false, error });
          return;
        }

        // Find transfer by package ID
        const transfer = this.findTransferByPackageId(packageId);
        if (!transfer) {
          const error = 'Transfer not found for package ID';
          if (callback) callback({ success: false, error });
          return;
        }

        // Verify socket owns this transfer
        if (transfer.socketId !== socket.id) {
          const error = 'Unauthorized access to transfer';
          if (callback) callback({ success: false, error });
          return;
        }

        // Update state to transferring
        this.updateTransferState(transfer.id, 'transferring');
        
        // Broadcast transfer initiated
        this.broadcastTransferInitiated(socket, transfer);
        
        // Simulate transfer progress (in real implementation, this would track actual CLI download)
        this.simulateTransferProgress(transfer);
        
        if (callback) {
          callback({ 
            success: true, 
            transferId: transfer.id,
          });
        }

      } catch (error) {
        console.error(`Context transfer initiation failed for socket ${socket.id}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (callback) {
          callback({ success: false, error: errorMessage });
        }
      }
    });

    // Handle transfer status requests
    socket.on('context-transfer-status', (transferId: string, callback) => {
      try {
        const transfer = this.activeTransfers.get(transferId);
        
        if (!transfer) {
          if (callback) callback({ error: 'Transfer not found' });
          return;
        }

        // Verify socket owns this transfer
        if (transfer.socketId !== socket.id) {
          if (callback) callback({ error: 'Unauthorized access to transfer' });
          return;
        }

        if (callback) {
          callback({
            id: transfer.id,
            packageId: transfer.packageId,
            sessionId: transfer.sessionId,
            state: transfer.state,
            progress: transfer.progress,
            error: transfer.error,
            createdAt: transfer.createdAt.toISOString(),
            updatedAt: transfer.updatedAt.toISOString(),
            stats: transfer.stats,
          });
        }

      } catch (error) {
        console.error(`Transfer status request failed for socket ${socket.id}:`, error);
        
        if (callback) {
          callback({ error: error instanceof Error ? error.message : String(error) });
        }
      }
    });

    // Track socket disconnection to cleanup transfers
    socket.on('disconnect', (reason) => {
      this.handleSocketDisconnect(socket.id, reason);
    });
  }

  /**
   * Creates a new context transfer
   */
  private createTransfer(
    socket: TypedSocket, 
    sessionPath: string, 
    options: ContextSerializationOptions
  ): ContextTransfer {
    const transfer: ContextTransfer = {
      id: randomUUID(),
      socketId: socket.id,
      userId: socket.data.userId,
      state: 'pending',
      sessionPath,
      options,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + this.TRANSFER_TIMEOUT),
    };

    // Store transfer
    this.activeTransfers.set(transfer.id, transfer);
    
    // Track socket transfers
    if (!this.socketTransfers.has(socket.id)) {
      this.socketTransfers.set(socket.id, new Set());
    }
    this.socketTransfers.get(socket.id)!.add(transfer.id);

    console.log(`Created context transfer ${transfer.id} for socket ${socket.id}`);
    return transfer;
  }

  /**
   * Updates transfer state and broadcasts to relevant sockets
   */
  private updateTransferState(transferId: string, newState: ContextTransferState, error?: string): void {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) return;

    const oldState = transfer.state;
    transfer.state = newState;
    transfer.updatedAt = new Date();
    
    if (error) {
      transfer.error = error;
    }

    console.log(`Transfer ${transferId} state changed: ${oldState} -> ${newState}`);
    
    // Emit internal event for monitoring
    this.emit('transfer-state-changed', transfer, oldState);
  }

  /**
   * Broadcasts context prepared event
   */
  private broadcastContextPrepared(socket: TypedSocket, transfer: ContextTransfer, result: any): void {
    const eventData = {
      packageId: transfer.packageId!,
      sessionId: transfer.sessionId!,
      stats: result.stats,
      expiresAt: result.package.expiresAt.toISOString(),
    };

    // Emit to the requesting socket
    socket.emit('context-prepared', eventData);
    
    // Emit to user's other sockets if they have any
    if (socket.data.userId) {
      socket.to(`user:${socket.data.userId}`).emit('context-prepared', eventData);
    }

    console.log(`Broadcasted context-prepared event for package ${transfer.packageId}`);
  }

  /**
   * Broadcasts transfer initiated event
   */
  private broadcastTransferInitiated(socket: TypedSocket, transfer: ContextTransfer): void {
    const eventData = {
      transferId: transfer.id,
      packageId: transfer.packageId!,
      status: transfer.state,
    };

    // Emit to the requesting socket
    socket.emit('context-transfer-initiated', eventData);
    
    // Emit to user's other sockets if they have any
    if (socket.data.userId) {
      socket.to(`user:${socket.data.userId}`).emit('context-transfer-initiated', eventData);
    }

    console.log(`Broadcasted context-transfer-initiated event for transfer ${transfer.id}`);
  }

  /**
   * Broadcasts transfer progress updates
   */
  private broadcastTransferProgress(transfer: ContextTransfer): void {
    const eventData = {
      transferId: transfer.id,
      progress: transfer.progress,
      status: transfer.state,
    };

    // Get the socket for this transfer
    const socket = this.io.sockets.sockets.get(transfer.socketId);
    if (socket) {
      socket.emit('context-transfer-progress', eventData);
      
      // Also emit to user's other sockets
      if (socket.data.userId) {
        socket.to(`user:${socket.data.userId}`).emit('context-transfer-progress', eventData);
      }
    }
  }

  /**
   * Broadcasts transfer completion
   */
  private broadcastTransferCompleted(transfer: ContextTransfer, success: boolean): void {
    const eventData = {
      transferId: transfer.id,
      packageId: transfer.packageId!,
      success,
    };

    // Get the socket for this transfer
    const socket = this.io.sockets.sockets.get(transfer.socketId);
    if (socket) {
      if (success) {
        socket.emit('context-transfer-completed', eventData);
      } else {
        socket.emit('context-transfer-failed', {
          ...eventData,
          error: transfer.error || 'Transfer failed',
        });
      }
      
      // Also emit to user's other sockets
      if (socket.data.userId) {
        const event = success ? 'context-transfer-completed' : 'context-transfer-failed';
        const data = success ? eventData : { ...eventData, error: transfer.error || 'Transfer failed' };
        socket.to(`user:${socket.data.userId}`).emit(event as any, data);
      }
    }

    console.log(`Broadcasted transfer ${success ? 'completed' : 'failed'} event for transfer ${transfer.id}`);
  }

  /**
   * Simulates transfer progress (in real implementation, this would track actual CLI download)
   */
  private simulateTransferProgress(transfer: ContextTransfer): void {
    let progress = 0;
    const startTime = Date.now();
    
    const progressInterval = setInterval(() => {
      progress += Math.random() * 20; // Random progress increments
      
      if (progress >= 100) {
        progress = 100;
        transfer.progress = progress;
        transfer.stats = {
          ...transfer.stats,
          transferTimeMs: Date.now() - startTime,
        };
        
        this.updateTransferState(transfer.id, 'completed');
        this.broadcastTransferCompleted(transfer, true);
        clearInterval(progressInterval);
        
        // Mark package as transferred in the context serializer
        if (transfer.packageId) {
          cliIntegrationService.markPackageTransferred(transfer.packageId);
        }
        
      } else {
        transfer.progress = Math.floor(progress);
        this.broadcastTransferProgress(transfer);
      }
    }, 500); // Update every 500ms

    // Set timeout to prevent infinite simulation
    setTimeout(() => {
      if (transfer.state === 'transferring') {
        this.updateTransferState(transfer.id, 'failed', 'Transfer timeout');
        this.broadcastTransferCompleted(transfer, false);
        clearInterval(progressInterval);
      }
    }, 30000); // 30 second timeout
  }

  /**
   * Finds a transfer by package ID
   */
  private findTransferByPackageId(packageId: string): ContextTransfer | undefined {
    for (const transfer of this.activeTransfers.values()) {
      if (transfer.packageId === packageId) {
        return transfer;
      }
    }
    return undefined;
  }

  /**
   * Handles socket disconnection cleanup
   */
  private handleSocketDisconnect(socketId: string, reason: string): void {
    console.log(`Socket ${socketId} disconnected (${reason}), cleaning up transfers`);
    
    const transferIds = this.socketTransfers.get(socketId);
    if (transferIds) {
      for (const transferId of transferIds) {
        const transfer = this.activeTransfers.get(transferId);
        if (transfer && (transfer.state === 'preparing' || transfer.state === 'transferring')) {
          this.updateTransferState(transferId, 'cancelled', 'Socket disconnected');
        }
      }
      this.socketTransfers.delete(socketId);
    }
  }

  /**
   * Cleans up expired transfers
   */
  private cleanupExpiredTransfers(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [transferId, transfer] of this.activeTransfers.entries()) {
      if (transfer.expiresAt <= now || transfer.state === 'completed' || transfer.state === 'failed') {
        this.activeTransfers.delete(transferId);
        
        // Clean up socket tracking
        const socketTransferIds = this.socketTransfers.get(transfer.socketId);
        if (socketTransferIds) {
          socketTransferIds.delete(transferId);
          if (socketTransferIds.size === 0) {
            this.socketTransfers.delete(transfer.socketId);
          }
        }
        
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired context transfers`);
    }
  }

  /**
   * Gets transfer statistics
   */
  getTransferStats(): {
    total: number;
    pending: number;
    preparing: number;
    ready: number;
    transferring: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const transfers = Array.from(this.activeTransfers.values());
    
    return {
      total: transfers.length,
      pending: transfers.filter(t => t.state === 'pending').length,
      preparing: transfers.filter(t => t.state === 'preparing').length,
      ready: transfers.filter(t => t.state === 'ready').length,
      transferring: transfers.filter(t => t.state === 'transferring').length,
      completed: transfers.filter(t => t.state === 'completed').length,
      failed: transfers.filter(t => t.state === 'failed').length,
      cancelled: transfers.filter(t => t.state === 'cancelled').length,
    };
  }

  /**
   * Gets all active transfers for a socket
   */
  getSocketTransfers(socketId: string): ContextTransfer[] {
    const transferIds = this.socketTransfers.get(socketId) || new Set();
    return Array.from(transferIds)
      .map(id => this.activeTransfers.get(id))
      .filter((transfer): transfer is ContextTransfer => transfer !== undefined);
  }

  /**
   * Cancels a transfer
   */
  cancelTransfer(transferId: string, socketId: string): boolean {
    const transfer = this.activeTransfers.get(transferId);
    
    if (!transfer || transfer.socketId !== socketId) {
      return false;
    }

    if (transfer.state === 'completed' || transfer.state === 'failed' || transfer.state === 'cancelled') {
      return false; // Already in final state
    }

    this.updateTransferState(transferId, 'cancelled', 'Transfer cancelled by user');
    this.broadcastTransferCompleted(transfer, false);
    
    return true;
  }

  /**
   * Shutdown cleanup
   */
  async shutdown(): Promise<void> {
    console.log('WebSocketContextEvents shutting down...');
    
    // Cancel all active transfers
    for (const transfer of this.activeTransfers.values()) {
      if (transfer.state === 'preparing' || transfer.state === 'transferring') {
        this.updateTransferState(transfer.id, 'cancelled', 'Service shutting down');
      }
    }
    
    this.activeTransfers.clear();
    this.socketTransfers.clear();
    
    console.log('WebSocketContextEvents shutdown complete');
  }
}

export default WebSocketContextEvents;