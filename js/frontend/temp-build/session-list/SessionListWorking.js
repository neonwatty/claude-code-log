var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
// @ts-nocheck
/**
 * Working session list component that bypasses TypeScript decorator issues
 * This version focuses on functionality over strict typing
 */
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';
import { baseStyles } from '../styles/theme';
/**
 * Session list item component - simplified working version
 */
let SessionListItemWorking = class SessionListItemWorking extends LitElement {
    constructor() {
        super(...arguments);
        // Using property without strict typing
        this.session = null;
        this.selected = false;
        this.compact = false;
    }
    connectedCallback() {
        super.connectedCallback();
    }
    render() {
        if (!this.session) {
            return html `<div class="session-item">No session data</div>`;
        }
        const classes = {
            'session-item': true,
            selected: this.selected,
            active: this.session.isActive,
        };
        return html `
      <div
        class=${classMap(classes)}
        role="button"
        tabindex="0"
        @click=${this.handleClick}
        @keydown=${this.handleKeydown}
      >
        <div class="session-header">
          <h3 class="session-title">
            ${this.session.title || `Session ${this.session.sessionId.slice(0, 8)}`}
          </h3>
          <div class="session-id">${this.session.sessionId.slice(0, 8)}</div>
        </div>

        <div class="session-cwd" title=${this.session.cwd}>
          📁 ${this.session.cwd}
        </div>

        <div class="session-stats">
          <div class="stat-item">
            <span>💬</span>
            <span class="stat-value">${this.session.messageCount}</span>
            <span>messages</span>
          </div>
          <div class="stat-item">
            <span>👤</span>
            <span class="stat-value">${this.session.userMessageCount}</span>
            <span>user</span>
          </div>
          <div class="stat-item">
            <span>🤖</span>
            <span class="stat-value">${this.session.assistantMessageCount}</span>
            <span>assistant</span>
          </div>
          ${this.session.tokenUsage
            ? html `
                <div class="stat-item">
                  <span>🎯</span>
                  <span class="stat-value">${this.formatTokens(this.session.tokenUsage.totalTokens)}</span>
                  <span>tokens</span>
                </div>
              `
            : ''}
        </div>
      </div>
    `;
    }
    handleClick() {
        this.dispatchEvent(new CustomEvent('session-selected', {
            detail: {
                sessionId: this.session.sessionId,
                session: this.session,
            },
            bubbles: true,
        }));
    }
    handleKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleClick();
        }
    }
    formatTokens(tokens) {
        if (tokens >= 1000000) {
            return `${(tokens / 1000000).toFixed(1)}M`;
        }
        if (tokens >= 1000) {
            return `${(tokens / 1000).toFixed(1)}K`;
        }
        return tokens.toString();
    }
};
SessionListItemWorking.styles = [
    baseStyles,
    css `
      :host {
        display: block;
        margin-bottom: var(--space-sm);
      }

      .session-item {
        padding: var(--space-md);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        background: var(--color-background);
        transition: all var(--transition-fast);
        cursor: pointer;
        position: relative;
        overflow: hidden;
      }

      .session-item:hover {
        border-color: var(--color-primary);
        box-shadow: var(--shadow);
        transform: translateY(-1px);
      }

      .session-item.selected {
        border-color: var(--color-primary);
        background: var(--color-primary);
        color: var(--color-text-inverse);
      }

      .session-item.active::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        width: 0;
        height: 0;
        border-left: 12px solid transparent;
        border-top: 12px solid var(--color-success);
      }

      .session-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--space-xs);
        gap: var(--space-sm);
      }

      .session-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0;
        flex: 1;
        word-break: break-word;
      }

      .session-item.selected .session-title {
        color: inherit;
      }

      .session-id {
        font-size: var(--font-size-xs);
        font-family: var(--font-family-mono);
        color: var(--color-text-muted);
        background: var(--color-background-tertiary);
        padding: var(--space-xs);
        border-radius: var(--border-radius-sm);
        flex-shrink: 0;
      }

      .session-cwd {
        font-family: var(--font-family-mono);
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        background: var(--color-background-secondary);
        padding: var(--space-xs);
        border-radius: var(--border-radius-sm);
        word-break: break-all;
        margin-bottom: var(--space-sm);
      }

      .session-stats {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-md);
        font-size: var(--font-size-xs);
      }

      .stat-item {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        color: var(--color-text-muted);
      }

      .stat-value {
        font-weight: var(--font-weight-medium);
      }
    `,
];
SessionListItemWorking = __decorate([
    customElement('session-list-item-working')
], SessionListItemWorking);
export { SessionListItemWorking };
/**
 * Session list container - simplified working version
 */
let SessionListWorking = class SessionListWorking extends LitElement {
    constructor() {
        super(...arguments);
        // Properties without strict typing
        this.sessions = [];
        this.selectedSessionId = '';
        this.title = 'Sessions';
        this.loading = false;
        this.error = null;
        // State
        this._searchQuery = '';
        this.handleSearchInput = this.debounce((event) => {
            this._searchQuery = event.target.value;
            this.requestUpdate();
        }, 300);
    }
    render() {
        const filteredSessions = this.getFilteredSessions();
        return html `
      <div class="session-list-container">
        ${this.renderHeader()}
        ${this.loading ? this.renderLoading() : ''}
        ${this.error ? this.renderError() : ''}
        ${!this.loading && !this.error ? this.renderSessionsList(filteredSessions) : ''}
      </div>
    `;
    }
    renderHeader() {
        return html `
      <div class="list-header">
        <div class="header-row">
          <div>
            <h2 class="list-title">${this.title}</h2>
            <div class="session-count">
              ${this.sessions.length} sessions
            </div>
          </div>
        </div>

        <div class="search-box">
          <div class="search-icon">🔍</div>
          <input
            class="search-input"
            type="text"
            placeholder="Search sessions..."
            .value=${this._searchQuery}
            @input=${this.handleSearchInput}
          />
        </div>
      </div>
    `;
    }
    renderSessionsList(sessions) {
        if (sessions.length === 0) {
            return this.renderEmptyState();
        }
        return html `
      <div class="sessions-list">
        ${repeat(sessions, (session) => session.sessionId, (session) => html `
            <session-list-item-working
              .session=${session}
              .selected=${session.sessionId === this.selectedSessionId}
              @session-selected=${this.handleSessionSelected}
            ></session-list-item-working>
          `)}
      </div>
    `;
    }
    renderEmptyState() {
        return html `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-title">
          ${this._searchQuery ? 'No matching sessions' : 'No sessions found'}
        </div>
        <div>
          ${this._searchQuery
            ? 'Try adjusting your search'
            : 'Sessions will appear here once you start using Claude Code'}
        </div>
      </div>
    `;
    }
    renderLoading() {
        return html `
      <div class="loading-state">
        <div>Loading sessions...</div>
      </div>
    `;
    }
    renderError() {
        return html `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <div class="empty-state-title">Error loading sessions</div>
        <div>${this.error}</div>
      </div>
    `;
    }
    getFilteredSessions() {
        if (!this._searchQuery) {
            return this.sessions;
        }
        const query = this._searchQuery.toLowerCase();
        return this.sessions.filter(session => session.title?.toLowerCase().includes(query) ||
            session.sessionId.toLowerCase().includes(query) ||
            session.cwd.toLowerCase().includes(query) ||
            session.summary?.toLowerCase().includes(query));
    }
    handleSessionSelected(event) {
        this.selectedSessionId = event.detail.sessionId;
        this.dispatchEvent(new CustomEvent('session-selected', {
            detail: event.detail,
            bubbles: true,
        }));
    }
    debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
};
SessionListWorking.styles = [
    baseStyles,
    css `
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

      .sessions-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
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
    `,
];
SessionListWorking = __decorate([
    customElement('session-list-working')
], SessionListWorking);
export { SessionListWorking };
