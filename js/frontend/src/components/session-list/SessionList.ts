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
import { AriaRoles, AriaAttributes, KeyboardKeys, ListNavigation, FocusManager, announce, A11yConfig, generateId } from '../utils/accessibility';
import { useFocusManagement, skipLinkManager } from '../utils/focus-management';
import { useVirtualScroll, createVirtualScrollConfig } from '../utils/virtual-scroll';
import { useLazyLoading, createLazyLoadingConfig } from '../utils/lazy-loading';

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

      .sessions-list.virtual {
        overflow-y: auto;
        position: relative;
      }

      .virtual-spacer {
        pointer-events: none;
        user-select: none;
      }

      .sessions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: var(--space-md);
      }

      .session-item-container {
        min-height: 120px; /* Match virtual scroll item height */
        transition: opacity var(--transition-fast);
      }

      .session-item-container.loading {
        opacity: 0.6;
      }

      .loading-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 120px;
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
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

      /* Screen reader only content */
      .sr-only {
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }

      /* Focus management */
      .session-list-container:focus-within {
        outline: none;
      }

      /* List navigation indicators */
      .sessions-list[aria-activedescendant] {
        outline: 2px solid var(--color-border-focus);
        outline-offset: 2px;
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

      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
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

  /**
   * Whether to enable virtual scrolling for performance
   */
  @property({ type: Boolean })
  virtualScrolling = false;

  /**
   * Whether to enable lazy loading
   */
  @property({ type: Boolean })
  lazyLoading = false;

  @state()
  private searchQuery = '';

  @state()
  private activeFilters: string[] = [];

  @state()
  private focusedItemIndex = -1;

  @state()
  private listId = generateId('session-list');

  @state()
  private searchId = generateId('search');

  @state()
  private sortId = generateId('sort');

  @state()
  private statusId = generateId('status');

  private focusManager = useFocusManagement('session-list', this, 1);

  private virtualScroll = useVirtualScroll(this, createVirtualScrollConfig({
    itemHeight: 120, // Estimated session item height
    overscan: 3,
    containerHeight: 600,
  }));

  private lazyLoader = useLazyLoading(this, createLazyLoadingConfig({
    strategy: 'intersection',
    batchSize: 5,
    loadDelay: 50,
  }));

  render() {
    const filteredSessions = this.getFilteredSessions();
    const sessionsToRender = this.virtualScrolling 
      ? filteredSessions // Virtual scrolling handles its own pagination
      : (this.paginated ? this.getPaginatedSessions(filteredSessions) : filteredSessions);

    return html`
      <div 
        class="session-list-container"
        role="${AriaRoles.REGION}"
        aria-label="Session list"
        @keydown=${this.handleContainerKeydown}
      >
        ${this.renderHeader()}
        
        <!-- Status region for screen readers -->
        <div 
          id="${this.statusId}"
          role="${AriaRoles.STATUS}"
          aria-live="polite"
          aria-atomic="true"
          style="position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;"
        >
          ${this.getStatusMessage(filteredSessions.length)}
        </div>

        ${this.loading ? this.renderLoading() : ''}
        ${this.error ? this.renderError() : ''}
        ${!this.loading && !this.error ? this.renderSessionsList(sessionsToRender, filteredSessions) : ''}
        ${this.paginated && !this.virtualScrolling && !this.loading && !this.error ? this.renderPagination(filteredSessions.length) : ''}
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
      <div class="search-box" role="search">
        <div class="search-icon" aria-hidden="true">🔍</div>
        <input
          id="${this.searchId}"
          class="search-input"
          type="search"
          role="${AriaRoles.SEARCHBOX}"
          placeholder="Search sessions..."
          aria-label="Search through sessions"
          aria-describedby="${this.statusId}"
          autocomplete="off"
          spellcheck="false"
          .value=${this.searchQuery}
          @input=${this.handleSearchInput}
          @keydown=${this.handleSearchKeydown}
        />
        ${this.searchQuery ? html`
          <button 
            class="clear-search" 
            @click=${this.clearSearch} 
            aria-label="${A11yConfig.LABELS.CLOSE} search"
            title="Clear search"
            type="button"
          >
            ✕
          </button>
        ` : ''}
      </div>
    `;
  }

  private renderFilterControls() {
    return html`
      <div class="filter-controls">
        <label for="${this.sortId}" class="sr-only">Sort sessions</label>
        <select 
          id="${this.sortId}"
          class="sort-select" 
          aria-label="${A11yConfig.LABELS.SORT} sessions"
          aria-describedby="${this.statusId}"
          @change=${this.handleSortChange}
        >
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

  private renderSessionsList(sessions: SessionSummary[], allSessions?: SessionSummary[]) {
    if (sessions.length === 0) {
      return this.renderEmptyState();
    }

    const containerClass = this.displayMode === 'minimal' ? 'sessions-grid' : 'sessions-list';
    const isVirtual = this.virtualScrolling && sessions.length > 20; // Enable virtual scrolling for large lists

    if (isVirtual) {
      return this.renderVirtualizedSessionsList(sessions, containerClass);
    }

    return this.renderRegularSessionsList(sessions, containerClass);
  }

  private renderVirtualizedSessionsList(sessions: SessionSummary[], containerClass: string) {
    // Setup virtual scrolling
    this.virtualScroll.setItems(sessions, (session) => session.sessionId);
    const virtualContent = this.virtualScroll.renderVirtualizedList(
      (virtualItem) => this.renderSessionItem(virtualItem.data, virtualItem.index, sessions.length)
    );

    return html`
      <div 
        id="${this.listId}"
        class="${containerClass} virtual"
        role="${AriaRoles.LIST}"
        aria-label="${sessions.length} session${sessions.length !== 1 ? 's' : ''} (virtual scrolling enabled)"
        aria-describedby="${this.statusId}"
        style="${virtualContent.containerStyle}"
        @keydown=${this.handleListKeydown}
        @focus=${this.handleListFocus}
        @blur=${this.handleListBlur}
      >
        ${virtualContent.beforeSpacer}
        ${virtualContent.items}
        ${virtualContent.afterSpacer}
      </div>
    `;
  }

  private renderRegularSessionsList(sessions: SessionSummary[], containerClass: string) {
    return html`
      <div 
        id="${this.listId}"
        class="${containerClass}"
        role="${AriaRoles.LIST}"
        aria-label="${sessions.length} session${sessions.length !== 1 ? 's' : ''}"
        aria-describedby="${this.statusId}"
        @keydown=${this.handleListKeydown}
        @focus=${this.handleListFocus}
        @blur=${this.handleListBlur}
      >
        ${repeat(
          sessions,
          (session) => session.sessionId,
          (session, index) => this.renderSessionItem(session, index, sessions.length)
        )}
      </div>
    `;
  }

  private renderSessionItem(session: SessionSummary, index: number, totalCount: number) {
    const sessionId = session.sessionId;
    const isLoading = this.lazyLoading && this.lazyLoader.getItem(sessionId)?.state === 'loading';
    const hasError = this.lazyLoading && this.lazyLoader.getItem(sessionId)?.state === 'error';

    if (this.lazyLoading) {
      // Add to lazy loader if not already added
      const existingItem = this.lazyLoader.getItem(sessionId);
      if (!existingItem) {
        this.lazyLoader.addItem(sessionId, session, {
          priority: session.isActive ? 1 : 0,
          loader: () => this.loadSessionData(session),
        });
      }
    }

    return html`
      <div 
        class="session-item-container ${isLoading ? 'loading' : ''}"
        data-session-id="${sessionId}"
      >
        ${hasError ? html`
          <div class="loading-indicator">
            <span>Failed to load session</span>
            <button @click=${() => this.lazyLoader.loadItem(sessionId)}>Retry</button>
          </div>
        ` : isLoading ? html`
          <div class="loading-indicator">Loading session...</div>
        ` : html`
          <session-list-item
            .session=${session}
            ?selected=${session.sessionId === this.selectedSessionId}
            ?compact=${this.displayMode === 'compact'}
            ?detailed=${this.displayMode === 'detailed'}
            aria-posinset="${index + 1}"
            aria-setsize="${totalCount}"
            role="${AriaRoles.LISTITEM}"
            @session-selected=${this.handleSessionSelected}
            @focus=${() => this.handleItemFocus(index)}
          ></session-list-item>
        `}
      </div>
    `;
  }

  private async loadSessionData(session: SessionSummary): Promise<void> {
    // Simulate loading session data (replace with actual data loading)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
    
    // Emit event for successful loading
    this.emitEvent('session-loaded', { sessionId: session.sessionId });
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
    const pages: any[] = [];
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

  // Accessibility methods

  private getStatusMessage(sessionCount: number): string {
    if (this.loading) return A11yConfig.LABELS.LOADING;
    if (this.error) return `${A11yConfig.LABELS.ERROR}: ${this.error}`;
    
    let message = `${sessionCount} session${sessionCount !== 1 ? 's' : ''}`;
    
    if (this.searchQuery) {
      message += ` matching "${this.searchQuery}"`;
    }
    
    if (this.activeFilters.length > 0) {
      message += ` with filters applied`;
    }
    
    return message;
  }

  private handleContainerKeydown(event: KeyboardEvent) {
    // Handle container-level keyboard shortcuts
    switch (event.key) {
      case KeyboardKeys.ESCAPE:
        // Clear search or filters
        if (this.searchQuery) {
          this.clearSearch();
          event.preventDefault();
        }
        break;
        
      case 'f':
      case 'F':
        // Focus search when Ctrl+F or just F is pressed
        if (event.ctrlKey || event.metaKey) {
          const searchInput = this.shadowRoot?.querySelector('#' + this.searchId) as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
            event.preventDefault();
          }
        }
        break;
    }
  }

  private handleListKeydown(event: KeyboardEvent) {
    const sessions = this.paginated 
      ? this.getPaginatedSessions(this.getFilteredSessions())
      : this.getFilteredSessions();
      
    if (sessions.length === 0) return;

    const listElement = this.shadowRoot?.getElementById(this.listId);
    if (!listElement) return;

    const currentFocused = this.shadowRoot?.activeElement as HTMLElement;
    
    // Use our ListNavigation utility for arrow key handling
    if (ListNavigation.handleArrowKeys(event, listElement, currentFocused, {
      vertical: true,
      horizontal: false,
      wrap: true,
      home: true,
      end: true
    })) {
      return; // Event was handled
    }

    // Handle other navigation keys
    switch (event.key) {
      case KeyboardKeys.ENTER:
      case KeyboardKeys.SPACE:
        // Activate the focused item
        if (this.focusedItemIndex >= 0 && this.focusedItemIndex < sessions.length) {
          const session = sessions[this.focusedItemIndex];
          this.handleSessionSelected(new CustomEvent('session-selected', {
            detail: { sessionId: session.sessionId }
          }));
          event.preventDefault();
        }
        break;
        
      case KeyboardKeys.TAB:
        // Allow tab to move focus out of the list
        break;
        
      default:
        // Handle type-ahead search
        this.handleTypeAhead(event.key);
        break;
    }
  }

  private handleListFocus(event: FocusEvent) {
    // When list gains focus, ensure we have a focused item
    if (this.focusedItemIndex === -1) {
      this.focusedItemIndex = 0;
      this.updateActivedescendant();
    }
  }

  private handleListBlur(event: FocusEvent) {
    // Optional: Clear focus indicators when list loses focus
    // this.focusedItemIndex = -1;
    // this.updateActivedescendant();
  }

  private handleItemFocus(index: number) {
    this.focusedItemIndex = index;
    this.updateActivedescendant();
  }

  private updateActivedescendant() {
    const listElement = this.shadowRoot?.getElementById(this.listId);
    if (!listElement) return;

    if (this.focusedItemIndex >= 0) {
      const sessions = this.paginated 
        ? this.getPaginatedSessions(this.getFilteredSessions())
        : this.getFilteredSessions();
        
      if (this.focusedItemIndex < sessions.length) {
        const focusedSession = sessions[this.focusedItemIndex];
        const itemId = `session-${focusedSession.sessionId}`;
        listElement.setAttribute(AriaAttributes.ACTIVEDESCENDANT, itemId);
        
        // Announce the focused item
        const session = focusedSession;
        const announcement = `Session ${this.focusedItemIndex + 1} of ${sessions.length}: ${session.sessionId}`;
        announce(announcement, 'polite');
      }
    } else {
      listElement.removeAttribute(AriaAttributes.ACTIVEDESCENDANT);
    }
  }

  private typeAheadBuffer = '';
  private typeAheadTimeout: number | null = null;

  private handleTypeAhead(key: string) {
    // Clear previous timeout
    if (this.typeAheadTimeout) {
      clearTimeout(this.typeAheadTimeout);
    }

    // Add to buffer
    this.typeAheadBuffer += key.toLowerCase();

    // Find matching session
    const sessions = this.paginated 
      ? this.getPaginatedSessions(this.getFilteredSessions())
      : this.getFilteredSessions();

    const matchIndex = sessions.findIndex(session => 
      session.sessionId.toLowerCase().startsWith(this.typeAheadBuffer) ||
      session.title?.toLowerCase().startsWith(this.typeAheadBuffer)
    );

    if (matchIndex !== -1) {
      this.focusedItemIndex = matchIndex;
      this.updateActivedescendant();
      
      // Focus the actual item element
      const itemElement = this.shadowRoot?.querySelector(`session-list-item:nth-child(${matchIndex + 1})`) as HTMLElement;
      itemElement?.focus();
    }

    // Clear buffer after delay
    this.typeAheadTimeout = window.setTimeout(() => {
      this.typeAheadBuffer = '';
      this.typeAheadTimeout = null;
    }, 1000);
  }

  protected updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    
    // Setup virtual scrolling container when needed
    if (changedProperties.has('virtualScrolling') || changedProperties.has('sessions')) {
      this.updateVirtualScrolling();
    }

    // Setup lazy loading observers
    if (changedProperties.has('lazyLoading') || changedProperties.has('sessions')) {
      this.updateLazyLoading();
    }
    
    // Announce status changes to screen readers
    if (changedProperties.has('sessions') || 
        changedProperties.has('loading') || 
        changedProperties.has('error') ||
        changedProperties.has('searchQuery')) {
      
      const sessions = this.getFilteredSessions();
      const statusMessage = this.getStatusMessage(sessions.length);
      
      // Delay announcement to avoid conflicts
      setTimeout(() => {
        announce(statusMessage, 'polite');
      }, 100);
    }
  }

  private updateVirtualScrolling() {
    if (this.virtualScrolling) {
      // Find the scroll container and set it up
      const container = this.shadowRoot?.querySelector('.sessions-list.virtual') as HTMLElement;
      if (container) {
        this.virtualScroll.setScrollContainer(container);
        
        // Update configuration based on display mode
        const itemHeight = this.displayMode === 'compact' ? 80 : 120;
        this.virtualScroll.updateConfig({ 
          itemHeight,
          containerHeight: Math.min(600, window.innerHeight * 0.6)
        });
      }
    }
  }

  private updateLazyLoading() {
    if (this.lazyLoading) {
      // Setup observers for visible session items
      this.updateComplete.then(() => {
        const items = this.shadowRoot?.querySelectorAll('[data-session-id]');
        items?.forEach(item => {
          const sessionId = item.getAttribute('data-session-id');
          if (sessionId) {
            this.lazyLoader.observeElement(item, sessionId);
          }
        });
      });
    }
  }

  connectedCallback() {
    super.connectedCallback();
    
    // Register for global focus management
    this.focusManager.register();
    
    // Register skip link for quick navigation
    skipLinkManager.registerTarget('session-list', this, 'Skip to session list');
    
    // Set up global keyboard listeners if needed
    this.addEventListener('keydown', this.handleContainerKeydown);

    // Enable performance optimizations for large lists
    this.enablePerformanceOptimizations();
  }

  private enablePerformanceOptimizations() {
    // Auto-enable virtual scrolling for large datasets
    if (this.sessions.length > 50 && !this.virtualScrolling) {
      console.log('Auto-enabling virtual scrolling for large dataset');
      this.virtualScrolling = true;
    }

    // Auto-enable lazy loading for complex sessions
    if (this.sessions.length > 20 && !this.lazyLoading) {
      console.log('Auto-enabling lazy loading for performance');
      this.lazyLoading = true;
    }

    // Optimize rendering frequency
    this.throttleUpdates();
  }

  private throttleUpdates() {
    let updateScheduled = false;
    const originalRequestUpdate = this.requestUpdate.bind(this);
    
    this.requestUpdate = () => {
      if (!updateScheduled) {
        updateScheduled = true;
        requestAnimationFrame(() => {
          originalRequestUpdate();
          updateScheduled = false;
        });
      }
    };
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    
    // Unregister from focus management
    this.focusManager.unregister();
    skipLinkManager.unregisterTarget('session-list');
    
    // Clean up timeout
    if (this.typeAheadTimeout) {
      clearTimeout(this.typeAheadTimeout);
    }
    
    this.removeEventListener('keydown', this.handleContainerKeydown);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-list': SessionList;
  }
}