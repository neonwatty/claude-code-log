import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';
import { BaseComponent } from '../../base/BaseComponent';
import { baseStyles } from '../../styles/theme';
import { 
  SessionDetail, 
  MessageDisplay, 
  ProcessedContent,
  MessageMetadata,
  SessionBranchData 
} from '../../types/session-types';
import '../../message-display/MessageDisplay';
import '../../syntax-highlighter/SyntaxHighlighter';
import '../../tool-use/ToolUse';
import '../../branch-visualization/BranchVisualization';
import { AriaRoles, AriaAttributes, generateId, announce } from '../../utils/accessibility';
import { useVirtualScroll, createVirtualScrollConfig } from '../../utils/virtual-scroll';

/**
 * Session viewer component with message timeline, conversation threading,
 * and expandable message details
 */
@customElement('session-viewer')
export class SessionViewer extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        height: 100%;
        overflow: hidden;
      }

      .viewer-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-background);
      }

      .viewer-header {
        padding: var(--space-md);
        border-bottom: 1px solid var(--color-border-light);
        background: var(--color-background-secondary);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }

      .session-info {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .session-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0;
      }

      .session-meta {
        display: flex;
        gap: var(--space-md);
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .session-stats {
        display: flex;
        gap: var(--space-lg);
        font-size: var(--font-size-sm);
      }

      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-xs);
      }

      .stat-value {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }

      .stat-label {
        color: var(--color-text-secondary);
        font-size: var(--font-size-xs);
      }

      .viewer-controls {
        display: flex;
        gap: var(--space-sm);
        align-items: center;
      }

      .control-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        transition: all var(--transition-fast);
      }

      .control-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
      }

      .control-button.active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .viewer-content {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .timeline-container {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: var(--space-md);
        scroll-behavior: smooth;
      }

      .timeline-container.virtual {
        position: relative;
      }

      .virtual-spacer {
        pointer-events: none;
        user-select: none;
      }

      .message-timeline {
        display: flex;
        flex-direction: column;
        gap: var(--space-lg);
        max-width: 100%;
      }

      .message-group {
        position: relative;
        padding-left: var(--space-xxl);
      }

      /* Enhanced conversation threading visualization */
      .message-group::before {
        content: '';
        position: absolute;
        left: var(--space-lg);
        top: 0;
        bottom: var(--space-lg);
        width: 3px;
        background: linear-gradient(
          to bottom,
          var(--color-border-light) 0%,
          var(--color-primary-light) 50%,
          var(--color-border-light) 100%
        );
        border-radius: 2px;
        opacity: 0.6;
      }

      .message-group:last-child::before {
        bottom: 60%;
        background: linear-gradient(
          to bottom,
          var(--color-border-light) 0%,
          var(--color-primary-light) 70%,
          transparent 100%
        );
      }

      /* Threading indicators for related messages */
      .message-group.thread-continuation::before {
        background: var(--color-success-light);
        box-shadow: 0 0 4px var(--color-success-light);
      }

      .message-group.branch-point::before {
        background: var(--color-warning);
        width: 4px;
        box-shadow: 0 0 6px var(--color-warning-light);
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 0.6;
          transform: scaleY(1);
        }
        50% {
          opacity: 1;
          transform: scaleY(1.05);
        }
      }

      .message-item {
        position: relative;
        margin-bottom: var(--space-lg);
        transition: all var(--transition-fast);
      }

      .message-item:hover {
        transform: translateX(2px);
      }

      /* Enhanced message type indicators */
      .message-item::before {
        content: '';
        position: absolute;
        left: calc(-1 * var(--space-xxl) + var(--space-lg) - 6px);
        top: var(--space-md);
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--color-primary);
        border: 3px solid var(--color-background);
        z-index: 2;
        box-shadow: var(--shadow-sm);
        transition: all var(--transition-fast);
      }

      .message-item::after {
        content: '';
        position: absolute;
        left: calc(-1 * var(--space-xxl) + var(--space-lg) - 4px);
        top: calc(var(--space-md) + 2px);
        width: 8px;
        height: 8px;
        border-radius: 50%;
        z-index: 3;
        opacity: 0.9;
        transition: all var(--transition-fast);
      }

      /* Message type specific styling */
      .message-item.user::before {
        background: var(--color-success);
        border-color: var(--color-success-light);
      }

      .message-item.user::after {
        background: radial-gradient(circle, var(--color-success-dark) 0%, transparent 70%);
      }

      .message-item.assistant::before {
        background: var(--color-primary);
        border-color: var(--color-primary-light);
      }

      .message-item.assistant::after {
        background: radial-gradient(circle, var(--color-primary-dark) 0%, transparent 70%);
      }

      .message-item.system::before {
        background: var(--color-warning);
        border-color: var(--color-warning-light);
      }

      .message-item.system::after {
        background: radial-gradient(circle, var(--color-warning-dark) 0%, transparent 70%);
      }

      .message-item.error::before {
        background: var(--color-error);
        border-color: var(--color-error-light);
        animation: errorPulse 1.5s infinite;
      }

      .message-item.error::after {
        background: radial-gradient(circle, var(--color-error-dark) 0%, transparent 70%);
      }

      @keyframes errorPulse {
        0%, 100% {
          box-shadow: var(--shadow-sm);
        }
        50% {
          box-shadow: 0 0 8px var(--color-error-light);
        }
      }

      /* Hover effects for message items */
      .message-item:hover::before {
        transform: scale(1.2);
        box-shadow: 0 0 12px currentColor;
      }

      .message-item:hover::after {
        opacity: 1;
        transform: scale(1.1);
      }

      /* Selected message styling */
      .message-item.selected::before {
        transform: scale(1.3);
        box-shadow: 0 0 16px currentColor;
        border-width: 2px;
      }

      .message-item.selected .message-content {
        border-left: 4px solid var(--color-primary);
        box-shadow: var(--shadow-lg);
      }

      .message-content {
        background: var(--color-background);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
        overflow: hidden;
        transition: all var(--transition-fast);
      }

      .message-content:hover {
        border-color: var(--color-border);
        box-shadow: var(--shadow-sm);
      }

      .message-content.selected {
        border-color: var(--color-primary);
        box-shadow: var(--shadow-focus);
      }

      .message-header {
        padding: var(--space-sm) var(--space-md);
        background: var(--color-background-secondary);
        border-bottom: 1px solid var(--color-border-light);
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
      }

      .message-info {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .message-role {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        text-transform: capitalize;
      }

      .message-timestamp {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
      }

      .message-badges {
        display: flex;
        gap: var(--space-xs);
      }

      .message-badge {
        background: var(--color-background-tertiary);
        color: var(--color-text-secondary);
        padding: 2px var(--space-xs);
        border-radius: var(--border-radius-sm);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
      }

      .message-badge.tool-use {
        background: var(--color-primary-light);
        color: var(--color-primary);
      }

      .message-badge.thinking {
        background: var(--color-warning-light);
        color: var(--color-warning);
      }

      .message-badge.error {
        background: var(--color-error-light);
        color: var(--color-error);
      }

      .message-actions {
        display: flex;
        gap: var(--space-xs);
        align-items: center;
      }

      .message-action {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: var(--space-xs);
        border-radius: var(--border-radius-sm);
        transition: all var(--transition-fast);
        font-size: var(--font-size-sm);
      }

      .message-action:hover {
        background: var(--color-background-tertiary);
        color: var(--color-text-primary);
      }

      .message-action.active {
        color: var(--color-primary);
      }

      .expand-toggle {
        transform: rotate(0deg);
        transition: transform var(--transition-fast);
      }

      .expand-toggle.expanded {
        transform: rotate(180deg);
      }

      .message-body {
        padding: var(--space-md);
        overflow: hidden;
        transition: all var(--transition-normal);
      }

      .message-body.collapsed {
        max-height: 0;
        padding-top: 0;
        padding-bottom: 0;
      }

      /* Enhanced branch indicators */
      .branch-indicator {
        margin-top: var(--space-md);
        padding: var(--space-md);
        background: linear-gradient(135deg, var(--color-info-light) 0%, var(--color-primary-light) 100%);
        border: 2px solid var(--color-info);
        border-radius: var(--border-radius);
        font-size: var(--font-size-sm);
        color: var(--color-info-dark);
        position: relative;
        overflow: hidden;
      }

      .branch-indicator::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--color-info) 0%, var(--color-primary) 100%);
        animation: shimmer 2s linear infinite;
      }

      @keyframes shimmer {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }

      .branch-indicator-content {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        position: relative;
        z-index: 1;
      }

      .branch-icon {
        font-size: var(--font-size-lg);
        opacity: 0.8;
      }

      .branch-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .branch-title {
        font-weight: var(--font-weight-semibold);
        color: var(--color-info-dark);
      }

      .branch-description {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        opacity: 0.9;
      }

      .branch-actions {
        display: flex;
        gap: var(--space-sm);
        align-items: center;
        flex-shrink: 0;
      }

      .branch-button {
        background: var(--color-info);
        color: var(--color-text-inverse);
        border: none;
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        transition: all var(--transition-fast);
        position: relative;
        overflow: hidden;
      }

      .branch-button::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        transition: left var(--transition-normal);
      }

      .branch-button:hover {
        background: var(--color-info-dark);
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
      }

      .branch-button:hover::before {
        left: 100%;
      }

      .branch-button.primary {
        background: var(--color-primary);
      }

      .branch-button.primary:hover {
        background: var(--color-primary-dark);
      }

      .branch-button.danger {
        background: var(--color-error);
      }

      .branch-button.danger:hover {
        background: var(--color-error-dark);
      }

      /* Branch point indicator in timeline */
      .branch-point-marker {
        position: absolute;
        right: var(--space-sm);
        top: var(--space-sm);
        background: var(--color-warning);
        color: var(--color-text-inverse);
        padding: var(--space-xs);
        border-radius: var(--border-radius-full);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        box-shadow: var(--shadow-sm);
        animation: branchPulse 2s ease-in-out infinite;
      }

      @keyframes branchPulse {
        0%, 100% {
          opacity: 0.8;
          transform: scale(1);
        }
        50% {
          opacity: 1;
          transform: scale(1.05);
        }
      }

      /* Enhanced message badges */
      .message-badges {
        display: flex;
        gap: var(--space-xs);
      }

      .message-badge {
        background: var(--color-background-tertiary);
        color: var(--color-text-secondary);
        padding: 2px var(--space-xs);
        border-radius: var(--border-radius-full);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        transition: all var(--transition-fast);
      }

      .message-badge:hover {
        transform: translateY(-1px);
        box-shadow: var(--shadow-sm);
      }

      .message-badge.tool-use {
        background: var(--color-primary-light);
        color: var(--color-primary-dark);
        border: 1px solid var(--color-primary);
      }

      .message-badge.tool-use::before {
        content: '🛠️';
        font-size: var(--font-size-xs);
      }

      .message-badge.thinking {
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
        border: 1px solid var(--color-warning);
      }

      .message-badge.thinking::before {
        content: '💭';
        font-size: var(--font-size-xs);
      }

      .message-badge.error {
        background: var(--color-error-light);
        color: var(--color-error-dark);
        border: 1px solid var(--color-error);
        animation: errorBadgePulse 1.5s infinite;
      }

      .message-badge.error::before {
        content: '⚠️';
        font-size: var(--font-size-xs);
      }

      @keyframes errorBadgePulse {
        0%, 100% {
          opacity: 0.9;
        }
        50% {
          opacity: 1;
          box-shadow: 0 0 4px var(--color-error-light);
        }
      }

      .message-badge.tokens {
        background: var(--color-info-light);
        color: var(--color-info-dark);
        border: 1px solid var(--color-info);
      }

      .message-badge.tokens::before {
        content: '🔢';
        font-size: var(--font-size-xs);
      }

      .message-badge.branch-available {
        background: var(--color-success-light);
        color: var(--color-success-dark);
        border: 1px solid var(--color-success);
        cursor: pointer;
      }

      .message-badge.branch-available::before {
        content: '🌿';
        font-size: var(--font-size-xs);
      }

      .message-badge.branch-available:hover {
        background: var(--color-success);
        color: var(--color-text-inverse);
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        color: var(--color-text-muted);
        padding: var(--space-xxl);
      }

      .empty-state-icon {
        font-size: 3rem;
        margin-bottom: var(--space-lg);
        opacity: 0.5;
      }

      .empty-state-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-medium);
        margin-bottom: var(--space-md);
      }

      .loading-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-lg);
        color: var(--color-text-muted);
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .viewer-header {
          flex-direction: column;
          gap: var(--space-md);
          align-items: stretch;
        }

        .session-stats {
          justify-content: space-around;
        }

        .message-group {
          padding-left: var(--space-lg);
        }

        .message-header {
          flex-direction: column;
          gap: var(--space-sm);
          align-items: stretch;
        }

        .message-info {
          justify-content: space-between;
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
   * Session to display
   */
  @property({ type: Object })
  session: SessionDetail | null = null;

  /**
   * Whether to enable real-time updates
   */
  @property({ type: Boolean })
  realTimeUpdates = true;

  /**
   * Whether to show branch visualization
   */
  @property({ type: Boolean })
  showBranches = true;

  /**
   * Whether to enable message threading
   */
  @property({ type: Boolean })
  showThreading = true;

  /**
   * Whether to enable virtual scrolling for large sessions
   */
  @property({ type: Boolean })
  virtualScrolling = false;

  /**
   * Branch data for the current session
   */
  @property({ type: Object })
  branchData: SessionBranchData | null = null;

  /**
   * Available branch points in the session
   */
  @property({ type: Array })
  branchPoints: number[] = [];

  /**
   * Whether to show conversation threading indicators
   */
  @property({ type: Boolean })
  showConversationThreading = true;

  @state()
  private selectedMessageIndex: number | null = null;

  @state()
  private expandedMessages = new Set<number>();

  @state()
  private messageDisplays: MessageDisplay[] = [];

  @state()
  private viewerId = generateId('session-viewer');

  @state()
  private timelineId = generateId('message-timeline');

  @query('.timeline-container')
  private timelineContainer!: HTMLElement;

  private virtualScroll = useVirtualScroll(this, createVirtualScrollConfig({
    itemHeight: 200, // Estimated message height
    overscan: 3,
    containerHeight: 600,
  }));

  render() {
    if (!this.session) {
      return this.renderEmptyState();
    }

    return html`
      <div 
        class="viewer-container"
        role="${AriaRoles.MAIN}"
        aria-label="Session viewer"
      >
        ${this.renderHeader()}
        ${this.renderContent()}
      </div>
    `;
  }

  private renderHeader() {
    if (!this.session) return '';

    return html`
      <header class="viewer-header" role="banner">
        <div class="session-info">
          <h2 class="session-title">${this.session.title || this.session.sessionId}</h2>
          <div class="session-meta">
            <span>Started: ${this.formatTimestamp(this.session.startTime)}</span>
            ${this.session.endTime ? html`
              <span>Ended: ${this.formatTimestamp(this.session.endTime)}</span>
            ` : html`<span>Active Session</span>`}
            <span>Working Directory: ${this.session.cwd}</span>
          </div>
        </div>

        <div class="session-stats">
          <div class="stat-item">
            <div class="stat-value">${this.session.messageCount}</div>
            <div class="stat-label">Messages</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${this.session.userMessageCount}</div>
            <div class="stat-label">User</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${this.session.assistantMessageCount}</div>
            <div class="stat-label">Assistant</div>
          </div>
          ${this.session.tokenUsage ? html`
            <div class="stat-item">
              <div class="stat-value">${this.formatNumber(this.session.tokenUsage.totalTokens)}</div>
              <div class="stat-label">Tokens</div>
            </div>
          ` : ''}
        </div>

        <div class="viewer-controls">
          <button 
            class="control-button ${this.showThreading ? 'active' : ''}"
            @click=${this.toggleThreading}
            title="Toggle conversation threading"
          >
            🧵 Threading
          </button>
          <button 
            class="control-button ${this.showBranches ? 'active' : ''}"
            @click=${this.toggleBranches}
            title="Toggle branch visualization"
          >
            🌿 Branches
          </button>
          <button 
            class="control-button ${this.virtualScrolling ? 'active' : ''}"
            @click=${this.toggleVirtualScrolling}
            title="Toggle virtual scrolling"
          >
            ⚡ Virtual
          </button>
          <button 
            class="control-button"
            @click=${this.expandAllMessages}
            title="Expand all messages"
          >
            📖 Expand All
          </button>
          <button 
            class="control-button"
            @click=${this.collapseAllMessages}
            title="Collapse all messages"
          >
            📝 Collapse All
          </button>
        </div>
      </header>
    `;
  }

  private renderContent() {
    if (!this.session || this.session.entries.length === 0) {
      return html`
        <div class="viewer-content">
          <div class="empty-state">
            <div class="empty-state-icon">💬</div>
            <div class="empty-state-title">No messages in this session</div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="viewer-content">
        ${this.virtualScrolling && this.messageDisplays.length > 20 
          ? this.renderVirtualizedTimeline()
          : this.renderRegularTimeline()
        }
      </div>
    `;
  }

  private renderVirtualizedTimeline() {
    this.virtualScroll.setItems(this.messageDisplays, (msg, index) => `msg-${index}`);
    const virtualContent = this.virtualScroll.renderVirtualizedList(
      (virtualItem) => this.renderMessage(virtualItem.data, virtualItem.index)
    );

    return html`
      <div 
        class="timeline-container virtual"
        style="${virtualContent.containerStyle}"
        role="${AriaRoles.LOG}"
        aria-label="Message timeline (virtual scrolling enabled)"
        aria-describedby="${this.viewerId}-status"
      >
        ${virtualContent.beforeSpacer}
        <div 
          id="${this.timelineId}"
          class="message-timeline"
        >
          ${virtualContent.items}
        </div>
        ${virtualContent.afterSpacer}
      </div>
    `;
  }

  private renderRegularTimeline() {
    return html`
      <div 
        class="timeline-container"
        role="${AriaRoles.LOG}"
        aria-label="Message timeline"
        aria-describedby="${this.viewerId}-status"
      >
        <div 
          id="${this.timelineId}"
          class="message-timeline"
        >
          ${repeat(
            this.messageDisplays,
            (msg, index) => `msg-${index}`,
            (msg, index) => this.renderMessage(msg, index)
          )}
        </div>
      </div>
    `;
  }

  private renderMessage(messageDisplay: MessageDisplay, index: number) {
    const isExpanded = this.expandedMessages.has(index);
    const isSelected = this.selectedMessageIndex === index;
    const metadata = messageDisplay.metadata;
    const isBranchPoint = this.branchPoints.includes(index);
    const isThreadContinuation = this.isThreadContinuation(index);
    const hasExistingBranches = this.hasBranches(index);
    const branchCount = hasExistingBranches ? this.getBranchCount(index) : 0;

    // Determine message group classes for threading visualization
    const messageGroupClasses = {
      'message-group': true,
      'thread-continuation': isThreadContinuation && this.showConversationThreading,
      'branch-point': isBranchPoint && this.showBranches,
    };

    // Determine message item classes
    const messageItemClasses = {
      'message-item': true,
      [messageDisplay.entry.role]: true,
      'selected': isSelected,
      'branch-available': this.canCreateBranchFromMessage(index),
    };

    return html`
      <div 
        class="${classMap(messageGroupClasses)}"
        data-message-index="${index}"
        data-is-branch-point="${isBranchPoint}"
        data-thread-continuation="${isThreadContinuation}"
      >
        <article 
          class="${classMap(messageItemClasses)}"
          role="article"
          aria-label="Message ${index + 1} from ${messageDisplay.entry.role}${isBranchPoint ? ' (branch point)' : ''}"
        >
          ${isBranchPoint ? html`
            <div class="branch-point-marker" title="Branch point available">
              Branch
            </div>
          ` : ''}

          <div class="message-content ${classMap({ selected: isSelected })}">
            <header 
              class="message-header"
              @click=${() => this.toggleMessageExpansion(index)}
              role="button"
              tabindex="0"
              aria-expanded="${isExpanded}"
              aria-controls="message-body-${index}"
              @keydown=${(e: KeyboardEvent) => this.handleHeaderKeydown(e, index)}
            >
              <div class="message-info">
                <span class="message-role ${messageDisplay.entry.role}">
                  ${this.getRoleDisplayName(messageDisplay.entry.role)}
                </span>
                <span class="message-timestamp">
                  ${this.formatTimestamp(metadata.timestamp)}
                </span>
                ${this.renderEnhancedBadges(metadata, index, isBranchPoint, hasExistingBranches)}
              </div>

              <div class="message-actions">
                <button 
                  class="message-action"
                  @click=${(e: Event) => this.handleMessageAction(e, 'copy', index)}
                  title="Copy message content"
                  aria-label="Copy message content"
                >
                  📋
                </button>
                ${this.canCreateBranchFromMessage(index) ? html`
                  <button 
                    class="message-action"
                    @click=${(e: Event) => this.handleMessageAction(e, 'branch', index)}
                    title="Create branch from this message"
                    aria-label="Create branch from this message"
                  >
                    🌿
                  </button>
                ` : ''}
                ${hasExistingBranches ? html`
                  <button 
                    class="message-action"
                    @click=${(e: Event) => this.handleMessageAction(e, 'view-branches', index)}
                    title="View existing branches"
                    aria-label="View existing branches"
                  >
                    🌳
                  </button>
                ` : ''}
                <span class="expand-toggle ${classMap({ expanded: isExpanded })}">
                  ▼
                </span>
              </div>
            </header>

            <div 
              id="message-body-${index}"
              class="message-body ${classMap({ collapsed: !isExpanded })}"
              role="region"
              aria-label="Message content"
            >
              ${this.renderMessageContent(messageDisplay)}
              
              ${this.showBranches && hasExistingBranches ? html`
                ${this.renderBranchIndicator(index, branchCount)}
              ` : ''}

              ${isBranchPoint && this.canCreateBranchFromMessage(index) ? html`
                ${this.renderBranchPointIndicator(index)}
              ` : ''}
            </div>
          </div>
        </article>
      </div>
    `;
  }

  private renderMessageContent(messageDisplay: MessageDisplay) {
    return html`
      <message-display
        .entry=${messageDisplay.entry}
        .processedContent=${messageDisplay.processedContent}
        .metadata=${messageDisplay.metadata}
        .collapsible=${true}
        .showSyntaxHighlighting=${true}
        .showToolDetails=${true}
        @content-expanded=${this.handleContentExpanded}
        @tool-selected=${this.handleToolSelected}
      ></message-display>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="viewer-container">
        <div class="empty-state">
          <div class="empty-state-icon">📄</div>
          <div class="empty-state-title">No Session Selected</div>
          <div>Select a session from the list to view its messages and details.</div>
        </div>
      </div>
    `;
  }

  // Event handlers

  private handleHeaderKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleMessageExpansion(index);
    }
  }

  private handleMessageAction(event: Event, action: string, index: number) {
    event.stopPropagation();
    
    switch (action) {
      case 'copy':
        this.copyMessage(index);
        break;
      case 'branch':
        this.createBranch(index);
        break;
      case 'view-branches':
        this.viewBranches(index);
        break;
    }
  }

  private handleContentExpanded(event: CustomEvent) {
    // Handle nested content expansion
    this.emitEvent('content-expanded', event.detail);
  }

  private handleToolSelected(event: CustomEvent) {
    this.emitEvent('tool-selected', event.detail);
  }

  // Actions

  private toggleMessageExpansion(index: number) {
    if (this.expandedMessages.has(index)) {
      this.expandedMessages.delete(index);
    } else {
      this.expandedMessages.add(index);
    }
    this.requestUpdate();
    
    // Emit selection event
    this.selectedMessageIndex = index;
    this.emitEvent('message-selected', { 
      messageIndex: index,
      message: this.messageDisplays[index]
    });
  }

  private toggleThreading() {
    this.showThreading = !this.showThreading;
    this.processMessages();
  }

  private toggleBranches() {
    this.showBranches = !this.showBranches;
  }

  private toggleVirtualScrolling() {
    this.virtualScrolling = !this.virtualScrolling;
    this.updateVirtualScrolling();
  }

  private expandAllMessages() {
    for (let i = 0; i < this.messageDisplays.length; i++) {
      this.expandedMessages.add(i);
    }
    this.requestUpdate();
  }

  private collapseAllMessages() {
    this.expandedMessages.clear();
    this.requestUpdate();
  }

  private async copyMessage(index: number) {
    const message = this.messageDisplays[index];
    if (message) {
      try {
        const content = typeof message.entry.content === 'string' 
          ? message.entry.content 
          : JSON.stringify(message.entry.content, null, 2);
        await navigator.clipboard.writeText(content);
        // Show success feedback
      } catch (error) {
        console.error('Failed to copy message:', error);
      }
    }
  }

  private createBranch(index: number) {
    this.emitEvent('branch-requested', {
      sessionId: this.session?.sessionId,
      branchPoint: index,
      message: this.messageDisplays[index]
    });
  }

  private viewBranches(index: number) {
    this.emitEvent('branches-view-requested', {
      sessionId: this.session?.sessionId,
      messageIndex: index
    });
  }

  // Utility methods

  private processMessages() {
    if (!this.session) {
      this.messageDisplays = [];
      return;
    }

    // Convert transcript entries to MessageDisplay format
    this.messageDisplays = this.session.entries.map((entry, index) => ({
      entry,
      processedContent: this.processEntryContent(entry),
      metadata: this.extractMessageMetadata(entry, index),
    }));

    // Auto-detect potential branch points based on session branching data
    this.updateBranchPoints();
  }

  /**
   * Update branch points based on session data and message analysis
   */
  private updateBranchPoints() {
    const potentialBranchPoints: number[] = [];

    // If we have branch data from Task 13, use it
    if (this.branchData?.branchPoint !== undefined) {
      potentialBranchPoints.push(this.branchData.branchPoint);
    }

    // Auto-detect other potential branch points
    this.messageDisplays.forEach((messageDisplay, index) => {
      // Assistant messages are good branch points
      if (messageDisplay.entry.role === 'assistant') {
        potentialBranchPoints.push(index);
      }
      
      // Messages with tool results can also be branch points
      if (messageDisplay.metadata.hasToolUse && 
          index < this.messageDisplays.length - 1) {
        potentialBranchPoints.push(index);
      }
    });

    // Remove duplicates and sort
    this.branchPoints = [...new Set(potentialBranchPoints)].sort((a, b) => a - b);
  }

  private processEntryContent(entry: any): ProcessedContent[] {
    // Process entry content into displayable format
    const content: ProcessedContent[] = [];
    
    if (typeof entry.content === 'string') {
      content.push({
        type: 'text',
        content: entry.content,
      });
    } else if (Array.isArray(entry.content)) {
      entry.content.forEach((item: any) => {
        if (item.type === 'text') {
          content.push({
            type: 'text',
            content: item.text || item.content,
          });
        } else if (item.type === 'tool_use') {
          content.push({
            type: 'tool_use',
            content: item,
            collapsible: true,
          });
        } else if (item.type === 'tool_result') {
          content.push({
            type: 'tool_result',
            content: item,
            collapsible: true,
          });
        }
      });
    }

    return content;
  }

  private extractMessageMetadata(entry: any, index: number): MessageMetadata {
    const hasToolUse = Array.isArray(entry.content) && 
      entry.content.some((item: any) => item.type === 'tool_use');
    const hasThinking = entry.thinking && entry.thinking.length > 0;
    const hasErrors = entry.role === 'error' || 
      (Array.isArray(entry.content) && entry.content.some((item: any) => item.type === 'error'));

    return {
      timestamp: new Date(entry.timestamp || Date.now()),
      index,
      hasToolUse,
      hasThinking,
      hasErrors,
      tokenCount: entry.tokenCount,
      processingDuration: entry.duration,
    };
  }

  private hasBranches(index: number): boolean {
    // Check if this message has branches (implementation would depend on branch data structure)
    // For now, simulate some messages having branches
    return this.branchPoints.includes(index) && Math.random() > 0.7;
  }

  private getBranchCount(index: number): number {
    // Get branch count for this message (implementation would depend on branch data structure)
    // For now, simulate random branch counts
    if (this.hasBranches(index)) {
      return Math.floor(Math.random() * 3) + 1;
    }
    return 0;
  }

  // New enhanced helper methods for Task 26.2

  /**
   * Determine if a message is part of a conversation thread continuation
   */
  private isThreadContinuation(index: number): boolean {
    if (!this.showConversationThreading || index === 0) return false;
    
    const currentMessage = this.messageDisplays[index];
    const previousMessage = this.messageDisplays[index - 1];
    
    if (!currentMessage || !previousMessage) return false;
    
    // Consider it a thread continuation if:
    // 1. Both messages are from the same role type
    // 2. Or if it's a user->assistant->user pattern (common conversation flow)
    // 3. Or if there's tool use followed by assistant response
    const currentRole = currentMessage.entry.role;
    const prevRole = previousMessage.entry.role;
    
    return (
      currentRole === prevRole ||
      (prevRole === 'user' && currentRole === 'assistant') ||
      (prevRole === 'assistant' && currentRole === 'user') ||
      (prevRole === 'tool_result' && currentRole === 'assistant')
    );
  }

  /**
   * Check if a branch can be created from this message
   */
  private canCreateBranchFromMessage(index: number): boolean {
    const message = this.messageDisplays[index];
    if (!message) return false;
    
    // Typically allow branching from assistant messages or after tool results
    return message.entry.role === 'assistant' || message.entry.role === 'tool_result';
  }

  /**
   * Get display name for message role with appropriate capitalization and icons
   */
  private getRoleDisplayName(role: string): string {
    const roleMap: Record<string, string> = {
      'user': '👤 User',
      'assistant': '🤖 Assistant', 
      'system': '⚙️ System',
      'tool_use': '🛠️ Tool',
      'tool_result': '📊 Result',
      'error': '❌ Error'
    };
    
    return roleMap[role] || role.charAt(0).toUpperCase() + role.slice(1);
  }

  /**
   * Render enhanced badges with icons and improved styling
   */
  private renderEnhancedBadges(
    metadata: MessageMetadata, 
    index: number, 
    isBranchPoint: boolean, 
    hasExistingBranches: boolean
  ) {
    const badges: any[] = [];

    if (metadata.hasToolUse) {
      badges.push(html`
        <div class="message-badge tool-use" title="Contains tool usage">
          Tools
        </div>
      `);
    }

    if (metadata.hasThinking) {
      badges.push(html`
        <div class="message-badge thinking" title="Contains reasoning/thinking">
          Thinking
        </div>
      `);
    }

    if (metadata.hasErrors) {
      badges.push(html`
        <div class="message-badge error" title="Contains errors">
          Error
        </div>
      `);
    }

    if (metadata.tokenCount) {
      badges.push(html`
        <div class="message-badge tokens" title="${metadata.tokenCount} tokens used">
          ${this.formatNumber(metadata.tokenCount)}
        </div>
      `);
    }

    if (hasExistingBranches) {
      badges.push(html`
        <div 
          class="message-badge branch-available" 
          title="Has ${this.getBranchCount(index)} existing branch(es)"
          @click=${(e: Event) => this.handleBadgeAction(e, 'view-branches', index)}
        >
          ${this.getBranchCount(index)} Branch${this.getBranchCount(index) !== 1 ? 'es' : ''}
        </div>
      `);
    } else if (this.canCreateBranchFromMessage(index)) {
      badges.push(html`
        <div 
          class="message-badge branch-available" 
          title="Can create branch from this message"
          @click=${(e: Event) => this.handleBadgeAction(e, 'branch', index)}
        >
          Branch Available
        </div>
      `);
    }

    if (metadata.processingDuration) {
      badges.push(html`
        <div class="message-badge" title="Processing time: ${metadata.processingDuration}ms">
          ⏱️ ${Math.round(metadata.processingDuration)}ms
        </div>
      `);
    }

    return html`<div class="message-badges">${badges}</div>`;
  }

  /**
   * Render enhanced branch indicator with detailed information
   */
  private renderBranchIndicator(index: number, branchCount: number) {
    return html`
      <div class="branch-indicator">
        <div class="branch-indicator-content">
          <div class="branch-icon">🌳</div>
          <div class="branch-info">
            <div class="branch-title">
              ${branchCount} Existing Branch${branchCount !== 1 ? 'es' : ''}
            </div>
            <div class="branch-description">
              This message has alternative conversation paths available
            </div>
          </div>
          <div class="branch-actions">
            <button 
              class="branch-button"
              @click=${() => this.viewBranches(index)}
              title="View all branches from this point"
            >
              View All
            </button>
            <button 
              class="branch-button primary"
              @click=${() => this.createBranch(index)}
              title="Create a new branch from this message"
            >
              New Branch
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render branch point indicator for potential branching
   */
  private renderBranchPointIndicator(index: number) {
    return html`
      <div class="branch-indicator">
        <div class="branch-indicator-content">
          <div class="branch-icon">🌿</div>
          <div class="branch-info">
            <div class="branch-title">Branch Point Available</div>
            <div class="branch-description">
              Create an alternative conversation path from this message
            </div>
          </div>
          <div class="branch-actions">
            <button 
              class="branch-button primary"
              @click=${() => this.createBranch(index)}
              title="Create branch from this message"
            >
              Create Branch
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Handle badge click actions
   */
  private handleBadgeAction(event: Event, action: string, index: number) {
    event.stopPropagation();
    this.handleMessageAction(event, action, index);
  }

  private formatTimestamp(timestamp: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(timestamp);
  }

  private formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(num);
  }

  private updateVirtualScrolling() {
    if (this.virtualScrolling) {
      this.updateComplete.then(() => {
        const container = this.timelineContainer;
        if (container) {
          this.virtualScroll.setScrollContainer(container);
          this.virtualScroll.updateConfig({
            itemHeight: 200,
            containerHeight: container.clientHeight || 600
          });
        }
      });
    }
  }

  protected updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);

    if (changedProperties.has('session')) {
      this.processMessages();
      this.expandedMessages.clear();
      this.selectedMessageIndex = null;
    }

    if (changedProperties.has('virtualScrolling') || changedProperties.has('messageDisplays')) {
      this.updateVirtualScrolling();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.processMessages();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-viewer': SessionViewer;
  }
}