import { html, css, CSSResultGroup } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { SessionSummary } from '../types/session-types';

/**
 * Session list item component that displays a summary of a single session
 */
@customElement('session-list-item')
export class SessionListItem extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
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

      .session-item:focus-visible {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: var(--shadow-focus);
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

      .session-item.active::before {
        content: '●';
        position: absolute;
        top: 6px;
        right: 6px;
        font-size: 8px;
        color: var(--color-background);
        z-index: 1;
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

      .session-item.selected .session-id {
        background: rgba(255, 255, 255, 0.2);
        color: inherit;
      }

      .session-meta {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-md);
        margin-bottom: var(--space-sm);
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .session-item.selected .session-meta {
        color: rgba(255, 255, 255, 0.8);
      }

      .meta-item {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .meta-icon {
        width: 14px;
        height: 14px;
        opacity: 0.7;
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

      .session-item.selected .session-cwd {
        background: rgba(255, 255, 255, 0.1);
        color: inherit;
      }

      .session-summary {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
        margin-bottom: var(--space-sm);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .session-item.selected .session-summary {
        color: rgba(255, 255, 255, 0.9);
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

      .session-item.selected .stat-item {
        color: rgba(255, 255, 255, 0.7);
      }

      .stat-value {
        font-weight: var(--font-weight-medium);
      }

      .session-tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
        margin-top: var(--space-sm);
      }

      .tag {
        background: var(--color-background-tertiary);
        color: var(--color-text-secondary);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius-full);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
      }

      .session-item.selected .tag {
        background: rgba(255, 255, 255, 0.2);
        color: inherit;
      }

      .token-usage {
        color: var(--color-info);
      }

      .session-item.selected .token-usage {
        color: rgba(255, 255, 255, 0.9);
      }

      .duration {
        color: var(--color-warning);
      }

      .session-item.selected .duration {
        color: rgba(255, 255, 255, 0.9);
      }

      /* Loading state */
      :host([loading]) .session-item {
        opacity: 0.6;
        pointer-events: none;
      }

      /* Compact mode */
      :host([compact]) .session-item {
        padding: var(--space-sm);
      }

      :host([compact]) .session-title {
        font-size: var(--font-size-base);
      }

      :host([compact]) .session-summary {
        display: none;
      }

      :host([compact]) .session-tags {
        display: none;
      }

      /* Keyboard focus */
      .session-item:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
    `,
  ];

  /**
   * Session data to display
   */
  @property({ type: Object })
  session!: SessionSummary;

  /**
   * Whether this session is currently selected
   */
  @property({ type: Boolean })
  selected = false;

  /**
   * Whether to show in compact mode
   */
  @property({ type: Boolean })
  compact = false;

  /**
   * Whether to show detailed information
   */
  @property({ type: Boolean })
  detailed = true;

  render() {
    if (!this.session) {
      return html`<div class="session-item">No session data</div>`;
    }

    const classes = {
      'session-item': true,
      selected: this.selected,
      active: this.session.isActive,
    };

    return html`
      <div
        class=${classMap(classes)}
        role="button"
        tabindex="0"
        aria-selected=${this.selected}
        aria-label="Session ${this.session.sessionId}"
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

        <div class="session-meta">
          <div class="meta-item">
            <span class="meta-icon">🕒</span>
            <span>${this.formatDate(this.session.startTime)}</span>
          </div>
          ${this.session.endTime
            ? html`
                <div class="meta-item">
                  <span class="meta-icon">⏱️</span>
                  <span class="duration">${this.formatDuration(this.session.duration)}</span>
                </div>
              `
            : ''}
        </div>

        ${this.session.summary && !this.compact
          ? html`<div class="session-summary">${this.session.summary}</div>`
          : ''}

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
            ? html`
                <div class="stat-item token-usage">
                  <span>🎯</span>
                  <span class="stat-value">${this.formatTokens(this.session.tokenUsage.totalTokens)}</span>
                  <span>tokens</span>
                </div>
              `
            : ''}
        </div>

        ${this.session.tags && this.session.tags.length > 0 && !this.compact
          ? html`
              <div class="session-tags">
                ${this.session.tags.map(tag => html`<span class="tag">${tag}</span>`)}
              </div>
            `
          : ''}
      </div>
    `;
  }

  private handleClick() {
    this.emitEvent('session-selected', {
      sessionId: this.session.sessionId,
      session: this.session,
    });
  }

  protected handleEnter(event: KeyboardEvent) {
    event.preventDefault();
    this.handleClick();
  }

  protected handleOtherKeys(event: KeyboardEvent) {
    if (event.key === ' ') {
      event.preventDefault();
      this.handleClick();
    }
  }

  private formatDuration(duration?: number): string {
    if (!duration) return '';
    
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  private formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-list-item': SessionListItem;
  }
}