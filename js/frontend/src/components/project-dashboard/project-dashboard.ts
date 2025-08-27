import { html, css, TemplateResult, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import type {
  ZodProject,
  ZodSession,
} from "../../../../shared/src/schemas/index.js";

export interface ProjectActivitySummary {
  totalSessions: number;
  totalMessages: number;
  totalTokensUsed: number;
  activeProjects: number;
  recentActivity: {
    todaySessions: number;
    weekSessions: number;
    monthSessions: number;
  };
  tokenBreakdown: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
  topProjects: Array<{
    project: ZodProject;
    sessionCount: number;
    tokenUsage: number;
    lastActivity: Date;
  }>;
  sessionTrends: Array<{
    date: string;
    sessionCount: number;
    tokenUsage: number;
  }>;
}

@customElement("project-dashboard")
export class ProjectDashboard extends BaseComponent {
  @property({ type: Array })
  projects: ZodProject[] = [];

  @property({ type: Array })
  sessions: ZodSession[] = [];

  @property({ type: Object })
  activitySummary: ProjectActivitySummary | null = null;

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        font-family: var(--font-family-mono);
      }

      .dashboard-container {
        background-color: var(--color-surface);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-lg);
        margin-bottom: var(--spacing-lg);
        box-shadow:
          -7px -7px 10px var(--color-shadow-light),
          7px 7px 10px var(--color-shadow-dark);
        border-left: var(--color-border-light) 1px solid;
        border-top: var(--color-border-light) 1px solid;
        border-bottom: var(--color-border-dark) 1px solid;
        border-right: var(--color-border-dark) 1px solid;
      }

      .dashboard-header {
        margin: 0 0 var(--spacing-lg) 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
      }

      .dashboard-title {
        font-size: 1.4em;
        color: var(--color-text);
        margin: 0;
      }

      .last-updated {
        font-size: 0.85em;
        color: var(--color-text-muted);
        font-style: italic;
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
      }

      .metric-card {
        background-color: var(--color-surface);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-md);
        transition: all var(--transition-fast);
        box-shadow:
          -3px -3px 5px var(--color-shadow-light),
          3px 3px 5px var(--color-shadow-dark);
      }

      .metric-card:hover {
        transform: translateY(-1px);
        box-shadow:
          -5px -5px 8px var(--color-shadow-light),
          5px 5px 8px var(--color-shadow-dark);
      }

      .metric-card-header {
        font-size: 0.85em;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: var(--spacing-xs);
      }

      .metric-card-value {
        font-size: 1.8em;
        font-weight: 600;
        color: var(--color-text);
        margin-bottom: var(--spacing-xs);
      }

      .metric-card-subtitle {
        font-size: 0.8em;
        color: var(--color-text-light);
      }

      .activity-sections {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-lg);
      }

      @media (min-width: 768px) {
        .activity-sections {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-lg);
        }
      }

      .activity-section {
        background-color: var(--color-surface);
        border: 1px solid var(--color-border-dark);
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-md);
      }

      .activity-section-header {
        font-size: 1.1em;
        color: var(--color-text);
        margin: 0 0 var(--spacing-md) 0;
        padding-bottom: var(--spacing-sm);
        border-bottom: 1px solid var(--color-border-dark);
      }

      .recent-activity-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }

      .activity-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-xs) 0;
        border-bottom: 1px solid var(--color-border-light);
      }

      .activity-item:last-child {
        border-bottom: none;
      }

      .activity-label {
        font-size: 0.85em;
        color: var(--color-text);
      }

      .activity-value {
        font-size: 0.85em;
        font-weight: 600;
        color: var(--color-primary);
      }

      .top-projects-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }

      .project-item {
        background-color: var(--color-surface-hover);
        border-radius: var(--border-radius-sm);
        padding: var(--spacing-sm);
        transition: all var(--transition-fast);
      }

      .project-item:hover {
        background-color: var(--color-surface-active);
        cursor: pointer;
      }

      .project-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-xs);
      }

      .project-name {
        font-size: 0.9em;
        font-weight: 600;
        color: var(--color-text);
        word-break: break-word;
      }

      .project-meta {
        display: flex;
        gap: var(--spacing-sm);
        font-size: 0.75em;
        color: var(--color-text-muted);
        flex-wrap: wrap;
      }

      .token-breakdown {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: var(--spacing-sm);
      }

      .token-item {
        text-align: center;
        padding: var(--spacing-xs);
        background-color: var(--color-surface-hover);
        border-radius: var(--border-radius-sm);
      }

      .token-item-label {
        font-size: 0.75em;
        color: var(--color-text-muted);
        margin-bottom: var(--spacing-xs);
      }

      .token-item-value {
        font-size: 0.9em;
        font-weight: 600;
        color: var(--color-text);
      }

      .empty-state {
        text-align: center;
        padding: var(--spacing-xl);
        color: var(--color-text-muted);
        font-style: italic;
      }

      .loading-skeleton {
        background: linear-gradient(
          90deg,
          var(--color-surface-hover) 25%,
          var(--color-surface) 50%,
          var(--color-surface-hover) 75%
        );
        background-size: 200% 100%;
        animation: loading-shimmer 1.5s infinite;
        border-radius: var(--border-radius-sm);
        height: 20px;
      }

      @keyframes loading-shimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }
    `,
  ];

  protected override willUpdate(changedProperties: PropertyValues): void {
    super.willUpdate(changedProperties);
    if (
      changedProperties.has("projects") ||
      changedProperties.has("sessions") ||
      !this.activitySummary
    ) {
      this.activitySummary = this.calculateActivitySummary();
    }
  }

  protected override updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    // Ensure the activity summary is always calculated after updates
    if (!this.activitySummary) {
      this.activitySummary = this.calculateActivitySummary();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Ensure activity summary is calculated when component connects
    this.updateComplete.then(() => {
      if (
        !this.activitySummary ||
        (this.projects.length > 0 && this.sessions.length > 0)
      ) {
        this.activitySummary = this.calculateActivitySummary();
        this.requestUpdate();
      }
    });
  }

  /**
   * Public method to force recalculation of activity summary
   * Useful for testing or when data needs to be refreshed
   */
  public recalculateActivitySummary(): void {
    this.activitySummary = this.calculateActivitySummary();
    this.requestUpdate();
  }

  private calculateActivitySummary(): ProjectActivitySummary {
    // Handle empty data cases
    if (this.sessions.length === 0 && this.projects.length === 0) {
      return {
        totalSessions: 0,
        totalMessages: 0,
        totalTokensUsed: 0,
        activeProjects: 0,
        recentActivity: { todaySessions: 0, weekSessions: 0, monthSessions: 0 },
        tokenBreakdown: {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
        topProjects: [],
        sessionTrends: this.generateSessionTrends([], 30),
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const month = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalSessions = this.sessions.length;
    const totalMessages = this.sessions.reduce(
      (sum, session) => sum + (session.entries?.length || 0),
      0,
    );

    const tokenBreakdown = this.sessions.reduce(
      (breakdown, session) => {
        breakdown.inputTokens += session.totalUsage.input_tokens || 0;
        breakdown.outputTokens += session.totalUsage.output_tokens || 0;
        breakdown.cacheCreationTokens +=
          session.totalUsage.cache_creation_input_tokens || 0;
        breakdown.cacheReadTokens +=
          session.totalUsage.cache_read_input_tokens || 0;
        return breakdown;
      },
      {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      },
    );

    const totalTokensUsed =
      tokenBreakdown.inputTokens +
      tokenBreakdown.outputTokens +
      tokenBreakdown.cacheCreationTokens +
      tokenBreakdown.cacheReadTokens;

    const recentActivity = {
      todaySessions: this.sessions.filter(
        (s) => s.firstTimestamp && new Date(s.firstTimestamp) >= today,
      ).length,
      weekSessions: this.sessions.filter(
        (s) => s.firstTimestamp && new Date(s.firstTimestamp) >= week,
      ).length,
      monthSessions: this.sessions.filter(
        (s) => s.firstTimestamp && new Date(s.firstTimestamp) >= month,
      ).length,
    };

    const projectStats = this.projects
      .map((project) => {
        const projectSessions = project.sessions || [];
        const sessionCount = projectSessions.length;
        const tokenUsage = projectSessions.reduce((sum, session) => {
          const usage = session.totalUsage || {};
          return (
            sum +
            (usage.input_tokens || 0) +
            (usage.output_tokens || 0) +
            (usage.cache_creation_input_tokens || 0) +
            (usage.cache_read_input_tokens || 0)
          );
        }, 0);
        const lastActivity =
          projectSessions.length > 0
            ? new Date(
                Math.max(
                  ...projectSessions.map((s) =>
                    new Date(s.lastTimestamp || 0).getTime(),
                  ),
                ),
              )
            : new Date(0);

        return { project, sessionCount, tokenUsage, lastActivity };
      })
      .filter((stats) => stats.sessionCount > 0);

    const topProjects = projectStats
      .sort(
        (a, b) =>
          b.sessionCount - a.sessionCount || b.tokenUsage - a.tokenUsage,
      )
      .slice(0, 5);

    const sessionTrends = this.generateSessionTrends(this.sessions, 30);

    return {
      totalSessions,
      totalMessages,
      totalTokensUsed,
      activeProjects: this.projects.length,
      recentActivity,
      tokenBreakdown,
      topProjects,
      sessionTrends,
    };
  }

  private generateSessionTrends(
    sessions: ZodSession[],
    days: number,
  ): Array<{ date: string; sessionCount: number; tokenUsage: number }> {
    const trends: Map<string, { sessionCount: number; tokenUsage: number }> =
      new Map();
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      trends.set(dateStr, { sessionCount: 0, tokenUsage: 0 });
    }

    sessions.forEach((session) => {
      if (session.firstTimestamp) {
        const sessionDate = new Date(session.firstTimestamp)
          .toISOString()
          .split("T")[0];
        const trend = trends.get(sessionDate);
        if (trend) {
          trend.sessionCount++;
          const usage = session.totalUsage || {};
          trend.tokenUsage +=
            (usage.input_tokens || 0) +
            (usage.output_tokens || 0) +
            (usage.cache_creation_input_tokens || 0) +
            (usage.cache_read_input_tokens || 0);
        }
      }
    });

    return Array.from(trends.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));
  }

  private handleProjectClick(project: ZodProject): void {
    this.emitEvent("project-selected", { project });
  }

  private renderMetricCard(
    header: string,
    value: string | number,
    subtitle?: string,
  ): TemplateResult {
    return html`
      <div class="metric-card">
        <div class="metric-card-header">${header}</div>
        <div class="metric-card-value">${value}</div>
        ${subtitle
          ? html`<div class="metric-card-subtitle">${subtitle}</div>`
          : ""}
      </div>
    `;
  }

  private renderRecentActivity(
    summary: ProjectActivitySummary,
  ): TemplateResult {
    return html`
      <div class="activity-section">
        <h3 class="activity-section-header">Recent Activity</h3>
        <div class="recent-activity-list">
          <div class="activity-item">
            <span class="activity-label">Today</span>
            <span class="activity-value"
              >${summary.recentActivity.todaySessions} sessions</span
            >
          </div>
          <div class="activity-item">
            <span class="activity-label">This Week</span>
            <span class="activity-value"
              >${summary.recentActivity.weekSessions} sessions</span
            >
          </div>
          <div class="activity-item">
            <span class="activity-label">This Month</span>
            <span class="activity-value"
              >${summary.recentActivity.monthSessions} sessions</span
            >
          </div>
        </div>
      </div>
    `;
  }

  private renderTopProjects(summary: ProjectActivitySummary): TemplateResult {
    return html`
      <div class="activity-section">
        <h3 class="activity-section-header">Top Projects</h3>
        <div class="top-projects-list">
          ${summary.topProjects.length > 0
            ? summary.topProjects.map(
                ({ project, sessionCount, tokenUsage, lastActivity }) => html`
                  <div
                    class="project-item"
                    @click=${() => this.handleProjectClick(project)}
                  >
                    <div class="project-item-header">
                      <span class="project-name">${project.name}</span>
                    </div>
                    <div class="project-meta">
                      <span
                        >${sessionCount}
                        session${sessionCount === 1 ? "" : "s"}</span
                      >
                      <span>${this.formatTokenCount(tokenUsage)} tokens</span>
                      <span
                        >Last: ${this.formatRelativeTime(lastActivity)}</span
                      >
                    </div>
                  </div>
                `,
              )
            : html`<div class="empty-state">No active projects</div>`}
        </div>
      </div>
    `;
  }

  private renderTokenBreakdown(
    summary: ProjectActivitySummary,
  ): TemplateResult {
    return html`
      <div class="activity-section" style="grid-column: 1 / -1;">
        <h3 class="activity-section-header">Token Usage Breakdown</h3>
        <div class="token-breakdown">
          <div class="token-item">
            <div class="token-item-label">Input</div>
            <div class="token-item-value">
              ${this.formatTokenCount(summary.tokenBreakdown.inputTokens)}
            </div>
          </div>
          <div class="token-item">
            <div class="token-item-label">Output</div>
            <div class="token-item-value">
              ${this.formatTokenCount(summary.tokenBreakdown.outputTokens)}
            </div>
          </div>
          <div class="token-item">
            <div class="token-item-label">Cache Creation</div>
            <div class="token-item-value">
              ${this.formatTokenCount(
                summary.tokenBreakdown.cacheCreationTokens,
              )}
            </div>
          </div>
          <div class="token-item">
            <div class="token-item-label">Cache Read</div>
            <div class="token-item-value">
              ${this.formatTokenCount(summary.tokenBreakdown.cacheReadTokens)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderLoadingSkeleton(): TemplateResult {
    return html`
      <div class="dashboard-container">
        <div class="dashboard-header">
          <div
            class="loading-skeleton"
            style="width: 200px; height: 28px;"
          ></div>
          <div
            class="loading-skeleton"
            style="width: 150px; height: 20px;"
          ></div>
        </div>
        <div class="metrics-grid">
          ${Array(4)
            .fill(0)
            .map(
              () => html`
                <div class="metric-card">
                  <div
                    class="loading-skeleton"
                    style="width: 80px; height: 16px; margin-bottom: 8px;"
                  ></div>
                  <div
                    class="loading-skeleton"
                    style="width: 60px; height: 24px; margin-bottom: 8px;"
                  ></div>
                  <div
                    class="loading-skeleton"
                    style="width: 120px; height: 14px;"
                  ></div>
                </div>
              `,
            )}
        </div>
      </div>
    `;
  }

  protected override render(): TemplateResult {
    if (this.isLoading) {
      return this.renderLoadingSkeleton();
    }

    if (this.error) {
      return html`
        <div class="dashboard-container">
          <div class="error">${this.error}</div>
        </div>
      `;
    }

    if (!this.activitySummary) {
      return html`
        <div class="dashboard-container">
          <div class="empty-state">No project data available</div>
        </div>
      `;
    }

    const summary = this.activitySummary;

    return html`
      <div class="dashboard-container">
        <div class="dashboard-header">
          <h1 class="dashboard-title">Project Dashboard</h1>
          <div class="last-updated">
            Last updated: ${this.formatTimestamp(new Date())}
          </div>
        </div>

        <div class="metrics-grid">
          ${this.renderMetricCard(
            "Total Sessions",
            summary.totalSessions,
            `${summary.totalMessages} messages`,
          )}
          ${this.renderMetricCard("Active Projects", summary.activeProjects)}
          ${this.renderMetricCard(
            "Total Tokens",
            this.formatTokenCount(summary.totalTokensUsed),
          )}
          ${this.renderMetricCard(
            "Today's Activity",
            summary.recentActivity.todaySessions,
            "sessions today",
          )}
        </div>

        <div class="activity-sections">
          ${this.renderRecentActivity(summary)}
          ${this.renderTopProjects(summary)}
          ${this.renderTokenBreakdown(summary)}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "project-dashboard": ProjectDashboard;
  }
}
