import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { NotificationData, NotificationAction } from '../../services/session-browser-websocket';
import { baseStyles } from '../styles/theme';

export interface NotificationManagerConfig {
  maxNotifications?: number;
  autoCloseDelay?: number;
  showTimestamps?: boolean;
  enableSounds?: boolean;
  enableAnimations?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  enableDismissAll?: boolean;
  enableHistory?: boolean;
  maxHistorySize?: number;
}

export interface NotificationDisplay extends NotificationData {
  isVisible: boolean;
  isClosing: boolean;
  showDetails: boolean;
  autoCloseTimeout?: NodeJS.Timeout;
}

/**
 * Notification management component
 * Handles display, animation, and interaction with real-time notifications
 */
@customElement('notification-manager')
export class NotificationManager extends LitElement {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        position: fixed;
        z-index: 10000;
        pointer-events: none;
        max-width: 400px;
        min-width: 300px;
      }

      :host(.top-right) {
        top: var(--space-lg);
        right: var(--space-lg);
      }

      :host(.top-left) {
        top: var(--space-lg);
        left: var(--space-lg);
      }

      :host(.bottom-right) {
        bottom: var(--space-lg);
        right: var(--space-lg);
      }

      :host(.bottom-left) {
        bottom: var(--space-lg);
        left: var(--space-lg);
      }

      :host(.top-center) {
        top: var(--space-lg);
        left: 50%;
        transform: translateX(-50%);
      }

      :host(.bottom-center) {
        bottom: var(--space-lg);
        left: 50%;
        transform: translateX(-50%);
      }

      .notification-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        pointer-events: auto;
      }

      .notification-item {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        transform: translateX(100%);
        opacity: 0;
        transition: all var(--transition-medium);
        position: relative;
      }

      .notification-item.visible {
        transform: translateX(0);
        opacity: 1;
      }

      .notification-item.closing {
        transform: translateX(100%);
        opacity: 0;
        pointer-events: none;
      }

      .notification-item.info {
        border-left: 4px solid var(--color-info);
      }

      .notification-item.success {
        border-left: 4px solid var(--color-success);
      }

      .notification-item.warning {
        border-left: 4px solid var(--color-warning);
      }

      .notification-item.error {
        border-left: 4px solid var(--color-error);
      }

      .notification-header {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-md) var(--space-md) var(--space-sm);
      }

      .notification-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-bold);
        flex-shrink: 0;
      }

      .notification-icon.info {
        background: var(--color-info);
      }

      .notification-icon.success {
        background: var(--color-success);
      }

      .notification-icon.warning {
        background: var(--color-warning);
      }

      .notification-icon.error {
        background: var(--color-error);
      }

      .notification-content {
        flex: 1;
        min-width: 0;
      }

      .notification-title {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-xs) 0;
        font-size: var(--font-size-base);
        line-height: 1.3;
      }

      .notification-message {
        color: var(--color-text-secondary);
        margin: 0;
        font-size: var(--font-size-sm);
        line-height: 1.4;
        word-wrap: break-word;
      }

      .notification-controls {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        flex-shrink: 0;
      }

      .control-button {
        background: none;
        border: none;
        width: 24px;
        height: 24px;
        border-radius: var(--border-radius-sm);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        transition: all var(--transition-fast);
      }

      .control-button:hover {
        background: var(--color-background-tertiary);
        color: var(--color-text-primary);
      }

      .notification-timestamp {
        padding: 0 var(--space-md) var(--space-xs);
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        text-align: right;
      }

      .notification-details {
        padding: var(--space-sm) var(--space-md);
        background: var(--color-background-secondary);
        border-top: 1px solid var(--color-border);
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        line-height: 1.4;
        max-height: 200px;
        overflow-y: auto;
      }

      .notification-actions {
        display: flex;
        gap: var(--space-xs);
        padding: var(--space-sm) var(--space-md);
        background: var(--color-background-secondary);
        border-top: 1px solid var(--color-border);
      }

      .action-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);
        flex: 1;
      }

      .action-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
        color: var(--color-text-primary);
      }

      .action-button.primary {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .action-button.primary:hover {
        background: var(--color-primary-dark);
        border-color: var(--color-primary-dark);
      }

      .notification-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: var(--color-primary);
        transition: width linear;
        border-radius: 0 0 var(--border-radius) 0;
      }

      .manager-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-sm) var(--space-md);
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        margin-bottom: var(--space-sm);
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .manager-title {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        font-weight: var(--font-weight-medium);
      }

      .manager-actions {
        display: flex;
        gap: var(--space-xs);
      }

      .manager-button {
        background: none;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        padding: var(--space-xs);
        cursor: pointer;
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        transition: all var(--transition-fast);
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .manager-button:hover {
        background: var(--color-background-tertiary);
        border-color: var(--color-primary);
        color: var(--color-text-primary);
      }

      .empty-state {
        text-align: center;
        padding: var(--space-lg);
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        border-style: dashed;
      }

      .empty-icon {
        font-size: 2rem;
        margin-bottom: var(--space-sm);
        opacity: 0.5;
      }

      /* Animations */
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }

      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }

      .notification-item.shake {
        animation: shake 0.5s ease-in-out;
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .notification-item {
          transition: opacity var(--transition-fast);
          transform: none !important;
        }
        
        .notification-item.visible {
          opacity: 1;
        }
        
        .notification-item.closing {
          opacity: 0;
        }
        
        * {
          animation: none !important;
        }
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        :host {
          left: var(--space-md) !important;
          right: var(--space-md) !important;
          max-width: none;
          transform: none !important;
        }

        :host(.top-center),
        :host(.bottom-center) {
          left: var(--space-md);
          right: var(--space-md);
          transform: none;
        }
      }

      /* Dark mode adjustments */
      @media (prefers-color-scheme: dark) {
        .notification-item {
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }
      }
    `,
  ];

  @property({ type: Object })
  config: NotificationManagerConfig = {
    maxNotifications: 5,
    autoCloseDelay: 5000,
    showTimestamps: true,
    enableSounds: false,
    enableAnimations: true,
    position: 'top-right',
    enableDismissAll: true,
    enableHistory: true,
    maxHistorySize: 50,
  };

  @state()
  private notifications: NotificationDisplay[] = [];

  @state()
  private notificationHistory: NotificationDisplay[] = [];

  @state()
  private showHeader = false;

  connectedCallback() {
    super.connectedCallback();
    this.className = this.config.position || 'top-right';
  }

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);

    if (changedProperties.has('config')) {
      this.className = this.config.position || 'top-right';
    }
  }

  render() {
    const visibleNotifications = this.notifications.filter(n => n.isVisible && !n.isClosing);
    
    return html`
      ${this.showHeader && visibleNotifications.length > 0 ? this.renderHeader() : ''}
      
      <div class="notification-container">
        ${visibleNotifications.length === 0 && this.showHeader ? this.renderEmptyState() : ''}
        ${this.notifications.map(notification => this.renderNotification(notification))}
      </div>
    `;
  }

  private renderHeader() {
    return html`
      <div class="manager-header">
        <div class="manager-title">
          <span>🔔</span>
          Notifications (${this.notifications.filter(n => n.isVisible).length})
        </div>
        <div class="manager-actions">
          ${this.config.enableHistory ? html`
            <button 
              class="manager-button" 
              @click=${this.showHistory}
              title="Show notification history"
            >
              📜
            </button>
          ` : ''}
          ${this.config.enableDismissAll ? html`
            <button 
              class="manager-button" 
              @click=${this.dismissAll}
              title="Dismiss all notifications"
            >
              ✕
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="empty-icon">🔕</div>
        <div>No active notifications</div>
      </div>
    `;
  }

  private renderNotification(notification: NotificationDisplay) {
    const iconMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };

    const classes = classMap({
      'notification-item': true,
      [notification.type]: true,
      'visible': notification.isVisible,
      'closing': notification.isClosing,
    });

    return html`
      <div class="${classes}" data-notification-id="${notification.id}">
        <div class="notification-header">
          <div class="notification-icon ${notification.type}">
            ${iconMap[notification.type]}
          </div>
          <div class="notification-content">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
          </div>
          <div class="notification-controls">
            ${notification.sessionId ? html`
              <button 
                class="control-button"
                @click=${() => this.navigateToSession(notification.sessionId!)}
                title="Go to session"
              >
                🔗
              </button>
            ` : ''}
            <button 
              class="control-button"
              @click=${() => this.toggleDetails(notification.id)}
              title="Toggle details"
            >
              ${notification.showDetails ? '📄' : '📋'}
            </button>
            <button 
              class="control-button"
              @click=${() => this.dismissNotification(notification.id)}
              title="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>

        ${this.config.showTimestamps ? html`
          <div class="notification-timestamp">
            ${this.formatTimestamp(notification.timestamp)}
          </div>
        ` : ''}

        ${notification.showDetails && this.hasDetails(notification) ? html`
          <div class="notification-details">
            <div><strong>ID:</strong> ${notification.id}</div>
            ${notification.sessionId ? html`<div><strong>Session:</strong> ${notification.sessionId}</div>` : ''}
            <div><strong>Time:</strong> ${notification.timestamp.toLocaleString()}</div>
            ${notification.persistent ? html`<div><strong>Persistent:</strong> Yes</div>` : ''}
          </div>
        ` : ''}

        ${notification.actions && notification.actions.length > 0 ? html`
          <div class="notification-actions">
            ${notification.actions.map(action => html`
              <button 
                class="action-button ${action.primary ? 'primary' : ''}"
                @click=${() => this.handleAction(notification.id, action)}
              >
                ${action.label}
              </button>
            `)}
          </div>
        ` : ''}

        ${!notification.persistent && this.config.autoCloseDelay ? html`
          <div 
            class="notification-progress" 
            style="width: ${this.getProgressWidth(notification)}%"
          ></div>
        ` : ''}
      </div>
    `;
  }

  private hasDetails(notification: NotificationDisplay): boolean {
    return !!(notification.sessionId || notification.persistent);
  }

  private getProgressWidth(notification: NotificationDisplay): number {
    if (!notification.autoCloseTimeout || notification.persistent) return 0;
    
    // This is a simplified calculation - in a real implementation you'd track the actual progress
    return 100;
  }

  private formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return timestamp.toLocaleDateString();
  }

  private toggleDetails(notificationId: string) {
    this.notifications = this.notifications.map(n => 
      n.id === notificationId 
        ? { ...n, showDetails: !n.showDetails }
        : n
    );
  }

  private navigateToSession(sessionId: string) {
    this.dispatchEvent(new CustomEvent('navigate-to-session', {
      detail: { sessionId },
      bubbles: true,
    }));
  }

  private handleAction(notificationId: string, action: NotificationAction) {
    this.dispatchEvent(new CustomEvent('notification-action', {
      detail: { 
        notificationId, 
        action: action.action,
        actionLabel: action.label 
      },
      bubbles: true,
    }));

    // Dismiss notification after action if not persistent
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.persistent) {
      this.dismissNotification(notificationId);
    }
  }

  private dismissNotification(id: string) {
    const notification = this.notifications.find(n => n.id === id);
    if (!notification) return;

    // Clear auto-close timeout
    if (notification.autoCloseTimeout) {
      clearTimeout(notification.autoCloseTimeout);
    }

    // Start closing animation
    notification.isClosing = true;
    this.requestUpdate();

    // Remove from DOM after animation
    setTimeout(() => {
      this.notifications = this.notifications.filter(n => n.id !== id);
      this.requestUpdate();
    }, this.config.enableAnimations ? 300 : 0);

    // Add to history
    if (this.config.enableHistory) {
      this.addToHistory(notification);
    }

    // Emit dismiss event
    this.dispatchEvent(new CustomEvent('notification-dismissed', {
      detail: { notificationId: id },
      bubbles: true,
    }));
  }

  private dismissAll() {
    this.notifications.forEach(notification => {
      if (notification.autoCloseTimeout) {
        clearTimeout(notification.autoCloseTimeout);
      }
    });

    this.notifications = this.notifications.map(n => ({ ...n, isClosing: true }));
    this.requestUpdate();

    setTimeout(() => {
      // Add all to history
      if (this.config.enableHistory) {
        this.notifications.forEach(n => this.addToHistory(n));
      }

      this.notifications = [];
      this.requestUpdate();
    }, this.config.enableAnimations ? 300 : 0);

    this.dispatchEvent(new CustomEvent('notifications-dismissed-all', {
      bubbles: true,
    }));
  }

  private addToHistory(notification: NotificationDisplay) {
    this.notificationHistory.unshift({
      ...notification,
      isVisible: false,
      isClosing: false,
    });

    // Trim history to max size
    if (this.config.maxHistorySize && this.notificationHistory.length > this.config.maxHistorySize) {
      this.notificationHistory = this.notificationHistory.slice(0, this.config.maxHistorySize);
    }
  }

  private showHistory() {
    this.dispatchEvent(new CustomEvent('show-notification-history', {
      detail: { history: this.notificationHistory },
      bubbles: true,
    }));
  }

  // Public API

  /**
   * Add a new notification
   */
  addNotification(notification: NotificationData) {
    // Remove excess notifications if at limit
    if (this.config.maxNotifications && this.notifications.filter(n => n.isVisible).length >= this.config.maxNotifications) {
      const oldestVisible = this.notifications.find(n => n.isVisible && !n.persistent);
      if (oldestVisible) {
        this.dismissNotification(oldestVisible.id);
      }
    }

    const displayNotification: NotificationDisplay = {
      ...notification,
      isVisible: false,
      isClosing: false,
      showDetails: false,
    };

    // Setup auto-close for non-persistent notifications
    if (!notification.persistent && this.config.autoCloseDelay) {
      displayNotification.autoCloseTimeout = setTimeout(() => {
        this.dismissNotification(notification.id);
      }, this.config.autoCloseDelay);
    }

    this.notifications.push(displayNotification);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      displayNotification.isVisible = true;
      this.requestUpdate();
    });

    // Play sound if enabled
    if (this.config.enableSounds) {
      this.playNotificationSound(notification.type);
    }

    // Emit add event
    this.dispatchEvent(new CustomEvent('notification-added', {
      detail: { notification },
      bubbles: true,
    }));
  }

  /**
   * Remove a notification by ID
   */
  removeNotification(id: string) {
    this.dismissNotification(id);
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications() {
    this.dismissAll();
  }

  /**
   * Update an existing notification
   */
  updateNotification(id: string, updates: Partial<NotificationData>) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      Object.assign(notification, updates);
      this.requestUpdate();
    }
  }

  /**
   * Get all active notifications
   */
  getActiveNotifications(): NotificationDisplay[] {
    return this.notifications.filter(n => n.isVisible && !n.isClosing);
  }

  /**
   * Get notification history
   */
  getNotificationHistory(): NotificationDisplay[] {
    return [...this.notificationHistory];
  }

  /**
   * Toggle header visibility
   */
  toggleHeader(show?: boolean) {
    this.showHeader = show ?? !this.showHeader;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NotificationManagerConfig>) {
    this.config = { ...this.config, ...config };
    if (config.position) {
      this.className = config.position;
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(type: NotificationData['type']) {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      const frequencies = {
        info: 800,
        success: 1000,
        warning: 600,
        error: 400,
      };

      oscillator.frequency.value = frequencies[type];
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.3);
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notification-manager': NotificationManager;
  }
}