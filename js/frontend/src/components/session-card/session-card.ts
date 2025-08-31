import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";

export interface SessionData {
  id: string;
  name?: string;
  startTime: string;
  endTime: string;
  messageCount: number;
  tokenUsage?: {
    input: number;
    output: number;
    cacheCreation?: number;
    cacheRead?: number;
  };
  preview?: string;
  workingDirectory?: string;
}

@customElement("session-card")
export class SessionCard extends BaseComponent {
  @property({ type: Object })
  session!: SessionData;

  @property({ type: Boolean })
  isSelected = false;

  @property({ type: String })
  searchTerm = '';

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        margin-bottom: var(--spacing-4);
      }

      .session-card {
        background: var(--color-card-bg);
        border-radius: var(--radius-xl);
        padding: var(--spacing-6);
        border: 1px solid var(--color-card-border);
        box-shadow: var(--color-card-shadow);
        transition: all var(--transition-medium);
        cursor: pointer;
        position: relative;
        overflow: hidden;
        border-left: 4px solid var(--color-primary);
      }

      .session-card:hover {
        transform: var(--transform-hover);
        box-shadow: var(--color-card-shadow-hover);
        background: var(--color-surface-hover);
        border-color: var(--color-card-border-hover);
        border-left-color: var(--color-primary-hover);
      }

      .session-card:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .session-card.selected {
        border-color: var(--color-primary);
        box-shadow: var(--shadow-md), 0 0 0 1px var(--color-primary);
        background: var(--color-primary-light);
      }

      .session-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--spacing-4);
      }

      .session-info {
        flex: 1;
        min-width: 0; /* Allow text truncation */
      }

      .session-id {
        font-family: var(--font-family-mono);
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-header);
        margin-bottom: var(--spacing-2);
        word-break: break-all;
      }

      .session-id.highlighted {
        background: var(--color-warning-bg);
        color: var(--color-warning);
        padding: 0 var(--spacing-1);
        border-radius: var(--radius-sm);
      }

      .session-name {
        font-size: var(--text-base);
        color: var(--color-text-muted);
        margin-bottom: var(--spacing-2);
        font-weight: var(--font-weight-medium);
      }

      .session-time-range {
        font-size: var(--text-sm);
        color: var(--color-text-light);
        font-family: var(--font-family-mono);
        margin-bottom: var(--spacing-3);
      }

      .session-badges {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-2);
        margin-bottom: var(--spacing-4);
      }

      .badge {
        padding: var(--spacing-1) var(--spacing-3);
        border-radius: var(--radius-full);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        border: 1px solid transparent;
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-1);
        white-space: nowrap;
      }

      .badge.message-count {
        background: var(--color-info-bg);
        color: var(--color-info);
        border-color: var(--color-info);
      }

      .badge.token-usage {
        background: var(--color-message-assistant-bg);
        color: var(--color-message-assistant);
        border-color: var(--color-message-assistant);
      }

      .badge.cache-stats {
        background: var(--color-success-bg);
        color: var(--color-success);
        border-color: var(--color-success);
      }

      .session-preview {
        font-size: var(--text-sm);
        color: var(--color-text);
        line-height: var(--line-height-relaxed);
        margin-top: var(--spacing-4);
        padding-top: var(--spacing-4);
        border-top: 1px solid var(--color-border);
        position: relative;
      }

      .session-preview.no-preview {
        color: var(--color-text-muted);
        font-style: italic;
      }

      .session-preview.truncated {
        max-height: 4.5em;
        overflow: hidden;
        position: relative;
      }

      .session-preview.truncated::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1.5em;
        background: linear-gradient(transparent, var(--color-surface));
        pointer-events: none;
      }

      .read-more-btn {
        background: none;
        border: none;
        color: var(--color-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        margin-top: var(--spacing-2);
        padding: var(--spacing-1) 0;
        transition: color var(--transition-fast);
      }

      .read-more-btn:hover {
        color: var(--color-primary-hover);
      }

      .working-directory {
        font-family: var(--font-family-mono);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        background: var(--color-surface-secondary);
        padding: var(--spacing-2) var(--spacing-3);
        border-radius: var(--radius-md);
        margin-top: var(--spacing-3);
        overflow-x: auto;
        border: 1px solid var(--color-border);
      }

      /* Responsive design - Mobile-first */
      @media (max-width: 768px) {
        .session-card {
          padding: var(--spacing-4);
          margin-bottom: var(--spacing-3);
        }

        .session-header {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-2);
          margin-bottom: var(--spacing-3);
        }

        .session-id {
          font-size: var(--text-base);
          word-break: break-word;
        }

        .session-badges {
          gap: var(--spacing-1);
        }

        .badge {
          font-size: var(--text-xs);
          padding: var(--spacing-1) var(--spacing-2);
        }

        .session-preview {
          margin-top: var(--spacing-3);
          padding-top: var(--spacing-3);
        }
      }

      /* Accessibility improvements */
      @media (prefers-reduced-motion: reduce) {
        .session-card,
        .read-more-btn {
          transition: none;
        }
        
        .session-card:hover {
          transform: none;
        }
      }

      /* High contrast mode */
      @media (prefers-contrast: high) {
        .badge {
          border-width: 2px;
        }
      }
    `,
  ];

  private formatTimeRange(): string {
    const start = new Date(this.session.startTime).toLocaleString();
    const end = new Date(this.session.endTime).toLocaleString();
    return `${start} - ${end}`;
  }

  private formatTokenUsage(): string {
    if (!this.session.tokenUsage) return '';
    
    const { input, output, cacheCreation, cacheRead } = this.session.tokenUsage;
    let usage = `Input: ${input.toLocaleString()} | Output: ${output.toLocaleString()}`;
    
    if (cacheCreation) {
      usage += ` | Cache Creation: ${cacheCreation.toLocaleString()}`;
    }
    if (cacheRead) {
      usage += ` | Cache Read: ${cacheRead.toLocaleString()}`;
    }
    
    return usage;
  }

  private highlightSearchTerm(text: string): string {
    if (!this.searchTerm || !text) return text;
    
    const regex = new RegExp(`(${this.searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  private truncatePreview(text: string, maxLength = 120): { text: string; isTruncated: boolean } {
    if (!text || text.length <= maxLength) {
      return { text, isTruncated: false };
    }
    
    const truncated = text.substring(0, maxLength).trim();
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    return {
      text: lastSpaceIndex > 0 ? truncated.substring(0, lastSpaceIndex) + '...' : truncated + '...',
      isTruncated: true
    };
  }

  private handleCardClick() {
    this.dispatchEvent(new CustomEvent('session-selected', {
      detail: { sessionId: this.session.id, session: this.session },
      bubbles: true
    }));
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.handleCardClick();
    }
  }

  protected safeRender() {
    const { text: previewText, isTruncated } = this.truncatePreview(this.session.preview || '');
    const tokenUsage = this.formatTokenUsage();

    return html`
      <div 
        class="session-card ${this.isSelected ? 'selected' : ''}"
        @click=${this.handleCardClick}
        @keydown=${this.handleKeyDown}
        tabindex="0"
        role="button"
        aria-label="Session ${this.session.id}: ${this.session.messageCount} messages"
      >
        <div class="session-header">
          <div class="session-info">
            <div class="session-id" .innerHTML=${this.highlightSearchTerm(this.session.id)}>
            </div>
            
            ${this.session.name ? html`
              <div class="session-name" .innerHTML=${this.highlightSearchTerm(this.session.name)}>
              </div>
            ` : ''}
            
            <div class="session-time-range">
              ${this.formatTimeRange()}
            </div>
          </div>
        </div>

        <div class="session-badges">
          <span class="badge message-count">
            💬 ${this.session.messageCount} message${this.session.messageCount !== 1 ? 's' : ''}
          </span>
          
          ${tokenUsage ? html`
            <span class="badge token-usage" title="${tokenUsage}">
              🎯 ${this.session.tokenUsage?.input}→${this.session.tokenUsage?.output}
            </span>
          ` : ''}
          
          ${this.session.tokenUsage?.cacheRead ? html`
            <span class="badge cache-stats">
              🗄️ Cache: ${this.session.tokenUsage.cacheRead.toLocaleString()}
            </span>
          ` : ''}
        </div>

        ${this.session.preview ? html`
          <div class="session-preview ${isTruncated ? 'truncated' : ''}" .innerHTML=${this.highlightSearchTerm(previewText)}>
          </div>
          ${isTruncated ? html`
            <button class="read-more-btn" @click=${this.handleReadMoreClick}>
              Read more...
            </button>
          ` : ''}
        ` : html`
          <div class="session-preview no-preview">
            No preview available
          </div>
        `}

        ${this.session.workingDirectory ? html`
          <div class="working-directory" title="Working Directory">
            📁 ${this.session.workingDirectory}
          </div>
        ` : ''}
      </div>
    `;
  }

  private handleReadMoreClick(event: Event) {
    event.stopPropagation();
    // Dispatch event to show full preview
    this.dispatchEvent(new CustomEvent('preview-expand-requested', {
      detail: { sessionId: this.session.id, fullPreview: this.session.preview },
      bubbles: true
    }));
  }
}

// Component is registered via @customElement decorator