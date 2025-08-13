import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ConnectionStatus } from '../../services/session-browser-websocket';
import { baseStyles } from '../styles/theme';

export interface ConnectionStatusIndicatorConfig {
  showLabel?: boolean;
  showLatency?: boolean;
  showQuality?: boolean;
  showReconnectButton?: boolean;
  showDetails?: boolean;
  enableAutoReconnect?: boolean;
  compactMode?: boolean;
  enableAnimations?: boolean;
  enableNotifications?: boolean;
}

export interface ConnectionActions {
  onReconnect?: () => void;
  onDisconnect?: () => void;
  onTestConnection?: () => void;
  onViewDetails?: () => void;
}

/**
 * Connection status indicator component
 * Shows WebSocket connection status with reconnection controls and quality metrics
 */
@customElement('connection-status-indicator')
export class ConnectionStatusIndicator extends LitElement {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        font-family: var(--font-family);
      }

      .connection-container {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-xs) var(--space-sm);
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        transition: all var(--transition-fast);
        cursor: pointer;
        position: relative;
      }

      .connection-container:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
      }

      .connection-container.compact {
        padding: var(--space-xs);
      }

      .connection-container.connected {
        border-color: var(--color-success);
        background: var(--color-success-light);
      }

      .connection-container.connecting {
        border-color: var(--color-warning);
        background: var(--color-warning-light);
      }

      .connection-container.disconnected {
        border-color: var(--color-error);
        background: var(--color-error-light);
      }

      .connection-container.reconnecting {
        border-color: var(--color-info);
        background: var(--color-info-light);
      }

      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
        position: relative;
        transition: all var(--transition-medium);
      }

      .status-indicator::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        border-radius: 50%;
        opacity: 0;
        transition: all var(--transition-medium);
      }

      .status-indicator.connected {
        background: var(--color-success);
      }

      .status-indicator.connected::before {
        background: var(--color-success);
        animation: connection-pulse 2s infinite;
      }

      .status-indicator.connecting {
        background: var(--color-warning);
        animation: connecting-blink 1s infinite;
      }

      .status-indicator.disconnected {
        background: var(--color-error);
      }

      .status-indicator.reconnecting {
        background: var(--color-info);
        animation: reconnecting-spin 1s linear infinite;
      }

      .status-info {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        min-width: 0;
      }

      .status-label {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        line-height: 1.2;
      }

      .status-details {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        line-height: 1.2;
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .latency-badge {
        display: inline-flex;
        align-items: center;
        padding: 1px var(--space-xs);
        background: var(--color-background-tertiary);
        border-radius: var(--border-radius-sm);
        font-family: var(--font-family-mono);
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
      }

      .latency-badge.excellent {
        background: var(--color-success);
        color: white;
      }

      .latency-badge.good {
        background: var(--color-info);
        color: white;
      }

      .latency-badge.fair {
        background: var(--color-warning);
        color: white;
      }

      .latency-badge.poor {
        background: var(--color-error);
        color: white;
      }

      .quality-indicator {
        display: flex;
        align-items: center;
        gap: 1px;
      }

      .quality-bar {
        width: 3px;
        height: 8px;
        background: var(--color-background-tertiary);
        border-radius: 1px;
        transition: background-color var(--transition-fast);
      }

      .quality-bar.active {
        background: var(--color-success);
      }

      .quality-bar.active.excellent {
        background: var(--color-success);
      }

      .quality-bar.active.good {
        background: var(--color-info);
      }

      .quality-bar.active.fair {
        background: var(--color-warning);
      }

      .quality-bar.active.poor {
        background: var(--color-error);
      }

      .connection-actions {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .action-button {
        background: none;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        padding: var(--space-xs);
        cursor: pointer;
        color: var(--color-text-secondary);
        font-size: var(--font-size-xs);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
      }

      .action-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
        color: var(--color-text-primary);
      }

      .action-button.primary {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .action-button.primary:hover {
        background: var(--color-primary-dark);
      }

      .action-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .reconnect-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--color-background-tertiary);
        border-radius: 0 0 var(--border-radius) var(--border-radius);
        overflow: hidden;
      }

      .progress-bar {
        height: 100%;
        background: var(--color-primary);
        transition: width linear;
        border-radius: 0 0 var(--border-radius) var(--border-radius);
      }

      .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: var(--space-xs);
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-lg);
        padding: var(--space-sm);
        opacity: 0;
        transform: translateY(-10px);
        pointer-events: none;
        transition: all var(--transition-fast);
        z-index: 1000;
        min-width: 250px;
      }

      .dropdown.open {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .dropdown-section {
        margin-bottom: var(--space-sm);
      }

      .dropdown-section:last-child {
        margin-bottom: 0;
      }

      .dropdown-title {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin-bottom: var(--space-xs);
      }

      .metric-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-xs) 0;
        font-size: var(--font-size-xs);
      }

      .metric-label {
        color: var(--color-text-secondary);
      }

      .metric-value {
        color: var(--color-text-primary);
        font-family: var(--font-family-mono);
      }

      .compact .status-info {
        display: none;
      }

      .compact .connection-actions {
        display: none;
      }

      .notification-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--color-error);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        color: white;
        font-weight: bold;
        animation: badge-pulse 2s infinite;
      }

      @keyframes connection-pulse {
        0%, 100% {
          opacity: 0;
        }
        50% {
          opacity: 0.5;
        }
      }

      @keyframes connecting-blink {
        0%, 50% {
          opacity: 1;
        }
        51%, 100% {
          opacity: 0.3;
        }
      }

      @keyframes reconnecting-spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      @keyframes badge-pulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.2);
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation: none !important;
        }
        
        .connection-container,
        .dropdown {
          transition: none;
        }
      }

      /* Mobile adjustments */
      @media (max-width: 768px) {
        .dropdown {
          position: fixed;
          top: 50%;
          left: 50%;
          right: auto;
          transform: translate(-50%, -50%);
          margin-top: 0;
          max-width: 90vw;
        }

        .dropdown.open {
          transform: translate(-50%, -50%);
        }
      }
    `,
  ];

  @property({ type: Object })
  connectionStatus: ConnectionStatus = {
    connected: false,
    connecting: false,
    reconnecting: false,
    reconnectionAttempts: 0,
    quality: 'disconnected',
  };

  @property({ type: Object })
  config: ConnectionStatusIndicatorConfig = {
    showLabel: true,
    showLatency: true,
    showQuality: true,
    showReconnectButton: true,
    showDetails: false,
    enableAutoReconnect: true,
    compactMode: false,
    enableAnimations: true,
    enableNotifications: true,
  };

  @property({ type: Object })
  actions: ConnectionActions = {};

  @state()
  private showDropdown = false;

  @state()
  private reconnectProgress = 0;

  @state()
  private showReconnectNotification = false;

  private reconnectInterval: NodeJS.Timeout | null = null;
  private clickOutsideHandler: ((e: Event) => void) | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.setupClickOutsideHandler();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanupReconnectInterval();
    this.removeClickOutsideHandler();
  }

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);

    if (changedProperties.has('connectionStatus')) {
      const oldStatus = changedProperties.get('connectionStatus');
      if (oldStatus) {
        this.handleStatusChange(oldStatus, this.connectionStatus);
      }
    }
  }

  render() {
    const containerClasses = classMap({
      'connection-container': true,
      'compact': this.config.compactMode || false,
      'connected': this.connectionStatus.connected,
      'connecting': this.connectionStatus.connecting,
      'disconnected': !this.connectionStatus.connected && !this.connectionStatus.connecting,
      'reconnecting': this.connectionStatus.reconnecting,
    });

    const indicatorClasses = classMap({
      'status-indicator': true,
      'connected': this.connectionStatus.connected,
      'connecting': this.connectionStatus.connecting,
      'disconnected': !this.connectionStatus.connected && !this.connectionStatus.connecting,
      'reconnecting': this.connectionStatus.reconnecting,
    });

    return html`
      <div class="${containerClasses}" @click=${this.toggleDropdown}>
        <div class="${indicatorClasses}"></div>

        ${!this.config.compactMode ? html`
          <div class="status-info">
            <div class="status-label">
              ${this.getStatusLabel()}
            </div>
            ${this.renderStatusDetails()}
          </div>
        ` : ''}

        ${this.config.showReconnectButton && !this.config.compactMode ? html`
          <div class="connection-actions">
            ${this.renderActionButtons()}
          </div>
        ` : ''}

        ${this.connectionStatus.reconnecting ? this.renderReconnectProgress() : ''}

        ${this.showReconnectNotification ? html`
          <div class="notification-badge">${this.connectionStatus.reconnectionAttempts}</div>
        ` : ''}

        ${this.config.showDetails ? this.renderDropdown() : ''}
      </div>
    `;
  }

  private renderStatusDetails() {
    if (this.config.compactMode) return '';

    const details: string[] = [];

    if (this.connectionStatus.reconnecting) {
      details.push(`Attempt ${this.connectionStatus.reconnectionAttempts}`);
    } else if (this.config.showLatency && this.connectionStatus.latency) {
      details.push(`${this.connectionStatus.latency}ms`);
    }

    if (this.config.showQuality && this.connectionStatus.quality !== 'disconnected') {
      details.push(this.connectionStatus.quality);
    }

    if (details.length === 0) return '';

    return html`
      <div class="status-details">
        ${details.join(' • ')}
        ${this.config.showLatency && this.connectionStatus.latency ? this.renderLatencyBadge() : ''}
        ${this.config.showQuality ? this.renderQualityIndicator() : ''}
      </div>
    `;
  }

  private renderLatencyBadge() {
    if (!this.connectionStatus.latency) return '';

    const latency = this.connectionStatus.latency;
    let qualityClass = 'poor';
    
    if (latency < 50) qualityClass = 'excellent';
    else if (latency < 150) qualityClass = 'good';
    else if (latency < 300) qualityClass = 'fair';

    return html`
      <span class="latency-badge ${qualityClass}">
        ${latency}ms
      </span>
    `;
  }

  private renderQualityIndicator() {
    if (this.connectionStatus.quality === 'disconnected') return '';

    const qualityLevels = {
      excellent: 4,
      good: 3,
      fair: 2,
      poor: 1,
    };

    const activeLevel = qualityLevels[this.connectionStatus.quality as keyof typeof qualityLevels] || 0;

    return html`
      <div class="quality-indicator">
        ${Array.from({ length: 4 }, (_, i) => html`
          <div class="quality-bar ${i < activeLevel ? 'active' : ''} ${this.connectionStatus.quality}"></div>
        `)}
      </div>
    `;
  }

  private renderActionButtons() {
    return html`
      ${!this.connectionStatus.connected ? html`
        <button 
          class="action-button primary"
          @click=${this.handleReconnect}
          ?disabled=${this.connectionStatus.connecting}
          title="Reconnect"
        >
          🔄
        </button>
      ` : html`
        <button 
          class="action-button"
          @click=${this.handleDisconnect}
          title="Disconnect"
        >
          ✕
        </button>
      `}
      
      <button 
        class="action-button"
        @click=${this.handleTestConnection}
        ?disabled=${!this.connectionStatus.connected}
        title="Test connection"
      >
        🔍
      </button>
    `;
  }

  private renderReconnectProgress() {
    return html`
      <div class="reconnect-progress">
        <div class="progress-bar" style="width: ${this.reconnectProgress}%"></div>
      </div>
    `;
  }

  private renderDropdown() {
    const dropdownClasses = classMap({
      'dropdown': true,
      'open': this.showDropdown,
    });

    return html`
      <div class="${dropdownClasses}">
        <div class="dropdown-section">
          <div class="dropdown-title">Connection Details</div>
          <div class="metric-row">
            <span class="metric-label">Status:</span>
            <span class="metric-value">${this.getStatusLabel()}</span>
          </div>
          ${this.connectionStatus.latency ? html`
            <div class="metric-row">
              <span class="metric-label">Latency:</span>
              <span class="metric-value">${this.connectionStatus.latency}ms</span>
            </div>
          ` : ''}
          <div class="metric-row">
            <span class="metric-label">Quality:</span>
            <span class="metric-value">${this.connectionStatus.quality}</span>
          </div>
          ${this.connectionStatus.lastConnected ? html`
            <div class="metric-row">
              <span class="metric-label">Last Connected:</span>
              <span class="metric-value">${this.formatTimestamp(this.connectionStatus.lastConnected)}</span>
            </div>
          ` : ''}
        </div>

        ${this.connectionStatus.reconnectionAttempts > 0 ? html`
          <div class="dropdown-section">
            <div class="dropdown-title">Reconnection</div>
            <div class="metric-row">
              <span class="metric-label">Attempts:</span>
              <span class="metric-value">${this.connectionStatus.reconnectionAttempts}</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private getStatusLabel(): string {
    if (this.connectionStatus.reconnecting) {
      return 'Reconnecting...';
    } else if (this.connectionStatus.connecting) {
      return 'Connecting...';
    } else if (this.connectionStatus.connected) {
      return 'Connected';
    } else {
      return 'Disconnected';
    }
  }

  private formatTimestamp(date: Date): string {
    return date.toLocaleTimeString();
  }

  private handleStatusChange(oldStatus: ConnectionStatus, newStatus: ConnectionStatus) {
    // Show reconnection notification
    if (newStatus.reconnecting && !oldStatus.reconnecting) {
      this.showReconnectNotification = true;
      this.startReconnectProgress();
    } else if (!newStatus.reconnecting && oldStatus.reconnecting) {
      this.showReconnectNotification = false;
      this.stopReconnectProgress();
    }

    // Emit status change event
    this.dispatchEvent(new CustomEvent('connection-status-changed', {
      detail: { 
        previous: oldStatus, 
        current: newStatus 
      },
      bubbles: true,
    }));

    // Show notification for major changes
    if (this.config.enableNotifications) {
      this.maybeShowNotification(oldStatus, newStatus);
    }
  }

  private maybeShowNotification(oldStatus: ConnectionStatus, newStatus: ConnectionStatus) {
    // Connected after being disconnected
    if (newStatus.connected && !oldStatus.connected) {
      this.emitNotification('success', 'Connection Restored', 'WebSocket connection is now active');
    }
    
    // Disconnected after being connected
    else if (!newStatus.connected && oldStatus.connected) {
      this.emitNotification('warning', 'Connection Lost', 'WebSocket connection was interrupted');
    }
    
    // Failed to reconnect multiple times
    else if (newStatus.reconnectionAttempts >= 3 && newStatus.reconnectionAttempts > oldStatus.reconnectionAttempts) {
      this.emitNotification('error', 'Connection Issues', `Failed to reconnect after ${newStatus.reconnectionAttempts} attempts`);
    }
  }

  private emitNotification(type: string, title: string, message: string) {
    this.dispatchEvent(new CustomEvent('connection-notification', {
      detail: {
        type,
        title,
        message,
        timestamp: new Date(),
      },
      bubbles: true,
    }));
  }

  private startReconnectProgress() {
    this.reconnectProgress = 0;
    
    this.reconnectInterval = setInterval(() => {
      this.reconnectProgress += 2;
      if (this.reconnectProgress >= 100) {
        this.reconnectProgress = 0;
      }
    }, 100);
  }

  private stopReconnectProgress() {
    this.cleanupReconnectInterval();
    this.reconnectProgress = 0;
  }

  private cleanupReconnectInterval() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  private toggleDropdown(e: Event) {
    if (!this.config.showDetails) return;
    
    e.stopPropagation();
    this.showDropdown = !this.showDropdown;
  }

  private setupClickOutsideHandler() {
    this.clickOutsideHandler = (e: Event) => {
      if (!this.contains(e.target as Node)) {
        this.showDropdown = false;
      }
    };
    document.addEventListener('click', this.clickOutsideHandler);
  }

  private removeClickOutsideHandler() {
    if (this.clickOutsideHandler) {
      document.removeEventListener('click', this.clickOutsideHandler);
      this.clickOutsideHandler = null;
    }
  }

  private handleReconnect(e: Event) {
    e.stopPropagation();
    if (this.actions.onReconnect) {
      this.actions.onReconnect();
    }
  }

  private handleDisconnect(e: Event) {
    e.stopPropagation();
    if (this.actions.onDisconnect) {
      this.actions.onDisconnect();
    }
  }

  private handleTestConnection(e: Event) {
    e.stopPropagation();
    if (this.actions.onTestConnection) {
      this.actions.onTestConnection();
    }
  }

  // Public API

  /**
   * Update connection status
   */
  updateStatus(status: Partial<ConnectionStatus>) {
    const oldStatus = { ...this.connectionStatus };
    this.connectionStatus = { ...this.connectionStatus, ...status };
    this.handleStatusChange(oldStatus, this.connectionStatus);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConnectionStatusIndicatorConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update actions
   */
  updateActions(actions: Partial<ConnectionActions>) {
    this.actions = { ...this.actions, ...actions };
  }

  /**
   * Force show dropdown
   */
  showDetails() {
    this.showDropdown = true;
  }

  /**
   * Force hide dropdown
   */
  hideDetails() {
    this.showDropdown = false;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): 'connected' | 'connecting' | 'reconnecting' | 'disconnected' {
    if (this.connectionStatus.connected) return 'connected';
    if (this.connectionStatus.reconnecting) return 'reconnecting';
    if (this.connectionStatus.connecting) return 'connecting';
    return 'disconnected';
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(): boolean {
    return this.connectionStatus.connected && 
           this.connectionStatus.quality !== 'poor' &&
           !this.connectionStatus.reconnecting;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'connection-status-indicator': ConnectionStatusIndicator;
  }
}