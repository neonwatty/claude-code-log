import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { SessionSummary } from '../types/session-types';
import { FilterController, FilterPanel } from '../filters';
import '../filters/FilterPanel';
import GSTC from 'gantt-schedule-timeline-calendar';

// GSTC plugins - these will be available at runtime
declare const TimelinePointer: any;
declare const Selection: any;
declare const ItemResizing: any;
declare const ItemMovement: any;

export interface TimelineData {
  rows: TimelineRow[];
  items: TimelineItem[];
  columns: TimelineColumn[];
}

export interface TimelineRow {
  id: string;
  label: string;
  parentId?: string;
  expanded?: boolean;
}

export interface TimelineItem {
  id: string;
  label: string;
  rowId: string;
  time: {
    start: number;
    end: number;
  };
  style?: {
    backgroundColor?: string;
    color?: string;
  };
  sessionId?: string;
}

export interface TimelineColumn {
  id: string;
  label: string;
  data: string | ((row: any) => any);
  width?: number;
  sortable?: string | boolean | ((row: any) => any);
  isHTML?: boolean;
  header?: {
    content: string;
  };
}

export interface TimelineFilter {
  dateRange?: {
    start: Date;
    end: Date;
  };
  sessionIds?: string[];
  workingDirectories?: string[];
}

/**
 * Interactive timeline component using GSTC library
 * Displays sessions as timeline items with zoom and filter functionality
 */
@customElement('timeline-view')
export class TimelineView extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 400px;
      }

      .timeline-container {
        position: relative;
        width: 100%;
        height: 100%;
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .timeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-bottom: 1px solid var(--color-border);
        gap: var(--space-md);
      }

      .timeline-title {
        margin: 0;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }

      .timeline-controls {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .control-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        transition: all var(--transition-fast);
      }

      .control-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
      }

      .control-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .control-button.active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .zoom-controls {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs);
      }

      .zoom-button {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        padding: var(--space-xs);
        border-radius: var(--border-radius-sm);
        transition: color var(--transition-fast);
      }

      .zoom-button:hover {
        color: var(--color-text-primary);
        background: var(--color-background-tertiary);
      }

      .zoom-level {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        min-width: 60px;
        text-align: center;
      }

      .filter-controls {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .filter-input {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        background: var(--color-background);
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
        min-width: 150px;
      }

      .filter-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: var(--shadow-focus);
      }

      .timeline-content {
        height: calc(100% - 70px); /* Subtract header height */
        position: relative;
      }

      .gstc-container {
        width: 100%;
        height: 100%;
      }

      /* GSTC Custom Styling */
      :host .gstc__chart-timeline-items-row-item {
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: all 0.2s ease;
      }

      :host .gstc__chart-timeline-items-row-item:hover {
        opacity: 0.9;
        transform: scale(1.02);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      /* Session-specific item styling */
      :host .gstc__chart-timeline-items-row-item.session-active {
        background: var(--color-success);
        border-color: var(--color-success-dark);
      }

      :host .gstc__chart-timeline-items-row-item.session-completed {
        background: var(--color-primary);
        border-color: var(--color-primary-dark);
      }

      :host .gstc__chart-timeline-items-row-item.session-error {
        background: var(--color-error);
        border-color: var(--color-error-dark);
      }

      /* Loading and error states */
      .loading-state {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 200px;
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
      }

      .error-state {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 200px;
        color: var(--color-text-muted);
        text-align: center;
        gap: var(--space-sm);
      }

      .error-icon {
        font-size: 2rem;
        color: var(--color-error);
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 300px;
        color: var(--color-text-muted);
        text-align: center;
        gap: var(--space-md);
      }

      .empty-icon {
        font-size: 3rem;
        opacity: 0.5;
      }

      @media (max-width: 768px) {
        .timeline-header {
          flex-direction: column;
          align-items: stretch;
          gap: var(--space-sm);
        }

        .timeline-controls {
          flex-wrap: wrap;
          justify-content: center;
        }

        .filter-input {
          min-width: auto;
          flex: 1;
        }
      }
    `,
  ];

  /**
   * Sessions data to display in timeline
   */
  @property({ type: Array })
  sessions: SessionSummary[] = [];

  /**
   * Current filter configuration
   */
  @property({ type: Object })
  filter: TimelineFilter = {};

  /**
   * Timeline title
   */
  @property({ type: String })
  title = 'Session Timeline';

  /**
   * Whether to enable real-time updates
   */
  @property({ type: Boolean })
  realTime = true;

  /**
   * Whether to show session details in tooltip
   */
  @property({ type: Boolean })
  showTooltips = true;

  /**
   * Timeline zoom level (hours, days, weeks, months)
   */
  @property({ type: String })
  zoomLevel: 'hours' | 'days' | 'weeks' | 'months' = 'days';

  @state()
  private gstcInstance: any = null;

  @state()
  private timelineData: TimelineData = {
    rows: [],
    items: [],
    columns: []
  };

  @state()
  private selectedSessionId?: string;

  @state()
  private filterController = new FilterController(this);

  /**
   * Whether to show the filter panel
   */
  @property({ type: Boolean })
  showFilters = true;

  /**
   * Whether the filter panel should be initially collapsed
   */
  @property({ type: Boolean })
  filtersCollapsed = false;

  @query('.gstc-container')
  private gstcContainer!: HTMLElement;

  render() {
    return html`
      <div class="timeline-container">
        ${this.showFilters ? html`
          <filter-panel
            .filterController=${this.filterController}
            .collapsed=${this.filtersCollapsed}
            collapsible
            @panel-toggled=${this.handleFilterPanelToggled}
          ></filter-panel>
        ` : ''}
        ${this.renderHeader()}
        <div class="timeline-content">
          ${this.loading ? this.renderLoading() : ''}
          ${this.error ? this.renderError() : ''}
          ${!this.loading && !this.error && this.sessions.length === 0 ? this.renderEmptyState() : ''}
          ${!this.loading && !this.error && this.sessions.length > 0 ? html`
            <div class="gstc-container"></div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderHeader() {
    return html`
      <div class="timeline-header">
        <h2 class="timeline-title">${this.title}</h2>
        <div class="timeline-controls">
          <div class="zoom-controls">
            <button class="zoom-button" @click=${this.zoomOut} title="Zoom out">−</button>
            <span class="zoom-level">${this.zoomLevel}</span>
            <button class="zoom-button" @click=${this.zoomIn} title="Zoom in">+</button>
          </div>
          <div class="filter-controls">
            <input
              class="filter-input"
              type="date"
              placeholder="Start date"
              @change=${this.handleDateRangeStart}
            />
            <input
              class="filter-input"
              type="date"
              placeholder="End date"
              @change=${this.handleDateRangeEnd}
            />
          </div>
          <button class="control-button" @click=${this.fitToContent} title="Fit to content">
            📏 Fit
          </button>
          <button class="control-button" @click=${this.exportTimeline} title="Export timeline">
            📥 Export
          </button>
        </div>
      </div>
    `;
  }

  private renderLoading() {
    return html`
      <div class="loading-state">
        <span>Loading timeline...</span>
      </div>
    `;
  }

  private renderError() {
    return html`
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <div>Failed to load timeline</div>
        <div>${this.error}</div>
        <button class="control-button" @click=${this.retryLoad}>Retry</button>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div>No sessions to display</div>
        <div>Sessions will appear on the timeline once data is loaded</div>
      </div>
    `;
  }

  protected firstUpdated(changedProperties: Map<string, any>) {
    super.firstUpdated(changedProperties);
    this.initializeTimeline();
  }

  protected updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);

    if (changedProperties.has('sessions')) {
      this.updateTimelineData();
    }

    if (changedProperties.has('filter')) {
      this.applyFilters();
    }

    if (changedProperties.has('zoomLevel')) {
      this.updateZoom();
    }
  }

  private initializeTimeline() {
    if (!this.gstcContainer) return;

    try {
      // Check if GSTC is available
      if (typeof GSTC === 'undefined') {
        console.warn('GSTC library not loaded, timeline will show placeholder');
        this.renderPlaceholderTimeline();
        return;
      }

      // Convert session data to GSTC format
      this.updateTimelineData();

      // Simplified GSTC configuration for demo
      const config = {
        // Use a demo license or skip for development
        licenseKey: '',
        
        // Basic list configuration
        list: {
          columns: {
            data: GSTC.api.fromArray(this.timelineData.columns),
          },
          rows: GSTC.api.fromArray(this.timelineData.rows),
        },

        // Basic chart configuration
        chart: {
          items: GSTC.api.fromArray(this.timelineData.items),
        },
      };

      // Generate GSTC state from configuration
      const state = GSTC.api.stateFromConfig(config);

      // Create GSTC instance
      this.gstcInstance = GSTC({
        element: this.gstcContainer,
        state,
      });

      // Store reference for cleanup
      (window as any).gstcInstance = this.gstcInstance;

      this.emitEvent('timeline-initialized', { instance: this.gstcInstance });

    } catch (error) {
      console.error('Failed to initialize timeline:', error);
      this.renderPlaceholderTimeline();
    }
  }

  private renderPlaceholderTimeline() {
    if (!this.gstcContainer) return;
    
    this.gstcContainer.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: 4px;
      ">
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          text-align: center;
          color: var(--color-text-secondary);
          padding: 2rem;
        ">
          <div>
            <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">📊</div>
            <div style="font-size: 1.1rem; margin-bottom: 0.5rem;">Timeline Placeholder</div>
            <div style="font-size: 0.9rem;">
              GSTC library integration in progress.<br>
              Sessions: ${this.sessions.length}
            </div>
          </div>
        </div>
        <div style="
          padding: 1rem;
          background: var(--color-background-secondary);
          border-top: 1px solid var(--color-border);
          font-size: 0.8rem;
          color: var(--color-text-muted);
        ">
          ${this.sessions.map(s => 
            `<span style="margin-right: 1rem; opacity: 0.7;">
              ${s.sessionId.substring(0,8)} (${s.isActive ? 'active' : 'completed'})
            </span>`
          ).join('')}
        </div>
      </div>
    `;
  }

  private updateTimelineData() {
    if (!this.sessions.length) return;

    const filteredSessions = this.getFilteredSessions();
    
    // Group sessions by working directory
    const sessionsByDir = new Map<string, SessionSummary[]>();
    filteredSessions.forEach(session => {
      const dir = session.cwd || 'Unknown';
      if (!sessionsByDir.has(dir)) {
        sessionsByDir.set(dir, []);
      }
      sessionsByDir.get(dir)!.push(session);
    });

    // Create rows (one per directory)
    const rows: TimelineRow[] = Array.from(sessionsByDir.keys()).map((dir, index) => ({
      id: `dir-${index}`,
      label: dir.split('/').pop() || dir,
    }));

    // Create timeline items (one per session)
    const items: TimelineItem[] = [];
    let itemIndex = 0;

    sessionsByDir.forEach((sessions, dir) => {
      const rowIndex = rows.findIndex(row => row.label === (dir.split('/').pop() || dir));
      const rowId = `dir-${rowIndex}`;

      sessions.forEach(session => {
        const endTime = session.endTime || new Date();
        const duration = endTime.getTime() - session.startTime.getTime();
        
        // Ensure minimum visible duration (5 minutes)
        const minDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
        const adjustedEndTime = duration < minDuration 
          ? new Date(session.startTime.getTime() + minDuration)
          : endTime;

        items.push({
          id: `session-${itemIndex++}`,
          label: session.title || session.sessionId.substring(0, 8),
          rowId,
          time: {
            start: session.startTime.getTime(),
            end: adjustedEndTime.getTime(),
          },
          style: {
            backgroundColor: this.getSessionColor(session),
            color: '#ffffff',
          },
          sessionId: session.sessionId,
        });
      });
    });

    // Create columns for the list panel
    const columns: TimelineColumn[] = [
      {
        id: 'id',
        label: 'Directory',
        data: 'label',
        width: 200,
        header: {
          content: 'Working Directory',
        },
      },
      {
        id: 'sessionCount',
        label: 'Sessions',
        data: (row: any) => {
          const dir = Array.from(sessionsByDir.keys())[parseInt(row.id.split('-')[1])];
          return sessionsByDir.get(dir)?.length || 0;
        },
        width: 80,
        header: {
          content: 'Sessions',
        },
      },
    ];

    this.timelineData = { rows, items, columns };

    // Update GSTC instance if it exists
    if (this.gstcInstance) {
      this.gstcInstance.state.update('config.list.rows', GSTC.api.fromArray(rows));
      this.gstcInstance.state.update('config.chart.items', GSTC.api.fromArray(items));
      this.gstcInstance.state.update('config.list.columns', GSTC.api.fromArray(columns));
    }
  }

  private getFilteredSessions(): SessionSummary[] {
    // Convert sessions to the format expected by FilterController
    const sessionsWithMetadata = this.sessions.map(session => ({
      id: session.sessionId,
      content: `${session.title || ''} ${session.summary || ''} ${session.tags?.join(' ') || ''}`,
      role: session.isActive ? 'active' : 'completed' as any,
      timestamp: session.startTime,
      sessionId: session.sessionId,
      ...session, // Include original session data
    }));

    // Use FilterController to filter sessions
    const filterResult = this.filterController.filterMessages(sessionsWithMetadata);
    let filtered = filterResult.items;

    // Apply legacy TimelineFilter properties for backward compatibility
    if (this.filter.sessionIds) {
      filtered = filtered.filter(session => 
        this.filter.sessionIds!.includes(session.sessionId)
      );
    }

    if (this.filter.workingDirectories) {
      filtered = filtered.filter(session =>
        this.filter.workingDirectories!.includes(session.cwd)
      );
    }

    return filtered as SessionSummary[];
  }

  private getSessionColor(session: SessionSummary): string {
    if (session.isActive) return '#28a745'; // Green for active sessions
    if (session.endTime) return '#007bff'; // Blue for completed sessions
    return '#6c757d'; // Gray for other sessions
  }

  private getZoomLevel(): number {
    switch (this.zoomLevel) {
      case 'hours': return 21;
      case 'days': return 20;
      case 'weeks': return 19;
      case 'months': return 18;
      default: return 20;
    }
  }

  private updateZoom() {
    if (this.gstcInstance) {
      this.gstcInstance.state.update('config.chart.time.zoom', this.getZoomLevel());
    }
  }

  private applyFilters() {
    this.updateTimelineData();
  }

  // Event handlers
  private zoomIn() {
    const levels: Array<'hours' | 'days' | 'weeks' | 'months'> = ['hours', 'days', 'weeks', 'months'];
    const currentIndex = levels.indexOf(this.zoomLevel);
    if (currentIndex > 0) {
      this.zoomLevel = levels[currentIndex - 1];
    }
  }

  private zoomOut() {
    const levels: Array<'hours' | 'days' | 'weeks' | 'months'> = ['hours', 'days', 'weeks', 'months'];
    const currentIndex = levels.indexOf(this.zoomLevel);
    if (currentIndex < levels.length - 1) {
      this.zoomLevel = levels[currentIndex + 1];
    }
  }

  private fitToContent() {
    if (this.gstcInstance && this.timelineData.items.length > 0) {
      // Calculate time range from items
      const times = this.timelineData.items.map(item => [item.time.start, item.time.end]).flat();
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      // Add padding (10% on each side)
      const padding = (maxTime - minTime) * 0.1;
      const from = minTime - padding;
      const to = maxTime + padding;
      
      this.gstcInstance.state.update('config.chart.time', {
        from,
        to,
        zoom: this.getZoomLevel()
      });
    }
  }

  private exportTimeline() {
    // Implement export functionality
    const data = {
      sessions: this.getFilteredSessions(),
      timelineData: this.timelineData,
      exportDate: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-timeline-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.emitEvent('timeline-exported', { data });
  }

  private retryLoad() {
    this.error = null;
    this.loading = true;
    
    // Emit event for parent to retry loading data
    this.emitEvent('retry-load-requested');
    
    // Re-initialize timeline
    setTimeout(() => {
      this.loading = false;
      this.initializeTimeline();
    }, 1000);
  }

  private handleDateRangeStart(event: Event) {
    const input = event.target as HTMLInputElement;
    const date = new Date(input.value);
    this.filter = {
      ...this.filter,
      dateRange: {
        start: date,
        end: this.filter.dateRange?.end || new Date(),
      },
    };
    this.emitEvent('filter-changed', { filter: this.filter });
  }

  private handleDateRangeEnd(event: Event) {
    const input = event.target as HTMLInputElement;
    const date = new Date(input.value);
    this.filter = {
      ...this.filter,
      dateRange: {
        start: this.filter.dateRange?.start || new Date(0),
        end: date,
      },
    };
    this.emitEvent('filter-changed', { filter: this.filter });
  }

  private handleItemClick(data: any) {
    const sessionId = data.sessionId;
    if (sessionId) {
      this.selectedSessionId = sessionId;
      const session = this.sessions.find(s => s.sessionId === sessionId);
      if (session) {
        this.emitEvent('session-selected', { sessionId, session });
      }
    }
  }

  private handleItemDoubleClick(data: any) {
    const sessionId = data.sessionId;
    if (sessionId) {
      const session = this.sessions.find(s => s.sessionId === sessionId);
      if (session) {
        this.emitEvent('session-opened', { sessionId, session });
      }
    }
  }

  // Real-time updates
  addSession(session: SessionSummary) {
    this.sessions = [...this.sessions, session];
    this.emitEvent('session-added', { session });
  }

  updateSession(sessionId: string, updates: Partial<SessionSummary>) {
    const index = this.sessions.findIndex(s => s.sessionId === sessionId);
    if (index !== -1) {
      this.sessions[index] = { ...this.sessions[index], ...updates };
      this.sessions = [...this.sessions]; // Trigger reactivity
      this.emitEvent('session-updated', { sessionId, session: this.sessions[index] });
    }
  }

  removeSession(sessionId: string) {
    this.sessions = this.sessions.filter(s => s.sessionId !== sessionId);
    this.emitEvent('session-removed', { sessionId });
  }

  // Filter panel event handlers
  
  private handleFilterPanelToggled = (event: CustomEvent) => {
    this.filtersCollapsed = event.detail.collapsed;
    this.emitEvent('filters-toggled', { collapsed: this.filtersCollapsed });
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    
    // Clean up GSTC instance
    if (this.gstcInstance && this.gstcInstance.destroy) {
      this.gstcInstance.destroy();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'timeline-view': TimelineView;
  }
}