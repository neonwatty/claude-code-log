import { TimelineView } from './TimelineView';
import { SessionSummary } from '../types/session-types';

/**
 * WebSocket integration for real-time timeline updates
 */
export class TimelineWebSocketIntegration {
  private timelineComponent: TimelineView;
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds

  constructor(timelineComponent: TimelineView) {
    this.timelineComponent = timelineComponent;
  }

  /**
   * Connect to WebSocket server for real-time updates
   */
  connect(url: string = 'ws://localhost:3001/ws'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(url);

        this.websocket.onopen = () => {
          console.log('Timeline WebSocket connected');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Send initial subscription message
          this.send({
            type: 'subscribe',
            channels: ['sessions', 'session-updates', 'session-events'],
          });
          
          resolve();
        };

        this.websocket.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.websocket.onclose = (event) => {
          console.log('Timeline WebSocket disconnected', event);
          this.handleDisconnection();
        };

        this.websocket.onerror = (error) => {
          console.error('Timeline WebSocket error:', error);
          reject(error);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.websocket) {
      this.websocket.close(1000, 'Client disconnecting');
      this.websocket = null;
    }
  }

  /**
   * Send message to WebSocket server
   */
  private send(message: any): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'session-created':
          this.handleSessionCreated(message.data);
          break;
          
        case 'session-updated':
          this.handleSessionUpdated(message.data);
          break;
          
        case 'session-ended':
          this.handleSessionEnded(message.data);
          break;
          
        case 'session-deleted':
          this.handleSessionDeleted(message.data);
          break;
          
        case 'sessions-list':
          this.handleSessionsList(message.data);
          break;
          
        case 'file-changed':
          this.handleFileChanged(message.data);
          break;
          
        case 'connection-info':
          this.handleConnectionInfo(message.data);
          break;
          
        case 'error':
          this.handleError(message.data);
          break;
          
        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
      
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error, event.data);
    }
  }

  /**
   * Handle new session creation
   */
  private handleSessionCreated(sessionData: any): void {
    const session = this.transformSessionData(sessionData);
    if (session) {
      this.timelineComponent.addSession(session);
      console.log('Session added to timeline via WebSocket:', session.sessionId);
    }
  }

  /**
   * Handle session updates
   */
  private handleSessionUpdated(updateData: any): void {
    const { sessionId, updates } = updateData;
    
    if (sessionId && updates) {
      // Transform updates to match SessionSummary format
      const transformedUpdates = this.transformSessionUpdates(updates);
      this.timelineComponent.updateSession(sessionId, transformedUpdates);
      console.log('Session updated in timeline via WebSocket:', sessionId);
    }
  }

  /**
   * Handle session ending
   */
  private handleSessionEnded(sessionData: any): void {
    const { sessionId, endTime, duration } = sessionData;
    
    if (sessionId) {
      this.timelineComponent.updateSession(sessionId, {
        isActive: false,
        endTime: endTime ? new Date(endTime) : new Date(),
        duration: duration || undefined,
      });
      console.log('Session ended in timeline via WebSocket:', sessionId);
    }
  }

  /**
   * Handle session deletion
   */
  private handleSessionDeleted(sessionData: any): void {
    const { sessionId } = sessionData;
    
    if (sessionId) {
      this.timelineComponent.removeSession(sessionId);
      console.log('Session removed from timeline via WebSocket:', sessionId);
    }
  }

  /**
   * Handle full sessions list update
   */
  private handleSessionsList(sessionsData: any[]): void {
    const sessions = sessionsData
      .map(data => this.transformSessionData(data))
      .filter(session => session !== null) as SessionSummary[];
    
    this.timelineComponent.sessions = sessions;
    console.log('Sessions list updated in timeline via WebSocket:', sessions.length);
  }

  /**
   * Handle file change notifications
   */
  private handleFileChanged(fileData: any): void {
    // This could trigger a refresh of session data if the log file changed
    console.log('File changed notification:', fileData);
    
    // Request updated session data
    this.send({
      type: 'get-sessions',
      timestamp: Date.now(),
    });
  }

  /**
   * Handle connection info
   */
  private handleConnectionInfo(info: any): void {
    console.log('WebSocket connection info:', info);
  }

  /**
   * Handle errors
   */
  private handleError(errorData: any): void {
    console.error('WebSocket server error:', errorData);
    
    // Emit error to timeline component
    this.timelineComponent.dispatchEvent(
      new CustomEvent('websocket-error', {
        detail: errorData,
        bubbles: true,
      })
    );
  }

  /**
   * Handle WebSocket disconnection and attempt reconnection
   */
  private handleDisconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      console.log(
        `Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms`
      );
      
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
          
          // Exponential backoff
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        });
      }, this.reconnectDelay);
      
    } else {
      console.error('Max reconnection attempts reached, giving up');
      
      // Emit connection lost event
      this.timelineComponent.dispatchEvent(
        new CustomEvent('websocket-connection-lost', {
          detail: { maxAttemptsReached: true },
          bubbles: true,
        })
      );
    }
  }

  /**
   * Transform raw session data to SessionSummary format
   */
  private transformSessionData(data: any): SessionSummary | null {
    try {
      // Handle different possible data formats from the WebSocket
      const session: SessionSummary = {
        sessionId: data.sessionId || data.id,
        title: data.title || data.sessionTitle,
        cwd: data.cwd || data.workingDirectory || data.currentWorkingDirectory || 'Unknown',
        startTime: new Date(data.startTime || data.timestamp || data.createdAt),
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        messageCount: data.messageCount || data.messages?.length || 0,
        userMessageCount: data.userMessageCount || data.userMessages || 0,
        assistantMessageCount: data.assistantMessageCount || data.assistantMessages || 0,
        duration: data.duration || undefined,
        isActive: data.isActive ?? !data.endTime,
        tags: data.tags || [],
        summary: data.summary || data.description,
        tokenUsage: data.tokenUsage || {
          inputTokens: data.inputTokens || 0,
          outputTokens: data.outputTokens || 0,
          totalTokens: data.totalTokens || 0,
        },
      };

      // Validate required fields
      if (!session.sessionId || !session.startTime) {
        console.warn('Invalid session data received:', data);
        return null;
      }

      return session;
      
    } catch (error) {
      console.error('Failed to transform session data:', error, data);
      return null;
    }
  }

  /**
   * Transform session update data
   */
  private transformSessionUpdates(updates: any): Partial<SessionSummary> {
    const transformed: Partial<SessionSummary> = {};

    // Map known update fields
    if (updates.title !== undefined) transformed.title = updates.title;
    if (updates.messageCount !== undefined) transformed.messageCount = updates.messageCount;
    if (updates.userMessageCount !== undefined) transformed.userMessageCount = updates.userMessageCount;
    if (updates.assistantMessageCount !== undefined) transformed.assistantMessageCount = updates.assistantMessageCount;
    if (updates.isActive !== undefined) transformed.isActive = updates.isActive;
    if (updates.endTime !== undefined) transformed.endTime = new Date(updates.endTime);
    if (updates.duration !== undefined) transformed.duration = updates.duration;
    if (updates.tags !== undefined) transformed.tags = updates.tags;
    if (updates.summary !== undefined) transformed.summary = updates.summary;

    // Handle token usage updates
    if (updates.tokenUsage) {
      transformed.tokenUsage = {
        inputTokens: updates.tokenUsage.inputTokens || 0,
        outputTokens: updates.tokenUsage.outputTokens || 0,
        totalTokens: updates.tokenUsage.totalTokens || 0,
      };
    }

    return transformed;
  }

  /**
   * Request refresh of session data
   */
  public refreshSessions(): void {
    this.send({
      type: 'get-sessions',
      timestamp: Date.now(),
    });
  }

  /**
   * Subscribe to specific session updates
   */
  public subscribeToSession(sessionId: string): void {
    this.send({
      type: 'subscribe-session',
      sessionId,
    });
  }

  /**
   * Unsubscribe from specific session updates
   */
  public unsubscribeFromSession(sessionId: string): void {
    this.send({
      type: 'unsubscribe-session',
      sessionId,
    });
  }

  /**
   * Get connection status
   */
  public get isConnected(): boolean {
    return this.websocket !== null && this.websocket.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  public get connectionState(): string {
    if (!this.websocket) return 'disconnected';
    
    switch (this.websocket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }
}