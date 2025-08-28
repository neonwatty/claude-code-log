import { html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import { ConnectionState } from "../../utils/websocket/connection-state.js";
import type { ConnectionStatistics } from "../../utils/websocket/connection-state.js";

@customElement("connection-indicator")
export class ConnectionIndicator extends BaseComponent {
  @property({ type: String })
  connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  @property({ type: Object })
  statistics: ConnectionStatistics = {
    uptime: 0,
    reconnectionCount: 0,
    lastConnectTime: null,
    lastDisconnectTime: null,
    averageLatency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    totalDataSent: 0,
    totalDataReceived: 0,
    connectionQuality: "unknown",
  };

  @state()
  private showDetails = false;

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        position: relative;
      }

      .connection-indicator {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        border-radius: var(--border-radius-lg);
        background: var(--status-bg, var(--color-surface));
        border: 1px solid var(--status-border, var(--color-border-medium));
        cursor: pointer;
        transition: all var(--transition-fast);
        font-size: var(--font-size-sm);
        min-width: 120px;
      }

      .connection-indicator:hover {
        background: var(--color-surface-hover);
        transform: var(--transform-hover);
      }

      .connection-indicator.connected {
        --status-bg: var(--color-message-tool-result-bg);
        --status-border: var(--color-message-tool-result);
        color: var(--color-message-tool-result);
      }

      .connection-indicator.connecting {
        --status-bg: var(--color-message-system-warning-bg);
        --status-border: var(--color-message-system-warning);
        color: var(--color-message-system-warning);
      }

      .connection-indicator.disconnected {
        --status-bg: var(--color-message-system-error-bg);
        --status-border: var(--color-message-system-error);
        color: var(--color-message-system-error);
      }

      .status-icon {
        font-size: 1em;
        animation: var(--icon-animation, none);
      }

      .connection-indicator.connecting .status-icon {
        --icon-animation: spin 1s linear infinite;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .status-text {
        font-weight: var(--font-weight-medium);
        flex: 1;
      }

      .uptime {
        font-family: var(--font-family-mono);
        font-size: var(--font-size-xs);
        opacity: 0.8;
      }

      /* Details dropdown */
      .connection-details {
        position: absolute;
        top: calc(100% + var(--spacing-xs));
        right: 0;
        background: var(--color-surface);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-md);
        box-shadow: var(--shadow-lg);
        z-index: var(--z-overlay);
        min-width: 280px;
        opacity: 0;
        transform: translateY(-10px);
        transition: all var(--transition-fast);
        pointer-events: none;
      }

      .connection-details.visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .details-grid {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--spacing-xs) var(--spacing-md);
        font-size: var(--font-size-sm);
      }

      .detail-label {
        color: var(--color-text-muted);
        font-weight: var(--font-weight-medium);
      }

      .detail-value {
        color: var(--color-text);
        font-family: var(--font-family-mono);
      }

      .quality-indicator {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-xs);
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--border-radius-sm);
        background: var(--quality-bg);
        color: var(--quality-color);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
      }

      .quality-indicator.excellent {
        --quality-bg: var(--color-message-tool-result-bg);
        --quality-color: var(--color-message-tool-result);
      }

      .quality-indicator.good {
        --quality-bg: var(--color-message-system-info-bg);
        --quality-color: var(--color-message-system-info);
      }

      .quality-indicator.poor {
        --quality-bg: var(--color-message-system-warning-bg);
        --quality-color: var(--color-message-system-warning);
      }

      .quality-indicator.unknown {
        --quality-bg: var(--color-surface-disabled);
        --quality-color: var(--color-text-muted);
      }

      /* Focus management */
      .connection-indicator:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      /* Action buttons */
      .action-buttons {
        display: flex;
        gap: var(--spacing-xs);
        margin-top: var(--spacing-md);
        padding-top: var(--spacing-md);
        border-top: 1px solid var(--color-border-light);
      }

      .action-btn {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-sm);
        background: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        transition: all var(--transition-fast);
        flex: 1;
        text-align: center;
      }

      .action-btn:hover {
        background: var(--color-surface-hover);
        transform: translateY(-1px);
      }

      .action-btn:disabled {
        opacity: var(--opacity-disabled);
        cursor: not-allowed;
        transform: none;
      }

      .action-btn.primary {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .action-btn.primary:hover:not(:disabled) {
        background: var(--color-primary-hover);
        border-color: var(--color-primary-hover);
      }

      .action-btn.secondary {
        background: var(--color-secondary);
        color: white;
        border-color: var(--color-secondary);
      }

      .action-btn.secondary:hover:not(:disabled) {
        background: var(--color-secondary-hover);
        border-color: var(--color-secondary-hover);
      }

      /* Mobile optimizations */
      @media (max-width: 768px) {
        .connection-details {
          right: var(--spacing-md);
          left: var(--spacing-md);
          min-width: unset;
        }

        .uptime {
          display: none;
        }

        .action-buttons {
          flex-direction: column;
        }
      }
    `,
  ];

  private getStatusIcon(): string {
    switch (this.connectionState) {
      case ConnectionState.CONNECTED:
        return '🟢';
      case ConnectionState.CONNECTING:
        return '🟡';
      case ConnectionState.DISCONNECTED:
        return '🔴';
      default:
        return '⚪';
    }
  }

  private getStatusText(): string {
    switch (this.connectionState) {
      case ConnectionState.CONNECTED:
        return 'Connected';
      case ConnectionState.CONNECTING:
        return 'Connecting';
      case ConnectionState.DISCONNECTED:
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  }

  private formatUptime(): string {
    if (!this.statistics.uptime) return '';
    
    if (this.statistics.uptime < 60) {
      return `${Math.round(this.statistics.uptime)}s`;
    } else if (this.statistics.uptime < 3600) {
      return `${Math.round(this.statistics.uptime / 60)}m`;
    } else {
      const hours = Math.floor(this.statistics.uptime / 3600);
      const minutes = Math.round((this.statistics.uptime % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  private getQualityClass(): string {
    return this.statistics.connectionQuality || 'unknown';
  }

  private getQualityText(): string {
    switch (this.statistics.connectionQuality) {
      case 'excellent':
        return '🟢 Excellent';
      case 'good':
        return '🟡 Good';
      case 'poor':
        return '🟠 Poor';
      default:
        return '⚪ Unknown';
    }
  }

  private toggleDetails() {
    this.showDetails = !this.showDetails;
  }

  private handleConnectClick(event: Event) {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('connection-action', {
      detail: { action: 'connect' },
      bubbles: true
    }));
  }

  private handleDisconnectClick(event: Event) {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('connection-action', {
      detail: { action: 'disconnect' },
      bubbles: true
    }));
  }

  private handleReconnectClick(event: Event) {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('connection-action', {
      detail: { action: 'reconnect' },
      bubbles: true
    }));
  }

  private handleClickOutside = (event: Event) => {
    if (!this.shadowRoot?.contains(event.target as Node)) {
      this.showDetails = false;
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this.handleClickOutside);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleClickOutside);
  }

  override render() {
    const uptime = this.formatUptime();

    return html`
      <div 
        class="connection-indicator ${this.connectionState.toLowerCase()}"
        @click=${this.toggleDetails}
        tabindex="0"
        role="button"
        aria-expanded="${this.showDetails}"
        aria-label="Connection status: ${this.getStatusText()}${uptime ? `, uptime: ${uptime}` : ''}"
      >
        <span class="status-icon" aria-hidden="true">${this.getStatusIcon()}</span>
        <span class="status-text">${this.getStatusText()}</span>
        ${uptime ? html`<span class="uptime">${uptime}</span>` : ''}
      </div>

      <div class="connection-details ${this.showDetails ? 'visible' : ''}">
        <div class="details-grid">
          <span class="detail-label">Status:</span>
          <span class="detail-value">${this.getStatusText()}</span>
          
          <span class="detail-label">Quality:</span>
          <span class="detail-value">
            <span class="quality-indicator ${this.getQualityClass()}">
              ${this.getQualityText()}
            </span>
          </span>
          
          <span class="detail-label">Uptime:</span>
          <span class="detail-value">${uptime || 'N/A'}</span>
          
          <span class="detail-label">Messages:</span>
          <span class="detail-value">${this.statistics.messagesSent}↗ ${this.statistics.messagesReceived}↙</span>
          
          <span class="detail-label">Reconnects:</span>
          <span class="detail-value">${this.statistics.reconnectionCount}</span>
          
          ${this.statistics.averageLatency > 0 ? html`
            <span class="detail-label">Latency:</span>
            <span class="detail-value">${Math.round(this.statistics.averageLatency)}ms</span>
          ` : ''}
        </div>

        <div class="action-buttons">
          ${this.connectionState === ConnectionState.CONNECTED ? html`
            <button 
              class="action-btn secondary"
              @click=${this.handleDisconnectClick}
              aria-label="Disconnect from WebSocket server"
            >
              🔌 Disconnect
            </button>
          ` : html`
            <button 
              class="action-btn primary"
              @click=${this.handleConnectClick}
              ?disabled=${this.connectionState === ConnectionState.CONNECTING}
              aria-label="Connect to WebSocket server"
            >
              🔗 ${this.connectionState === ConnectionState.CONNECTING ? 'Connecting...' : 'Connect'}
            </button>
          `}
          
          <button 
            class="action-btn"
            @click=${this.handleReconnectClick}
            ?disabled=${this.connectionState === ConnectionState.CONNECTING}
            aria-label="Reconnect to WebSocket server"
          >
            🔄 Reconnect
          </button>
        </div>
      </div>
    `;
  }
}

// Component is registered via @customElement decorator