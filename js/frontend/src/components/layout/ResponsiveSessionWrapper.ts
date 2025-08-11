import { LitElement, html, css, CSSResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { when } from 'lit/directives/when.js';
import { baseStyles } from '../styles/theme.js';
import { SessionSummary } from '../types/session-types.js';

export type SessionViewMode = 'table' | 'grid' | 'cards' | 'compact';

export interface ResponsiveSessionConfig {
  mobileLayout: SessionViewMode;
  tabletLayout: SessionViewMode;
  desktopLayout: SessionViewMode;
  itemsPerPage: number;
  enableSearch: boolean;
  enableFilters: boolean;
  showPagination: boolean;
}

/**
 * Responsive Session List Wrapper Component
 * 
 * Wraps session list components with responsive layouts:
 * - Mobile: Card layout with vertical stacking
 * - Tablet: Grid layout with configurable columns
 * - Desktop: Table layout or grid with more columns
 * 
 * Provides consistent responsive behavior for session data display.
 */
@customElement('responsive-session-wrapper')
export class ResponsiveSessionWrapper extends LitElement {
  static styles: CSSResult = css`
    ${baseStyles}
    
    :host {
      display: block;
      width: 100%;
    }

    .session-wrapper {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .session-header {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
      padding: var(--space-md);
      background: var(--color-background-secondary);
      border-radius: var(--border-radius);
      border: 1px solid var(--color-border);
    }

    .header-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-md);
    }

    .session-title {
      margin: 0;
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    }

    .session-stats {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
    }

    .layout-selector {
      display: flex;
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      overflow: hidden;
    }

    .layout-option {
      padding: var(--space-xs) var(--space-sm);
      background: none;
      border: none;
      cursor: pointer;
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      transition: all var(--transition-fast);
    }

    .layout-option:hover {
      background: var(--color-background-tertiary);
    }

    .layout-option.active {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .header-controls-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-md);
      align-items: center;
    }

    .search-container {
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

    /* Mobile Layout - Cards */
    .session-content-mobile {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .session-mobile-card {
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      overflow: hidden;
      transition: all var(--transition-fast);
    }

    .session-mobile-card:hover {
      box-shadow: var(--shadow);
      border-color: var(--color-primary);
    }

    .session-mobile-header {
      padding: var(--space-md);
      background: var(--color-background-secondary);
      border-bottom: 1px solid var(--color-border);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .session-mobile-title {
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-xs) 0;
    }

    .session-mobile-id {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      font-family: var(--font-family-mono);
    }

    .session-mobile-status {
      padding: var(--space-xs) var(--space-sm);
      border-radius: var(--border-radius-full);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      text-transform: uppercase;
    }

    .session-mobile-status.active {
      background: var(--color-success-light);
      color: var(--color-success);
    }

    .session-mobile-status.completed {
      background: var(--color-primary-disabled);
      color: var(--color-primary);
    }

    .session-mobile-body {
      padding: var(--space-md);
    }

    .session-mobile-details {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-md);
      margin-bottom: var(--space-md);
    }

    .session-mobile-detail {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
      min-width: 100px;
    }

    .session-mobile-detail-label {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-secondary);
      text-transform: uppercase;
    }

    .session-mobile-detail-value {
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
    }

    /* Tablet Layout - Grid */
    .session-content-tablet {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--space-md);
    }

    .session-tablet-card {
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      padding: var(--space-md);
      transition: all var(--transition-fast);
      cursor: pointer;
    }

    .session-tablet-card:hover {
      box-shadow: var(--shadow);
      transform: translateY(-2px);
    }

    .session-tablet-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--space-sm);
    }

    .session-tablet-title {
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      margin: 0;
    }

    .session-tablet-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-sm);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    /* Desktop Layout - Table */
    .session-content-desktop {
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      overflow: hidden;
    }

    .session-table {
      width: 100%;
      border-collapse: collapse;
    }

    .session-table th {
      padding: var(--space-md);
      background: var(--color-background-secondary);
      border-bottom: 1px solid var(--color-border);
      text-align: left;
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
    }

    .session-table td {
      padding: var(--space-md);
      border-bottom: 1px solid var(--color-border);
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
    }

    .session-table tr:hover {
      background: var(--color-background-secondary);
    }

    .session-table tr:last-child td {
      border-bottom: none;
    }

    .session-id {
      font-family: var(--font-family-mono);
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-xxl);
      color: var(--color-text-muted);
      text-align: center;
      gap: var(--space-md);
    }

    .empty-icon {
      font-size: 4rem;
      opacity: 0.5;
    }

    /* Responsive Breakpoints */
    
    /* Mobile (default) */
    .layout-selector {
      display: none;
    }

    .session-content-tablet,
    .session-content-desktop {
      display: none;
    }

    .session-content-mobile {
      display: flex;
    }

    /* Tablet (768px+) */
    @media (min-width: 768px) {
      .layout-selector {
        display: flex;
      }

      .session-content-mobile {
        display: none;
      }

      .session-content-tablet {
        display: grid;
      }
    }

    /* Desktop (1024px+) */
    @media (min-width: 1024px) {
      .session-content-tablet {
        display: none;
      }

      .session-content-desktop {
        display: block;
      }
    }

    /* Force layout overrides */
    :host([force-layout="mobile"]) .session-content-mobile {
      display: flex;
    }

    :host([force-layout="mobile"]) .session-content-tablet,
    :host([force-layout="mobile"]) .session-content-desktop {
      display: none;
    }

    :host([force-layout="tablet"]) .session-content-tablet {
      display: grid;
    }

    :host([force-layout="tablet"]) .session-content-mobile,
    :host([force-layout="tablet"]) .session-content-desktop {
      display: none;
    }

    :host([force-layout="desktop"]) .session-content-desktop {
      display: block;
    }

    :host([force-layout="desktop"]) .session-content-mobile,
    :host([force-layout="desktop"]) .session-content-tablet {
      display: none;
    }
  `;

  /**
   * Sessions to display
   */
  @property({ type: Array })
  sessions: SessionSummary[] = [];

  /**
   * Component title
   */
  @property({ type: String })
  title = 'Sessions';

  /**
   * Responsive configuration
   */
  @property({ type: Object })
  config: ResponsiveSessionConfig = {
    mobileLayout: 'cards',
    tabletLayout: 'grid',
    desktopLayout: 'table',
    itemsPerPage: 20,
    enableSearch: true,
    enableFilters: true,
    showPagination: true
  };

  /**
   * Force specific layout
   */
  @property({ type: String, attribute: 'force-layout', reflect: true })
  forceLayout?: 'mobile' | 'tablet' | 'desktop';

  /**
   * Search query
   */
  @state()
  private _searchQuery = '';

  /**
   * Current layout
   */
  @state()
  private _currentLayout: 'mobile' | 'tablet' | 'desktop' = 'mobile';

  /**
   * Filtered sessions
   */
  @state()
  private _filteredSessions: SessionSummary[] = [];

  connectedCallback() {
    super.connectedCallback();
    this._updateCurrentLayout();
    this._applyFilters();
    window.addEventListener('resize', this._handleResize.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this._handleResize.bind(this));
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    
    if (changedProperties.has('sessions') || changedProperties.has('_searchQuery')) {
      this._applyFilters();
    }
  }

  /**
   * Handle window resize
   */
  private _handleResize() {
    this._updateCurrentLayout();
  }

  /**
   * Update current layout based on viewport
   */
  private _updateCurrentLayout() {
    if (this.forceLayout) {
      this._currentLayout = this.forceLayout;
      return;
    }

    const width = window.innerWidth;
    if (width >= 1024) {
      this._currentLayout = 'desktop';
    } else if (width >= 768) {
      this._currentLayout = 'tablet';
    } else {
      this._currentLayout = 'mobile';
    }
  }

  /**
   * Handle layout selector change
   */
  private _handleLayoutChange(layout: 'mobile' | 'tablet' | 'desktop') {
    this.forceLayout = layout;
    this._currentLayout = layout;
    
    this.dispatchEvent(new CustomEvent('layout-changed', {
      detail: { layout },
      bubbles: true
    }));
  }

  /**
   * Handle search input
   */
  private _handleSearch(event: InputEvent) {
    const target = event.target as HTMLInputElement;
    this._searchQuery = target.value.toLowerCase();
  }

  /**
   * Apply filters to sessions
   */
  private _applyFilters() {
    if (!this._searchQuery.trim()) {
      this._filteredSessions = [...this.sessions];
      return;
    }

    this._filteredSessions = this.sessions.filter(session => {
      const searchText = [
        session.title,
        session.sessionId,
        session.summary,
        session.cwd,
        ...(session.tags || [])
      ].join(' ').toLowerCase();
      
      return searchText.includes(this._searchQuery);
    });
  }

  /**
   * Handle session selection
   */
  private _handleSessionSelect(session: SessionSummary) {
    this.dispatchEvent(new CustomEvent('session-selected', {
      detail: { session },
      bubbles: true
    }));
  }

  /**
   * Format duration
   */
  private _formatDuration(session: SessionSummary): string {
    const start = session.startTime;
    const end = session.endTime || new Date();
    const duration = end.getTime() - start.getTime();
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Format date/time
   */
  private _formatDateTime(date: Date): string {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Get active sessions count
   */
  private _getActiveCount(): number {
    return this.sessions.filter(s => s.isActive).length;
  }

  /**
   * Get completed sessions count
   */
  private _getCompletedCount(): number {
    return this.sessions.filter(s => !s.isActive).length;
  }

  /**
   * Render mobile view
   */
  private _renderMobileView() {
    return html`
      <div class="session-content-mobile">
        ${this._filteredSessions.map(session => html`
          <div 
            class="session-mobile-card" 
            @click="${() => this._handleSessionSelect(session)}"
          >
            <div class="session-mobile-header">
              <div>
                <h3 class="session-mobile-title">
                  ${session.title || 'Untitled Session'}
                </h3>
                <div class="session-mobile-id">${session.sessionId.substring(0, 12)}...</div>
              </div>
              <span class="${classMap({
                'session-mobile-status': true,
                'active': session.isActive,
                'completed': !session.isActive
              })}">
                ${session.isActive ? 'Active' : 'Completed'}
              </span>
            </div>
            
            <div class="session-mobile-body">
              <div class="session-mobile-details">
                <div class="session-mobile-detail">
                  <span class="session-mobile-detail-label">Started</span>
                  <span class="session-mobile-detail-value">
                    ${this._formatDateTime(session.startTime)}
                  </span>
                </div>
                <div class="session-mobile-detail">
                  <span class="session-mobile-detail-label">Duration</span>
                  <span class="session-mobile-detail-value">
                    ${this._formatDuration(session)}
                  </span>
                </div>
                <div class="session-mobile-detail">
                  <span class="session-mobile-detail-label">Directory</span>
                  <span class="session-mobile-detail-value">
                    ${session.cwd ? session.cwd.split('/').pop() : 'N/A'}
                  </span>
                </div>
              </div>
              
              ${session.summary ? html`
                <p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.4;">
                  ${session.summary}
                </p>
              ` : ''}
            </div>
          </div>
        `)}
      </div>
    `;
  }

  /**
   * Render tablet view
   */
  private _renderTabletView() {
    return html`
      <div class="session-content-tablet">
        ${this._filteredSessions.map(session => html`
          <div 
            class="session-tablet-card"
            @click="${() => this._handleSessionSelect(session)}"
          >
            <div class="session-tablet-header">
              <h3 class="session-tablet-title">
                ${session.title || 'Untitled Session'}
              </h3>
              <span class="${classMap({
                'session-mobile-status': true,
                'active': session.isActive,
                'completed': !session.isActive
              })}">
                ${session.isActive ? 'Active' : 'Completed'}
              </span>
            </div>
            
            <div class="session-tablet-meta">
              <div>Started: ${this._formatDateTime(session.startTime)}</div>
              <div>Duration: ${this._formatDuration(session)}</div>
              <div>Directory: ${session.cwd ? session.cwd.split('/').pop() : 'N/A'}</div>
              <div>ID: ${session.sessionId.substring(0, 8)}...</div>
            </div>
            
            ${session.summary ? html`
              <p style="margin: var(--space-sm) 0 0 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.4;">
                ${session.summary}
              </p>
            ` : ''}
          </div>
        `)}
      </div>
    `;
  }

  /**
   * Render desktop view
   */
  private _renderDesktopView() {
    return html`
      <div class="session-content-desktop">
        <table class="session-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Directory</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            ${this._filteredSessions.map(session => html`
              <tr @click="${() => this._handleSessionSelect(session)}" style="cursor: pointer;">
                <td>
                  <div>
                    <strong>${session.title || 'Untitled Session'}</strong>
                  </div>
                  <div class="session-id">${session.sessionId}</div>
                </td>
                <td>
                  <span class="${classMap({
                    'session-mobile-status': true,
                    'active': session.isActive,
                    'completed': !session.isActive
                  })}">
                    ${session.isActive ? 'Active' : 'Completed'}
                  </span>
                </td>
                <td>${this._formatDateTime(session.startTime)}</td>
                <td>${this._formatDuration(session)}</td>
                <td>${session.cwd ? session.cwd.split('/').pop() : 'N/A'}</td>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${session.summary || '—'}
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  render() {
    return html`
      <div class="session-wrapper">
        <header class="session-header">
          <div class="header-top-row">
            <h2 class="session-title">${this.title}</h2>
            
            <div class="session-stats">
              <div class="stat-item">
                <span>📊</span>
                <span>${this.sessions.length} total</span>
              </div>
              <div class="stat-item">
                <span>✅</span>
                <span>${this._getActiveCount()} active</span>
              </div>
              <div class="stat-item">
                <span>📋</span>
                <span>${this._getCompletedCount()} completed</span>
              </div>
            </div>

            <div class="layout-selector">
              <button 
                class="${classMap({ 'layout-option': true, 'active': this._currentLayout === 'mobile' })}"
                @click="${() => this._handleLayoutChange('mobile')}"
                title="Mobile card layout"
              >
                📱 Cards
              </button>
              <button 
                class="${classMap({ 'layout-option': true, 'active': this._currentLayout === 'tablet' })}"
                @click="${() => this._handleLayoutChange('tablet')}"
                title="Tablet grid layout"
              >
                🔲 Grid
              </button>
              <button 
                class="${classMap({ 'layout-option': true, 'active': this._currentLayout === 'desktop' })}"
                @click="${() => this._handleLayoutChange('desktop')}"
                title="Desktop table layout"
              >
                📋 Table
              </button>
            </div>
          </div>
          
          ${this.config.enableSearch ? html`
            <div class="header-controls-row">
              <div class="search-container">
                <span class="search-icon">🔍</span>
                <input
                  class="search-input"
                  type="text"
                  placeholder="Search sessions..."
                  @input="${this._handleSearch}"
                />
              </div>
            </div>
          ` : ''}
        </header>

        ${this._filteredSessions.length === 0 ? html`
          <div class="empty-state">
            <div class="empty-icon">📝</div>
            <h3>No sessions found</h3>
            <p>
              ${this._searchQuery ? 'Try adjusting your search terms' : 'Sessions will appear here once they are created'}
            </p>
          </div>
        ` : ''}

        ${when(this._currentLayout === 'mobile' && this._filteredSessions.length > 0, () => this._renderMobileView())}
        ${when(this._currentLayout === 'tablet' && this._filteredSessions.length > 0, () => this._renderTabletView())}
        ${when(this._currentLayout === 'desktop' && this._filteredSessions.length > 0, () => this._renderDesktopView())}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'responsive-session-wrapper': ResponsiveSessionWrapper;
  }
}