import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { 
  SessionSummary, 
  SessionFilter, 
  SessionSort, 
  PaginationOptions,
  DisplayMode 
} from '../types/session-types';
import './SessionListItem';

/**
 * Session list component with filtering, sorting, and pagination
 */
@customElement('session-list')
export class SessionList extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        max-width: 100%;
      }

      .session-list-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      .list-header {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        border: 1px solid var(--color-border-light);
      }

      .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-md);
      }

      .list-title {
        margin: 0;
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }

      .session-count {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .view-controls {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .view-toggle {
        display: flex;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .view-toggle button {
        background: var(--color-background);
        border: none;
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        transition: all var(--transition-fast);
        color: var(--color-text-secondary);
      }

      .view-toggle button.active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
      }

      .view-toggle button:hover:not(.active) {
        background: var(--color-background-tertiary);
      }

      .controls-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-md);
        align-items: center;
      }

      .search-box {
        flex: 1;
        min-width: 250px;
        position: relative;
      }

      .search-input {
        width: 100%;
        padding: var(--space-sm) var(--space-md);
        padding-left: calc(var(--space-md) + 20px);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        font-size: var(--font-size-base);
        background: var(--color-background);
        color: var(--color-text-primary);
        transition: border-color var(--transition-fast);
      }

      .search-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: var(--shadow-focus);
      }

      .search-icon {
        position: absolute;
        left: var(--space-sm);
        top: 50%;
        transform: translateY(-50%);
        color: var(--color-text-muted);
        pointer-events: none;
      }

      .clear-search {
        position: absolute;
        right: var(--space-sm);
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-muted);
        padding: var(--space-xs);
        border-radius: var(--border-radius-sm);
        transition: color var(--transition-fast);
      }

      .clear-search:hover {
        color: var(--color-text-primary);
      }

      .filter-controls {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        align-items: center;
      }

      .sort-select {
        padding: var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        background: var(--color-background);
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
        cursor: pointer;
      }

      .sort-select:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: var(--shadow-focus);
      }

      .filter-tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
        margin-top: var(--space-sm);
      }

      .filter-tag {
        background: var(--color-background-tertiary);
        color: var(--color-text-secondary);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius-full);
        font-size: var(--font-size-xs);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .filter-tag button {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0;
        margin-left: var(--space-xs);
      }

      .sessions-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .sessions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: var(--space-md);
      }

      .empty-state {
        text-align: center;
        padding: var(--space-xxl);
        color: var(--color-text-muted);
      }

      .empty-state-icon {
        font-size: 3rem;
        margin-bottom: var(--space-md);
      }

      .empty-state-title {
        font-size: var(--font-size-lg);
        margin-bottom: var(--space-sm);
        color: var(--color-text-secondary);
      }

      .loading-state {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: var(--space-xxl);
        color: var(--color-text-muted);
      }

      .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-lg);
        margin-top: var(--space-lg);
      }

      .pagination-info {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .pagination-controls {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .pagination-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        transition: all var(--transition-fast);
        color: var(--color-text-primary);
      }

      .pagination-button:hover:not(:disabled) {
        background: var(--color-background-secondary);
        border-color: var(--color-primary);
      }

      .pagination-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .pagination-button.current {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      @media (max-width: 768px) {
        .header-row {
          flex-direction: column;
          align-items: stretch;
        }

        .controls-row {
          flex-direction: column;
          align-items: stretch;
        }

        .search-box {
          min-width: auto;
        }

        .filter-controls {
          justify-content: center;
        }

        .sessions-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  /**
   * Array of sessions to display
   */
  @property({ type: Array })
  sessions: SessionSummary[] = [];

  /**
   * Current filter configuration
   */
  @property({ type: Object })
  filter: SessionFilter = {};

  /**
   * Current sort configuration
   */
  @property({ type: Object })
  sort: SessionSort = { field: 'startTime', direction: 'desc' };

  /**
   * Pagination options
   */
  @property({ type: Object })
  pagination: PaginationOptions = {
    page: 0,
    pageSize: 20,
    totalItems: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };

  /**
   * Display mode for sessions
   */
  @property({ type: String })
  displayMode: DisplayMode = 'detailed';

  /**
   * Currently selected session ID
   */
  @property({ type: String })
  selectedSessionId?: string;

  /**
   * List title
   */
  @property({ type: String })
  title = 'Sessions';

  /**
   * Whether to show search functionality
   */
  @property({ type: Boolean })
  searchable = true;

  /**
   * Whether to show filtering controls
   */
  @property({ type: Boolean })
  filterable = true;

  /**
   * Whether to show pagination
   */
  @property({ type: Boolean })
  paginated = true;

  @state()
  private searchQuery = '';

  @state()
  private activeFilters: string[] = [];

  render() {
    const filteredSessions = this.getFilteredSessions();
    const paginatedSessions = this.paginated 
      ? this.getPaginatedSessions(filteredSessions)
      : filteredSessions;

    return html`
      <div class="session-list-container">
        ${this.renderHeader()}
        ${this.loading ? this.renderLoading() : ''}
        ${this.error ? this.renderError() : ''}
        ${!this.loading && !this.error ? this.renderSessionsList(paginatedSessions) : ''}
        ${this.paginated && !this.loading && !this.error ? this.renderPagination(filteredSessions.length) : ''}
      </div>
    `;
  }

  private renderHeader() {
    return html`
      <div class="list-header">
        <div class="header-row">
          <div>
            <h2 class="list-title">${this.title}</h2>
            <div class="session-count">
              ${this.sessions.length} sessions
              ${this.activeFilters.length > 0 ? html`(filtered)` : ''}
            </div>
          </div>
          <div class="view-controls">
            <div class="view-toggle">
              <button 
                class=${classMap({ active: this.displayMode === 'compact' })}
                @click=${() => this.setDisplayMode('compact')}
                title="Compact view"
              >
                ☰
              </button>
              <button 
                class=${classMap({ active: this.displayMode === 'detailed' })}
                @click=${() => this.setDisplayMode('detailed')}
                title="Detailed view"
              >
                📄
              </button>
              <button 
                class=${classMap({ active: this.displayMode === 'minimal' })}
                @click=${() => this.setDisplayMode('minimal')}
                title="Grid view"
              >
                ⊞
              </button>
            </div>
          </div>
        </div>

        ${this.searchable || this.filterable ? html`
          <div class="controls-row">
            ${this.searchable ? this.renderSearch() : ''}
            ${this.filterable ? this.renderFilterControls() : ''}
          </div>
        ` : ''}

        ${this.activeFilters.length > 0 ? this.renderActiveFilters() : ''}
      </div>
    `;
  }

  private renderSearch() {
    return html`
      <div class="search-box">
        <div class="search-icon">🔍</div>
        <input
          class="search-input"
          type="text"
          placeholder="Search sessions..."
          .value=${this.searchQuery}
          @input=${this.handleSearchInput}
          @keydown=${this.handleSearchKeydown}
        />
        ${this.searchQuery ? html`
          <button class="clear-search" @click=${this.clearSearch} title="Clear search">
            ✕
          </button>
        ` : ''}
      </div>
    `;
  }

  private renderFilterControls() {
    return html`
      <div class="filter-controls">
        <select class="sort-select" @change=${this.handleSortChange}>
          <option value="startTime-desc" ?selected=${this.sort.field === 'startTime' && this.sort.direction === 'desc'}>
            Newest first
          </option>
          <option value="startTime-asc" ?selected=${this.sort.field === 'startTime' && this.sort.direction === 'asc'}>
            Oldest first
          </option>
          <option value="messageCount-desc" ?selected=${this.sort.field === 'messageCount' && this.sort.direction === 'desc'}>
            Most messages
          </option>
          <option value="messageCount-asc" ?selected=${this.sort.field === 'messageCount' && this.sort.direction === 'asc'}>
            Least messages
          </option>
          <option value="duration-desc" ?selected=${this.sort.field === 'duration' && this.sort.direction === 'desc'}>
            Longest first
          </option>
          <option value="duration-asc" ?selected=${this.sort.field === 'duration' && this.sort.direction === 'asc'}>
            Shortest first
          </option>
        </select>
      </div>
    `;
  }

  private renderActiveFilters() {
    return html`
      <div class="filter-tags">
        ${this.searchQuery ? html`
          <div class="filter-tag">
            Search: "${this.searchQuery}"
            <button @click=${this.clearSearch}>✕</button>
          </div>
        ` : ''}
        ${this.activeFilters.map(filter => html`
          <div class="filter-tag">
            ${filter}
            <button @click=${() => this.removeFilter(filter)}>✕</button>
          </div>
        `)}
      </div>
    `;
  }

  private renderSessionsList(sessions: SessionSummary[]) {
    if (sessions.length === 0) {
      return this.renderEmptyState();
    }

    const containerClass = this.displayMode === 'minimal' ? 'sessions-grid' : 'sessions-list';

    return html`
      <div class="${containerClass}">
        ${repeat(
          sessions,
          (session) => session.sessionId,
          (session) => html`
            <session-list-item
              .session=${session}
              ?selected=${session.sessionId === this.selectedSessionId}
              ?compact=${this.displayMode === 'compact'}
              ?detailed=${this.displayMode === 'detailed'}
              @session-selected=${this.handleSessionSelected}
            ></session-list-item>
          `
        )}
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-title">
          ${this.searchQuery || this.activeFilters.length > 0 ? 'No matching sessions' : 'No sessions found'}
        </div>
        <div>
          ${this.searchQuery || this.activeFilters.length > 0
            ? 'Try adjusting your search or filters'
            : 'Sessions will appear here once you start using Claude Code'}
        </div>
      </div>
    `;
  }

  private renderLoading() {
    return html`
      <div class="loading-state">
        <div>Loading sessions...</div>
      </div>
    `;
  }

  private renderError() {
    return html`
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <div class="empty-state-title">Error loading sessions</div>
        <div>${this.error}</div>
      </div>
    `;
  }

  private renderPagination(totalItems: number) {
    if (totalItems <= this.pagination.pageSize) return '';

    const totalPages = Math.ceil(totalItems / this.pagination.pageSize);
    const currentPage = this.pagination.page + 1;
    const startItem = this.pagination.page * this.pagination.pageSize + 1;
    const endItem = Math.min(startItem + this.pagination.pageSize - 1, totalItems);

    return html`
      <div class="pagination">
        <div class="pagination-info">
          ${startItem}-${endItem} of ${totalItems}
        </div>
        <div class="pagination-controls">
          <button
            class="pagination-button"
            ?disabled=${!this.pagination.hasPrevPage}
            @click=${this.handlePreviousPage}
          >
            ← Previous
          </button>
          
          ${this.renderPageNumbers(totalPages, currentPage)}
          
          <button
            class="pagination-button"
            ?disabled=${!this.pagination.hasNextPage}
            @click=${this.handleNextPage}
          >
            Next →
          </button>
        </div>
      </div>
    `;
  }

  private renderPageNumbers(totalPages: number, currentPage: number) {
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    // Adjust start if we're near the end
    startPage = Math.max(1, endPage - maxVisible + 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(html`
        <button
          class="pagination-button ${i === currentPage ? 'current' : ''}"
          @click=${() => this.handlePageClick(i - 1)}
        >
          ${i}
        </button>
      `);
    }

    return pages;
  }

  private getFilteredSessions(): SessionSummary[] {
    let filtered = [...this.sessions];

    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(session =>
        session.title?.toLowerCase().includes(query) ||
        session.sessionId.toLowerCase().includes(query) ||
        session.cwd.toLowerCase().includes(query) ||
        session.summary?.toLowerCase().includes(query) ||
        session.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply additional filters from this.filter
    if (this.filter.tags && this.filter.tags.length > 0) {
      filtered = filtered.filter(session =>
        session.tags?.some(tag => this.filter.tags!.includes(tag))
      );
    }

    if (this.filter.cwd) {
      filtered = filtered.filter(session =>
        session.cwd.includes(this.filter.cwd!)
      );
    }

    if (this.filter.activeOnly) {
      filtered = filtered.filter(session => session.isActive);
    }

    if (this.filter.dateRange) {
      filtered = filtered.filter(session => {
        const sessionDate = session.startTime;
        return sessionDate >= this.filter.dateRange!.start && 
               sessionDate <= this.filter.dateRange!.end;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (this.sort.field) {
        case 'startTime':
          aValue = a.startTime.getTime();
          bValue = b.startTime.getTime();
          break;
        case 'endTime':
          aValue = a.endTime?.getTime() || 0;
          bValue = b.endTime?.getTime() || 0;
          break;
        case 'messageCount':
          aValue = a.messageCount;
          bValue = b.messageCount;
          break;
        case 'duration':
          aValue = a.duration || 0;
          bValue = b.duration || 0;
          break;
        case 'title':
          aValue = a.title || a.sessionId;
          bValue = b.title || b.sessionId;
          break;
        default:
          aValue = a.startTime.getTime();
          bValue = b.startTime.getTime();
      }

      if (this.sort.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }

  private getPaginatedSessions(sessions: SessionSummary[]): SessionSummary[] {
    const start = this.pagination.page * this.pagination.pageSize;
    const end = start + this.pagination.pageSize;
    return sessions.slice(start, end);
  }

  private handleSearchInput = this.debounce((event: Event) => {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value;
    this.emitFilterChange();
  }, 300);

  private handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.clearSearch();
    }
  }

  private clearSearch() {
    this.searchQuery = '';
    this.emitFilterChange();
  }

  private handleSortChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const [field, direction] = select.value.split('-') as [SessionSort['field'], 'asc' | 'desc'];
    
    this.sort = { field, direction };
    this.emitSortChange();
  }

  private setDisplayMode(mode: DisplayMode) {
    this.displayMode = mode;
  }

  private handleSessionSelected(event: CustomEvent) {
    this.selectedSessionId = event.detail.sessionId;
    this.emitEvent('session-selected', event.detail);
  }

  private removeFilter(filter: string) {
    this.activeFilters = this.activeFilters.filter(f => f !== filter);
    this.emitFilterChange();
  }

  private handlePreviousPage() {
    if (this.pagination.hasPrevPage) {
      this.emitPageChange(this.pagination.page - 1);
    }
  }

  private handleNextPage() {
    if (this.pagination.hasNextPage) {
      this.emitPageChange(this.pagination.page + 1);
    }
  }

  private handlePageClick(page: number) {
    this.emitPageChange(page);
  }

  private emitFilterChange() {
    const filter: SessionFilter = {
      ...this.filter,
      query: this.searchQuery || undefined,
    };
    this.emitEvent('filter-changed', { filter });
  }

  private emitSortChange() {
    this.emitEvent('sort-changed', { sort: this.sort });
  }

  private emitPageChange(page: number) {
    this.emitEvent('page-changed', { 
      page, 
      pageSize: this.pagination.pageSize 
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-list': SessionList;
  }
}