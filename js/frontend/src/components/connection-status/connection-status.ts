/**
 * Connection Status Component
 * Displays real-time WebSocket connection status with visual indicators
 */

import { html, css, CSSResult } from "lit";
import { property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import {
  ConnectionState,
  getConnectionStateDisplay,
  formatUptime,
  formatDataSize,
  calculateConnectionQuality,
} from "../../utils/websocket/connection-state.js";
import type {
  ConnectionStatistics,
  ConnectionDebugInfo,
} from "../../utils/websocket/connection-state.js";

export class ConnectionStatusComponent extends BaseComponent {
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

  @property({ type: Object })
  debugInfo: ConnectionDebugInfo | null = null;

  @property({ type: Boolean })
  showDebugPanel = false;

  @property({ type: Boolean })
  compact = false;

  @state()
  private animateIcon = false;

  static override styles: CSSResult[] = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        font-family: var(--font-family-mono);
      }

      .connection-status {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        padding: var(--spacing-xs) var(--spacing-sm);
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        transition: all 0.3s ease;
      }

      .connection-status.compact {
        padding: var(--spacing-xs);
        border-radius: 50%;
        aspect-ratio: 1;
        justify-content: center;
      }

      .connection-status:hover {
        background: var(--color-background-hover);
        cursor: pointer;
      }

      .status-icon {
        font-size: 1em;
        transition: transform 0.3s ease;
        user-select: none;
      }

      .status-icon.animated {
        animation: pulse 1.5s infinite;
      }

      .status-text {
        font-size: 0.85em;
        font-weight: 500;
        white-space: nowrap;
      }

      .status-details {
        font-size: 0.75em;
        color: var(--color-text-muted);
        margin-left: auto;
      }

      .compact .status-text,
      .compact .status-details {
        display: none;
      }

      /* Connection quality indicator */
      .quality-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-left: var(--spacing-xs);
        transition: background-color 0.3s ease;
      }

      .quality-excellent {
        background: var(--color-success);
      }
      .quality-good {
        background: #4caf50;
      }
      .quality-fair {
        background: var(--color-warning);
      }
      .quality-poor {
        background: var(--color-error);
      }
      .quality-unknown {
        background: var(--color-text-muted);
      }

      /* Debug panel */
      .debug-panel {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-top: none;
        border-radius: 0 0 var(--border-radius-sm) var(--border-radius-sm);
        padding: var(--spacing-sm);
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        max-height: 400px;
        overflow-y: auto;
      }

      .debug-section {
        margin-bottom: var(--spacing-sm);
      }

      .debug-title {
        font-size: 0.8em;
        font-weight: bold;
        color: var(--color-text);
        margin-bottom: var(--spacing-xs);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .debug-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacing-xs);
        font-size: 0.75em;
      }

      .debug-item {
        display: flex;
        justify-content: space-between;
        padding: var(--spacing-xs);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius-xs);
      }

      .debug-label {
        color: var(--color-text-muted);
      }

      .debug-value {
        color: var(--color-text);
        font-weight: 500;
      }

      /* Animations */
      @keyframes pulse {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.1);
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .debug-panel {
        animation: fadeIn 0.3s ease;
      }

      /* Accessibility */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .debug-grid {
          grid-template-columns: 1fr;
        }

        .status-details {
          display: none;
        }
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    this.startAnimationLoop();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.stopAnimationLoop();
  }

  private animationInterval: number | null = null;

  private startAnimationLoop() {
    this.animationInterval = window.setInterval(() => {
      const shouldAnimate =
        this.connectionState === ConnectionState.CONNECTING ||
        this.connectionState === ConnectionState.RECONNECTING;
      this.animateIcon = shouldAnimate;
    }, 100);
  }

  private stopAnimationLoop() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  private handleClick() {
    if (!this.compact) {
      this.showDebugPanel = !this.showDebugPanel;
      this.emitEvent("debug-panel-toggled", { visible: this.showDebugPanel });
    }
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.handleClick();
    }
  }

  override render() {
    const stateDisplay = getConnectionStateDisplay(this.connectionState);
    const quality = calculateConnectionQuality(this.statistics);

    return html`
      <div
        class="connection-status ${this.compact ? "compact" : ""}"
        style="color: ${stateDisplay.color}"
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
        tabindex="0"
        role="button"
        aria-label="Connection status: ${stateDisplay.label}. ${this.getAccessibilityDescription()}"
        aria-expanded=${this.showDebugPanel ? "true" : "false"}
      >
        <span
          class="status-icon ${this.animateIcon ? "animated" : ""}"
          role="img"
          aria-hidden="true"
        >
          ${stateDisplay.icon}
        </span>

        <span class="status-text">${stateDisplay.label}</span>

        <span class="status-details"> ${this.renderStatusDetails()} </span>

        <div
          class="quality-indicator quality-${quality}"
          title="Connection quality: ${quality}"
        ></div>

        <!-- Screen reader announcement -->
        <span class="sr-only" aria-live="polite" aria-atomic="true">
          ${this.getAccessibilityDescription()}
        </span>
      </div>

      ${this.showDebugPanel ? this.renderDebugPanel() : ""}
    `;
  }

  private renderStatusDetails() {
    switch (this.connectionState) {
      case ConnectionState.CONNECTED:
        return `Uptime: ${formatUptime(this.statistics.uptime)}`;
      case ConnectionState.RECONNECTING:
        return `Attempt ${this.statistics.reconnectionCount}`;
      case ConnectionState.DISCONNECTED:
        return this.statistics.lastDisconnectTime
          ? `Disconnected ${this.formatRelativeTime(new Date(this.statistics.lastDisconnectTime))}`
          : "Not connected";
      default:
        return "";
    }
  }

  private renderDebugPanel() {
    if (!this.debugInfo) return "";

    return html`
      <div class="debug-panel">
        <div class="debug-section">
          <div class="debug-title">Connection Info</div>
          <div class="debug-grid">
            <div class="debug-item">
              <span class="debug-label">URL:</span>
              <span class="debug-value">${this.debugInfo.url}</span>
            </div>
            <div class="debug-item">
              <span class="debug-label">Ready State:</span>
              <span class="debug-value"
                >${this.getReadyStateText(this.debugInfo.readyState)}</span
              >
            </div>
            <div class="debug-item">
              <span class="debug-label">Protocol:</span>
              <span class="debug-value"
                >${this.debugInfo.protocol || "None"}</span
              >
            </div>
            <div class="debug-item">
              <span class="debug-label">Extensions:</span>
              <span class="debug-value"
                >${this.debugInfo.extensions || "None"}</span
              >
            </div>
          </div>
        </div>

        <div class="debug-section">
          <div class="debug-title">Statistics</div>
          <div class="debug-grid">
            <div class="debug-item">
              <span class="debug-label">Uptime:</span>
              <span class="debug-value"
                >${formatUptime(this.debugInfo.statistics.uptime)}</span
              >
            </div>
            <div class="debug-item">
              <span class="debug-label">Reconnections:</span>
              <span class="debug-value"
                >${this.debugInfo.statistics.reconnectionCount}</span
              >
            </div>
            <div class="debug-item">
              <span class="debug-label">Avg Latency:</span>
              <span class="debug-value"
                >${this.debugInfo.statistics.averageLatency}ms</span
              >
            </div>
            <div class="debug-item">
              <span class="debug-label">Quality:</span>
              <span class="debug-value"
                >${this.debugInfo.statistics.connectionQuality}</span
              >
            </div>
            <div class="debug-item">
              <span class="debug-label">Messages Sent:</span>
              <span class="debug-value"
                >${this.debugInfo.statistics.messagesSent}</span
              >
            </div>
            <div class="debug-item">
              <span class="debug-label">Messages Received:</span>
              <span class="debug-value"
                >${this.debugInfo.statistics.messagesReceived}</span
              >
            </div>
            <div class="debug-item">
              <span class="debug-label">Data Sent:</span>
              <span class="debug-value"
                >${formatDataSize(
                  this.debugInfo.statistics.totalDataSent,
                )}</span
              >
            </div>
            <div class="debug-item">
              <span class="debug-label">Data Received:</span>
              <span class="debug-value"
                >${formatDataSize(
                  this.debugInfo.statistics.totalDataReceived,
                )}</span
              >
            </div>
          </div>
        </div>

        <div class="debug-section">
          <div class="debug-title">Health Check</div>
          <div class="debug-grid">
            <div class="debug-item">
              <span class="debug-label">Last Heartbeat:</span>
              <span class="debug-value">
                ${this.debugInfo.lastHeartbeat
                  ? this.formatRelativeTime(
                      new Date(this.debugInfo.lastHeartbeat),
                    )
                  : "Never"}
              </span>
            </div>
            <div class="debug-item">
              <span class="debug-label">Last Pong:</span>
              <span class="debug-value">
                ${this.debugInfo.lastPong
                  ? this.formatRelativeTime(new Date(this.debugInfo.lastPong))
                  : "Never"}
              </span>
            </div>
            <div class="debug-item">
              <span class="debug-label">Buffered Amount:</span>
              <span class="debug-value"
                >${formatDataSize(this.debugInfo.bufferedAmount)}</span
              >
            </div>
            <div class="debug-item">
              <span class="debug-label">Binary Type:</span>
              <span class="debug-value">${this.debugInfo.binaryType}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private getReadyStateText(readyState: number): string {
    switch (readyState) {
      case WebSocket.CONNECTING:
        return "CONNECTING (0)";
      case WebSocket.OPEN:
        return "OPEN (1)";
      case WebSocket.CLOSING:
        return "CLOSING (2)";
      case WebSocket.CLOSED:
        return "CLOSED (3)";
      default:
        return `UNKNOWN (${readyState})`;
    }
  }

  private getAccessibilityDescription(): string {
    const stateDisplay = getConnectionStateDisplay(this.connectionState);
    let description = `Connection is ${stateDisplay.label.toLowerCase()}`;

    if (this.connectionState === ConnectionState.CONNECTED) {
      description += `. Uptime: ${formatUptime(this.statistics.uptime)}`;
    } else if (this.connectionState === ConnectionState.RECONNECTING) {
      description += `. Reconnection attempt ${this.statistics.reconnectionCount}`;
    }

    description += `. Connection quality: ${calculateConnectionQuality(this.statistics)}`;

    return description;
  }
}

// Register the custom element
customElements.define("connection-status", ConnectionStatusComponent);
