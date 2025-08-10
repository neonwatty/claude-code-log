import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { ThinkingContent } from '@app/shared';

/**
 * Component for displaying thinking content with collapsible sections
 */
@customElement('thinking-display')
export class ThinkingDisplay extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        margin: var(--space-sm) 0;
      }

      .thinking-container {
        background: var(--color-info-light);
        border: 1px solid var(--color-info);
        border-radius: var(--border-radius);
        overflow: hidden;
        transition: box-shadow var(--transition-fast);
      }

      .thinking-container:hover {
        box-shadow: var(--shadow-sm);
      }

      .thinking-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-sm) var(--space-md);
        background: var(--color-info);
        color: var(--color-text-inverse);
        cursor: pointer;
        user-select: none;
        transition: background var(--transition-fast);
      }

      .thinking-header:hover {
        background: var(--color-info-dark);
      }

      .thinking-header.non-interactive {
        cursor: default;
      }

      .thinking-header.non-interactive:hover {
        background: var(--color-info);
      }

      .thinking-info {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .thinking-icon {
        font-size: var(--font-size-lg);
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .thinking-title {
        font-weight: var(--font-weight-semibold);
        font-size: var(--font-size-sm);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .thinking-meta {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .word-count {
        font-size: var(--font-size-xs);
        opacity: 0.8;
        font-variant-numeric: tabular-nums;
      }

      .expand-toggle {
        background: none;
        border: none;
        cursor: pointer;
        padding: var(--space-xs);
        border-radius: var(--border-radius);
        color: inherit;
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
      }

      .expand-toggle:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .expand-toggle.expanded {
        transform: rotate(180deg);
      }

      .thinking-content {
        padding: var(--space-md);
        color: var(--color-info-dark);
        line-height: 1.6;
        font-style: italic;
        background: var(--color-info-light);
      }

      .thinking-content.collapsed {
        display: none;
      }

      .thinking-text {
        white-space: pre-wrap;
        word-wrap: break-word;
        max-height: 400px;
        overflow-y: auto;
        margin: 0;
      }

      .thinking-text.expanded {
        max-height: none;
      }

      .expand-text-toggle {
        margin-top: var(--space-sm);
        text-align: center;
      }

      .expand-text-button {
        background: none;
        border: none;
        color: var(--color-info);
        cursor: pointer;
        font-size: var(--font-size-sm);
        text-decoration: underline;
        padding: var(--space-xs);
        border-radius: var(--border-radius);
        transition: all var(--transition-fast);
      }

      .expand-text-button:hover {
        background: var(--color-info-light);
        text-decoration: none;
      }

      .signature-section {
        margin-top: var(--space-md);
        padding-top: var(--space-md);
        border-top: 1px solid var(--color-info);
        font-style: normal;
      }

      .signature-label {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-info);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: var(--space-xs);
      }

      .signature-content {
        font-family: var(--font-mono);
        font-size: var(--font-size-sm);
        background: rgba(255, 255, 255, 0.1);
        padding: var(--space-sm);
        border-radius: var(--border-radius);
        word-break: break-all;
      }

      .empty-state {
        padding: var(--space-lg);
        text-align: center;
        color: var(--color-text-muted);
        font-style: italic;
      }

      .compact .thinking-header {
        padding: var(--space-xs) var(--space-sm);
      }

      .compact .thinking-content {
        padding: var(--space-sm);
      }

      .compact .thinking-text {
        font-size: var(--font-size-sm);
        max-height: 200px;
      }

      @media (max-width: 768px) {
        .thinking-header {
          flex-direction: column;
          align-items: stretch;
          gap: var(--space-sm);
        }

        .thinking-info {
          justify-content: space-between;
        }

        .thinking-meta {
          justify-content: flex-end;
        }

        .thinking-text {
          font-size: var(--font-size-sm);
        }
      }
    `,
  ];

  /**
   * Thinking content to display
   */
  @property({ type: Object })
  thinkingContent?: ThinkingContent;

  /**
   * Whether to show in compact mode
   */
  @property({ type: Boolean })
  compact = false;

  /**
   * Whether the thinking content is collapsible
   */
  @property({ type: Boolean })
  collapsible = true;

  /**
   * Whether content is initially collapsed
   */
  @property({ type: Boolean })
  defaultCollapsed = true;

  /**
   * Maximum characters to show before truncating
   */
  @property({ type: Number })
  truncateThreshold = 500;

  @state()
  private expanded = false;

  @state()
  private textExpanded = false;

  constructor() {
    super();
    // Fallback for test environment where decorators might fail
    if (typeof this.collapsible === 'undefined') {
      this.collapsible = true;
    }
    if (typeof this.defaultCollapsed === 'undefined') {
      this.defaultCollapsed = true;
    }
    if (typeof this.compact === 'undefined') {
      this.compact = false;
    }
    if (typeof this.truncateThreshold === 'undefined') {
      this.truncateThreshold = 500;
    }
  }

  protected firstUpdated() {
    this.expanded = !this.defaultCollapsed;
  }

  render() {
    if (!this.thinkingContent) {
      return html`
        <div class="empty-state">
          No thinking content available
        </div>
      `;
    }

    const containerClasses = {
      'thinking-container': true,
      'compact': this.compact,
    };

    return html`
      <div class="${classMap(containerClasses)}">
        ${this.renderHeader()}
        ${this.renderContent()}
      </div>
    `;
  }

  private renderHeader() {
    if (!this.thinkingContent) return '';

    const headerClasses = {
      'thinking-header': true,
      'non-interactive': !this.collapsible,
    };

    const wordCount = this.getWordCount();

    return html`
      <div 
        class="${classMap(headerClasses)}"
        @click=${this.collapsible ? this.toggleExpanded : undefined}
      >
        <div class="thinking-info">
          <div class="thinking-icon">💭</div>
          <div class="thinking-title">Thinking</div>
        </div>
        <div class="thinking-meta">
          <div class="word-count">${wordCount} words</div>
          ${this.collapsible ? html`
            <button 
              class="expand-toggle ${this.expanded ? 'expanded' : ''}"
              title="${this.expanded ? 'Collapse' : 'Expand'} thinking content"
            >
              ▼
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderContent() {
    if (!this.thinkingContent) return '';

    const contentClasses = {
      'thinking-content': true,
      'collapsed': this.collapsible && !this.expanded,
    };

    const thinkingText = this.thinkingContent.thinking;
    const shouldTruncate = thinkingText.length > this.truncateThreshold;
    const displayText = shouldTruncate && !this.textExpanded 
      ? thinkingText.substring(0, this.truncateThreshold) + '...'
      : thinkingText;

    const textClasses = {
      'thinking-text': true,
      'expanded': this.textExpanded,
    };

    return html`
      <div class="${classMap(contentClasses)}">
        <pre class="${classMap(textClasses)}">${displayText}</pre>
        
        ${shouldTruncate ? html`
          <div class="expand-text-toggle">
            <button 
              class="expand-text-button"
              @click=${this.toggleTextExpanded}
            >
              ${this.textExpanded ? 'Show Less' : `Show More (+${thinkingText.length - this.truncateThreshold} characters)`}
            </button>
          </div>
        ` : ''}

        ${this.thinkingContent.signature ? this.renderSignature() : ''}
      </div>
    `;
  }

  private renderSignature() {
    if (!this.thinkingContent?.signature) return '';

    return html`
      <div class="signature-section">
        <div class="signature-label">Signature</div>
        <div class="signature-content">
          ${this.thinkingContent.signature}
        </div>
      </div>
    `;
  }

  private getWordCount(): number {
    if (!this.thinkingContent) return 0;
    
    return this.thinkingContent.thinking
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
      .length;
  }

  private toggleExpanded() {
    this.expanded = !this.expanded;
    this.emitEvent('expanded-changed', { expanded: this.expanded });
  }

  private toggleTextExpanded(event: Event) {
    event.stopPropagation(); // Prevent header click when clicking expand text button
    this.textExpanded = !this.textExpanded;
    this.emitEvent('text-expanded-changed', { textExpanded: this.textExpanded });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'thinking-display': ThinkingDisplay;
  }
}