import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import type { ZodSession } from "../../../../shared/src/schemas/index.js";
import type {
  SessionContinuationRequest,
  SessionContinuationResponse,
  ClaudeProcessStatus,
  ClaudeProcessState,
} from "../../../../shared/src/schemas/claude-integration.js";

export interface SessionContinuationState {
  selectedSession: ZodSession | null;
  continuationStatus: ClaudeProcessState;
  processId: string | null;
  claudeProcessUrl: string | null;
  errorMessage: string | null;
  successMessage: string | null;
  isFormValid: boolean;
}

export interface SessionContinuationOptions {
  workingDirectory?: string;
  command?: string;
  prepareContext?: boolean;
  useExistingClaudeMd?: boolean;
}

@customElement("session-continuation")
export class SessionContinuation extends BaseComponent {
  @property({ type: Object })
  session: ZodSession | null = null;

  @property({ type: String, attribute: "api-base-url" })
  apiBaseUrl = "/api";

  @property({ type: Boolean, attribute: "auto-prepare-context" })
  autoPrepareContext = true;

  @property({ type: Boolean, attribute: "show-advanced-options" })
  showAdvancedOptions = false;

  @state()
  private continuationState: SessionContinuationState = {
    selectedSession: null,
    continuationStatus: "idle",
    processId: null,
    claudeProcessUrl: null,
    errorMessage: null,
    successMessage: null,
    isFormValid: false,
  };

  @state()
  private continuationOptions: SessionContinuationOptions = {
    workingDirectory: "",
    command: "",
    prepareContext: this.autoPrepareContext,
    useExistingClaudeMd: false,
  };

  @state()
  private websocketConnected = false;

  private websocket: WebSocket | null = null;
  private heartbeatInterval: number | null = null;

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        font-family: var(--font-family-mono);
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
      }

      .session-continuation-container {
        background-color: var(--color-surface);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-lg);
        box-shadow:
          -7px -7px 10px var(--color-shadow-light),
          7px 7px 10px var(--color-shadow-dark);
        border: 1px solid var(--color-border-light);
      }

      .header {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-lg);
        padding-bottom: var(--spacing-md);
        border-bottom: 2px solid var(--color-border-light);
      }

      .header-icon {
        font-size: 1.5em;
      }

      .header-title {
        font-size: 1.2em;
        font-weight: 600;
        color: var(--color-text);
      }

      .session-info {
        background-color: var(--color-background);
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
      }

      .session-info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--spacing-sm);
        font-size: 0.9em;
      }

      .info-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--spacing-sm);
      }

      .info-label {
        font-weight: 600;
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      .info-value {
        color: var(--color-text);
        word-break: break-word;
        text-align: right;
      }

      .status-section {
        background-color: var(--color-surface-hover);
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
      }

      .status-indicator {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-sm);
        font-weight: 600;
      }

      .status-icon {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        animation: pulse 2s infinite;
      }

      .status-icon.idle {
        background-color: var(--color-text-muted);
        animation: none;
      }

      .status-icon.starting {
        background-color: var(--color-warning);
      }

      .status-icon.running {
        background-color: var(--color-primary);
      }

      .status-icon.error {
        background-color: var(--color-danger);
        animation: none;
      }

      .status-icon.stopped {
        background-color: var(--color-text-muted);
        animation: none;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 0.7;
        }
        50% {
          opacity: 1;
        }
      }

      .status-details {
        font-size: 0.9em;
        color: var(--color-text-muted);
        margin-left: 20px;
      }

      .continuation-form {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-md);
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }

      .form-label {
        font-weight: 600;
        color: var(--color-text);
        font-size: 0.9em;
      }

      .form-input {
        padding: var(--spacing-sm);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-background);
        color: var(--color-text);
        font-family: var(--font-family-mono);
        font-size: 0.9em;
        transition: all var(--transition-fast);
      }

      .form-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary-alpha);
      }

      .form-input:disabled {
        background-color: var(--color-surface-hover);
        color: var(--color-text-muted);
        cursor: not-allowed;
      }

      .checkbox-group {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) 0;
      }

      .checkbox {
        width: 16px;
        height: 16px;
        accent-color: var(--color-primary);
      }

      .checkbox-label {
        font-size: 0.9em;
        color: var(--color-text);
        cursor: pointer;
        user-select: none;
      }

      .advanced-toggle {
        background: none;
        border: none;
        color: var(--color-primary);
        cursor: pointer;
        font-size: 0.9em;
        text-decoration: underline;
        padding: var(--spacing-xs) 0;
        margin-bottom: var(--spacing-sm);
      }

      .advanced-toggle:hover {
        opacity: 0.8;
      }

      .advanced-options {
        background-color: var(--color-background);
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-md);
        margin-top: var(--spacing-sm);
        border-left: 3px solid var(--color-primary);
      }

      .action-buttons {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-lg);
        flex-wrap: wrap;
      }

      .btn {
        padding: var(--spacing-sm) var(--spacing-md);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
        font-family: var(--font-family-mono);
        font-size: 0.9em;
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .btn:hover:not(:disabled) {
        background-color: var(--color-surface-hover);
        transform: translateY(-1px);
      }

      .btn:disabled {
        background-color: var(--color-surface-hover);
        color: var(--color-text-muted);
        cursor: not-allowed;
        opacity: 0.6;
      }

      .btn.primary {
        background-color: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .btn.primary:hover:not(:disabled) {
        background-color: var(--color-primary);
        opacity: 0.9;
      }

      .btn.secondary {
        background-color: var(--color-secondary);
        color: white;
        border-color: var(--color-secondary);
      }

      .btn.danger {
        background-color: var(--color-danger);
        color: white;
        border-color: var(--color-danger);
      }

      .message {
        padding: var(--spacing-sm);
        border-radius: var(--border-radius-sm);
        margin-bottom: var(--spacing-md);
        font-size: 0.9em;
      }

      .message.success {
        background-color: var(--color-success-bg, #d4edda);
        color: var(--color-success-text, #155724);
        border: 1px solid var(--color-success-border, #c3e6cb);
      }

      .message.error {
        background-color: var(--color-danger-bg, #f8d7da);
        color: var(--color-danger-text, #721c24);
        border: 1px solid var(--color-danger-border, #f5c6cb);
      }

      .claude-url-link {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-xs);
        color: var(--color-primary);
        text-decoration: none;
        font-weight: 600;
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-primary-alpha);
        border: 1px solid var(--color-primary);
        transition: all var(--transition-fast);
      }

      .claude-url-link:hover {
        background-color: var(--color-primary);
        color: white;
        transform: translateY(-1px);
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-xl);
        color: var(--color-text-muted);
        font-style: italic;
        text-align: center;
        background-color: var(--color-surface-hover);
        border-radius: var(--border-radius-sm);
      }

      .empty-state-icon {
        font-size: 2em;
        margin-bottom: var(--spacing-md);
      }

      @media (max-width: 768px) {
        .session-continuation-container {
          padding: var(--spacing-md);
        }

        .session-info-grid {
          grid-template-columns: 1fr;
        }

        .info-item {
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .info-value {
          text-align: left;
        }

        .action-buttons {
          flex-direction: column;
        }

        .btn {
          justify-content: center;
        }
      }
    `,
  ];

  protected override firstUpdated(): void {
    this.initializeWebSocket();
    this.validateForm();

    // Update selected session when session prop changes
    if (this.session) {
      this.continuationState = {
        ...this.continuationState,
        selectedSession: this.session,
      };
      this.continuationOptions = {
        ...this.continuationOptions,
        workingDirectory: this.session.cwd || "",
      };
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanupWebSocket();
  }

  private initializeWebSocket(): void {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      this.websocket = new WebSocket(`${protocol}//${host}/ws`);

      this.websocket.onopen = () => {
        this.websocketConnected = true;
        this.startHeartbeat();
      };

      this.websocket.onclose = () => {
        this.websocketConnected = false;
        this.stopHeartbeat();
      };

      this.websocket.onerror = () => {
        this.websocketConnected = false;
      };

      this.websocket.onmessage = (event) => {
        this.handleWebSocketMessage(JSON.parse(event.data));
      };
    } catch (error) {
      console.error("Failed to initialize WebSocket:", error);
    }
  }

  private cleanupWebSocket(): void {
    this.stopHeartbeat();
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(
          JSON.stringify({
            type: "heartbeat",
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case "claude_process_status":
        this.handleProcessStatusUpdate(message.data);
        break;
      case "claude_process_output":
        this.handleProcessOutput(message.data);
        break;
      case "claude_process_error":
        this.handleProcessError(message.data);
        break;
    }
  }

  private handleProcessStatusUpdate(status: ClaudeProcessStatus): void {
    this.continuationState = {
      ...this.continuationState,
      continuationStatus: status.state,
      processId: status.processId,
    };

    if (status.state === "error" && status.error) {
      this.continuationState.errorMessage = status.error;
    }
  }

  private handleProcessOutput(output: any): void {
    // Handle real-time output from Claude process
    console.log("Claude process output:", output);
  }

  private handleProcessError(error: any): void {
    this.continuationState = {
      ...this.continuationState,
      continuationStatus: "error",
      errorMessage:
        error.message || "An error occurred during session continuation",
    };
  }

  private validateForm(): void {
    const isValid =
      !!this.session && this.continuationState.continuationStatus === "idle";
    this.continuationState = {
      ...this.continuationState,
      isFormValid: isValid,
    };
  }

  private async continueSession(): Promise<void> {
    if (!this.session || !this.continuationState.isFormValid) return;

    this.setLoading(true);
    this.clearMessages();

    try {
      const request: SessionContinuationRequest = {
        sessionId: this.session.id,
        sessionPath: this.session.projectPath,
        workingDirectory:
          this.continuationOptions.workingDirectory || this.session.cwd,
        command: this.continuationOptions.command || undefined,
      };

      const response = await fetch(`${this.apiBaseUrl}/sessions/continue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: SessionContinuationResponse = await response.json();

      if (result.success) {
        this.continuationState = {
          ...this.continuationState,
          continuationStatus: "starting",
          processId: result.processId,
          claudeProcessUrl: result.claudeProcessUrl || null,
          successMessage: result.message,
          errorMessage: null,
        };
      } else {
        throw new Error(result.error || "Session continuation failed");
      }
    } catch (error) {
      this.continuationState = {
        ...this.continuationState,
        continuationStatus: "error",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    } finally {
      this.setLoading(false);
    }
  }

  private clearMessages(): void {
    this.continuationState = {
      ...this.continuationState,
      successMessage: null,
      errorMessage: null,
    };
  }

  private toggleAdvancedOptions(): void {
    this.showAdvancedOptions = !this.showAdvancedOptions;
  }

  private handleWorkingDirectoryChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.continuationOptions = {
      ...this.continuationOptions,
      workingDirectory: input.value,
    };
    this.validateForm();
  }

  private handleCommandChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.continuationOptions = {
      ...this.continuationOptions,
      command: input.value,
    };
  }

  private handlePrepareContextChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.continuationOptions = {
      ...this.continuationOptions,
      prepareContext: checkbox.checked,
    };
  }

  private handleUseExistingClaudeMdChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.continuationOptions = {
      ...this.continuationOptions,
      useExistingClaudeMd: checkbox.checked,
    };
  }

  private renderStatusSection(): TemplateResult {
    const {
      continuationStatus,
      processId,
      claudeProcessUrl,
      errorMessage,
      successMessage,
    } = this.continuationState;

    const statusLabels = {
      idle: "⚪ Ready",
      starting: "🟡 Starting Claude...",
      running: "🟢 Claude Running",
      stopping: "🟡 Stopping...",
      stopped: "⚫ Stopped",
      error: "🔴 Error",
    };

    return html`
      <div class="status-section">
        <div class="status-indicator">
          <div class="status-icon ${continuationStatus}"></div>
          <span>${statusLabels[continuationStatus] || "❓ Unknown"}</span>
        </div>

        ${processId
          ? html` <div class="status-details">Process ID: ${processId}</div> `
          : ""}
        ${claudeProcessUrl
          ? html`
              <div class="status-details">
                <a
                  href="${claudeProcessUrl}"
                  target="_blank"
                  class="claude-url-link"
                >
                  🚀 Open Claude Code
                  <span>↗</span>
                </a>
              </div>
            `
          : ""}
        ${successMessage
          ? html` <div class="message success">${successMessage}</div> `
          : ""}
        ${errorMessage
          ? html` <div class="message error">${errorMessage}</div> `
          : ""}
      </div>
    `;
  }

  private renderSessionInfo(): TemplateResult {
    if (!this.session) return html``;

    const tokenUsage = this.session.totalUsage;
    const totalTokens =
      (tokenUsage.input_tokens || 0) + (tokenUsage.output_tokens || 0);

    return html`
      <div class="session-info">
        <div class="session-info-grid">
          <div class="info-item">
            <span class="info-label">Session ID:</span>
            <span class="info-value">${this.session.id.slice(0, 8)}...</span>
          </div>
          <div class="info-item">
            <span class="info-label">Messages:</span>
            <span class="info-value">${this.session.entries.length}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Working Directory:</span>
            <span class="info-value">${this.session.cwd}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Total Tokens:</span>
            <span class="info-value"
              >${this.formatTokenCount(totalTokens)}</span
            >
          </div>
          <div class="info-item">
            <span class="info-label">Last Activity:</span>
            <span class="info-value"
              >${this.formatRelativeTime(this.session.lastTimestamp)}</span
            >
          </div>
        </div>
      </div>
    `;
  }

  private renderContinuationForm(): TemplateResult {
    const isDisabled =
      this.continuationState.continuationStatus !== "idle" || this.isLoading;

    return html`
      <div class="continuation-form">
        <div class="form-group">
          <label class="form-label" for="working-directory"
            >Working Directory</label
          >
          <input
            id="working-directory"
            type="text"
            class="form-input"
            .value=${this.continuationOptions.workingDirectory || ""}
            @input=${this.handleWorkingDirectoryChange}
            ?disabled=${isDisabled}
            placeholder="Override session working directory (optional)"
          />
        </div>

        <button
          class="advanced-toggle"
          @click=${this.toggleAdvancedOptions}
          type="button"
        >
          ${this.showAdvancedOptions ? "▼" : "▶"} Advanced Options
        </button>

        ${this.showAdvancedOptions
          ? html`
              <div class="advanced-options">
                <div class="form-group">
                  <label class="form-label" for="command">Custom Command</label>
                  <input
                    id="command"
                    type="text"
                    class="form-input"
                    .value=${this.continuationOptions.command || ""}
                    @input=${this.handleCommandChange}
                    ?disabled=${isDisabled}
                    placeholder="Custom Claude Code command (optional)"
                  />
                </div>

                <div class="checkbox-group">
                  <input
                    type="checkbox"
                    id="prepare-context"
                    class="checkbox"
                    .checked=${this.continuationOptions.prepareContext || false}
                    @change=${this.handlePrepareContextChange}
                    ?disabled=${isDisabled}
                  />
                  <label for="prepare-context" class="checkbox-label">
                    Prepare context automatically
                  </label>
                </div>

                <div class="checkbox-group">
                  <input
                    type="checkbox"
                    id="use-existing-claude-md"
                    class="checkbox"
                    .checked=${this.continuationOptions.useExistingClaudeMd ||
                    false}
                    @change=${this.handleUseExistingClaudeMdChange}
                    ?disabled=${isDisabled}
                  />
                  <label for="use-existing-claude-md" class="checkbox-label">
                    Use existing CLAUDE.md file
                  </label>
                </div>
              </div>
            `
          : ""}

        <div class="action-buttons">
          <button
            class="btn primary"
            @click=${this.continueSession}
            ?disabled=${!this.continuationState.isFormValid || isDisabled}
          >
            ${this.isLoading ? "🔄" : "🚀"} Continue Session
          </button>

          ${this.continuationState.continuationStatus === "running"
            ? html`
                <button class="btn danger" @click=${this.stopSession}>
                  🛑 Stop Session
                </button>
              `
            : ""}
        </div>
      </div>
    `;
  }

  private async stopSession(): Promise<void> {
    if (!this.continuationState.processId) return;

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/sessions/stop/${this.continuationState.processId}`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to stop session: ${response.statusText}`);
      }

      this.continuationState = {
        ...this.continuationState,
        continuationStatus: "stopping",
      };
    } catch (error) {
      this.continuationState = {
        ...this.continuationState,
        errorMessage:
          error instanceof Error ? error.message : "Failed to stop session",
      };
    }
  }

  protected override render(): TemplateResult {
    if (!this.session) {
      return html`
        <div class="session-continuation-container">
          <div class="empty-state">
            <div class="empty-state-icon">📂</div>
            <div>No session selected</div>
            <div style="font-size: 0.9em; margin-top: var(--spacing-sm);">
              Select a session to continue working with Claude Code
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="session-continuation-container">
        <div class="header">
          <span class="header-icon">🔄</span>
          <span class="header-title">Continue Session in Claude Code</span>
        </div>

        ${this.renderSessionInfo()} ${this.renderStatusSection()}
        ${this.renderContinuationForm()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "session-continuation": SessionContinuation;
  }
}
