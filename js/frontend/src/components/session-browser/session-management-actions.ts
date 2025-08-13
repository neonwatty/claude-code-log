import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { SessionSummary, SessionDetail } from '../types/session-types';
import { generateId } from '../utils/accessibility';

/**
 * Session management actions component
 * Provides delete, archive, export, and other session management operations
 */
@customElement('session-management-actions')
export class SessionManagementActions extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .management-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .action-bar {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm);
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
        flex-wrap: wrap;
      }

      .action-group {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .action-separator {
        width: 1px;
        height: 24px;
        background: var(--color-border);
        margin: 0 var(--space-xs);
      }

      .action-button {
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
        min-height: 32px;
      }

      .action-button:hover:not(:disabled) {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
      }

      .action-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .action-button.primary {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .action-button.primary:hover:not(:disabled) {
        background: var(--color-primary-dark);
      }

      .action-button.danger {
        background: var(--color-danger);
        color: var(--color-text-inverse);
        border-color: var(--color-danger);
      }

      .action-button.danger:hover:not(:disabled) {
        background: var(--color-danger-dark);
      }

      .action-button.warning {
        background: var(--color-warning);
        color: var(--color-text-primary);
        border-color: var(--color-warning);
      }

      .action-button.warning:hover:not(:disabled) {
        background: var(--color-warning-dark);
      }

      .dropdown-container {
        position: relative;
        display: inline-block;
      }

      .dropdown-menu {
        position: absolute;
        top: 100%;
        right: 0;
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-lg);
        min-width: 200px;
        z-index: 1000;
        margin-top: 2px;
      }

      .dropdown-item {
        padding: var(--space-sm);
        cursor: pointer;
        transition: background-color var(--transition-fast);
        border-bottom: 1px solid var(--color-border-light);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: var(--font-size-sm);
      }

      .dropdown-item:last-child {
        border-bottom: none;
      }

      .dropdown-item:hover {
        background: var(--color-background-secondary);
      }

      .dropdown-item.danger {
        color: var(--color-danger);
      }

      .dropdown-item.danger:hover {
        background: var(--color-danger-light);
      }

      .bulk-actions {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm);
        background: var(--color-primary-light);
        border: 1px solid var(--color-primary);
        border-radius: var(--border-radius);
        margin-bottom: var(--space-sm);
      }

      .bulk-actions.hidden {
        display: none;
      }

      .selected-count {
        font-weight: var(--font-weight-medium);
        color: var(--color-primary);
      }

      .confirmation-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-xl);
        padding: var(--space-lg);
        max-width: 400px;
        z-index: 2000;
      }

      .dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1999;
      }

      .dialog-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        margin: 0 0 var(--space-sm) 0;
        color: var(--color-text-primary);
      }

      .dialog-message {
        color: var(--color-text-secondary);
        margin-bottom: var(--space-lg);
        line-height: 1.5;
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-sm);
      }

      .progress-bar {
        width: 100%;
        height: 4px;
        background: var(--color-background-tertiary);
        border-radius: 2px;
        overflow: hidden;
        margin-top: var(--space-sm);
      }

      .progress-fill {
        height: 100%;
        background: var(--color-primary);
        transition: width var(--transition-normal);
        border-radius: 2px;
      }

      .status-message {
        padding: var(--space-sm);
        border-radius: var(--border-radius);
        margin-top: var(--space-sm);
        font-size: var(--font-size-sm);
      }

      .status-message.success {
        background: var(--color-success-light);
        color: var(--color-success-dark);
        border: 1px solid var(--color-success);
      }

      .status-message.error {
        background: var(--color-danger-light);
        color: var(--color-danger-dark);
        border: 1px solid var(--color-danger);
      }

      .status-message.info {
        background: var(--color-primary-light);
        color: var(--color-primary-dark);
        border: 1px solid var(--color-primary);
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .action-bar {
          flex-direction: column;
          align-items: stretch;
        }

        .action-group {
          justify-content: center;
        }

        .action-separator {
          display: none;
        }

        .confirmation-dialog {
          max-width: 90vw;
          margin: var(--space-sm);
        }
      }
    `,
  ];

  /**
   * Currently selected sessions
   */
  @property({ type: Array })
  selectedSessions: SessionSummary[] = [];

  /**
   * Whether bulk selection mode is enabled
   */
  @property({ type: Boolean })
  bulkSelectionMode = false;

  /**
   * Available sessions for operations
   */
  @property({ type: Array })
  sessions: SessionSummary[] = [];

  /**
   * Whether to show advanced actions
   */
  @property({ type: Boolean })
  showAdvancedActions = false;

  @state()
  private showMoreActions = false;

  @state()
  private showConfirmDialog = false;

  @state()
  private confirmDialogConfig: {
    title: string;
    message: string;
    confirmText: string;
    confirmAction: () => void;
    isDangerous?: boolean;
  } | null = null;

  @state()
  private operationInProgress = false;

  @state()
  private operationProgress = 0;

  @state()
  private statusMessage: {
    type: 'success' | 'error' | 'info';
    text: string;
  } | null = null;

  render() {
    return html`
      <div class="management-container">
        ${this.renderBulkActions()}
        ${this.renderActionBar()}
        ${this.renderStatusMessage()}
        ${this.renderConfirmationDialog()}
      </div>
    `;
  }

  private renderBulkActions() {
    if (!this.bulkSelectionMode || this.selectedSessions.length === 0) {
      return html`<div class="bulk-actions hidden"></div>`;
    }

    return html`
      <div class="bulk-actions">
        <span class="selected-count">
          ${this.selectedSessions.length} session${this.selectedSessions.length !== 1 ? 's' : ''} selected
        </span>
        <div class="action-group">
          <button 
            class="action-button"
            @click=${this.bulkExport}
            ?disabled=${this.operationInProgress}
            title="Export selected sessions"
          >
            📤 Export All
          </button>
          <button 
            class="action-button warning"
            @click=${this.bulkArchive}
            ?disabled=${this.operationInProgress}
            title="Archive selected sessions"
          >
            📦 Archive All
          </button>
          <button 
            class="action-button danger"
            @click=${this.bulkDelete}
            ?disabled=${this.operationInProgress}
            title="Delete selected sessions"
          >
            🗑️ Delete All
          </button>
        </div>
        <button 
          class="action-button"
          @click=${this.clearSelection}
          title="Clear selection"
        >
          ✕ Clear
        </button>
      </div>
    `;
  }

  private renderActionBar() {
    const hasSelection = this.selectedSessions.length > 0;
    const singleSession = this.selectedSessions.length === 1 ? this.selectedSessions[0] : null;

    return html`
      <div class="action-bar">
        <!-- Primary actions -->
        <div class="action-group">
          <button 
            class="action-button primary"
            @click=${this.createNewSession}
            ?disabled=${this.operationInProgress}
            title="Create new session"
          >
            ➕ New Session
          </button>
          <button 
            class="action-button"
            @click=${this.toggleBulkMode}
            ?disabled=${this.operationInProgress}
            title="Toggle bulk selection"
          >
            ${this.bulkSelectionMode ? '☑️' : '☐'} Bulk Select
          </button>
        </div>

        <div class="action-separator"></div>

        <!-- Session-specific actions -->
        <div class="action-group">
          <button 
            class="action-button"
            @click=${this.exportSessions}
            ?disabled=${!hasSelection || this.operationInProgress}
            title="Export selected sessions"
          >
            📤 Export
          </button>
          <button 
            class="action-button"
            @click=${this.duplicateSession}
            ?disabled=${!singleSession || this.operationInProgress}
            title="Duplicate session"
          >
            📋 Duplicate
          </button>
          <button 
            class="action-button"
            @click=${this.shareSession}
            ?disabled=${!singleSession || this.operationInProgress}
            title="Share session"
          >
            🔗 Share
          </button>
        </div>

        <div class="action-separator"></div>

        <!-- Management actions -->
        <div class="action-group">
          <button 
            class="action-button warning"
            @click=${this.archiveSessions}
            ?disabled=${!hasSelection || this.operationInProgress}
            title="Archive selected sessions"
          >
            📦 Archive
          </button>
          <button 
            class="action-button danger"
            @click=${this.deleteSessions}
            ?disabled=${!hasSelection || this.operationInProgress}
            title="Delete selected sessions"
          >
            🗑️ Delete
          </button>
        </div>

        <!-- More actions dropdown -->
        <div class="dropdown-container">
          <button 
            class="action-button"
            @click=${this.toggleMoreActions}
            ?disabled=${this.operationInProgress}
            title="More actions"
          >
            ⋮ More
          </button>

          ${this.showMoreActions ? html`
            <div class="dropdown-menu" role="menu">
              <div 
                class="dropdown-item"
                @click=${this.mergeSessions}
                role="menuitem"
                tabindex="0"
              >
                🔄 Merge Sessions
              </div>
              <div 
                class="dropdown-item"
                @click=${this.compareSessions}
                role="menuitem"
                tabindex="0"
              >
                ⚖️ Compare Sessions
              </div>
              <div 
                class="dropdown-item"
                @click=${this.generateReport}
                role="menuitem"
                tabindex="0"
              >
                📊 Generate Report
              </div>
              <div 
                class="dropdown-item"
                @click=${this.backupSessions}
                role="menuitem"
                tabindex="0"
              >
                💾 Backup Sessions
              </div>
              <div 
                class="dropdown-item danger"
                @click=${this.purgeOldSessions}
                role="menuitem"
                tabindex="0"
              >
                🧹 Purge Old Sessions
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      ${this.operationInProgress ? html`
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${this.operationProgress}%"></div>
        </div>
      ` : ''}
    `;
  }

  private renderStatusMessage() {
    if (!this.statusMessage) return '';

    return html`
      <div class="status-message ${this.statusMessage.type}">
        ${this.statusMessage.type === 'success' ? '✅' : 
          this.statusMessage.type === 'error' ? '❌' : 'ℹ️'} 
        ${this.statusMessage.text}
      </div>
    `;
  }

  private renderConfirmationDialog() {
    if (!this.showConfirmDialog || !this.confirmDialogConfig) return '';

    return html`
      <div class="dialog-overlay" @click=${this.closeConfirmDialog}></div>
      <div class="confirmation-dialog" role="dialog" aria-modal="true">
        <h3 class="dialog-title">${this.confirmDialogConfig.title}</h3>
        <div class="dialog-message">${this.confirmDialogConfig.message}</div>
        <div class="dialog-actions">
          <button 
            class="action-button"
            @click=${this.closeConfirmDialog}
          >
            Cancel
          </button>
          <button 
            class="action-button ${this.confirmDialogConfig.isDangerous ? 'danger' : 'primary'}"
            @click=${this.executeConfirmAction}
          >
            ${this.confirmDialogConfig.confirmText}
          </button>
        </div>
      </div>
    `;
  }

  // Action handlers

  private createNewSession() {
    this.emitEvent('session-create-requested', {});
  }

  private toggleBulkMode() {
    this.bulkSelectionMode = !this.bulkSelectionMode;
    if (!this.bulkSelectionMode) {
      this.clearSelection();
    }
    this.emitEvent('bulk-mode-toggled', { enabled: this.bulkSelectionMode });
  }

  private clearSelection() {
    this.selectedSessions = [];
    this.emitEvent('selection-cleared', {});
  }

  private exportSessions() {
    if (this.selectedSessions.length === 0) return;

    const sessionIds = this.selectedSessions.map(s => s.sessionId);
    this.emitEvent('sessions-export-requested', { sessionIds });
  }

  private duplicateSession() {
    const session = this.selectedSessions[0];
    if (!session) return;

    this.emitEvent('session-duplicate-requested', { sessionId: session.sessionId });
  }

  private shareSession() {
    const session = this.selectedSessions[0];
    if (!session) return;

    this.emitEvent('session-share-requested', { sessionId: session.sessionId });
  }

  private archiveSessions() {
    if (this.selectedSessions.length === 0) return;

    const sessionIds = this.selectedSessions.map(s => s.sessionId);
    this.confirmDialogConfig = {
      title: 'Archive Sessions',
      message: `Are you sure you want to archive ${sessionIds.length} session${sessionIds.length !== 1 ? 's' : ''}? They can be restored later.`,
      confirmText: 'Archive',
      confirmAction: () => {
        this.emitEvent('sessions-archive-requested', { sessionIds });
        this.closeConfirmDialog();
      }
    };
    this.showConfirmDialog = true;
  }

  private deleteSessions() {
    if (this.selectedSessions.length === 0) return;

    const sessionIds = this.selectedSessions.map(s => s.sessionId);
    this.confirmDialogConfig = {
      title: 'Delete Sessions',
      message: `Are you sure you want to permanently delete ${sessionIds.length} session${sessionIds.length !== 1 ? 's' : ''}? This action cannot be undone.`,
      confirmText: 'Delete',
      confirmAction: () => {
        this.emitEvent('sessions-delete-requested', { sessionIds });
        this.closeConfirmDialog();
      },
      isDangerous: true
    };
    this.showConfirmDialog = true;
  }

  private toggleMoreActions() {
    this.showMoreActions = !this.showMoreActions;
  }

  // Bulk actions

  private bulkExport() {
    this.exportSessions();
  }

  private bulkArchive() {
    this.archiveSessions();
  }

  private bulkDelete() {
    this.deleteSessions();
  }

  // Advanced actions

  private mergeSessions() {
    if (this.selectedSessions.length < 2) {
      this.showStatus('error', 'Select at least 2 sessions to merge');
      return;
    }

    const sessionIds = this.selectedSessions.map(s => s.sessionId);
    this.emitEvent('sessions-merge-requested', { sessionIds });
    this.showMoreActions = false;
  }

  private compareSessions() {
    if (this.selectedSessions.length !== 2) {
      this.showStatus('error', 'Select exactly 2 sessions to compare');
      return;
    }

    const sessionIds = this.selectedSessions.map(s => s.sessionId);
    this.emitEvent('sessions-compare-requested', { sessionIds });
    this.showMoreActions = false;
  }

  private generateReport() {
    if (this.selectedSessions.length === 0) {
      this.showStatus('error', 'Select at least one session to generate a report');
      return;
    }

    const sessionIds = this.selectedSessions.map(s => s.sessionId);
    this.emitEvent('report-generate-requested', { sessionIds });
    this.showMoreActions = false;
  }

  private backupSessions() {
    const sessionIds = this.selectedSessions.length > 0 
      ? this.selectedSessions.map(s => s.sessionId)
      : this.sessions.map(s => s.sessionId);
    
    this.emitEvent('sessions-backup-requested', { sessionIds });
    this.showMoreActions = false;
  }

  private purgeOldSessions() {
    this.confirmDialogConfig = {
      title: 'Purge Old Sessions',
      message: 'This will permanently delete sessions older than 30 days. This action cannot be undone.',
      confirmText: 'Purge',
      confirmAction: () => {
        this.emitEvent('sessions-purge-requested', {});
        this.closeConfirmDialog();
      },
      isDangerous: true
    };
    this.showConfirmDialog = true;
    this.showMoreActions = false;
  }

  // Dialog management

  private closeConfirmDialog() {
    this.showConfirmDialog = false;
    this.confirmDialogConfig = null;
  }

  private executeConfirmAction() {
    if (this.confirmDialogConfig?.confirmAction) {
      this.confirmDialogConfig.confirmAction();
    }
  }

  // Utility methods

  private showStatus(type: 'success' | 'error' | 'info', text: string) {
    this.statusMessage = { type, text };
    setTimeout(() => {
      this.statusMessage = null;
    }, 5000);
  }

  public updateProgress(progress: number) {
    this.operationProgress = Math.max(0, Math.min(100, progress));
  }

  public setOperationInProgress(inProgress: boolean) {
    this.operationInProgress = inProgress;
    if (!inProgress) {
      this.operationProgress = 0;
    }
  }

  // Event handling

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleKeydown);
  }

  private handleDocumentClick = (event: Event) => {
    if (!this.contains(event.target as Node)) {
      this.showMoreActions = false;
    }
  };

  private handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.showMoreActions = false;
      this.closeConfirmDialog();
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'session-management-actions': SessionManagementActions;
  }
}