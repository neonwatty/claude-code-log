import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SessionSummary } from '../types/session-types';
import SessionBrowserWebSocket, { 
  SessionUpdate, 
  ConnectionStatus, 
  NotificationData,
  SessionBrowserWebSocketConfig 
} from '../../services/session-browser-websocket';
import { baseStyles } from '../styles/theme';

export interface RealtimeUpdateConfig {
  enableRealtime?: boolean;
  updateAnimations?: boolean;
  soundNotifications?: boolean;
  visualNotifications?: boolean;
  batchUpdates?: boolean;
  batchDelay?: number;
  maxRetainedUpdates?: number;
}

export interface SessionListUpdateEvent extends CustomEvent {
  detail: {
    type: 'sessions-updated' | 'session-added' | 'session-removed' | 'session-modified';
    sessions?: SessionSummary[];
    sessionId?: string;
    session?: SessionSummary;
    update?: SessionUpdate;
  };
}

/**
 * Real-time WebSocket integration for session list updates
 * Handles live session updates, notifications, and connection status
 */
@customElement('session-list-realtime-updates')
export class SessionListRealtimeUpdates extends LitElement {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .connection-status {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        margin-bottom: var(--space-md);
        font-size: var(--font-size-sm);
        transition: all var(--transition-fast);
      }

      .connection-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
        position: relative;
      }

      .connection-indicator::after {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        border-radius: 50%;
        animation: pulse 2s infinite;
        opacity: 0;
      }

      .connection-indicator.connected {
        background: var(--color-success);
      }

      .connection-indicator.connected::after {
        background: var(--color-success);
        animation: pulse 2s infinite;
      }

      .connection-indicator.connecting {
        background: var(--color-warning);
        animation: blink 1s infinite;
      }

      .connection-indicator.disconnected {
        background: var(--color-error);
      }

      .connection-indicator.reconnecting {
        background: var(--color-warning);
        animation: blink 0.5s infinite;
      }

      .connection-text {
        flex: 1;
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .connection-quality {
        font-size: var(--font-size-xs);
        opacity: 0.7;
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .latency {
        padding: 2px 6px;
        background: var(--color-background-tertiary);
        border-radius: var(--border-radius-sm);
        font-family: var(--font-family-mono);
      }

      .connection-actions {
        display: flex;
        gap: var(--space-xs);
      }

      .connection-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);
      }

      .connection-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
        color: var(--color-text-primary);
      }

      .recent-updates {
        margin-bottom: var(--space-md);
      }

      .update-item {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm);
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        margin-bottom: var(--space-xs);
        animation: slideIn 0.3s ease-out;
        transition: all var(--transition-fast);
      }

      .update-item:hover {
        border-color: var(--color-primary);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .update-item.new {
        animation: slideIn 0.3s ease-out, highlight 2s ease-out;
        border-color: var(--color-success);
      }

      .update-icon {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        color: white;
        flex-shrink: 0;
      }

      .update-icon.created {
        background: var(--color-success);
      }

      .update-icon.updated {
        background: var(--color-primary);
      }

      .update-icon.message {
        background: var(--color-info);
      }

      .update-icon.error {
        background: var(--color-error);
      }

      .update-content {
        flex: 1;
        min-width: 0;
      }

      .update-title {
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin-bottom: 2px;
      }

      .update-details {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .update-time {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      .notification-banner {
        padding: var(--space-md);
        background: var(--color-warning-light);
        border: 1px solid var(--color-warning);
        border-radius: var(--border-radius);
        margin-bottom: var(--space-md);
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        animation: slideDown 0.3s ease-out;
      }

      .notification-banner.error {
        background: var(--color-error-light);
        border-color: var(--color-error);
      }

      .notification-banner.success {
        background: var(--color-success-light);
        border-color: var(--color-success);
      }

      .notification-banner.info {
        background: var(--color-info-light);
        border-color: var(--color-info);
      }

      .notification-icon {
        font-size: var(--font-size-lg);
      }

      .notification-content {
        flex: 1;
      }

      .notification-title {
        font-weight: var(--font-weight-semibold);
        margin-bottom: 2px;
      }

      .notification-message {
        font-size: var(--font-size-sm);
        opacity: 0.9;
      }

      .notification-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: var(--space-xs);
        border-radius: var(--border-radius-sm);
        color: currentColor;
        opacity: 0.7;
      }

      .notification-close:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.1);
      }

      .stats-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: var(--space-sm);
        margin-top: var(--space-md);
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
      }

      .stat-item {
        text-align: center;
      }

      .stat-value {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
        display: block;
      }

      .stat-label {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        margin-top: 2px;
      }

      @keyframes pulse {
        0% { opacity: 0; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.5); }
        100% { opacity: 0; transform: scale(2); }
      }

      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes highlight {
        0% { background: var(--color-success-light); }
        100% { background: var(--color-background); }
      }

      .hidden {
        display: none;
      }

      /* Dark mode adjustments */
      @media (prefers-color-scheme: dark) {
        .update-item {
          border-color: var(--color-border-dark);
        }
        
        .notification-close:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
        }
      }
    `,
  ];

  @property({ type: Object })
  webSocketConfig: SessionBrowserWebSocketConfig = {};

  @property({ type: Object })
  realtimeConfig: RealtimeUpdateConfig = {
    enableRealtime: true,
    updateAnimations: true,
    soundNotifications: false,
    visualNotifications: true,
    batchUpdates: true,
    batchDelay: 500,
    maxRetainedUpdates: 20,
  };

  @property({ type: Array })
  sessions: SessionSummary[] = [];

  @property({ type: Boolean })
  showConnectionStatus = true;

  @property({ type: Boolean })
  showRecentUpdates = true;

  @property({ type: Boolean })
  showStatistics = false;

  @state()
  private webSocketService: SessionBrowserWebSocket | null = null;

  @state()
  private connectionStatus: ConnectionStatus = {
    connected: false,
    connecting: false,
    reconnecting: false,
    reconnectionAttempts: 0,
    quality: 'disconnected',
  };

  @state()
  private recentUpdates: Array<SessionUpdate & { id: string; isNew?: boolean }> = [];

  @state()
  private currentNotification: NotificationData | null = null;

  @state()
  private statistics = {
    totalSessions: 0,
    activeSessions: 0,
    totalUpdates: 0,
    messagesReceived: 0,
  };

  @state()
  private updateBatch: SessionUpdate[] = [];

  private batchTimeout: NodeJS.Timeout | null = null;

  connectedCallback() {
    super.connectedCallback();
    
    if (this.realtimeConfig.enableRealtime) {
      this.initializeWebSocket();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanupWebSocket();
  }

  render() {
    return html`
      ${this.showConnectionStatus ? this.renderConnectionStatus() : ''}
      ${this.currentNotification ? this.renderNotificationBanner() : ''}
      ${this.showRecentUpdates ? this.renderRecentUpdates() : ''}
      ${this.showStatistics ? this.renderStatistics() : ''}
    `;
  }

  private renderConnectionStatus() {
    const { connected, connecting, reconnecting, quality, latency, reconnectionAttempts } = this.connectionStatus;
    
    let statusText = 'Disconnected';
    let statusClass = 'disconnected';
    
    if (connecting) {
      statusText = 'Connecting...';
      statusClass = 'connecting';
    } else if (reconnecting) {
      statusText = `Reconnecting (${reconnectionAttempts})...`;
      statusClass = 'reconnecting';
    } else if (connected) {
      statusText = 'Connected';
      statusClass = 'connected';
    }

    return html`
      <div class="connection-status">
        <div class="connection-indicator ${statusClass}"></div>
        <div class="connection-text">
          <span>${statusText}</span>
          ${connected && quality !== 'disconnected' ? html`
            <div class="connection-quality">
              <span>Quality: ${quality}</span>
              ${latency ? html`
                <span class="latency">${latency}ms</span>
              ` : ''}
            </div>
          ` : ''}
        </div>
        <div class="connection-actions">
          ${!connected ? html`
            <button 
              class="connection-button"
              @click=${this.reconnect}
              ?disabled=${connecting}
            >
              ${connecting ? 'Connecting...' : 'Reconnect'}
            </button>
          ` : html`
            <button 
              class="connection-button"
              @click=${this.disconnect}
            >
              Disconnect
            </button>
          `}
          <button 
            class="connection-button"
            @click=${this.testConnection}
            ?disabled=${!connected}
          >
            Test
          </button>
        </div>
      </div>
    `;
  }

  private renderNotificationBanner() {
    if (!this.currentNotification) return '';

    const iconMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };

    return html`
      <div class="notification-banner ${this.currentNotification.type}">
        <div class="notification-icon">
          ${iconMap[this.currentNotification.type]}
        </div>
        <div class="notification-content">
          <div class="notification-title">${this.currentNotification.title}</div>
          <div class="notification-message">${this.currentNotification.message}</div>
        </div>
        <button 
          class="notification-close"
          @click=${this.dismissNotification}
          title="Dismiss notification"
        >
          ✕
        </button>
      </div>
    `;
  }

  private renderRecentUpdates() {
    if (this.recentUpdates.length === 0) {
      return html`
        <div class="recent-updates">
          <div style="text-align: center; padding: var(--space-lg); color: var(--color-text-muted);">
            No recent updates
          </div>
        </div>
      `;
    }

    return html`
      <div class="recent-updates">
        ${this.recentUpdates.slice(0, 10).map(update => this.renderUpdateItem(update))}
      </div>
    `;
  }

  private renderUpdateItem(update: SessionUpdate & { id: string; isNew?: boolean }) {
    const iconMap = {
      'session-created': '➕',
      'session-updated': '📝',
      'session-completed': '✅',
      'session-error': '❌',
      'message-added': '💬',
      'message-updated': '📄',
    };

    const typeMap = {
      'session-created': 'created',
      'session-updated': 'updated', 
      'session-completed': 'updated',
      'session-error': 'error',
      'message-added': 'message',
      'message-updated': 'message',
    };

    const titleMap = {
      'session-created': 'Session Created',
      'session-updated': 'Session Updated',
      'session-completed': 'Session Completed',
      'session-error': 'Session Error',
      'message-added': 'New Message',
      'message-updated': 'Message Updated',
    };

    return html`
      <div class="update-item ${update.isNew ? 'new' : ''}" data-update-id="${update.id}">
        <div class="update-icon ${typeMap[update.type]}">
          ${iconMap[update.type]}
        </div>
        <div class="update-content">
          <div class="update-title">${titleMap[update.type]}</div>
          <div class="update-details">
            Session ${update.sessionId.substring(0, 8)}${update.data?.content ? ` - ${update.data.content.substring(0, 40)}...` : ''}
          </div>
        </div>
        <div class="update-time">
          ${this.formatTimeAgo(update.timestamp)}
        </div>
      </div>
    `;
  }

  private renderStatistics() {
    return html`
      <div class="stats-summary">
        <div class="stat-item">
          <span class="stat-value">${this.statistics.totalSessions}</span>
          <span class="stat-label">Total Sessions</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${this.statistics.activeSessions}</span>
          <span class="stat-label">Active Sessions</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${this.statistics.totalUpdates}</span>
          <span class="stat-label">Updates Received</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${this.statistics.messagesReceived}</span>
          <span class="stat-label">Messages</span>
        </div>
      </div>
    `;
  }

  /**
   * Initialize WebSocket connection
   */
  private async initializeWebSocket() {
    if (this.webSocketService) {
      return;
    }

    this.webSocketService = new SessionBrowserWebSocket({
      enableNotifications: this.realtimeConfig.visualNotifications,
      debug: true,
      ...this.webSocketConfig,
    });

    // Setup event listeners
    this.webSocketService.on('connection-status-changed', (status) => {
      this.connectionStatus = status;
      this.requestUpdate();
    });

    this.webSocketService.on('session-update', (update) => {
      this.handleSessionUpdate(update);
    });

    this.webSocketService.on('bulk-updates', (updates) => {
      this.handleBulkUpdates(updates);
    });

    this.webSocketService.on('notification', (notification) => {
      this.handleNotification(notification);
    });

    // Connect
    try {
      await this.webSocketService.connect();
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.showNotification({
        id: 'connection-error',
        type: 'error',
        title: 'Connection Failed',
        message: 'Failed to connect to real-time updates',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Clean up WebSocket connection
   */
  private cleanupWebSocket() {
    if (this.webSocketService) {
      this.webSocketService.destroy();
      this.webSocketService = null;
    }

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  /**
   * Handle individual session update
   */
  private handleSessionUpdate(update: SessionUpdate) {
    if (this.realtimeConfig.batchUpdates) {
      this.addToBatch(update);
    } else {
      this.processUpdate(update);
    }
  }

  /**
   * Handle bulk session updates
   */
  private handleBulkUpdates(updates: SessionUpdate[]) {
    updates.forEach(update => this.processUpdate(update));
  }

  /**
   * Add update to batch processing queue
   */
  private addToBatch(update: SessionUpdate) {
    this.updateBatch.push(update);

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatchedUpdates();
      this.batchTimeout = null;
    }, this.realtimeConfig.batchDelay || 500);
  }

  /**
   * Process batched updates
   */
  private processBatchedUpdates() {
    if (this.updateBatch.length === 0) return;

    const batch = [...this.updateBatch];
    this.updateBatch = [];

    // Group updates by session and type for efficiency
    const groupedUpdates = new Map<string, SessionUpdate[]>();
    batch.forEach(update => {
      const key = `${update.sessionId}-${update.type}`;
      if (!groupedUpdates.has(key)) {
        groupedUpdates.set(key, []);
      }
      groupedUpdates.get(key)!.push(update);
    });

    // Process each group
    groupedUpdates.forEach(updates => {
      // Use the most recent update from each group
      const latestUpdate = updates.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      this.processUpdate(latestUpdate);
    });

    // Emit bulk update event
    this.dispatchEvent(new CustomEvent('bulk-updates-processed', {
      detail: { updates: batch, processedCount: groupedUpdates.size },
      bubbles: true,
    }));
  }

  /**
   * Process a single update
   */
  private processUpdate(update: SessionUpdate) {
    // Add to recent updates
    const updateWithId = {
      ...update,
      id: `${update.sessionId}-${update.type}-${update.timestamp.getTime()}`,
      isNew: true,
    };

    this.recentUpdates = [
      updateWithId,
      ...this.recentUpdates.slice(0, (this.realtimeConfig.maxRetainedUpdates || 20) - 1),
    ];

    // Remove 'new' flag after animation
    setTimeout(() => {
      this.recentUpdates = this.recentUpdates.map(u => 
        u.id === updateWithId.id ? { ...u, isNew: false } : u
      );
      this.requestUpdate();
    }, 2000);

    // Update statistics
    this.statistics.totalUpdates++;
    if (update.type === 'message-added' || update.type === 'message-updated') {
      this.statistics.messagesReceived++;
    }

    // Emit update event for parent components
    this.emitUpdateEvent(update);

    // Play sound if enabled
    if (this.realtimeConfig.soundNotifications) {
      this.playUpdateSound(update.type);
    }

    this.requestUpdate();
  }

  /**
   * Handle notification
   */
  private handleNotification(notification: NotificationData) {
    this.showNotification(notification);
  }

  /**
   * Show notification banner
   */
  private showNotification(notification: NotificationData) {
    this.currentNotification = notification;
    
    // Auto-dismiss non-persistent notifications
    if (!notification.persistent) {
      setTimeout(() => {
        if (this.currentNotification?.id === notification.id) {
          this.dismissNotification();
        }
      }, 5000);
    }

    this.requestUpdate();
  }

  /**
   * Dismiss current notification
   */
  private dismissNotification() {
    this.currentNotification = null;
    this.requestUpdate();
  }

  /**
   * Emit update event for parent components
   */
  private emitUpdateEvent(update: SessionUpdate) {
    let eventType: 'sessions-updated' | 'session-added' | 'session-removed' | 'session-modified' = 'sessions-updated';
    
    switch (update.type) {
      case 'session-created':
        eventType = 'session-added';
        break;
      case 'session-updated':
      case 'session-completed':
      case 'session-error':
        eventType = 'session-modified';
        break;
      case 'message-added':
      case 'message-updated':
        eventType = 'sessions-updated';
        break;
    }

    const event = new CustomEvent(eventType, {
      detail: {
        type: eventType,
        sessionId: update.sessionId,
        session: update.data,
        update,
      },
      bubbles: true,
    }) as SessionListUpdateEvent;

    this.dispatchEvent(event);
  }

  /**
   * Play sound notification
   */
  private playUpdateSound(updateType: SessionUpdate['type']) {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      // Different tones for different update types
      const frequencies = {
        'session-created': 880,
        'session-updated': 660,
        'session-completed': 1320,
        'session-error': 330,
        'message-added': 1100,
        'message-updated': 770,
      };

      oscillator.frequency.value = frequencies[updateType] || 660;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.05, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.3);
    } catch (error) {
      console.error('Failed to play update sound:', error);
    }
  }

  /**
   * Format time ago display
   */
  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }

  // Public API methods

  /**
   * Manually reconnect WebSocket
   */
  async reconnect() {
    if (this.webSocketService) {
      try {
        await this.webSocketService.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    } else {
      await this.initializeWebSocket();
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.webSocketService) {
      this.webSocketService.disconnect();
    }
  }

  /**
   * Test WebSocket connection
   */
  async testConnection() {
    if (this.webSocketService) {
      const isHealthy = await this.webSocketService.testConnection();
      this.showNotification({
        id: 'connection-test',
        type: isHealthy ? 'success' : 'error',
        title: 'Connection Test',
        message: isHealthy ? 'Connection is healthy' : 'Connection test failed',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Subscribe to session updates
   */
  subscribeToSession(sessionId: string) {
    if (this.webSocketService) {
      this.webSocketService.subscribeToSession(sessionId);
    }
  }

  /**
   * Unsubscribe from session updates
   */
  unsubscribeFromSession(sessionId: string) {
    if (this.webSocketService) {
      this.webSocketService.unsubscribeFromSession(sessionId);
    }
  }

  /**
   * Update realtime configuration
   */
  updateRealtimeConfig(config: Partial<RealtimeUpdateConfig>) {
    this.realtimeConfig = { ...this.realtimeConfig, ...config };
    
    if (!this.realtimeConfig.enableRealtime && this.webSocketService) {
      this.cleanupWebSocket();
    } else if (this.realtimeConfig.enableRealtime && !this.webSocketService) {
      this.initializeWebSocket();
    }
  }

  /**
   * Get current statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Clear recent updates
   */
  clearRecentUpdates() {
    this.recentUpdates = [];
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-list-realtime-updates': SessionListRealtimeUpdates;
  }
}