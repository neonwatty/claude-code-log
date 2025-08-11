import { LitElement, html, css, CSSResult } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { when } from 'lit/directives/when.js';
import { baseStyles } from '../styles/theme.js';
import { SessionSummary } from '../types/session-types.js';

export interface ResponsiveTimelineConfig {
  mobileView: 'list' | 'compact' | 'timeline';
  tabletView: 'timeline' | 'hybrid';
  desktopView: 'timeline' | 'split';
  enableHorizontalScroll: boolean;
  collapsibleSections: boolean;
  cardLayout: boolean;
}

/**
 * Responsive Timeline Wrapper Component
 * 
 * Wraps the existing TimelineView component with responsive enhancements:
 * - Mobile: Stack sessions as cards with collapsible sections
 * - Tablet: Hybrid view with horizontal scrolling timeline
 * - Desktop: Full timeline with optional sidebar
 * 
 * Adapts existing timeline and session components to work within 
 * the responsive layout system.
 */
@customElement('responsive-timeline-wrapper')
export class ResponsiveTimelineWrapper extends LitElement {
  static styles: CSSResult = css`
    ${baseStyles}
    
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .timeline-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      gap: var(--space-md);
    }

    .timeline-header {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
      padding: var(--space-md);
      background-color: var(--color-background-secondary);
      border-radius: var(--border-radius);
      border: 1px solid var(--color-border);
    }

    .timeline-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-md);
    }

    .timeline-title {
      margin: 0;
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    }

    .view-selector {
      display: flex;
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      overflow: hidden;
    }

    .view-option {
      padding: var(--space-xs) var(--space-sm);
      background: none;
      border: none;
      cursor: pointer;
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      transition: all var(--transition-fast);
      white-space: nowrap;
    }

    .view-option:hover {
      background: var(--color-background-tertiary);
    }

    .view-option.active {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .timeline-controls-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-md);
      align-items: center;
    }

    /* Mobile Timeline - List/Card View */
    .timeline-content-mobile {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      padding: var(--space-md);
    }

    .session-card {
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      overflow: hidden;
      transition: all var(--transition-fast);
    }

    .session-card:hover {
      box-shadow: var(--shadow);
      border-color: var(--color-border-dark);
    }

    .session-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-md);
      background: var(--color-background-secondary);
      border-bottom: 1px solid var(--color-border);
    }

    .session-card-title {
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      margin: 0;
    }

    .session-card-status {
      padding: var(--space-xs) var(--space-sm);
      border-radius: var(--border-radius-full);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      text-transform: uppercase;
    }

    .session-card-status.active {
      background: var(--color-success-light);
      color: var(--color-success);
    }

    .session-card-status.completed {
      background: var(--color-primary-disabled);
      color: var(--color-primary);
    }

    .session-card-content {
      padding: var(--space-md);
    }

    .session-info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: var(--space-sm);
      margin-bottom: var(--space-md);
    }

    .session-info-item {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }

    .session-info-label {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .session-info-value {
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
    }

    .session-timeline-bar {
      height: 4px;
      background: var(--color-background-tertiary);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: var(--space-sm);
    }

    .session-timeline-progress {
      height: 100%;
      background: var(--color-primary);
      border-radius: 2px;
      transition: width var(--transition-base);
    }

    /* Tablet Timeline - Horizontal Scroll */
    .timeline-content-tablet {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .timeline-scroll-container {
      flex: 1;
      overflow-x: auto;
      overflow-y: hidden;
      padding: var(--space-md);
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
    }

    .timeline-horizontal {
      display: flex;
      gap: var(--space-md);
      min-width: max-content;
      height: 300px;
      padding: var(--space-md);
    }

    .timeline-day-column {
      display: flex;
      flex-direction: column;
      min-width: 200px;
      background: var(--color-background-secondary);
      border-radius: var(--border-radius);
      border: 1px solid var(--color-border);
    }

    .timeline-day-header {
      padding: var(--space-sm) var(--space-md);
      background: var(--color-background-tertiary);
      border-bottom: 1px solid var(--color-border);
      font-weight: var(--font-weight-medium);
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      text-align: center;
    }

    .timeline-day-sessions {
      flex: 1;
      padding: var(--space-sm);
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }

    .timeline-session-item {
      padding: var(--space-sm);
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      font-size: var(--font-size-xs);
      color: var(--color-text-primary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .timeline-session-item:hover {
      background: var(--color-primary-disabled);
      border-color: var(--color-primary);
    }

    /* Desktop Timeline - Full View */
    .timeline-content-desktop {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .timeline-embed {
      flex: 1;
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      overflow: hidden;
    }

    /* Collapsible Sections */
    .collapsible-section {
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      margin-bottom: var(--space-sm);
      overflow: hidden;
    }

    .collapsible-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-sm) var(--space-md);
      background: var(--color-background-secondary);
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }

    .collapsible-header:hover {
      background: var(--color-background-tertiary);
    }

    .collapsible-title {
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      margin: 0;
    }

    .collapsible-toggle {
      transform: rotate(0deg);
      transition: transform var(--transition-base);
      color: var(--color-text-secondary);
    }

    .collapsible-toggle.expanded {
      transform: rotate(180deg);
    }

    .collapsible-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height var(--transition-base);
    }

    .collapsible-content.expanded {
      max-height: 1000px; /* Large enough for content */
    }

    .collapsible-body {
      padding: var(--space-md);
    }

    /* Responsive Breakpoints */
    
    /* Mobile styles (default) */
    .view-selector {
      display: none; /* Hide view selector on mobile */
    }

    .timeline-content-tablet,
    .timeline-content-desktop {
      display: none;
    }

    .timeline-content-mobile {
      display: flex;
    }

    /* Tablet styles (768px+) */
    @media (min-width: 768px) {
      .view-selector {
        display: flex;
      }

      .timeline-content-mobile {
        display: none;
      }

      .timeline-content-tablet {
        display: flex;
      }

      .timeline-content-desktop {
        display: none;
      }

      /* Show tablet view by default on tablet */
      .timeline-content-tablet.active {
        display: flex;
      }
    }

    /* Desktop styles (1024px+) */
    @media (min-width: 1024px) {
      .timeline-content-tablet {
        display: none;
      }

      .timeline-content-desktop {
        display: flex;
      }

      /* Show desktop view by default on desktop */
      .timeline-content-desktop.active {
        display: flex;
      }
    }

    /* Force view type when explicitly set */
    :host([force-view="mobile"]) .timeline-content-mobile {
      display: flex;
    }

    :host([force-view="mobile"]) .timeline-content-tablet,
    :host([force-view="mobile"]) .timeline-content-desktop {
      display: none;
    }

    :host([force-view="tablet"]) .timeline-content-tablet {
      display: flex;
    }

    :host([force-view="tablet"]) .timeline-content-mobile,
    :host([force-view="tablet"]) .timeline-content-desktop {
      display: none;
    }

    :host([force-view="desktop"]) .timeline-content-desktop {
      display: flex;
    }

    :host([force-view="desktop"]) .timeline-content-mobile,
    :host([force-view="desktop"]) .timeline-content-tablet {
      display: none;
    }
  `;

  /**
   * Sessions data to display in timeline
   */
  @property({ type: Array })
  sessions: SessionSummary[] = [];

  /**
   * Timeline title
   */
  @property({ type: String })
  title = 'Session Timeline';

  /**
   * Responsive configuration
   */
  @property({ type: Object })
  config: ResponsiveTimelineConfig = {
    mobileView: 'list',
    tabletView: 'timeline',
    desktopView: 'timeline',
    enableHorizontalScroll: true,
    collapsibleSections: true,
    cardLayout: true
  };

  /**
   * Force a specific view type (overrides responsive behavior)
   */
  @property({ type: String, attribute: 'force-view', reflect: true })
  forceView?: 'mobile' | 'tablet' | 'desktop';

  /**
   * Current active view
   */
  @state()
  private _currentView: 'mobile' | 'tablet' | 'desktop' = 'mobile';

  /**
   * Collapsed sections state
   */
  @state()
  private _collapsedSections: Set<string> = new Set();

  connectedCallback() {
    super.connectedCallback();
    this._updateCurrentView();
    window.addEventListener('resize', this._handleResize.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this._handleResize.bind(this));
  }

  /**
   * Handle window resize to update current view
   */
  private _handleResize() {
    this._updateCurrentView();
  }

  /**
   * Update current view based on viewport width
   */
  private _updateCurrentView() {
    if (this.forceView) {
      this._currentView = this.forceView;
      return;
    }

    const width = window.innerWidth;
    if (width >= 1024) {
      this._currentView = 'desktop';
    } else if (width >= 768) {
      this._currentView = 'tablet';
    } else {
      this._currentView = 'mobile';
    }
  }

  /**
   * Handle view selector change
   */
  private _handleViewChange(view: 'mobile' | 'tablet' | 'desktop') {
    this.forceView = view;
    this._currentView = view;
    
    this.dispatchEvent(new CustomEvent('view-changed', {
      detail: { view },
      bubbles: true
    }));
  }

  /**
   * Toggle collapsible section
   */
  private _toggleSection(sectionId: string) {
    if (this._collapsedSections.has(sectionId)) {
      this._collapsedSections.delete(sectionId);
    } else {
      this._collapsedSections.add(sectionId);
    }
    this.requestUpdate();
  }

  /**
   * Format session duration
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
   * Format session date
   */
  private _formatDate(date: Date): string {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Format session time
   */
  private _formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Group sessions by date for tablet view
   */
  private _groupSessionsByDate(): Map<string, SessionSummary[]> {
    const groups = new Map<string, SessionSummary[]>();
    
    this.sessions.forEach(session => {
      const date = session.startTime.toDateString();
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(session);
    });

    return groups;
  }

  /**
   * Handle session click
   */
  private _handleSessionClick(session: SessionSummary) {
    this.dispatchEvent(new CustomEvent('session-selected', {
      detail: { session },
      bubbles: true
    }));
  }

  /**
   * Render mobile view (card/list layout)
   */
  private _renderMobileView() {
    return html`
      <div class="timeline-content-mobile">
        ${this.sessions.map(session => html`
          <div class="session-card" @click="${() => this._handleSessionClick(session)}">
            <header class="session-card-header">
              <h3 class="session-card-title">
                ${session.title || session.sessionId.substring(0, 8)}
              </h3>
              <span class="${classMap({
                'session-card-status': true,
                'active': session.isActive,
                'completed': !session.isActive
              })}">
                ${session.isActive ? 'Active' : 'Completed'}
              </span>
            </header>
            
            <div class="session-card-content">
              <div class="session-timeline-bar">
                <div class="session-timeline-progress" style="width: ${session.isActive ? '60' : '100'}%"></div>
              </div>
              
              <div class="session-info-grid">
                <div class="session-info-item">
                  <span class="session-info-label">Started</span>
                  <span class="session-info-value">
                    ${this._formatTime(session.startTime)}
                  </span>
                </div>
                <div class="session-info-item">
                  <span class="session-info-label">Duration</span>
                  <span class="session-info-value">
                    ${this._formatDuration(session)}
                  </span>
                </div>
                <div class="session-info-item">
                  <span class="session-info-label">Directory</span>
                  <span class="session-info-value">
                    ${session.cwd ? session.cwd.split('/').pop() : 'Unknown'}
                  </span>
                </div>
              </div>
              
              ${session.summary ? html`
                <p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary);">
                  ${session.summary}
                </p>
              ` : ''}
            </div>
          </div>
        `)}
        
        ${this.sessions.length === 0 ? html`
          <div style="text-align: center; padding: var(--space-xl); color: var(--color-text-muted);">
            <div style="font-size: 3rem; margin-bottom: var(--space-md); opacity: 0.5;">📊</div>
            <p>No sessions to display</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render tablet view (horizontal timeline)
   */
  private _renderTabletView() {
    const sessionsByDate = this._groupSessionsByDate();
    
    return html`
      <div class="timeline-content-tablet">
        <div class="timeline-scroll-container">
          <div class="timeline-horizontal">
            ${Array.from(sessionsByDate.entries()).map(([date, sessions]) => html`
              <div class="timeline-day-column">
                <div class="timeline-day-header">
                  ${this._formatDate(new Date(date))}
                </div>
                <div class="timeline-day-sessions">
                  ${sessions.map(session => html`
                    <div 
                      class="timeline-session-item" 
                      @click="${() => this._handleSessionClick(session)}"
                    >
                      <div>${session.title || session.sessionId.substring(0, 8)}</div>
                      <div style="color: var(--color-text-secondary);">
                        ${this._formatTime(session.startTime)} • ${this._formatDuration(session)}
                      </div>
                    </div>
                  `)}
                </div>
              </div>
            `)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render desktop view (full timeline)
   */
  private _renderDesktopView() {
    return html`
      <div class="timeline-content-desktop">
        <div class="timeline-embed">
          <timeline-view
            .sessions="${this.sessions}"
            .title="${this.title}"
            .showFilters="${true}"
            .realTime="${true}"
          ></timeline-view>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="timeline-wrapper">
        <header class="timeline-header">
          <div class="timeline-title-row">
            <h2 class="timeline-title">${this.title}</h2>
            
            <div class="view-selector">
              <button 
                class="${classMap({ 'view-option': true, 'active': this._currentView === 'mobile' })}"
                @click="${() => this._handleViewChange('mobile')}"
                title="Mobile card view"
              >
                📱 Cards
              </button>
              <button 
                class="${classMap({ 'view-option': true, 'active': this._currentView === 'tablet' })}"
                @click="${() => this._handleViewChange('tablet')}"
                title="Tablet horizontal timeline"
              >
                📊 Timeline
              </button>
              <button 
                class="${classMap({ 'view-option': true, 'active': this._currentView === 'desktop' })}"
                @click="${() => this._handleViewChange('desktop')}"
                title="Desktop full timeline"
              >
                🖥️ Full
              </button>
            </div>
          </div>
          
          <div class="timeline-controls-row">
            <span style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
              ${this.sessions.length} session${this.sessions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </header>
        
        <!-- Mobile View -->
        ${when(this._currentView === 'mobile', () => this._renderMobileView())}
        
        <!-- Tablet View -->
        ${when(this._currentView === 'tablet', () => this._renderTabletView())}
        
        <!-- Desktop View -->
        ${when(this._currentView === 'desktop', () => this._renderDesktopView())}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'responsive-timeline-wrapper': ResponsiveTimelineWrapper;
  }
}