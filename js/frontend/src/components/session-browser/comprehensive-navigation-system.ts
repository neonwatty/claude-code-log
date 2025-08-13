import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { SessionSummary, SessionDetail, SessionBranchTree } from '../types/session-types';
import { withStateManager, SessionStateManager } from './session-state-manager';
import { generateId } from '../utils/accessibility';

// Import all navigation components
import './navigation/SessionNavigation';
import './session-management-actions';
import './session-router';
import './loading-states';
import './accessibility-enhancements';

/**
 * Comprehensive navigation system that integrates all navigation features
 * This is the main component that brings together:
 * - SessionNavigation (breadcrumbs, session switcher, branch visualization)
 * - SessionManagementActions (delete, archive, export, etc.)
 * - SessionRouter (URL routing and deep linking)
 * - State management and loading states
 * - Accessibility enhancements
 */
@customElement('comprehensive-navigation-system')
export class ComprehensiveNavigationSystem extends withStateManager(BaseComponent) {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        height: 100%;
        background: var(--color-background);
      }

      .navigation-system {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .navigation-header {
        flex-shrink: 0;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-background-secondary);
        z-index: 100;
      }

      .main-navigation {
        padding: var(--space-sm) var(--space-md);
      }

      .management-actions {
        border-top: 1px solid var(--color-border-light);
      }

      .content-area {
        flex: 1;
        display: flex;
        min-height: 0;
      }

      .sidebar {
        width: 300px;
        flex-shrink: 0;
        background: var(--color-background-secondary);
        border-right: 1px solid var(--color-border);
        transition: width var(--transition-normal);
        overflow: hidden;
      }

      .sidebar.collapsed {
        width: 0;
      }

      .main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .content-router {
        flex: 1;
        min-height: 0;
      }

      .system-status {
        padding: var(--space-sm) var(--space-md);
        background: var(--color-background-tertiary);
        border-top: 1px solid var(--color-border-light);
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .status-info {
        display: flex;
        gap: var(--space-md);
      }

      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(2px);
      }

      .error-toast {
        position: fixed;
        top: var(--space-md);
        right: var(--space-md);
        background: var(--color-danger);
        color: var(--color-text-inverse);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-lg);
        z-index: 2000;
        max-width: 400px;
        animation: slide-in 0.3s ease-out;
      }

      @keyframes slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .accessibility-toolbar {
        position: fixed;
        bottom: var(--space-md);
        right: var(--space-md);
        display: flex;
        gap: var(--space-xs);
        z-index: 1000;
      }

      .accessibility-button {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        cursor: pointer;
        box-shadow: var(--shadow-md);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--font-size-sm);
      }

      .accessibility-button:hover {
        background: var(--color-primary-dark);
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }

      .accessibility-button:focus {
        outline: 2px solid var(--color-primary-light);
        outline-offset: 2px;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .sidebar {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          z-index: 200;
          box-shadow: var(--shadow-lg);
        }

        .sidebar.collapsed {
          left: -300px;
        }

        .accessibility-toolbar {
          bottom: var(--space-sm);
          right: var(--space-sm);
        }

        .accessibility-button {
          width: 36px;
          height: 36px;
        }
      }

      /* High contrast mode */
      @media (prefers-contrast: high) {
        .navigation-header {
          border-bottom-width: 2px;
        }

        .sidebar {
          border-right-width: 2px;
        }

        .accessibility-button {
          border: 2px solid var(--color-text-inverse);
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .sidebar {
          transition: none;
        }

        .accessibility-button {
          transition: none;
        }

        .loading-overlay {
          backdrop-filter: none;
        }

        @keyframes slide-in {
          from,
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      }
    `,
  ];

  /**
   * Available sessions for navigation
   */
  @property({ type: Array })
  sessions: SessionSummary[] = [];

  /**
   * Currently selected session details
   */
  @property({ type: Object })
  currentSession: SessionDetail | null = null;

  /**
   * Branch tree for current session
   */
  @property({ type: Object })
  branchTree: SessionBranchTree | null = null;

  /**
   * Navigation configuration
   */
  @property({ type: Object })
  navigationConfig = {
    showBreadcrumbs: true,
    showSessionSwitcher: true,
    showBranchVisualization: true,
    showManagementActions: true,
    showKeyboardShortcuts: true,
    enableDeepLinking: true,
    enableBulkOperations: true,
  };

  @state()
  private navigationId = generateId('comprehensive-navigation');

  @state()
  private showKeyboardHelp = false;

  private stateManager = SessionStateManager.getInstance();

  render() {
    const { isLoading, error, showSidebar } = this.uiState;

    return html`
      <!-- Skip links for accessibility -->
      <skip-links></skip-links>

      <!-- Screen reader announcements -->
      <screen-reader-announcements></screen-reader-announcements>

      <div class="navigation-system" role="application" aria-label="Session browser">
        <!-- Navigation Header -->
        <header class="navigation-header" role="banner">
          <div id="session-navigation" class="main-navigation">
            <session-navigation
              .currentSession=${this.currentSession}
              .sessions=${this.sessions}
              .branchTree=${this.branchTree}
              .showShortcuts=${this.navigationConfig.showKeyboardShortcuts}
              .showBranches=${this.navigationConfig.showBranchVisualization}
              @session-navigate=${this.handleSessionNavigate}
              @branch-navigate=${this.handleBranchNavigate}
              @branch-requested=${this.handleBranchRequested}
              @branch-compare-requested=${this.handleBranchCompare}
              @branch-delete-requested=${this.handleBranchDelete}
            ></session-navigation>
          </div>

          ${this.navigationConfig.showManagementActions ? html`
            <div class="management-actions">
              <session-management-actions
                .sessions=${this.sessions}
                .selectedSessions=${this.getSelectedSessions()}
                .bulkSelectionMode=${this.uiState.bulkSelectionMode}
                .showAdvancedActions=${true}
                @session-create-requested=${this.handleSessionCreate}
                @sessions-export-requested=${this.handleSessionsExport}
                @sessions-archive-requested=${this.handleSessionsArchive}
                @sessions-delete-requested=${this.handleSessionsDelete}
                @sessions-merge-requested=${this.handleSessionsMerge}
                @sessions-compare-requested=${this.handleSessionsCompare}
                @bulk-mode-toggled=${this.handleBulkModeToggle}
                @selection-cleared=${this.handleSelectionCleared}
              ></session-management-actions>
            </div>
          ` : ''}
        </header>

        <!-- Content Area -->
        <main class="content-area" role="main" id="main-content">
          <!-- Sidebar (future extension point) -->
          <aside 
            class="sidebar ${classMap({ collapsed: !showSidebar })}"
            role="complementary"
            aria-label="Session information panel"
          >
            <!-- Sidebar content can be extended here -->
            <slot name="sidebar"></slot>
          </aside>

          <!-- Main Content -->
          <div class="main-content">
            <div class="content-router" id="session-list">
              ${this.navigationConfig.enableDeepLinking ? html`
                <session-router
                  .sessions=${this.sessions}
                  basePath="/sessions"
                  @router-ready=${this.handleRouterReady}
                  @route-changed=${this.handleRouteChanged}
                  @session-action-requested=${this.handleSessionAction}
                  @message-focus-requested=${this.handleMessageFocus}
                ></session-router>
              ` : html`
                <slot></slot>
              `}
            </div>

            <!-- System Status Bar -->
            <footer class="system-status" role="contentinfo">
              <div class="status-info">
                <span>${this.sessions.length} sessions</span>
                <span>${this.getSelectedSessions().length} selected</span>
                ${this.currentSession ? html`
                  <span>Current: ${this.currentSession.title || this.currentSession.sessionId}</span>
                ` : ''}
              </div>
              <div>
                ${isLoading ? html`<span>Loading...</span>` : ''}
              </div>
            </footer>
          </div>
        </main>

        <!-- Loading Overlay -->
        ${isLoading ? html`
          <div class="loading-overlay" role="status" aria-label="Loading">
            <loading-state
              message="Loading navigation..."
              .progress=${undefined}
            ></loading-state>
          </div>
        ` : ''}

        <!-- Error Toast -->
        ${error ? html`
          <div class="error-toast" role="alert">
            ${error}
          </div>
        ` : ''}

        <!-- Accessibility Toolbar -->
        <div class="accessibility-toolbar">
          <button 
            class="accessibility-button"
            @click=${this.toggleKeyboardHelp}
            title="Show keyboard shortcuts (?)"
            aria-label="Show keyboard shortcuts"
          >
            ?
          </button>
          
          <button 
            class="accessibility-button"
            @click=${this.toggleSidebar}
            title="Toggle sidebar"
            aria-label="Toggle information panel"
          >
            ☰
          </button>
        </div>

        <!-- Keyboard Navigation Help -->
        <keyboard-navigation-help
          .visible=${this.showKeyboardHelp}
          @help-closed=${() => this.showKeyboardHelp = false}
        ></keyboard-navigation-help>

        <!-- Focus Manager -->
        <focus-manager></focus-manager>
      </div>
    `;
  }

  // Event Handlers

  private handleSessionNavigate(event: CustomEvent) {
    const { sessionId } = event.detail;
    this.stateManager.selectSession(sessionId);
    this.emitEvent('session-selected', { sessionId });
  }

  private handleBranchNavigate(event: CustomEvent) {
    const { sessionId } = event.detail;
    this.stateManager.selectSession(sessionId);
    this.emitEvent('branch-selected', { sessionId });
  }

  private handleBranchRequested(event: CustomEvent) {
    this.emitEvent('branch-create-requested', event.detail);
  }

  private handleBranchCompare(event: CustomEvent) {
    this.emitEvent('branch-compare-requested', event.detail);
  }

  private handleBranchDelete(event: CustomEvent) {
    this.emitEvent('branch-delete-requested', event.detail);
  }

  private handleSessionCreate(event: CustomEvent) {
    this.emitEvent('session-create-requested', event.detail);
  }

  private handleSessionsExport(event: CustomEvent) {
    this.emitEvent('sessions-export-requested', event.detail);
  }

  private handleSessionsArchive(event: CustomEvent) {
    this.emitEvent('sessions-archive-requested', event.detail);
  }

  private handleSessionsDelete(event: CustomEvent) {
    this.emitEvent('sessions-delete-requested', event.detail);
  }

  private handleSessionsMerge(event: CustomEvent) {
    this.emitEvent('sessions-merge-requested', event.detail);
  }

  private handleSessionsCompare(event: CustomEvent) {
    this.emitEvent('sessions-compare-requested', event.detail);
  }

  private handleBulkModeToggle(event: CustomEvent) {
    const { enabled } = event.detail;
    this.stateManager.setState('bulkSelectionMode', enabled);
  }

  private handleSelectionCleared(event: CustomEvent) {
    this.stateManager.clearSelection();
  }

  private handleRouterReady(event: CustomEvent) {
    this.emitEvent('navigation-ready', {});
  }

  private handleRouteChanged(event: CustomEvent) {
    const { params } = event.detail;
    this.stateManager.updateFromRoute(params);
  }

  private handleSessionAction(event: CustomEvent) {
    this.emitEvent('session-action-requested', event.detail);
  }

  private handleMessageFocus(event: CustomEvent) {
    this.emitEvent('message-focus-requested', event.detail);
  }

  // UI Actions

  private toggleKeyboardHelp() {
    this.showKeyboardHelp = !this.showKeyboardHelp;
  }

  private toggleSidebar() {
    this.stateManager.setState('showSidebar', !this.uiState.showSidebar);
  }

  // Utility Methods

  private getSelectedSessions(): SessionSummary[] {
    return this.sessions.filter(session => 
      this.uiState.selectedSessionIds.has(session.sessionId)
    );
  }

  // Public API Methods

  /**
   * Navigate to a specific session
   */
  public navigateToSession(sessionId: string, options?: {
    messageIndex?: number;
    branchId?: string;
    action?: string;
  }) {
    const router = this.shadowRoot?.querySelector('session-router') as any;
    if (router) {
      router.navigateToSession(sessionId, options);
    }
    this.stateManager.selectSession(sessionId);
  }

  /**
   * Select multiple sessions
   */
  public selectSessions(sessionIds: string[]) {
    this.stateManager.selectMultiple(sessionIds);
  }

  /**
   * Enable/disable bulk selection mode
   */
  public setBulkSelectionMode(enabled: boolean) {
    this.stateManager.setState('bulkSelectionMode', enabled);
  }

  /**
   * Show loading state
   */
  public showLoading(message?: string) {
    this.stateManager.setLoading(true);
    if (message) {
      this.announceToScreenReaders(message);
    }
  }

  /**
   * Hide loading state
   */
  public hideLoading() {
    this.stateManager.setLoading(false);
  }

  /**
   * Show error message
   */
  public showError(error: string | Error) {
    this.stateManager.setError(error);
    const message = error instanceof Error ? error.message : error;
    this.announceToScreenReaders(`Error: ${message}`, 'assertive');
  }

  /**
   * Clear error message
   */
  public clearError() {
    this.stateManager.clearError();
  }

  /**
   * Announce message to screen readers
   */
  public announceToScreenReaders(message: string, priority: 'polite' | 'assertive' = 'polite') {
    const announcer = this.shadowRoot?.querySelector('screen-reader-announcements') as any;
    if (announcer) {
      announcer.announce(message, priority);
    }
  }

  // Lifecycle

  connectedCallback() {
    super.connectedCallback();
    
    // Set up keyboard shortcuts
    document.addEventListener('keydown', this.handleGlobalKeydown);
    
    // Initialize state
    this.stateManager.setState('error', null);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleGlobalKeydown);
  }

  private handleGlobalKeydown = (event: KeyboardEvent) => {
    // Handle global keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'k':
          event.preventDefault();
          this.stateManager.setState('filterText', '');
          // Focus search input if it exists
          break;
        case 'a':
          if (this.uiState.bulkSelectionMode) {
            event.preventDefault();
            this.stateManager.selectMultiple(this.sessions.map(s => s.sessionId));
          }
          break;
        case 'd':
          if (this.uiState.bulkSelectionMode) {
            event.preventDefault();
            this.stateManager.clearSelection();
          }
          break;
      }
    }

    // Handle single key shortcuts
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      const target = event.target as HTMLElement;
      // Only handle if not typing in an input
      if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        switch (event.key) {
          case '?':
            event.preventDefault();
            this.toggleKeyboardHelp();
            break;
          case 'v':
            event.preventDefault();
            this.stateManager.toggleViewMode();
            break;
          case 's':
            event.preventDefault();
            this.stateManager.toggleSortOrder();
            break;
          case 'b':
            event.preventDefault();
            this.setBulkSelectionMode(!this.uiState.bulkSelectionMode);
            break;
        }
      }
    }
  };

  // State change handler
  protected onStateChanged(state: any): void {
    // React to specific state changes if needed
    if (state.error) {
      // Auto-clear error after 5 seconds
      setTimeout(() => {
        this.stateManager.clearError();
      }, 5000);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'comprehensive-navigation-system': ComprehensiveNavigationSystem;
  }
}