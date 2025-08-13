import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { SessionDetail, Message } from '../types/session-types';
import SessionBrowserWebSocket, { SessionUpdate } from '../../services/session-browser-websocket';
import { baseStyles } from '../styles/theme';

export interface LiveMessageConfig {
  autoScroll?: boolean;
  showTimestamps?: boolean;
  highlightNewMessages?: boolean;
  playMessageSounds?: boolean;
  maxRetainedMessages?: number;
  messageBufferSize?: number;
  scrollThreshold?: number;
  typingIndicatorTimeout?: number;
}

export interface LiveMessage extends Message {
  isNew?: boolean;
  isStreaming?: boolean;
  streamingContent?: string;
  highlight?: boolean;
  animationClass?: string;
}

export interface TypingIndicator {
  sessionId: string;
  userId?: string;
  isTyping: boolean;
  lastActivity: Date;
}

/**
 * Live message streaming component for real-time session viewing
 * Handles streaming messages, typing indicators, and auto-scrolling
 */
@customElement('live-message-stream')
export class LiveMessageStream extends LitElement {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-background);
      }

      .stream-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .stream-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .live-indicator {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        padding: var(--space-xs) var(--space-sm);
        background: var(--color-error);
        color: white;
        border-radius: var(--border-radius-full);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        animation: pulse-red 2s infinite;
      }

      .live-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: white;
        animation: blink 1s infinite;
      }

      .stream-controls {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .control-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .control-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
        color: var(--color-text-primary);
      }

      .control-button.active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .message-container {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-md);
        position: relative;
        scroll-behavior: smooth;
      }

      .message-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        min-height: 100%;
      }

      .message-item {
        display: flex;
        gap: var(--space-md);
        padding: var(--space-md);
        border-radius: var(--border-radius);
        transition: all var(--transition-fast);
        position: relative;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      .message-item.new {
        animation: slideInMessage 0.5s ease-out, highlightNew 3s ease-out;
      }

      .message-item.streaming {
        animation: pulse-border 1.5s infinite;
      }

      .message-item.highlight {
        background: var(--color-warning-light);
        border-left: 4px solid var(--color-warning);
        padding-left: calc(var(--space-md) - 4px);
      }

      .message-item.user {
        background: var(--color-success-light);
        margin-left: var(--space-xl);
        border-radius: var(--border-radius) var(--border-radius) var(--border-radius-sm) var(--border-radius);
      }

      .message-item.assistant {
        background: var(--color-info-light);
        margin-right: var(--space-xl);
        border-radius: var(--border-radius) var(--border-radius) var(--border-radius) var(--border-radius-sm);
      }

      .message-item.system {
        background: var(--color-warning-light);
        margin: 0 var(--space-lg);
        border-radius: var(--border-radius);
        font-style: italic;
      }

      .message-item.error {
        background: var(--color-error-light);
        border: 1px solid var(--color-error);
        margin: 0;
      }

      .message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: var(--font-weight-bold);
        color: white;
        flex-shrink: 0;
        font-size: var(--font-size-sm);
      }

      .message-avatar.user {
        background: var(--color-success);
      }

      .message-avatar.assistant {
        background: var(--color-primary);
      }

      .message-avatar.system {
        background: var(--color-warning);
      }

      .message-avatar.error {
        background: var(--color-error);
      }

      .message-content {
        flex: 1;
        min-width: 0;
      }

      .message-header {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-bottom: var(--space-xs);
      }

      .message-role {
        font-weight: var(--font-weight-semibold);
        font-size: var(--font-size-sm);
        text-transform: capitalize;
      }

      .message-timestamp {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        opacity: 0;
        transition: opacity var(--transition-fast);
      }

      .message-item:hover .message-timestamp {
        opacity: 1;
      }

      .message-text {
        color: var(--color-text-primary);
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .streaming-text {
        position: relative;
      }

      .streaming-cursor {
        display: inline-block;
        width: 2px;
        height: 1.2em;
        background: var(--color-primary);
        margin-left: 2px;
        animation: blink 1s infinite;
        vertical-align: text-bottom;
      }

      .message-metadata {
        margin-top: var(--space-sm);
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        display: flex;
        gap: var(--space-md);
        opacity: 0.7;
      }

      .typing-indicator {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-md);
        margin-top: var(--space-md);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        font-style: italic;
        color: var(--color-text-secondary);
        animation: fadeIn 0.3s ease-out;
      }

      .typing-dots {
        display: flex;
        gap: 4px;
      }

      .typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-text-secondary);
        animation: typingDots 1.5s infinite;
      }

      .typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }

      .typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      .scroll-to-bottom {
        position: fixed;
        bottom: var(--space-lg);
        right: var(--space-lg);
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border: none;
        border-radius: 50%;
        width: 48px;
        height: 48px;
        cursor: pointer;
        box-shadow: var(--shadow-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--font-size-lg);
        transition: all var(--transition-fast);
        z-index: 10;
        opacity: 0;
        transform: translateY(20px);
      }

      .scroll-to-bottom.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .scroll-to-bottom:hover {
        transform: scale(1.05);
        box-shadow: var(--shadow-xl);
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
        font-size: 4rem;
        margin-bottom: var(--space-lg);
        opacity: 0.5;
      }

      .empty-state-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-medium);
        margin-bottom: var(--space-md);
      }

      .empty-state-description {
        font-size: var(--font-size-base);
        line-height: 1.5;
        max-width: 400px;
      }

      .message-count {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        padding: var(--space-xs) var(--space-sm);
        background: var(--color-background-tertiary);
        border-radius: var(--border-radius-full);
      }

      @keyframes pulse-red {
        0%, 100% { 
          box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.4);
        }
        50% { 
          box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
        }
      }

      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }

      @keyframes slideInMessage {
        from {
          opacity: 0;
          transform: translateX(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes highlightNew {
        0% { background: var(--color-success-light); }
        100% { background: transparent; }
      }

      @keyframes pulse-border {
        0%, 100% { 
          border: 2px solid transparent;
        }
        50% { 
          border: 2px solid var(--color-primary);
        }
      }

      @keyframes typingDots {
        0%, 80%, 100% {
          transform: scale(1);
          opacity: 0.5;
        }
        40% {
          transform: scale(1.5);
          opacity: 1;
        }
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .message-item.user {
          margin-left: var(--space-md);
        }

        .message-item.assistant {
          margin-right: var(--space-md);
        }

        .message-item.system {
          margin: 0 var(--space-sm);
        }

        .stream-header {
          padding: var(--space-sm);
        }

        .message-container {
          padding: var(--space-sm);
        }
      }

      /* Accessibility */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
        }

        .message-container {
          scroll-behavior: auto;
        }
      }

      /* Dark mode adjustments */
      @media (prefers-color-scheme: dark) {
        .message-item.user {
          background: rgba(40, 167, 69, 0.2);
        }

        .message-item.assistant {
          background: rgba(13, 110, 253, 0.2);
        }

        .message-item.system {
          background: rgba(255, 193, 7, 0.2);
        }

        .message-item.error {
          background: rgba(220, 53, 69, 0.2);
        }
      }
    `,
  ];

  @property({ type: Object })
  session: SessionDetail | null = null;

  @property({ type: Object })
  webSocketService: SessionBrowserWebSocket | null = null;

  @property({ type: Object })
  config: LiveMessageConfig = {
    autoScroll: true,
    showTimestamps: false,
    highlightNewMessages: true,
    playMessageSounds: false,
    maxRetainedMessages: 1000,
    messageBufferSize: 50,
    scrollThreshold: 100,
    typingIndicatorTimeout: 3000,
  };

  @state()
  private messages: LiveMessage[] = [];

  @state()
  private typingIndicators = new Map<string, TypingIndicator>();

  @state()
  private isUserScrolling = false;

  @state()
  private showScrollButton = false;

  @state()
  private streamingMessages = new Map<string, string>();

  @query('.message-container')
  private messageContainer!: HTMLElement;

  private scrollCheckTimeout: NodeJS.Timeout | null = null;
  private typingCheckInterval: NodeJS.Timeout | null = null;
  private lastScrollTop = 0;
  private newMessageCount = 0;

  connectedCallback() {
    super.connectedCallback();
    this.setupWebSocketListeners();
    this.startTypingIndicatorCleanup();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanupListeners();
  }

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    
    if (changedProperties.has('session') && this.session) {
      this.initializeSession();
    }
  }

  render() {
    return html`
      <div class="stream-header">
        <h3 class="stream-title">
          Live Messages
          ${this.session ? html`
            <div class="live-indicator">
              <div class="live-dot"></div>
              LIVE
            </div>
          ` : ''}
          ${this.messages.length > 0 ? html`
            <span class="message-count">${this.messages.length} messages</span>
          ` : ''}
        </h3>
        
        <div class="stream-controls">
          <button 
            class="control-button ${this.config.autoScroll ? 'active' : ''}"
            @click=${this.toggleAutoScroll}
            title="Toggle auto-scroll"
          >
            📜 Auto-scroll
          </button>
          
          <button 
            class="control-button ${this.config.showTimestamps ? 'active' : ''}"
            @click=${this.toggleTimestamps}
            title="Toggle timestamps"
          >
            🕐 Time
          </button>
          
          <button 
            class="control-button ${this.config.playMessageSounds ? 'active' : ''}"
            @click=${this.toggleSounds}
            title="Toggle message sounds"
          >
            🔊 Sound
          </button>
          
          <button 
            class="control-button"
            @click=${this.clearMessages}
            title="Clear messages"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      <div 
        class="message-container" 
        @scroll=${this.handleScroll}
        @wheel=${this.handleWheel}
      >
        ${this.renderContent()}
      </div>

      <button 
        class="scroll-to-bottom ${this.showScrollButton ? 'visible' : ''}"
        @click=${this.scrollToBottom}
        title="Scroll to bottom"
      >
        ⬇️
      </button>
    `;
  }

  private renderContent() {
    if (this.messages.length === 0) {
      return this.renderEmptyState();
    }

    return html`
      <div class="message-list">
        ${this.messages.map(message => this.renderMessage(message))}
        ${Array.from(this.typingIndicators.values()).map(indicator => this.renderTypingIndicator(indicator))}
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-title">No Messages Yet</div>
        <div class="empty-state-description">
          ${this.session 
            ? 'Messages will appear here as they are received in real-time.'
            : 'Select a session to view live messages.'}
        </div>
      </div>
    `;
  }

  private renderMessage(message: LiveMessage) {
    const avatarMap = {
      user: '👤',
      assistant: '🤖',
      system: '⚙️',
      error: '❌',
    };

    const isStreaming = this.streamingMessages.has(message.id || '');
    const displayContent = isStreaming 
      ? this.streamingMessages.get(message.id || '') || message.content
      : message.content || message.error;

    const messageClasses = classMap({
      'message-item': true,
      [message.role || 'unknown']: true,
      'new': message.isNew || false,
      'streaming': isStreaming,
      'highlight': message.highlight || false,
    });

    return html`
      <div class="${messageClasses}" data-message-id="${message.id}">
        <div class="message-avatar ${message.role}">
          ${avatarMap[message.role as keyof typeof avatarMap] || '💬'}
        </div>
        
        <div class="message-content">
          <div class="message-header">
            <span class="message-role">${message.role || 'Unknown'}</span>
            ${this.config.showTimestamps && message.timestamp ? html`
              <span class="message-timestamp">
                ${this.formatTimestamp(message.timestamp)}
              </span>
            ` : ''}
          </div>
          
          <div class="message-text">
            ${isStreaming ? html`
              <span class="streaming-text">
                ${displayContent}<span class="streaming-cursor"></span>
              </span>
            ` : displayContent}
          </div>
          
          ${message.tool_name || message.tokens ? html`
            <div class="message-metadata">
              ${message.tool_name ? html`<span>Tool: ${message.tool_name}</span>` : ''}
              ${message.tokens ? html`<span>Tokens: ${message.tokens}</span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderTypingIndicator(indicator: TypingIndicator) {
    if (!indicator.isTyping) return '';

    return html`
      <div class="typing-indicator" data-session-id="${indicator.sessionId}">
        <div class="message-avatar assistant">🤖</div>
        <div>
          Assistant is typing
          <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Initialize session and load existing messages
   */
  private initializeSession() {
    if (!this.session) return;

    // Load existing messages
    this.messages = (this.session.messages || []).map((msg, index) => ({
      ...msg,
      isNew: false,
    }));

    // Subscribe to real-time updates for this session
    if (this.webSocketService) {
      this.webSocketService.subscribeToSession(this.session.sessionId);
    }

    // Scroll to bottom initially
    this.requestUpdate().then(() => {
      if (this.config.autoScroll) {
        this.scrollToBottom();
      }
    });
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupWebSocketListeners() {
    if (!this.webSocketService) return;

    this.webSocketService.on('message-added', (sessionId, message) => {
      if (sessionId === this.session?.sessionId) {
        this.handleNewMessage(message);
      }
    });

    this.webSocketService.on('message-updated', (sessionId, messageId, message) => {
      if (sessionId === this.session?.sessionId) {
        this.handleMessageUpdate(messageId, message);
      }
    });

    // Listen for streaming updates (if supported by backend)
    this.webSocketService.on('message-streaming', (data: any) => {
      if (data.sessionId === this.session?.sessionId) {
        this.handleMessageStreaming(data);
      }
    });

    this.webSocketService.on('typing-start', (data: any) => {
      if (data.sessionId === this.session?.sessionId) {
        this.handleTypingStart(data);
      }
    });

    this.webSocketService.on('typing-stop', (data: any) => {
      if (data.sessionId === this.session?.sessionId) {
        this.handleTypingStop(data);
      }
    });
  }

  /**
   * Handle new message arrival
   */
  private handleNewMessage(message: Message) {
    const liveMessage: LiveMessage = {
      ...message,
      isNew: true,
      highlight: this.config.highlightNewMessages,
    };

    // Add message to list
    this.messages = [...this.messages, liveMessage];

    // Remove 'new' flag after animation
    setTimeout(() => {
      this.messages = this.messages.map(msg => 
        msg.id === message.id ? { ...msg, isNew: false, highlight: false } : msg
      );
      this.requestUpdate();
    }, 3000);

    // Trim messages if over limit
    if (this.messages.length > this.config.maxRetainedMessages!) {
      this.messages = this.messages.slice(-this.config.maxRetainedMessages!);
    }

    // Auto-scroll if enabled and user isn't scrolling
    if (this.config.autoScroll && !this.isUserScrolling) {
      this.requestUpdate().then(() => {
        this.scrollToBottom();
      });
    } else {
      this.newMessageCount++;
    }

    // Play sound if enabled
    if (this.config.playMessageSounds) {
      this.playMessageSound(message.role || 'unknown');
    }

    // Clear any typing indicators
    this.clearTypingIndicator();

    this.requestUpdate();
  }

  /**
   * Handle message update
   */
  private handleMessageUpdate(messageId: string, updatedMessage: Message) {
    this.messages = this.messages.map(msg => 
      msg.id === messageId ? { ...msg, ...updatedMessage, isNew: false } : msg
    );
    this.requestUpdate();
  }

  /**
   * Handle streaming message updates
   */
  private handleMessageStreaming(data: { messageId: string; content: string; isComplete: boolean }) {
    if (data.isComplete) {
      this.streamingMessages.delete(data.messageId);
      
      // Update the actual message
      this.messages = this.messages.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, content: data.content, isStreaming: false }
          : msg
      );
    } else {
      this.streamingMessages.set(data.messageId, data.content);
    }

    this.requestUpdate();

    // Auto-scroll during streaming
    if (this.config.autoScroll && !this.isUserScrolling) {
      setTimeout(() => this.scrollToBottom(), 50);
    }
  }

  /**
   * Handle typing indicator start
   */
  private handleTypingStart(data: { sessionId: string; userId?: string }) {
    const indicator: TypingIndicator = {
      sessionId: data.sessionId,
      userId: data.userId,
      isTyping: true,
      lastActivity: new Date(),
    };

    this.typingIndicators.set(data.userId || 'default', indicator);
    this.requestUpdate();

    // Auto-scroll if enabled
    if (this.config.autoScroll && !this.isUserScrolling) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  /**
   * Handle typing indicator stop
   */
  private handleTypingStop(data: { sessionId: string; userId?: string }) {
    this.typingIndicators.delete(data.userId || 'default');
    this.requestUpdate();
  }

  /**
   * Clear typing indicators
   */
  private clearTypingIndicator() {
    this.typingIndicators.clear();
    this.requestUpdate();
  }

  /**
   * Start typing indicator cleanup interval
   */
  private startTypingIndicatorCleanup() {
    this.typingCheckInterval = setInterval(() => {
      const now = new Date();
      let hasChanges = false;

      for (const [key, indicator] of this.typingIndicators.entries()) {
        const timeSinceLastActivity = now.getTime() - indicator.lastActivity.getTime();
        if (timeSinceLastActivity > (this.config.typingIndicatorTimeout || 3000)) {
          this.typingIndicators.delete(key);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        this.requestUpdate();
      }
    }, 1000);
  }

  /**
   * Handle scroll events
   */
  private handleScroll = () => {
    const container = this.messageContainer;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - this.config.scrollThreshold!;

    // Update scroll button visibility
    this.showScrollButton = !isAtBottom && this.messages.length > 0;

    // Reset new message count if user scrolled to bottom
    if (isAtBottom) {
      this.newMessageCount = 0;
    }

    // Detect if user is actively scrolling
    if (scrollTop !== this.lastScrollTop) {
      this.isUserScrolling = true;
      
      if (this.scrollCheckTimeout) {
        clearTimeout(this.scrollCheckTimeout);
      }

      this.scrollCheckTimeout = setTimeout(() => {
        this.isUserScrolling = false;
      }, 1000);

      this.lastScrollTop = scrollTop;
    }

    this.requestUpdate();
  };

  /**
   * Handle wheel events to detect user scrolling
   */
  private handleWheel = () => {
    this.isUserScrolling = true;
    
    if (this.scrollCheckTimeout) {
      clearTimeout(this.scrollCheckTimeout);
    }

    this.scrollCheckTimeout = setTimeout(() => {
      this.isUserScrolling = false;
    }, 1000);
  };

  /**
   * Scroll to bottom of messages
   */
  private scrollToBottom() {
    if (this.messageContainer) {
      this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
      this.showScrollButton = false;
      this.newMessageCount = 0;
    }
  }

  /**
   * Play sound for new message
   */
  private playMessageSound(role: string) {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      const frequencies = {
        user: 800,
        assistant: 1000,
        system: 600,
        error: 400,
        unknown: 700,
      };

      oscillator.frequency.value = frequencies[role as keyof typeof frequencies] || 700;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.3);
    } catch (error) {
      console.error('Failed to play message sound:', error);
    }
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(timestamp: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(timestamp);
  }

  /**
   * Cleanup listeners and intervals
   */
  private cleanupListeners() {
    if (this.scrollCheckTimeout) {
      clearTimeout(this.scrollCheckTimeout);
    }

    if (this.typingCheckInterval) {
      clearInterval(this.typingCheckInterval);
    }

    if (this.webSocketService && this.session) {
      this.webSocketService.unsubscribeFromSession(this.session.sessionId);
    }
  }

  // Control methods

  private toggleAutoScroll = () => {
    this.config = { ...this.config, autoScroll: !this.config.autoScroll };
    
    if (this.config.autoScroll) {
      this.scrollToBottom();
    }
  };

  private toggleTimestamps = () => {
    this.config = { ...this.config, showTimestamps: !this.config.showTimestamps };
  };

  private toggleSounds = () => {
    this.config = { ...this.config, playMessageSounds: !this.config.playMessageSounds };
  };

  private clearMessages = () => {
    this.messages = [];
    this.streamingMessages.clear();
    this.typingIndicators.clear();
    this.newMessageCount = 0;
    this.requestUpdate();
  };

  // Public API

  /**
   * Manually add a message (for testing or external integration)
   */
  addMessage(message: Message) {
    this.handleNewMessage(message);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LiveMessageConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get new message count since last scroll
   */
  getNewMessageCount(): number {
    return this.newMessageCount;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'live-message-stream': LiveMessageStream;
  }
}