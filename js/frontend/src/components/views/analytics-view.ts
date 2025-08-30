import { html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseComponent } from "../base/base-component.js";
import { User, LogEntry } from "@shared/types";
import type { ZodSession } from "../../../../shared/src/schemas/index.js";
import "../analytics/analytics-dashboard.js";
import "../analytics/token-usage-chart.js";
import "../analytics/usage-insights-dashboard.js";

export interface AnalyticsTimeRange {
  label: string;
  days: number;
  value: string;
}

@customElement("analytics-view")
export class AnalyticsView extends BaseComponent {
  @property({ type: Array })
  sessions: ZodSession[] = [];

  @property({ type: Array })
  users: User[] = [];

  @property({ type: Array })
  logs: LogEntry[] = [];

  @state()
  private selectedTimeRange: AnalyticsTimeRange = {
    label: 'Last 7 days',
    days: 7,
    value: '7d'
  };

  @state()
  private analyticsData = {
    totalTokens: 0,
    averageSessionLength: 0,
    mostActiveDay: '',
    topFeatures: [] as string[]
  };

  private readonly timeRanges: AnalyticsTimeRange[] = [
    { label: 'Last 24 hours', days: 1, value: '1d' },
    { label: 'Last 7 days', days: 7, value: '7d' },
    { label: 'Last 30 days', days: 30, value: '30d' },
    { label: 'Last 90 days', days: 90, value: '90d' },
    { label: 'All time', days: 0, value: 'all' }
  ];

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .analytics-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-width: 1400px;
        margin: 0 auto;
        padding: var(--spacing-md);
        gap: var(--spacing-lg);
      }

      .analytics-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-lg);
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        box-shadow: var(--shadow-neumorphic);
        border: 1px solid var(--color-border-light);
      }

      .analytics-title {
        font-size: 1.8em;
        font-weight: var(--font-weight-bold);
        color: var(--color-text-header);
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .title-icon {
        font-size: 1.1em;
      }

      .time-range-selector {
        display: flex;
        gap: var(--spacing-xs);
        background: var(--color-surface-hover);
        padding: var(--spacing-xs);
        border-radius: var(--border-radius-md);
        border: 1px solid var(--color-border-medium);
      }

      .time-range-button {
        padding: var(--spacing-sm) var(--spacing-md);
        border: none;
        border-radius: var(--border-radius-sm);
        background: transparent;
        color: var(--color-text);
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        transition: all var(--transition-fast);
        white-space: nowrap;
      }

      .time-range-button:hover {
        background: var(--color-surface);
      }

      .time-range-button.active {
        background: var(--color-primary);
        color: white;
      }

      .analytics-content {
        flex: 1;
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--spacing-lg);
        overflow: auto;
      }

      .analytics-section {
        background: var(--color-surface);
        border-radius: var(--border-radius-lg);
        border: 1px solid var(--color-border-light);
        overflow: hidden;
      }

      .section-header {
        padding: var(--spacing-lg);
        border-bottom: 1px solid var(--color-border-light);
        background: var(--color-surface-hover);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .section-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .section-icon {
        font-size: 1.1em;
      }

      .section-content {
        padding: var(--spacing-lg);
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
      }

      .metric-card {
        background: var(--color-surface-hover);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius-md);
        padding: var(--spacing-md);
        text-align: center;
        transition: all var(--transition-fast);
      }

      .metric-card:hover {
        transform: var(--transform-hover);
        box-shadow: var(--shadow-md);
      }

      .metric-value {
        font-size: 2em;
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
        margin: 0 0 var(--spacing-xs) 0;
      }

      .metric-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        margin: 0;
      }

      .metric-change {
        font-size: var(--font-size-xs);
        margin-top: var(--spacing-xs);
        font-weight: var(--font-weight-medium);
      }

      .metric-change.positive {
        color: var(--color-success);
      }

      .metric-change.negative {
        color: var(--color-error);
      }

      .chart-container {
        height: 300px;
        width: 100%;
        background: var(--color-surface-hover);
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-muted);
        font-style: italic;
      }

      .insights-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .insight-item {
        padding: var(--spacing-md);
        border-bottom: 1px solid var(--color-border-light);
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-sm);
      }

      .insight-item:last-child {
        border-bottom: none;
      }

      .insight-icon {
        font-size: 1.2em;
        margin-top: var(--spacing-xs);
        flex-shrink: 0;
      }

      .insight-content {
        flex: 1;
      }

      .insight-title {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0 0 var(--spacing-xs) 0;
      }

      .insight-description {
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
        margin: 0;
        line-height: 1.4;
      }

      .empty-state {
        text-align: center;
        padding: var(--spacing-xxl);
        color: var(--color-text-muted);
      }

      .empty-icon {
        font-size: 4em;
        margin-bottom: var(--spacing-lg);
        opacity: 0.5;
      }

      .export-button {
        padding: var(--spacing-sm) var(--spacing-md);
        border: 1px solid var(--color-border-medium);
        border-radius: var(--border-radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .export-button:hover {
        background: var(--color-surface-hover);
        transform: var(--transform-hover);
        box-shadow: var(--shadow-md);
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .analytics-container {
          padding: var(--spacing-sm);
        }

        .analytics-header {
          flex-direction: column;
          gap: var(--spacing-md);
          align-items: stretch;
        }

        .time-range-selector {
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .time-range-selector::-webkit-scrollbar {
          display: none;
        }

        .analytics-title {
          font-size: 1.4em;
        }

        .metrics-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-sm);
        }
      }

      @media (max-width: 480px) {
        .metrics-grid {
          grid-template-columns: 1fr;
        }

        .time-range-button {
          padding: var(--spacing-xs) var(--spacing-sm);
          font-size: var(--font-size-xs);
        }
      }
    `
  ];

  protected override willUpdate(): void {
    this.calculateAnalyticsData();
  }

  private calculateAnalyticsData(): void {
    const filteredSessions = this.getFilteredSessions();
    
    this.analyticsData = {
      totalTokens: this.calculateTotalTokens(filteredSessions),
      averageSessionLength: this.calculateAverageSessionLength(filteredSessions),
      mostActiveDay: this.findMostActiveDay(filteredSessions),
      topFeatures: this.findTopFeatures(filteredSessions)
    };
  }

  private getFilteredSessions(): ZodSession[] {
    if (this.selectedTimeRange.days === 0) {
      return this.sessions;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.selectedTimeRange.days);

    return this.sessions.filter(session => 
      new Date(session.firstTimestamp) >= cutoff
    );
  }

  private calculateTotalTokens(sessions: ZodSession[]): number {
    return sessions.reduce((total, session) => {
      return total + 
        (session.totalUsage.input_tokens || 0) + 
        (session.totalUsage.output_tokens || 0);
    }, 0);
  }

  private calculateAverageSessionLength(sessions: ZodSession[]): number {
    if (sessions.length === 0) return 0;
    
    const totalMessages = sessions.reduce((total, session) => 
      total + session.entries.length, 0
    );
    
    return Math.round(totalMessages / sessions.length);
  }

  private findMostActiveDay(sessions: ZodSession[]): string {
    const dayCount: Record<string, number> = {};
    
    sessions.forEach(session => {
      const day = new Date(session.firstTimestamp).toLocaleDateString('en-US', { 
        weekday: 'long' 
      });
      dayCount[day] = (dayCount[day] || 0) + 1;
    });

    const mostActive = Object.entries(dayCount).reduce((max, [day, count]) => 
      count > max.count ? { day, count } : max, 
      { day: 'None', count: 0 }
    );

    return mostActive.day;
  }

  private findTopFeatures(sessions: ZodSession[]): string[] {
    // This would analyze tool usage, message types, etc.
    // For now, return placeholder data
    return ['Text Generation', 'Code Analysis', 'File Operations'];
  }

  private handleTimeRangeChange(timeRange: AnalyticsTimeRange): void {
    this.selectedTimeRange = timeRange;
  }

  private handleExportReport(): void {
    this.emitEvent('analytics-export-requested', { 
      timeRange: this.selectedTimeRange,
      data: this.analyticsData 
    });
  }

  protected safeRender(): TemplateResult {
    const filteredSessions = this.getFilteredSessions();

    return html`
      <div class="analytics-container">
        <header class="analytics-header">
          <h1 class="analytics-title">
            <span class="title-icon">📈</span>
            Analytics & Insights
          </h1>
          
          <div class="time-range-selector">
            ${this.timeRanges.map(range => html`
              <button
                class="time-range-button ${range.value === this.selectedTimeRange.value ? 'active' : ''}"
                @click=${() => this.handleTimeRangeChange(range)}
              >
                ${range.label}
              </button>
            `)}
          </div>
        </header>

        <div class="analytics-content">
          ${filteredSessions.length > 0 ? html`
            <!-- Key Metrics -->
            <section class="analytics-section">
              <div class="section-header">
                <h2 class="section-title">
                  <span class="section-icon">📊</span>
                  Key Metrics
                </h2>
                <button 
                  class="export-button"
                  @click=${this.handleExportReport}
                >
                  <span>💾</span>
                  Export Report
                </button>
              </div>
              <div class="section-content">
                <div class="metrics-grid">
                  <div class="metric-card">
                    <p class="metric-value">${filteredSessions.length}</p>
                    <p class="metric-label">Sessions</p>
                  </div>
                  <div class="metric-card">
                    <p class="metric-value">${this.analyticsData.totalTokens.toLocaleString()}</p>
                    <p class="metric-label">Total Tokens</p>
                  </div>
                  <div class="metric-card">
                    <p class="metric-value">${this.analyticsData.averageSessionLength}</p>
                    <p class="metric-label">Avg. Messages/Session</p>
                  </div>
                  <div class="metric-card">
                    <p class="metric-value">${this.analyticsData.mostActiveDay}</p>
                    <p class="metric-label">Most Active Day</p>
                  </div>
                </div>
              </div>
            </section>

            <!-- Usage Trends -->
            <section class="analytics-section">
              <div class="section-header">
                <h2 class="section-title">
                  <span class="section-icon">📈</span>
                  Usage Trends
                </h2>
              </div>
              <div class="section-content">
                <div class="chart-container">
                  <token-usage-chart 
                    .sessions=${filteredSessions}
                    .timeRange=${this.selectedTimeRange}
                  ></token-usage-chart>
                </div>
              </div>
            </section>

            <!-- Insights Dashboard -->
            <section class="analytics-section">
              <div class="section-header">
                <h2 class="section-title">
                  <span class="section-icon">💡</span>
                  Insights & Recommendations
                </h2>
              </div>
              <div class="section-content">
                <usage-insights-dashboard
                  .sessions=${filteredSessions}
                  .logs=${this.logs}
                  .timeRange=${this.selectedTimeRange}
                ></usage-insights-dashboard>
              </div>
            </section>

            <!-- Detailed Analytics Dashboard -->
            <section class="analytics-section">
              <div class="section-header">
                <h2 class="section-title">
                  <span class="section-icon">🔍</span>
                  Detailed Analysis
                </h2>
              </div>
              <div class="section-content">
                <analytics-dashboard
                  .sessions=${filteredSessions}
                  .users=${this.users}
                  .logs=${this.logs}
                  .timeRange=${this.selectedTimeRange.value}
                ></analytics-dashboard>
              </div>
            </section>
          ` : html`
            <div class="empty-state">
              <div class="empty-icon">📈</div>
              <h3>No Data Available</h3>
              <p>No sessions found for the selected time period.</p>
              <p>Analytics will appear here once you have session data.</p>
            </div>
          `}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "analytics-view": AnalyticsView;
  }
}