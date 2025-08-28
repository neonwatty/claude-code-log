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
        margin-bottom: var(--spacing-md);
      }

      .session-card {
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-lg);
        border: 1px solid var(--color-border-light);
        box-shadow: var(--shadow-neumorphic);
        transition: all var(--transition-medium);
        cursor: pointer;
        position: relative;
        overflow: hidden;
      }

      .session-card:hover {
        transform: var(--transform-hover);
        box-shadow: var(--shadow-neumorphic-hover);
        background: var(--color-surface-hover);
      }

      .session-card:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .session-card.selected {
        border-color: var(--color-primary);
        box-shadow: 
          var(--shadow-neumorphic),
          0 0 0 2px var(--color-primary-light);
      }

      .session-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--spacing-md);
      }

      .session-info {
        flex: 1;
      }

      .session-id {
        font-family: var(--font-family-mono);
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin-bottom: var(--spacing-xs);
      }

      .session-id.highlighted {
        background: yellow;
        padding: 0 2px;
        border-radius: 2px;
      }

      .session-name {
        font-size: var(--font-size-md);
        color: var(--color-text-muted);
        margin-bottom: var(--spacing-xs);
        font-style: italic;
      }

      .session-time-range {
        font-size: var(--font-size-sm);
        color: var(--color-text-light);
        font-family: var(--font-family-mono);
        margin-bottom: var(--spacing-sm);
      }

      .session-badges {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-md);
      }

      .badge {
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--border-radius-md);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        border: 1px solid;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .badge.message-count {
        background: var(--color-message-user-bg);
        color: var(--color-message-user);
        border-color: var(--color-message-user);
      }

      .badge.token-usage {
        background: var(--color-message-assistant-bg);
        color: var(--color-message-assistant);
        border-color: var(--color-message-assistant);
      }

      .badge.cache-stats {
        background: var(--color-message-tool-result-bg);
        color: var(--color-message-tool-result);
        border-color: var(--color-message-tool-result);
      }

      .session-preview {
        font-size: var(--font-size-sm);
        color: var(--color-text);
        line-height: var(--line-height-relaxed);
        margin-top: var(--spacing-md);
        padding-top: var(--spacing-md);
        border-top: 1px solid var(--color-border-light);
        position: relative;
      }

      .session-preview.no-preview {
        color: var(--color-text-muted);
        font-style: italic;
      }

      .session-preview.truncated {
        max-height: 3.6em;
        overflow: hidden;
        position: relative;
      }

      .session-preview.truncated::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1.2em;
        background: linear-gradient(transparent, var(--color-surface));
      }

      .read-more-btn {
        background: none;
        border: none;
        color: var(--color-primary);
        font-size: var(--font-size-xs);
        cursor: pointer;
        margin-top: var(--spacing-xs);
        padding: 0;
        text-decoration: underline;
      }

      .read-more-btn:hover {
        color: var(--color-primary-hover);
      }

      .working-directory {
        font-family: var(--font-family-mono);
        font-size: var(--font-size-xs);
        color: var(--color-text-light);
        background: var(--color-surface-disabled);
        padding: var(--spacing-xs);
        border-radius: var(--border-radius-xs);
        margin-top: var(--spacing-sm);
        overflow-x: auto;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .session-card {
          padding: var(--spacing-md);
        }

        .session-header {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-sm);
        }

        .session-badges {
          gap: var(--spacing-xs);
        }

        .badge {
          font-size: var(--font-size-xs);
          padding: 2px var(--spacing-xs);
        }
      }

      /* Accessibility improvements */
      @media (prefers-reduced-motion: reduce) {
        .session-card:hover {
          transform: none;
        }
      }

      /* Focus visible support */
      .session-card:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
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

  override render() {
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