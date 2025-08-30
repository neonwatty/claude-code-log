import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import { sessionListStyles } from "../../styles/components/index.js";
import type { ZodSession } from "../../../../shared/src/schemas/index.js";
import "../session-card/session-card.js";
import type { SessionData } from "../session-card/session-card.js";

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

@customElement("session-list")
export class SessionList extends BaseComponent {
  @property({ type: Array })
  sessions: ZodSession[] = [];

  @property({ type: Object })
  filter: SessionFilter = {};

  @property({ type: Object })
  sort: SessionSort = { field: "timestamp", direction: "desc" };

  @state()
  private filteredSessions: ZodSession[] = [];

  @state()
  private selectedSessionId: string | null = null;

  static override styles = [
    ...BaseComponent.styles,
    sessionListStyles,
    css`
      :host {
        display: block;
        font-family: var(--font-family-mono);
      }

      .session-list-navigation {
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

      .session-list-navigation h2 {
        margin: 0 0 var(--spacing-sm) 0;
        font-size: 1.2em;
        color: var(--color-text);
      }

      .session-filter-controls {
        display: flex;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-md);
        align-items: center;
        flex-wrap: wrap;
      }

      .session-search-input {
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

      .session-sort-select {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text);
        font-family: var(--font-family-mono);
        font-size: 0.9em;
      }

      .session-nav {
        display: grid;
        gap: var(--spacing-lg);
        margin-top: var(--spacing-lg);
      }

      .session-link {
        padding: var(--spacing-sm) var(--spacing-md);
        background-color: var(--color-surface);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        text-decoration: none;
        color: var(--color-text);
        transition: all var(--transition-fast);
        cursor: pointer;
        display: block;
      }

      .session-link:hover {
        background-color: var(--color-surface-hover);
        transform: translateY(-1px);
        box-shadow:
          -3px -3px 5px var(--color-shadow-light),
          3px 3px 5px var(--color-shadow-dark);
      }

      .session-link.selected {
        background-color: var(--color-surface-active);
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary) 33;
      }

      .session-link-title {
        font-weight: 600;
        font-size: 0.9em;
        margin-bottom: var(--spacing-xs);
        word-break: break-word;
      }

      .session-link-meta {
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

      .session-preview::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 20px;
        background: linear-gradient(transparent, var(--color-surface-hover));
        pointer-events: none;
      }

      .session-list-empty {
        text-align: center;
        padding: var(--spacing-xl);
        color: var(--color-text-muted);
        font-style: italic;
      }

      .session-count-indicator {
        font-size: 0.85em;
        color: var(--color-text-muted);
      }
    `,
  ];

  protected override willUpdate(): void {
    this.filteredSessions = this.filterAndSortSessions();
  }

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

  private handleSessionClick(session: ZodSession): void {
    this.selectedSessionId = session.id;
    this.emitEvent("session-selected", { sessionId: session.id, session });
  }

  private handleSessionCardSelected(event: CustomEvent): void {
    const { sessionId } = event.detail;
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      this.handleSessionClick(session);
    }
  }

  private handlePreviewExpand(event: CustomEvent): void {
    // Handle preview expansion - could show in modal or expand inline
    const { sessionId, fullPreview } = event.detail;
    console.log('Preview expand requested for session:', sessionId, fullPreview);
    
    // For now, just emit an event that parent can handle
    this.emitEvent("preview-expand-requested", event.detail);
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
    // Find first user message for preview
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

  private convertToSessionData(session: ZodSession): SessionData {
    return {
      id: session.id || 'unknown',
      name: session.summary,
      startTime: session.firstTimestamp,
      endTime: session.lastTimestamp,
      messageCount: session.entries.length,
      tokenUsage: {
        input: session.totalUsage.input_tokens || 0,
        output: session.totalUsage.output_tokens || 0,
        cacheCreation: session.totalUsage.cache_creation_input_tokens,
        cacheRead: session.totalUsage.cache_read_input_tokens
      },
      preview: this.getSessionPreview(session),
      workingDirectory: session.cwd
    };
  }

  private renderSessionItem(session: ZodSession): TemplateResult {
    const isSelected = this.selectedSessionId === session.id;
    const sessionData = this.convertToSessionData(session);

    return html`
      <session-card
        .session=${sessionData}
        .isSelected=${isSelected}
        .searchTerm=${this.filter.searchTerm || ''}
        @session-selected=${this.handleSessionCardSelected}
        @preview-expand-requested=${this.handlePreviewExpand}
      ></session-card>
    `;
  }

  protected safeRender(): TemplateResult {
    const sessionCount = this.filteredSessions.length;
    const totalCount = this.sessions.length;

    return html`
      <div class="session-list-navigation">
        <div class="session-list-header">
          <h2>Sessions</h2>
          <span class="session-count-indicator">
            ${sessionCount}${sessionCount !== totalCount
              ? ` of ${totalCount}`
              : ""}
            session${sessionCount === 1 ? "" : "s"}
          </span>
        </div>

        <div class="session-filter-controls">
          <input
            type="text"
            class="session-search-input"
            placeholder="Search sessions..."
            @input=${this.handleSearchInput}
            .value=${this.filter.searchTerm || ""}
          />
          <select class="session-sort-select" @change=${this.handleSortChange}>
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

        <div class="session-nav">
          ${this.filteredSessions.length > 0
            ? this.filteredSessions.map((session) =>
                this.renderSessionItem(session),
              )
            : html`<div class="session-list-empty">No sessions found</div>`}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "session-list": SessionList;
  }
}
