import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import type { ZodSession } from "../../../../shared/src/schemas/index.js";
import "../session-card/session-card.js";
import type { SessionFilter, SessionSort } from "./session-list.js";
import type { SessionData } from "../session-card/session-card.js";

export interface PaginationConfig {
  pageSize: number;
  currentPage: number;
  totalItems: number;
  totalPages: number;
}

@customElement("paginated-session-list")
export class PaginatedSessionList extends BaseComponent {
  @property({ type: Array })
  sessions: ZodSession[] = [];

  @property({ type: Object })
  filter: SessionFilter = {};

  @property({ type: Object })
  sort: SessionSort = { field: "timestamp", direction: "desc" };

  @property({ type: Number, attribute: "page-size" })
  pageSize = 20;

  @state()
  private filteredSessions: ZodSession[] = [];

  @state()
  private paginatedSessions: ZodSession[] = [];

  @state()
  private pagination: PaginationConfig = {
    pageSize: 20,
    currentPage: 1,
    totalItems: 0,
    totalPages: 1
  };

  @state()
  private selectedSessionId: string | null = null;

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        font-family: var(--font-family-mono);
      }

      .paginated-list-container {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .list-header {
        background-color: var(--color-surface);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
        box-shadow: var(--shadow-neumorphic);
        border: 1px solid var(--color-border-light);
      }

      .list-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0 0 var(--spacing-md) 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .session-count {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        font-weight: var(--font-weight-normal);
      }

      .filter-controls {
        display: flex;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-md);
        align-items: center;
        flex-wrap: wrap;
      }

      .search-input {
        flex: 1;
        min-width: 200px;
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text);
        font-family: var(--font-family-mono);
        font-size: var(--font-size-sm);
      }

      .search-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary-light);
      }

      .sort-select {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text);
        font-family: var(--font-family-mono);
        font-size: var(--font-size-sm);
      }

      .page-size-select {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text);
        font-family: var(--font-family-mono);
        font-size: var(--font-size-sm);
        min-width: 80px;
      }

      .sessions-content {
        flex: 1;
        overflow: auto;
        display: flex;
        flex-direction: column;
      }

      .sessions-grid {
        display: grid;
        gap: var(--spacing-lg);
        margin-bottom: var(--spacing-lg);
        flex: 1;
      }

      .pagination-container {
        background-color: var(--color-surface);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-md);
        box-shadow: var(--shadow-neumorphic);
        border: 1px solid var(--color-border-light);
        margin-top: auto;
      }

      .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: var(--spacing-sm);
        flex-wrap: wrap;
      }

      .pagination-info {
        display: flex;
        align-items: center;
        gap: var(--spacing-lg);
        margin-bottom: var(--spacing-sm);
        justify-content: space-between;
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
      }

      .pagination-button {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        min-width: 36px;
        height: 36px;
        justify-content: center;
      }

      .pagination-button:hover:not(:disabled) {
        background-color: var(--color-surface-hover);
        transform: var(--transform-hover);
      }

      .pagination-button:disabled {
        opacity: var(--opacity-disabled);
        cursor: not-allowed;
      }

      .pagination-button.active {
        background-color: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .pagination-ellipsis {
        padding: var(--spacing-xs) var(--spacing-sm);
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
      }

      .empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: var(--spacing-xxl);
        color: var(--color-text-muted);
      }

      .empty-icon {
        font-size: 4em;
        margin-bottom: var(--spacing-lg);
        opacity: 0.5;
      }

      .empty-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        margin: 0 0 var(--spacing-sm) 0;
      }

      .empty-description {
        font-size: var(--font-size-md);
        margin: 0;
        max-width: 400px;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .filter-controls {
          flex-direction: column;
          align-items: stretch;
        }

        .search-input {
          min-width: unset;
        }

        .pagination {
          flex-wrap: wrap;
          gap: var(--spacing-xs);
        }

        .pagination-info {
          flex-direction: column;
          gap: var(--spacing-sm);
          text-align: center;
        }
      }

      @media (max-width: 480px) {
        .list-title {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-xs);
        }

        .pagination-button {
          min-width: 32px;
          height: 32px;
          font-size: var(--font-size-xs);
        }
      }
    `
  ];

  protected override willUpdate(): void {
    this.updateFilteredSessions();
    this.updatePagination();
    this.updatePaginatedSessions();
  }

  private updateFilteredSessions(): void {
    let filtered = [...this.sessions];

    // Apply search filter
    if (this.filter.searchTerm) {
      const searchLower = this.filter.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (session) =>
          session.id.toLowerCase().includes(searchLower) ||
          session.summary?.toLowerCase().includes(searchLower) ||
          session.cwd.toLowerCase().includes(searchLower),
      );
    }

    // Apply date filters
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

    this.filteredSessions = filtered;
  }

  private updatePagination(): void {
    const totalItems = this.filteredSessions.length;
    const totalPages = Math.ceil(totalItems / this.pageSize) || 1;
    const currentPage = Math.min(this.pagination.currentPage, totalPages);

    this.pagination = {
      pageSize: this.pageSize,
      currentPage,
      totalItems,
      totalPages
    };
  }

  private updatePaginatedSessions(): void {
    const startIndex = (this.pagination.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedSessions = this.filteredSessions.slice(startIndex, endIndex);
  }

  private handleSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filter = { ...this.filter, searchTerm: target.value };
    this.pagination = { ...this.pagination, currentPage: 1 }; // Reset to first page
  }

  private handleSortChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const [field, direction] = target.value.split(":");
    this.sort = {
      field: field as SessionSort["field"],
      direction: direction as SessionSort["direction"],
    };
    this.pagination = { ...this.pagination, currentPage: 1 }; // Reset to first page
  }

  private handlePageSizeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.pageSize = parseInt(target.value);
    this.pagination = { ...this.pagination, currentPage: 1 }; // Reset to first page
  }

  private handlePageChange(page: number): void {
    if (page >= 1 && page <= this.pagination.totalPages) {
      this.pagination = { ...this.pagination, currentPage: page };
    }
  }

  private handleSessionClick(session: ZodSession): void {
    this.selectedSessionId = session.id;
    this.emitEvent("session-selected", { sessionId: session.id, session });
  }

  private handleSessionCardSelected(event: CustomEvent): void {
    const { sessionId } = event.detail;
    const session = this.paginatedSessions.find(s => s.id === sessionId);
    if (session) {
      this.handleSessionClick(session);
    }
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

  private getSessionPreview(session: ZodSession): string {
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

  private renderPagination(): TemplateResult {
    const { currentPage, totalPages, totalItems } = this.pagination;
    const startItem = (currentPage - 1) * this.pageSize + 1;
    const endItem = Math.min(currentPage * this.pageSize, totalItems);

    // Generate page numbers with ellipsis
    const pageNumbers: (number | string)[] = [];
    const showEllipsis = totalPages > 7;

    if (showEllipsis) {
      // Always show first page
      pageNumbers.push(1);
      
      // Add ellipsis after first if needed
      if (currentPage > 4) {
        pageNumbers.push('...');
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== totalPages) {
          pageNumbers.push(i);
        }
      }
      
      // Add ellipsis before last if needed
      if (currentPage < totalPages - 3) {
        pageNumbers.push('...');
      }
      
      // Always show last page if more than one page
      if (totalPages > 1) {
        pageNumbers.push(totalPages);
      }
    } else {
      // Show all pages if few enough
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    }

    return html`
      <div class="pagination-container">
        <div class="pagination-info">
          <span>Showing ${startItem}-${endItem} of ${totalItems} sessions</span>
          <span>Page ${currentPage} of ${totalPages}</span>
        </div>
        
        <div class="pagination">
          <button
            class="pagination-button"
            ?disabled=${currentPage === 1}
            @click=${() => this.handlePageChange(1)}
            title="First page"
          >
            ⏮
          </button>
          
          <button
            class="pagination-button"
            ?disabled=${currentPage === 1}
            @click=${() => this.handlePageChange(currentPage - 1)}
            title="Previous page"
          >
            ◀
          </button>

          ${pageNumbers.map(page => 
            typeof page === 'string' ? html`
              <span class="pagination-ellipsis">${page}</span>
            ` : html`
              <button
                class="pagination-button ${currentPage === page ? 'active' : ''}"
                @click=${() => this.handlePageChange(page)}
                title="Go to page ${page}"
              >
                ${page}
              </button>
            `
          )}

          <button
            class="pagination-button"
            ?disabled=${currentPage === totalPages}
            @click=${() => this.handlePageChange(currentPage + 1)}
            title="Next page"
          >
            ▶
          </button>
          
          <button
            class="pagination-button"
            ?disabled=${currentPage === totalPages}
            @click=${() => this.handlePageChange(totalPages)}
            title="Last page"
          >
            ⏭
          </button>
        </div>
      </div>
    `;
  }

  protected safeRender(): TemplateResult {
    return html`
      <div class="paginated-list-container">
        <div class="list-header">
          <h2 class="list-title">
            Sessions
            <span class="session-count">
              ${this.pagination.totalItems} session${this.pagination.totalItems === 1 ? '' : 's'}
            </span>
          </h2>

          <div class="filter-controls">
            <input
              type="text"
              class="search-input"
              placeholder="Search sessions..."
              @input=${this.handleSearchInput}
              .value=${this.filter.searchTerm || ""}
            />
            
            <select class="sort-select" @change=${this.handleSortChange}>
              <option
                value="timestamp:desc"
                ?selected=${this.sort.field === "timestamp" && this.sort.direction === "desc"}
              >
                Latest First
              </option>
              <option
                value="timestamp:asc"
                ?selected=${this.sort.field === "timestamp" && this.sort.direction === "asc"}
              >
                Oldest First
              </option>
              <option
                value="messageCount:desc"
                ?selected=${this.sort.field === "messageCount" && this.sort.direction === "desc"}
              >
                Most Messages
              </option>
              <option
                value="tokenUsage:desc"
                ?selected=${this.sort.field === "tokenUsage" && this.sort.direction === "desc"}
              >
                Most Tokens
              </option>
            </select>

            <select class="page-size-select" @change=${this.handlePageSizeChange} .value=${this.pageSize.toString()}>
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>
        </div>

        <div class="sessions-content">
          ${this.paginatedSessions.length > 0 ? html`
            <div class="sessions-grid">
              ${this.paginatedSessions.map((session) => {
                const sessionData = this.convertToSessionData(session);
                return html`
                  <session-card
                    .session=${sessionData}
                    .isSelected=${this.selectedSessionId === session.id}
                    .searchTerm=${this.filter.searchTerm || ''}
                    @session-selected=${this.handleSessionCardSelected}
                  ></session-card>
                `;
              })}
            </div>
          ` : html`
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <h3 class="empty-title">No Sessions Found</h3>
              <p class="empty-description">
                ${this.filter.searchTerm 
                  ? `No sessions match "${this.filter.searchTerm}". Try adjusting your search terms.`
                  : 'No sessions have been loaded yet. Sessions will appear here when available.'
                }
              </p>
            </div>
          `}
        </div>

        ${this.pagination.totalItems > this.pageSize ? this.renderPagination() : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paginated-session-list": PaginatedSessionList;
  }
}