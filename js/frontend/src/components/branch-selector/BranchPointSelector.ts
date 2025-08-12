import { html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { 
  SessionSummary,
  BranchPoint,
  MessageDisplay as MessageDisplayType,
  DisplayMode,
  ComponentEvents
} from '../types/session-types';
import { 
  TranscriptEntry,
  AssistantMessage,
  UserMessage
} from '@app/shared';
import { AriaRoles, AriaAttributes, generateId, announce } from '../utils/accessibility';

/**
 * Interactive component for selecting branch points within session message history.
 * Displays messages with visual indicators for potential branch points and handles
 * user interactions for branch creation.
 */
@customElement('branch-point-selector')
export class BranchPointSelector extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        background: var(--color-background);
        max-height: 500px;
        overflow-y: auto;
      }

      .branch-selector-header {
        position: sticky;
        top: 0;
        background: var(--color-background-secondary);
        border-bottom: 1px solid var(--color-border-light);
        padding: var(--space-md);
        z-index: 1;
      }

      .header-title {
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-xs) 0;
        font-size: var(--font-size-md);
      }

      .header-subtitle {
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
        margin: 0;
      }

      .messages-container {
        padding: var(--space-sm);
      }

      .message-item {
        display: flex;
        align-items: flex-start;
        gap: var(--space-sm);
        padding: var(--space-sm);
        margin: var(--space-xs) 0;
        border-radius: var(--border-radius);
        border: 1px solid transparent;
        cursor: pointer;
        transition: all var(--transition-fast);
        position: relative;
      }

      .message-item:hover {
        border-color: var(--color-border);
        background: var(--color-background-secondary);
      }

      .message-item.selectable:hover {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
        box-shadow: var(--shadow-sm);
      }

      .message-item.has-branches {
        border-left: 4px solid var(--color-warning);
      }

      .message-item.assistant.selectable {
        border-left: 3px solid var(--color-assistant);
      }

      .message-item.user {
        border-left: 3px solid var(--color-user);
        opacity: 0.7;
      }

      .message-item.selected {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
        box-shadow: var(--shadow-md);
      }

      .message-index {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-muted);
      }

      .message-item.selectable .message-index {
        background: var(--color-primary);
        color: var(--color-background);
        border-color: var(--color-primary);
      }

      .message-item.selected .message-index {
        background: var(--color-primary-dark);
      }

      .message-content {
        flex: 1;
        min-width: 0;
      }

      .message-role {
        font-weight: var(--font-weight-medium);
        font-size: var(--font-size-sm);
        margin-bottom: var(--space-xs);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .message-role.user {
        color: var(--color-user);
      }

      .message-role.assistant {
        color: var(--color-assistant);
      }

      .message-preview {
        color: var(--color-text-primary);
        line-height: 1.4;
        font-size: var(--font-size-sm);
        max-height: 60px;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
      }

      .message-meta {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-top: var(--space-xs);
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
      }

      .branch-indicator {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius-sm);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
      }

      .branch-icon {
        width: 14px;
        height: 14px;
      }

      .selection-hint {
        position: absolute;
        top: 50%;
        right: var(--space-md);
        transform: translateY(-50%);
        opacity: 0;
        transition: opacity var(--transition-fast);
        color: var(--color-primary);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        background: var(--color-background);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius-sm);
        border: 1px solid var(--color-primary);
      }

      .message-item.selectable:hover .selection-hint {
        opacity: 1;
      }

      .empty-state {
        text-align: center;
        padding: var(--space-xl);
        color: var(--color-text-muted);
      }

      .empty-state-title {
        font-weight: var(--font-weight-medium);
        margin: 0 0 var(--space-sm) 0;
      }

      .empty-state-description {
        margin: 0;
        font-size: var(--font-size-sm);
      }

      /* Focus styles for accessibility */
      .message-item:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .message-item:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .message-item {
          flex-direction: column;
          gap: var(--space-xs);
        }

        .message-index {
          width: 24px;
          height: 24px;
          font-size: var(--font-size-xs);
        }

        .selection-hint {
          position: static;
          transform: none;
          opacity: 1;
          margin-top: var(--space-xs);
          align-self: flex-start;
        }
      }
    `
  ];

  /** Current session data */
  @property({ type: Object })
  session?: SessionSummary;

  /** Transcript entries for the session */
  @property({ type: Array })
  entries: TranscriptEntry[] = [];

  /** Currently selected branch point */
  @state()
  private selectedBranchPoint?: BranchPoint;

  /** Processed branch points data */
  @state()
  private branchPoints: BranchPoint[] = [];

  /** Display mode for messages */
  @property({ type: String })
  displayMode: DisplayMode = 'compact';

  /** Whether to show only valid branch points */
  @property({ type: Boolean, attribute: 'valid-only' })
  validOnly = true;

  /** Component ID for accessibility */
  private componentId = generateId('branch-selector');

  /**
   * Lifecycle: Update branch points when entries change
   */
  protected willUpdate(changedProperties: Map<string | number | symbol, unknown>): void {
    if (changedProperties.has('entries') || changedProperties.has('validOnly')) {
      this.updateBranchPoints();
    }
  }

  /**
   * Process transcript entries to identify potential branch points
   */
  private updateBranchPoints(): void {
    if (!this.entries.length) {
      this.branchPoints = [];
      return;
    }

    this.branchPoints = this.entries
      .map((entry, index) => this.createBranchPoint(entry, index))
      .filter((point): point is BranchPoint => point !== null);
  }

  /**
   * Create a branch point from a transcript entry
   */
  private createBranchPoint(entry: TranscriptEntry, index: number): BranchPoint | null {
    // Only allow branching from assistant messages (typical use case)
    if (this.validOnly && entry.type !== 'assistant') {
      return null;
    }

    const messagePreview = this.extractMessagePreview(entry);
    const hasBranches = this.checkHasBranches(index);
    const branchCount = this.getBranchCount(index);

    return {
      messageIndex: index,
      messagePreview,
      timestamp: new Date(entry.timestamp),
      hasBranches,
      branchCount,
    };
  }

  /**
   * Extract preview text from a message entry
   */
  private extractMessagePreview(entry: TranscriptEntry): string {
    if (entry.type === 'user') {
      const userEntry = entry as any;
      const content = userEntry.message?.content;
      if (typeof content === 'string') {
        return content.slice(0, 150);
      }
      if (Array.isArray(content) && content.length > 0) {
        const firstTextContent = content.find(item => item.type === 'text');
        return firstTextContent ? firstTextContent.text.slice(0, 150) : 'Complex message...';
      }
    }
    
    if (entry.type === 'assistant') {
      const assistantEntry = entry as any;
      const content = assistantEntry.message?.content;
      if (Array.isArray(content) && content.length > 0) {
        const textContent = content.find(item => item.type === 'text');
        return textContent ? textContent.text.slice(0, 150) : 'Tool use or thinking...';
      }
    }

    return 'Message content';
  }

  /**
   * Check if a message index already has branches (placeholder)
   */
  private checkHasBranches(messageIndex: number): boolean {
    // TODO: Implement actual branch checking logic
    // This would query the session data to see if branches exist at this point
    return false;
  }

  /**
   * Get the number of existing branches at this point (placeholder)
   */
  private getBranchCount(messageIndex: number): number {
    // TODO: Implement actual branch counting logic
    return 0;
  }

  /**
   * Handle branch point selection
   */
  private handleBranchPointSelect(branchPoint: BranchPoint, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    // Only allow selection of valid branch points
    const entry = this.entries[branchPoint.messageIndex];
    if (this.validOnly && entry.type !== 'assistant') {
      return;
    }

    this.selectedBranchPoint = branchPoint;

    // Dispatch selection event
    this.dispatchEvent(new CustomEvent('branch-point-selected', {
      detail: {
        sessionId: this.session?.sessionId,
        branchPoint,
      },
      bubbles: true,
      composed: true,
    }));

    // Announce selection for screen readers
    announce(`Branch point selected at message ${branchPoint.messageIndex + 1}`, 'polite');
  }

  /**
   * Handle keyboard navigation
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      const target = event.target as HTMLElement;
      const index = parseInt(target.dataset.messageIndex || '0', 10);
      const branchPoint = this.branchPoints.find(bp => bp.messageIndex === index);
      
      if (branchPoint) {
        event.preventDefault();
        this.handleBranchPointSelect(branchPoint, event);
      }
    }
  }

  /**
   * Render a single message item
   */
  private renderMessageItem(branchPoint: BranchPoint): TemplateResult {
    const entry = this.entries[branchPoint.messageIndex];
    const isSelectable = !this.validOnly || entry.type === 'assistant';
    const isSelected = this.selectedBranchPoint?.messageIndex === branchPoint.messageIndex;

    const classes = classMap({
      'message-item': true,
      'selectable': isSelectable,
      'selected': isSelected,
      'has-branches': branchPoint.hasBranches,
      [entry.type]: true,
    });

    return html`
      <div 
        class=${classes}
        tabindex=${isSelectable ? '0' : '-1'}
        role="button"
        aria-pressed=${isSelected ? 'true' : 'false'}
        aria-label="Branch from message ${branchPoint.messageIndex + 1}"
        data-message-index=${branchPoint.messageIndex}
        @click=${(e: Event) => isSelectable && this.handleBranchPointSelect(branchPoint, e)}
        @keydown=${this.handleKeyDown}
      >
        <div class="message-index">
          ${branchPoint.messageIndex + 1}
        </div>
        
        <div class="message-content">
          <div class="message-role">${entry.type}</div>
          <div class="message-preview">${branchPoint.messagePreview}</div>
          
          <div class="message-meta">
            <span>${branchPoint.timestamp.toLocaleTimeString()}</span>
            ${branchPoint.hasBranches ? html`
              <div class="branch-indicator">
                <svg class="branch-icon" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0a2 2 0 0 0-2 2v4a2 2 0 0 0 1 1.732V9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7.732A2 2 0 0 0 2 6V2a2 2 0 1 0 0 4v4a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3V6a2 2 0 1 0 0-4v4a2 2 0 0 0 1-1.732V2a2 2 0 0 0-2-2z"/>
                </svg>
                ${branchPoint.branchCount} branch${branchPoint.branchCount !== 1 ? 'es' : ''}
              </div>
            ` : ''}
          </div>
        </div>

        ${isSelectable ? html`
          <div class="selection-hint">Click to branch</div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render the component
   */
  render(): TemplateResult {
    if (!this.session || !this.entries.length) {
      return html`
        <div class="empty-state">
          <h3 class="empty-state-title">No Messages Available</h3>
          <p class="empty-state-description">
            Load a session to view branch points.
          </p>
        </div>
      `;
    }

    return html`
      <div class="branch-selector-header">
        <h2 class="header-title">Select Branch Point</h2>
        <p class="header-subtitle">
          Choose a message to branch from. Only assistant responses can be used as branch points.
        </p>
      </div>

      <div 
        class="messages-container"
        role="listbox"
        aria-label="Available branch points"
        aria-activedescendant=${this.selectedBranchPoint ? `msg-${this.selectedBranchPoint.messageIndex}` : ''}
      >
        ${this.branchPoints.length ? html`
          ${repeat(
            this.branchPoints,
            (bp) => bp.messageIndex,
            (bp) => this.renderMessageItem(bp)
          )}
        ` : html`
          <div class="empty-state">
            <h3 class="empty-state-title">No Branch Points Available</h3>
            <p class="empty-state-description">
              This session doesn't contain any assistant responses to branch from.
            </p>
          </div>
        `}
      </div>
    `;
  }
}

// Export types for external use
export type { BranchPoint } from '../types/session-types';