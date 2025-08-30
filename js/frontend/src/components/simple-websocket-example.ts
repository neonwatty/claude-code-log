/**
 * Simple WebSocket Example Component
 * Demonstrates the HOC pattern usage with WebSocket integration
 */

import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "./base/base-component.js";
import { WebSocketController } from "../utils/websocket/websocket-controller.js";
import type { SessionData } from "../utils/websocket/message-types.js";

@customElement("simple-websocket-example")
export class SimpleWebSocketExample extends BaseComponent {
  @property({ type: Array })
  sessions: SessionData[] = [];

  @state()
  private lastUpdate: string = "Never";

  @state()
  private updateCount: number = 0;

  // WebSocket controller for real-time updates
  private webSocketController: WebSocketController;

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        padding: var(--spacing-md);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-md);
        background-color: var(--color-surface);
      }

      .status-section {
        margin-bottom: var(--spacing-md);
        padding: var(--spacing-sm);
        background-color: var(--color-surface-hover);
        border-radius: var(--border-radius-sm);
      }

      .status-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: var(--spacing-xs);
        font-size: 0.9em;
      }

      .status-label {
        font-weight: 600;
        color: var(--color-text);
      }

      .status-value {
        color: var(--color-text-muted);
        font-family: var(--font-family-mono);
      }

      .sessions-section {
        margin-top: var(--spacing-md);
      }

      .session-item {
        padding: var(--spacing-sm);
        margin-bottom: var(--spacing-xs);
        background-color: var(--color-surface);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        animation: fadeIn 0.3s ease-out;
      }

      .session-item.new {
        background-color: var(--color-success) 20;
        border-color: var(--color-success);
      }

      .session-item.updated {
        background-color: var(--color-warning) 20;
        border-color: var(--color-warning);
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

      .connection-status {
        display: inline-block;
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--border-radius-sm);
        font-size: 0.8em;
        font-weight: 600;
      }

      .connection-status.connected {
        background-color: var(--color-success) 20;
        color: var(--color-success);
      }

      .connection-status.disconnected {
        background-color: var(--color-error) 20;
        color: var(--color-error);
      }

      .connection-status.connecting {
        background-color: var(--color-warning) 20;
        color: var(--color-warning);
      }

      .actions {
        margin-top: var(--spacing-md);
        display: flex;
        gap: var(--spacing-sm);
        flex-wrap: wrap;
      }

      .action-button {
        padding: var(--spacing-xs) var(--spacing-sm);
        background-color: var(--color-primary);
        color: var(--color-primary-text);
        border: none;
        border-radius: var(--border-radius-sm);
        cursor: pointer;
        font-size: 0.9em;
        transition: background-color var(--transition-fast);
      }

      .action-button:hover {
        background-color: var(--color-primary-hover);
      }

      .action-button:disabled {
        background-color: var(--color-text-muted);
        cursor: not-allowed;
      }
    `,
  ];

  constructor() {
    super();

    // Initialize WebSocket controller
    this.webSocketController = new WebSocketController(this, undefined, {
      debug: true,
      debounceMs: 100,
      optimisticUpdates: true,
      autoConnect: true,
    });
  }

  protected override firstUpdated(
    changedProperties: Map<string | number | symbol, unknown>,
  ): void {
    super.firstUpdated(changedProperties);
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    // Subscribe to session created events
    this.webSocketController.onSessionCreated((session: SessionData) => {
      console.log("New session created:", session);

      // Add to sessions array with optimistic update
      const newSessions = [...this.sessions, session];
      this.webSocketController.optimisticUpdate("sessions", newSessions);

      // Update stats
      this.updateCount++;
      this.lastUpdate = new Date().toLocaleTimeString();

      // Visual feedback
      setTimeout(() => {
        const newSessionElement = this.shadowRoot?.querySelector(
          ".session-item:last-child",
        );
        newSessionElement?.classList.add("new");
        setTimeout(() => newSessionElement?.classList.remove("new"), 2000);
      }, 100);
    });

    // Subscribe to session updated events
    this.webSocketController.onSessionUpdated(
      (session: SessionData, changes) => {
        console.log("Session updated:", session, changes);

        // Find and update the session
        const sessionIndex = this.sessions.findIndex(
          (s) => s.sessionId === session.sessionId,
        );
        if (sessionIndex >= 0) {
          const updatedSessions = [...this.sessions];
          updatedSessions[sessionIndex] = {
            ...updatedSessions[sessionIndex],
            ...session,
          };
          this.webSocketController.optimisticUpdate(
            "sessions",
            updatedSessions,
          );
        }

        // Update stats
        this.updateCount++;
        this.lastUpdate = new Date().toLocaleTimeString();

        // Visual feedback
        setTimeout(() => {
          const sessionElement = this.shadowRoot?.querySelector(
            `[data-session-id="${session.sessionId}"]`,
          );
          sessionElement?.classList.add("updated");
          setTimeout(() => sessionElement?.classList.remove("updated"), 2000);
        }, 100);
      },
    );

    // Subscribe to session deleted events
    this.webSocketController.onSessionDeleted((sessionId: string) => {
      console.log("Session deleted:", sessionId);

      // Remove from sessions array
      const updatedSessions = this.sessions.filter(
        (s) => s.sessionId !== sessionId,
      );
      this.webSocketController.optimisticUpdate("sessions", updatedSessions);

      // Update stats
      this.updateCount++;
      this.lastUpdate = new Date().toLocaleTimeString();
    });

    // Subscribe to cache invalidation
    this.webSocketController.onCacheInvalidated((payload) => {
      console.log("Cache invalidated:", payload);

      if (payload.scope === "all" || payload.scope === "session") {
        // Clear all sessions for demonstration
        this.webSocketController.optimisticUpdate("sessions", []);
      }

      // Update stats
      this.updateCount++;
      this.lastUpdate = new Date().toLocaleTimeString();
    });
  }

  private getConnectionStatusClass(): string {
    if (this.webSocketController.isConnected()) return "connected";

    const state = this.webSocketController.getConnectionState();
    switch (state) {
      case "CONNECTING":
      case "RECONNECTING":
        return "connecting";
      default:
        return "disconnected";
    }
  }

  private getConnectionStatusText(): string {
    if (this.webSocketController.isConnected()) return "Connected";

    const state = this.webSocketController.getConnectionState();
    switch (state) {
      case "CONNECTING":
        return "Connecting...";
      case "RECONNECTING":
        return "Reconnecting...";
      case "ERROR":
        return "Error";
      default:
        return "Disconnected";
    }
  }

  private handleTestOptimisticUpdate(): void {
    // Simulate an optimistic update
    const testSession: SessionData = {
      sessionId: `test-${Date.now()}`,
      title: `Test Session ${this.sessions.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "active",
    };

    this.webSocketController.optimisticUpdate("sessions", [
      ...this.sessions,
      testSession,
    ]);

    // Simulate server confirmation after 2 seconds
    setTimeout(() => {
      this.webSocketController.confirmOptimisticUpdate("sessions");
    }, 2000);
  }

  private handleClearSessions(): void {
    this.webSocketController.optimisticUpdate("sessions", []);
    this.webSocketController.confirmOptimisticUpdate("sessions");
  }

  private handleForceReconnect(): void {
    this.webSocketController.reconnect();
  }

  protected safeRender(): TemplateResult {
    const connectionStatusClass = this.getConnectionStatusClass();
    const connectionStatusText = this.getConnectionStatusText();

    return html`
      <div>
        <h3>Simple WebSocket Integration Example</h3>

        <div class="status-section">
          <h4>Connection Status</h4>
          <div class="status-item">
            <span class="status-label">Connection:</span>
            <span class="connection-status ${connectionStatusClass}">
              ${connectionStatusText}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">Last Update:</span>
            <span class="status-value">${this.lastUpdate}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Update Count:</span>
            <span class="status-value">${this.updateCount}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Sessions Count:</span>
            <span class="status-value">${this.sessions.length}</span>
          </div>
        </div>

        <div class="actions">
          <button
            class="action-button"
            @click=${this.handleTestOptimisticUpdate}
            ?disabled=${!this.webSocketController.isConnected()}
          >
            Test Optimistic Update
          </button>
          <button class="action-button" @click=${this.handleClearSessions}>
            Clear Sessions
          </button>
          <button
            class="action-button"
            @click=${this.handleForceReconnect}
            ?disabled=${this.webSocketController.isConnected()}
          >
            Reconnect
          </button>
        </div>

        <div class="sessions-section">
          <h4>Sessions (${this.sessions.length})</h4>
          ${this.sessions.length > 0
            ? this.sessions.map(
                (session) => html`
                  <div
                    class="session-item"
                    data-session-id="${session.sessionId}"
                  >
                    <strong>${session.title || session.sessionId}</strong><br />
                    <small>
                      Created:
                      ${session.createdAt
                        ? new Date(session.createdAt).toLocaleString()
                        : "Unknown"}<br />
                      Updated:
                      ${session.updatedAt
                        ? new Date(session.updatedAt).toLocaleString()
                        : "Unknown"}<br />
                      Status: ${session.status || "Unknown"}
                    </small>
                  </div>
                `,
              )
            : html`<p
                style="color: var(--color-text-muted); font-style: italic;"
              >
                No sessions available
              </p>`}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "simple-websocket-example": SimpleWebSocketExample;
  }
}
