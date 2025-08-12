import { TimelineView } from './TimelineView';
import { SessionSummary } from '../types/session-types';
import { StateSynchronizationManager, StateSyncEventType } from '../../services/state-synchronization-manager';

/**
 * WebSocket integration for real-time timeline updates
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  nextAttemptTime: number;
}

interface ConnectionHealthMetrics {
  latency: number;
  packetLoss: number;
  quality: 'excellent' | 'good' | 'poor' | 'critical';
  lastPingTime: number;
  lastPongTime: number;
}

export class TimelineWebSocketIntegration {
  private timelineComponent: TimelineView;
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 60000; // Max 60 seconds
  private reconnectMultiplier = 1.5; // Exponential backoff multiplier
  private jitterFactor = 0.1; // 10% jitter
  
  // Circuit breaker
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed',
    nextAttemptTime: 0
  };
  private circuitBreakerThreshold = 5;
  private circuitBreakerTimeout = 30000; // 30 seconds
  
  // Connection health monitoring
  private connectionHealth: ConnectionHealthMetrics = {
    latency: 0,
    packetLoss: 0,
    quality: 'good',
    lastPingTime: 0,
    lastPongTime: 0
  };
  
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectToken: string | null = null;
  private stateManager: StateSynchronizationManager;

  constructor(timelineComponent: TimelineView) {
    this.timelineComponent = timelineComponent;
    
    // Initialize state synchronization manager
    this.stateManager = new StateSynchronizationManager({
      maxQueueSize: 500,
      syncTimeoutMs: 15000,
      conflictResolutionStrategy: 'server-wins',
      snapshotIntervalMs: 30000 // 30 seconds
    });
    
    this.setupStateManagerListeners();
  }

  /**
   * Connect to WebSocket server for real-time updates with enhanced reconnection
   */
  connect(url: string = 'ws://localhost:3001/ws'): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check circuit breaker before attempting connection
      if (!this.canAttemptConnection()) {
        const nextAttemptIn = this.circuitBreaker.nextAttemptTime - Date.now();
        reject(new Error(`Circuit breaker open. Next attempt in ${nextAttemptIn}ms`));
        return;
      }

      try {
        this.websocket = new WebSocket(url);

        this.websocket.onopen = () => {
          console.log('Timeline WebSocket connected');
          this.onConnectionSuccess();
          
          // Authenticate with reconnect token if available
          if (this.reconnectToken) {
            this.send({
              type: 'authenticate',
              reconnectToken: this.reconnectToken
            });
          }
          
          // Send initial subscription message
          this.send({
            type: 'subscribe',
            channels: ['sessions', 'session-updates', 'session-events', 'session-status'],
          });
          
          // Start health monitoring
          this.startHealthMonitoring();
          
          // Initialize state synchronization
          this.requestStateSync();
          
          resolve();
        };

        this.websocket.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.websocket.onclose = (event) => {
          console.log('Timeline WebSocket disconnected', event);
          this.stopHealthMonitoring();
          this.handleDisconnection(event);
        };

        this.websocket.onerror = (error) => {
          console.error('Timeline WebSocket error:', error);
          this.recordConnectionFailure();
          reject(error);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        this.recordConnectionFailure();
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.stopHealthMonitoring();
    if (this.websocket) {
      this.websocket.close(1000, 'Client disconnecting');
      this.websocket = null;
    }
    this.reconnectAttempts = 0;
    
    // Note: We don't dispose the state manager here as it should persist
    // state across connection cycles for offline functionality
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
          
        case 'authenticated':
          this.handleAuthenticated(message.data);
          break;
          
        case 'heartbeat-response':
          this.handleHeartbeatResponse();
          break;
          
        case 'reconnect-required':
          this.handleReconnectRequired(message.data);
          break;
          
        case 'state-sync-response':
          this.handleStateSyncResponse(message.data);
          break;
          
        case 'state-update':
          this.handleStateUpdate(message.data);
          break;
          
        case 'state-conflict':
          this.handleStateConflict(message.data);
          break;
          
        case 'error':
          this.handleError(message.data);
          break;
          
        // Session status events
        case 'session-status-changed':
          this.handleSessionStatusChanged(message.data);
          break;
          
        case 'session-status-subscription-created':
          this.handleSessionStatusSubscriptionCreated(message.data);
          break;
          
        case 'session-status-subscription-removed':
          this.handleSessionStatusSubscriptionRemoved(message.data);
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
      // Update state manager
      this.stateManager.updateSession(session.sessionId, session);
      
      // Update timeline component
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
      
      // Update state manager
      this.stateManager.updateSession(sessionId, transformedUpdates);
      
      // Update timeline component
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
      const updates = {
        isActive: false,
        endTime: endTime ? new Date(endTime) : new Date(),
        duration: duration || undefined,
      };
      
      // Update state manager
      this.stateManager.updateSession(sessionId, updates);
      
      // Update timeline component
      this.timelineComponent.updateSession(sessionId, updates);
      console.log('Session ended in timeline via WebSocket:', sessionId);
    }
  }

  /**
   * Handle session deletion
   */
  private handleSessionDeleted(sessionData: any): void {
    const { sessionId } = sessionData;
    
    if (sessionId) {
      // Update state manager
      this.stateManager.removeSession(sessionId);
      
      // Update timeline component
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
    
    // Update state manager with all sessions
    sessions.forEach(session => {
      this.stateManager.updateSession(session.sessionId, session);
    });
    
    // Update timeline component
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
   * Handle session status changes
   */
  private handleSessionStatusChanged(statusData: any): void {
    console.log('Session status changed:', statusData);
    
    const { sessionId, status, progress, metadata, performance, error, warning } = statusData;
    
    if (sessionId) {
      // Update session with status information
      const sessionUpdates: Partial<SessionSummary> = {};
      
      // Map status to session properties
      if (status) {
        sessionUpdates.isActive = status.current === 'active' || status.current === 'processing';
        
        // Add status information to summary
        let statusText = `Status: ${status.current}`;
        if (status.reason) {
          statusText += ` - ${status.reason}`;
        }
        
        // Add progress information if available
        if (progress && progress.percentage !== undefined) {
          statusText += ` (${progress.percentage}%)`;
          if (progress.stage) {
            statusText += ` - ${progress.stage}`;
          }
        }
        
        sessionUpdates.summary = statusText;
      }
      
      // Update session tags to include status
      const existingTags = this.timelineComponent.sessions.find(s => s.sessionId === sessionId)?.tags || [];
      if (status) {
        const statusTag = `status:${status.current}`;
        const filteredTags = existingTags.filter(tag => !tag.startsWith('status:'));
        sessionUpdates.tags = [...filteredTags, statusTag];
      }
      
      // Update the session in timeline
      this.timelineComponent.updateSession(sessionId, sessionUpdates);
      
      // Emit status change event for other components
      this.timelineComponent.dispatchEvent(
        new CustomEvent('session-status-changed', {
          detail: {
            sessionId,
            status,
            progress,
            metadata,
            performance,
            error,
            warning
          },
          bubbles: true,
        })
      );
    }
  }

  /**
   * Handle session status subscription created
   */
  private handleSessionStatusSubscriptionCreated(data: any): void {
    console.log('Session status subscription created:', data);
    
    const { subscriptionId, sessionId } = data;
    
    // Store subscription info for cleanup
    // In a full implementation, we'd track these subscriptions
    
    // Emit subscription created event
    this.timelineComponent.dispatchEvent(
      new CustomEvent('session-status-subscribed', {
        detail: { subscriptionId, sessionId },
        bubbles: true,
      })
    );
  }

  /**
   * Handle session status subscription removed
   */
  private handleSessionStatusSubscriptionRemoved(data: any): void {
    console.log('Session status subscription removed:', data);
    
    const { subscriptionId, sessionId } = data;
    
    // Emit subscription removed event
    this.timelineComponent.dispatchEvent(
      new CustomEvent('session-status-unsubscribed', {
        detail: { subscriptionId, sessionId },
        bubbles: true,
      })
    );
  }

  /**
   * Handle WebSocket disconnection and attempt reconnection with enhanced logic
   */
  private handleDisconnection(event?: CloseEvent): void {
    // Don't reconnect if it was a deliberate disconnect
    if (event && event.code === 1000) {
      return;
    }
    
    this.recordConnectionFailure();
    
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.canAttemptConnection()) {
      this.reconnectAttempts++;
      
      const delay = this.calculateReconnectionDelay();
      
      console.log(
        `Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`
      );
      
      // Emit reconnecting event
      this.timelineComponent.dispatchEvent(
        new CustomEvent('websocket-reconnecting', {
          detail: { 
            attempt: this.reconnectAttempts, 
            maxAttempts: this.maxReconnectAttempts,
            delay 
          },
          bubbles: true,
        })
      );
      
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
      
    } else {
      const reason = this.reconnectAttempts >= this.maxReconnectAttempts 
        ? 'maxAttemptsReached' 
        : 'circuitBreakerOpen';
        
      console.error(`Giving up reconnection: ${reason}`);
      
      // Emit connection lost event
      this.timelineComponent.dispatchEvent(
        new CustomEvent('websocket-connection-lost', {
          detail: { reason },
          bubbles: true,
        })
      );
    }
  }
  
  /**
   * Calculate reconnection delay with exponential backoff and jitter
   */
  private calculateReconnectionDelay(): number {
    const exponentialDelay = Math.min(
      this.baseReconnectDelay * Math.pow(this.reconnectMultiplier, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * this.jitterFactor * Math.random();
    return Math.floor(exponentialDelay + jitter);
  }
  
  /**
   * Check if connection attempt is allowed by circuit breaker
   */
  private canAttemptConnection(): boolean {
    const now = Date.now();
    
    switch (this.circuitBreaker.state) {
      case 'closed':
        return true;
        
      case 'open':
        if (now >= this.circuitBreaker.nextAttemptTime) {
          // Transition to half-open
          this.circuitBreaker.state = 'half-open';
          return true;
        }
        return false;
        
      case 'half-open':
        return true;
        
      default:
        return true;
    }
  }
  
  /**
   * Record connection failure for circuit breaker
   */
  private recordConnectionFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    // Check if threshold exceeded
    if (this.circuitBreaker.failures >= this.circuitBreakerThreshold) {
      this.circuitBreaker.state = 'open';
      this.circuitBreaker.nextAttemptTime = Date.now() + this.circuitBreakerTimeout;
      console.log(`Circuit breaker opened after ${this.circuitBreaker.failures} failures`);
    }
  }
  
  /**
   * Record successful connection
   */
  private onConnectionSuccess(): void {
    this.reconnectAttempts = 0;
    
    if (this.circuitBreaker.state === 'half-open') {
      // Successful connection in half-open state - close the circuit
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failures = 0;
      console.log('Circuit breaker closed after successful reconnection');
    } else if (this.circuitBreaker.state === 'closed') {
      // Reset failure count on successful connection
      this.circuitBreaker.failures = 0;
    }
  }
  
  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 10000); // Check every 10 seconds
  }
  
  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  
  /**
   * Perform health check by sending ping
   */
  private performHealthCheck(): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.connectionHealth.lastPingTime = Date.now();
      
      this.send({
        type: 'ping',
        timestamp: this.connectionHealth.lastPingTime
      });
      
      // Set timeout to detect if pong doesn't come back
      setTimeout(() => {
        if (this.connectionHealth.lastPongTime < this.connectionHealth.lastPingTime) {
          // Ping timed out
          this.connectionHealth.packetLoss += 0.1;
          this.updateConnectionQuality();
        }
      }, 5000); // 5 second timeout
    }
  }
  
  /**
   * Handle authentication response
   */
  private handleAuthenticated(data: any): void {
    if (data.success) {
      console.log('WebSocket authenticated successfully');
      if (data.reconnectToken) {
        this.reconnectToken = data.reconnectToken;
      }
    } else {
      console.error('WebSocket authentication failed:', data.error);
    }
  }
  
  /**
   * Handle heartbeat response
   */
  private handleHeartbeatResponse(): void {
    this.connectionHealth.lastPongTime = Date.now();
    
    // Calculate latency
    if (this.connectionHealth.lastPingTime > 0) {
      this.connectionHealth.latency = this.connectionHealth.lastPongTime - this.connectionHealth.lastPingTime;
    }
    
    // Reduce packet loss on successful response
    this.connectionHealth.packetLoss = Math.max(0, this.connectionHealth.packetLoss - 0.05);
    
    this.updateConnectionQuality();
  }
  
  /**
   * Handle server-initiated reconnection requirement
   */
  private handleReconnectRequired(data: any): void {
    console.log('Server requested reconnection:', data.reason);
    
    if (this.websocket) {
      this.websocket.close(1000, 'Server requested reconnection');
    }
    
    // Respect server's suggested delay
    const delay = data.delay || this.calculateReconnectionDelay();
    
    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Server-requested reconnection failed:', error);
      });
    }, delay);
  }
  
  /**
   * Update connection quality based on metrics
   */
  private updateConnectionQuality(): void {
    const { latency, packetLoss } = this.connectionHealth;
    
    if (latency < 50 && packetLoss < 0.01) {
      this.connectionHealth.quality = 'excellent';
    } else if (latency < 150 && packetLoss < 0.05) {
      this.connectionHealth.quality = 'good';
    } else if (latency < 500 && packetLoss < 0.1) {
      this.connectionHealth.quality = 'poor';
    } else {
      this.connectionHealth.quality = 'critical';
    }
    
    // Emit connection quality change event
    this.timelineComponent.dispatchEvent(
      new CustomEvent('websocket-quality-changed', {
        detail: {
          quality: this.connectionHealth.quality,
          metrics: { ...this.connectionHealth }
        },
        bubbles: true,
      })
    );
  }
  
  /**
   * Setup state manager event listeners
   */
  private setupStateManagerListeners(): void {
    this.stateManager.addEventListener('state-changed', (event: CustomEvent) => {
      console.log('Local state changed:', event.detail);
      this.syncStateWithTimeline(event.detail.state);
    });
    
    this.stateManager.addEventListener('state-sync-started', (event: CustomEvent) => {
      console.log('State synchronization started');
      this.emitStateEvent('sync-started', event.detail);
    });
    
    this.stateManager.addEventListener('state-sync-completed', (event: CustomEvent) => {
      console.log('State synchronization completed');
      this.emitStateEvent('sync-completed', event.detail);
    });
    
    this.stateManager.addEventListener('state-conflict-detected', (event: CustomEvent) => {
      console.log('State conflict detected:', event.detail);
      this.emitStateEvent('sync-conflict', event.detail);
    });
    
    this.stateManager.addEventListener('state-reconciled', (event: CustomEvent) => {
      console.log('State conflicts reconciled:', event.detail);
      this.emitStateEvent('sync-reconciled', event.detail);
    });
    
    this.stateManager.addEventListener('offline-changes-queued', (event: CustomEvent) => {
      console.log('Changes queued while offline:', event.detail);
      this.emitStateEvent('offline-queued', event.detail);
    });
    
    this.stateManager.addEventListener('sync-error', (event: CustomEvent) => {
      console.error('State sync error:', event.detail);
      this.emitStateEvent('sync-error', event.detail);
    });
    
    this.stateManager.addEventListener('user-conflict-prompt', (event: CustomEvent) => {
      console.log('User conflict resolution required:', event.detail);
      this.emitStateEvent('conflict-prompt', event.detail);
    });
  }
  
  /**
   * Sync state manager state with timeline component
   */
  private syncStateWithTimeline(state: any): void {
    // Convert Map to array for timeline component
    const sessions = Array.from(state.sessions.values());
    this.timelineComponent.sessions = sessions;
    
    // Update active session if needed
    if (state.activeSessionId) {
      this.stateManager.setActiveSession(state.activeSessionId);
    }
  }
  
  /**
   * Request state synchronization from server
   */
  private requestStateSync(): void {
    const currentState = this.stateManager.getState();
    
    this.send({
      type: 'request-state-sync',
      clientVersion: currentState.version,
      lastUpdate: currentState.lastUpdate,
      pendingOperations: this.stateManager.getPendingOperations().length
    });
  }
  
  /**
   * Handle state sync response from server
   */
  private handleStateSyncResponse(data: any): void {
    const { serverState, serverVersion, needsFullSync } = data;
    
    if (needsFullSync) {
      console.log('Performing full state synchronization');
      this.stateManager.synchronizeWithServer(serverState, serverVersion);
    } else {
      console.log('State already synchronized');
    }
  }
  
  /**
   * Handle incremental state update from server
   */
  private handleStateUpdate(data: any): void {
    const { operation, serverVersion } = data;
    
    console.log('Received state update from server:', operation);
    
    // Apply the server operation directly
    switch (operation.target) {
      case 'session':
        if (operation.type === 'delete') {
          this.stateManager.removeSession(operation.targetId);
        } else {
          this.stateManager.updateSession(operation.targetId, operation.payload);
        }
        break;
        
      case 'subscription':
        if (operation.type === 'delete') {
          this.stateManager.removeSubscription(operation.targetId);
        } else {
          this.stateManager.addSubscription(operation.targetId);
        }
        break;
        
      case 'preference':
        this.stateManager.updatePreference(operation.targetId, operation.payload);
        break;
    }
  }
  
  /**
   * Handle state conflict notification from server
   */
  private handleStateConflict(data: any): void {
    const { conflicts, serverState, serverVersion } = data;
    
    console.log('Server reported state conflicts:', conflicts);
    
    // Trigger conflict resolution
    this.stateManager.synchronizeWithServer(serverState, serverVersion);
  }
  
  /**
   * Emit state-related events to timeline component
   */
  private emitStateEvent(type: string, detail: any): void {
    this.timelineComponent.dispatchEvent(
      new CustomEvent(`state-${type}`, {
        detail,
        bubbles: true,
      })
    );
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
   * Get session status
   */
  public getSessionStatus(sessionId: string, callback?: (status: any) => void): void {
    this.send({
      type: 'get-session-status',
      sessionId,
      callback: callback ? 'callback' : undefined
    });
  }

  /**
   * Subscribe to session status updates
   */
  public subscribeToSessionStatus(sessionId: string, callback?: (subscriptionId: string) => void): void {
    this.send({
      type: 'subscribe-session-status',
      sessionId,
      callback: callback ? 'callback' : undefined
    });
  }

  /**
   * Unsubscribe from session status updates
   */
  public unsubscribeFromSessionStatus(subscriptionId: string): void {
    this.send({
      type: 'unsubscribe-session-status',
      subscriptionId,
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
  
  /**
   * Get connection health metrics
   */
  public getConnectionHealth(): ConnectionHealthMetrics {
    return { ...this.connectionHealth };
  }
  
  /**
   * Get circuit breaker status
   */
  public get circuitBreakerStatus(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }
  
  /**
   * Get reconnection info
   */
  public get reconnectionInfo(): {
    attempts: number;
    maxAttempts: number;
    nextDelay: number;
    canAttempt: boolean;
  } {
    return {
      attempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      nextDelay: this.calculateReconnectionDelay(),
      canAttempt: this.canAttemptConnection()
    };
  }
  
  /**
   * Get state synchronization manager
   */
  public getStateManager(): StateSynchronizationManager {
    return this.stateManager;
  }
  
  /**
   * Get current application state
   */
  public getCurrentState(): ReturnType<StateSynchronizationManager['getState']> {
    return this.stateManager.getState();
  }
  
  /**
   * Get state synchronization status
   */
  public getStateSyncStatus(): ReturnType<StateSynchronizationManager['getSyncStatus']> {
    return this.stateManager.getSyncStatus();
  }
  
  /**
   * Manually trigger state synchronization
   */
  public triggerStateSync(): void {
    this.requestStateSync();
  }
  
  /**
   * Resolve user conflict (called by UI)
   */
  public resolveConflict(conflictId: string, choice: 'server' | 'client'): void {
    this.stateManager.dispatchEvent(
      new CustomEvent('conflict-resolution', {
        detail: { conflictId, choice }
      })
    );
  }
  
  /**
   * Create state snapshot
   */
  public createStateSnapshot(): ReturnType<StateSynchronizationManager['createSnapshot']> {
    return this.stateManager.createSnapshot();
  }
  
  /**
   * Get state snapshots history
   */
  public getStateSnapshots(): ReturnType<StateSynchronizationManager['getSnapshots']> {
    return this.stateManager.getSnapshots();
  }
  
  /**
   * Reset state manager (for testing or complete refresh)
   */
  public resetState(): void {
    this.stateManager.reset();
  }
  
  /**
   * Complete cleanup including state manager
   */
  public dispose(): void {
    this.disconnect();
    this.stateManager.dispose();
  }
}