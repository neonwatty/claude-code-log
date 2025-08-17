import { html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/base-component.js';
import type { ZodSession, ZodTranscriptEntry, ZodContentItem } from '../../../../shared/src/schemas/index.js';

export interface MessageTypeIcons {
  user: string;
  assistant: string;
  system: string;
  tool_use: string;
  tool_result: string;
  thinking: string;
  image: string;
  sidechain: string;
}

export interface SessionDetailState {
  expandedMessages: Set<string>;
  filteredMessageTypes: Set<string>;
  showTimeline: boolean;
}

@customElement('session-detail')
export class SessionDetail extends BaseComponent {
  @property({ type: Object })
  session: ZodSession | null = null;

  @property({ type: Boolean, attribute: 'show-header' })
  showHeader = true;

  @property({ type: Boolean, attribute: 'enable-filtering' })
  enableFiltering = true;

  @property({ type: Boolean, attribute: 'virtual-scrolling' })
  virtualScrolling = false;

  @state()
  private detailState: SessionDetailState = {
    expandedMessages: new Set(),
    filteredMessageTypes: new Set(['user', 'assistant', 'system', 'tool_use', 'tool_result', 'thinking', 'image', 'sidechain']),
    showTimeline: false,
  };

  @state()
  private scrollContainer: HTMLElement | null = null;

  private readonly messageTypeIcons: MessageTypeIcons = {
    user: '🤷',
    assistant: '🤖',
    system: '⚙️',
    tool_use: '🛠️',
    tool_result: '🧰',
    thinking: '💭',
    image: '🖼️',
    sidechain: '🔗',
  };

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        font-family: var(--font-family-mono);
        height: 100%;
      }

      .session-detail-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--color-background);
      }

      .session-header {
        background-color: var(--color-surface);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
        box-shadow: -7px -7px 10px var(--color-shadow-light), 7px 7px 10px var(--color-shadow-dark);
        border-left: var(--color-border-light) 1px solid;
        border-top: var(--color-border-light) 1px solid;
        border-bottom: var(--color-border-dark) 1px solid;
        border-right: var(--color-border-dark) 1px solid;
      }

      .session-header-title {
        font-size: 1.2em;
        margin-bottom: var(--spacing-sm);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
      }

      .session-metadata {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--spacing-sm);
        font-size: 0.9em;
        color: var(--color-text-muted);
      }

      .metadata-item {
        display: flex;
        justify-content: space-between;
      }

      .metadata-label {
        font-weight: 600;
      }

      .filter-toolbar {
        background-color: var(--color-surface);
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-sm);
        margin-bottom: var(--spacing-md);
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
        align-items: center;
      }

      .filter-toggle {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        background-color: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
        font-size: 0.8em;
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .filter-toggle.active {
        background-color: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .filter-toggle:hover {
        background-color: var(--color-surface-hover);
      }

      .filter-toggle.active:hover {
        background-color: var(--color-primary);
        opacity: 0.9;
      }

      .message-container {
        flex: 1;
        overflow-y: auto;
        padding: var(--spacing-sm);
        scrollbar-width: thin;
        scrollbar-color: var(--color-border-dark) transparent;
      }

      .message-container::-webkit-scrollbar {
        width: 8px;
      }

      .message-container::-webkit-scrollbar-track {
        background: transparent;
      }

      .message-container::-webkit-scrollbar-thumb {
        background-color: var(--color-border-dark);
        border-radius: 4px;
      }

      .message {
        margin-bottom: 1em;
        padding: 1em;
        border-radius: var(--border-radius-md);
        border-left: var(--color-border-light) 1px solid;
        background-color: var(--color-surface);
        box-shadow: -7px -7px 10px var(--color-shadow-light), 7px 7px 10px var(--color-shadow-dark);
        border-top: var(--color-border-light) 1px solid;
        border-bottom: var(--color-border-dark) 1px solid;
        border-right: var(--color-border-dark) 1px solid;
        transition: all var(--transition-fast);
      }

      .message.filtered-hidden {
        display: none;
      }

      .message.user {
        border-left-color: var(--color-primary);
      }

      .message.assistant {
        border-left-color: var(--color-secondary);
      }

      .message.system {
        border-left-color: var(--color-warning);
      }

      .message.tool_use {
        border-left-color: var(--color-tool-use);
      }

      .message.tool_result {
        border-left-color: var(--color-tool-result);
      }

      .message.thinking {
        border-left-color: var(--color-thinking);
      }

      .message.image {
        border-left-color: var(--color-image);
      }

      .message.sidechain {
        opacity: 0.85;
        background-color: var(--color-surface-hover);
        border-left-width: 2px;
        border-left-style: dashed;
      }

      .message-header {
        font-weight: 600;
        margin-bottom: var(--spacing-sm);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
      }

      .message-type {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .message-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        font-size: 0.8em;
        color: var(--color-text-muted);
      }

      .message-content {
        word-wrap: break-word;
        line-height: var(--line-height);
      }

      .message-content pre {
        background-color: var(--color-surface-hover);
        padding: var(--spacing-sm);
        border-radius: var(--border-radius-sm);
        overflow-x: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
        word-break: break-word;
      }

      .tool-content {
        background-color: var(--color-surface-hover);
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-sm);
        margin: var(--spacing-sm) 0;
        overflow-x: auto;
      }

      .tool-input {
        background-color: var(--color-surface-active);
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-xs);
        margin: var(--spacing-xs) 0;
        font-size: 0.9em;
      }

      .thinking-content {
        background-color: var(--color-surface-hover);
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-sm);
        font-style: italic;
        color: var(--color-text-light);
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .session-divider {
        margin: 70px 0;
        border-top: 2px solid var(--color-border-light);
        position: relative;
      }

      .session-divider::after {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        right: 0;
        border-top: 1px solid var(--color-border-dark);
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-xl);
        color: var(--color-text-muted);
        font-style: italic;
        text-align: center;
      }

      .empty-state-icon {
        font-size: 2em;
        margin-bottom: var(--spacing-md);
      }

      .token-usage {
        font-size: 0.75em;
        color: var(--color-text-muted);
      }

      .sidechain-indicator {
        color: var(--color-text-muted);
        font-size: 0.9em;
        margin-bottom: 5px;
        padding: 2px 6px;
        background-color: var(--color-surface-active);
        border-radius: var(--border-radius-sm);
        display: inline-block;
      }

      @media (max-width: 768px) {
        .session-metadata {
          grid-template-columns: 1fr;
        }
        
        .filter-toolbar {
          flex-direction: column;
          align-items: stretch;
        }
        
        .message-header {
          flex-direction: column;
          align-items: stretch;
        }
        
        .message-meta {
          align-items: flex-start;
        }
      }
    `
  ];

  protected override firstUpdated(): void {
    this.scrollContainer = this.shadowRoot?.querySelector('.message-container') as HTMLElement;
  }

  private getMessageType(entry: ZodTranscriptEntry): string {
    if (entry.type === 'summary') return 'summary';
    if (entry.type === 'system') return 'system';
    if (entry.type === 'user') return 'user';
    if (entry.type === 'assistant') return 'assistant';
    return 'unknown';
  }

  private getContentType(content: ZodContentItem): string {
    return content.type;
  }

  private formatDuration(): string {
    if (!this.session) return '';
    
    const start = new Date(this.session.firstTimestamp);
    const end = new Date(this.session.lastTimestamp);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      const remainingMins = diffMins % 60;
      return `${diffHours}h ${remainingMins}m`;
    }
    return `${diffMins}m`;
  }

  private formatTokenUsage(): string {
    if (!this.session) return '';
    
    const { input_tokens = 0, output_tokens = 0, cache_creation_input_tokens = 0, cache_read_input_tokens = 0 } = this.session.totalUsage;
    const parts = [];
    
    if (input_tokens > 0) parts.push(`Input: ${this.formatTokenCount(input_tokens)}`);
    if (output_tokens > 0) parts.push(`Output: ${this.formatTokenCount(output_tokens)}`);
    if (cache_creation_input_tokens > 0) parts.push(`Cache Creation: ${this.formatTokenCount(cache_creation_input_tokens)}`);
    if (cache_read_input_tokens > 0) parts.push(`Cache Read: ${this.formatTokenCount(cache_read_input_tokens)}`);
    
    return parts.join(' | ');
  }

  private handleFilterToggle(messageType: string): void {
    const newFiltered = new Set(this.detailState.filteredMessageTypes);
    if (newFiltered.has(messageType)) {
      newFiltered.delete(messageType);
    } else {
      newFiltered.add(messageType);
    }
    
    this.detailState = {
      ...this.detailState,
      filteredMessageTypes: newFiltered
    };
  }

  private shouldShowMessage(entry: ZodTranscriptEntry): boolean {
    const messageType = this.getMessageType(entry);
    return this.detailState.filteredMessageTypes.has(messageType);
  }

  private renderContentItem(content: ZodContentItem): TemplateResult {
    switch (content.type) {
      case 'text':
        return html`<div class="text-content">${content.text}</div>`;
      
      case 'tool_use':
        return html`
          <div class="tool-content tool-use">
            <div class="tool-header">🛠️ ${content.name}</div>
            <div class="tool-input">
              <pre>${JSON.stringify(content.input, null, 2)}</pre>
            </div>
          </div>
        `;
      
      case 'tool_result':
        return html`
          <div class="tool-content tool-result">
            <div class="tool-header">🧰 Tool Result ${content.is_error ? '(Error)' : ''}</div>
            <pre>${typeof content.content === 'string' ? content.content : JSON.stringify(content.content, null, 2)}</pre>
          </div>
        `;
      
      case 'thinking':
        return html`
          <div class="thinking-content">
            <div>💭 Thinking</div>
            <div class="thinking-text">${content.thinking}</div>
          </div>
        `;
      
      case 'image':
        return html`
          <div class="image-content">
            <div>🖼️ Image (${content.source.media_type})</div>
            <img src="data:${content.source.media_type};base64,${content.source.data}" 
                 alt="Content image" 
                 style="max-width: 100%; height: auto; border-radius: var(--border-radius-sm);" />
          </div>
        `;
      
      default:
        return html`<div class="unknown-content">Unknown content type</div>`;
    }
  }

  private renderMessage(entry: ZodTranscriptEntry): TemplateResult {
    const messageType = this.getMessageType(entry);
    const isVisible = this.shouldShowMessage(entry);
    const icon = this.messageTypeIcons[messageType as keyof MessageTypeIcons] || '❓';
    
    if (entry.type === 'summary') {
      return html`
        <div class="message summary ${isVisible ? '' : 'filtered-hidden'}">
          <div class="message-header">
            <div class="message-type">📋 Summary</div>
          </div>
          <div class="message-content session-summary">
            ${entry.summary}
          </div>
        </div>
      `;
    }

    if (entry.type === 'system') {
      return html`
        <div class="message system ${isVisible ? '' : 'filtered-hidden'}">
          <div class="message-header">
            <div class="message-type">${icon} System</div>
            <div class="message-meta">
              <span class="timestamp">${this.formatTimestamp(entry.timestamp)}</span>
            </div>
          </div>
          <div class="message-content">
            ${entry.content}
          </div>
        </div>
      `;
    }

    if (entry.type === 'user') {
      const tokenUsage = entry.message.content?.length ? '' : ''; // User messages typically don't have token usage
      
      return html`
        <div class="message user ${entry.isSidechain ? 'sidechain' : ''} ${isVisible ? '' : 'filtered-hidden'}">
          ${entry.isSidechain ? html`<div class="sidechain-indicator">🔗 Sub-conversation</div>` : ''}
          <div class="message-header">
            <div class="message-type">${icon} User</div>
            <div class="message-meta">
              <span class="timestamp">${this.formatTimestamp(entry.timestamp)}</span>
            </div>
          </div>
          <div class="message-content">
            ${entry.message.content?.map(content => this.renderContentItem(content))}
          </div>
        </div>
      `;
    }

    if (entry.type === 'assistant') {
      const usage = entry.message.usage;
      const tokenUsage = usage ? this.formatAssistantTokenUsage(usage) : '';
      
      return html`
        <div class="message assistant ${entry.isSidechain ? 'sidechain' : ''} ${isVisible ? '' : 'filtered-hidden'}">
          ${entry.isSidechain ? html`<div class="sidechain-indicator">🔗 Sub-conversation</div>` : ''}
          <div class="message-header">
            <div class="message-type">${icon} Assistant</div>
            <div class="message-meta">
              <span class="timestamp">${this.formatTimestamp(entry.timestamp)}</span>
              ${tokenUsage ? html`<span class="token-usage">${tokenUsage}</span>` : ''}
            </div>
          </div>
          <div class="message-content">
            ${entry.message.content?.map(content => this.renderContentItem(content))}
          </div>
        </div>
      `;
    }

    return html`<div class="message unknown">Unknown message type</div>`;
  }

  private formatAssistantTokenUsage(usage: any): string {
    const parts = [];
    if (usage.input_tokens) parts.push(`In: ${this.formatTokenCount(usage.input_tokens)}`);
    if (usage.output_tokens) parts.push(`Out: ${this.formatTokenCount(usage.output_tokens)}`);
    if (usage.cache_creation_input_tokens) parts.push(`Cache+: ${this.formatTokenCount(usage.cache_creation_input_tokens)}`);
    if (usage.cache_read_input_tokens) parts.push(`Cache: ${this.formatTokenCount(usage.cache_read_input_tokens)}`);
    return parts.join(' | ');
  }

  private renderFilterToolbar(): TemplateResult {
    if (!this.enableFiltering) return html``;

    const messageTypes = [
      { key: 'user', label: 'User', icon: '🤷' },
      { key: 'assistant', label: 'Assistant', icon: '🤖' },
      { key: 'system', label: 'System', icon: '⚙️' },
      { key: 'tool_use', label: 'Tool Use', icon: '🛠️' },
      { key: 'tool_result', label: 'Tool Results', icon: '🧰' },
      { key: 'thinking', label: 'Thinking', icon: '💭' },
      { key: 'image', label: 'Images', icon: '🖼️' },
      { key: 'sidechain', label: 'Sub-assistant', icon: '🔗' },
    ];

    return html`
      <div class="filter-toolbar">
        <span style="font-weight: 600; margin-right: var(--spacing-sm);">Filter:</span>
        ${messageTypes.map(type => html`
          <button 
            class="filter-toggle ${this.detailState.filteredMessageTypes.has(type.key) ? 'active' : ''}"
            @click=${() => this.handleFilterToggle(type.key)}
          >
            <span>${type.icon}</span>
            <span>${type.label}</span>
          </button>
        `)}
      </div>
    `;
  }

  private renderSessionHeader(): TemplateResult {
    if (!this.showHeader || !this.session) return html``;

    const messageCount = this.session.entries.length;
    const duration = this.formatDuration();
    const tokenUsage = this.formatTokenUsage();
    const timeRange = `${this.formatTimestamp(this.session.firstTimestamp)} - ${this.formatTimestamp(this.session.lastTimestamp)}`;

    return html`
      <div class="session-header">
        <div class="session-header-title">
          <span>Session: ${this.session.summary || this.session.id.slice(0, 8)}</span>
          <span style="font-size: 0.8em; color: var(--color-text-muted);">${this.session.id}</span>
        </div>
        <div class="session-metadata">
          <div class="metadata-item">
            <span class="metadata-label">Messages:</span>
            <span>${messageCount}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Duration:</span>
            <span>${duration}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Time Range:</span>
            <span>${timeRange}</span>
          </div>
          ${tokenUsage ? html`
            <div class="metadata-item">
              <span class="metadata-label">Token Usage:</span>
              <span>${tokenUsage}</span>
            </div>
          ` : ''}
          <div class="metadata-item">
            <span class="metadata-label">Working Directory:</span>
            <span>${this.session.cwd}</span>
          </div>
        </div>
      </div>
    `;
  }

  protected override render(): TemplateResult {
    if (!this.session) {
      return html`
        <div class="session-detail-container">
          <div class="empty-state">
            <div class="empty-state-icon">📂</div>
            <div>No session selected</div>
            <div style="font-size: 0.9em; margin-top: var(--spacing-sm);">
              Select a session from the list to view its details
            </div>
          </div>
        </div>
      `;
    }

    const sortedEntries = [...this.session.entries].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return html`
      <div class="session-detail-container">
        ${this.renderSessionHeader()}
        ${this.renderFilterToolbar()}
        
        <div class="message-container">
          ${sortedEntries.length > 0 
            ? sortedEntries.map(entry => this.renderMessage(entry))
            : html`
              <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <div>No messages in this session</div>
              </div>
            `
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-detail': SessionDetail;
  }
}