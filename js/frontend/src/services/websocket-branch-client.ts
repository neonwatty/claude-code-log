import { Socket, io } from 'socket.io-client';

export interface BranchNotificationData {
  parentSessionId: string;
  branchSession: {
    id: string;
    parentSessionId: string;
    branchPoint: number;
    branchTimestamp: string;
    branchMetadata?: {
      branchName?: string;
      branchReason?: string;
      originalMessage?: string;
    };
    workingDirectory?: string;
    status: string;
    createdAt: string;
  };
  affectedSessions: string[];
}

export interface BranchTreeUpdateData {
  rootSessionId: string;
  branchData: {
    parentId: string;
    childId: string;
    branchPoint: number;
  };
  affectedSessions: string[];
}

export type BranchEventHandler = (data: BranchNotificationData) => void;
export type BranchTreeUpdateHandler = (data: BranchTreeUpdateData) => void;

/**
 * Client-side WebSocket service for handling session branch notifications
 */
export class WebSocketBranchClient {
  private socket: Socket | null = null;
  private url: string;
  private isConnected = false;
  private eventHandlers = new Map<string, Function[]>();
  private userId?: string;
  private currentSessionId?: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string = 'http://localhost:3001') {
    this.url = url;
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(userId: string, sessionId?: string): Promise<void> {
    if (this.isConnected) {
      console.warn('WebSocket already connected');
      return;
    }

    this.userId = userId;
    this.currentSessionId = sessionId;

    this.socket = io(this.url, {
      transports: ['websocket', 'polling'],
      forceNew: true,
    });

    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Failed to create socket'));

      // Handle connection
      this.socket.on('connect', () => {
        console.log('WebSocket connected:', this.socket!.id);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Authenticate with the server
        this.authenticate().then(resolve).catch(reject);
      });

      // Handle disconnection
      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        this.isConnected = false;
        
        // Attempt to reconnect unless it was a manual disconnect
        if (reason !== 'io client disconnect' && this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            this.reconnectAttempts++;
            this.socket?.connect();
          }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
        }
      });

      // Handle connection errors
      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });

      // Set up branch event listeners
      this.setupBranchEventListeners();
    });
  }

  /**
   * Authenticate with the server
   */
  private async authenticate(): Promise<void> {
    if (!this.socket || !this.userId) return;

    return new Promise((resolve, reject) => {
      this.socket!.emit('authenticate', {
        userId: this.userId,
        sessionId: this.currentSessionId,
      });

      this.socket!.on('authenticated', (response) => {
        if (response.success) {
          console.log('WebSocket authenticated successfully');
          
          // Join current session if specified
          if (this.currentSessionId) {
            this.joinSession(this.currentSessionId);
          }
          
          resolve();
        } else {
          console.error('WebSocket authentication failed:', response.error);
          reject(new Error(response.error || 'Authentication failed'));
        }
      });
    });
  }

  /**
   * Set up branch-specific event listeners
   */
  private setupBranchEventListeners(): void {
    if (!this.socket) return;

    // Listen for session branched events
    this.socket.on('session-branched', (data: BranchNotificationData) => {
      console.log('Session branched:', data);
      this.emitToHandlers('session-branched', data);
    });

    // Listen for branch tree updated events
    this.socket.on('branch-tree-updated', (data: BranchTreeUpdateData) => {
      console.log('Branch tree updated:', data);
      this.emitToHandlers('branch-tree-updated', data);
    });

    // Listen for errors
    this.socket.on('error-message', (error) => {
      console.error('WebSocket error:', error);
      this.emitToHandlers('error', error);
    });
  }

  /**
   * Join a session room to receive session-specific notifications
   */
  joinSession(sessionId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('Cannot join session: WebSocket not connected');
      return;
    }

    console.log('Joining session:', sessionId);
    this.currentSessionId = sessionId;
    this.socket.emit('join-session', sessionId);
  }

  /**
   * Leave a session room
   */
  leaveSession(sessionId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('Cannot leave session: WebSocket not connected');
      return;
    }

    console.log('Leaving session:', sessionId);
    this.socket.emit('leave-session', sessionId);
    
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = undefined;
    }
  }

  /**
   * Register an event handler for branch notifications
   */
  onBranchCreated(handler: BranchEventHandler): void {
    this.addEventListener('session-branched', handler);
  }

  /**
   * Register an event handler for branch tree updates
   */
  onBranchTreeUpdated(handler: BranchTreeUpdateHandler): void {
    this.addEventListener('branch-tree-updated', handler);
  }

  /**
   * Register an event handler for errors
   */
  onError(handler: (error: any) => void): void {
    this.addEventListener('error', handler);
  }

  /**
   * Remove an event handler
   */
  removeEventListener(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Remove all event handlers for a specific event
   */
  removeAllEventListeners(event?: string): void {
    if (event) {
      this.eventHandlers.delete(event);
    } else {
      this.eventHandlers.clear();
    }
  }

  /**
   * Generic event handler registration
   */
  private addEventListener(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * Emit event to registered handlers
   */
  private emitToHandlers(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Error in event handler:', error);
      }
    });
  }

  /**
   * Get connection status
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | undefined {
    return this.currentSessionId;
  }

  /**
   * Get user ID
   */
  getUserId(): string | undefined {
    return this.userId;
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      console.log('Disconnecting WebSocket');
      this.isConnected = false;
      this.socket.disconnect();
      this.socket = null;
    }
    this.removeAllEventListeners();
  }

  /**
   * Send a test ping to the server
   */
  ping(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      this.socket.emit('ping', (response: string) => {
        resolve(response);
      });
    });
  }
}

/**
 * Utility functions for working with branch data
 */
export class BranchNotificationUtils {
  /**
   * Check if a session is affected by a branch notification
   */
  static isSessionAffected(sessionId: string, notification: BranchNotificationData): boolean {
    return notification.affectedSessions.includes(sessionId);
  }

  /**
   * Check if a session is affected by a branch tree update
   */
  static isSessionAffectedByTreeUpdate(sessionId: string, update: BranchTreeUpdateData): boolean {
    return update.affectedSessions.includes(sessionId);
  }

  /**
   * Get the branch name from notification data
   */
  static getBranchName(notification: BranchNotificationData): string {
    return notification.branchSession.branchMetadata?.branchName || 
           `Branch from ${notification.parentSessionId}`;
  }

  /**
   * Get a human-readable description of the branch
   */
  static getBranchDescription(notification: BranchNotificationData): string {
    const metadata = notification.branchSession.branchMetadata;
    if (metadata?.branchReason) {
      return metadata.branchReason;
    }
    return `Branched from message ${notification.branchSession.branchPoint}`;
  }

  /**
   * Format branch timestamp for display
   */
  static formatBranchTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }
}

export default WebSocketBranchClient;