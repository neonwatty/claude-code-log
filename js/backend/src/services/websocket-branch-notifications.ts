import { Server as SocketIOServer } from 'socket.io';
import { randomUUID } from 'crypto';
import SessionStateManager, { SessionData } from './session-state';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData,
  SessionBranchEvent,
  AppEvent
} from '../types/websocket';
import { EventManager } from './eventManager';

/**
 * Service for handling WebSocket notifications related to session branching
 * Listens to SessionStateManager events and broadcasts to connected clients
 */
export class WebSocketBranchNotificationService {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private sessionStateManager: SessionStateManager;
  private eventManager?: EventManager;
  private initialized = false;

  constructor(
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    sessionStateManager: SessionStateManager,
    eventManager?: EventManager
  ) {
    this.io = io;
    this.sessionStateManager = sessionStateManager;
    this.eventManager = eventManager;
  }

  /**
   * Initialize the branch notification listeners
   */
  initialize(): void {
    if (this.initialized) {
      console.warn('WebSocketBranchNotificationService already initialized');
      return;
    }

    // Listen to session-branched events
    this.sessionStateManager.on('session-branched', (parentSession: SessionData, branchSession: SessionData) => {
      this.handleSessionBranched(parentSession, branchSession);
    });

    // Listen to branch-tree-updated events
    this.sessionStateManager.on('branch-tree-updated', (rootSessionId: string, branchData: { parentId: string; childId: string; branchPoint: number }) => {
      this.handleBranchTreeUpdated(rootSessionId, branchData);
    });

    this.initialized = true;
    console.log('WebSocketBranchNotificationService initialized');
  }

  /**
   * Handle session branched event - when a new branch is created
   */
  private async handleSessionBranched(parentSession: SessionData, branchSession: SessionData): Promise<void> {
    try {
      console.log(`Branch created: ${branchSession.id} from parent ${parentSession.id} at point ${branchSession.branchPoint}`);

      // Determine affected sessions for notifications
      const affectedSessions = this.getAffectedSessions(parentSession.id, branchSession.id);

      // Create WebSocket notification data
      const notificationData = {
        parentSessionId: parentSession.id,
        branchSession: {
          id: branchSession.id,
          parentSessionId: branchSession.parentSessionId!,
          branchPoint: branchSession.branchPoint!,
          branchTimestamp: branchSession.branchTimestamp!.toISOString(),
          branchMetadata: branchSession.branchMetadata,
          workingDirectory: branchSession.workingDirectory,
          status: branchSession.status,
          createdAt: branchSession.createdAt.toISOString(),
        },
        affectedSessions,
      };

      // Broadcast to all affected sessions
      for (const sessionId of affectedSessions) {
        this.io.to(`session:${sessionId}`).emit('session-branched', notificationData);
      }

      // Broadcast to all clients (for global session lists)
      this.io.emit('session-branched', notificationData);

      // Create and publish app event if EventManager is available
      if (this.eventManager) {
        const appEvent: SessionBranchEvent = {
          id: randomUUID(),
          type: 'session:branched',
          timestamp: new Date().toISOString(),
          sessionId: branchSession.id,
          userId: undefined, // Will be set by EventManager based on socket context
          data: {
            sessionId: branchSession.id,
            parentSessionId: parentSession.id,
            branchPoint: branchSession.branchPoint,
            branchTimestamp: branchSession.branchTimestamp?.toISOString(),
            branchSession: notificationData.branchSession,
            affectedSessions,
          },
        };

        await this.eventManager.publishEvent(appEvent);
      }

      console.log(`Session branch notification sent for branch ${branchSession.id}`);
    } catch (error) {
      console.error('Error handling session branched event:', error);
    }
  }

  /**
   * Handle branch tree updated event - when the branch structure changes
   */
  private async handleBranchTreeUpdated(rootSessionId: string, branchData: { parentId: string; childId: string; branchPoint: number }): Promise<void> {
    try {
      console.log(`Branch tree updated: root=${rootSessionId}, parent=${branchData.parentId}, child=${branchData.childId}`);

      // Get all sessions in the branch tree to determine who needs updates
      const branchTree = this.sessionStateManager.getBranchTree(rootSessionId);
      const affectedSessions = branchTree ? this.getAllSessionsInTree(branchTree) : [rootSessionId, branchData.parentId, branchData.childId];

      // Create WebSocket notification data
      const notificationData = {
        rootSessionId,
        branchData: {
          parentId: branchData.parentId,
          childId: branchData.childId,
          branchPoint: branchData.branchPoint,
        },
        affectedSessions,
      };

      // Broadcast to all affected sessions
      for (const sessionId of affectedSessions) {
        this.io.to(`session:${sessionId}`).emit('branch-tree-updated', notificationData);
      }

      // Broadcast to all clients (for global session lists)
      this.io.emit('branch-tree-updated', notificationData);

      // Create and publish app event if EventManager is available
      if (this.eventManager) {
        const appEvent: SessionBranchEvent = {
          id: randomUUID(),
          type: 'session:branch-tree-updated',
          timestamp: new Date().toISOString(),
          sessionId: rootSessionId,
          userId: undefined, // Will be set by EventManager based on socket context
          data: {
            sessionId: rootSessionId,
            rootSessionId,
            branchData: branchData,
            affectedSessions,
          },
        };

        await this.eventManager.publishEvent(appEvent);
      }

      console.log(`Branch tree update notification sent for root session ${rootSessionId}`);
    } catch (error) {
      console.error('Error handling branch tree updated event:', error);
    }
  }

  /**
   * Get all sessions that should be notified when a branch is created
   */
  private getAffectedSessions(parentSessionId: string, branchSessionId: string): string[] {
    const affected = new Set<string>();
    
    // Always include the parent and new branch
    affected.add(parentSessionId);
    affected.add(branchSessionId);

    try {
      // Get root session to include all sessions in the tree
      const rootSessionId = this.sessionStateManager.getRootSessionId(parentSessionId);
      const branchTree = this.sessionStateManager.getBranchTree(rootSessionId);
      
      if (branchTree) {
        // Include all sessions in the tree
        affected.add(branchTree.root.id);
        for (const [sessionId, branches] of branchTree.branches) {
          affected.add(sessionId);
          for (const branch of branches) {
            affected.add(branch.id);
          }
        }
      }
    } catch (error) {
      console.warn('Could not determine full branch tree, using minimal affected sessions:', error);
    }

    return Array.from(affected);
  }

  /**
   * Get all session IDs from a branch tree structure
   */
  private getAllSessionsInTree(branchTree: { root: SessionData; branches: Map<string, SessionData[]> }): string[] {
    const allSessions = new Set<string>();
    
    // Add root session
    allSessions.add(branchTree.root.id);
    
    // Add all branch sessions
    for (const [parentId, branches] of branchTree.branches) {
      allSessions.add(parentId);
      for (const branch of branches) {
        allSessions.add(branch.id);
      }
    }
    
    return Array.from(allSessions);
  }

  /**
   * Manually notify clients about a branch creation (for use in API endpoints)
   */
  public async notifyBranchCreated(parentSession: SessionData, branchSession: SessionData): Promise<void> {
    await this.handleSessionBranched(parentSession, branchSession);
  }

  /**
   * Manually notify clients about branch tree updates (for use in API endpoints)
   */
  public async notifyBranchTreeUpdated(rootSessionId: string, branchData: { parentId: string; childId: string; branchPoint: number }): Promise<void> {
    await this.handleBranchTreeUpdated(rootSessionId, branchData);
  }

  /**
   * Check if the service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get stats about branch notifications
   */
  public getStats() {
    return {
      initialized: this.initialized,
      connectedClients: this.io.engine.clientsCount,
      hasEventManager: !!this.eventManager,
    };
  }

  /**
   * Cleanup and shutdown the service
   */
  public shutdown(): void {
    if (!this.initialized) {
      return;
    }

    // Remove all event listeners
    this.sessionStateManager.removeAllListeners('session-branched');
    this.sessionStateManager.removeAllListeners('branch-tree-updated');

    this.initialized = false;
    console.log('WebSocketBranchNotificationService shutdown');
  }
}

export default WebSocketBranchNotificationService;