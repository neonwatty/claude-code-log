/**
 * Enhanced Session List Component with WebSocket Integration
 * Demonstrates real-time updates using the WebSocket controller
 */

import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import { WebSocketController } from "../../utils/websocket/websocket-controller.js";
import type { ZodSession } from "../../../../shared/src/schemas/index.js";
import type { SessionData } from "../../utils/websocket/message-types.js";
import { ConnectionState } from "../../utils/websocket/connection-state.js";

export interface SessionFilter {
  searchTerm?: string;
  fromDate?: Date;
  toDate?: Date;
  hasContent?: boolean;
}

export interface SessionSort {
  field: "timestamp" | "messageCount" | "id" | "tokenUsage";
  direction: "asc" | "desc";
}

@customElement("session-list-websocket-enhanced")
export class SessionListWebSocketEnhanced extends BaseComponent {
  @property({ type: Array })
  sessions: ZodSession[] = [];

  @property({ type: Object })
  filter: SessionFilter = {};

  @property({ type: Object })
  sort: SessionSort = { field: "timestamp", direction: "desc" };

  @property({ type: Boolean })
  enableRealtimeUpdates = true;

  @state()
  private filteredSessions: ZodSession[] = [];

  @state()
  private selectedSessionId: string | null = null;

  @state()
  private realtimeSessionUpdates: Map<string, Partial<SessionData>> = new Map();

  @state()
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  @state()
  private pendingOperations: Set<string> = new Set();

  // WebSocket controller for real-time updates
  private webSocketController: WebSocketController;

  constructor() {
    super();

    // Initialize WebSocket controller with configuration
    this.webSocketController = new WebSocketController(this, undefined, {
      debug: true,
      debounceMs: 250, // Debounce rapid updates
      optimisticUpdates: true,
      autoConnect: true,
      messageTypes: [
        "SESSION_CREATED",
        "SESSION_UPDATED",
        "SESSION_DELETED",
        "CACHE_INVALIDATED",
      ],
    });

    this.setupWebSocketSubscriptions();
  }

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        font-family: var(--font-family-mono);
      }

      .session-list-container {
        background-color: var(--color-surface);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
        box-shadow:
          -7px -7px 10px var(--color-shadow-light),
          7px 7px 10px var(--color-shadow-dark);
        border-left: var(--color-border-light) 1px solid;
        border-top: var(--color-border-light) 1px solid;
        border-bottom: var(--color-border-dark) 1px solid;
        border-right: var(--color-border-dark) 1px solid;
      }

      .session-list-header {
        margin: 0 0 var(--spacing-sm) 0;
        font-size: 1.2em;
        color: var(--color-text);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
      }

      .realtime-status {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        font-size: 0.8em;
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--border-radius-sm);
        border: 1px solid var(--color-border-dark);
      }

      .realtime-status.connected {
        background-color: var(--color-success) 20;
        border-color: var(--color-success);
        color: var(--color-success);
      }

      .realtime-status.connecting {
        background-color: var(--color-warning) 20;
        border-color: var(--color-warning);
        color: var(--color-warning);
      }

      .realtime-status.disconnected {
        background-color: var(--color-error) 20;
        border-color: var(--color-error);
        color: var(--color-error);
      }

      .realtime-status.reconnecting {
        background-color: var(--color-warning) 20;
        border-color: var(--color-warning);
        color: var(--color-warning);
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      .connection-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }

      .session-list-controls {
        display: flex;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-md);
        align-items: center;
        flex-wrap: wrap;
      }

      .filter-input {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text);
        font-family: var(--font-family-mono);
        font-size: 0.9em;
        min-width: 200px;
      }

      .filter-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary) 33;
      }

      .sort-select {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text);
        font-family: var(--font-family-mono);
        font-size: 0.9em;
      }

      .sessions-grid {
        display: grid;
        gap: var(--spacing-sm);
      }

      .session-item {
        padding: var(--spacing-sm) var(--spacing-md);
        background-color: var(--color-surface);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        text-decoration: none;
        color: var(--color-text);
        transition: all var(--transition-fast);
        cursor: pointer;
        display: block;
        position: relative;
      }

      .session-item:hover {
        background-color: var(--color-surface-hover);
        transform: translateY(-1px);
        box-shadow:
          -3px -3px 5px var(--color-shadow-light),
          3px 3px 5px var(--color-shadow-dark);
      }

      .session-item.selected {
        background-color: var(--color-surface-active);
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary) 33;
      }

      .session-item.updated {
        animation: highlight 2s ease-out;
      }

      .session-item.pending {
        opacity: 0.7;
        pointer-events: none;
      }

      .session-item.newly-created {
        animation: slideIn 0.5s ease-out;
      }

      @keyframes highlight {
        0% {
          background-color: var(--color-primary) 30;
        }
        100% {
          background-color: transparent;
        }
      }

      @keyframes slideIn {
        0% {
          opacity: 0;
          transform: translateY(-20px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .session-item-title {
        font-weight: 600;
        font-size: 0.9em;
        margin-bottom: var(--spacing-xs);
        word-break: break-word;
      }

      .session-item-meta {
        font-size: 0.8em;
        color: var(--color-text-muted);
        margin-bottom: var(--spacing-xs);
        display: flex;
        gap: var(--spacing-sm);
        flex-wrap: wrap;
      }

      .session-item-preview {
        font-size: 0.75em;
        line-height: 1.3;
        color: var(--color-text-light);
        background-color: var(--color-surface-hover);
        padding: var(--spacing-xs);
        border-radius: var(--border-radius-sm);
        white-space: pre-wrap;
        word-wrap: break-word;
        word-break: break-word;
        max-height: 60px;
        overflow: hidden;
        position: relative;
      }

      .session-item-preview::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 20px;
        background: linear-gradient(transparent, var(--color-surface-hover));
        pointer-events: none;
      }

      .realtime-indicator {
        position: absolute;
        top: var(--spacing-xs);
        right: var(--spacing-xs);
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--color-primary);
        opacity: 0;
        transition: opacity var(--transition-fast);
      }

      .session-item.has-realtime-update .realtime-indicator {
        opacity: 1;
        animation: pulse 2s infinite;
      }

      .empty-state {
        text-align: center;
        padding: var(--spacing-xl);
        color: var(--color-text-muted);
        font-style: italic;
      }

      .session-count {
        font-size: 0.85em;
        color: var(--color-text-muted);
      }

      .reconnect-button {
        padding: var(--spacing-xs) var(--spacing-sm);
        background-color: var(--color-primary);
        color: var(--color-primary-text);
        border: none;
        border-radius: var(--border-radius-sm);
        cursor: pointer;
        font-size: 0.8em;
        transition: background-color var(--transition-fast);
      }

      .reconnect-button:hover {
        background-color: var(--color-primary-hover);
      }
    `,
  ];

  /**
   * Setup WebSocket message subscriptions
   */
  private setupWebSocketSubscriptions(): void {
    if (!this.enableRealtimeUpdates) return;

    // Subscribe to session created messages
    this.webSocketController.onSessionCreated((session: SessionData) => {
      this.log("Session created:", session);
      this.handleSessionCreated(session);
    });

    // Subscribe to session updated messages
    this.webSocketController.onSessionUpdated(
      (session: SessionData, changes) => {
        this.log("Session updated:", session, changes);
        this.handleSessionUpdated(session, changes);
      },
    );

    // Subscribe to session deleted messages
    this.webSocketController.onSessionDeleted(
      (sessionId: string, deletedAt: string) => {
        this.log("Session deleted:", sessionId, deletedAt);
        this.handleSessionDeleted(sessionId);
      },
    );

    // Subscribe to cache invalidated messages
    this.webSocketController.onCacheInvalidated((payload) => {
      this.log("Cache invalidated:", payload);
      this.handleCacheInvalidated(payload);
    });
  }

  /**
   * Handle new session creation with optimistic UI updates
   */
  private handleSessionCreated(sessionData: SessionData): void {
    // Check if this session already exists (avoid duplicates)
    const existingSession = this.sessions.find(
      (s) => s.id === sessionData.sessionId,
    );
    if (existingSession) {
      this.log("Session already exists, updating instead");
      this.handleSessionUpdated(sessionData, {
        fields: [],
        previousValues: {},
      });
      return;
    }

    // Create a basic session object from WebSocket data
    // Note: In a real implementation, you'd need more complete session data
    const newSession: Partial<ZodSession> = {
      id: sessionData.sessionId,
      summary:
        sessionData.title || `Session ${sessionData.sessionId.slice(0, 8)}`,
      firstTimestamp: sessionData.createdAt || new Date().toISOString(),
      lastTimestamp: sessionData.updatedAt || new Date().toISOString(),
      entries: [], // Would be populated from API
      totalUsage: { input_tokens: 0, output_tokens: 0 }, // Would be populated from API
      cwd: "/unknown", // Would be populated from API
    };

    // Add temporary class for animation
    setTimeout(() => {
      const sessionElement = this.shadowRoot?.querySelector(
        `[data-session-id="${sessionData.sessionId}"]`,
      );
      sessionElement?.classList.add("newly-created");
      setTimeout(() => sessionElement?.classList.remove("newly-created"), 500);
    }, 100);

    // Emit event for parent components to handle
    this.emitEvent("session-created", {
      session: newSession,
      source: "websocket",
    });
  }

  /**
   * Handle session updates with visual feedback
   */
  private handleSessionUpdated(sessionData: SessionData, changes: any): void {
    // Store the realtime update for display
    this.realtimeSessionUpdates.set(sessionData.sessionId, sessionData);

    // Confirm any pending optimistic updates
    this.webSocketController.confirmOptimisticUpdate("sessions");

    // Add visual feedback
    setTimeout(() => {
      const sessionElement = this.shadowRoot?.querySelector(
        `[data-session-id="${sessionData.sessionId}"]`,
      );
      sessionElement?.classList.add("updated");
      sessionElement?.classList.add("has-realtime-update");

      // Remove highlight after animation
      setTimeout(() => {
        sessionElement?.classList.remove("updated");
        sessionElement?.classList.remove("has-realtime-update");
      }, 2000);
    }, 100);

    // Emit event for parent components to handle
    this.emitEvent("session-updated", {
      sessionId: sessionData.sessionId,
      changes,
      source: "websocket",
    });

    // Trigger re-render
    this.requestUpdate();
  }

  /**
   * Handle session deletion
   */
  private handleSessionDeleted(sessionId: string): void {
    // Remove from realtime updates
    this.realtimeSessionUpdates.delete(sessionId);
    this.pendingOperations.delete(sessionId);

    // Confirm any pending optimistic updates
    this.webSocketController.confirmOptimisticUpdate("sessions");

    // Add visual feedback before removal
    const sessionElement = this.shadowRoot?.querySelector(
      `[data-session-id="${sessionId}"]`,
    );
    if (sessionElement) {
      sessionElement.classList.add("deleted");
      setTimeout(() => {
        // Emit event for parent components to handle removal
        this.emitEvent("session-deleted", { sessionId, source: "websocket" });
      }, 300);
    } else {
      // Immediate emission if element not found
      this.emitEvent("session-deleted", { sessionId, source: "websocket" });
    }
  }

  /**
   * Handle cache invalidation
   */
  private handleCacheInvalidated(payload: any): void {
    this.log("Handling cache invalidation:", payload);

    if (payload.scope === "all" || payload.scope === "session") {
      // Clear all realtime updates
      this.realtimeSessionUpdates.clear();
      this.pendingOperations.clear();

      // Emit event for parent to refresh data
      this.emitEvent("cache-invalidated", {
        scope: payload.scope,
        reason: payload.reason,
      });
    } else if (payload.scope === "specific" && payload.sessionIds) {
      // Clear specific session updates
      payload.sessionIds.forEach((sessionId: string) => {
        this.realtimeSessionUpdates.delete(sessionId);
        this.pendingOperations.delete(sessionId);
      });

      // Emit event for parent to refresh specific sessions
      this.emitEvent("cache-invalidated", {
        scope: payload.scope,
        sessionIds: payload.sessionIds,
        reason: payload.reason,
      });
    }

    this.requestUpdate();
  }

  /**
   * Perform optimistic update for UI responsiveness
   */
  public performOptimisticUpdate(
    sessionId: string,
    updates: Partial<SessionData>,
  ): void {
    if (!this.enableRealtimeUpdates) return;

    this.pendingOperations.add(sessionId);
    this.realtimeSessionUpdates.set(sessionId, {
      ...this.realtimeSessionUpdates.get(sessionId),
      ...updates,
    });

    // Use WebSocket controller's optimistic update feature
    this.webSocketController.optimisticUpdate("sessions", this.sessions, 5000);

    this.requestUpdate();
  }

  /**
   * Get connection state for display
   */
  private getConnectionStateInfo(): {
    label: string;
    className: string;
    icon: string;
  } {
    this.connectionState = this.webSocketController.getConnectionState();

    switch (this.connectionState) {
      case ConnectionState.CONNECTED:
        return { label: "Connected", className: "connected", icon: "🟢" };
      case ConnectionState.CONNECTING:
        return { label: "Connecting", className: "connecting", icon: "🟡" };
      case ConnectionState.RECONNECTING:
        return { label: "Reconnecting", className: "reconnecting", icon: "🔄" };
      case ConnectionState.ERROR:
        return { label: "Error", className: "disconnected", icon: "❌" };
      default:
        return { label: "Disconnected", className: "disconnected", icon: "🔴" };
    }
  }

  /**
   * Manual reconnection handler
   */
  private handleReconnect(): void {
    this.webSocketController.reconnect();
  }

  protected override willUpdate(): void {
    this.filteredSessions = this.filterAndSortSessions();
  }

  private filterAndSortSessions(): ZodSession[] {
    let filtered = [...this.sessions];

    // Apply filters (same as original implementation)
    if (this.filter.searchTerm) {
      const searchLower = this.filter.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (session) =>
          session.id.toLowerCase().includes(searchLower) ||
          session.summary?.toLowerCase().includes(searchLower) ||
          session.cwd.toLowerCase().includes(searchLower),
      );
    }

    if (this.filter.fromDate) {
      filtered = filtered.filter(
        (session) => new Date(session.firstTimestamp) >= this.filter.fromDate!,
      );
    }

    if (this.filter.toDate) {
      filtered = filtered.filter(
        (session) => new Date(session.lastTimestamp) <= this.filter.toDate!,
      );
    }

    // Apply sorting (same as original implementation)
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (this.sort.field) {
        case "timestamp":
          comparison =
            new Date(a.firstTimestamp).getTime() -
            new Date(b.firstTimestamp).getTime();
          break;
        case "messageCount":
          comparison = a.entries.length - b.entries.length;
          break;
        case "id":
          comparison = a.id.localeCompare(b.id);
          break;
        case "tokenUsage":
          const aTokens =
            (a.totalUsage.input_tokens || 0) +
            (a.totalUsage.output_tokens || 0);
          const bTokens =
            (b.totalUsage.input_tokens || 0) +
            (b.totalUsage.output_tokens || 0);
          comparison = aTokens - bTokens;
          break;
      }

      return this.sort.direction === "desc" ? -comparison : comparison;
    });

    return filtered;
  }

  private handleSessionClick(session: ZodSession): void {
    // Perform optimistic selection
    const previousSelection = this.selectedSessionId;
    this.selectedSessionId = session.id;

    // Emit event immediately for responsive UI
    this.emitEvent("session-selected", { session });

    // If the selection fails (rare), rollback
    // This would typically be handled by the parent component
    setTimeout(() => {
      // Example rollback logic (would be triggered by parent component)
      // this.selectedSessionId = previousSelection;
    }, 100);
  }

  private handleSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filter = { ...this.filter, searchTerm: target.value };
  }

  private handleSortChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const [field, direction] = target.value.split(":");
    this.sort = {
      field: field as SessionSort["field"],
      direction: direction as SessionSort["direction"],
    };
  }

  private formatTokenUsage(session: ZodSession): string {
    const {
      input_tokens = 0,
      output_tokens = 0,
      cache_creation_input_tokens = 0,
      cache_read_input_tokens = 0,
    } = session.totalUsage;
    const parts = [];

    if (input_tokens > 0)
      parts.push(`Input: ${this.formatTokenCount(input_tokens)}`);
    if (output_tokens > 0)
      parts.push(`Output: ${this.formatTokenCount(output_tokens)}`);
    if (cache_creation_input_tokens > 0)
      parts.push(
        `Cache Creation: ${this.formatTokenCount(cache_creation_input_tokens)}`,
      );
    if (cache_read_input_tokens > 0)
      parts.push(
        `Cache Read: ${this.formatTokenCount(cache_read_input_tokens)}`,
      );

    return parts.join(" | ");
  }

  private getSessionPreview(session: ZodSession): string {
    // Check for realtime updates first
    const realtimeUpdate = this.realtimeSessionUpdates.get(session.id);
    if (realtimeUpdate?.metadata?.preview) {
      return this.truncateText(realtimeUpdate.metadata.preview as string, 200);
    }

    // Fall back to existing logic
    const firstUserEntry = session.entries.find(
      (entry) => entry.type === "user",
    );
    if (
      firstUserEntry?.type === "user" &&
      firstUserEntry.message.content?.[0]?.type === "text"
    ) {
      return this.truncateText(firstUserEntry.message.content[0].text, 200);
    }
    return "No preview available";
  }

  private renderSessionItem(session: ZodSession): TemplateResult {
    const isSelected = this.selectedSessionId === session.id;
    const isPending = this.pendingOperations.has(session.id);
    const hasRealtimeUpdate = this.realtimeSessionUpdates.has(session.id);
    const realtimeUpdate = this.realtimeSessionUpdates.get(session.id);

    // Use realtime data if available
    const displayData = {
      title: realtimeUpdate?.title || session.summary || session.id.slice(0, 8),
      messageCount: session.entries.length,
      timestampRange: `${this.formatTimestamp(session.firstTimestamp)} - ${this.formatTimestamp(session.lastTimestamp)}`,
      tokenUsage: this.formatTokenUsage(session),
      preview: this.getSessionPreview(session),
    };

    return html`
      <div
        class="session-item ${isSelected ? "selected" : ""} ${isPending
          ? "pending"
          : ""} ${hasRealtimeUpdate ? "has-realtime-update" : ""}"
        data-session-id="${session.id}"
        @click=${() => this.handleSessionClick(session)}
        role="button"
        tabindex="0"
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.handleSessionClick(session);
          }
        }}
      >
        <div class="realtime-indicator"></div>
        <div class="session-item-title">${displayData.title}</div>
        <div class="session-item-meta">
          <span>${displayData.timestampRange}</span>
          <span
            >${displayData.messageCount}
            message${displayData.messageCount === 1 ? "" : "s"}</span
          >
          ${displayData.tokenUsage
            ? html`<span>${displayData.tokenUsage}</span>`
            : ""}
        </div>
        ${displayData.preview
          ? html`
              <div class="session-item-preview">${displayData.preview}</div>
            `
          : ""}
      </div>
    `;
  }

  private renderRealtimeStatus(): TemplateResult {
    if (!this.enableRealtimeUpdates) {
      return html`
        <div class="realtime-status disconnected">
          <span
            class="connection-indicator"
            style="background-color: var(--color-text-muted);"
          ></span>
          Real-time updates disabled
        </div>
      `;
    }

    const { label, className, icon } = this.getConnectionStateInfo();
    const isDisconnected = className === "disconnected";

    return html`
      <div class="realtime-status ${className}">
        <span class="connection-indicator"></span>
        ${label}
        ${isDisconnected
          ? html`
              <button class="reconnect-button" @click=${this.handleReconnect}>
                Reconnect
              </button>
            `
          : ""}
      </div>
    `;
  }

  protected safeRender(): TemplateResult {
    const sessionCount = this.filteredSessions.length;
    const totalCount = this.sessions.length;

    return html`
      <div class="session-list-container">
        <div class="session-list-header">
          <h2>Sessions (Real-time)</h2>
          <div
            style="display: flex; gap: var(--spacing-sm); align-items: center;"
          >
            ${this.renderRealtimeStatus()}
            <span class="session-count">
              ${sessionCount}${sessionCount !== totalCount
                ? ` of ${totalCount}`
                : ""}
              session${sessionCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div class="session-list-controls">
          <input
            type="text"
            class="filter-input"
            placeholder="Search sessions..."
            @input=${this.handleSearchInput}
            .value=${this.filter.searchTerm || ""}
          />
          <select class="sort-select" @change=${this.handleSortChange}>
            <option
              value="timestamp:desc"
              ?selected=${this.sort.field === "timestamp" &&
              this.sort.direction === "desc"}
            >
              Latest First
            </option>
            <option
              value="timestamp:asc"
              ?selected=${this.sort.field === "timestamp" &&
              this.sort.direction === "asc"}
            >
              Oldest First
            </option>
            <option
              value="messageCount:desc"
              ?selected=${this.sort.field === "messageCount" &&
              this.sort.direction === "desc"}
            >
              Most Messages
            </option>
            <option
              value="messageCount:asc"
              ?selected=${this.sort.field === "messageCount" &&
              this.sort.direction === "asc"}
            >
              Least Messages
            </option>
            <option
              value="tokenUsage:desc"
              ?selected=${this.sort.field === "tokenUsage" &&
              this.sort.direction === "desc"}
            >
              Most Tokens
            </option>
            <option
              value="tokenUsage:asc"
              ?selected=${this.sort.field === "tokenUsage" &&
              this.sort.direction === "asc"}
            >
              Least Tokens
            </option>
            <option
              value="id:asc"
              ?selected=${this.sort.field === "id" &&
              this.sort.direction === "asc"}
            >
              ID A-Z
            </option>
            <option
              value="id:desc"
              ?selected=${this.sort.field === "id" &&
              this.sort.direction === "desc"}
            >
              ID Z-A
            </option>
          </select>
        </div>

        <div class="sessions-grid">
          ${this.filteredSessions.length > 0
            ? this.filteredSessions.map((session) =>
                this.renderSessionItem(session),
              )
            : html`<div class="empty-state">No sessions found</div>`}
        </div>
      </div>
    `;
  }

  /**
   * Debug logging helper
   */
  private log(message: string, ...data: any[]): void {
    if (this.webSocketController) {
      console.log(`[SessionListWebSocketEnhanced] ${message}`, ...data);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "session-list-websocket-enhanced": SessionListWebSocketEnhanced;
  }
}
