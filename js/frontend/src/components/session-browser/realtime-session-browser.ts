import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { SessionSummary, SessionDetail } from '../types/session-types';
import SessionBrowserWebSocket, { 
  SessionBrowserWebSocketConfig,
  NotificationPreferences,
  SessionUpdate,
  ConnectionStatus,
  NotificationData
} from '../../services/session-browser-websocket';
import { NotificationService } from '../../services/notification-service';
import { baseStyles } from '../styles/theme';

// Import our custom components
import './session-state-indicator';
import './connection-status-indicator';
import './notification-preferences';
import './notification-manager';
import './live-message-stream';

export interface RealtimeSessionBrowserConfig {
  enableRealtime?: boolean;
  enableNotifications?: boolean;
  enableStateIndicators?: boolean;
  enableConnectionStatus?: boolean;
  enableLiveMessages?: boolean;
  enableSessionFiltering?: boolean;
  enableMultiSelection?: boolean;
  showSessionDetails?: boolean;
  webSocketConfig?: SessionBrowserWebSocketConfig;
  notificationPreferences?: NotificationPreferences;
  autoConnect?: boolean;
  debugMode?: boolean;
}

export interface SessionBrowserState {
  isLoading: boolean;
  sessions: SessionSummary[];
  selectedSession: SessionDetail | null;
  selectedSessionIds: Set<string>;
  connectionStatus: ConnectionStatus;
  lastUpdate: Date;
  filterText: string;
  sortBy: 'startTime' | 'title' | 'messageCount' | 'duration';
  sortOrder: 'asc' | 'desc';
  viewMode: 'list' | 'grid' | 'detailed';
}

/**
 * Comprehensive real-time session browser component
 * Integrates all WebSocket features into a unified session management interface
 */
@customElement('realtime-session-browser')
export class RealtimeSessionBrowser extends LitElement {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-background);
        font-family: var(--font-family);
        position: relative;
      }

      .browser-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: var(--space-md);
      }

      .browser-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .title-icon {
        font-size: var(--font-size-lg);
      }

      .session-count {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        background: var(--color-background-tertiary);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius-full);
        font-family: var(--font-family-mono);
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .search-filter {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        width: 280px;
      }

      .search-input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
      }

      .search-input::placeholder {
        color: var(--color-text-muted);
      }

      .filter-controls {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .control-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .control-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
        color: var(--color-text-primary);
      }

      .control-button.active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .browser-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-sm) var(--space-md);
        background: var(--color-background-tertiary);
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .toolbar-left {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .toolbar-right {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .view-mode-toggle {
        display: flex;
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .view-mode-button {
        background: none;
        border: none;
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);
        font-size: var(--font-size-sm);
      }

      .view-mode-button:hover {
        background: var(--color-background-tertiary);
        color: var(--color-text-primary);
      }

      .view-mode-button.active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
      }

      .sort-selector {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        padding: var(--space-xs) var(--space-sm);
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        cursor: pointer;
      }

      .browser-content {
        flex: 1;
        display: flex;
        min-height: 0;
      }

      .session-list-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .realtime-updates {
        border-bottom: 1px solid var(--color-border);
      }

      .session-list {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-md);
      }

      .session-item {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-md);
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        margin-bottom: var(--space-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
        position: relative;
      }

      .session-item:hover {
        background: var(--color-background-secondary);
        border-color: var(--color-primary);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .session-item.selected {
        background: var(--color-primary-light);
        border-color: var(--color-primary);
      }

      .session-item.grid {
        flex-direction: column;
        text-align: center;
        min-height: 180px;
        justify-content: space-between;
      }

      .session-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .session-title {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .session-details {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .session-meta {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
      }

      .session-actions {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        opacity: 0;
        transition: opacity var(--transition-fast);
      }

      .session-item:hover .session-actions {
        opacity: 1;
      }

      .action-button {
        background: none;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        padding: var(--space-xs);
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);
        font-size: var(--font-size-xs);
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .action-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
        color: var(--color-text-primary);
      }

      .session-detail-panel {
        width: 400px;
        border-left: 1px solid var(--color-border);
        background: var(--color-background);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .detail-header {
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-bottom: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .detail-title {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0;
      }

      .detail-content {
        flex: 1;
        overflow-y: auto;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: var(--space-xxl);
        text-align: center;
        color: var(--color-text-muted);
      }

      .empty-icon {
        font-size: 4rem;
        margin-bottom: var(--space-lg);
        opacity: 0.5;
      }

      .empty-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-medium);
        margin-bottom: var(--space-sm);
      }

      .empty-description {
        font-size: var(--font-size-base);
        line-height: 1.5;
        max-width: 400px;
      }

      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(var(--color-background-rgb), 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
      }

      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--color-border);
        border-top: 3px solid var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Grid view adjustments */
      .session-list.grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--space-md);
      }

      .session-list.grid .session-item {
        margin-bottom: 0;
      }

      /* Mobile responsiveness */
      @media (max-width: 1024px) {
        .session-detail-panel {
          width: 350px;
        }
      }

      @media (max-width: 768px) {
        .browser-header {
          flex-direction: column;
          gap: var(--space-md);
          align-items: stretch;
        }

        .search-filter {
          width: 100%;
        }

        .browser-toolbar {
          flex-direction: column;
          gap: var(--space-sm);
          align-items: stretch;
        }

        .session-detail-panel {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          z-index: 1000;
          transform: translateX(100%);
          transition: transform var(--transition-medium);
        }

        .session-detail-panel.open {
          transform: translateX(0);
        }
      }
    `,
  ];

  @property({ type: Object })
  config: RealtimeSessionBrowserConfig = {
    enableRealtime: true,
    enableNotifications: true,
    enableStateIndicators: true,
    enableConnectionStatus: true,
    enableLiveMessages: true,
    enableSessionFiltering: true,
    enableMultiSelection: false,
    showSessionDetails: true,
    autoConnect: true,
    debugMode: false,
  };

  @state()
  private browserState: SessionBrowserState = {
    isLoading: false,
    sessions: [],
    selectedSession: null,
    selectedSessionIds: new Set(),
    connectionStatus: {
      connected: false,
      connecting: false,
      reconnecting: false,
      reconnectionAttempts: 0,
      quality: 'disconnected',
    },
    lastUpdate: new Date(),
    filterText: '',
    sortBy: 'startTime',
    sortOrder: 'desc',
    viewMode: 'list',
  };

  private webSocketService: SessionBrowserWebSocket | null = null;
  private notificationService: NotificationService | null = null;

  async connectedCallback() {
    super.connectedCallback();
    await this.initializeServices();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanupServices();
  }

  render() {
    return html`
      ${this.renderHeader()}
      ${this.renderToolbar()}
      <div class="browser-content">
        ${this.renderSessionList()}
        ${this.config.showSessionDetails && this.browserState.selectedSession 
          ? this.renderDetailPanel() 
          : ''}
      </div>
      ${this.browserState.isLoading ? this.renderLoadingOverlay() : ''}
    `;
  }

  private renderHeader() {
    const filteredSessions = this.getFilteredSessions();
    
    return html`
      <div class="browser-header">
        <div class="header-left">
          <h1 class="browser-title">
            <span class="title-icon">🚀</span>
            Claude Code Sessions
          </h1>
          <span class="session-count">
            ${filteredSessions.length} of ${this.browserState.sessions.length}
          </span>
        </div>
        
        <div class="header-right">
          <div class="search-filter">
            <span>🔍</span>
            <input
              class="search-input"
              type="text"
              placeholder="Search sessions..."
              .value=${this.browserState.filterText}
              @input=${this.handleFilterChange}
            />
          </div>
          
          ${this.config.enableConnectionStatus ? html`
            <connection-status-indicator
              .connectionStatus=${this.browserState.connectionStatus}
              .config=${{
                showLabel: true,
                showLatency: true,
                showQuality: true,
                showReconnectButton: true,
                showDetails: true,
              }}
              .actions=${{
                onReconnect: () => this.reconnectWebSocket(),
                onDisconnect: () => this.disconnectWebSocket(),
                onTestConnection: () => this.testConnection(),
              }}
            ></connection-status-indicator>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderToolbar() {
    return html`
      <div class="browser-toolbar">
        <div class="toolbar-left">
          <div class="view-mode-toggle">
            <button 
              class="view-mode-button ${this.browserState.viewMode === 'list' ? 'active' : ''}"
              @click=${() => this.setViewMode('list')}
            >
              📋 List
            </button>
            <button 
              class="view-mode-button ${this.browserState.viewMode === 'grid' ? 'active' : ''}"
              @click=${() => this.setViewMode('grid')}
            >
              ⊞ Grid
            </button>
            <button 
              class="view-mode-button ${this.browserState.viewMode === 'detailed' ? 'active' : ''}"
              @click=${() => this.setViewMode('detailed')}
            >
              📄 Detailed
            </button>
          </div>
        </div>
        
        <div class="toolbar-right">
          <select 
            class="sort-selector"
            .value=${`${this.browserState.sortBy}-${this.browserState.sortOrder}`}
            @change=${this.handleSortChange}
          >
            <option value="startTime-desc">Newest First</option>
            <option value="startTime-asc">Oldest First</option>
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
            <option value="messageCount-desc">Most Messages</option>
            <option value="messageCount-asc">Fewest Messages</option>
            <option value="duration-desc">Longest Duration</option>
            <option value="duration-asc">Shortest Duration</option>
          </select>
          
          <button class="control-button" @click=${this.refreshSessions} title="Refresh">
            🔄 Refresh
          </button>
          
          <button class="control-button" @click=${this.showNotificationPreferences} title="Notification Preferences">
            🔔 Notifications
          </button>
        </div>
      </div>
    `;
  }

  private renderSessionList() {
    const filteredSessions = this.getFilteredSessions();
    const sortedSessions = this.getSortedSessions(filteredSessions);

    return html`
      <div class="session-list-container">
        ${this.config.enableRealtime ? html`
          <session-list-realtime-updates
            class="realtime-updates"
            .webSocketConfig=${this.config.webSocketConfig}
            .sessions=${this.browserState.sessions}
            @sessions-updated=${this.handleSessionsUpdated}
            @session-added=${this.handleSessionAdded}
            @session-modified=${this.handleSessionModified}
          ></session-list-realtime-updates>
        ` : ''}
        
        <div class="session-list ${this.browserState.viewMode}">
          ${sortedSessions.length === 0 ? this.renderEmptyState() : ''}
          ${sortedSessions.map(session => this.renderSessionItem(session))}
        </div>
      </div>
    `;
  }

  private renderSessionItem(session: SessionSummary) {
    const isSelected = this.browserState.selectedSession?.sessionId === session.sessionId;
    const isMultiSelected = this.browserState.selectedSessionIds.has(session.sessionId);

    const itemClasses = classMap({
      'session-item': true,
      'selected': isSelected,
      'multi-selected': isMultiSelected,
      [this.browserState.viewMode]: true,
    });

    return html`
      <div 
        class="${itemClasses}" 
        @click=${() => this.selectSession(session)}
        @dblclick=${() => this.openSession(session)}
      >
        ${this.config.enableStateIndicators ? html`
          <session-state-indicator
            .stateData=${{
              current: session.isActive ? 'active' : 'idle',
              timestamp: session.startTime,
              reason: session.isActive ? 'Session is running' : 'Session completed',
            }}
            .config=${{
              showLabel: this.browserState.viewMode !== 'list',
              showProgress: false,
              compactMode: this.browserState.viewMode === 'list',
            }}
          ></session-state-indicator>
        ` : ''}

        <div class="session-info">
          <h3 class="session-title">${session.title || `Session ${session.sessionId.substring(0, 8)}`}</h3>
          
          <div class="session-details">
            <span>📅 ${this.formatDateTime(session.startTime)}</span>
            <span>💬 ${session.messageCount} messages</span>
            ${session.duration ? html`<span>⏱️ ${this.formatDuration(session.duration)}</span>` : ''}
          </div>
          
          <div class="session-meta">
            <span>📁 ${session.cwd}</span>
            ${session.tags?.length ? html`
              <span>🏷️ ${session.tags.slice(0, 3).join(', ')}${session.tags.length > 3 ? '...' : ''}</span>
            ` : ''}
          </div>
        </div>

        <div class="session-actions">
          <button 
            class="action-button" 
            @click=${(e: Event) => this.viewSessionDetails(e, session)}
            title="View details"
          >
            👁️
          </button>
          
          ${this.config.enableLiveMessages && session.isActive ? html`
            <button 
              class="action-button" 
              @click=${(e: Event) => this.viewLiveMessages(e, session)}
              title="View live messages"
            >
              📡
            </button>
          ` : ''}
          
          <button 
            class="action-button" 
            @click=${(e: Event) => this.openSession(session, e)}
            title="Open session"
          >
            🚀
          </button>
        </div>
      </div>
    `;
  }

  private renderDetailPanel() {
    if (!this.browserState.selectedSession) return '';

    const session = this.browserState.selectedSession;

    return html`
      <div class="session-detail-panel">
        <div class="detail-header">
          <h3 class="detail-title">Session Details</h3>
          <button 
            class="control-button" 
            @click=${this.closeDetailPanel}
            title="Close details"
          >
            ✕
          </button>
        </div>
        
        <div class="detail-content">
          ${this.config.enableLiveMessages && session.isActive ? html`
            <live-message-stream
              .session=${session}
              .webSocketService=${this.webSocketService}
              .config=${{
                autoScroll: true,
                showTimestamps: true,
                highlightNewMessages: true,
                playMessageSounds: false,
              }}
            ></live-message-stream>
          ` : ''}
          
          ${!session.isActive || !this.config.enableLiveMessages ? html`
            <div style="padding: var(--space-md);">
              <h4>Session Information</h4>
              <p><strong>ID:</strong> ${session.sessionId}</p>
              <p><strong>Started:</strong> ${session.startTime.toLocaleString()}</p>
              ${session.endTime ? html`<p><strong>Ended:</strong> ${session.endTime.toLocaleString()}</p>` : ''}
              <p><strong>Messages:</strong> ${session.messageCount}</p>
              <p><strong>Working Directory:</strong> ${session.cwd}</p>
              ${session.summary ? html`<p><strong>Summary:</strong> ${session.summary}</p>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-title">No Sessions Found</div>
        <div class="empty-description">
          ${this.browserState.filterText 
            ? `No sessions match "${this.browserState.filterText}"`
            : 'No Claude Code sessions available. Start a new conversation to see it here.'}
        </div>
      </div>
    `;
  }

  private renderLoadingOverlay() {
    return html`
      <div class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>
    `;
  }

  // Event Handlers

  private handleFilterChange(e: Event) {
    const target = e.target as HTMLInputElement;
    this.browserState = { ...this.browserState, filterText: target.value };
  }

  private handleSortChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const [sortBy, sortOrder] = target.value.split('-');
    this.browserState = {
      ...this.browserState,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    };
  }

  private handleSessionsUpdated(e: CustomEvent) {
    this.browserState = {
      ...this.browserState,
      sessions: e.detail.sessions || this.browserState.sessions,
      lastUpdate: new Date(),
    };
  }

  private handleSessionAdded(e: CustomEvent) {
    const newSession = e.detail.session;
    if (newSession && !this.browserState.sessions.find(s => s.sessionId === newSession.sessionId)) {
      this.browserState = {
        ...this.browserState,
        sessions: [...this.browserState.sessions, newSession],
        lastUpdate: new Date(),
      };
    }
  }

  private handleSessionModified(e: CustomEvent) {
    const modifiedSession = e.detail.session;
    if (modifiedSession) {
      this.browserState = {
        ...this.browserState,
        sessions: this.browserState.sessions.map(s => 
          s.sessionId === modifiedSession.sessionId ? { ...s, ...modifiedSession } : s
        ),
        lastUpdate: new Date(),
      };
    }
  }

  // Session Management

  private selectSession(session: SessionSummary) {
    if (this.config.enableMultiSelection) {
      const newSelectedIds = new Set(this.browserState.selectedSessionIds);
      if (newSelectedIds.has(session.sessionId)) {
        newSelectedIds.delete(session.sessionId);
      } else {
        newSelectedIds.add(session.sessionId);
      }
      this.browserState = { ...this.browserState, selectedSessionIds: newSelectedIds };
    } else {
      this.loadSessionDetails(session.sessionId);
    }
  }

  private async loadSessionDetails(sessionId: string) {
    this.browserState = { ...this.browserState, isLoading: true };
    
    try {
      // In a real implementation, this would fetch full session details
      const sessionSummary = this.browserState.sessions.find(s => s.sessionId === sessionId);
      if (sessionSummary) {
        const sessionDetail: SessionDetail = {
          ...sessionSummary,
          messages: [], // Would be populated from API
        };
        
        this.browserState = {
          ...this.browserState,
          selectedSession: sessionDetail,
          isLoading: false,
        };
      }
    } catch (error) {
      console.error('Failed to load session details:', error);
      this.browserState = { ...this.browserState, isLoading: false };
    }
  }

  private openSession(session: SessionSummary, e?: Event) {
    if (e) {
      e.stopPropagation();
    }
    
    this.dispatchEvent(new CustomEvent('session-open', {
      detail: { session },
      bubbles: true,
    }));
  }

  private viewSessionDetails(e: Event, session: SessionSummary) {
    e.stopPropagation();
    this.loadSessionDetails(session.sessionId);
  }

  private viewLiveMessages(e: Event, session: SessionSummary) {
    e.stopPropagation();
    this.loadSessionDetails(session.sessionId);
    
    // Subscribe to live updates for this session
    if (this.webSocketService) {
      this.webSocketService.subscribeToSession(session.sessionId);
    }
  }

  private closeDetailPanel() {
    this.browserState = { ...this.browserState, selectedSession: null };
  }

  // UI Control Methods

  private setViewMode(mode: 'list' | 'grid' | 'detailed') {
    this.browserState = { ...this.browserState, viewMode: mode };
  }

  private async refreshSessions() {
    this.browserState = { ...this.browserState, isLoading: true };
    
    try {
      // In a real implementation, this would fetch from API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading
      
      if (this.webSocketService) {
        // Request fresh session data via WebSocket
        // This would trigger session updates through the WebSocket service
      }
    } catch (error) {
      console.error('Failed to refresh sessions:', error);
    } finally {
      this.browserState = { ...this.browserState, isLoading: false };
    }
  }

  private showNotificationPreferences() {
    // Create and show notification preferences dialog
    const preferencesDialog = document.createElement('div');
    preferencesDialog.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); display: flex; align-items: center;
      justify-content: center; z-index: 10000;
    `;
    
    const preferencesComponent = document.createElement('notification-preferences');
    if (this.webSocketService) {
      preferencesComponent.preferences = this.webSocketService.getNotificationPreferences();
    }
    
    preferencesComponent.addEventListener('preferences-save', (e: any) => {
      if (this.webSocketService) {
        this.webSocketService.updateNotificationPreferences(e.detail.preferences);
      }
      if (this.notificationService) {
        this.notificationService.updatePreferences(e.detail.preferences);
      }
      document.body.removeChild(preferencesDialog);
    });
    
    preferencesDialog.appendChild(preferencesComponent);
    document.body.appendChild(preferencesDialog);
    
    // Close on backdrop click
    preferencesDialog.addEventListener('click', (e) => {
      if (e.target === preferencesDialog) {
        document.body.removeChild(preferencesDialog);
      }
    });
  }

  // WebSocket Management

  private async reconnectWebSocket() {
    if (this.webSocketService) {
      try {
        await this.webSocketService.connect();
      } catch (error) {
        console.error('Failed to reconnect:', error);
      }
    }
  }

  private disconnectWebSocket() {
    if (this.webSocketService) {
      this.webSocketService.disconnect();
    }
  }

  private async testConnection() {
    if (this.webSocketService) {
      const isHealthy = await this.webSocketService.testConnection();
      
      if (this.notificationService) {
        this.notificationService.showNotification({
          id: `connection-test-${Date.now()}`,
          type: isHealthy ? 'success' : 'error',
          title: 'Connection Test',
          message: isHealthy ? 'Connection is healthy' : 'Connection test failed',
          timestamp: new Date(),
        });
      }
    }
  }

  // Service Management

  private async initializeServices() {
    try {
      // Initialize WebSocket service
      if (this.config.enableRealtime) {
        this.webSocketService = new SessionBrowserWebSocket({
          enableNotifications: this.config.enableNotifications,
          debug: this.config.debugMode,
          ...this.config.webSocketConfig,
        });

        // Setup WebSocket event listeners
        this.setupWebSocketListeners();

        if (this.config.autoConnect) {
          await this.webSocketService.connect();
        }
      }

      // Initialize notification service
      if (this.config.enableNotifications) {
        this.notificationService = new NotificationService({
          enableBrowserNotifications: true,
          enableInAppNotifications: true,
          enableSoundNotifications: false,
          debugMode: this.config.debugMode,
        });

        await this.notificationService.initialize(this.webSocketService || undefined);
      }

      this.debug('Services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize services:', error);
    }
  }

  private setupWebSocketListeners() {
    if (!this.webSocketService) return;

    this.webSocketService.on('connection-status-changed', (status) => {
      this.browserState = { ...this.browserState, connectionStatus: status };
    });

    this.webSocketService.on('session-created', (session) => {
      this.handleSessionAdded({ detail: { session } } as CustomEvent);
    });

    this.webSocketService.on('session-updated', (session) => {
      this.handleSessionModified({ detail: { session } } as CustomEvent);
    });
  }

  private cleanupServices() {
    if (this.webSocketService) {
      this.webSocketService.disconnect();
      this.webSocketService = null;
    }

    if (this.notificationService) {
      this.notificationService.destroy();
      this.notificationService = null;
    }
  }

  // Utility Methods

  private getFilteredSessions(): SessionSummary[] {
    if (!this.browserState.filterText) {
      return this.browserState.sessions;
    }

    const filter = this.browserState.filterText.toLowerCase();
    return this.browserState.sessions.filter(session =>
      session.title?.toLowerCase().includes(filter) ||
      session.sessionId.toLowerCase().includes(filter) ||
      session.cwd.toLowerCase().includes(filter) ||
      session.summary?.toLowerCase().includes(filter) ||
      session.tags?.some(tag => tag.toLowerCase().includes(filter))
    );
  }

  private getSortedSessions(sessions: SessionSummary[]): SessionSummary[] {
    return [...sessions].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (this.browserState.sortBy) {
        case 'startTime':
          aValue = a.startTime.getTime();
          bValue = b.startTime.getTime();
          break;
        case 'title':
          aValue = a.title || '';
          bValue = b.title || '';
          break;
        case 'messageCount':
          aValue = a.messageCount;
          bValue = b.messageCount;
          break;
        case 'duration':
          aValue = a.duration || 0;
          bValue = b.duration || 0;
          break;
        default:
          return 0;
      }

      if (this.browserState.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private debug(...args: any[]) {
    if (this.config.debugMode) {
      console.log('[RealtimeSessionBrowser]', ...args);
    }
  }

  // Public API

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RealtimeSessionBrowserConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current sessions
   */
  getSessions(): SessionSummary[] {
    return [...this.browserState.sessions];
  }

  /**
   * Get selected session
   */
  getSelectedSession(): SessionDetail | null {
    return this.browserState.selectedSession;
  }

  /**
   * Select session programmatically
   */
  selectSessionById(sessionId: string) {
    const session = this.browserState.sessions.find(s => s.sessionId === sessionId);
    if (session) {
      this.selectSession(session);
    }
  }

  /**
   * Get WebSocket service instance
   */
  getWebSocketService(): SessionBrowserWebSocket | null {
    return this.webSocketService;
  }

  /**
   * Get notification service instance
   */
  getNotificationService(): NotificationService | null {
    return this.notificationService;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'realtime-session-browser': RealtimeSessionBrowser;
  }
}