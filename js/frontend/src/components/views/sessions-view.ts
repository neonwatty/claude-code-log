import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import type { ZodSession } from "../../../../shared/src/schemas/index.js";
import "../session-list/session-list.js";
import "../session-list/paginated-session-list.js";
import "../session-detail/session-detail.js";

export interface SessionsViewState {
  selectedSessionId: string | null;
  showDetail: boolean;
  viewMode: 'list' | 'detail';
}

@customElement("sessions-view")
export class SessionsView extends BaseComponent {
  @property({ type: Array })
  sessions: ZodSession[] = [];

  @state()
  private viewState: SessionsViewState = {
    selectedSessionId: null,
    showDetail: false,
    viewMode: 'list'
  };

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .sessions-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-width: 1400px;
        margin: 0 auto;
        padding: var(--spacing-md);
        gap: var(--spacing-md);
      }

      .sessions-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-lg);
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        box-shadow: var(--shadow-neumorphic);
        border: 1px solid var(--color-border-light);
      }

      .sessions-title {
        font-size: 1.8em;
        font-weight: var(--font-weight-bold);
        color: var(--color-text-header);
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .sessions-title-icon {
        font-size: 1.1em;
      }

      .sessions-controls {
        display: flex;
        gap: var(--spacing-sm);
        align-items: center;
      }

      .control-button {
        padding: var(--spacing-sm) var(--spacing-md);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .control-button:hover {
        background: var(--color-surface-hover);
        transform: var(--transform-hover);
        box-shadow: var(--shadow-md);
      }

      .control-button.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .sessions-content {
        flex: 1;
        display: flex;
        gap: var(--spacing-md);
        overflow: hidden;
      }

      /* Desktop Layout - Side by side */
      .sessions-list-panel {
        flex: 0 0 400px;
        display: flex;
        flex-direction: column;
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        border: 1px solid var(--color-border-light);
        overflow: hidden;
      }

      .sessions-detail-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        border: 1px solid var(--color-border-light);
        overflow: hidden;
      }

      /* Single panel view for mobile */
      .sessions-content.single-panel {
        flex-direction: column;
      }

      .sessions-content.single-panel .sessions-list-panel {
        flex: none;
        max-height: 50vh;
      }

      .sessions-content.single-panel .sessions-detail-panel {
        flex: 1;
        min-height: 0;
      }

      .panel-header {
        padding: var(--spacing-md);
        border-bottom: 1px solid var(--color-border-light);
        background: var(--color-surface-hover);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .panel-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0;
      }

      .panel-content {
        flex: 1;
        overflow: auto;
        padding: var(--spacing-sm);
      }

      .sessions-empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-xxl);
        text-align: center;
        color: var(--color-text-muted);
      }

      .empty-icon {
        font-size: 4em;
        margin-bottom: var(--spacing-lg);
        opacity: 0.5;
      }

      .empty-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        margin: 0 0 var(--spacing-sm) 0;
      }

      .empty-description {
        font-size: var(--font-size-md);
        margin: 0;
        max-width: 400px;
      }

      .detail-empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-xxl);
        text-align: center;
        color: var(--color-text-muted);
        background: var(--color-surface);
      }

      .back-button {
        display: none;
        padding: var(--spacing-sm) var(--spacing-md);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
        font-size: var(--font-size-sm);
        transition: all var(--transition-fast);
      }

      .back-button:hover {
        background: var(--color-surface-hover);
      }

      /* Mobile responsive */
      @media (max-width: 768px) {
        .sessions-container {
          padding: var(--spacing-sm);
        }

        .sessions-header {
          flex-direction: column;
          gap: var(--spacing-md);
          align-items: stretch;
        }

        .sessions-controls {
          justify-content: center;
        }

        .sessions-content {
          flex-direction: column;
        }

        .sessions-list-panel {
          flex: none;
        }

        .sessions-detail-panel {
          flex: 1;
        }

        /* Mobile view mode switching */
        .sessions-content.mobile-list .sessions-detail-panel {
          display: none;
        }

        .sessions-content.mobile-detail .sessions-list-panel {
          display: none;
        }

        .sessions-content.mobile-detail .back-button {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }
      }

      @media (max-width: 480px) {
        .sessions-title {
          font-size: 1.4em;
        }

        .control-button {
          padding: var(--spacing-xs) var(--spacing-sm);
          font-size: var(--font-size-xs);
        }
      }
    `
  ];

  private handleSessionSelected(event: CustomEvent): void {
    const { sessionId } = event.detail;
    this.viewState = {
      ...this.viewState,
      selectedSessionId: sessionId,
      showDetail: true,
      viewMode: 'detail'
    };

    // Emit navigation event for URL updates
    this.emitEvent('session-detail-requested', { sessionId });
  }

  private handleBackToList(): void {
    this.viewState = {
      ...this.viewState,
      selectedSessionId: null,
      showDetail: false,
      viewMode: 'list'
    };

    this.emitEvent('session-list-requested');
  }

  private handleExportSessions(): void {
    // Emit event for parent to handle export
    this.emitEvent('sessions-export-requested', { sessions: this.sessions });
  }

  private handleRefreshSessions(): void {
    // Emit event for parent to handle refresh
    this.emitEvent('sessions-refresh-requested');
  }

  private isMobile(): boolean {
    return window.innerWidth <= 768;
  }

  private getSelectedSession(): ZodSession | null {
    if (!this.viewState.selectedSessionId) return null;
    return this.sessions.find(s => s.id === this.viewState.selectedSessionId) || null;
  }

  protected safeRender(): TemplateResult {
    const selectedSession = this.getSelectedSession();
    const isMobile = this.isMobile();
    const showList = !isMobile || this.viewState.viewMode === 'list';
    const showDetail = this.viewState.showDetail && (!isMobile || this.viewState.viewMode === 'detail');

    return html`
      <div class="sessions-container">
        <header class="sessions-header">
          <h1 class="sessions-title">
            <span class="sessions-title-icon">💬</span>
            Sessions
          </h1>
          
          <div class="sessions-controls">
            ${showDetail && isMobile ? html`
              <button 
                class="back-button"
                @click=${this.handleBackToList}
                aria-label="Back to sessions list"
              >
                <span>←</span> Back to List
              </button>
            ` : ''}
            
            <button 
              class="control-button"
              @click=${this.handleRefreshSessions}
              title="Refresh sessions"
            >
              <span>🔄</span>
              Refresh
            </button>
            
            <button 
              class="control-button"
              @click=${this.handleExportSessions}
              title="Export sessions"
              ?disabled=${this.sessions.length === 0}
            >
              <span>💾</span>
              Export
            </button>
          </div>
        </header>

        <div class="sessions-content ${isMobile ? 
          (this.viewState.viewMode === 'detail' ? 'mobile-detail' : 'mobile-list') : 
          'desktop'
        }">
          <!-- Sessions List Panel -->
          ${showList ? html`
            <div class="sessions-list-panel">
              <div class="panel-header">
                <h2 class="panel-title">All Sessions</h2>
                <span class="session-count">${this.sessions.length}</span>
              </div>
              <div class="panel-content">
                ${this.sessions.length > 0 ? html`
                  <paginated-session-list 
                    .sessions=${this.sessions}
                    @session-selected=${this.handleSessionSelected}
                  ></paginated-session-list>
                ` : html`
                  <div class="sessions-empty">
                    <div class="empty-icon">📂</div>
                    <h3 class="empty-title">No Sessions Found</h3>
                    <p class="empty-description">
                      No Claude Code sessions have been loaded yet. 
                      Sessions will appear here when available.
                    </p>
                  </div>
                `}
              </div>
            </div>
          ` : ''}

          <!-- Session Detail Panel -->
          ${showDetail ? html`
            <div class="sessions-detail-panel">
              <div class="panel-header">
                <h2 class="panel-title">
                  ${selectedSession ? 
                    `Session: ${selectedSession.id.substring(0, 8)}...` : 
                    'Session Details'
                  }
                </h2>
                ${!isMobile ? html`
                  <button 
                    class="control-button"
                    @click=${this.handleBackToList}
                    title="Close detail view"
                  >
                    <span>✕</span>
                  </button>
                ` : ''}
              </div>
              <div class="panel-content">
                ${selectedSession ? html`
                  <session-detail 
                    .session=${selectedSession}
                    .showHeader=${false}
                  ></session-detail>
                ` : html`
                  <div class="detail-empty">
                    <div class="empty-icon">👈</div>
                    <h3 class="empty-title">Select a Session</h3>
                    <p class="empty-description">
                      Choose a session from the list to view its details and conversation history.
                    </p>
                  </div>
                `}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "sessions-view": SessionsView;
  }
}