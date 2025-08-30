import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import { User, LogEntry } from "@shared/types";
import type { ConnectionStatistics } from "../../utils/websocket/connection-state.js";
import "../statistics-dashboard/statistics-dashboard.js";

@customElement("dashboard-view")
export class DashboardView extends BaseComponent {
  @property({ type: Array })
  users: User[] = [];

  @property({ type: Array })
  logs: LogEntry[] = [];

  @property({ type: Object })
  connectionStats: ConnectionStatistics | null = null;

  @property({ type: Boolean, attribute: "is-dark-mode" })
  isDarkMode = false;

  @state()
  private recentSessions: any[] = [];

  @state()
  private quickStats = {
    totalSessions: 0,
    totalMessages: 0,
    totalTokens: 0,
    activeToday: 0
  };

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        padding: var(--spacing-md);
      }

      .dashboard-container {
        max-width: 1200px;
        margin: 0 auto;
      }

      .dashboard-header {
        text-align: center;
        margin-bottom: var(--spacing-xl);
      }

      .dashboard-title {
        font-size: 2.5em;
        font-weight: var(--font-weight-bold);
        color: var(--color-text-header);
        margin: 0 0 var(--spacing-sm) 0;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      .dashboard-subtitle {
        font-size: var(--font-size-lg);
        color: var(--color-text-muted);
        margin: 0;
      }

      .dashboard-sections {
        display: grid;
        gap: var(--spacing-xl);
      }

      .section {
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-lg);
        box-shadow: var(--shadow-neumorphic);
        border: 1px solid var(--color-border-light);
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-md);
      }

      .section-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0;
      }

      .section-icon {
        font-size: 1.2em;
      }

      .quick-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
      }

      .stat-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-md);
        text-align: center;
        box-shadow: var(--shadow-sm);
        transition: all var(--transition-fast);
      }

      .stat-card:hover {
        transform: var(--transform-hover);
        box-shadow: var(--shadow-md);
      }

      .stat-value {
        font-size: 2em;
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
        margin: 0;
      }

      .stat-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        margin: var(--spacing-xs) 0 0 0;
      }

      .recent-activity {
        max-height: 300px;
        overflow-y: auto;
      }

      .activity-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm);
        border-radius: var(--border-radius-sm);
        margin-bottom: var(--spacing-xs);
        transition: background-color var(--transition-fast);
      }

      .activity-item:hover {
        background: var(--color-surface-hover);
      }

      .activity-icon {
        font-size: 1.1em;
        width: 24px;
        text-align: center;
      }

      .activity-content {
        flex: 1;
      }

      .activity-title {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text);
        margin: 0;
      }

      .activity-time {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        margin: 0;
      }

      .empty-state {
        text-align: center;
        padding: var(--spacing-xl);
        color: var(--color-text-muted);
        font-style: italic;
      }

      .empty-state-icon {
        font-size: 3em;
        margin-bottom: var(--spacing-md);
        opacity: 0.5;
      }

      .action-buttons {
        display: flex;
        gap: var(--spacing-sm);
        justify-content: center;
        margin-top: var(--spacing-lg);
      }

      .action-button {
        padding: var(--spacing-sm) var(--spacing-lg);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        text-decoration: none;
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .action-button:hover {
        background: var(--color-surface-hover);
        transform: var(--transform-hover);
        box-shadow: var(--shadow-md);
      }

      .action-button.primary {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .action-button.primary:hover {
        background: var(--color-primary-hover);
        border-color: var(--color-primary-hover);
      }

      /* Responsive design */
      @media (max-width: 768px) {
        :host {
          padding: var(--spacing-sm);
        }

        .dashboard-title {
          font-size: 2em;
        }

        .quick-stats {
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-sm);
        }

        .action-buttons {
          flex-direction: column;
        }
      }

      @media (max-width: 480px) {
        .quick-stats {
          grid-template-columns: 1fr;
        }

        .stat-card {
          padding: var(--spacing-sm);
        }
      }
    `
  ];

  protected override willUpdate(): void {
    this.updateQuickStats();
    this.updateRecentActivity();
  }

  private updateQuickStats(): void {
    // Calculate stats from logs and sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLogs = this.logs.filter(log => 
      new Date(log.timestamp) >= today
    );

    this.quickStats = {
      totalSessions: new Set(this.logs.map(log => log.sessionId)).size,
      totalMessages: this.logs.length,
      totalTokens: 0, // Would need to calculate from actual token data
      activeToday: todayLogs.length
    };
  }

  private updateRecentActivity(): void {
    // Get recent logs for activity feed
    this.recentSessions = this.logs
      .slice(-10)
      .reverse()
      .map(log => ({
        id: log.id,
        title: log.message.length > 50 
          ? `${log.message.substring(0, 50)}...` 
          : log.message,
        time: log.timestamp,
        type: log.level || 'info',
        sessionId: log.sessionId
      }));
  }

  private handleViewSessions(): void {
    this.emitEvent('navigate-requested', { section: 'sessions' });
  }

  private handleViewAnalytics(): void {
    this.emitEvent('navigate-requested', { section: 'analytics' });
  }

  protected safeRender(): TemplateResult {
    return html`
      <div class="dashboard-container">
        <header class="dashboard-header">
          <h1 class="dashboard-title">Claude Code Log</h1>
          <p class="dashboard-subtitle">Session visualization and analysis dashboard</p>
        </header>

        <div class="dashboard-sections">
          <!-- Quick Stats -->
          <section class="section">
            <div class="section-header">
              <span class="section-icon">📊</span>
              <h2 class="section-title">Quick Stats</h2>
            </div>
            
            <div class="quick-stats">
              <div class="stat-card">
                <p class="stat-value">${this.quickStats.totalSessions}</p>
                <p class="stat-label">Total Sessions</p>
              </div>
              <div class="stat-card">
                <p class="stat-value">${this.quickStats.totalMessages}</p>
                <p class="stat-label">Total Messages</p>
              </div>
              <div class="stat-card">
                <p class="stat-value">${this.quickStats.activeToday}</p>
                <p class="stat-label">Active Today</p>
              </div>
              <div class="stat-card">
                <p class="stat-value">${this.users.length}</p>
                <p class="stat-label">Active Users</p>
              </div>
            </div>

            <div class="action-buttons">
              <button 
                class="action-button primary"
                @click=${this.handleViewSessions}
              >
                <span>💬</span>
                View Sessions
              </button>
              <button 
                class="action-button"
                @click=${this.handleViewAnalytics}
              >
                <span>📈</span>
                View Analytics
              </button>
            </div>
          </section>

          <!-- Application Statistics -->
          <section class="section">
            <div class="section-header">
              <span class="section-icon">⚡</span>
              <h2 class="section-title">System Status</h2>
            </div>
            
            <statistics-dashboard
              .userCount=${this.users.length}
              .logEntryCount=${this.logs.length}
              .isDarkMode=${this.isDarkMode}
              .connectionStats=${this.connectionStats}
            ></statistics-dashboard>
          </section>

          <!-- Recent Activity -->
          <section class="section">
            <div class="section-header">
              <span class="section-icon">🔥</span>
              <h2 class="section-title">Recent Activity</h2>
            </div>
            
            <div class="recent-activity">
              ${this.recentSessions.length > 0 
                ? this.recentSessions.map(activity => html`
                    <div class="activity-item">
                      <span class="activity-icon">
                        ${activity.type === 'error' ? '❌' : 
                          activity.type === 'response' ? '🤖' : '👤'}
                      </span>
                      <div class="activity-content">
                        <p class="activity-title">${activity.title}</p>
                        <p class="activity-time">
                          ${new Date(activity.time).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  `)
                : html`
                    <div class="empty-state">
                      <div class="empty-state-icon">📝</div>
                      <p>No recent activity</p>
                      <p>Activity will appear here as you use Claude Code</p>
                    </div>
                  `}
            </div>
          </section>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "dashboard-view": DashboardView;
  }
}