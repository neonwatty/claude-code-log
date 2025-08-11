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
import hljs from 'highlight.js/lib/core';
import '../markdown-renderer/MarkdownRenderer';
import { AriaRoles, AriaAttributes, KeyboardKeys, FocusManager, announce, A11yConfig, generateId } from '../utils/accessibility';
import { useFocusManagement, skipLinkManager } from '../utils/focus-management';
import { useLazyLoading, createLazyLoadingConfig } from '../utils/lazy-loading';
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

      /* Screen reader only content */
      .sr-only {
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
      }

      /* Focus management */
      .message-container:focus {
        outline: 2px solid var(--color-border-focus);
        outline-offset: 2px;
      }

      /* Enhanced button accessibility */
      .collapse-toggle:focus,
      .section-header:focus {
        outline: 2px solid var(--color-border-focus);
        outline-offset: 2px;
        background: var(--color-background-tertiary);
      }

      /* Improve section navigation */
      .section-header {
        cursor: pointer;
        transition: all var(--transition-fast);
        border: none;
        background: var(--color-background-secondary);
        width: 100%;
        text-align: left;
        padding: var(--space-sm) var(--space-md);
      }

      .section-header:hover {
        background: var(--color-background-tertiary);
      }

      .section-header:focus-visible {
        outline: 2px solid var(--color-border-focus);
        outline-offset: -2px;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .message-container {
          border: 2px solid;
        }
        
        .collapse-toggle,
        .section-header {
          border: 1px solid;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
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

  @state()
  private messageId = generateId('message');

  @state()
  private headerId = generateId('message-header');

  @state()
  private contentId = generateId('message-content');

  private focusManager = useFocusManagement(`message-${this.messageIndex}`, this, 2);

  private contentLazyLoader = useLazyLoading(this, createLazyLoadingConfig({
    strategy: 'intersection',
    batchSize: 2,
    loadDelay: 100,
  }));

  private performanceOptimizations = {
    shouldUpdateContent: true,
    contentChangeDebounceId: null as number | null,
    isVisible: false,
    measurementCache: new Map<string, number>(),
  };


  render() {
    if (!this.entry || !this.metadata) {
      return html`
        <div 
          class="message-container"
          role="${AriaRoles.STATUS}"
          aria-live="polite"
          aria-label="${A11yConfig.LABELS.LOADING} message"
        >
          Loading...
        </div>
      `;
    }

    const containerClasses = {
      'message-container': true,
      [this.entry.type]: true,
      'compact': this.displayMode === 'compact',
      'selected': this.selected,
    };

    const messageLabel = this.getMessageLabel();

    return html`
      <div 
        id="${this.messageId}"
        class="${classMap(containerClasses)}"
        role="${AriaRoles.ARTICLE}"
        aria-labelledby="${this.headerId}"
        aria-describedby="${this.contentId}"
        tabindex="0"
        @keydown=${this.handleMessageKeydown}
        @focus=${this.handleMessageFocus}
      >
        ${this.renderHeader()}
        ${this.renderContent()}
      </div>
    `;
  }

  private renderHeader() {
    if (!this.metadata) return '';

    const collapseButtonId = generateId('collapse-btn');

    return html`
      <header 
        id="${this.headerId}"
        class="message-header"
        role="${AriaRoles.BANNER}"
      >
        <div class="message-info">
          <div 
            class="message-role ${this.entry?.type}"
            role="${AriaRoles.STATUS}"
            aria-label="Message from ${this.entry?.type}"
          >
            ${this.entry?.type}
          </div>
          <time 
            class="message-timestamp"
            datetime="${this.metadata.timestamp.toISOString()}"
            aria-label="Sent at ${this.formatTimestamp(this.metadata.timestamp)}"
          >
            ${this.formatTimestamp(this.metadata.timestamp)}
          </time>
        </div>
        <div class="message-meta" role="group" aria-label="Message metadata">
          ${this.renderBadges()}
          ${this.processedContent.length > 1 ? html`
            <button 
              id="${collapseButtonId}"
              class="collapse-toggle ${this.collapsed ? 'collapsed' : ''}"
              type="button"
              aria-expanded="${!this.collapsed}"
              aria-controls="${this.contentId}"
              aria-label="${this.collapsed ? A11yConfig.LABELS.EXPAND : A11yConfig.LABELS.COLLAPSE} message content"
              @click=${this.toggleCollapse}
              @keydown=${this.handleCollapseKeydown}
            >
              <span aria-hidden="true">▼</span>
              <span class="sr-only">${this.collapsed ? 'Expand' : 'Collapse'} message</span>
            </button>
          ` : ''}
        </div>
      </header>
    `;
  }

  private renderBadges() {
    if (!this.metadata) return '';

    const badges: any[] = [];

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
      <div 
        id="${this.contentId}"
        class="${classMap(contentClasses)}"
        role="${AriaRoles.REGION}"
        aria-label="Message content"
        aria-hidden="${this.collapsed}"
        @keydown=${this.handleContentKeydown}
      >
        ${this.processedContent.map((content, index) => this.renderContentItem(content, index))}
      </div>
    `;
  }

  private renderContentItem(content: ProcessedContent, index: number) {
    const sectionId = `section-${index}`;
    const headerId = `${sectionId}-header`;
    const contentSectionId = `${sectionId}-content`;
    const isCollapsed = this.collapsedSections.has(sectionId);

    if (content.collapsible) {
      const title = this.getContentTitle(content);
      
      return html`
        <div 
          class="content-item collapsible-section"
          role="${AriaRoles.REGION}"
          aria-labelledby="${headerId}"
        >
          <button 
            id="${headerId}"
            class="section-header"
            type="button"
            role="button"
            aria-expanded="${!isCollapsed}"
            aria-controls="${contentSectionId}"
            aria-label="${isCollapsed ? A11yConfig.LABELS.EXPAND : A11yConfig.LABELS.COLLAPSE} ${title}"
            @click=${() => this.toggleSection(sectionId)}
            @keydown=${(e: KeyboardEvent) => this.handleSectionKeydown(e, sectionId)}
          >
            <div class="section-title">${title}</div>
            <div class="collapse-toggle ${isCollapsed ? 'collapsed' : ''}" aria-hidden="true">▼</div>
          </button>
          <div 
            id="${contentSectionId}"
            class="section-content ${isCollapsed ? 'collapsed' : ''}"
            role="${AriaRoles.REGION}"
            aria-hidden="${isCollapsed}"
            aria-labelledby="${headerId}"
          >
            ${this.renderContentByType(content)}
          </div>
        </div>
      `;
    }

    return html`
      <div 
        class="content-item"
        role="${AriaRoles.REGION}"
        aria-label="${this.getContentTitle(content)}"
      >
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
        <markdown-renderer
          .content=${content.content as string}
          .gfm=${true}
          .breaks=${false}
          .sanitize=${true}
        ></markdown-renderer>
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
        <markdown-renderer
          .content=${thinking.thinking}
          .gfm=${true}
          .breaks=${true}
          .sanitize=${true}
        ></markdown-renderer>
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


  private formatTimestamp(timestamp: Date): string {
    return timestamp.toLocaleTimeString();
  }


  private toggleSection(sectionId: string) {
    const wasCollapsed = this.collapsedSections.has(sectionId);
    
    if (wasCollapsed) {
      this.collapsedSections.delete(sectionId);
    } else {
      this.collapsedSections.add(sectionId);
    }
    
    this.requestUpdate();
    
    // Announce the state change to screen readers
    const action = wasCollapsed ? 'expanded' : 'collapsed';
    const title = this.getContentTitle(this.processedContent.find((_, i) => `section-${i}` === sectionId)!);
    announce(`${title} ${action}`, 'polite');
  }

  // Accessibility methods

  private getMessageLabel(): string {
    if (!this.entry) return 'Message';
    
    const role = this.entry.type;
    const index = this.messageIndex > 0 ? ` ${this.messageIndex + 1}` : '';
    const timestamp = this.metadata ? this.formatTimestamp(this.metadata.timestamp) : '';
    
    return `${role} message${index}${timestamp ? ` at ${timestamp}` : ''}`;
  }

  private handleMessageKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case KeyboardKeys.ENTER:
      case KeyboardKeys.SPACE:
        // Toggle collapse if message has collapsible content
        if (this.processedContent.length > 1) {
          this.toggleCollapse();
          event.preventDefault();
        }
        break;
        
      case KeyboardKeys.ESCAPE:
        // Move focus to parent container or clear selection
        const parentElement = this.closest('session-list') as HTMLElement;
        if (parentElement) {
          parentElement.focus();
        }
        break;
        
      case KeyboardKeys.ARROW_DOWN:
      case KeyboardKeys.ARROW_UP:
        // Navigate between messages (delegate to parent)
        event.stopPropagation(); // Let parent handle this
        break;
    }
  }

  private handleMessageFocus(event: FocusEvent) {
    // Announce message when focused
    const label = this.getMessageLabel();
    const contentInfo = this.getContentSummary();
    announce(`${label}. ${contentInfo}`, 'polite');
  }

  private handleCollapseKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case KeyboardKeys.ENTER:
      case KeyboardKeys.SPACE:
        this.toggleCollapse();
        event.preventDefault();
        break;
    }
  }

  private handleContentKeydown(event: KeyboardEvent) {
    // Handle navigation within collapsed sections
    if (event.key === KeyboardKeys.TAB) {
      // Allow normal tab navigation
      return;
    }
    
    // Focus management for collapsible sections
    const collapsibleSections = this.shadowRoot?.querySelectorAll('.section-header');
    if (!collapsibleSections?.length) return;
    
    const currentFocused = event.target as HTMLElement;
    const focusedIndex = Array.from(collapsibleSections).indexOf(currentFocused);
    
    switch (event.key) {
      case KeyboardKeys.ARROW_DOWN:
        if (focusedIndex < collapsibleSections.length - 1) {
          (collapsibleSections[focusedIndex + 1] as HTMLElement).focus();
          event.preventDefault();
        }
        break;
        
      case KeyboardKeys.ARROW_UP:
        if (focusedIndex > 0) {
          (collapsibleSections[focusedIndex - 1] as HTMLElement).focus();
          event.preventDefault();
        }
        break;
    }
  }

  private handleSectionKeydown(event: KeyboardEvent, sectionId: string) {
    switch (event.key) {
      case KeyboardKeys.ENTER:
      case KeyboardKeys.SPACE:
        this.toggleSection(sectionId);
        event.preventDefault();
        break;
        
      case KeyboardKeys.ARROW_RIGHT:
        // Expand section
        if (this.collapsedSections.has(sectionId)) {
          this.toggleSection(sectionId);
          event.preventDefault();
        }
        break;
        
      case KeyboardKeys.ARROW_LEFT:
        // Collapse section
        if (!this.collapsedSections.has(sectionId)) {
          this.toggleSection(sectionId);
          event.preventDefault();
        }
        break;
    }
  }

  private getContentSummary(): string {
    if (!this.processedContent.length) return 'No content';
    
    const types = this.processedContent.map(content => content.type);
    const counts = types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const summary = Object.entries(counts)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');
      
    return `Contains ${summary}`;
  }

  protected updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);

    // Optimize updates based on visibility
    if (!this.performanceOptimizations.isVisible && !this.shouldAlwaysUpdate(changedProperties)) {
      return;
    }
    
    // Process message when entry changes (original logic)
    if (changedProperties.has('entry') && this.entry) {
      this.debouncedProcessMessage();
    }
    
    // Update ARIA attributes when state changes
    if (changedProperties.has('collapsed')) {
      const collapseButton = this.shadowRoot?.querySelector('.collapse-toggle');
      if (collapseButton) {
        collapseButton.setAttribute(AriaAttributes.EXPANDED, (!this.collapsed).toString());
        
        // Announce state change
        const action = this.collapsed ? 'collapsed' : 'expanded';
        announce(`Message content ${action}`, 'polite');
      }
    }
    
    // Announce when content changes
    if (changedProperties.has('processedContent')) {
      const summary = this.getContentSummary();
      // Delay to avoid conflicts with other announcements
      setTimeout(() => {
        announce(summary, 'polite');
      }, 200);
    }

    // Setup lazy loading for content items
    if (changedProperties.has('processedContent')) {
      this.setupContentLazyLoading();
    }
  }

  private shouldAlwaysUpdate(changedProperties: Map<string, any>): boolean {
    // Always update for accessibility-related changes
    return changedProperties.has('selected') || 
           changedProperties.has('collapsed') ||
           changedProperties.has('messageIndex');
  }

  private debouncedProcessMessage = this.debounce(() => {
    if (this.performanceOptimizations.shouldUpdateContent) {
      this.processMessage();
    }
  }, 16); // ~60fps

  private setupContentLazyLoading() {
    if (this.processedContent.length === 0) return;

    // Add heavy content items to lazy loader
    this.processedContent.forEach((content, index) => {
      if (this.isHeavyContent(content)) {
        const itemId = `content-${this.messageId}-${index}`;
        this.contentLazyLoader.addItem(itemId, content, {
          priority: content.type === 'thinking' ? 0 : 1, // Lower priority for thinking content
          loader: () => this.loadContentData(content),
        });
      }
    });
  }

  private isHeavyContent(content: ProcessedContent): boolean {
    return content.type === 'tool_result' || 
           content.type === 'thinking' ||
           content.type === 'image' ||
           (content.type === 'code' && (content.content as string).length > 1000);
  }

  private async loadContentData(content: ProcessedContent): Promise<void> {
    // Simulate processing heavy content
    return new Promise(resolve => {
      const delay = content.type === 'image' ? 300 : 100;
      setTimeout(resolve, delay);
    });
  }

  private debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: number;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => func(...args), wait);
    };
  }

  private toggleCollapse() {
    this.collapsed = !this.collapsed;
    
    // Focus management: ensure focus stays on toggle button
    const toggleButton = this.shadowRoot?.querySelector('.collapse-toggle') as HTMLElement;
    if (toggleButton && document.activeElement !== toggleButton) {
      // Small delay to allow DOM update
      setTimeout(() => toggleButton.focus(), 0);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    
    // Register for focus management
    this.focusManager.register();
    
    // Register skip link for important messages
    if (this.entry?.type === 'assistant') {
      skipLinkManager.registerTarget(
        `message-${this.messageIndex}`,
        this,
        `Skip to assistant message ${this.messageIndex + 1}`
      );
    }

    // Setup visibility tracking for performance optimization
    this.setupVisibilityTracking();

    // Enable content loading optimizations
    this.enableContentOptimizations();
  }

  private setupVisibilityTracking() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          this.performanceOptimizations.isVisible = entry.isIntersecting;
          
          if (entry.isIntersecting && !this.performanceOptimizations.shouldUpdateContent) {
            // Component became visible, enable content updates
            this.performanceOptimizations.shouldUpdateContent = true;
            if (this.entry && this.processedContent.length === 0) {
              this.processMessage();
            }
          }
        });
      },
      {
        rootMargin: '100px 0px',
        threshold: 0.1,
      }
    );

    observer.observe(this);
  }

  private enableContentOptimizations() {
    // Defer processing of non-critical content when not visible
    if (this.entry && !this.performanceOptimizations.isVisible) {
      this.performanceOptimizations.shouldUpdateContent = false;
      
      // Process basic metadata immediately
      this.metadata = this.createMetadata();
      
      // Defer heavy content processing
      requestIdleCallback(() => {
        if (this.performanceOptimizations.isVisible) {
          this.processMessage();
        }
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    
    // Unregister from focus management
    this.focusManager.unregister();
    skipLinkManager.unregisterTarget(`message-${this.messageIndex}`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'message-display': MessageDisplay;
  }
}