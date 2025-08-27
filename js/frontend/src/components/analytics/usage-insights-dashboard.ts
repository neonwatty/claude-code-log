import { html, css, CSSResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component";
import { WebSocketController } from "../../utils/websocket/websocket-controller";
import { MessageType } from "../../utils/websocket/message-types";

/**
 * Usage insights data interface
 */
export interface UsageInsights {
  totalTokensUsed: number;
  averageTokensPerSession: number;
  peakUsageHours: Array<{ hour: number; tokens: number }>;
  topTokenConsumingSessions: Array<{
    sessionId: string;
    title: string;
    tokens: number;
    duration: number;
  }>;
  tokenEfficiencyScore: number;
  recommendations: Array<{
    type: "optimization" | "usage" | "performance";
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
    impact: string;
  }>;
  trends: {
    daily: Array<{ date: string; tokens: number; sessions: number }>;
    weekly: Array<{ week: string; tokens: number; sessions: number }>;
    monthly: Array<{ month: string; tokens: number; sessions: number }>;
  };
}

/**
 * Usage Insights Dashboard Component
 * Displays comprehensive analytics insights and recommendations
 */
@customElement("usage-insights-dashboard")
export class UsageInsightsDashboard extends BaseComponent {
  @property({ type: Object })
  insights: UsageInsights | null = null;

  @property({ type: Boolean })
  realTimeUpdates = true;

  @state()
  private selectedTrendPeriod: "daily" | "weekly" | "monthly" = "daily";

  @state()
  private selectedRecommendationFilter: "all" | "optimization" | "usage" | "performance" = "all";

  @state()
  private expandedSessions = new Set<string>();

  private wsController = new WebSocketController(this);

  static override styles: CSSResult[] = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        padding: var(--spacing-lg);
      }

      .insights-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-lg);
        padding-bottom: var(--spacing-md);
        border-bottom: 1px solid var(--color-border);
      }

      .insights-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0;
      }

      .efficiency-score {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
      }

      .score-circle {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-bold);
        color: white;
        position: relative;
      }

      .score-circle.excellent {
        background: linear-gradient(135deg, var(--color-success), #4ade80);
      }

      .score-circle.good {
        background: linear-gradient(135deg, var(--color-info), #60a5fa);
      }

      .score-circle.fair {
        background: linear-gradient(135deg, var(--color-warning), #fbbf24);
      }

      .score-circle.poor {
        background: linear-gradient(135deg, var(--color-error), #f87171);
      }

      .score-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        text-align: center;
      }

      .insights-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacing-lg);
        margin-bottom: var(--spacing-lg);
      }

      .insight-card {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-lg);
        box-shadow: var(--shadow-sm);
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-md);
      }

      .card-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .card-icon {
        width: 20px;
        height: 20px;
        opacity: 0.8;
      }

      .trend-selector {
        display: flex;
        gap: var(--spacing-xs);
      }

      .trend-button {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border);
        background: var(--color-bg-primary);
        color: var(--color-text);
        border-radius: var(--border-radius-sm);
        cursor: pointer;
        font-size: var(--font-size-xs);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        transition: all var(--transition-base);
      }

      .trend-button:hover {
        background: var(--color-bg-tertiary);
        border-color: var(--color-border-hover);
      }

      .trend-button.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .peak-hours-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }

      .peak-hour-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-sm);
        background: var(--color-bg-tertiary);
        border-radius: var(--border-radius-sm);
        border-left: 4px solid var(--color-primary);
      }

      .hour-time {
        font-weight: var(--font-weight-medium);
        color: var(--color-text);
      }

      .hour-tokens {
        font-weight: var(--font-weight-semibold);
        color: var(--color-primary);
      }

      .top-sessions-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
        max-height: 300px;
        overflow-y: auto;
      }

      .session-item {
        padding: var(--spacing-sm);
        background: var(--color-bg-tertiary);
        border-radius: var(--border-radius-sm);
        border-left: 4px solid;
        cursor: pointer;
        transition: all var(--transition-base);
      }

      .session-item:hover {
        background: var(--color-bg-hover);
        transform: translateX(2px);
      }

      .session-item.high-usage {
        border-left-color: var(--color-error);
      }

      .session-item.medium-usage {
        border-left-color: var(--color-warning);
      }

      .session-item.low-usage {
        border-left-color: var(--color-success);
      }

      .session-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-xs);
      }

      .session-title {
        font-weight: var(--font-weight-medium);
        color: var(--color-text);
        font-size: var(--font-size-sm);
      }

      .session-tokens {
        font-weight: var(--font-weight-semibold);
        color: var(--color-primary);
        font-size: var(--font-size-sm);
      }

      .session-details {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        display: flex;
        justify-content: space-between;
      }

      .recommendations-section {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-lg);
        margin-bottom: var(--spacing-lg);
      }

      .recommendations-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-md);
      }

      .recommendations-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0;
      }

      .recommendation-filters {
        display: flex;
        gap: var(--spacing-xs);
      }

      .filter-button {
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-border);
        background: var(--color-bg-primary);
        color: var(--color-text);
        border-radius: var(--border-radius-sm);
        cursor: pointer;
        font-size: var(--font-size-xs);
        text-transform: capitalize;
        transition: all var(--transition-base);
      }

      .filter-button:hover {
        background: var(--color-bg-tertiary);
      }

      .filter-button.active {
        background: var(--color-primary);
        color: white;
      }

      .recommendations-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-md);
      }

      .recommendation-item {
        padding: var(--spacing-md);
        background: var(--color-bg-tertiary);
        border-radius: var(--border-radius-sm);
        border-left: 4px solid;
      }

      .recommendation-item.high-priority {
        border-left-color: var(--color-error);
        background: color-mix(in srgb, var(--color-error) 5%, var(--color-bg-tertiary));
      }

      .recommendation-item.medium-priority {
        border-left-color: var(--color-warning);
        background: color-mix(in srgb, var(--color-warning) 5%, var(--color-bg-tertiary));
      }

      .recommendation-item.low-priority {
        border-left-color: var(--color-info);
        background: color-mix(in srgb, var(--color-info) 5%, var(--color-bg-tertiary));
      }

      .recommendation-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--spacing-sm);
      }

      .recommendation-title {
        font-weight: var(--font-weight-medium);
        color: var(--color-text);
        margin: 0;
        font-size: var(--font-size-sm);
      }

      .recommendation-badges {
        display: flex;
        gap: var(--spacing-xs);
      }

      .priority-badge {
        padding: 2px var(--spacing-xs);
        border-radius: var(--border-radius-sm);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .priority-badge.high {
        background: var(--color-error);
        color: white;
      }

      .priority-badge.medium {
        background: var(--color-warning);
        color: black;
      }

      .priority-badge.low {
        background: var(--color-info);
        color: white;
      }

      .type-badge {
        padding: 2px var(--spacing-xs);
        border-radius: var(--border-radius-sm);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: var(--color-bg-primary);
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
      }

      .recommendation-description {
        color: var(--color-text);
        line-height: var(--line-height-relaxed);
        margin-bottom: var(--spacing-sm);
        font-size: var(--font-size-sm);
      }

      .recommendation-impact {
        color: var(--color-text-secondary);
        font-size: var(--font-size-xs);
        font-style: italic;
      }

      .trends-section {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-lg);
      }

      .trend-chart {
        height: 200px;
        background: var(--color-bg-tertiary);
        border-radius: var(--border-radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        margin-top: var(--spacing-md);
      }

      .no-data {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-xl);
        color: var(--color-text-secondary);
        text-align: center;
      }

      .no-data-icon {
        font-size: 3rem;
        margin-bottom: var(--spacing-md);
        opacity: 0.5;
      }

      .no-data-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-medium);
        margin-bottom: var(--spacing-sm);
      }

      .no-data-description {
        font-size: var(--font-size-sm);
        max-width: 300px;
        line-height: var(--line-height-relaxed);
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    this.setupWebSocketListeners();
  }

  public setupWebSocketListeners(): void {
    if (this.realTimeUpdates && this.wsController.isConnected) {
      this.wsController.addEventListener("message", (event: CustomEvent) => {
        const message = event.detail;
        if (message.type === MessageType.ANALYTICS_INSIGHTS_UPDATE) {
          this.insights = message.payload;
          this.requestUpdate();
        }
      });
    }
  }

  public getEfficiencyScoreClass(score: number): string {
    if (score >= 90) return "excellent";
    if (score >= 75) return "good";
    if (score >= 60) return "fair";
    return "poor";
  }

  public getEfficiencyScoreLabel(score: number): string {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Good";
    if (score >= 60) return "Fair";
    return "Needs Improvement";
  }

  public getSessionUsageClass(tokens: number, maxTokens: number): string {
    const ratio = tokens / maxTokens;
    if (ratio >= 0.8) return "high-usage";
    if (ratio >= 0.4) return "medium-usage";
    return "low-usage";
  }

  public formatHour(hour: number): string {
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${ampm}`;
  }

  public formatDuration(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  public getFilteredRecommendations() {
    if (!this.insights?.recommendations) return [];
    
    if (this.selectedRecommendationFilter === "all") {
      return this.insights.recommendations;
    }
    
    return this.insights.recommendations.filter(
      rec => rec.type === this.selectedRecommendationFilter
    );
  }

  private handleTrendPeriodChange(period: "daily" | "weekly" | "monthly"): void {
    this.selectedTrendPeriod = period;
  }

  private handleRecommendationFilterChange(filter: typeof this.selectedRecommendationFilter): void {
    this.selectedRecommendationFilter = filter;
  }

  private toggleSessionExpansion(sessionId: string): void {
    if (this.expandedSessions.has(sessionId)) {
      this.expandedSessions.delete(sessionId);
    } else {
      this.expandedSessions.add(sessionId);
    }
    this.requestUpdate();
  }

  override render() {
    if (!this.insights) {
      return html`
        <div class="no-data">
          <div class="no-data-icon">📊</div>
          <div class="no-data-title">No Usage Insights Available</div>
          <div class="no-data-description">
            Analytics data is being processed. Please check back in a few moments.
          </div>
        </div>
      `;
    }

    const filteredRecommendations = this.getFilteredRecommendations();
    const maxSessionTokens = Math.max(...this.insights.topTokenConsumingSessions.map(s => s.tokens));

    return html`
      <div class="insights-header">
        <h2 class="insights-title">Usage Insights & Recommendations</h2>
        <div class="efficiency-score">
          <div class="score-circle ${this.getEfficiencyScoreClass(this.insights.tokenEfficiencyScore)}">
            ${this.insights.tokenEfficiencyScore}
          </div>
          <div class="score-label">
            ${this.getEfficiencyScoreLabel(this.insights.tokenEfficiencyScore)}<br>
            Efficiency Score
          </div>
        </div>
      </div>

      <div class="insights-grid">
        <!-- Peak Usage Hours Card -->
        <div class="insight-card">
          <div class="card-header">
            <h3 class="card-title">
              <span class="card-icon">⏰</span>
              Peak Usage Hours
            </h3>
          </div>
          <div class="peak-hours-list">
            ${this.insights.peakUsageHours.slice(0, 5).map(hour => html`
              <div class="peak-hour-item">
                <span class="hour-time">${this.formatHour(hour.hour)}</span>
                <span class="hour-tokens">${this.formatTokenCount(hour.tokens)} tokens</span>
              </div>
            `)}
          </div>
        </div>

        <!-- Top Token Consuming Sessions Card -->
        <div class="insight-card">
          <div class="card-header">
            <h3 class="card-title">
              <span class="card-icon">🔥</span>
              Top Token Consuming Sessions
            </h3>
          </div>
          <div class="top-sessions-list">
            ${this.insights.topTokenConsumingSessions.slice(0, 10).map(session => html`
              <div 
                class="session-item ${this.getSessionUsageClass(session.tokens, maxSessionTokens)}"
                @click=${() => this.toggleSessionExpansion(session.sessionId)}
              >
                <div class="session-header">
                  <span class="session-title">${this.truncateText(session.title, 40)}</span>
                  <span class="session-tokens">${this.formatTokenCount(session.tokens)}</span>
                </div>
                <div class="session-details">
                  <span>ID: ${session.sessionId.slice(0, 8)}...</span>
                  <span>Duration: ${this.formatDuration(session.duration)}</span>
                </div>
              </div>
            `)}
          </div>
        </div>
      </div>

      <!-- Recommendations Section -->
      <div class="recommendations-section">
        <div class="recommendations-header">
          <h3 class="recommendations-title">Optimization Recommendations</h3>
          <div class="recommendation-filters">
            ${["all", "optimization", "usage", "performance"].map(filter => html`
              <button
                class="filter-button ${filter === this.selectedRecommendationFilter ? 'active' : ''}"
                @click=${() => this.handleRecommendationFilterChange(filter as typeof this.selectedRecommendationFilter)}
              >
                ${filter}
              </button>
            `)}
          </div>
        </div>

        ${filteredRecommendations.length === 0 ? html`
          <div class="no-data" style="height: 100px;">
            <div class="no-data-title">No recommendations available</div>
          </div>
        ` : html`
          <div class="recommendations-list">
            ${filteredRecommendations.map(rec => html`
              <div class="recommendation-item ${rec.priority}-priority">
                <div class="recommendation-header">
                  <h4 class="recommendation-title">${rec.title}</h4>
                  <div class="recommendation-badges">
                    <span class="priority-badge ${rec.priority}">${rec.priority}</span>
                    <span class="type-badge">${rec.type}</span>
                  </div>
                </div>
                <div class="recommendation-description">${rec.description}</div>
                <div class="recommendation-impact">Impact: ${rec.impact}</div>
              </div>
            `)}
          </div>
        `}
      </div>

      <!-- Usage Trends Section -->
      <div class="trends-section">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">📈</span>
            Usage Trends
          </h3>
          <div class="trend-selector">
            ${["daily", "weekly", "monthly"].map(period => html`
              <button
                class="trend-button ${period === this.selectedTrendPeriod ? 'active' : ''}"
                @click=${() => this.handleTrendPeriodChange(period as typeof this.selectedTrendPeriod)}
              >
                ${period}
              </button>
            `)}
          </div>
        </div>
        
        <div class="trend-chart">
          ${this.insights.trends[this.selectedTrendPeriod].length === 0 
            ? "No trend data available for selected period"
            : `Showing ${this.insights.trends[this.selectedTrendPeriod].length} ${this.selectedTrendPeriod} data points`
          }
        </div>
      </div>
    `;
  }
}