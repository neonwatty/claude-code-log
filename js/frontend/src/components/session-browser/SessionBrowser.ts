import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { 
  SessionSummary, 
  SessionDetail,
  SessionFilter, 
  SessionSort, 
  PaginationOptions,
  DisplayMode 
} from '../types/session-types';
import '../session-list/SessionList';
import './viewer/SessionViewer';
import './navigation/SessionNavigation';
import '../filters/FilterPanel';
import { AriaRoles } from '../utils/accessibility';

/**
 * Comprehensive session browser interface that integrates session listing,
 * viewing, navigation, and filtering capabilities
 */
@customElement('session-browser')
export class SessionBrowser extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        height: 100vh;
        background: var(--color-background);
        color: var(--color-text-primary);
        font-family: var(--font-family);
      }

      .browser-container {
        display: grid;
        grid-template-areas: 
          "nav nav"
          "sidebar content";
        grid-template-columns: minmax(300px, 1fr) 2fr;
        grid-template-rows: auto 1fr;
        height: 100%;
        gap: 1px;
        background: var(--color-border);
      }

      .browser-nav {
        grid-area: nav;
        background: var(--color-background-secondary);
        border-bottom: 1px solid var(--color-border);
        padding: var(--space-md);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .browser-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0;
      }

      .browser-actions {
        display: flex;
        gap: var(--space-sm);
        align-items: center;
      }

      .action-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        color: var(--color-text-primary);
        cursor: pointer;
        transition: all var(--transition-fast);
        font-size: var(--font-size-sm);
      }

      .action-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
      }

      .action-button.primary {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .action-button.primary:hover {
        background: var(--color-primary-dark);
      }

      .browser-sidebar {
        grid-area: sidebar;
        background: var(--color-background);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .browser-content {
        grid-area: content;
        background: var(--color-background);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .sidebar-header {
        padding: var(--space-md);
        border-bottom: 1px solid var(--color-border-light);
        background: var(--color-background-secondary);
      }

      .sidebar-content {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .content-header {
        padding: var(--space-md);
        border-bottom: 1px solid var(--color-border-light);
        background: var(--color-background-secondary);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .content-main {
        flex: 1;
        overflow: hidden;
      }

      .layout-toggle {
        display: flex;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .layout-toggle button {
        background: var(--color-background);
        border: none;
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }

      .layout-toggle button.active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
      }

      .layout-toggle button:hover:not(.active) {
        background: var(--color-background-tertiary);
      }

      .status-indicator {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-success);
      }

      .status-dot.loading {
        background: var(--color-warning);
        animation: pulse 1.5s infinite;
      }

      .status-dot.error {
        background: var(--color-error);
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        color: var(--color-text-muted);
        padding: var(--space-xxl);
      }

      .empty-state-icon {
        font-size: 4rem;
        margin-bottom: var(--space-lg);
        opacity: 0.5;
      }

      .empty-state-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-medium);
        margin-bottom: var(--space-md);
      }

      .empty-state-description {
        font-size: var(--font-size-base);
        line-height: 1.5;
        max-width: 400px;
      }

      /* Responsive layouts */
      @media (max-width: 1024px) {
        .browser-container {
          grid-template-areas: 
            "nav"
            "sidebar"
            "content";
          grid-template-columns: 1fr;
          grid-template-rows: auto auto 1fr;
        }

        .browser-sidebar {
          max-height: 40vh;
        }
      }

      @media (max-width: 768px) {
        .browser-nav {
          flex-direction: column;
          gap: var(--space-md);
          align-items: stretch;
        }

        .browser-actions {
          justify-content: center;
        }

        .content-header {
          flex-direction: column;
          gap: var(--space-sm);
          align-items: stretch;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      /* High contrast mode */
      @media (prefers-contrast: high) {
        .browser-container {
          border: 2px solid var(--color-text-primary);
        }

        .action-button,
        .layout-toggle button {
          border-width: 2px;
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
   * Currently selected session
   */
  @property({ type: Object })
  selectedSession: SessionDetail | null = null;

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
   * Layout mode for the browser
   */
  @property({ type: String })
  layout: 'split' | 'list-only' | 'viewer-only' = 'split';

  /**
   * Loading state
   */
  @property({ type: Boolean })
  loading = false;

  /**
   * Error state
   */
  @property({ type: String })
  error = '';

  /**
   * Whether real-time updates are enabled
   */
  @property({ type: Boolean })
  realTimeUpdates = true;

  /**
   * Whether to show advanced filtering
   */
  @property({ type: Boolean })
  showAdvancedFilters = false;

  @state()
  private selectedSessionId: string | null = null;

  @state()
  private connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error' = 'connected';

  @query('session-list')
  private sessionListElement!: any;

  @query('session-viewer')
  private sessionViewerElement!: any;

  @query('session-navigation')
  private navigationElement!: any;

  render() {
    return html`
      <div 
        class="browser-container"
        role="${AriaRoles.MAIN}"
        aria-label="Session browser interface"
      >
        ${this.renderNavigation()}
        ${this.layout !== 'viewer-only' ? this.renderSidebar() : ''}
        ${this.layout !== 'list-only' ? this.renderContent() : ''}
      </div>
    `;
  }

  private renderNavigation() {
    return html`
      <header class="browser-nav" role="banner">
        <h1 class="browser-title">Claude Code Sessions</h1>
        
        <div class="browser-actions">
          <div class="status-indicator">
            <div class="status-dot ${this.connectionStatus}"></div>
            <span>${this.getConnectionStatusText()}</span>
          </div>

          <div class="layout-toggle">
            <button 
              class=${this.layout === 'split' ? 'active' : ''}
              @click=${() => this.setLayout('split')}
              title="Split view (list and viewer)"
              aria-label="Split view layout"
            >
              ⊞
            </button>
            <button 
              class=${this.layout === 'list-only' ? 'active' : ''}
              @click=${() => this.setLayout('list-only')}
              title="List only view"
              aria-label="List only layout"
            >
              ☰
            </button>
            <button 
              class=${this.layout === 'viewer-only' ? 'active' : ''}
              @click=${() => this.setLayout('viewer-only')}
              title="Viewer only view"
              aria-label="Viewer only layout"
            >
              📄
            </button>
          </div>

          <button 
            class="action-button ${this.showAdvancedFilters ? 'primary' : ''}"
            @click=${this.toggleAdvancedFilters}
            title="Toggle advanced filters"
          >
            🔍 Filters
          </button>

          <button 
            class="action-button ${this.realTimeUpdates ? 'primary' : ''}"
            @click=${this.toggleRealTimeUpdates}
            title="Toggle real-time updates"
          >
            📡 Live
          </button>

          <button 
            class="action-button"
            @click=${this.refreshSessions}
            title="Refresh sessions"
          >
            🔄 Refresh
          </button>
        </div>
      </header>
    `;
  }

  private renderSidebar() {
    return html`
      <aside 
        class="browser-sidebar"
        role="complementary"
        aria-label="Session list and filters"
      >
        <div class="sidebar-header">
          <h2 style="margin: 0; font-size: var(--font-size-lg);">Sessions</h2>
        </div>
        
        <div class="sidebar-content">
          <session-list
            .sessions=${this.sessions}
            .filter=${this.filter}
            .sort=${this.sort}
            .pagination=${this.pagination}
            .displayMode=${this.displayMode}
            .selectedSessionId=${this.selectedSessionId}
            .searchable=${true}
            .filterable=${!this.showAdvancedFilters}
            .paginated=${true}
            .virtualScrolling=${this.sessions.length > 50}
            .lazyLoading=${this.sessions.length > 20}
            .showFilters=${this.showAdvancedFilters}
            .filtersCollapsed=${false}
            @session-selected=${this.handleSessionSelected}
            @filter-changed=${this.handleFilterChanged}
            @sort-changed=${this.handleSortChanged}
            @page-changed=${this.handlePageChanged}
            @error-occurred=${this.handleError}
          ></session-list>
        </div>
      </aside>
    `;
  }

  private renderContent() {
    if (!this.selectedSession && !this.loading) {
      return html`
        <main class="browser-content" role="main">
          ${this.renderEmptyState()}
        </main>
      `;
    }

    return html`
      <main class="browser-content" role="main">
        <div class="content-header">
          <div>
            <h2 style="margin: 0; font-size: var(--font-size-lg);">
              ${this.selectedSession?.title || this.selectedSession?.sessionId || 'Session Details'}
            </h2>
            ${this.selectedSession ? html`
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--space-xs);">
                ${this.selectedSession.messageCount} messages • 
                Started ${this.formatTimestamp(this.selectedSession.startTime)}
                ${this.selectedSession.endTime ? ` • Ended ${this.formatTimestamp(this.selectedSession.endTime)}` : ' • Active'}
              </div>
            ` : ''}
          </div>

          <session-navigation
            .currentSession=${this.selectedSession}
            .sessions=${this.sessions}
            @session-navigate=${this.handleSessionNavigate}
            @branch-requested=${this.handleBranchRequested}
          ></session-navigation>
        </div>

        <div class="content-main">
          ${this.loading ? html`
            <div class="empty-state">
              <div class="empty-state-icon">⏳</div>
              <div class="empty-state-title">Loading session...</div>
            </div>
          ` : this.selectedSession ? html`
            <session-viewer
              .session=${this.selectedSession}
              .realTimeUpdates=${this.realTimeUpdates}
              @message-selected=${this.handleMessageSelected}
              @error-occurred=${this.handleError}
            ></session-viewer>
          ` : ''}
        </div>
      </main>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-title">Welcome to Session Browser</div>
        <div class="empty-state-description">
          Select a session from the sidebar to view its details and messages.
          Use the filters and search to find specific sessions.
        </div>
      </div>
    `;
  }

  // Event handlers

  private handleSessionSelected(event: CustomEvent) {
    const { sessionId } = event.detail;
    this.selectedSessionId = sessionId;
    this.loadSessionDetails(sessionId);
    this.emitEvent('session-selected', event.detail);
  }

  private handleFilterChanged(event: CustomEvent) {
    this.filter = event.detail.filter;
    this.emitEvent('filter-changed', event.detail);
  }

  private handleSortChanged(event: CustomEvent) {
    this.sort = event.detail.sort;
    this.emitEvent('sort-changed', event.detail);
  }

  private handlePageChanged(event: CustomEvent) {
    this.pagination = { ...this.pagination, ...event.detail };
    this.emitEvent('page-changed', event.detail);
  }

  private handleSessionNavigate(event: CustomEvent) {
    this.handleSessionSelected(event);
  }

  private handleBranchRequested(event: CustomEvent) {
    this.emitEvent('branch-requested', event.detail);
  }

  private handleMessageSelected(event: CustomEvent) {
    this.emitEvent('message-selected', event.detail);
  }

  private handleError(event: CustomEvent) {
    this.error = event.detail.error;
    this.emitEvent('error-occurred', event.detail);
  }

  // Actions

  private setLayout(layout: 'split' | 'list-only' | 'viewer-only') {
    this.layout = layout;
    this.emitEvent('layout-changed', { layout });
  }

  private toggleAdvancedFilters() {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  private toggleRealTimeUpdates() {
    this.realTimeUpdates = !this.realTimeUpdates;
    this.emitEvent('real-time-updates-toggled', { enabled: this.realTimeUpdates });
  }

  private refreshSessions() {
    this.loading = true;
    this.error = '';
    this.emitEvent('refresh-requested', {});
  }

  private async loadSessionDetails(sessionId: string) {
    try {
      this.loading = true;
      this.error = '';
      
      // Emit event for parent to handle the actual loading
      this.emitEvent('session-details-requested', { sessionId });
      
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to load session details';
      this.loading = false;
    }
  }

  // Utility methods

  private getConnectionStatusText(): string {
    switch (this.connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Unknown';
    }
  }

  private formatTimestamp(timestamp: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  }

  // Public API methods

  /**
   * Set the selected session data
   */
  setSelectedSession(session: SessionDetail | null) {
    this.selectedSession = session;
    this.loading = false;
    
    if (session) {
      this.selectedSessionId = session.sessionId;
    }
  }

  /**
   * Set loading state
   */
  setLoading(loading: boolean) {
    this.loading = loading;
  }

  /**
   * Set error state
   */
  setError(error: string) {
    this.error = error;
    this.loading = false;
  }

  /**
   * Set connection status
   */
  setConnectionStatus(status: 'connected' | 'connecting' | 'disconnected' | 'error') {
    this.connectionStatus = status;
  }

  /**
   * Update sessions data
   */
  updateSessions(sessions: SessionSummary[]) {
    this.sessions = sessions;
    this.pagination = {
      ...this.pagination,
      totalItems: sessions.length
    };
  }

  connectedCallback() {
    super.connectedCallback();
    
    // Auto-refresh on connection
    if (this.realTimeUpdates) {
      this.refreshSessions();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-browser': SessionBrowser;
  }
}