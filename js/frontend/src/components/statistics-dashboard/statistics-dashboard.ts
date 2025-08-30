import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import type { ConnectionStatistics } from "../../utils/websocket/connection-state.js";

export interface StatisticItem {
  id: string;
  label: string;
  value: string | number;
  icon: string;
  type: 'primary' | 'secondary' | 'success' | 'warning' | 'info';
  description?: string;
}

@customElement("statistics-dashboard")
export class StatisticsDashboard extends BaseComponent {
  @property({ type: Number })
  userCount = 0;

  @property({ type: Number })
  logEntryCount = 0;

  @property({ type: Boolean })
  isDarkMode = false;

  @property({ type: Object })
  connectionStats: ConnectionStatistics = {
    uptime: 0,
    reconnectionCount: 0,
    lastConnectTime: null,
    lastDisconnectTime: null,
    averageLatency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    totalDataSent: 0,
    totalDataReceived: 0,
    connectionQuality: "unknown",
  };

  override connectedCallback() {
    super.connectedCallback();
    this.loadThemePreference();
  }

  private loadThemePreference() {
    const savedTheme = localStorage.getItem('theme-preference');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      // Default to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.isDarkMode = prefersDark;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  }

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        margin-bottom: var(--spacing-xl);
      }

      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-lg);
      }

      .dashboard-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-header);
        margin: 0;
      }

      .dashboard-timestamp {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        font-family: var(--font-family-mono);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--spacing-lg);
        margin-bottom: var(--spacing-lg);
      }

      .stat-card {
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-lg);
        text-align: center;
        transition: all var(--transition-medium);
        border: 1px solid var(--color-border-light);
        box-shadow: var(--shadow-neumorphic);
        position: relative;
        overflow: hidden;
      }

      .stat-card.clickable {
        cursor: pointer;
      }

      .stat-card.clickable:hover {
        transform: var(--transform-hover) scale(1.02);
      }

      .stat-card.clickable:active {
        transform: scale(0.98);
      }

      .stat-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, var(--accent-color, var(--color-primary)), transparent);
        opacity: 0.7;
      }

      .stat-card:hover {
        transform: var(--transform-hover);
        box-shadow: var(--shadow-neumorphic-hover);
        background: var(--color-surface-hover);
      }

      .stat-card.primary {
        --accent-color: var(--color-primary);
      }

      .stat-card.secondary {
        --accent-color: var(--color-secondary);
      }

      .stat-card.success {
        --accent-color: var(--color-message-tool-result);
      }

      .stat-card.warning {
        --accent-color: var(--color-message-system);
      }

      .stat-card.info {
        --accent-color: var(--color-message-user);
      }

      .stat-icon {
        font-size: 2em;
        margin-bottom: var(--spacing-sm);
        opacity: 0.8;
      }

      .stat-value {
        font-size: var(--font-size-xxl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text);
        margin-bottom: var(--spacing-xs);
        line-height: var(--line-height-tight);
      }

      .stat-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        font-weight: var(--font-weight-medium);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .stat-description {
        font-size: var(--font-size-xs);
        color: var(--color-text-light);
        margin-top: var(--spacing-xs);
        font-style: italic;
      }

      /* Connection Quality Indicator */
      .connection-quality {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-xs);
        font-size: var(--font-size-sm);
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--border-radius-md);
        background: var(--quality-bg, var(--color-surface));
        color: var(--quality-color, var(--color-text));
        border: 1px solid var(--quality-border, var(--color-border-medium));
      }

      .connection-quality.excellent {
        --quality-bg: var(--color-message-tool-result-bg);
        --quality-color: var(--color-message-tool-result);
        --quality-border: var(--color-message-tool-result);
      }

      .connection-quality.good {
        --quality-bg: var(--color-message-system-info-bg);
        --quality-color: var(--color-message-system-info);
        --quality-border: var(--color-message-system-info);
      }

      .connection-quality.poor {
        --quality-bg: var(--color-message-system-warning-bg);
        --quality-color: var(--color-message-system-warning);
        --quality-border: var(--color-message-system-warning);
      }

      .connection-quality.unknown {
        --quality-bg: var(--color-surface-disabled);
        --quality-color: var(--color-text-muted);
        --quality-border: var(--color-border-medium);
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .stats-grid {
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: var(--spacing-md);
        }

        .stat-card {
          padding: var(--spacing-md);
        }

        .dashboard-header {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-sm);
        }

        .stat-icon {
          font-size: 1.5em;
        }

        .stat-value {
          font-size: var(--font-size-xl);
        }
      }

      @media (max-width: 480px) {
        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      /* Animation for value changes */
      .stat-value.updated {
        animation: pulse 0.5s ease-in-out;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      /* Focus styles for accessibility */
      .stat-card:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
    `,
  ];

  private getStatistics(): StatisticItem[] {
    return [
      {
        id: 'users',
        label: 'Active Users',
        value: this.userCount,
        icon: '👥',
        type: 'primary',
        description: 'Currently active user sessions'
      },
      {
        id: 'entries',
        label: 'Log Entries',
        value: this.logEntryCount,
        icon: '📝',
        type: 'info',
        description: 'Total conversation messages'
      },
      {
        id: 'theme',
        label: 'Theme Mode',
        value: this.isDarkMode ? 'Dark' : 'Light',
        icon: this.isDarkMode ? '🌙' : '☀️',
        type: 'secondary',
        description: 'Current interface theme'
      },
      {
        id: 'messages-sent',
        label: 'Sent',
        value: this.connectionStats.messagesSent,
        icon: '📤',
        type: 'success',
        description: 'WebSocket messages sent'
      },
      {
        id: 'messages-received',
        label: 'Received',
        value: this.connectionStats.messagesReceived,
        icon: '📥',
        type: 'success',
        description: 'WebSocket messages received'
      },
      {
        id: 'reconnections',
        label: 'Reconnects',
        value: this.connectionStats.reconnectionCount,
        icon: '🔄',
        type: 'warning',
        description: 'Connection reconnection attempts'
      }
    ];
  }

  private formatQuality(quality: string): { text: string; class: string } {
    switch (quality) {
      case 'excellent':
        return { text: '🟢 Excellent', class: 'excellent' };
      case 'good':
        return { text: '🟡 Good', class: 'good' };
      case 'poor':
        return { text: '🟠 Poor', class: 'poor' };
      default:
        return { text: '⚪ Unknown', class: 'unknown' };
    }
  }

  protected safeRender() {
    const stats = this.getStatistics();
    const quality = this.formatQuality(this.connectionStats.connectionQuality);

    return html`
      <div class="card-base">
        <div class="dashboard-header">
          <h2 class="dashboard-title">Application Statistics</h2>
          <div class="dashboard-timestamp">
            ${new Date().toLocaleString()}
          </div>
        </div>

        <div class="stats-grid">
          ${stats.map(stat => html`
            <div 
              class="stat-card ${stat.type} ${stat.id === 'theme' ? 'clickable' : ''}" 
              tabindex="0"
              role="${stat.id === 'theme' ? 'button' : 'article'}"
              aria-label="${stat.label}: ${stat.value}${stat.description ? `. ${stat.description}` : ''}${stat.id === 'theme' ? '. Click to toggle theme.' : ''}"
              @click=${() => this.handleStatCardClick(stat)}
              @keydown=${(e: KeyboardEvent) => {
                if (stat.id === 'theme' && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  this.handleStatCardClick(stat);
                }
              }}
            >
              <div class="stat-icon" aria-hidden="true">${stat.icon}</div>
              <div class="stat-value" id="stat-${stat.id}">${stat.value}</div>
              <div class="stat-label">${stat.label}</div>
              ${stat.description ? html`
                <div class="stat-description">${stat.description}</div>
              ` : ''}
            </div>
          `)}
        </div>

        <!-- Connection Quality Indicator -->
        ${this.connectionStats.connectionQuality !== 'unknown' ? html`
          <div style="text-align: center; margin-top: var(--spacing-md);">
            <span class="connection-quality ${quality.class}">
              ${quality.text} Connection Quality
            </span>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Method to update stat values with animation
  updateStatValue(statId: string, newValue: string | number) {
    const element = this.shadowRoot?.querySelector(`#stat-${statId}`);
    if (element) {
      element.classList.add('updated');
      element.textContent = newValue.toString();
      setTimeout(() => element.classList.remove('updated'), 500);
    }
  }

  private handleStatCardClick(stat: StatisticItem) {
    if (stat.id === 'theme') {
      this.toggleTheme();
    }
  }

  private toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    
    // Apply theme to document root
    document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
    
    // Save theme preference to localStorage
    localStorage.setItem('theme-preference', this.isDarkMode ? 'dark' : 'light');
    
    // Emit theme change event
    this.emitEvent('theme-changed', { 
      theme: this.isDarkMode ? 'dark' : 'light',
      isDarkMode: this.isDarkMode 
    });
    
    // Update the stat card with animation
    this.updateStatValue('theme', this.isDarkMode ? 'Dark' : 'Light');
  }
}

// Component is registered via @customElement decorator