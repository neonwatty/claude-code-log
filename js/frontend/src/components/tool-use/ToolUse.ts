import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { 
  ToolUseContent,
  ToolResultContent,
  ThinkingContent
} from '@app/shared';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';

// Register JSON highlighting for parameter display
hljs.registerLanguage('json', json);

/**
 * Tool use execution status
 */
export type ToolStatus = 'pending' | 'executing' | 'success' | 'error' | 'timeout';

/**
 * Tool use display data interface
 */
export interface ToolUseDisplay {
  /** Tool use information */
  toolUse: ToolUseContent;
  /** Tool result (if available) */
  result?: ToolResultContent;
  /** Current execution status */
  status: ToolStatus;
  /** Execution start time */
  startTime?: Date;
  /** Execution end time */
  endTime?: Date;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Whether to show detailed parameters */
  showDetails?: boolean;
  /** Whether to show result content */
  showResult?: boolean;
}

/**
 * Component for displaying tool use, results, and execution status
 * with collapsible details and proper formatting
 */
@customElement('tool-use')
export class ToolUse extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        margin: var(--space-sm) 0;
      }

      .tool-container {
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
        background: var(--color-background);
        transition: box-shadow var(--transition-fast);
      }

      .tool-container:hover {
        box-shadow: var(--shadow-sm);
      }

      .tool-container.executing {
        border-color: var(--color-warning);
        box-shadow: 0 0 0 2px var(--color-warning-light);
      }

      .tool-container.success {
        border-color: var(--color-success);
      }

      .tool-container.error {
        border-color: var(--color-error);
      }

      .tool-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-sm) var(--space-md);
        background: var(--color-background-secondary);
        border-bottom: 1px solid var(--color-border);
        cursor: pointer;
        user-select: none;
        transition: background var(--transition-fast);
      }

      .tool-header:hover {
        background: var(--color-background-tertiary);
      }

      .tool-header.non-interactive {
        cursor: default;
      }

      .tool-header.non-interactive:hover {
        background: var(--color-background-secondary);
      }

      .tool-info {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .tool-icon {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--border-radius-sm);
        font-size: var(--font-size-sm);
      }

      .tool-icon.pending {
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
      }

      .tool-icon.executing {
        background: var(--color-info-light);
        color: var(--color-info-dark);
        animation: pulse 1.5s ease-in-out infinite;
      }

      .tool-icon.success {
        background: var(--color-success-light);
        color: var(--color-success-dark);
      }

      .tool-icon.error {
        background: var(--color-error-light);
        color: var(--color-error-dark);
      }

      .tool-icon.timeout {
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .tool-name {
        font-family: var(--font-mono);
        font-weight: var(--font-weight-semibold);
        color: var(--color-primary);
        font-size: var(--font-size-sm);
      }

      .tool-duration {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        font-variant-numeric: tabular-nums;
      }

      .tool-controls {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .tool-status {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius-full);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .tool-status.pending {
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
      }

      .tool-status.executing {
        background: var(--color-info-light);
        color: var(--color-info-dark);
      }

      .tool-status.success {
        background: var(--color-success-light);
        color: var(--color-success-dark);
      }

      .tool-status.error {
        background: var(--color-error-light);
        color: var(--color-error-dark);
      }

      .tool-status.timeout {
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
      }

      .expand-toggle {
        background: none;
        border: none;
        cursor: pointer;
        padding: var(--space-xs);
        border-radius: var(--border-radius);
        color: var(--color-text-muted);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
      }

      .expand-toggle:hover {
        background: var(--color-background-tertiary);
        color: var(--color-text-primary);
      }

      .expand-toggle.expanded {
        transform: rotate(180deg);
      }

      .tool-content {
        background: var(--color-background);
      }

      .tool-content.collapsed {
        display: none;
      }

      .tool-section {
        border-bottom: 1px solid var(--color-border);
      }

      .tool-section:last-child {
        border-bottom: none;
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-sm) var(--space-md);
        background: var(--color-background-tertiary);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        cursor: pointer;
        user-select: none;
        transition: background var(--transition-fast);
      }

      .section-header:hover {
        background: var(--color-background-secondary);
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .section-content {
        padding: var(--space-md);
      }

      .section-content.collapsed {
        display: none;
      }

      .parameters-display {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .parameters-header {
        background: var(--color-background-tertiary);
        padding: var(--space-sm) var(--space-md);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .parameters-content {
        padding: var(--space-md);
        font-family: var(--font-mono);
        font-size: var(--font-size-sm);
        overflow-x: auto;
        max-height: 400px;
        overflow-y: auto;
      }

      .parameters-content pre {
        margin: 0;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .result-display {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .result-display.success {
        border-color: var(--color-success);
      }

      .result-display.error {
        border-color: var(--color-error);
      }

      .result-header {
        background: var(--color-background-tertiary);
        padding: var(--space-sm) var(--space-md);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .result-header.success {
        background: var(--color-success-light);
        color: var(--color-success-dark);
      }

      .result-header.error {
        background: var(--color-error-light);
        color: var(--color-error-dark);
      }

      .result-content {
        padding: var(--space-md);
        font-family: var(--font-mono);
        font-size: var(--font-size-sm);
        overflow-x: auto;
        max-height: 600px;
        overflow-y: auto;
      }

      .result-content pre {
        margin: 0;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .thinking-display {
        background: var(--color-info-light);
        border: 1px solid var(--color-info);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .thinking-header {
        background: var(--color-info);
        color: var(--color-text-inverse);
        padding: var(--space-sm) var(--space-md);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .thinking-content {
        padding: var(--space-md);
        color: var(--color-info-dark);
        line-height: 1.6;
        font-style: italic;
        max-height: 400px;
        overflow-y: auto;
      }

      .empty-state {
        padding: var(--space-lg);
        text-align: center;
        color: var(--color-text-muted);
        font-style: italic;
      }

      .compact .tool-header {
        padding: var(--space-xs) var(--space-sm);
      }

      .compact .section-header {
        padding: var(--space-xs) var(--space-sm);
      }

      .compact .section-content {
        padding: var(--space-sm);
      }

      .compact .parameters-content,
      .compact .result-content {
        padding: var(--space-sm);
        font-size: var(--font-size-xs);
      }

      @media (max-width: 768px) {
        .tool-header {
          flex-direction: column;
          align-items: stretch;
          gap: var(--space-sm);
        }

        .tool-info {
          justify-content: space-between;
        }

        .tool-controls {
          justify-content: flex-end;
        }

        .parameters-content,
        .result-content {
          font-size: var(--font-size-xs);
        }
      }
    `,
  ];

  /**
   * Tool use display data
   */
  @property({ type: Object })
  toolDisplay?: ToolUseDisplay;

  /**
   * Whether to show in compact mode
   */
  @property({ type: Boolean })
  compact = false;

  /**
   * Whether the tool content is collapsible
   */
  @property({ type: Boolean })
  collapsible = true;

  /**
   * Whether content is initially collapsed
   */
  @property({ type: Boolean })
  defaultCollapsed = false;

  @state()
  private expanded = false;

  @state()
  private parametersExpanded = true;

  @state()
  private resultExpanded = true;

  @state()
  private thinkingExpanded = false;

  protected firstUpdated() {
    this.expanded = !this.defaultCollapsed;
  }

  render() {
    if (!this.toolDisplay) {
      return html`
        <div class="empty-state">
          No tool use data available
        </div>
      `;
    }

    const containerClasses = {
      'tool-container': true,
      [this.toolDisplay.status]: true,
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
    if (!this.toolDisplay) return '';

    const headerClasses = {
      'tool-header': true,
      'non-interactive': !this.collapsible,
    };

    return html`
      <div 
        class="${classMap(headerClasses)}"
        @click=${this.collapsible ? this.toggleExpanded : undefined}
      >
        <div class="tool-info">
          <div class="tool-icon ${this.toolDisplay.status}">
            ${this.getStatusIcon()}
          </div>
          <div class="tool-name">${this.toolDisplay.toolUse.name}</div>
          ${this.toolDisplay.duration ? html`
            <div class="tool-duration">
              ${this.formatDuration(this.toolDisplay.duration)}
            </div>
          ` : ''}
        </div>
        <div class="tool-controls">
          <div class="tool-status ${this.toolDisplay.status}">
            ${this.toolDisplay.status}
          </div>
          ${this.collapsible ? html`
            <button 
              class="expand-toggle ${this.expanded ? 'expanded' : ''}"
              title="${this.expanded ? 'Collapse' : 'Expand'} tool details"
            >
              ▼
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderContent() {
    const contentClasses = {
      'tool-content': true,
      'collapsed': this.collapsible && !this.expanded,
    };

    return html`
      <div class="${classMap(contentClasses)}">
        ${this.renderParametersSection()}
        ${this.renderResultSection()}
      </div>
    `;
  }

  private renderParametersSection() {
    if (!this.toolDisplay) return '';

    const params = this.toolDisplay.toolUse.input;
    const hasParams = params && Object.keys(params).length > 0;

    if (!hasParams) return '';

    return html`
      <div class="tool-section">
        <div 
          class="section-header"
          @click=${() => this.toggleSection('parameters')}
        >
          <div class="section-title">
            <span>📝</span>
            <span>Parameters</span>
          </div>
          <div class="expand-toggle ${this.parametersExpanded ? 'expanded' : ''}">
            ▼
          </div>
        </div>
        <div class="section-content ${this.parametersExpanded ? '' : 'collapsed'}">
          <div class="parameters-display">
            <div class="parameters-header">Input Parameters</div>
            <div class="parameters-content">
              <pre>${unsafeHTML(this.highlightJson(JSON.stringify(params, null, 2)))}</pre>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderResultSection() {
    if (!this.toolDisplay?.result) return '';

    const result = this.toolDisplay.result;
    const isError = !!result.is_error;
    const resultText = typeof result.content === 'string' 
      ? result.content 
      : JSON.stringify(result.content, null, 2);

    const displayClasses = {
      'result-display': true,
      'success': !isError,
      'error': isError,
    };

    const headerClasses = {
      'result-header': true,
      'success': !isError,
      'error': isError,
    };

    return html`
      <div class="tool-section">
        <div 
          class="section-header"
          @click=${() => this.toggleSection('result')}
        >
          <div class="section-title">
            <span>${isError ? '❌' : '✅'}</span>
            <span>Result</span>
          </div>
          <div class="expand-toggle ${this.resultExpanded ? 'expanded' : ''}">
            ▼
          </div>
        </div>
        <div class="section-content ${this.resultExpanded ? '' : 'collapsed'}">
          <div class="${classMap(displayClasses)}">
            <div class="${classMap(headerClasses)}">
              <span>${isError ? 'Error Result' : 'Success Result'}</span>
              <span>Tool ID: ${result.tool_use_id}</span>
            </div>
            <div class="result-content">
              <pre>${this.formatResult(resultText)}</pre>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private getStatusIcon(): string {
    switch (this.toolDisplay?.status) {
      case 'pending': return '⏳';
      case 'executing': return '🔄';
      case 'success': return '✅';
      case 'error': return '❌';
      case 'timeout': return '⏰';
      default: return '❓';
    }
  }

  private formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = ((milliseconds % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }

  private highlightJson(jsonString: string): string {
    try {
      return hljs.highlight(jsonString, { language: 'json' }).value;
    } catch (err) {
      console.warn('JSON highlighting failed:', err);
      return jsonString;
    }
  }

  private formatResult(result: string): string {
    // Try to format as JSON if possible
    try {
      const parsed = JSON.parse(result);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Return as-is if not JSON
      return result;
    }
  }

  private toggleExpanded() {
    this.expanded = !this.expanded;
    this.emitEvent('expanded-changed', { expanded: this.expanded });
  }

  private toggleSection(section: 'parameters' | 'result' | 'thinking') {
    switch (section) {
      case 'parameters':
        this.parametersExpanded = !this.parametersExpanded;
        break;
      case 'result':
        this.resultExpanded = !this.resultExpanded;
        break;
      case 'thinking':
        this.thinkingExpanded = !this.thinkingExpanded;
        break;
    }
    this.emitEvent('section-toggled', { section, expanded: this[`${section}Expanded`] });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tool-use': ToolUse;
  }
}