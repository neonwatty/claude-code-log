import { html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { 
  MessageDisplay as MessageDisplayType,
  ProcessedContent,
  MessageMetadata,
  DisplayMode 
} from '../types/session-types';
import { 
  TranscriptEntry,
  ContentItem,
  TextContent,
  ToolUseContent,
  ToolResultContent,
  ThinkingContent,
  ImageContent,
  AssistantMessage,
  UserMessage
} from '@app/shared';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
// Import common languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import cssLang from 'highlight.js/lib/languages/css';
import htmlLang from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';

// Register languages for syntax highlighting
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', cssLang);
hljs.registerLanguage('html', htmlLang);
hljs.registerLanguage('xml', htmlLang);
hljs.registerLanguage('markdown', markdown);

/**
 * Component for displaying individual messages with proper formatting,
 * syntax highlighting, and markdown rendering
 */
@customElement('message-display')
export class MessageDisplay extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        margin: var(--space-md) 0;
      }

      .message-container {
        border-radius: var(--border-radius);
        border: 1px solid var(--color-border-light);
        overflow: hidden;
        background: var(--color-background);
        transition: box-shadow var(--transition-fast);
      }

      .message-container:hover {
        box-shadow: var(--shadow-sm);
      }

      .message-container.user {
        border-left: 4px solid var(--color-user);
      }

      .message-container.assistant {
        border-left: 4px solid var(--color-assistant);
      }

      .message-container.system {
        border-left: 4px solid var(--color-system);
      }

      .message-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-sm) var(--space-md);
        background: var(--color-background-secondary);
        border-bottom: 1px solid var(--color-border-light);
      }

      .message-info {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .message-role {
        font-weight: var(--font-weight-semibold);
        font-size: var(--font-size-sm);
        text-transform: capitalize;
        color: var(--color-text-primary);
      }

      .message-role.user {
        color: var(--color-user);
      }

      .message-role.assistant {
        color: var(--color-assistant);
      }

      .message-role.system {
        color: var(--color-system);
      }

      .message-timestamp {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
      }

      .message-badges {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .badge {
        font-size: var(--font-size-xs);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius-full);
        font-weight: var(--font-weight-medium);
      }

      .badge.tools {
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
      }

      .badge.thinking {
        background: var(--color-info-light);
        color: var(--color-info-dark);
      }

      .badge.error {
        background: var(--color-error-light);
        color: var(--color-error-dark);
      }

      .badge.tokens {
        background: var(--color-background-tertiary);
        color: var(--color-text-secondary);
      }

      .message-meta {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .collapse-toggle {
        background: none;
        border: none;
        cursor: pointer;
        padding: var(--space-xs);
        border-radius: var(--border-radius);
        color: var(--color-text-muted);
        transition: all var(--transition-fast);
      }

      .collapse-toggle:hover {
        background: var(--color-background-tertiary);
        color: var(--color-text-primary);
      }

      .collapse-toggle.collapsed {
        transform: rotate(-90deg);
      }

      .message-content {
        padding: var(--space-md);
      }

      .message-content.collapsed {
        display: none;
      }

      .content-item {
        margin-bottom: var(--space-md);
      }

      .content-item:last-child {
        margin-bottom: 0;
      }

      .text-content {
        line-height: 1.6;
        color: var(--color-text-primary);
      }

      .text-content pre {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        overflow-x: auto;
        margin: var(--space-sm) 0;
        font-family: var(--font-mono);
        font-size: var(--font-size-sm);
        line-height: 1.4;
      }

      .text-content code {
        background: var(--color-background-secondary);
        padding: var(--space-xs);
        border-radius: var(--border-radius-sm);
        font-family: var(--font-mono);
        font-size: var(--font-size-sm);
      }

      .text-content pre code {
        background: none;
        padding: 0;
        font-size: inherit;
      }

      /* Syntax highlighting styles */
      .hljs-comment,
      .hljs-quote {
        color: var(--color-text-muted);
        font-style: italic;
      }

      .hljs-keyword,
      .hljs-selector-tag,
      .hljs-literal,
      .hljs-type {
        color: var(--color-primary);
        font-weight: var(--font-weight-medium);
      }

      .hljs-string,
      .hljs-doctag {
        color: var(--color-success);
      }

      .hljs-title,
      .hljs-section,
      .hljs-selector-id {
        color: var(--color-warning);
        font-weight: var(--font-weight-medium);
      }

      .hljs-subst,
      .hljs-tag,
      .hljs-name,
      .hljs-attribute {
        color: var(--color-info);
      }

      .hljs-variable,
      .hljs-params {
        color: var(--color-text-primary);
      }

      .hljs-number,
      .hljs-built_in,
      .hljs-builtin-name {
        color: var(--color-error);
      }

      .hljs-meta,
      .hljs-meta-keyword {
        color: var(--color-text-secondary);
        font-weight: var(--font-weight-medium);
      }

      .tool-use-content {
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .tool-header {
        background: var(--color-background-secondary);
        padding: var(--space-sm) var(--space-md);
        border-bottom: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .tool-name {
        font-family: var(--font-mono);
        font-weight: var(--font-weight-semibold);
        color: var(--color-primary);
      }

      .tool-status {
        font-size: var(--font-size-xs);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius-full);
        font-weight: var(--font-weight-medium);
      }

      .tool-status.pending {
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
      }

      .tool-status.success {
        background: var(--color-success-light);
        color: var(--color-success-dark);
      }

      .tool-status.error {
        background: var(--color-error-light);
        color: var(--color-error-dark);
      }

      .tool-params {
        padding: var(--space-md);
        background: var(--color-background-tertiary);
        font-family: var(--font-mono);
        font-size: var(--font-size-sm);
        overflow-x: auto;
      }

      .tool-result {
        padding: var(--space-md);
        border-top: 1px solid var(--color-border);
      }

      .thinking-content {
        background: var(--color-info-light);
        border: 1px solid var(--color-info);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        font-style: italic;
        color: var(--color-info-dark);
      }

      .thinking-header {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-bottom: var(--space-sm);
        font-weight: var(--font-weight-semibold);
      }

      .image-content {
        text-align: center;
        margin: var(--space-md) 0;
      }

      .image-content img {
        max-width: 100%;
        height: auto;
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-sm);
      }

      .error-content {
        background: var(--color-error-light);
        border: 1px solid var(--color-error);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        color: var(--color-error-dark);
      }

      .collapsible-section {
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .section-header {
        background: var(--color-background-secondary);
        padding: var(--space-sm) var(--space-md);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: between;
        gap: var(--space-sm);
        user-select: none;
        transition: background var(--transition-fast);
      }

      .section-header:hover {
        background: var(--color-background-tertiary);
      }

      .section-title {
        font-weight: var(--font-weight-semibold);
        flex-grow: 1;
      }

      .section-content {
        padding: var(--space-md);
        border-top: 1px solid var(--color-border);
      }

      .section-content.collapsed {
        display: none;
      }

      .compact .message-header {
        padding: var(--space-xs) var(--space-sm);
      }

      .compact .message-content {
        padding: var(--space-sm);
      }

      .compact .badge {
        display: none;
      }

      @media (max-width: 768px) {
        .message-header {
          flex-direction: column;
          align-items: stretch;
          gap: var(--space-sm);
        }

        .message-info {
          justify-content: space-between;
        }

        .message-badges {
          justify-content: flex-start;
        }
      }
    `,
  ];

  /**
   * The transcript entry to display
   */
  @property({ type: Object })
  entry?: TranscriptEntry;

  /**
   * Display mode for the message
   */
  @property({ type: String })
  displayMode: DisplayMode = 'detailed';

  /**
   * Whether the message is selected
   */
  @property({ type: Boolean })
  selected = false;

  /**
   * Whether the message content is collapsed
   */
  @property({ type: Boolean })
  collapsed = false;

  /**
   * Message index in session
   */
  @property({ type: Number })
  messageIndex = 0;

  @state()
  private processedContent: ProcessedContent[] = [];

  @state()
  private metadata: MessageMetadata | null = null;

  @state()
  private collapsedSections = new Set<string>();

  protected updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('entry') && this.entry) {
      this.processMessage();
    }
  }

  render() {
    if (!this.entry || !this.metadata) {
      return html`<div class="message-container">Loading...</div>`;
    }

    const containerClasses = {
      'message-container': true,
      [this.entry.type]: true,
      'compact': this.displayMode === 'compact',
      'selected': this.selected,
    };

    return html`
      <div class="${classMap(containerClasses)}">
        ${this.renderHeader()}
        ${this.renderContent()}
      </div>
    `;
  }

  private renderHeader() {
    if (!this.metadata) return '';

    return html`
      <div class="message-header">
        <div class="message-info">
          <div class="message-role ${this.entry?.type}">
            ${this.entry?.type}
          </div>
          <div class="message-timestamp">
            ${this.formatTimestamp(this.metadata.timestamp)}
          </div>
        </div>
        <div class="message-meta">
          ${this.renderBadges()}
          ${this.processedContent.length > 1 ? html`
            <button 
              class="collapse-toggle ${this.collapsed ? 'collapsed' : ''}"
              @click=${this.toggleCollapse}
              title="${this.collapsed ? 'Expand' : 'Collapse'} message"
            >
              ▼
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderBadges() {
    if (!this.metadata) return '';

    const badges = [];

    if (this.metadata.hasToolUse) {
      badges.push(html`<div class="badge tools">Tools</div>`);
    }

    if (this.metadata.hasThinking) {
      badges.push(html`<div class="badge thinking">Thinking</div>`);
    }

    if (this.metadata.hasErrors) {
      badges.push(html`<div class="badge error">Error</div>`);
    }

    if (this.metadata.tokenCount) {
      badges.push(html`<div class="badge tokens">${this.metadata.tokenCount} tokens</div>`);
    }

    return badges;
  }

  private renderContent() {
    const contentClasses = {
      'message-content': true,
      'collapsed': this.collapsed,
    };

    return html`
      <div class="${classMap(contentClasses)}">
        ${this.processedContent.map((content, index) => this.renderContentItem(content, index))}
      </div>
    `;
  }

  private renderContentItem(content: ProcessedContent, index: number) {
    const sectionId = `section-${index}`;
    const isCollapsed = this.collapsedSections.has(sectionId);

    if (content.collapsible) {
      return html`
        <div class="content-item collapsible-section">
          <div 
            class="section-header"
            @click=${() => this.toggleSection(sectionId)}
          >
            <div class="section-title">${this.getContentTitle(content)}</div>
            <div class="collapse-toggle ${isCollapsed ? 'collapsed' : ''}">▼</div>
          </div>
          <div class="section-content ${isCollapsed ? 'collapsed' : ''}">
            ${this.renderContentByType(content)}
          </div>
        </div>
      `;
    }

    return html`
      <div class="content-item">
        ${this.renderContentByType(content)}
      </div>
    `;
  }

  private renderContentByType(content: ProcessedContent) {
    switch (content.type) {
      case 'text':
        return this.renderTextContent(content);
      case 'code':
        return this.renderCodeContent(content);
      case 'tool_use':
        return this.renderToolUseContent(content);
      case 'tool_result':
        return this.renderToolResultContent(content);
      case 'thinking':
        return this.renderThinkingContent(content);
      case 'image':
        return this.renderImageContent(content);
      case 'error':
        return this.renderErrorContent(content);
      default:
        return html`<div>Unknown content type: ${content.type}</div>`;
    }
  }

  private renderTextContent(content: ProcessedContent) {
    return html`
      <div class="text-content">
        ${unsafeHTML(this.processTextForDisplay(content.content as string))}
      </div>
    `;
  }

  private renderCodeContent(content: ProcessedContent) {
    const code = content.content as string;
    const language = content.language || '';
    
    return html`
      <syntax-highlighter
        .code=${code}
        .language=${language}
        .lineNumbers=${true}
        .copyable=${true}
        .compact=${false}
        theme="auto"
      ></syntax-highlighter>
    `;
  }

  private renderToolUseContent(content: ProcessedContent) {
    const toolUse = content.content as ToolUseContent;
    
    return html`
      <div class="tool-use-content">
        <div class="tool-header">
          <div class="tool-name">${toolUse.name}</div>
          <div class="tool-status pending">Executing</div>
        </div>
        <div class="tool-params">
          ${JSON.stringify(toolUse.input, null, 2)}
        </div>
      </div>
    `;
  }

  private renderToolResultContent(content: ProcessedContent) {
    const toolResult = content.content as ToolResultContent;
    const resultText = typeof toolResult.content === 'string' 
      ? toolResult.content 
      : JSON.stringify(toolResult.content, null, 2);

    return html`
      <div class="tool-use-content">
        <div class="tool-header">
          <div class="tool-name">Tool Result</div>
          <div class="tool-status ${toolResult.is_error ? 'error' : 'success'}">
            ${toolResult.is_error ? 'Error' : 'Success'}
          </div>
        </div>
        <div class="tool-result">
          <pre>${resultText}</pre>
        </div>
      </div>
    `;
  }

  private renderThinkingContent(content: ProcessedContent) {
    const thinking = content.content as ThinkingContent;
    
    return html`
      <div class="thinking-content">
        <div class="thinking-header">
          💭 Thinking
        </div>
        <div>${thinking.thinking}</div>
      </div>
    `;
  }

  private renderImageContent(content: ProcessedContent) {
    const image = content.content as ImageContent;
    const src = `data:${image.source.media_type};base64,${image.source.data}`;
    
    return html`
      <div class="image-content">
        <img src="${src}" alt="Embedded image" />
      </div>
    `;
  }

  private renderErrorContent(content: ProcessedContent) {
    return html`
      <div class="error-content">
        <strong>Error:</strong> ${content.content}
      </div>
    `;
  }

  private processMessage() {
    if (!this.entry) return;

    // Create metadata
    this.metadata = this.createMetadata();

    // Process content based on message type
    this.processedContent = this.processContentItems();
  }

  private createMetadata(): MessageMetadata {
    if (!this.entry) throw new Error('No entry to process');

    const timestamp = 'timestamp' in this.entry ? this.entry.timestamp : new Date().toISOString();

    return {
      timestamp: new Date(timestamp),
      index: this.messageIndex,
      hasToolUse: this.hasToolUse(),
      hasThinking: this.hasThinking(),
      hasErrors: this.hasErrors(),
      tokenCount: this.getTokenCount(),
    };
  }

  private processContentItems(): ProcessedContent[] {
    if (!this.entry) return [];

    const items: ProcessedContent[] = [];

    if (this.entry.type === 'user') {
      const userEntry = this.entry as any; // UserTranscriptEntry
      const content = userEntry.message.content;
      
      if (typeof content === 'string') {
        items.push({
          type: 'text',
          content: content,
        });
      } else if (Array.isArray(content)) {
        content.forEach(item => {
          items.push(this.processContentItem(item));
        });
      }
    } else if (this.entry.type === 'assistant') {
      const assistantEntry = this.entry as any; // AssistantTranscriptEntry
      const content = assistantEntry.message.content;
      
      if (Array.isArray(content)) {
        content.forEach(item => {
          items.push(this.processContentItem(item));
        });
      }
    } else if (this.entry.type === 'system') {
      const systemEntry = this.entry as any; // SystemTranscriptEntry
      items.push({
        type: 'text',
        content: systemEntry.content,
      });
    }

    return items;
  }

  private processContentItem(item: ContentItem): ProcessedContent {
    switch (item.type) {
      case 'text':
        return {
          type: 'text',
          content: (item as TextContent).text,
        };
        
      case 'tool_use':
        return {
          type: 'tool_use',
          content: item as ToolUseContent,
          collapsible: true,
          defaultCollapsed: false,
        };
        
      case 'tool_result':
        return {
          type: 'tool_result',
          content: item as ToolResultContent,
          collapsible: true,
          defaultCollapsed: true,
        };
        
      case 'thinking':
        return {
          type: 'thinking',
          content: item as ThinkingContent,
          collapsible: true,
          defaultCollapsed: true,
        };
        
      case 'image':
        return {
          type: 'image',
          content: item as ImageContent,
        };
        
      default:
        return {
          type: 'text',
          content: JSON.stringify(item, null, 2),
        };
    }
  }

  private hasToolUse(): boolean {
    return this.processedContent.some(item => item.type === 'tool_use' || item.type === 'tool_result');
  }

  private hasThinking(): boolean {
    return this.processedContent.some(item => item.type === 'thinking');
  }

  private hasErrors(): boolean {
    return this.processedContent.some(item => 
      item.type === 'error' || 
      (item.type === 'tool_result' && (item.content as ToolResultContent).is_error)
    );
  }

  private getTokenCount(): number | undefined {
    if (this.entry?.type === 'assistant') {
      const assistantEntry = this.entry as any; // AssistantTranscriptEntry
      const usage = assistantEntry.message.usage;
      if (usage) {
        return (usage.input_tokens || 0) + (usage.output_tokens || 0);
      }
    }
    return undefined;
  }

  private getContentTitle(content: ProcessedContent): string {
    switch (content.type) {
      case 'tool_use':
        return `Tool: ${(content.content as ToolUseContent).name}`;
      case 'tool_result':
        return 'Tool Result';
      case 'thinking':
        return 'Thinking';
      case 'code':
        return `Code${content.language ? ` (${content.language})` : ''}`;
      default:
        return content.type.charAt(0).toUpperCase() + content.type.slice(1);
    }
  }

  private processTextForDisplay(text: string): string {
    try {
      // Use marked for full markdown processing
      const result = marked.parse(text);
      return typeof result === 'string' ? result : String(result);
    } catch (err) {
      console.warn('Markdown parsing failed, falling back to basic processing:', err);
      // Fallback to basic processing
      return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
    }
  }

  private formatTimestamp(timestamp: Date): string {
    return timestamp.toLocaleTimeString();
  }

  private toggleCollapse() {
    this.collapsed = !this.collapsed;
  }

  private toggleSection(sectionId: string) {
    if (this.collapsedSections.has(sectionId)) {
      this.collapsedSections.delete(sectionId);
    } else {
      this.collapsedSections.add(sectionId);
    }
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'message-display': MessageDisplay;
  }
}