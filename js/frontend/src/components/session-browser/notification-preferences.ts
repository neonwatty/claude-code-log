import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { NotificationPreferences } from '../../services/session-browser-websocket';
import { baseStyles } from '../styles/theme';

export interface NotificationPreferencesConfig {
  showAdvancedOptions?: boolean;
  allowSoundControl?: boolean;
  allowBrowserNotifications?: boolean;
  allowEmailNotifications?: boolean;
  enableSessionFiltering?: boolean;
  enableKeywordFiltering?: boolean;
  showTestNotifications?: boolean;
}

/**
 * Notification preferences management component
 * Provides a UI for users to customize their real-time notification settings
 */
@customElement('notification-preferences')
export class NotificationPreferencesComponent extends LitElement {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-lg);
        max-width: 600px;
      }

      .preferences-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-lg);
      }

      .preferences-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .preferences-icon {
        font-size: var(--font-size-lg);
      }

      .preferences-actions {
        display: flex;
        gap: var(--space-sm);
      }

      .action-button {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
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

      .preferences-section {
        margin-bottom: var(--space-lg);
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-md);
        padding-bottom: var(--space-sm);
        border-bottom: 1px solid var(--color-border);
      }

      .section-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .section-subtitle {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: 0;
        font-style: italic;
      }

      .section-toggle {
        position: relative;
        display: inline-flex;
        align-items: center;
        cursor: pointer;
      }

      .toggle-switch {
        width: 44px;
        height: 24px;
        background: var(--color-background-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        position: relative;
        transition: all var(--transition-fast);
        margin-right: var(--space-sm);
      }

      .toggle-switch.active {
        background: var(--color-primary);
        border-color: var(--color-primary);
      }

      .toggle-knob {
        width: 18px;
        height: 18px;
        background: white;
        border-radius: 9px;
        position: absolute;
        top: 2px;
        left: 2px;
        transition: transform var(--transition-fast);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .toggle-switch.active .toggle-knob {
        transform: translateX(20px);
      }

      .toggle-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        user-select: none;
      }

      .preferences-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--space-lg);
      }

      .preference-group {
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        padding: var(--space-md);
      }

      .preference-item {
        display: flex;
        align-items: flex-start;
        gap: var(--space-md);
        padding: var(--space-sm) 0;
        border-bottom: 1px solid var(--color-border);
      }

      .preference-item:last-child {
        border-bottom: none;
      }

      .preference-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-background);
        border-radius: var(--border-radius-sm);
        font-size: var(--font-size-sm);
        flex-shrink: 0;
        margin-top: 2px;
      }

      .preference-content {
        flex: 1;
        min-width: 0;
      }

      .preference-title {
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-xs) 0;
        font-size: var(--font-size-base);
      }

      .preference-description {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        line-height: 1.4;
        margin: 0;
      }

      .preference-control {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .checkbox-input {
        width: 18px;
        height: 18px;
        border: 2px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        background: var(--color-background);
        cursor: pointer;
        position: relative;
        transition: all var(--transition-fast);
      }

      .checkbox-input:checked {
        background: var(--color-primary);
        border-color: var(--color-primary);
      }

      .checkbox-input:checked::after {
        content: '✓';
        position: absolute;
        top: -2px;
        left: 2px;
        color: white;
        font-size: 14px;
        font-weight: bold;
      }

      .filter-section {
        margin-top: var(--space-md);
        padding: var(--space-md);
        background: var(--color-background);
        border-radius: var(--border-radius);
        border: 1px solid var(--color-border);
      }

      .filter-header {
        display: flex;
        align-items: center;
        justify-content: between;
        margin-bottom: var(--space-md);
      }

      .filter-title {
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0;
      }

      .filter-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--space-md);
      }

      .filter-input {
        width: 100%;
        padding: var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        background: var(--color-background);
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
      }

      .filter-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
      }

      .tag-input {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
        padding: var(--space-xs);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-sm);
        background: var(--color-background);
        min-height: 38px;
      }

      .tag-item {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        padding: var(--space-xs) var(--space-sm);
        background: var(--color-primary);
        color: white;
        border-radius: var(--border-radius-full);
        font-size: var(--font-size-xs);
      }

      .tag-remove {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
      }

      .tag-remove:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .tag-input-field {
        border: none;
        outline: none;
        background: transparent;
        color: var(--color-text-primary);
        flex: 1;
        min-width: 100px;
        font-size: var(--font-size-sm);
      }

      .test-section {
        background: var(--color-info-light);
        border: 1px solid var(--color-info);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        margin-top: var(--space-lg);
      }

      .test-header {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-bottom: var(--space-md);
      }

      .test-title {
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0;
      }

      .test-buttons {
        display: flex;
        gap: var(--space-sm);
        flex-wrap: wrap;
      }

      .test-button {
        background: var(--color-info);
        color: white;
        border: none;
        border-radius: var(--border-radius-sm);
        padding: var(--space-sm) var(--space-md);
        cursor: pointer;
        font-size: var(--font-size-sm);
        transition: background-color var(--transition-fast);
      }

      .test-button:hover {
        background: var(--color-info-dark);
      }

      .permission-warning {
        background: var(--color-warning-light);
        border: 1px solid var(--color-warning);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        margin-top: var(--space-md);
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .warning-icon {
        color: var(--color-warning);
        font-size: var(--font-size-lg);
      }

      .warning-text {
        flex: 1;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .permission-button {
        background: var(--color-warning);
        color: white;
        border: none;
        border-radius: var(--border-radius-sm);
        padding: var(--space-xs) var(--space-sm);
        cursor: pointer;
        font-size: var(--font-size-xs);
      }

      @media (max-width: 768px) {
        .preferences-grid {
          grid-template-columns: 1fr;
        }

        .filter-grid {
          grid-template-columns: 1fr;
        }

        .test-buttons {
          justify-content: center;
        }
      }

      /* Dark mode adjustments */
      @media (prefers-color-scheme: dark) {
        .toggle-knob {
          background: var(--color-background);
        }
        
        .checkbox-input {
          background: var(--color-background-secondary);
        }
      }
    `,
  ];

  @property({ type: Object })
  preferences: NotificationPreferences = {
    newSessions: true,
    sessionUpdates: true,
    newMessages: true,
    sessionStateChanges: true,
    soundEnabled: false,
    browserNotifications: true,
    emailNotifications: false,
    filters: {
      sessionIds: [],
      messageTypes: [],
      keywords: [],
      excludeOwnMessages: true,
    },
  };

  @property({ type: Object })
  config: NotificationPreferencesConfig = {
    showAdvancedOptions: true,
    allowSoundControl: true,
    allowBrowserNotifications: true,
    allowEmailNotifications: false,
    enableSessionFiltering: true,
    enableKeywordFiltering: true,
    showTestNotifications: true,
  };

  @state()
  private newKeyword = '';

  @state()
  private newSessionId = '';

  @state()
  private browserPermission: NotificationPermission = 'default';

  connectedCallback() {
    super.connectedCallback();
    this.checkBrowserPermission();
  }

  render() {
    return html`
      <div class="preferences-header">
        <h2 class="preferences-title">
          <span class="preferences-icon">🔔</span>
          Notification Preferences
        </h2>
        <div class="preferences-actions">
          <button class="action-button" @click=${this.resetToDefaults}>
            🔄 Reset
          </button>
          <button class="action-button primary" @click=${this.savePreferences}>
            💾 Save
          </button>
        </div>
      </div>

      <div class="preferences-grid">
        ${this.renderNotificationTypes()}
        ${this.renderDeliveryMethods()}
      </div>

      ${this.config.enableSessionFiltering || this.config.enableKeywordFiltering 
        ? this.renderFilters() 
        : ''}

      ${this.config.showTestNotifications ? this.renderTestSection() : ''}

      ${this.renderBrowserPermissionWarning()}
    `;
  }

  private renderNotificationTypes() {
    return html`
      <div class="preference-group">
        <div class="section-header">
          <h3 class="section-title">
            📢 Event Types
          </h3>
        </div>

        <div class="preference-item">
          <div class="preference-icon">🆕</div>
          <div class="preference-content">
            <div class="preference-title">New Sessions</div>
            <p class="preference-description">
              Get notified when new Claude Code sessions are created
            </p>
          </div>
          <div class="preference-control">
            <input
              type="checkbox"
              class="checkbox-input"
              .checked=${this.preferences.newSessions}
              @change=${(e: Event) => this.updatePreference('newSessions', (e.target as HTMLInputElement).checked)}
            />
          </div>
        </div>

        <div class="preference-item">
          <div class="preference-icon">📝</div>
          <div class="preference-content">
            <div class="preference-title">Session Updates</div>
            <p class="preference-description">
              Receive notifications when active sessions are updated or modified
            </p>
          </div>
          <div class="preference-control">
            <input
              type="checkbox"
              class="checkbox-input"
              .checked=${this.preferences.sessionUpdates}
              @change=${(e: Event) => this.updatePreference('sessionUpdates', (e.target as HTMLInputElement).checked)}
            />
          </div>
        </div>

        <div class="preference-item">
          <div class="preference-icon">💬</div>
          <div class="preference-content">
            <div class="preference-title">New Messages</div>
            <p class="preference-description">
              Get real-time notifications for new messages in monitored sessions
            </p>
          </div>
          <div class="preference-control">
            <input
              type="checkbox"
              class="checkbox-input"
              .checked=${this.preferences.newMessages}
              @change=${(e: Event) => this.updatePreference('newMessages', (e.target as HTMLInputElement).checked)}
            />
          </div>
        </div>

        <div class="preference-item">
          <div class="preference-icon">⚡</div>
          <div class="preference-content">
            <div class="preference-title">State Changes</div>
            <p class="preference-description">
              Monitor session status changes like active, idle, or error states
            </p>
          </div>
          <div class="preference-control">
            <input
              type="checkbox"
              class="checkbox-input"
              .checked=${this.preferences.sessionStateChanges}
              @change=${(e: Event) => this.updatePreference('sessionStateChanges', (e.target as HTMLInputElement).checked)}
            />
          </div>
        </div>
      </div>
    `;
  }

  private renderDeliveryMethods() {
    return html`
      <div class="preference-group">
        <div class="section-header">
          <h3 class="section-title">
            🚀 Delivery Methods
          </h3>
        </div>

        ${this.config.allowSoundControl ? html`
          <div class="preference-item">
            <div class="preference-icon">🔊</div>
            <div class="preference-content">
              <div class="preference-title">Sound Notifications</div>
              <p class="preference-description">
                Play audio alerts for different types of notifications
              </p>
            </div>
            <div class="preference-control">
              <input
                type="checkbox"
                class="checkbox-input"
                .checked=${this.preferences.soundEnabled}
                @change=${(e: Event) => this.updatePreference('soundEnabled', (e.target as HTMLInputElement).checked)}
              />
            </div>
          </div>
        ` : ''}

        ${this.config.allowBrowserNotifications ? html`
          <div class="preference-item">
            <div class="preference-icon">🌐</div>
            <div class="preference-content">
              <div class="preference-title">Browser Notifications</div>
              <p class="preference-description">
                Show native browser notifications even when tab is not active
              </p>
            </div>
            <div class="preference-control">
              <input
                type="checkbox"
                class="checkbox-input"
                .checked=${this.preferences.browserNotifications}
                .disabled=${this.browserPermission === 'denied'}
                @change=${(e: Event) => this.updatePreference('browserNotifications', (e.target as HTMLInputElement).checked)}
              />
            </div>
          </div>
        ` : ''}

        ${this.config.allowEmailNotifications ? html`
          <div class="preference-item">
            <div class="preference-icon">📧</div>
            <div class="preference-content">
              <div class="preference-title">Email Notifications</div>
              <p class="preference-description">
                Send notification summaries via email (requires account setup)
              </p>
            </div>
            <div class="preference-control">
              <input
                type="checkbox"
                class="checkbox-input"
                .checked=${this.preferences.emailNotifications}
                @change=${(e: Event) => this.updatePreference('emailNotifications', (e.target as HTMLInputElement).checked)}
              />
            </div>
          </div>
        ` : ''}

        <div class="preference-item">
          <div class="preference-icon">🚫</div>
          <div class="preference-content">
            <div class="preference-title">Exclude Own Messages</div>
            <p class="preference-description">
              Don't send notifications for messages you send yourself
            </p>
          </div>
          <div class="preference-control">
            <input
              type="checkbox"
              class="checkbox-input"
              .checked=${this.preferences.filters?.excludeOwnMessages ?? true}
              @change=${(e: Event) => this.updateFilterPreference('excludeOwnMessages', (e.target as HTMLInputElement).checked)}
            />
          </div>
        </div>
      </div>
    `;
  }

  private renderFilters() {
    return html`
      <div class="filter-section">
        <div class="filter-header">
          <h3 class="filter-title">🎯 Notification Filters</h3>
        </div>

        ${this.config.enableSessionFiltering ? html`
          <div style="margin-bottom: var(--space-md);">
            <label>
              <strong>Session IDs:</strong> Only notify for specific sessions (leave empty for all)
            </label>
            <div class="tag-input">
              ${(this.preferences.filters?.sessionIds || []).map(sessionId => html`
                <div class="tag-item">
                  ${sessionId.substring(0, 8)}
                  <button 
                    class="tag-remove"
                    @click=${() => this.removeSessionIdFilter(sessionId)}
                  >×</button>
                </div>
              `)}
              <input
                class="tag-input-field"
                type="text"
                placeholder="Add session ID..."
                .value=${this.newSessionId}
                @input=${(e: Event) => this.newSessionId = (e.target as HTMLInputElement).value}
                @keydown=${this.handleSessionIdKeydown}
              />
            </div>
          </div>
        ` : ''}

        <div class="filter-grid">
          <div>
            <label><strong>Message Types:</strong></label>
            <select 
              class="filter-input" 
              multiple 
              @change=${this.handleMessageTypeChange}
            >
              <option value="user" .selected=${this.preferences.filters?.messageTypes?.includes('user')}>User Messages</option>
              <option value="assistant" .selected=${this.preferences.filters?.messageTypes?.includes('assistant')}>Assistant Messages</option>
              <option value="system" .selected=${this.preferences.filters?.messageTypes?.includes('system')}>System Messages</option>
              <option value="error" .selected=${this.preferences.filters?.messageTypes?.includes('error')}>Error Messages</option>
            </select>
          </div>
        </div>

        ${this.config.enableKeywordFiltering ? html`
          <div style="margin-top: var(--space-md);">
            <label>
              <strong>Keywords:</strong> Only notify for messages containing these words
            </label>
            <div class="tag-input">
              ${(this.preferences.filters?.keywords || []).map(keyword => html`
                <div class="tag-item">
                  ${keyword}
                  <button 
                    class="tag-remove"
                    @click=${() => this.removeKeywordFilter(keyword)}
                  >×</button>
                </div>
              `)}
              <input
                class="tag-input-field"
                type="text"
                placeholder="Add keyword..."
                .value=${this.newKeyword}
                @input=${(e: Event) => this.newKeyword = (e.target as HTMLInputElement).value}
                @keydown=${this.handleKeywordKeydown}
              />
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderTestSection() {
    return html`
      <div class="test-section">
        <div class="test-header">
          <span>🧪</span>
          <h3 class="test-title">Test Notifications</h3>
        </div>
        <div class="test-buttons">
          <button class="test-button" @click=${() => this.testNotification('info')}>
            Test Info
          </button>
          <button class="test-button" @click=${() => this.testNotification('success')}>
            Test Success
          </button>
          <button class="test-button" @click=${() => this.testNotification('warning')}>
            Test Warning
          </button>
          <button class="test-button" @click=${() => this.testNotification('error')}>
            Test Error
          </button>
        </div>
      </div>
    `;
  }

  private renderBrowserPermissionWarning() {
    if (!this.config.allowBrowserNotifications || this.browserPermission === 'granted') {
      return '';
    }

    return html`
      <div class="permission-warning">
        <span class="warning-icon">⚠️</span>
        <div class="warning-text">
          ${this.browserPermission === 'denied' 
            ? 'Browser notifications are blocked. Please enable them in your browser settings.'
            : 'Browser notifications require permission to show notifications outside of this tab.'}
        </div>
        ${this.browserPermission === 'default' ? html`
          <button class="permission-button" @click=${this.requestPermission}>
            Grant Permission
          </button>
        ` : ''}
      </div>
    `;
  }

  private updatePreference(key: keyof NotificationPreferences, value: any) {
    this.preferences = { ...this.preferences, [key]: value };
    this.emitChange();
  }

  private updateFilterPreference(key: string, value: any) {
    const filters = { ...this.preferences.filters };
    (filters as any)[key] = value;
    this.preferences = { ...this.preferences, filters };
    this.emitChange();
  }

  private handleMessageTypeChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const selectedTypes = Array.from(select.selectedOptions).map(option => option.value);
    this.updateFilterPreference('messageTypes', selectedTypes);
  }

  private handleKeywordKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && this.newKeyword.trim()) {
      this.addKeywordFilter(this.newKeyword.trim());
      this.newKeyword = '';
    }
  }

  private handleSessionIdKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && this.newSessionId.trim()) {
      this.addSessionIdFilter(this.newSessionId.trim());
      this.newSessionId = '';
    }
  }

  private addKeywordFilter(keyword: string) {
    const keywords = [...(this.preferences.filters?.keywords || [])];
    if (!keywords.includes(keyword)) {
      keywords.push(keyword);
      this.updateFilterPreference('keywords', keywords);
    }
  }

  private removeKeywordFilter(keyword: string) {
    const keywords = (this.preferences.filters?.keywords || []).filter(k => k !== keyword);
    this.updateFilterPreference('keywords', keywords);
  }

  private addSessionIdFilter(sessionId: string) {
    const sessionIds = [...(this.preferences.filters?.sessionIds || [])];
    if (!sessionIds.includes(sessionId)) {
      sessionIds.push(sessionId);
      this.updateFilterPreference('sessionIds', sessionIds);
    }
  }

  private removeSessionIdFilter(sessionId: string) {
    const sessionIds = (this.preferences.filters?.sessionIds || []).filter(id => id !== sessionId);
    this.updateFilterPreference('sessionIds', sessionIds);
  }

  private async checkBrowserPermission() {
    if ('Notification' in window) {
      this.browserPermission = Notification.permission;
    }
  }

  private async requestPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      this.browserPermission = permission;
      
      if (permission === 'granted' && !this.preferences.browserNotifications) {
        this.updatePreference('browserNotifications', true);
      }
    }
  }

  private testNotification(type: 'info' | 'success' | 'warning' | 'error') {
    const messages = {
      info: 'This is a test info notification',
      success: 'Test successful! Notifications are working',
      warning: 'This is a test warning notification',
      error: 'This is a test error notification',
    };

    const titles = {
      info: 'Test Info Notification',
      success: 'Test Success Notification', 
      warning: 'Test Warning Notification',
      error: 'Test Error Notification',
    };

    // Emit test notification event
    this.dispatchEvent(new CustomEvent('test-notification', {
      detail: {
        id: `test-${Date.now()}`,
        type,
        title: titles[type],
        message: messages[type],
        timestamp: new Date(),
      },
      bubbles: true,
    }));

    // Show browser notification if enabled
    if (this.preferences.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(titles[type], {
        body: messages[type],
        icon: '/favicon.ico',
      });
    }
  }

  private resetToDefaults() {
    this.preferences = {
      newSessions: true,
      sessionUpdates: true,
      newMessages: true,
      sessionStateChanges: true,
      soundEnabled: false,
      browserNotifications: true,
      emailNotifications: false,
      filters: {
        sessionIds: [],
        messageTypes: [],
        keywords: [],
        excludeOwnMessages: true,
      },
    };
    this.emitChange();
  }

  private savePreferences() {
    this.dispatchEvent(new CustomEvent('preferences-save', {
      detail: { preferences: this.preferences },
      bubbles: true,
    }));
  }

  private emitChange() {
    this.dispatchEvent(new CustomEvent('preferences-changed', {
      detail: { preferences: this.preferences },
      bubbles: true,
    }));
  }

  // Public API

  /**
   * Update preferences programmatically
   */
  updatePreferences(preferences: Partial<NotificationPreferences>) {
    this.preferences = { ...this.preferences, ...preferences };
  }

  /**
   * Get current preferences
   */
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Check if a notification should be sent based on current preferences
   */
  shouldNotify(type: keyof NotificationPreferences, data?: any): boolean {
    const typeEnabled = this.preferences[type] as boolean;
    if (!typeEnabled) return false;

    // Apply filters if provided
    if (data && this.preferences.filters) {
      const { filters } = this.preferences;

      // Session ID filter
      if (filters.sessionIds && filters.sessionIds.length > 0 && data.sessionId) {
        if (!filters.sessionIds.includes(data.sessionId)) return false;
      }

      // Message type filter
      if (filters.messageTypes && filters.messageTypes.length > 0 && data.messageType) {
        if (!filters.messageTypes.includes(data.messageType)) return false;
      }

      // Keyword filter
      if (filters.keywords && filters.keywords.length > 0 && data.content) {
        const hasKeyword = filters.keywords.some(keyword => 
          data.content.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!hasKeyword) return false;
      }

      // Exclude own messages
      if (filters.excludeOwnMessages && data.userId === data.currentUserId) {
        return false;
      }
    }

    return true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notification-preferences': NotificationPreferencesComponent;
  }
}