import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { BaseComponent } from '../../base/BaseComponent';
import { baseStyles } from '../../styles/theme';
import { 
  SessionSummary, 
  SessionDetail, 
  SessionBranchTree 
} from '../../types/session-types';
import { AriaRoles, AriaAttributes, generateId } from '../../utils/accessibility';
import '../../branch-visualization/BranchVisualization';

/**
 * Navigation component with breadcrumbs, session switching, and branch visualization
 */
@customElement('session-navigation')
export class SessionNavigation extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .navigation-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .main-navigation {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        flex-wrap: wrap;
      }

      .breadcrumbs {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        flex: 1;
        min-width: 0;
      }

      .breadcrumb-item {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: var(--font-size-sm);
      }

      .breadcrumb-link {
        color: var(--color-primary);
        text-decoration: none;
        cursor: pointer;
        transition: color var(--transition-fast);
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .breadcrumb-link:hover {
        color: var(--color-primary-dark);
        text-decoration: underline;
      }

      .breadcrumb-current {
        color: var(--color-text-primary);
        font-weight: var(--font-weight-medium);
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .breadcrumb-separator {
        color: var(--color-text-muted);
        user-select: none;
      }

      .session-switcher {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .nav-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        min-width: 0;
      }

      .nav-button:hover:not(:disabled) {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
      }

      .nav-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nav-button.primary {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .nav-button.primary:hover:not(:disabled) {
        background: var(--color-primary-dark);
      }

      .session-selector {
        position: relative;
        display: inline-block;
      }

      .selector-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        min-width: 120px;
        max-width: 200px;
      }

      .selector-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
      }

      .selector-text {
        flex: 1;
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .selector-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-lg);
        max-height: 300px;
        overflow-y: auto;
        z-index: 1000;
        margin-top: 2px;
      }

      .dropdown-item {
        padding: var(--space-sm);
        cursor: pointer;
        transition: background-color var(--transition-fast);
        border-bottom: 1px solid var(--color-border-light);
      }

      .dropdown-item:last-child {
        border-bottom: none;
      }

      .dropdown-item:hover {
        background: var(--color-background-secondary);
      }

      .dropdown-item.selected {
        background: var(--color-primary-light);
        color: var(--color-primary);
      }

      .dropdown-item-title {
        font-weight: var(--font-weight-medium);
        margin-bottom: var(--space-xs);
      }

      .dropdown-item-meta {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        display: flex;
        gap: var(--space-sm);
      }

      .branch-navigation {
        margin-top: var(--space-sm);
        padding: var(--space-sm);
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
      }

      .branch-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-sm);
      }

      .branch-title {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0;
      }

      .branch-toggle {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: var(--space-xs);
        border-radius: var(--border-radius-sm);
        transition: all var(--transition-fast);
      }

      .branch-toggle:hover {
        background: var(--color-background-tertiary);
        color: var(--color-text-primary);
      }

      .branch-content {
        overflow: hidden;
        transition: all var(--transition-normal);
      }

      .branch-content.collapsed {
        max-height: 0;
        margin-top: 0;
      }

      .branch-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .branch-item {
        padding: var(--space-xs) var(--space-sm);
        background: var(--color-background);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
        cursor: pointer;
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .branch-item:hover {
        border-color: var(--color-primary);
        background: var(--color-background-tertiary);
      }

      .branch-item.current {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
        color: var(--color-primary);
      }

      .branch-info {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        flex: 1;
        min-width: 0;
      }

      .branch-name {
        font-weight: var(--font-weight-medium);
        font-size: var(--font-size-sm);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .branch-meta {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        display: flex;
        gap: var(--space-sm);
      }

      .branch-actions {
        display: flex;
        gap: var(--space-xs);
        align-items: center;
      }

      .branch-action {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: var(--space-xs);
        border-radius: var(--border-radius-sm);
        transition: all var(--transition-fast);
        font-size: var(--font-size-sm);
      }

      .branch-action:hover {
        background: var(--color-background-tertiary);
        color: var(--color-text-primary);
      }

      .keyboard-shortcuts {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        margin-top: var(--space-sm);
        padding: var(--space-sm);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        border: 1px solid var(--color-border-light);
      }

      .shortcuts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--space-xs);
      }

      .shortcut-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .shortcut-key {
        background: var(--color-background-tertiary);
        color: var(--color-text-secondary);
        padding: 2px var(--space-xs);
        border-radius: var(--border-radius-sm);
        font-family: var(--font-family-mono);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .main-navigation {
          flex-direction: column;
          align-items: stretch;
        }

        .breadcrumbs {
          order: 2;
          justify-content: center;
        }

        .session-switcher {
          order: 1;
          justify-content: center;
        }

        .breadcrumb-link,
        .breadcrumb-current {
          max-width: 100px;
        }

        .selector-button {
          min-width: auto;
          max-width: none;
        }

        .shortcuts-grid {
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
   * Current session being viewed
   */
  @property({ type: Object })
  currentSession: SessionDetail | null = null;

  /**
   * Available sessions for navigation
   */
  @property({ type: Array })
  sessions: SessionSummary[] = [];

  /**
   * Branch tree for the current session
   */
  @property({ type: Object })
  branchTree: SessionBranchTree | null = null;

  /**
   * Whether to show keyboard shortcuts
   */
  @property({ type: Boolean })
  showShortcuts = false;

  /**
   * Whether to show branch navigation
   */
  @property({ type: Boolean })
  showBranches = true;

  @state()
  private showSessionDropdown = false;

  @state()
  private showBranchNavigation = false;

  @state()
  private navigationId = generateId('session-navigation');

  render() {
    return html`
      <nav 
        class="navigation-container"
        role="navigation"
        aria-label="Session navigation"
      >
        ${this.renderMainNavigation()}
        ${this.showBranches && this.branchTree ? this.renderBranchNavigation() : ''}
        ${this.showShortcuts ? this.renderKeyboardShortcuts() : ''}
      </nav>
    `;
  }

  private renderMainNavigation() {
    return html`
      <div class="main-navigation">
        ${this.renderBreadcrumbs()}
        ${this.renderSessionSwitcher()}
      </div>
    `;
  }

  private renderBreadcrumbs() {
    const breadcrumbs = this.buildBreadcrumbs();
    
    return html`
      <div 
        class="breadcrumbs"
        role="navigation"
        aria-label="Breadcrumb navigation"
      >
        ${breadcrumbs.map((crumb, index) => html`
          <div class="breadcrumb-item">
            ${index > 0 ? html`
              <span class="breadcrumb-separator" aria-hidden="true">›</span>
            ` : ''}
            ${crumb.current ? html`
              <span class="breadcrumb-current" aria-current="page">
                ${crumb.label}
              </span>
            ` : html`
              <a 
                class="breadcrumb-link"
                @click=${() => this.navigateToSession(crumb.sessionId)}
                role="link"
                tabindex="0"
                @keydown=${(e: KeyboardEvent) => this.handleBreadcrumbKeydown(e, crumb.sessionId)}
                title="${crumb.fullLabel || crumb.label}"
              >
                ${crumb.label}
              </a>
            `}
          </div>
        `)}
      </div>
    `;
  }

  private renderSessionSwitcher() {
    const prevSession = this.getPreviousSession();
    const nextSession = this.getNextSession();

    return html`
      <div class="session-switcher">
        <button 
          class="nav-button"
          @click=${this.navigateToPrevious}
          ?disabled=${!prevSession}
          title="Previous session (Ctrl+←)"
          aria-label="Navigate to previous session"
        >
          ← Prev
        </button>

        <div class="session-selector">
          <button 
            class="selector-button"
            @click=${this.toggleSessionDropdown}
            aria-expanded="${this.showSessionDropdown}"
            aria-haspopup="listbox"
            aria-label="Select session"
          >
            <span class="selector-text">
              ${this.currentSession?.title || this.currentSession?.sessionId || 'Select Session'}
            </span>
            <span>▼</span>
          </button>

          ${this.showSessionDropdown ? html`
            <div 
              class="selector-dropdown"
              role="listbox"
              aria-label="Available sessions"
            >
              ${this.sessions.map(session => html`
                <div 
                  class="dropdown-item ${classMap({ 
                    selected: session.sessionId === this.currentSession?.sessionId 
                  })}"
                  role="option"
                  aria-selected="${session.sessionId === this.currentSession?.sessionId}"
                  @click=${() => this.selectSession(session.sessionId)}
                >
                  <div class="dropdown-item-title">
                    ${session.title || session.sessionId}
                  </div>
                  <div class="dropdown-item-meta">
                    <span>${session.messageCount} messages</span>
                    <span>${this.formatTimestamp(session.startTime)}</span>
                    ${session.isActive ? html`<span>Active</span>` : ''}
                  </div>
                </div>
              `)}
            </div>
          ` : ''}
        </div>

        <button 
          class="nav-button"
          @click=${this.navigateToNext}
          ?disabled=${!nextSession}
          title="Next session (Ctrl+→)"
          aria-label="Navigate to next session"
        >
          Next →
        </button>

        <button 
          class="nav-button primary"
          @click=${this.createBranch}
          ?disabled=${!this.currentSession}
          title="Create branch from current session"
          aria-label="Create new branch"
        >
          🌿 Branch
        </button>
      </div>
    `;
  }

  private renderBranchNavigation() {
    if (!this.branchTree) return '';

    const branches = this.getBranchesFromTree();

    return html`
      <div class="branch-navigation">
        <div class="branch-header">
          <h3 class="branch-title">🌿 Session Branches</h3>
          <button 
            class="branch-toggle"
            @click=${this.toggleBranchNavigation}
            aria-expanded="${this.showBranchNavigation}"
            aria-label="Toggle branch navigation"
          >
            ${this.showBranchNavigation ? '▼' : '▶'}
          </button>
        </div>

        <div class="branch-content ${classMap({ collapsed: !this.showBranchNavigation })}">
          <div class="branch-list">
            ${branches.map(branch => html`
              <div 
                class="branch-item ${classMap({ 
                  current: branch.sessionId === this.currentSession?.sessionId 
                })}"
                @click=${() => this.navigateToBranch(branch.sessionId)}
              >
                <div class="branch-info">
                  <div class="branch-name">
                    ${branch.branchMetadata?.branchName || `Branch from message ${branch.branchPoint}`}
                  </div>
                  <div class="branch-meta">
                    <span>Created ${this.formatTimestamp(branch.branchTimestamp!)}</span>
                    ${branch.branchMetadata?.branchReason ? html`
                      <span>${branch.branchMetadata.branchReason}</span>
                    ` : ''}
                  </div>
                </div>

                <div class="branch-actions">
                  <button 
                    class="branch-action"
                    @click=${(e: Event) => this.handleBranchAction(e, 'view', branch.sessionId)}
                    title="View branch"
                    aria-label="View this branch"
                  >
                    👁️
                  </button>
                  <button 
                    class="branch-action"
                    @click=${(e: Event) => this.handleBranchAction(e, 'compare', branch.sessionId)}
                    title="Compare with current"
                    aria-label="Compare with current session"
                  >
                    ⚖️
                  </button>
                  <button 
                    class="branch-action"
                    @click=${(e: Event) => this.handleBranchAction(e, 'delete', branch.sessionId)}
                    title="Delete branch"
                    aria-label="Delete this branch"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            `)}
          </div>
        </div>
      </div>
    `;
  }

  private renderKeyboardShortcuts() {
    const shortcuts = [
      { key: 'Ctrl+←', action: 'Previous session' },
      { key: 'Ctrl+→', action: 'Next session' },
      { key: 'Ctrl+B', action: 'Create branch' },
      { key: 'Ctrl+F', action: 'Search sessions' },
      { key: 'Esc', action: 'Close dropdown' },
    ];

    return html`
      <div class="keyboard-shortcuts">
        <div class="shortcuts-grid">
          ${shortcuts.map(shortcut => html`
            <div class="shortcut-item">
              <span>${shortcut.action}</span>
              <span class="shortcut-key">${shortcut.key}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  // Event handlers

  private handleBreadcrumbKeydown(event: KeyboardEvent, sessionId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.navigateToSession(sessionId);
    }
  }

  private handleBranchAction(event: Event, action: string, sessionId: string) {
    event.stopPropagation();
    
    switch (action) {
      case 'view':
        this.navigateToBranch(sessionId);
        break;
      case 'compare':
        this.compareBranch(sessionId);
        break;
      case 'delete':
        this.deleteBranch(sessionId);
        break;
    }
  }

  // Navigation actions

  private navigateToSession(sessionId: string) {
    this.emitEvent('session-navigate', { sessionId });
    this.showSessionDropdown = false;
  }

  private navigateToBranch(sessionId: string) {
    this.emitEvent('branch-navigate', { sessionId });
  }

  private navigateToPrevious() {
    const prevSession = this.getPreviousSession();
    if (prevSession) {
      this.navigateToSession(prevSession.sessionId);
    }
  }

  private navigateToNext() {
    const nextSession = this.getNextSession();
    if (nextSession) {
      this.navigateToSession(nextSession.sessionId);
    }
  }

  private selectSession(sessionId: string) {
    this.navigateToSession(sessionId);
  }

  private toggleSessionDropdown() {
    this.showSessionDropdown = !this.showSessionDropdown;
  }

  private toggleBranchNavigation() {
    this.showBranchNavigation = !this.showBranchNavigation;
  }

  private createBranch() {
    this.emitEvent('branch-requested', {
      sessionId: this.currentSession?.sessionId,
      type: 'create-new'
    });
  }

  private compareBranch(sessionId: string) {
    this.emitEvent('branch-compare-requested', {
      currentSessionId: this.currentSession?.sessionId,
      compareSessionId: sessionId
    });
  }

  private deleteBranch(sessionId: string) {
    this.emitEvent('branch-delete-requested', { sessionId });
  }

  // Utility methods

  private buildBreadcrumbs() {
    const breadcrumbs: Array<{
      label: string;
      fullLabel?: string;
      sessionId: string;
      current: boolean;
    }> = [];

    if (!this.currentSession) return breadcrumbs;

    // Build hierarchy from branch tree or session relationships
    const hierarchy = this.buildSessionHierarchy();
    
    hierarchy.forEach((session, index) => {
      const isLast = index === hierarchy.length - 1;
      const label = this.truncateLabel(session.title || session.sessionId, 20);
      
      breadcrumbs.push({
        label,
        fullLabel: session.title || session.sessionId,
        sessionId: session.sessionId,
        current: isLast
      });
    });

    return breadcrumbs;
  }

  private buildSessionHierarchy(): SessionSummary[] {
    const hierarchy: SessionSummary[] = [];
    
    if (!this.currentSession) return hierarchy;

    // For now, just return the current session
    // In a full implementation, this would traverse the branch tree
    hierarchy.push(this.currentSession);

    return hierarchy;
  }

  private getBranchesFromTree(): SessionSummary[] {
    if (!this.branchTree) return [];

    const branches: SessionSummary[] = [];
    
    // Extract all branches from the tree structure
    const traverseBranches = (tree: SessionBranchTree) => {
      branches.push(tree.rootSession);
      tree.branches.forEach(traverseBranches);
    };

    this.branchTree.branches.forEach(traverseBranches);
    
    return branches;
  }

  private getPreviousSession(): SessionSummary | null {
    if (!this.currentSession || this.sessions.length === 0) return null;

    const currentIndex = this.sessions.findIndex(s => s.sessionId === this.currentSession!.sessionId);
    
    if (currentIndex > 0) {
      return this.sessions[currentIndex - 1];
    }

    return null;
  }

  private getNextSession(): SessionSummary | null {
    if (!this.currentSession || this.sessions.length === 0) return null;

    const currentIndex = this.sessions.findIndex(s => s.sessionId === this.currentSession!.sessionId);
    
    if (currentIndex >= 0 && currentIndex < this.sessions.length - 1) {
      return this.sessions[currentIndex + 1];
    }

    return null;
  }

  private truncateLabel(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private formatTimestamp(timestamp: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  }

  // Keyboard handling

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('keydown', this.handleKeydown);
    document.addEventListener('click', this.handleDocumentClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this.handleKeydown);
    document.removeEventListener('click', this.handleDocumentClick);
  }

  private handleKeydown = (event: KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          this.navigateToPrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          this.navigateToNext();
          break;
        case 'b':
        case 'B':
          event.preventDefault();
          this.createBranch();
          break;
      }
    }

    if (event.key === 'Escape') {
      this.showSessionDropdown = false;
    }
  };

  private handleDocumentClick = (event: Event) => {
    // Close dropdown when clicking outside
    if (!this.contains(event.target as Node)) {
      this.showSessionDropdown = false;
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'session-navigation': SessionNavigation;
  }
}