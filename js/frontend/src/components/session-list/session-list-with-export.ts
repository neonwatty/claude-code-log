import { html, css, TemplateResult } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import { ExportDialog } from "../export-dialog/export-dialog.js";
import type { ZodSession } from "@shared";

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

@customElement("session-list-with-export")
export class SessionListWithExport extends BaseComponent {
  @property({ type: Array })
  sessions: ZodSession[] = [];

  @property({ type: Object })
  filter: SessionFilter = {};

  @property({ type: Object })
  sort: SessionSort = { field: "timestamp", direction: "desc" };

  @property({ type: String })
  projectName?: string;

  @state()
  private filteredSessions: ZodSession[] = [];

  @state()
  private selectedSessions: Set<string> = new Set();

  @state()
  private selectedSessionId: string | null = null;

  @state()
  private exportDialogOpen = false;

  @query("export-dialog")
  private exportDialog!: ExportDialog;

  static override styles = [
    BaseComponent.styles,
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
        box-shadow: var(--shadow-card);
        border: 1px solid var(--color-border);
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

      .session-list-controls {
        display: flex;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-md);
        align-items: center;
        flex-wrap: wrap;
        justify-content: space-between;
      }

      .primary-controls {
        display: flex;
        gap: var(--spacing-sm);
        align-items: center;
        flex-wrap: wrap;
      }

      .export-controls {
        display: flex;
        gap: var(--spacing-sm);
        align-items: center;
        flex-wrap: wrap;
      }

      .filter-input {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-bg);
        color: var(--color-text);
        font-family: var(--font-family-mono);
        font-size: 0.9em;
        min-width: 200px;
      }

      .filter-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary-light);
      }

      .sort-select {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-bg);
        color: var(--color-text);
        font-family: var(--font-family-mono);
        font-size: 0.9em;
      }

      .btn {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-bg);
        color: var(--color-text);
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-xs);
        text-decoration: none;
      }

      .btn:hover {
        background-color: var(--color-hover);
        border-color: var(--color-primary);
      }

      .btn-primary {
        background-color: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .btn-primary:hover {
        background-color: var(--color-primary-dark);
        border-color: var(--color-primary-dark);
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn:disabled:hover {
        background-color: var(--color-bg);
        border-color: var(--color-border);
      }

      .select-all-controls {
        font-size: 0.875rem;
        color: var(--color-text-muted);
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .select-all-checkbox {
        cursor: pointer;
      }

      .selection-summary {
        font-size: 0.875rem;
        color: var(--color-text-muted);
        padding: var(--spacing-sm);
        background-color: var(--color-hover);
        border-radius: var(--border-radius-sm);
        margin-bottom: var(--spacing-sm);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .sessions-grid {
        display: grid;
        gap: var(--spacing-sm);
      }

      .session-item {
        padding: var(--spacing-sm) var(--spacing-md);
        background-color: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        transition: all var(--transition-fast);
        cursor: pointer;
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-sm);
      }

      .session-item:hover {
        background-color: var(--color-hover);
        border-color: var(--color-primary);
      }

      .session-item.selected {
        background-color: var(--color-primary-light);
        border-color: var(--color-primary);
      }

      .session-checkbox {
        margin-top: 2px;
        cursor: pointer;
      }

      .session-content {
        flex: 1;
        min-width: 0; /* Allow text truncation */
      }

      .session-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--spacing-xs);
        gap: var(--spacing-sm);
      }

      .session-title {
        font-weight: 600;
        font-size: 0.9em;
        color: var(--color-text);
        word-break: break-word;
        flex: 1;
      }

      .session-actions {
        display: flex;
        gap: var(--spacing-xs);
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .session-item:hover .session-actions {
        opacity: 1;
      }

      .session-action-btn {
        padding: 4px 6px;
        border: none;
        background: none;
        color: var(--color-text-muted);
        cursor: pointer;
        border-radius: 3px;
        font-size: 0.75rem;
        transition: all 0.2s ease;
      }

      .session-action-btn:hover {
        background-color: var(--color-primary-light);
        color: var(--color-primary);
      }

      .session-meta {
        font-size: 0.8em;
        color: var(--color-text-muted);
        margin-bottom: var(--spacing-xs);
        display: flex;
        gap: var(--spacing-sm);
        flex-wrap: wrap;
      }

      .session-preview {
        font-size: 0.75em;
        line-height: 1.3;
        color: var(--color-text-light);
        background-color: var(--color-hover);
        padding: var(--spacing-xs);
        border-radius: var(--border-radius-sm);
        white-space: pre-wrap;
        word-wrap: break-word;
        word-break: break-word;
        max-height: 60px;
        overflow: hidden;
        position: relative;
      }

      .session-preview::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 20px;
        background: linear-gradient(transparent, var(--color-hover));
        pointer-events: none;
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
    `,
  ];

  protected override willUpdate(): void {
    this.filteredSessions = this.filterAndSortSessions();
  }

  protected override render(): TemplateResult {
    const sessionCount = this.filteredSessions.length;
    const totalCount = this.sessions.length;
    const selectedCount = this.selectedSessions.size;

    return html`
      <div class="session-list-container">
        <div class="session-list-header">
          <h2>Sessions</h2>
          <span class="session-count">
            ${sessionCount}${sessionCount !== totalCount
              ? ` of ${totalCount}`
              : ""}
            session${sessionCount === 1 ? "" : "s"}
          </span>
        </div>

        <div class="session-list-controls">
          <div class="primary-controls">
            <input
              type="text"
              class="filter-input"
              placeholder="Search sessions..."
              @input=${this.handleSearchInput}
              .value=${this.filter.searchTerm || ""}
            />
            <select class="sort-select" @change=${this.handleSortChange}>
              <option value="timestamp:desc" ?selected=${this.sort.field === "timestamp" && this.sort.direction === "desc"}>
                Latest First
              </option>
              <option value="timestamp:asc" ?selected=${this.sort.field === "timestamp" && this.sort.direction === "asc"}>
                Oldest First
              </option>
              <option value="messageCount:desc" ?selected=${this.sort.field === "messageCount" && this.sort.direction === "desc"}>
                Most Messages
              </option>
              <option value="messageCount:asc" ?selected=${this.sort.field === "messageCount" && this.sort.direction === "asc"}>
                Fewest Messages
              </option>
              <option value="tokenUsage:desc" ?selected=${this.sort.field === "tokenUsage" && this.sort.direction === "desc"}>
                Most Tokens
              </option>
              <option value="tokenUsage:asc" ?selected=${this.sort.field === "tokenUsage" && this.sort.direction === "asc"}>
                Fewest Tokens
              </option>
            </select>
          </div>

          <div class="export-controls">
            <div class="select-all-controls">
              <label>
                <input
                  type="checkbox"
                  class="select-all-checkbox"
                  .checked=${selectedCount === sessionCount && sessionCount > 0}
                  .indeterminate=${selectedCount > 0 && selectedCount < sessionCount}
                  @change=${this.handleSelectAllChange}
                />
                Select All
              </label>
            </div>

            <button
              class="btn btn-primary"
              @click=${this.openExportDialog}
              .disabled=${selectedCount === 0}
              title=${selectedCount === 0 ? "Select sessions to export" : `Export ${selectedCount} selected session${selectedCount === 1 ? "" : "s"}`}
            >
              📥 Export ${selectedCount > 0 ? `(${selectedCount})` : ""}
            </button>

            ${this.projectName ? html`
              <button
                class="btn"
                @click=${this.exportProject}
                title="Export entire project"
              >
                📦 Export Project
              </button>
            ` : ""}
          </div>
        </div>

        ${selectedCount > 0 ? html`
          <div class="selection-summary">
            <span>
              ${selectedCount} session${selectedCount === 1 ? "" : "s"} selected
            </span>
            <button class="btn" @click=${this.clearSelection}>
              Clear Selection
            </button>
          </div>
        ` : ""}

        <div class="sessions-grid">
          ${this.filteredSessions.length === 0 ? this.renderEmptyState() : this.filteredSessions.map(session => this.renderSessionItem(session))}
        </div>
      </div>

      <export-dialog
        .open=${this.exportDialogOpen}
        .sessionId=${this.selectedSessions.size === 1 ? Array.from(this.selectedSessions)[0] : undefined}
        .sessionIds=${this.selectedSessions.size > 1 ? Array.from(this.selectedSessions) : undefined}
        .projectName=${this.selectedSessions.size === 0 ? this.projectName : undefined}
        @dialog-close=${this.closeExportDialog}
      ></export-dialog>
    `;
  }

  private renderEmptyState(): TemplateResult {
    return html`
      <div class="empty-state">
        ${this.filter.searchTerm ? 
          `No sessions match "${this.filter.searchTerm}"` : 
          "No sessions available"
        }
      </div>
    `;
  }

  private renderSessionItem(session: ZodSession): TemplateResult {
    const isSelected = this.selectedSessions.has(session.id);
    const isCurrentSession = this.selectedSessionId === session.id;

    return html`
      <div
        class="session-item ${isCurrentSession ? 'selected' : ''}"
        @click=${(e: Event) => this.handleSessionClick(e, session)}
      >
        <input
          type="checkbox"
          class="session-checkbox"
          .checked=${isSelected}
          @change=${(e: Event) => this.handleSessionSelectionChange(e, session.id)}
          @click=${(e: Event) => e.stopPropagation()}
        />

        <div class="session-content">
          <div class="session-header">
            <div class="session-title">
              ${session.id}
            </div>
            <div class="session-actions">
              <button
                class="session-action-btn"
                @click=${(e: Event) => this.exportSingleSession(e, session.id)}
                title="Export this session"
              >
                📥
              </button>
              <button
                class="session-action-btn"
                @click=${(e: Event) => this.viewSessionDetails(e, session)}
                title="View session details"
              >
                👁️
              </button>
            </div>
          </div>

          <div class="session-meta">
            <span>📅 ${this.formatDate(session.firstTimestamp)}</span>
            <span>💬 ${session.entries.length} messages</span>
            <span>📍 ${this.formatPath(session.cwd)}</span>
            ${this.formatTokenUsage(session) ? html`
              <span>🎫 ${this.formatTokenUsage(session)}</span>
            ` : ""}
          </div>

          ${this.getSessionPreview(session) ? html`
            <div class="session-preview">
              ${this.getSessionPreview(session)}
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  // Event Handlers
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

  private handleSelectAllChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      this.selectedSessions = new Set(this.filteredSessions.map(s => s.id));
    } else {
      this.selectedSessions = new Set();
    }
    this.requestUpdate();
  }

  private handleSessionSelectionChange(event: Event, sessionId: string): void {
    event.stopPropagation();
    const target = event.target as HTMLInputElement;
    
    if (target.checked) {
      this.selectedSessions.add(sessionId);
    } else {
      this.selectedSessions.delete(sessionId);
    }
    this.selectedSessions = new Set(this.selectedSessions);
    this.requestUpdate();
  }

  private handleSessionClick(event: Event, session: ZodSession): void {
    // Don't select if clicking on checkbox or action buttons
    if ((event.target as HTMLElement).closest('.session-checkbox, .session-actions')) {
      return;
    }

    this.selectedSessionId = session.id;
    this.dispatchEvent(new CustomEvent("session-selected", {
      detail: { session },
      bubbles: true,
    }));
  }

  // Export Actions
  private openExportDialog(): void {
    this.exportDialogOpen = true;
  }

  private closeExportDialog(): void {
    this.exportDialogOpen = false;
  }

  private exportSingleSession(event: Event, sessionId: string): void {
    event.stopPropagation();
    this.selectedSessions = new Set([sessionId]);
    this.openExportDialog();
  }

  private exportProject(): void {
    this.selectedSessions = new Set();
    this.openExportDialog();
  }

  private viewSessionDetails(event: Event, session: ZodSession): void {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent("session-view-details", {
      detail: { session },
      bubbles: true,
    }));
  }

  private clearSelection(): void {
    this.selectedSessions = new Set();
    this.requestUpdate();
  }

  // Utility Methods
  private filterAndSortSessions(): ZodSession[] {
    let filtered = [...this.sessions];

    // Apply filters
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

    // Apply sorting
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

  private formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  private formatPath(cwd: string): string {
    // Show only the last part of the path for brevity
    const parts = cwd.split(/[/\\]/);
    return parts[parts.length - 1] || cwd;
  }

  private formatTokenUsage(session: ZodSession): string {
    const {
      input_tokens = 0,
      output_tokens = 0,
      cache_creation_input_tokens = 0,
      cache_read_input_tokens = 0,
    } = session.totalUsage;
    
    const total = input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens;
    if (total === 0) return "";

    return `${this.formatTokenCount(total)} total`;
  }

  private formatTokenCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }

  private getSessionPreview(session: ZodSession): string {
    // Find first user message for preview
    const firstUserEntry = session.entries.find(
      entry => entry.type === "user"
    );

    if (!firstUserEntry || !("message" in firstUserEntry)) {
      return "";
    }

    const message = firstUserEntry.message;
    if (typeof message.content === "string") {
      return message.content.slice(0, 200);
    } else if (Array.isArray(message.content)) {
      const textContent = message.content
        .filter(item => item.type === "text")
        .map(item => "text" in item ? item.text : "")
        .join(" ");
      return textContent.slice(0, 200);
    }

    return "";
  }

  // Public API
  public getSelectedSessions(): string[] {
    return Array.from(this.selectedSessions);
  }

  public selectAllSessions(): void {
    this.selectedSessions = new Set(this.filteredSessions.map(s => s.id));
    this.requestUpdate();
  }

  public clearAllSelections(): void {
    this.selectedSessions = new Set();
    this.requestUpdate();
  }
}